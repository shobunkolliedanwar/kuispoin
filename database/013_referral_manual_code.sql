-- KuisPoin v0.14.2 - manual referral code + configurable attribution window.
-- Safe to run once after 012_referral_system.sql.

UPDATE app_settings
SET value = value || '{"attribution_window_days":7}'::jsonb
WHERE key='referral_config' AND NOT (value ? 'attribution_window_days');

CREATE OR REPLACE FUNCTION attribute_referral_atomic(p_referred UUID,p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_referrer UUID; v_created TIMESTAMPTZ; v_enabled BOOLEAN; v_id UUID; v_window INT;
BEGIN
  SELECT COALESCE((value->>'enabled')::boolean,true), COALESCE((value->>'attribution_window_days')::int,7)
  INTO v_enabled,v_window FROM app_settings WHERE key='referral_config';
  IF NOT COALESCE(v_enabled,true) THEN RAISE EXCEPTION 'REFERRAL_DISABLED'; END IF;
  v_window := LEAST(GREATEST(COALESCE(v_window,7),1),30);
  SELECT user_id INTO v_referrer FROM referral_codes WHERE code=upper(trim(p_code));
  IF v_referrer IS NULL THEN RAISE EXCEPTION 'INVALID_REFERRAL_CODE'; END IF;
  IF v_referrer=p_referred THEN RAISE EXCEPTION 'SELF_REFERRAL'; END IF;
  SELECT created_at INTO v_created FROM users WHERE id=p_referred AND status='ACTIVE';
  IF v_created IS NULL THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF v_created < NOW()-make_interval(days => v_window) THEN RAISE EXCEPTION 'ATTRIBUTION_WINDOW_CLOSED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=v_referrer AND status='ACTIVE') THEN RAISE EXCEPTION 'REFERRER_NOT_ACTIVE'; END IF;
  INSERT INTO referrals(referrer_user_id,referred_user_id,code)
  VALUES(v_referrer,p_referred,upper(trim(p_code)))
  ON CONFLICT(referred_user_id) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM referrals WHERE referred_user_id=p_referred;
    RETURN jsonb_build_object('status','ALREADY_ATTRIBUTED','referral_id',v_id);
  END IF;
  RETURN jsonb_build_object('status','ATTRIBUTED','referral_id',v_id);
END $$;

REVOKE ALL ON FUNCTION attribute_referral_atomic(UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION attribute_referral_atomic(UUID,TEXT) TO service_role;
