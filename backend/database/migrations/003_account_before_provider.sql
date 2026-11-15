-- Keep existing applications and assignments; allow registration before selecting a provider.
-- Re-running this migration preserves all rows and states.
ALTER TABLE registration_applications
  MODIFY generator_id INT NULL,
  MODIFY location_address VARCHAR(400) NULL,
  MODIFY status ENUM('unselected','pending','assigned') NOT NULL DEFAULT 'unselected';
