<?php
declare(strict_types=1);

$private = dirname(__DIR__) . '/lawbook-private';
if (!is_file($private . '/config.php') || !is_file($private . '/policy.php')) {
    http_response_code(503); exit('راه‌اندازی امن سرور کامل نشده است. راهنمای نصب cPanel را ببینید.');
}
$config = require $private . '/config.php';
require $private . '/policy.php';
if (strlen((string)($config['rate_limit_secret'] ?? '')) < 32 || str_starts_with($config['rate_limit_secret'], 'REPLACE')) {
    http_response_code(503); exit('تنظیمات امنیتی سرور کامل نیست.');
}
$isHttps = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$local = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
if (!$isHttps && !(($config['allow_http_local'] ?? false) && $local)) {
    http_response_code(503); exit('این سرویس فقط با HTTPS قابل استفاده است.');
}
header('Cache-Control: no-store, private, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
if ($isHttps) header('Strict-Transport-Security: max-age=31536000');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('LAWBOOKSESSID');
session_set_cookie_params(['lifetime'=>0, 'path'=>'/', 'secure'=>$isHttps, 'httponly'=>true, 'samesite'=>'Lax']);
session_start();
if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
$csrf = $_SESSION['csrf'];
function e($value): string { return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function go(string $page): void { header('Location: /index.php?page=' . rawurlencode($page), true, 303); exit; }
function stop_request(int $code, string $message): void { http_response_code($code); exit(e($message)); }
function field(string $key, int $max = 190): string {
    $value = $_POST[$key] ?? '';
    if (!is_string($value) || strlen($value) > $max) throw new InvalidArgumentException('اطلاعات واردشده معتبر نیست.');
    return trim($value);
}
function id_field(string $key): int {
    $value = field($key, 18);
    if (!ctype_digit($value) || (int)$value < 1) throw new InvalidArgumentException('شناسه معتبر نیست.');
    return (int)$value;
}
function query(PDO $db, string $sql, array $args = []): PDOStatement {
    $q = $db->prepare($sql); $q->execute($args); return $q;
}
function audit(PDO $db, int $actor, string $action, int $target, string $detail): void {
    query($db, 'INSERT INTO audit_log(actor_id,action,target_id,detail) VALUES (?,?,?,?)', [$actor,$action,$target,$detail]);
}
function throttle(PDO $db, string $secret, string $scope, string $key, int $limit, int $seconds): void {
    $window = (int)floor(time() / $seconds);
    $bucket = hash_hmac('sha256', $scope . ':' . $key . ':' . $window, $secret);
    query($db, 'INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE attempts=attempts+1', [$bucket,gmdate('Y-m-d H:i:s', ($window+2)*$seconds)]);
    $count = query($db, 'SELECT attempts FROM rate_limits WHERE bucket=?', [$bucket])->fetchColumn();
    if ((int)$count > $limit) stop_request(429, 'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.');
    if (random_int(1,100) === 1) query($db, 'DELETE FROM rate_limits WHERE expires_at < UTC_TIMESTAMP()');
}
try {
    $db = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec("SET time_zone = '+00:00'");
    $user = isset($_SESSION['user_id']) ? query($db,'SELECT * FROM users WHERE id=?',[(int)$_SESSION['user_id']])->fetch() : false;
    if ($user && (int)$user['disabled'] !== 0) { unset($_SESSION['user_id']); $user = false; }
} catch (Throwable $error) {
    error_log('Lawbook database unavailable: ' . get_class($error));
    stop_request(503, 'سرویس موقتاً در دسترس نیست؛ دسترسی اشتراک بدون تأیید سرور باز نمی‌شود.');
}
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if ($path === '/app' || str_starts_with($path, '/app/')) {
    if (!has_subscription($user ?: null)) {
        // Never return a login HTML page as JS/JSON: fail explicitly for assets.
        if (str_ends_with($path, '/') || $path === '/app') go('subscribe');
        stop_request(403, 'اشتراک فعال لازم است.');
    }
    $file = protected_file($private . '/app', $path === '/app' ? '/app/' : $path);
    if (!$file) stop_request(404, 'فایل پیدا نشد.');
    $types = ['html'=>'text/html; charset=utf-8','js'=>'application/javascript; charset=utf-8','json'=>'application/json; charset=utf-8','txt'=>'text/plain; charset=utf-8','css'=>'text/css; charset=utf-8','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','gif'=>'image/gif','ico'=>'image/x-icon','webp'=>'image/webp','woff'=>'font/woff','woff2'=>'font/woff2','ttf'=>'font/ttf','webmanifest'=>'application/manifest+json','wasm'=>'application/wasm'];
    header('Content-Type: ' . $types[strtolower(pathinfo($file, PATHINFO_EXTENSION))]);
    header('Content-Length: ' . filesize($file));
    session_write_close();
    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') readfile($file);
    exit;
}
if (!in_array($path, ['/', '/index.php'], true)) stop_request(404, 'صفحه پیدا نشد.');
$page = isset($_GET['page']) && is_string($_GET['page']) ? $_GET['page'] : 'home';
if ($page === 'status') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['active'=>has_subscription($user ?: null), 'expiresAt'=>$user['subscription_expires_at'] ?? null]); exit;
}
$errorMessage = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!is_string($_POST['csrf'] ?? null) || !hash_equals($csrf, $_POST['csrf'])) stop_request(403, 'درخواست معتبر نیست؛ صفحه را تازه کنید.');
    try {
        $action = field('action', 32);
        if (in_array($action,['login','register'],true)) {
            $email = strtolower(field('email'));
            $password = $_POST['password'] ?? '';
            if (!filter_var($email,FILTER_VALIDATE_EMAIL) || !is_string($password) || strlen($password)>72 || strlen($password)<12) throw new InvalidArgumentException('ایمیل معتبر و گذرواژه ۱۲ تا ۷۲ بایتی وارد کنید.');
            throttle($db,$config['rate_limit_secret'],$action.'-ip',$_SERVER['REMOTE_ADDR'] ?? '',$action==='register'?5:30,900);
            throttle($db,$config['rate_limit_secret'],$action.'-email',$email,10,900);
            if ($action === 'register') {
                if (field('accept_terms',3)!=='yes') throw new InvalidArgumentException('شرایط استفاده را بپذیرید.');
                if (query($db,'SELECT id FROM users WHERE email=?',[$email])->fetch()) throw new InvalidArgumentException('ثبت‌نام ممکن نیست؛ اگر حساب دارید وارد شوید یا با پشتیبانی تماس بگیرید.');
                query($db,'INSERT INTO users(email,password_hash) VALUES (?,?)',[$email,password_hash($password,PASSWORD_DEFAULT)]);
                $loginId = (int)$db->lastInsertId();
            } else {
                $candidate = query($db,'SELECT * FROM users WHERE email=?',[$email])->fetch();
                // A fixed valid hash ensures a password check even for unknown users.
                $hash = $candidate['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
                $valid = password_verify($password,$hash);
                if (!$candidate || !$valid || (int)$candidate['disabled']!==0) throw new InvalidArgumentException('ایمیل یا گذرواژه صحیح نیست.');
                $loginId = (int)$candidate['id'];
                if (password_needs_rehash($hash,PASSWORD_DEFAULT)) query($db,'UPDATE users SET password_hash=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$loginId]);
            }
            session_regenerate_id(true); $_SESSION['user_id']=$loginId; $_SESSION['csrf']=bin2hex(random_bytes(32)); go('subscribe');
        }
        if (!$user) stop_request(401,'ابتدا وارد حساب شوید.');
        if ($action === 'logout') {
            $_SESSION=[]; session_destroy(); setcookie('LAWBOOKSESSID','',['expires'=>time()-3600,'path'=>'/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Lax']);
            header('Clear-Site-Data: "cache", "storage"'); go('home');
        }
        if ($action === 'request') {
            if (!($config['sales_enabled'] ?? false)) throw new InvalidArgumentException('فروش اشتراک هنوز فعال نشده است.');
            $planId=id_field('plan'); $reference=field('reference');
            if ($reference==='') throw new InvalidArgumentException('شناسه پیگیری پرداخت را بنویسید؛ شماره کارت و اطلاعات محرمانه وارد نکنید.');
            $db->beginTransaction();
            query($db,'SELECT id FROM users WHERE id=? FOR UPDATE',[$user['id']]);
            if (query($db,"SELECT id FROM payment_requests WHERE user_id=? AND status='pending'",[$user['id']])->fetch()) throw new InvalidArgumentException('یک درخواست در انتظار بررسی دارید.');
            $plan=query($db,'SELECT * FROM plans WHERE id=? AND enabled=1 FOR UPDATE',[$planId])->fetch();
            if (!$plan) throw new InvalidArgumentException('طرح فعال پیدا نشد.');
            query($db,'INSERT INTO payment_requests(user_id,plan_id,plan_name,duration_days,price_rial,reference_code) VALUES (?,?,?,?,?,?)',[$user['id'],$plan['id'],$plan['name'],$plan['duration_days'],$plan['price_rial'],$reference]);
            $db->commit(); go('subscribe');
        }
        if (($user['role'] ?? '') !== 'admin') stop_request(403,'این عملیات فقط برای مدیر مجاز است.');
        if ($action === 'plan') {
            $name=field('name',120); $days=id_field('days'); $price=id_field('price');
            if ($name==='' || $days>3660 || $price>1000000000000) throw new InvalidArgumentException('نام، مدت یا قیمت طرح معتبر نیست.');
            $db->beginTransaction();
            query($db,'INSERT INTO plans(name,duration_days,price_rial) VALUES (?,?,?)',[$name,$days,$price]);
            audit($db,(int)$user['id'],'create_plan',(int)$db->lastInsertId(),'duration='.$days.';price_rial='.$price); $db->commit(); go('admin');
        }
        if ($action === 'disable_plan') {
            $id=id_field('plan'); $db->beginTransaction(); query($db,'UPDATE plans SET enabled=0 WHERE id=?',[$id]); audit($db,(int)$user['id'],'disable_plan',$id,'disabled'); $db->commit(); go('admin');
        }
        if ($action === 'approve' || $action === 'reject') {
            $id=id_field('request'); $db->beginTransaction();
            // Use the same lock order as request creation: user first, request second.
            $target=query($db,'SELECT user_id FROM payment_requests WHERE id=?',[$id])->fetch();
            if (!$target) throw new InvalidArgumentException('درخواست پیدا نشد.');
            $member=query($db,'SELECT * FROM users WHERE id=? FOR UPDATE',[$target['user_id']])->fetch();
            $request=query($db,'SELECT * FROM payment_requests WHERE id=? FOR UPDATE',[$id])->fetch();
            if (!$request || $request['status']!=='pending') throw new InvalidArgumentException('این درخواست قبلاً بررسی شده است؛ دوباره فعال نمی‌شود.');
            if ($action==='approve') {
                if ((int)$member['disabled']!==0) throw new InvalidArgumentException('حساب غیرفعال است.');
                $expiry=new_expiry($member['subscription_expires_at'],(int)$request['duration_days']);
                query($db,'UPDATE users SET subscription_expires_at=? WHERE id=?',[$expiry,$member['id']]);
            }
            query($db,'UPDATE payment_requests SET status=?,reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?',[$action==='approve'?'approved':'rejected',$user['id'],$id]);
            audit($db,(int)$user['id'],$action,$id,$action==='approve'?'expires='.$expiry:'rejected'); $db->commit(); go('admin');
        }
        if ($action === 'revoke') {
            $id=id_field('member'); $db->beginTransaction();
            query($db,'UPDATE users SET subscription_expires_at=NULL WHERE id=?',[$id]);
            audit($db,(int)$user['id'],'revoke',$id,'subscription removed'); $db->commit(); go('admin');
        }
        throw new InvalidArgumentException('عملیات معتبر نیست.');
    } catch (InvalidArgumentException $error) {
        if ($db->inTransaction()) $db->rollBack(); $errorMessage=$error->getMessage(); http_response_code(422);
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack(); error_log('Lawbook operation failed: '.get_class($error)); $errorMessage='عملیات انجام نشد؛ دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.'; http_response_code(503);
    }
}
if ($page==='admin' && (!$user || $user['role']!=='admin')) stop_request(403,'این بخش فقط برای مدیر مجاز است.');
if (!in_array($page,['home','login','register','subscribe','admin','terms'],true)) stop_request(404,'صفحه پیدا نشد.');
$nonce=base64_encode(random_bytes(18));
header("Content-Security-Policy: default-src 'none'; style-src 'nonce-$nonce'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
function hidden(string $csrf, string $action): void {
    echo '<input type="hidden" name="csrf" value="'.e($csrf).'"><input type="hidden" name="action" value="'.e($action).'">';
}
?>
<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=e($config['site_name'])?></title>
<style nonce="<?=e($nonce)?>">
*{box-sizing:border-box}body{margin:0;background:#f4f8f7;color:#172f30;font:16px/2 Tahoma,Arial,sans-serif}main,nav{max-width:960px;margin:auto;padding:20px}nav{display:flex;gap:14px;flex-wrap:wrap;align-items:center}a{color:#09675e}h1,h2,h3{line-height:1.6}article,.card{background:white;border:1px solid #cfdfdb;border-radius:18px;padding:22px;margin:18px 0}input,select,button{font:inherit;padding:10px;border-radius:9px;border:1px solid #90b7ac;max-width:100%}input:not([type=checkbox]),select{width:100%}label{display:block;margin:10px 0}button,.button{background:#09675e;color:white;cursor:pointer;padding:9px 16px;text-decoration:none;display:inline-block;border-radius:9px}small{display:block;color:#526a69}.error{background:#fff0ee;padding:16px;border:1px solid #c55}form{margin:12px 0}.inline{display:inline-block}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:right}.scroll{overflow:auto}summary{cursor:pointer;font-weight:bold}.badge{background:#e0f2ed;padding:4px 12px;border-radius:9px}
</style></head><body><nav><a href="/">خانه و نمونه‌های رایگان</a><a href="/index.php?page=subscribe">اشتراک</a><a href="/index.php?page=terms">شرایط استفاده</a>
<?php if ($user):?><span><?=e($user['email'])?></span><?php if ($user['role']==='admin'):?><a href="/index.php?page=admin">مدیریت</a><?php endif;?><form class="inline" method="post"><?php hidden($csrf,'logout');?><button>خروج</button></form><?php else:?><a href="/index.php?page=login">ورود</a><a href="/index.php?page=register">ثبت‌نام</a><?php endif;?></nav><main>
<?php if ($errorMessage):?><p role="alert" class="error"><?=e($errorMessage)?></p><?php endif;?>
<?php if ($page==='home'):?>
<h1><?=e($config['site_name'])?></h1><p>قوانین، آموزش کاربردی و ۱۳۰ نمونه قرارداد در ۱۷ موضوع. بخشی از محتوا را رایگان ببینید؛ نسخه کامل با اشتراک زمان‌دار در دسترس است.</p>
<a class="button" href="<?=has_subscription($user ?: null)?'/app/':'/index.php?page=subscribe'?>"><?=has_subscription($user ?: null)?'ورود به کتابچه کامل':'مشاهده طرح‌های اشتراک'?></a>
<p>نمونه‌ها آموزشی و تکمیل‌شده با اطلاعات فرضی‌اند و جای سند رسمی لازم یا نظر حقوقی اختصاصی را نمی‌گیرند.</p>
<?php $previews=is_file($private.'/previews.json')?json_decode(file_get_contents($private.'/previews.json'),true):[]; foreach ($previews as $section):?>
<article><h2><?=e($section['title'])?></h2><?php foreach ($section['items'] as $item):?><details><summary><?=e($item['title'])?></summary><p><?=nl2br(e($item['text']))?></p></details><?php endforeach;?><small>این‌ها نمونه‌های منتخب رایگان‌اند؛ ادامه در کتابچه کامل.</small></article>
<?php endforeach;?>
<?php elseif ($page==='login' || $page==='register'):?>
<h1><?=$page==='login'?'ورود':'ثبت‌نام'?></h1><form method="post" class="card"><?php hidden($csrf,$page);?><label>ایمیل<input type="email" name="email" required maxlength="190" autocomplete="email" dir="ltr"></label><label>گذرواژه (۱۲ تا ۷۲ بایت)<input type="password" name="password" required minlength="12" maxlength="72" autocomplete="<?=$page==='login'?'current-password':'new-password'?>"></label>
<?php if ($page==='register'):?><label><input type="checkbox" name="accept_terms" value="yes" required> <a href="/index.php?page=terms">شرایط استفاده و حریم خصوصی</a> را خوانده‌ام و می‌پذیرم.</label><?php endif;?><button><?=$page==='login'?'ورود':'ساخت حساب'?></button><small>برای بازیابی دسترسی با پشتیبانی تماس بگیرید؛ گذرواژه و رمز بانکی خود را ارسال نکنید.</small></form>
<?php elseif ($page==='subscribe'):?>
<h1>تهیه و تمدید اشتراک</h1>
<?php if ($user):?><p>وضعیت: <strong><?=has_subscription($user)?'فعال':'بدون اشتراک فعال'?></strong>؛ پایان اشتراک (UTC): <?=e($user['subscription_expires_at'] ?? '—')?></p><?php if (has_subscription($user)):?><a class="button" href="/app/">ورود به نسخه کامل</a><?php endif;?>
<p><?=nl2br(e($config['payment_instructions']))?></p><p>ارسال کد پیگیری، اشتراک را خودکار فعال نمی‌کند. مدیر باید پرداخت را مستقل بررسی کند. از ارسال شماره کامل کارت، CVV2، رمز یا اطلاعات محرمانه خودداری کنید.</p>
<?php $plans=($config['sales_enabled'] ?? false) ? query($db,'SELECT * FROM plans WHERE enabled=1 ORDER BY duration_days')->fetchAll() : []; if (!$plans):?><p>فروش هنوز فعال نشده است؛ با پشتیبانی تماس بگیرید.</p><?php endif;foreach ($plans as $plan):?>
<form method="post" class="card"><h2><?=e($plan['name'])?></h2><p><?=e($plan['duration_days'])?> روز — <?=e(number_format((int)$plan['price_rial']))?> ریال</p><?php hidden($csrf,'request');?><input type="hidden" name="plan" value="<?=e($plan['id'])?>"><label>کد پیگیری پرداخت<input name="reference" maxlength="190" required></label><button>ثبت درخواست بررسی پرداخت</button></form>
<?php endforeach;?>
<h2>درخواست‌های من</h2><?php foreach (query($db,'SELECT id,plan_name,status,created_at FROM payment_requests WHERE user_id=? ORDER BY id DESC LIMIT 30',[$user['id']])->fetchAll() as $request):?><p>#<?=e($request['id'])?> — <?=e($request['plan_name'])?> — <?=e(['pending'=>'در انتظار بررسی','approved'=>'تأییدشده','rejected'=>'ردشده'][$request['status']] ?? $request['status'])?></p><?php endforeach;?>
<?php else:?><p>نمونه‌های رایگان بدون حساب باز هستند. برای درخواست اشتراک <a href="/index.php?page=register">ثبت‌نام</a> کنید یا <a href="/index.php?page=login">وارد شوید</a>.</p><?php endif;?>
<?php elseif ($page==='admin'):?>
<h1>مدیریت اشتراک‌ها</h1><?php if (!($config['sales_enabled'] ?? false)):?><p class="error">فروش در تنظیمات خاموش است. پس از تکمیل شرایط حقوقی و آزمون نصب، sales_enabled را فعال کنید.</p><?php endif;?><p>تأیید را فقط پس از بررسی مستقل پرداخت در حساب دریافت‌کننده انجام دهید. هر درخواست فقط یک بار قابل تأیید است. تمدید از پایان اشتراک فعال و در غیر این صورت از زمان تأیید محاسبه می‌شود.</p>
<form method="post" class="card"><?php hidden($csrf,'plan');?><h2>طرح جدید</h2><label>نام طرح<input name="name" maxlength="120" required></label><label>مدت به روز<input type="number" name="days" min="1" max="3660" required></label><label>قیمت به ریال<input type="number" name="price" min="1" max="1000000000000" required></label><button>ایجاد طرح فروش</button></form>
<?php foreach(query($db,'SELECT * FROM plans ORDER BY id DESC LIMIT 50')->fetchAll() as $plan):?><form method="post" class="card"><?php hidden($csrf,'disable_plan');?><input type="hidden" name="plan" value="<?=e($plan['id'])?>"><?=e($plan['name'])?> — <?=e($plan['price_rial'])?> ریال — <?=e($plan['duration_days'])?> روز — <?=$plan['enabled']?'فعال':'غیرفعال'?> <?php if ($plan['enabled']):?><button>توقف فروش این طرح</button><?php endif;?></form><?php endforeach;?>
<h2>درخواست‌های پرداخت (حداکثر ۱۰۰ درخواست باز)</h2>
<?php foreach(query($db,"SELECT r.*,u.email FROM payment_requests r JOIN users u ON u.id=r.user_id WHERE r.status='pending' ORDER BY r.id LIMIT 100")->fetchAll() as $request):?>
<article><h3>#<?=e($request['id'])?> — <?=e($request['email'])?></h3><p><?=e($request['plan_name'])?>؛ <?=e($request['duration_days'])?> روز؛ <?=e($request['price_rial'])?> ریال</p><p>شناسه اعلامی: <?=e($request['reference_code'])?></p><form method="post"><?php hidden($csrf,'approve');?><input type="hidden" name="request" value="<?=e($request['id'])?>"><button>پرداخت را بررسی کردم؛ فعال‌سازی</button></form><form method="post"><?php hidden($csrf,'reject');?><input type="hidden" name="request" value="<?=e($request['id'])?>"><button>رد درخواست</button></form></article>
<?php endforeach;?>
<h2>کاربران اخیر</h2><p>شناسه کاربر را از فهرست یا پایگاه داده به دست آورید؛ لغو اشتراک در درخواست بعدی سرور مؤثر است.</p>
<div class="scroll"><table><tr><th>شناسه</th><th>ایمیل</th><th>پایان (UTC)</th></tr><?php foreach(query($db,'SELECT id,email,subscription_expires_at FROM users ORDER BY id DESC LIMIT 100')->fetchAll() as $member):?><tr><td><?=e($member['id'])?></td><td><?=e($member['email'])?></td><td><?=e($member['subscription_expires_at'] ?? '—')?></td></tr><?php endforeach;?></table></div>
<form method="post" class="card"><?php hidden($csrf,'revoke');?><label>شناسه کاربر برای لغو اشتراک<input name="member" type="number" min="1" required></label><button>لغو دسترسی اشتراک</button></form>
<h2>رویدادهای اخیر مدیریت</h2><?php foreach(query($db,'SELECT actor_id,action,target_id,detail,created_at FROM audit_log ORDER BY id DESC LIMIT 50')->fetchAll() as $event):?><p><?=e($event['created_at'])?> — مدیر <?=e($event['actor_id'])?> — <?=e($event['action'])?> — هدف <?=e($event['target_id'])?> — <?=e($event['detail'])?></p><?php endforeach;?>
<?php elseif ($page==='terms'):?>
<h1>شرایط استفاده و حریم خصوصی</h1><article><p>پیش‌نمایش‌های مشخص‌شده رایگان است. تهیه اشتراک، حق استفاده شخصی زمان‌دار از خدمات نسخه کامل ایجاد می‌کند و انتقال مالکیت محتوا یا حق بازفروش نیست. زمان اعتبار و مبلغ ریالی قبل از درخواست اعلام می‌شود. فعال‌سازی دستی پس از بررسی واقعی پرداخت است.</p><p>نمونه قراردادها، هویت‌ها و ارقام تکمیل‌شده فرضی و آموزشی‌اند. مقررات ممکن است تغییر کند؛ امضای قرارداد واقعی مستلزم بررسی اختصاصی، مجوز و ثبت لازم است. سرویس تضمین نتیجه دعوا یا معامله نمی‌دهد و حقوق آمره مصرف‌کننده را حذف نمی‌کند.</p><p>ایمیل، هش گذرواژه، وضعیت اشتراک، شناسه اعلامی پرداخت و سوابق مدیریت در سرور نگهداری می‌شود. محدودسازی تلاش ورود با شناسه مشتق‌شده از نشانی شبکه انجام می‌شود. اطلاعات یادداشت شخصی در مرورگر است؛ فایل‌های مشاهده‌شده ممکن است پس از دانلود روی دستگاه باقی بماند. برای اصلاح یا حذف حساب با پشتیبانی تماس بگیرید؛ نگهداری اسناد مالی تابع قانون است.</p><p>این متن باید پیش از فروش با مشخصات هویت فروشنده، نشانی، شرایط پشتیبانی، انصراف و استرداد وجه، دوره نگهداری اطلاعات و الزامات قانونی روز توسط صاحب سرویس تکمیل و بازبینی شود. تا آن زمان طرح فروش ایجاد نکنید.</p></article>
<?php endif;?>
<footer class="card">پشتیبانی: <?=e($config['support_contact'])?>؛ زمان‌های مدیریتی بر مبنای UTC نمایش داده می‌شود.</footer></main></body></html>
