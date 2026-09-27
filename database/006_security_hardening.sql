-- KuisPoin v0.8 - production security hardening.
-- Safe to run after 005_question_bank.sql.

CREATE INDEX IF NOT EXISTS point_transactions_user_created_idx ON point_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_user_created_idx ON quiz_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_created_idx ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_flags_user_status_idx ON fraud_flags(user_id, status);

-- Keep rate-limit storage bounded. Can be called periodically by an external cron later.
CREATE OR REPLACE FUNCTION cleanup_rate_limit_buckets(p_older_than_hours INT DEFAULT 24)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE affected BIGINT;
BEGIN
  DELETE FROM rate_limit_buckets WHERE window_start < NOW() - make_interval(hours => GREATEST(p_older_than_hours,1));
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;
REVOKE ALL ON FUNCTION cleanup_rate_limit_buckets(INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_buckets(INT) TO service_role;

-- Extra DB-level protection against impossible withdrawal values.
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_points_positive;
ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_points_positive CHECK(points > 0);
