-- KuisPoin v0.9 money-safety invariants. Safe to run after 006.
-- Enforce one refund for one withdrawal even if future admin code changes.
CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_withdraw_refund_once
ON point_transactions(user_id, reference_id)
WHERE type='ADJUSTMENT' AND reference_id IS NOT NULL AND description='Refund withdrawal ditolak';

-- Defensive indexes for state transitions and payout correlation.
CREATE INDEX IF NOT EXISTS withdrawals_user_status_created_idx ON withdrawals(user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_payout_lookup_idx ON withdrawals(method,account_number,user_id);

-- A withdrawal itself must always represent a positive hold.
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_points_positive;
ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_points_positive CHECK(points > 0);
