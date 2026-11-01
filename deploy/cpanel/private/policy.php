<?php
declare(strict_types=1);

function has_subscription(?array $user, ?int $now = null): bool {
    if (!$user || (int)$user['disabled'] !== 0 || empty($user['subscription_expires_at'])) return false;
    $expiry = strtotime($user['subscription_expires_at'] . ' UTC');
    return $expiry !== false && $expiry > ($now ?? time());
}

function new_expiry(?string $existing, int $days, ?int $now = null): string {
    if ($days < 1 || $days > 3660) throw new InvalidArgumentException('Invalid duration');
    $base = max($now ?? time(), $existing ? (int)strtotime($existing . ' UTC') : 0);
    return gmdate('Y-m-d H:i:s', $base + $days * 86400);
}

/** realpath containment prevents ../, encoded traversal, and symlink escapes. */
function protected_file(string $root, string $urlPath): ?string {
    $path = rawurldecode($urlPath);
    if (!str_starts_with($path, '/app/') || str_contains($path, "\0") || str_contains($path, '\\')) return null;
    $relative = substr($path, 5);
    foreach (explode('/', $relative) as $part) {
        if ($part === '..' || str_starts_with($part, '.')) return null;
    }
    // No offline worker, source maps, PHP scripts, or config files are served.
    if ($relative === 'sw.js') return null;
    $base = realpath($root);
    if (!$base) return null;
    $candidate = $base . '/' . $relative;
    if (is_dir($candidate)) $candidate .= '/index.html';
    $file = realpath($candidate);
    if (!$file || !is_file($file) || !str_starts_with($file, $base . DIRECTORY_SEPARATOR)) return null;
    $allowed = ['html','css','js','json','txt','woff','woff2','ttf','png','jpg','jpeg','gif','svg','ico','webp','webmanifest','wasm'];
    if (!in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), $allowed, true)) return null;
    return $file;
}
