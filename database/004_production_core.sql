-- KuisPoin v0.5 - production core hardening, notifications, non-cash ad wallet, analytics helpers.
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_status_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_status_check CHECK (status IN ('IN_PROGRESS','PROCESSING','COMPLETED','ABANDONED'));

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(bucket_key, window_start)
);
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Rewarded ads must not credit redeemable point_transactions. This separate wallet is non-cash only.
CREATE TABLE IF NOT EXISTS noncash_wallets (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hints INTEGER NOT NULL DEFAULT 0 CHECK(hints >= 0),
  tickets INTEGER NOT NULL DEFAULT 0 CHECK(tickets >= 0),
  xp BIGINT NOT NULL DEFAULT 0 CHECK(xp >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ad_reward_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_event_id TEXT UNIQUE,
  reward_kind TEXT NOT NULL CHECK(reward_kind IN ('HINT','TICKET','XP')),
  reward_amount INTEGER NOT NULL CHECK(reward_amount > 0),
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK(status IN ('CREATED','VERIFIED','REJECTED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ad_reward_sessions_user_idx ON ad_reward_sessions(user_id, created_at DESC);
ALTER TABLE noncash_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_reward_sessions ENABLE ROW LEVEL SECURITY;

INSERT INTO app_settings(key,value) VALUES
('security_config','{"quiz_start_per_minute":8,"quiz_finish_per_minute":8,"withdraw_per_hour":3,"mission_claim_per_minute":10}'::jsonb)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION consume_rate_limit(p_key TEXT,p_limit INT,p_window_seconds INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ws TIMESTAMPTZ; n INT;
BEGIN
 IF p_limit < 1 OR p_window_seconds < 1 THEN RETURN FALSE; END IF;
 ws := to_timestamp(floor(extract(epoch from NOW()) / p_window_seconds) * p_window_seconds);
 INSERT INTO rate_limit_buckets(bucket_key,window_start,hits) VALUES(p_key,ws,1)
 ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=rate_limit_buckets.hits+1
 RETURNING hits INTO n;
 RETURN n <= p_limit;
END $$;
REVOKE ALL ON FUNCTION consume_rate_limit(TEXT,INT,INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION consume_rate_limit(TEXT,INT,INT) TO service_role;

-- Entire quiz finalization is atomic: ownership, answer validation, scoring, reward cap and fraud flag.
CREATE OR REPLACE FUNCTION finish_quiz_atomic(p_user UUID,p_attempt UUID,p_answers JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
 a quiz_attempts%ROWTYPE; q quizzes%ROWTYPE; item JSONB; qid UUID; oid UUID; ok BOOLEAN;
 scorev INT:=0; answered INT:=0; requested INT:=0; granted INT:=0; capv INT:=500; used INT:=0; elapsed_ms BIGINT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_attempt::text));
 SELECT * INTO a FROM quiz_attempts WHERE id=p_attempt AND user_id=p_user FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'ATTEMPT_NOT_FOUND'; END IF;
 IF a.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'ATTEMPT_ALREADY_FINISHED'; END IF;
 SELECT * INTO q FROM quizzes WHERE id=a.quiz_id;
 IF jsonb_typeof(p_answers) <> 'array' THEN RAISE EXCEPTION 'INVALID_ANSWERS'; END IF;

 FOR item IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
   BEGIN qid := (item->>'questionId')::uuid; oid := (item->>'optionId')::uuid; EXCEPTION WHEN OTHERS THEN CONTINUE; END;
   IF EXISTS(SELECT 1 FROM quiz_answers WHERE attempt_id=a.id AND question_id=qid) THEN CONTINUE; END IF;
   IF NOT EXISTS(SELECT 1 FROM quiz_attempt_questions WHERE attempt_id=a.id AND question_id=qid) THEN CONTINUE; END IF;
   SELECT is_correct INTO ok FROM question_options WHERE id=oid AND question_id=qid;
   IF NOT FOUND THEN CONTINUE; END IF;
   INSERT INTO quiz_answers(attempt_id,question_id,selected_option_id,is_correct) VALUES(a.id,qid,oid,ok) ON CONFLICT DO NOTHING;
   IF FOUND THEN answered:=answered+1; IF ok THEN scorev:=scorev+1; END IF; END IF;
 END LOOP;

 requested := scorev * COALESCE(q.reward_per_correct,0);
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 SELECT COALESCE((value->>'daily_quiz_reward_cap')::int,500) INTO capv FROM app_settings WHERE key='reward_config';
 SELECT COALESCE(SUM(amount),0) INTO used FROM point_transactions
   WHERE user_id=p_user AND type='QUIZ_REWARD' AND created_at >= date_trunc('day',NOW() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
 granted := GREATEST(0,LEAST(requested,capv-used));
 IF granted>0 THEN
   INSERT INTO point_transactions(user_id,amount,type,reference_id,description)
   VALUES(p_user,granted,'QUIZ_REWARD',a.id,format('Reward kuis: %s/%s benar',scorev,a.total_questions));
 END IF;
 UPDATE quiz_attempts SET status='COMPLETED',score=scorev,reward_points=granted,completed_at=NOW() WHERE id=a.id;
 elapsed_ms := (extract(epoch from (NOW()-a.started_at))*1000)::bigint;
 IF a.total_questions>=3 AND elapsed_ms < a.total_questions*1200 THEN
   INSERT INTO fraud_flags(user_id,attempt_id,code,risk_score,detail)
   VALUES(p_user,a.id,'QUIZ_TOO_FAST',2,format('%s soal dalam %sms',a.total_questions,elapsed_ms)) ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('score',scorev,'answered',answered,'total',a.total_questions,'reward',granted,'capped',granted<requested);
END $$;
REVOKE ALL ON FUNCTION finish_quiz_atomic(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION finish_quiz_atomic(UUID,UUID,JSONB) TO service_role;

-- Mission claim + point ledger are one transaction, preventing a claim without its reward.
CREATE OR REPLACE FUNCTION claim_mission_atomic(p_user UUID,p_mission UUID,p_period DATE,p_progress INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE m missions%ROWTYPE; cid UUID;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text || p_mission::text || p_period::text));
 SELECT * INTO m FROM missions WHERE id=p_mission AND is_active=TRUE;
 IF m.id IS NULL OR p_progress < m.target THEN RAISE EXCEPTION 'MISSION_INCOMPLETE'; END IF;
 INSERT INTO mission_claims(user_id,mission_id,period_date,reward_points)
 VALUES(p_user,m.id,p_period,m.reward_points) RETURNING id INTO cid;
 IF m.reward_points>0 THEN
  INSERT INTO point_transactions(user_id,amount,type,reference_id,description)
  VALUES(p_user,m.reward_points,'MISSION_REWARD',cid,'Misi: '||m.title);
 END IF;
 INSERT INTO notifications(user_id,type,title,message) VALUES(p_user,'MISSION','Misi selesai','+'||m.reward_points||' poin dari '||m.title);
 RETURN m.reward_points;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'MISSION_ALREADY_CLAIMED';
END $$;
REVOKE ALL ON FUNCTION claim_mission_atomic(UUID,UUID,DATE,INT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION claim_mission_atomic(UUID,UUID,DATE,INT) TO service_role;

-- Prevent repeated payout accounts from silently scaling across many active users.
CREATE OR REPLACE FUNCTION create_withdrawal_atomic(p_user UUID,p_points INT,p_method TEXT,p_account TEXT,p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE bal BIGINT; wid UUID; minp INT:=1000; mincorrect INT:=5; corrects BIGINT:=0; shared BIGINT:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND status='ACTIVE') THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE'; END IF;
 SELECT COALESCE((value->>'min_withdraw_points')::int,1000),COALESCE((value->>'min_correct_for_withdraw')::int,5) INTO minp,mincorrect FROM app_settings WHERE key='reward_config';
 IF p_points < minp THEN RAISE EXCEPTION 'MIN_WITHDRAWAL'; END IF;
 IF p_method NOT IN ('DANA','GOPAY','OVO','SHOPEEPAY') THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
 IF length(trim(p_account))<6 OR length(trim(p_account))>40 THEN RAISE EXCEPTION 'INVALID_ACCOUNT'; END IF;
 SELECT COUNT(*) INTO corrects FROM quiz_answers qa JOIN quiz_attempts a ON a.id=qa.attempt_id WHERE a.user_id=p_user AND qa.is_correct=TRUE;
 IF corrects < mincorrect THEN RAISE EXCEPTION 'MIN_CORRECT'; END IF;
 IF EXISTS(SELECT 1 FROM fraud_flags WHERE user_id=p_user AND status='OPEN') THEN RAISE EXCEPTION 'FRAUD_REVIEW'; END IF;
 SELECT COUNT(DISTINCT user_id) INTO shared FROM withdrawals WHERE method=p_method AND account_number=trim(p_account) AND user_id<>p_user;
 IF shared>=2 THEN
   INSERT INTO fraud_flags(user_id,code,risk_score,detail) VALUES(p_user,'SHARED_PAYOUT_ACCOUNT',4,'Payout account dipakai >= 2 user lain') ON CONFLICT DO NOTHING;
   RAISE EXCEPTION 'FRAUD_REVIEW';
 END IF;
 SELECT COALESCE(SUM(amount),0) INTO bal FROM point_transactions WHERE user_id=p_user;
 IF bal < p_points THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
 INSERT INTO withdrawals(user_id,points,method,account_number,account_name) VALUES(p_user,p_points,p_method,trim(p_account),nullif(trim(p_name),'')) RETURNING id INTO wid;
 INSERT INTO point_transactions(user_id,amount,type,reference_id,description) VALUES(p_user,-p_points,'WITHDRAWAL',wid,'Poin ditahan untuk withdrawal');
 INSERT INTO notifications(user_id,type,title,message) VALUES(p_user,'WITHDRAWAL','Withdrawal dibuat','Permintaan withdrawal sedang menunggu review.');
 RETURN wid;
END $$;
REVOKE ALL ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) TO service_role;
