
-- Fix 1: Change default status to awaiting_payment
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'awaiting_payment';

-- Update any pending orders to awaiting_payment before adding constraint
UPDATE orders SET status = 'awaiting_payment' WHERE status = 'pending';

-- Fix 2: Drop old constraint if exists, then add correct one
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
CHECK (status IN (
  'awaiting_payment',
  'production',
  'exchange_requested',
  'ready',
  'delivered',
  'paid',
  'cancelled'
));
