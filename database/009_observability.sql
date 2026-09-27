-- KuisPoin v0.12 - Observability & Production Monitoring
-- Apply after 008_fraud_engine_v2.sql.

CREATE TABLE IF NOT EXISTS operational_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  level TEXT NOT NULL DEFAULT 'INFO' CHECK (level IN ('INFO','WARN','ERROR')),
  event TEXT NOT NULL,
  route TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id TEXT,
  status_code INT,
  duration_ms INT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS operational_events_created_idx ON operational_events(created_at DESC);
CREATE INDEX IF NOT EXISTS operational_events_level_created_idx ON operational_events(level,created_at DESC);
CREATE INDEX IF NOT EXISTS operational_events_event_created_idx ON operational_events(event,created_at DESC);
CREATE INDEX IF NOT EXISTS operational_events_request_idx ON operational_events(request_id) WHERE request_id IS NOT NULL;

ALTER TABLE operational_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON operational_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON operational_events TO service_role;

-- Retain detailed operational telemetry for 30 days. Call from a scheduler later.
CREATE OR REPLACE FUNCTION cleanup_operational_events(p_days INT DEFAULT 30)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count BIGINT;
BEGIN
  IF p_days < 7 OR p_days > 365 THEN RAISE EXCEPTION 'INVALID_RETENTION'; END IF;
  DELETE FROM operational_events WHERE created_at < NOW() - make_interval(days => p_days);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;
REVOKE ALL ON FUNCTION cleanup_operational_events(INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION cleanup_operational_events(INT) TO service_role;
