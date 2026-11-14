-- PowerShare local/demo seed data
-- NEVER run this file against a production database.
-- Demo password for all seeded users: Admin@123456

SET NAMES utf8mb4;

INSERT IGNORE INTO users (full_name, username, email, phone, password_hash, role, is_active) VALUES
  ('PowerShare Administrator','admin','admin@powershare.local','+96100000000','$2a$12$H.61L2j2v2h8F8srZz2QNeswQqSlupJpft15l9m71E3v.F1XUb0UK','admin',1),
  ('Demo Generator Owner','owner','owner@powershare.local','+96171000001','$2a$12$H.61L2j2v2h8F8srZz2QNeswQqSlupJpft15l9m71E3v.F1XUb0UK','owner',1),
  ('Demo Collector','collector','collector@powershare.local','+96171000002','$2a$12$H.61L2j2v2h8F8srZz2QNeswQqSlupJpft15l9m71E3v.F1XUb0UK','collector',1),
  ('Demo Subscriber','subscriber','subscriber@powershare.local','+96171000003','$2a$12$H.61L2j2v2h8F8srZz2QNeswQqSlupJpft15l9m71E3v.F1XUb0UK','subscriber',1);

SET @owner_user_id := (SELECT id FROM users WHERE username='owner' AND role='owner' LIMIT 1);
SET @collector_user_id := (SELECT id FROM users WHERE username='collector' AND role='collector' LIMIT 1);
SET @subscriber_user_id := (SELECT id FROM users WHERE username='subscriber' AND role='subscriber' LIMIT 1);

INSERT INTO generator_owners (user_id,business_name,company_address)
SELECT @owner_user_id,'Demo Power Services','Lebanon'
WHERE @owner_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM generator_owners WHERE user_id=@owner_user_id);
SET @owner_id := (SELECT id FROM generator_owners WHERE user_id=@owner_user_id LIMIT 1);

INSERT INTO bill_collectors (owner_id,user_id)
SELECT @owner_id,@collector_user_id
WHERE @owner_id IS NOT NULL AND @collector_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bill_collectors WHERE user_id=@collector_user_id);
SET @collector_id := (SELECT id FROM bill_collectors WHERE user_id=@collector_user_id LIMIT 1);

INSERT INTO owner_main_meters (owner_id,meter_number,initial_kwh)
SELECT @owner_id,'MAIN-001',10000
WHERE @owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM owner_main_meters WHERE owner_id=@owner_id AND meter_number='MAIN-001');
SET @main_meter_id := (SELECT id FROM owner_main_meters WHERE owner_id=@owner_id AND meter_number='MAIN-001' LIMIT 1);

INSERT INTO generators (owner_id,name,location_name,total_kw,max_amperage,status)
SELECT @owner_id,'Demo Generator','Rmeich, Lebanon',250,500,'active'
WHERE @owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM generators WHERE owner_id=@owner_id AND name='Demo Generator');
SET @generator_id := (SELECT id FROM generators WHERE owner_id=@owner_id AND name='Demo Generator' LIMIT 1);

INSERT INTO plans (generator_id,name,ampere,monthly_cost_lbp,maintenance_lbp)
SELECT @generator_id,'10 Amp',10,0,500000
WHERE @generator_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM plans WHERE generator_id=@generator_id AND name='10 Amp');
SET @plan_id := (SELECT id FROM plans WHERE generator_id=@generator_id AND name='10 Amp' LIMIT 1);

INSERT INTO subscriber_profiles (user_id,full_name,phone,location_address,meter_number,main_meter_id,created_by_owner)
SELECT @subscriber_user_id,'Demo Subscriber','+96171000003','Rmeich, Lebanon','MTR-1001',@main_meter_id,@owner_id
WHERE @subscriber_user_id IS NOT NULL AND @owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM subscriber_profiles WHERE user_id=@subscriber_user_id);
SET @subscriber_id := (SELECT id FROM subscriber_profiles WHERE user_id=@subscriber_user_id LIMIT 1);

INSERT INTO subscriptions (subscriber_id,plan_id,owner_id,initial_kwh_consumed,start_date,is_active)
SELECT @subscriber_id,@plan_id,@owner_id,1500,CURDATE(),1
WHERE @subscriber_id IS NOT NULL AND @plan_id IS NOT NULL AND @owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE subscriber_id=@subscriber_id AND is_active=1);

INSERT IGNORE INTO collector_generator_assignments (collector_id,generator_id)
SELECT @collector_id,@generator_id
WHERE @collector_id IS NOT NULL AND @generator_id IS NOT NULL;
