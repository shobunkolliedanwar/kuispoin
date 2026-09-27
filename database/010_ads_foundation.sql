-- KuisPoin v0.13 - rewarded ads foundation.
-- Rewarded ads credit NON-CASH rewards only. They must never write to point_transactions.

ALTER TABLE ad_reward_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS ad_reward_sessions_status_idx
  ON ad_reward_sessions(user_id, status, created_at DESC);

INSERT INTO app_settings(key,value) VALUES
('ads_config','{"rewarded_enabled":true,"reward_kind":"TICKET","reward_amount":1,"daily_rewarded_cap":5}'::jsonb)
ON CONFLICT(key) DO NOTHING;

-- Create a session under a per-user daily cap. This does NOT grant anything.
CREATE OR REPLACE FUNCTION create_ad_reward_session(
  p_user UUID,
  p_provider TEXT,
  p_reward_kind TEXT,
  p_reward_amount INT,
  p_daily_cap INT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE sid UUID; used INT;
BEGIN
  IF p_provider IS NULL OR length(trim(p_provider)) < 2 THEN RAISE EXCEPTION 'INVALID_PROVIDER'; END IF;
  IF p_reward_kind NOT IN ('HINT','TICKET','XP') OR p_reward_amount < 1 THEN RAISE EXCEPTION 'INVALID_REWARD'; END IF;
  IF p_daily_cap < 1 THEN RAISE EXCEPTION 'INVALID_CAP'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND status='ACTIVE') THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ad:' || p_user::text));
  SELECT COUNT(*) INTO used FROM ad_reward_sessions
    WHERE user_id=p_user
      AND status IN ('CREATED','VERIFIED')
      AND created_at >= date_trunc('day',NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
  IF used >= p_daily_cap THEN RAISE EXCEPTION 'DAILY_AD_CAP'; END IF;

  INSERT INTO ad_reward_sessions(user_id,provider,reward_kind,reward_amount,expires_at)
  VALUES(p_user,upper(trim(p_provider)),p_reward_kind,p_reward_amount,NOW()+INTERVAL '15 minutes')
  RETURNING id INTO sid;
  RETURN sid;
END $$;
REVOKE ALL ON FUNCTION create_ad_reward_session(UUID,TEXT,TEXT,INT,INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION create_ad_reward_session(UUID,TEXT,TEXT,INT,INT) TO service_role;

-- Called only after provider verification. Atomic + idempotent via session lock and provider_event_id uniqueness.
CREATE OR REPLACE FUNCTION verify_ad_reward_atomic(
  p_user UUID,
  p_session UUID,
  p_provider_event_id TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE s ad_reward_sessions%ROWTYPE; new_hints INT; new_tickets INT; new_xp BIGINT;
BEGIN
  IF p_provider_event_id IS NULL OR length(trim(p_provider_event_id)) < 8 THEN RAISE EXCEPTION 'INVALID_PROVIDER_EVENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ad-session:' || p_session::text));
  SELECT * INTO s FROM ad_reward_sessions WHERE id=p_session AND user_id=p_user FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'AD_SESSION_NOT_FOUND'; END IF;
  IF s.status='VERIFIED' THEN
    SELECT hints,tickets,xp INTO new_hints,new_tickets,new_xp FROM noncash_wallets WHERE user_id=p_user;
    RETURN jsonb_build_object('already_verified',true,'reward_kind',s.reward_kind,'reward_amount',s.reward_amount,'hints',COALESCE(new_hints,0),'tickets',COALESCE(new_tickets,0),'xp',COALESCE(new_xp,0));
  END IF;
  IF s.status<>'CREATED' THEN RAISE EXCEPTION 'AD_SESSION_INVALID'; END IF;
  IF s.expires_at < NOW() THEN
    UPDATE ad_reward_sessions SET status='EXPIRED' WHERE id=s.id;
    RAISE EXCEPTION 'AD_SESSION_EXPIRED';
  END IF;
  IF EXISTS(SELECT 1 FROM ad_reward_sessions WHERE provider_event_id=trim(p_provider_event_id) AND id<>s.id) THEN RAISE EXCEPTION 'DUPLICATE_PROVIDER_EVENT'; END IF;

  INSERT INTO noncash_wallets(user_id,hints,tickets,xp)
  VALUES(p_user,
    CASE WHEN s.reward_kind='HINT' THEN s.reward_amount ELSE 0 END,
    CASE WHEN s.reward_kind='TICKET' THEN s.reward_amount ELSE 0 END,
    CASE WHEN s.reward_kind='XP' THEN s.reward_amount ELSE 0 END)
  ON CONFLICT(user_id) DO UPDATE SET
    hints=noncash_wallets.hints + CASE WHEN s.reward_kind='HINT' THEN s.reward_amount ELSE 0 END,
    tickets=noncash_wallets.tickets + CASE WHEN s.reward_kind='TICKET' THEN s.reward_amount ELSE 0 END,
    xp=noncash_wallets.xp + CASE WHEN s.reward_kind='XP' THEN s.reward_amount ELSE 0 END,
    updated_at=NOW()
  RETURNING hints,tickets,xp INTO new_hints,new_tickets,new_xp;

  UPDATE ad_reward_sessions SET status='VERIFIED',provider_event_id=trim(p_provider_event_id),verified_at=NOW() WHERE id=s.id;
  INSERT INTO notifications(user_id,type,title,message)
  VALUES(p_user,'AD_REWARD','Reward iklan diterima','+'||s.reward_amount||' '||lower(s.reward_kind)||' masuk ke reward non-tunai.');

  RETURN jsonb_build_object('already_verified',false,'reward_kind',s.reward_kind,'reward_amount',s.reward_amount,'hints',new_hints,'tickets',new_tickets,'xp',new_xp);
END $$;
REVOKE ALL ON FUNCTION verify_ad_reward_atomic(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION verify_ad_reward_atomic(UUID,UUID,TEXT) TO service_role;
