-- KuisPoin v0.15 - aggregate economy snapshot for admin analytics.
-- Keeps all-time ledger aggregation inside PostgreSQL instead of transferring the full ledger.

CREATE OR REPLACE FUNCTION economy_snapshot()
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'issued_points', COALESCE((SELECT SUM(amount) FROM point_transactions WHERE amount > 0),0),
    'spent_points', ABS(COALESCE((SELECT SUM(amount) FROM point_transactions WHERE amount < 0),0)),
    'outstanding_points', COALESCE((SELECT SUM(amount) FROM point_transactions),0),
    'paid_withdrawal_points', COALESCE((SELECT SUM(points) FROM withdrawals WHERE status='PAID'),0)
  );
$$;
REVOKE ALL ON FUNCTION economy_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION economy_snapshot() TO service_role;
