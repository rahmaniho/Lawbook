<?php
declare(strict_types=1);
require dirname(__DIR__) . '/deploy/cpanel/private/policy.php';
$count=0;
function check(bool $condition, string $message): void {
    global $count; ++$count;
    if (!$condition) throw new RuntimeException($message);
}
$now = strtotime('2026-11-01 12:00:00 UTC');
check(!has_subscription(null,$now),'anonymous denied');
check(!has_subscription(['disabled'=>0,'subscription_expires_at'=>null],$now),'no plan denied');
check(!has_subscription(['disabled'=>0,'subscription_expires_at'=>'2026-11-01 12:00:00'],$now),'exact expiry denied');
check(!has_subscription(['disabled'=>1,'subscription_expires_at'=>'2027-01-01 00:00:00'],$now),'disabled denied');
check(has_subscription(['disabled'=>0,'subscription_expires_at'=>'2026-11-01 12:00:01'],$now),'active allowed');
check(!has_subscription(['disabled'=>0,'role'=>'admin','subscription_expires_at'=>null],$now),'admin role alone does not expose corpus');
check(new_expiry(null,30,$now)==='2026-12-01 12:00:00','new subscription');
check(new_expiry('2026-12-01 12:00:00',30,$now)==='2026-12-31 12:00:00','renew active from expiry');
check(new_expiry('2026-01-01 00:00:00',30,$now)==='2026-12-01 12:00:00','renew expired from now');
foreach ([0,-1,3661] as $days) { $thrown=false; try { new_expiry(null,$days,$now); } catch (InvalidArgumentException $e) { $thrown=true; } check($thrown,'invalid duration denied'); }
$base=sys_get_temp_dir().'/lawbook-policy-'.bin2hex(random_bytes(6));
mkdir($base); mkdir($base.'/app'); mkdir($base.'/app/_next');
file_put_contents($base.'/app/index.html','test'); file_put_contents($base.'/app/_next/test.js','test');
file_put_contents($base.'/app/data.json','{}'); file_put_contents($base.'/secret.txt','private');
file_put_contents($base.'/app/config.php','private'); file_put_contents($base.'/app/sw.js','worker');
file_put_contents($base.'/app/test.map','map');
check(protected_file($base.'/app','/app/')===realpath($base.'/app/index.html'),'index resolved');
check(protected_file($base.'/app','/app/_next/test.js')===realpath($base.'/app/_next/test.js'),'JS resolved');
check(protected_file($base.'/app','/app/data.json')===realpath($base.'/app/data.json'),'JSON resolved');
foreach (['/app/../secret.txt','/app/%2e%2e/secret.txt','/app/%252e%252e/secret.txt','/app/config.php','/app/sw.js','/app/test.map','/app/.env','/app/%00data.json','/other/data.json','/app/..\\secret.txt'] as $path) check(protected_file($base.'/app',$path)===null,'forbidden '.$path);
if (symlink($base.'/secret.txt',$base.'/app/link.txt')) { check(protected_file($base.'/app','/app/link.txt')===null,'symlink escape denied'); unlink($base.'/app/link.txt'); }
foreach (['app/index.html','app/_next/test.js','app/data.json','secret.txt','app/config.php','app/sw.js','app/test.map'] as $file) unlink($base.'/'.$file);
rmdir($base.'/app/_next'); rmdir($base.'/app'); rmdir($base);
echo "PASS: $count PHP subscription/path policy checks\n";
