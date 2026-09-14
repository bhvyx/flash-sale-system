ALTER TABLE payments
ADD COLUMN idempotency_key VARCHAR(100);

UPDATE payments
SET idempotency_key = 'legacy-' || id::text
WHERE idempotency_key IS NULL;

ALTER TABLE payments
ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE payments
ADD CONSTRAINT payments_idempotency_key_key UNIQUE (idempotency_key);