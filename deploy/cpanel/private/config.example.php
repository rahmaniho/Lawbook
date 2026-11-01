<?php
// Copy as config.php OUTSIDE public_html. Never commit real credentials.
return [
    'dsn' => 'mysql:host=localhost;dbname=CPANELUSER_lawbook;charset=utf8mb4',
    'db_user' => 'CPANELUSER_lawbook',
    'db_password' => 'REPLACE_ME',
    'rate_limit_secret' => 'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS',
    // Enable only after legal/seller settings and staging checks are complete.
    'sales_enabled' => false,
    'site_name' => 'کتابچه حقوقی',
    'payment_instructions' => 'پیش از فعال‌سازی فروش، روش پرداخت و نام دریافت‌کننده را اینجا وارد کنید. شماره کارت یا رمز بانکی از کاربران دریافت نکنید.',
    'support_contact' => 'نشانی پشتیبانی خود را وارد کنید',
    // Set true ONLY for local testing; production MUST use HTTPS.
    'allow_http_local' => false,
];
