/** Isolated PHP/MySQL integration test. Run only against an EMPTY disposable CI DB. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

if (process.env.LAWBOOK_TEST_DATABASE !== 'disposable') throw Error('Requires explicit disposable database opt-in');
const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lawbook-http-'));
const pub = path.join(tmp, 'public_html');
const priv = path.join(tmp, 'lawbook-private');
fs.cpSync(path.join(root, 'deploy/cpanel/public'), pub, { recursive: true });
fs.cpSync(path.join(root, 'deploy/cpanel/private'), priv, { recursive: true });
const helper = `$db=new PDO(getenv('TEST_MYSQL_DSN'),getenv('TEST_MYSQL_USER'),getenv('TEST_MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]); $db->exec("SET time_zone = '+00:00'");`;
const sql = (query) => JSON.parse(execFileSync('php', ['-r', helper + ' $q=$db->query($argv[1]); echo json_encode($q->columnCount() ? $q->fetchAll(PDO::FETCH_ASSOC) : []);', query], { encoding: 'utf8' }));
execFileSync('php', ['-r', helper + ' $db->exec(file_get_contents($argv[1]));', path.join(priv, 'schema.sql')]);
fs.writeFileSync(path.join(priv, 'config.php'), `<?php return ['dsn'=>getenv('TEST_MYSQL_DSN'),'db_user'=>getenv('TEST_MYSQL_USER'),'db_password'=>getenv('TEST_MYSQL_PASSWORD'),'rate_limit_secret'=>'isolated-ci-test-secret-32-chars-minimum','sales_enabled'=>true,'site_name'=>'Test','payment_instructions'=>'Test','support_contact'=>'Test','allow_http_local'=>true];`);
fs.mkdirSync(path.join(priv, 'app/_next'), { recursive: true });
fs.writeFileSync(path.join(priv, 'app/index.html'), 'PRIVATE_PAID_HTML');
fs.writeFileSync(path.join(priv, 'app/_next/test.js'), 'PRIVATE_PAID_JS');
fs.writeFileSync(path.join(priv, 'app/data.json'), '{"paid":true}');
fs.writeFileSync(path.join(priv, 'app/sw.js'), 'NO_OFFLINE_WORKER');
fs.writeFileSync(path.join(priv, 'previews.json'), '[{"title":"Free","items":[{"title":"Sample","text":"PUBLIC_SAMPLE"}]}]');
const socket = net.createServer();
socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port; await new Promise((resolve) => socket.close(resolve));
const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', pub, path.join(pub, 'index.php')], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; server.stderr.on('data', (chunk) => { logs += chunk; });
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('PHP startup timeout')), 10000);
    server.once('error', reject);
    const ready = (chunk) => { if (String(chunk).includes('Development Server')) { clearTimeout(timeout); resolve(); } };
    server.stderr.on('data', ready);
    if (logs.includes('Development Server')) { clearTimeout(timeout); resolve(); }
  });
  const origin = `http://127.0.0.1:${port}`;
  class Client {
    cookies = new Map(); csrf = '';
    async request(url = '/', values) {
      const response = await fetch(origin + url, { method: values ? 'POST' : 'GET', redirect: 'manual', headers: { Cookie: [...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '), ...(values ? {'Content-Type':'application/x-www-form-urlencoded'} : {}) }, ...(values ? {body:new URLSearchParams({csrf:this.csrf,...values})} : {}) });
      for (const item of response.headers.getSetCookie()) { const [name,...value] = item.split(';')[0].split('='); this.cookies.set(name,value.join('=')); }
      const text=await response.text(); const match=text.match(/name="csrf" value="([a-f0-9]+)"/); if(match)this.csrf=match[1];
      return {status:response.status,text,headers:response.headers};
    }
  }
  const guest=new Client(), admin=new Client(), member=new Client();
  assert.match((await guest.request()).text,/PUBLIC_SAMPLE/);
  assert.equal((await guest.request('/app/')).status,303);
  for (const asset of ['/app/_next/test.js','/app/data.json']) assert.equal((await guest.request(asset)).status,403);
  await member.request('/index.php?page=register');
  assert.equal((await member.request('/index.php?page=register',{action:'register',csrf:'bad',email:'member@example.test',password:'Unique-CI-Passphrase-123',accept_terms:'yes'})).status,403);
  for(const [client,email] of [[member,'member@example.test'],[admin,'admin@example.test']]) {
    await client.request('/index.php?page=register');
    assert.equal((await client.request('/index.php?page=register',{action:'register',email,password:'Unique-CI-Passphrase-123',accept_terms:'yes'})).status,303);
  }
  sql("UPDATE users SET role='admin' WHERE email='admin@example.test'");
  await admin.request('/index.php?page=admin');
  assert.equal((await member.request('/index.php?page=admin')).status,403);
  assert.equal((await admin.request('/index.php?page=admin',{action:'plan',name:'CI plan',days:'30',price:'100000'})).status,303);
  const plan=sql('SELECT id FROM plans')[0].id;
  await member.request('/index.php?page=subscribe');
  assert.equal((await member.request('/index.php?page=subscribe',{action:'request',plan:String(plan),reference:'CI-ONLY-REF',days:'999999',price:'1'})).status,303);
  assert.equal(JSON.parse((await member.request('/index.php?page=status')).text).active,false);
  assert.equal((await member.request('/app/data.json')).status,403);
  await member.request('/index.php?page=subscribe');
  assert.equal((await member.request('/index.php?page=subscribe',{action:'request',plan:String(plan),reference:'duplicate-pending'})).status,422);
  const saved=sql('SELECT id,duration_days,price_rial FROM payment_requests')[0];
  assert.equal(Number(saved.duration_days),30); assert.equal(Number(saved.price_rial),100000);
  const request=saved.id;
  assert.equal((await member.request('/index.php?page=subscribe',{action:'approve',request:String(request)})).status,403);
  assert.equal((await admin.request('/index.php?page=admin',{action:'approve',request:String(request)})).status,303);
  assert.equal(JSON.parse((await member.request('/index.php?page=status')).text).active,true);
  assert.equal((await member.request('/app/')).text,'PRIVATE_PAID_HTML');
  assert.equal((await member.request('/app/_next/test.js')).text,'PRIVATE_PAID_JS');
  const data=await member.request('/app/data.json');
  assert.equal(data.status,200); assert.match(data.headers.get('cache-control'),/no-store/);
  assert.equal((await guest.request('/app/data.json')).status,403);
  const expiry=sql("SELECT subscription_expires_at FROM users WHERE email='member@example.test'")[0].subscription_expires_at;
  assert.equal((await admin.request('/index.php?page=admin',{action:'approve',request:String(request)})).status,422);
  assert.equal(sql("SELECT subscription_expires_at FROM users WHERE email='member@example.test'")[0].subscription_expires_at,expiry);
  assert.equal((await member.request('/app/sw.js')).status,404);
  assert.equal((await member.request('/app/%252e%252e/config.php')).status,404);
  await member.request('/index.php?page=subscribe');
  assert.equal((await member.request('/index.php?page=subscribe',{action:'request',plan:String(plan),reference:'second-payment'})).status,303);
  const second=sql('SELECT MAX(id) AS id FROM payment_requests')[0].id;
  assert.equal((await admin.request('/index.php?page=admin',{action:'approve',request:String(second)})).status,303);
  const renewed=sql("SELECT subscription_expires_at FROM users WHERE email='member@example.test'")[0].subscription_expires_at;
  assert.equal(Date.parse(renewed+'Z')-Date.parse(expiry+'Z'),30*86400000);
  sql("UPDATE users SET subscription_expires_at='2000-01-01 00:00:00' WHERE email='member@example.test'");
  assert.equal(JSON.parse((await member.request('/index.php?page=status')).text).active,false);
  assert.equal((await member.request('/app/_next/test.js')).status,403);
  sql("UPDATE users SET subscription_expires_at='2099-01-01 00:00:00' WHERE email='member@example.test'");
  const id=sql("SELECT id FROM users WHERE email='member@example.test'")[0].id;
  assert.equal((await admin.request('/index.php?page=admin',{action:'revoke',member:String(id)})).status,303);
  assert.equal((await member.request('/app/data.json')).status,403);
  sql("UPDATE users SET subscription_expires_at='2099-01-01 00:00:00',disabled=1 WHERE email='member@example.test'");
  assert.equal(JSON.parse((await member.request('/index.php?page=status')).text).active,false);
  sql("UPDATE users SET disabled=0 WHERE email='member@example.test'");
  await member.request('/index.php?page=login');
  assert.equal((await member.request('/index.php?page=login',{action:'login',email:'member@example.test',password:'Wrong-CI-Passphrase-123'})).status,422);
  assert.equal((await member.request('/index.php?page=login',{action:'login',email:'member@example.test',password:'Unique-CI-Passphrase-123'})).status,303);
  assert.equal((await member.request('/app/data.json')).status,200);
  await member.request('/index.php?page=subscribe');
  assert.equal((await member.request('/index.php?page=subscribe',{action:'logout'})).status,303);
  assert.equal((await member.request('/app/data.json')).status,403);
  // Connection failure must never open paid files, including for a former member.
  fs.writeFileSync(path.join(priv,'config.php'),`<?php return ['dsn'=>'mysql:host=127.0.0.1;port=1;dbname=invalid','db_user'=>'invalid','db_password'=>'invalid','rate_limit_secret'=>'isolated-ci-test-secret-32-chars-minimum','allow_http_local'=>true];`);
  assert.equal((await member.request('/app/data.json')).status,503);
  console.log('PASS PHP/MySQL HTTP integration: anonymous access, CSRF, register, roles, manual request, approval, duplicate approval, renewal, expiry, revoke, disable, private JS/JSON, offline worker, database fail-closed');
} catch(error) {
  console.error(logs); throw error;
} finally {
  server.kill('SIGTERM'); await once(server,'exit'); fs.rmSync(tmp,{recursive:true,force:true});
}
