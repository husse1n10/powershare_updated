-- PowerShare Generator Management System
-- Unified schema for Lebanon / PL-BLL-DAL architecture
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(150) NULL UNIQUE,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','owner','collector','subscriber') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  preferred_language ENUM('en','ar') NOT NULL DEFAULT 'en',
  auth_version INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_phone (phone),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS generator_owners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  business_name VARCHAR(200) NULL,
  company_name VARCHAR(200) NULL,
  company_address VARCHAR(400) NULL,
  company_street VARCHAR(300) NULL,
  company_city VARCHAR(150) NULL,
  capital_lbp BIGINT NULL,
  fiscal_number VARCHAR(100) NULL,
  registry_number VARCHAR(100) NULL,
  phone2 VARCHAR(30) NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 11.00,
  vat_enabled TINYINT(1) NOT NULL DEFAULT 1,
  usd_lbp_rate DECIMAL(12,2) NOT NULL DEFAULT 89700.00,
  invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'PS',
  invoice_title VARCHAR(100) NOT NULL DEFAULT 'فاتورة',
  invoice_recipient_prefix VARCHAR(150) NOT NULL DEFAULT 'المطلوب من',
  invoice_item_label VARCHAR(100) NOT NULL DEFAULT 'الصنف',
  invoice_old_label VARCHAR(100) NOT NULL DEFAULT 'قديم',
  invoice_new_label VARCHAR(100) NOT NULL DEFAULT 'جديد',
  invoice_usage_label VARCHAR(100) NOT NULL DEFAULT 'استهلاك',
  invoice_price_label VARCHAR(100) NOT NULL DEFAULT 'السعر',
  invoice_total_label VARCHAR(100) NOT NULL DEFAULT 'المجموع العام',
  invoice_issue_date_label VARCHAR(120) NOT NULL DEFAULT 'تاريخ الإصدار',
  invoice_period_label VARCHAR(120) NOT NULL DEFAULT 'وذلك عن شهر',
  invoice_area_label VARCHAR(120) NOT NULL DEFAULT 'المنطقة',
  invoice_address_label VARCHAR(120) NOT NULL DEFAULT 'العنوان',
  invoice_phone_label VARCHAR(120) NOT NULL DEFAULT 'هاتف',
  invoice_meter_label VARCHAR(120) NOT NULL DEFAULT 'رقم العداد',
  logo_path VARCHAR(500) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bill_collectors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  user_id INT NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_collector_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS owner_main_meters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  meter_number VARCHAR(120) NOT NULL,
  initial_kwh DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes VARCHAR(300) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE CASCADE,
  UNIQUE KEY uq_owner_main_meter (owner_id, meter_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS generators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  location_name VARCHAR(300) NOT NULL,
  total_kw DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_amperage DECIMAL(10,2) NULL,
  status ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE CASCADE,
  INDEX idx_generators_owner (owner_id),
  INDEX idx_generators_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  generator_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  ampere DECIMAL(6,2) NOT NULL,
  monthly_cost_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  maintenance_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (generator_id) REFERENCES generators(id) ON DELETE CASCADE,
  INDEX idx_plans_generator (generator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plan_monthly_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  plan_id INT NOT NULL,
  month TINYINT NOT NULL,
  year SMALLINT NOT NULL,
  threshold_kwh DECIMAL(12,2) NOT NULL DEFAULT 100.00,
  base_cost_below_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  base_cost_above_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  maintenance_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  usd_lbp_rate DECIMAL(12,2) NOT NULL DEFAULT 89700.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  UNIQUE KEY uq_plan_period (plan_id, month, year),
  INDEX idx_pricing_period (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriber_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  location_address VARCHAR(400) NOT NULL,
  meter_number VARCHAR(100) NULL,
  main_meter_id INT NULL,
  created_by_owner INT NOT NULL,
  account_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (main_meter_id) REFERENCES owner_main_meters(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_owner) REFERENCES generator_owners(id) ON DELETE CASCADE,
  UNIQUE KEY uq_owner_meter (created_by_owner, meter_number),
  INDEX idx_subscriber_owner (created_by_owner),
  INDEX idx_subscriber_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscriber_id INT NOT NULL,
  plan_id INT NOT NULL,
  owner_id INT NOT NULL,
  initial_kwh_consumed DECIMAL(12,2) NOT NULL DEFAULT 0,
  fixed_amount_enabled TINYINT(1) NOT NULL DEFAULT 0,
  fixed_amount_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subscriber_id) REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE RESTRICT,
  INDEX idx_subscriptions_owner (owner_id),
  INDEX idx_subscriptions_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- New subscribers can log in before an administrator assigns their meter.
CREATE TABLE IF NOT EXISTS registration_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  generator_id INT NULL,
  location_address VARCHAR(400) NULL,
  status ENUM('unselected','pending','assigned') NOT NULL DEFAULT 'unselected',
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

CREATE TABLE IF NOT EXISTS collector_generator_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collector_id INT NOT NULL,
  generator_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collector_id) REFERENCES bill_collectors(id) ON DELETE CASCADE,
  FOREIGN KEY (generator_id) REFERENCES generators(id) ON DELETE CASCADE,
  UNIQUE KEY uq_collector_generator (collector_id, generator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS collector_subscriber_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collector_id INT NOT NULL,
  subscriber_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collector_id) REFERENCES bill_collectors(id) ON DELETE CASCADE,
  FOREIGN KEY (subscriber_id) REFERENCES subscriber_profiles(id) ON DELETE CASCADE,
  UNIQUE KEY uq_collector_subscriber (collector_id, subscriber_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meter_readings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  reading_value DECIMAL(12,2) NOT NULL,
  previous_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  kwh_diff DECIMAL(12,2) GENERATED ALWAYS AS (GREATEST(reading_value - previous_value, 0)) STORED,
  reading_date DATE NOT NULL,
  photo_path VARCHAR(500) NULL,
  ocr_meter_number VARCHAR(100) NULL,
  ocr_reading_value DECIMAL(12,2) NULL,
  ocr_confidence DECIMAL(5,2) NULL,
  ocr_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_readings_subscription_date (subscription_id, reading_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  invoice_number VARCHAR(60) NOT NULL UNIQUE,
  month TINYINT NOT NULL,
  year SMALLINT NOT NULL,
  meter_reading_id INT NULL,
  combined_parent_bill_id INT NULL,
  carried_forward_to_bill_id INT NULL,
  combined_meta_json LONGTEXT NULL,
  kwh_used DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_fixed_amount TINYINT(1) NOT NULL DEFAULT 0,
  fixed_amount_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  base_amount_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  maintenance_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_ht_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  vat_amount_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_ttc_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  usd_lbp_rate DECIMAL(12,2) NOT NULL,
  total_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  previous_balance_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  previous_balance_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_due_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_due_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_received_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_received_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  remaining_balance_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  remaining_balance_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('unpaid','partially_paid','paid','waived','carried_forward') NOT NULL DEFAULT 'unpaid',
  notes TEXT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  created_by INT NOT NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (meter_reading_id) REFERENCES meter_readings(id) ON DELETE SET NULL,
  FOREIGN KEY (combined_parent_bill_id) REFERENCES bills(id) ON DELETE RESTRICT,
  FOREIGN KEY (carried_forward_to_bill_id) REFERENCES bills(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_bill_meter_reading (meter_reading_id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_bill_period (subscription_id, month, year),
  INDEX idx_bills_status (status),
  INDEX idx_bills_combined_parent (combined_parent_bill_id),
  INDEX idx_bills_carried_forward (carried_forward_to_bill_id),
  INDEX idx_bills_period (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  subscriber_id INT NOT NULL,
  owner_id INT NOT NULL,
  collector_id INT NULL,
  amount_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_lbp DECIMAL(15,2) NOT NULL DEFAULT 0,
  usd_lbp_rate DECIMAL(12,2) NOT NULL,
  payment_method ENUM('cash','simulated_online','bank','other') NOT NULL DEFAULT 'cash',
  transaction_reference VARCHAR(120) NULL,
  status ENUM('completed','reversed') NOT NULL DEFAULT 'completed',
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by INT NOT NULL,
  notes VARCHAR(500) NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE RESTRICT,
  FOREIGN KEY (subscriber_id) REFERENCES subscriber_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE RESTRICT,
  FOREIGN KEY (collector_id) REFERENCES bill_collectors(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_payments_bill (bill_id),
  INDEX idx_payments_owner_date (owner_id, paid_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS collector_settlements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collector_id INT NOT NULL,
  owner_id INT NOT NULL,
  amount_lbp DECIMAL(15,2) NOT NULL,
  status ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
  requested_notes VARCHAR(500) NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME NULL,
  confirmed_by INT NULL,
  confirmation_notes VARCHAR(500) NULL,
  FOREIGN KEY (collector_id) REFERENCES bill_collectors(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_settlements_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS collector_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collector_id INT NOT NULL,
  owner_id INT NOT NULL,
  tx_type ENUM('bill_collection','owner_settlement','adjustment') NOT NULL,
  amount_lbp DECIMAL(15,2) NOT NULL,
  bill_id INT NULL,
  payment_id INT NULL,
  settlement_id INT NULL,
  created_by INT NOT NULL,
  note VARCHAR(300) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collector_id) REFERENCES bill_collectors(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  FOREIGN KEY (settlement_id) REFERENCES collector_settlements(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_collector_ledger (collector_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS outage_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  generator_id INT NOT NULL,
  schedule_type ENUM('recurring','one_time') NOT NULL DEFAULT 'one_time',
  day_of_week TINYINT NULL,
  outage_date DATE NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes VARCHAR(300) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (generator_id) REFERENCES generators(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_outages_generator (generator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('bill','payment','outage','support','system','balance','settlement') NOT NULL DEFAULT 'system',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_by INT NOT NULL,
  owner_id INT NULL,
  subject VARCHAR(200) NOT NULL,
  category ENUM('billing','meter','payment','outage','account','technical','other') NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE SET NULL,
  INDEX idx_support_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS support_ticket_responses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  responder_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (responder_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description VARCHAR(300) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_fee_collections (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  month TINYINT NOT NULL,
  year SMALLINT NOT NULL,
  fee_per_subscriber_usd DECIMAL(10,4) NOT NULL DEFAULT 0.10,
  subscriber_count INT NOT NULL DEFAULT 0,
  expected_amount_usd DECIMAL(12,4) NOT NULL DEFAULT 0,
  status ENUM('pending','received') NOT NULL DEFAULT 'pending',
  received_at DATETIME NULL,
  confirmed_by INT NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES generator_owners(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_platform_fee_owner_period (owner_id, month, year),
  INDEX idx_platform_fee_period (year, month),
  INDEX idx_platform_fee_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id VARCHAR(100) NULL,
  method VARCHAR(10) NULL,
  route VARCHAR(300) NULL,
  ip_address VARCHAR(64) NULL,
  details_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_user_date (user_id, created_at),
  INDEX idx_audit_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO platform_settings (setting_key, setting_value, description) VALUES
  ('platform_name', 'PowerShare', 'Display name'),
  ('platform_fee_per_subscriber', '0.10', 'USD fee per active subscriber per month'),
  ('default_usd_lbp_rate', '89700', 'Default USD/LBP rate'),
  ('simulated_online_payment_enabled', '1', 'Enable QA/demo payment flow'),
  ('support_email', 'support@powershare.local', 'Support contact');

SET FOREIGN_KEY_CHECKS = 1;
