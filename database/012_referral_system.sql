-- KuisPoin v0.14 Referral System
-- Safe referral attribution + qualification + idempotent two-sided rewards.

ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_type_check;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_type_check
  CHECK (type IN ('QUIZ_REWARD','MISSION_REWARD','ACHIEVEMENT_REWARD','REFERRAL_REWARD','WITHDRAWAL','ADJUSTMENT'));

CREATE TABLE IF NOT EXISTS referral_codes (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8,16}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','QUALIFIED','REJECTED')),
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  CONSTRAINT referral_not_self CHECK (referrer_user_id <> referred_user_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_user_id, attributed_at DESC);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON referrals(status, attributed_at DESC);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

INSERT INTO app_settings(key,value) VALUES (
  'referral_config',
  '{"enabled":true,"referrer_reward_points":100,"referred_reward_points":50,"min_account_age_hours":24,"min_completed_quizzes":3,"max_qualified_per_referrer_30d":20}'::jsonb
) ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION ensure_referral_code(p_user UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_code TEXT; v_try INT := 0;
BEGIN
  SELECT code INTO v_code FROM referral_codes WHERE user_id=p_user;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  LOOP
    v_try := v_try + 1;
    v_code := 'KP' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10));
    BEGIN
      INSERT INTO referral_codes(user_id,code) VALUES(p_user,v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 5 THEN RAISE EXCEPTION 'REFERRAL_CODE_GENERATION_FAILED'; END IF;
    END;
  END LOOP;
END $$;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM users LOOP PERFORM ensure_referral_code(r.id); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION create_referral_code_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM ensure_referral_code(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS users_create_referral_code ON users;
CREATE TRIGGER users_create_referral_code AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_referral_code_for_new_user();

CREATE OR REPLACE FUNCTION attribute_referral_atomic(p_referred UUID,p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_referrer UUID; v_created TIMESTAMPTZ; v_enabled BOOLEAN; v_id UUID;
BEGIN
  SELECT COALESCE((value->>'enabled')::boolean,true) INTO v_enabled FROM app_settings WHERE key='referral_config';
  IF NOT COALESCE(v_enabled,true) THEN RAISE EXCEPTION 'REFERRAL_DISABLED'; END IF;
  SELECT user_id INTO v_referrer FROM referral_codes WHERE code=upper(trim(p_code));
  IF v_referrer IS NULL THEN RAISE EXCEPTION 'INVALID_REFERRAL_CODE'; END IF;
  IF v_referrer=p_referred THEN RAISE EXCEPTION 'SELF_REFERRAL'; END IF;
  SELECT created_at INTO v_created FROM users WHERE id=p_referred AND status='ACTIVE';
  IF v_created IS NULL THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF v_created < NOW()-INTERVAL '7 days' THEN RAISE EXCEPTION 'ATTRIBUTION_WINDOW_CLOSED'; END IF;
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

CREATE OR REPLACE FUNCTION qualify_referral_atomic(p_referred UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r referrals%ROWTYPE; cfg JSONB; min_age INT; min_quiz INT; max_30d INT; inviter_reward INT; invitee_reward INT; completed INT; recent_qualified INT;
BEGIN
  SELECT * INTO r FROM referrals WHERE referred_user_id=p_referred FOR UPDATE;
  IF r.id IS NULL THEN RETURN jsonb_build_object('status','NO_REFERRAL'); END IF;
  IF r.status='QUALIFIED' THEN RETURN jsonb_build_object('status','ALREADY_QUALIFIED'); END IF;
  IF r.status='REJECTED' THEN RETURN jsonb_build_object('status','REJECTED'); END IF;
  SELECT value INTO cfg FROM app_settings WHERE key='referral_config';
  IF NOT COALESCE((cfg->>'enabled')::boolean,true) THEN RETURN jsonb_build_object('status','DISABLED'); END IF;
  min_age:=COALESCE((cfg->>'min_account_age_hours')::int,24); min_quiz:=COALESCE((cfg->>'min_completed_quizzes')::int,3);
  max_30d:=COALESCE((cfg->>'max_qualified_per_referrer_30d')::int,20); inviter_reward:=COALESCE((cfg->>'referrer_reward_points')::int,100); invitee_reward:=COALESCE((cfg->>'referred_reward_points')::int,50);
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_referred AND status='ACTIVE' AND created_at <= NOW()-(min_age||' hours')::interval) THEN RETURN jsonb_build_object('status','PENDING','reason','ACCOUNT_AGE'); END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=r.referrer_user_id AND status='ACTIVE') THEN RETURN jsonb_build_object('status','PENDING','reason','REFERRER_INACTIVE'); END IF;
  SELECT count(*) INTO completed FROM quiz_attempts WHERE user_id=p_referred AND status='COMPLETED';
  IF completed < min_quiz THEN RETURN jsonb_build_object('status','PENDING','reason','QUIZ_REQUIREMENT','completed',completed,'required',min_quiz); END IF;
  SELECT count(*) INTO recent_qualified FROM referrals WHERE referrer_user_id=r.referrer_user_id AND status='QUALIFIED' AND qualified_at >= NOW()-INTERVAL '30 days';
  IF recent_qualified >= max_30d THEN RETURN jsonb_build_object('status','PENDING','reason','REFERRER_30D_CAP'); END IF;
  UPDATE referrals SET status='QUALIFIED',qualified_at=NOW() WHERE id=r.id;
  IF inviter_reward>0 THEN INSERT INTO point_transactions(user_id,amount,type,reference_id,description) VALUES(r.referrer_user_id,inviter_reward,'REFERRAL_REWARD',r.id,'Reward referral teman') ON CONFLICT DO NOTHING; END IF;
  IF invitee_reward>0 THEN INSERT INTO point_transactions(user_id,amount,type,reference_id,description) VALUES(p_referred,invitee_reward,'REFERRAL_REWARD',r.id,'Bonus bergabung via referral') ON CONFLICT DO NOTHING; END IF;
  RETURN jsonb_build_object('status','QUALIFIED','referrer_reward',inviter_reward,'referred_reward',invitee_reward);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS referral_reward_once_per_user
  ON point_transactions(user_id,type,reference_id)
  WHERE type='REFERRAL_REWARD' AND reference_id IS NOT NULL;

-- RPC referral hanya boleh dipanggil backend service-role. Jangan percaya user_id dari browser.
REVOKE ALL ON FUNCTION ensure_referral_code(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION attribute_referral_atomic(UUID,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION qualify_referral_atomic(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ensure_referral_code(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION attribute_referral_atomic(UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION qualify_referral_atomic(UUID) TO service_role;
