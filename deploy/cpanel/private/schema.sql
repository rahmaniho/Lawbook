-- Import once into an empty database via cPanel/phpMyAdmin. Use MySQL 5.7+/MariaDB with InnoDB.
SET NAMES utf8mb4;
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'member',
  disabled TINYINT NOT NULL DEFAULT 0,
  subscription_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE plans (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  duration_days INT UNSIGNED NOT NULL,
  price_rial BIGINT UNSIGNED NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE payment_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  plan_name VARCHAR(120) NOT NULL,
  duration_days INT UNSIGNED NOT NULL,
  price_rial BIGINT UNSIGNED NOT NULL,
  reference_code VARCHAR(190) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX user_requests (user_id, status),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(32) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  detail VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE rate_limits (
  bucket CHAR(64) PRIMARY KEY,
  attempts INT UNSIGNED NOT NULL DEFAULT 1,
  expires_at DATETIME NOT NULL,
  INDEX expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- No default admin/password or sale price is shipped. Create your own account,
-- promote it via phpMyAdmin, then create real plans in the admin panel.
