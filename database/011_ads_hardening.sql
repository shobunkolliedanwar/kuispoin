-- KuisPoin v0.13.1 - rewarded ads hardening before a real provider is connected.
-- Redeemable points remain completely isolated from rewarded-ad rewards.

-- Expire stale CREATED sessions and report only reward consumption + a live pending session.
CREATE OR REPLACE FUNCTION get_ad_reward_usage(
  p_user UUID,
  p_daily_cap INT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE verified_count INT:=0; active_count INT:=0; remaining INT:=0;
BEGIN
  IF p_daily_cap < 1 THEN RAISE EXCEPTION 'INVALID_CAP'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND status='ACTIVE') THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE'; END IF;

  UPDATE ad_reward_sessions
     SET status='EXPIRED'
   WHERE user_id=p_user AND status='CREATED' AND expires_at <= NOW();

  SELECT COUNT(*) INTO verified_count
    FROM ad_reward_sessions
   WHERE user_id=p_user
     AND status='VERIFIED'
     AND verified_at >= date_trunc('day',NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';

  SELECT COUNT(*) INTO active_count
    FROM ad_reward_sessions
   WHERE user_id=p_user AND status='CREATED' AND expires_at > NOW();

  remaining := GREATEST(0,p_daily_cap-verified_count);
  RETURN jsonb_build_object(
    'used',verified_count,
    'remaining',remaining,
    'daily_cap',p_daily_cap,
    'active_sessions',active_count
  );
END $$;
REVOKE ALL ON FUNCTION get_ad_reward_usage(UUID,INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION get_ad_reward_usage(UUID,INT) TO service_role;

-- Starting/retrying an ad no longer burns the daily reward quota.
-- One still-live CREATED session is reused instead of creating session spam.
CREATE OR REPLACE FUNCTION create_ad_reward_session(
  p_user UUID,
  p_provider TEXT,
  p_reward_kind TEXT,
  p_reward_amount INT,
  p_daily_cap INT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE sid UUID; used INT:=0;
BEGIN
  IF p_provider IS NULL OR length(trim(p_provider)) < 2 THEN RAISE EXCEPTION 'INVALID_PROVIDER'; END IF;
  IF p_reward_kind NOT IN ('HINT','TICKET','XP') OR p_reward_amount < 1 THEN RAISE EXCEPTION 'INVALID_REWARD'; END IF;
  IF p_daily_cap < 1 THEN RAISE EXCEPTION 'INVALID_CAP'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND status='ACTIVE') THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ad:' || p_user::text));

  UPDATE ad_reward_sessions
     SET status='EXPIRED'
   WHERE user_id=p_user AND status='CREATED' AND expires_at <= NOW();

  SELECT COUNT(*) INTO used
    FROM ad_reward_sessions
   WHERE user_id=p_user
     AND status='VERIFIED'
     AND verified_at >= date_trunc('day',NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
  IF used >= p_daily_cap THEN RAISE EXCEPTION 'DAILY_AD_CAP'; END IF;

  SELECT id INTO sid
    FROM ad_reward_sessions
   WHERE user_id=p_user
     AND provider=upper(trim(p_provider))
     AND reward_kind=p_reward_kind
     AND reward_amount=p_reward_amount
     AND status='CREATED'
     AND expires_at > NOW()
   ORDER BY created_at DESC
   LIMIT 1;
  IF sid IS NOT NULL THEN RETURN sid; END IF;

  INSERT INTO ad_reward_sessions(user_id,provider,reward_kind,reward_amount,expires_at)
  VALUES(p_user,upper(trim(p_provider)),p_reward_kind,p_reward_amount,NOW()+INTERVAL '15 minutes')
  RETURNING id INTO sid;
  RETURN sid;
END $$;
REVOKE ALL ON FUNCTION create_ad_reward_session(UUID,TEXT,TEXT,INT,INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION create_ad_reward_session(UUID,TEXT,TEXT,INT,INT) TO service_role;

-- Provider is bound into verification so one provider cannot complete another provider's session.
CREATE OR REPLACE FUNCTION verify_ad_reward_atomic_v2(
  p_user UUID,
  p_session UUID,
  p_provider TEXT,
  p_provider_event_id TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE s ad_reward_sessions%ROWTYPE; new_hints INT; new_tickets INT; new_xp BIGINT;
BEGIN
  IF p_provider IS NULL OR length(trim(p_provider)) < 2 THEN RAISE EXCEPTION 'INVALID_PROVIDER'; END IF;
  IF p_provider_event_id IS NULL OR length(trim(p_provider_event_id)) < 8 THEN RAISE EXCEPTION 'INVALID_PROVIDER_EVENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ad-session:' || p_session::text));
  SELECT * INTO s FROM ad_reward_sessions WHERE id=p_session AND user_id=p_user FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'AD_SESSION_NOT_FOUND'; END IF;
  IF s.provider <> upper(trim(p_provider)) THEN RAISE EXCEPTION 'PROVIDER_MISMATCH'; END IF;
  IF s.status='VERIFIED' THEN
    SELECT hints,tickets,xp INTO new_hints,new_tickets,new_xp FROM noncash_wallets WHERE user_id=p_user;
    RETURN jsonb_build_object('already_verified',true,'reward_kind',s.reward_kind,'reward_amount',s.reward_amount,'hints',COALESCE(new_hints,0),'tickets',COALESCE(new_tickets,0),'xp',COALESCE(new_xp,0));
  END IF;
  IF s.status<>'CREATED' THEN RAISE EXCEPTION 'AD_SESSION_INVALID'; END IF;
  IF s.expires_at <= NOW() THEN
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
REVOKE ALL ON FUNCTION verify_ad_reward_atomic_v2(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION verify_ad_reward_atomic_v2(UUID,UUID,TEXT,TEXT) TO service_role;
