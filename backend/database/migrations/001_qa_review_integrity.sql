-- PowerShare migration 001 (QA review, October 2026)
-- Applies DEF-053 / DEF-056 integrity constraints to databases created from an
-- earlier schema.sql. `npm run db:init` uses CREATE TABLE IF NOT EXISTS and does
-- NOT alter existing tables. Run once: `npm run db:migrate`.
-- Before adding constraints, the migration REPAIRS rows that would violate them.

-- 1. Restore debt orphaned by deleting an invoice that carried it (DEF-053).
UPDATE bills src LEFT JOIN bills tgt ON tgt.id = src.carried_forward_to_bill_id
   SET src.status = IF(src.amount_received_lbp > 0.01, 'partially_paid', 'unpaid'),
       src.carried_forward_to_bill_id = NULL
 WHERE src.carried_forward_to_bill_id IS NOT NULL AND tgt.id IS NULL AND src.status = 'carried_forward';

-- 2. Self-referencing foreign keys for invoice lineage.
SET @fk1 := (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND CONSTRAINT_NAME = 'fk_bills_combined_parent');
SET @sql := IF(@fk1 = 0, 'ALTER TABLE bills ADD CONSTRAINT fk_bills_combined_parent FOREIGN KEY (combined_parent_bill_id) REFERENCES bills(id) ON DELETE RESTRICT', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @fk2 := (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND CONSTRAINT_NAME = 'fk_bills_carried_forward');
SET @sql := IF(@fk2 = 0, 'ALTER TABLE bills ADD CONSTRAINT fk_bills_carried_forward FOREIGN KEY (carried_forward_to_bill_id) REFERENCES bills(id) ON DELETE RESTRICT', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3. One meter reading per invoice (DEF-056). Fails loudly if historical data already
--    double-billed a reading; such rows need manual financial review, not silent repair.
SET @uq := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND INDEX_NAME = 'uq_bill_meter_reading');
SET @sql := IF(@uq = 0, 'ALTER TABLE bills ADD UNIQUE KEY uq_bill_meter_reading (meter_reading_id)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
