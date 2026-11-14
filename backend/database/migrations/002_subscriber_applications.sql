-- Subscribers can log in before the responsible generator owner or an administrator assigns their meter.
CREATE TABLE IF NOT EXISTS registration_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  generator_id INT NOT NULL,
  location_address VARCHAR(400) NOT NULL,
  status ENUM('pending','assigned') NOT NULL DEFAULT 'pending',
  subscriber_id INT NULL UNIQUE,
  assigned_by INT NULL,
  assigned_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (generator_id) REFERENCES generators(id) ON DELETE RESTRICT,
  FOREIGN KEY (subscriber_id) REFERENCES subscriber_profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_registration_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
