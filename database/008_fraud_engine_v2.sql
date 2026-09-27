-- KuisPoin v0.11 - Fraud Engine V2
-- Apply after 007_money_safety.sql.

ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE fraud_flags
SET severity = CASE WHEN risk_score >= 7 THEN 'HIGH' WHEN risk_score >= 4 THEN 'MEDIUM' ELSE 'LOW' END
WHERE severity IS NULL;
ALTER TABLE fraud_flags ALTER COLUMN severity SET DEFAULT 'LOW';
ALTER TABLE fraud_flags ALTER COLUMN severity SET NOT NULL;
ALTER TABLE fraud_flags DROP CONSTRAINT IF EXISTS fraud_flags_severity_check;
ALTER TABLE fraud_flags ADD CONSTRAINT fraud_flags_severity_check CHECK (severity IN ('LOW','MEDIUM','HIGH'));
ALTER TABLE fraud_flags DROP CONSTRAINT IF EXISTS fraud_flags_risk_score_range;
ALTER TABLE fraud_flags ADD CONSTRAINT fraud_flags_risk_score_range CHECK (risk_score BETWEEN 1 AND 10) NOT VALID;
CREATE INDEX IF NOT EXISTS fraud_flags_status_risk_idx ON fraud_flags(status,risk_score DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_payout_lookup_idx ON withdrawals(method,account_number,user_id);

-- Server-side risk snapshot. This does not ban users; it provides deterministic signals
-- used by the atomic withdrawal function and the admin review UI.
CREATE OR REPLACE FUNCTION withdrawal_risk_snapshot(p_user UUID,p_points INT,p_method TEXT,p_account TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
 age_hours NUMERIC:=0; recent_withdrawals INT:=0; shared_users INT:=0; open_score INT:=0;
 score INT:=0; signals JSONB:='[]'::jsonb;
BEGIN
 SELECT extract(epoch FROM (NOW()-created_at))/3600 INTO age_hours FROM users WHERE id=p_user;
 IF age_hours IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

 SELECT COUNT(*) INTO recent_withdrawals FROM withdrawals
 WHERE user_id=p_user AND created_at >= NOW()-INTERVAL '24 hours';
 SELECT COUNT(DISTINCT user_id) INTO shared_users FROM withdrawals
 WHERE method=p_method AND account_number=trim(p_account) AND user_id<>p_user;
 SELECT COALESCE(MAX(risk_score),0) INTO open_score FROM fraud_flags WHERE user_id=p_user AND status='OPEN';

 IF age_hours < 24 THEN score:=score+2; signals:=signals||jsonb_build_array('ACCOUNT_LT_24H'); END IF;
 IF recent_withdrawals >= 2 THEN score:=score+2; signals:=signals||jsonb_build_array('WITHDRAWAL_VELOCITY_24H'); END IF;
 IF shared_users = 1 THEN score:=score+3; signals:=signals||jsonb_build_array('PAYOUT_SHARED_2_USERS'); END IF;
 IF shared_users >= 2 THEN score:=score+7; signals:=signals||jsonb_build_array('PAYOUT_SHARED_3PLUS_USERS'); END IF;
 IF open_score >= 4 THEN score:=score+3; signals:=signals||jsonb_build_array('EXISTING_OPEN_RISK'); END IF;
 score:=LEAST(score,10);

 RETURN jsonb_build_object(
   'score',score,
   'severity',CASE WHEN score>=7 THEN 'HIGH' WHEN score>=4 THEN 'MEDIUM' ELSE 'LOW' END,
   'signals',signals,
   'account_age_hours',round(age_hours,1),
   'withdrawals_24h',recent_withdrawals,
   'shared_payout_users',shared_users
 );
END $$;
REVOKE ALL ON FUNCTION withdrawal_risk_snapshot(UUID,INT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION withdrawal_risk_snapshot(UUID,INT,TEXT,TEXT) TO service_role;

-- Keep money movement atomic while adding deterministic fraud signals.
CREATE OR REPLACE FUNCTION create_withdrawal_atomic(p_user UUID,p_points INT,p_method TEXT,p_account TEXT,p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
 bal BIGINT; wid UUID; minp INT:=1000; mincorrect INT:=5; corrects BIGINT:=0;
 risk JSONB; riskv INT:=0; severityv TEXT:='LOW';
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND status='ACTIVE') THEN RAISE EXCEPTION 'ACCOUNT_INACTIVE'; END IF;
 SELECT COALESCE((value->>'min_withdraw_points')::int,1000),COALESCE((value->>'min_correct_for_withdraw')::int,5)
 INTO minp,mincorrect FROM app_settings WHERE key='reward_config';
 IF p_points < minp THEN RAISE EXCEPTION 'MIN_WITHDRAWAL'; END IF;
 IF p_method NOT IN ('DANA','GOPAY','OVO','SHOPEEPAY') THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
 IF length(trim(p_account))<6 OR length(trim(p_account))>40 THEN RAISE EXCEPTION 'INVALID_ACCOUNT'; END IF;
 SELECT COUNT(*) INTO corrects FROM quiz_answers qa JOIN quiz_attempts a ON a.id=qa.attempt_id
 WHERE a.user_id=p_user AND qa.is_correct=TRUE;
 IF corrects < mincorrect THEN RAISE EXCEPTION 'MIN_CORRECT'; END IF;
 IF EXISTS(SELECT 1 FROM fraud_flags WHERE user_id=p_user AND status='OPEN' AND risk_score>=7) THEN RAISE EXCEPTION 'FRAUD_REVIEW'; END IF;

 risk:=withdrawal_risk_snapshot(p_user,p_points,p_method,p_account);
 riskv:=COALESCE((risk->>'score')::int,0); severityv:=COALESCE(risk->>'severity','LOW');
 IF riskv>=4 THEN
   INSERT INTO fraud_flags(user_id,code,risk_score,severity,detail,evidence)
   VALUES(p_user,'WITHDRAWAL_RISK',riskv,severityv,'Withdrawal risk engine signal',risk);
 END IF;
 IF riskv>=7 THEN RAISE EXCEPTION 'FRAUD_REVIEW'; END IF;

 SELECT COALESCE(SUM(amount),0) INTO bal FROM point_transactions WHERE user_id=p_user;
 IF bal < p_points THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
 INSERT INTO withdrawals(user_id,points,method,account_number,account_name)
 VALUES(p_user,p_points,p_method,trim(p_account),nullif(trim(p_name),'')) RETURNING id INTO wid;
 INSERT INTO point_transactions(user_id,amount,type,reference_id,description)
 VALUES(p_user,-p_points,'WITHDRAWAL',wid,'Poin ditahan untuk withdrawal');
 INSERT INTO notifications(user_id,type,title,message)
 VALUES(p_user,'WITHDRAWAL','Withdrawal dibuat','Permintaan withdrawal sedang menunggu review.');
 RETURN wid;
END $$;
REVOKE ALL ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) TO service_role;
