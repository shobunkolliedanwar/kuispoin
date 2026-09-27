-- KuisPoin milestone 3: CMS, reward settings, audit logs, fraud hardening.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_flags_status_idx ON fraud_flags(status, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_answers_attempt_idx ON quiz_answers(attempt_id);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

INSERT INTO app_settings(key,value) VALUES
('reward_config','{"min_withdraw_points":1000,"points_per_rupiah":1,"min_correct_for_withdraw":5,"daily_quiz_reward_cap":500}'::jsonb)
ON CONFLICT(key) DO NOTHING;

-- Add additional fraud code uniqueness per attempt/code to avoid flag spam.
CREATE UNIQUE INDEX IF NOT EXISTS fraud_flags_attempt_code_once
ON fraud_flags(attempt_id,code) WHERE attempt_id IS NOT NULL;

-- Atomic admin adjustment, with audit trail and row lock.
CREATE OR REPLACE FUNCTION admin_adjust_points_atomic(p_admin UUID,p_user UUID,p_amount INT,p_reason TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE tx UUID;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_admin AND role='ADMIN' AND status='ACTIVE') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_amount=0 OR abs(p_amount)>1000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 INSERT INTO point_transactions(user_id,amount,type,description) VALUES(p_user,p_amount,'ADJUSTMENT',p_reason) RETURNING id INTO tx;
 INSERT INTO admin_audit_logs(admin_id,action,entity_type,entity_id,detail) VALUES(p_admin,'ADJUST_POINTS','USER',p_user::text,jsonb_build_object('amount',p_amount,'reason',p_reason,'transaction_id',tx));
 RETURN tx;
END $$;
REVOKE ALL ON FUNCTION admin_adjust_points_atomic(UUID,UUID,INT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_points_atomic(UUID,UUID,INT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION award_quiz_reward_atomic(p_user UUID,p_attempt UUID,p_requested INT,p_description TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE capv INT:=500; used INT:=0; grantv INT:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 SELECT COALESCE((value->>'daily_quiz_reward_cap')::int,500) INTO capv FROM app_settings WHERE key='reward_config';
 SELECT COALESCE(SUM(amount),0) INTO used FROM point_transactions WHERE user_id=p_user AND type='QUIZ_REWARD' AND created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Jakarta');
 grantv:=GREATEST(0,LEAST(p_requested,capv-used));
 IF grantv>0 THEN
  INSERT INTO point_transactions(user_id,amount,type,reference_id,description) VALUES(p_user,grantv,'QUIZ_REWARD',p_attempt,p_description) ON CONFLICT DO NOTHING;
 END IF;
 RETURN grantv;
END $$;
REVOKE ALL ON FUNCTION award_quiz_reward_atomic(UUID,UUID,INT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION award_quiz_reward_atomic(UUID,UUID,INT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION create_withdrawal_atomic(p_user UUID,p_points INT,p_method TEXT,p_account TEXT,p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE bal BIGINT; wid UUID; minp INT:=1000; mincorrect INT:=5; corrects BIGINT:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 SELECT COALESCE((value->>'min_withdraw_points')::int,1000),COALESCE((value->>'min_correct_for_withdraw')::int,5) INTO minp,mincorrect FROM app_settings WHERE key='reward_config';
 IF p_points < minp THEN RAISE EXCEPTION 'MIN_WITHDRAWAL'; END IF;
 IF p_method NOT IN ('DANA','GOPAY','OVO','SHOPEEPAY') THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
 SELECT COUNT(*) INTO corrects FROM quiz_answers qa JOIN quiz_attempts a ON a.id=qa.attempt_id WHERE a.user_id=p_user AND qa.is_correct=TRUE;
 IF corrects < mincorrect THEN RAISE EXCEPTION 'MIN_CORRECT'; END IF;
 IF EXISTS(SELECT 1 FROM fraud_flags WHERE user_id=p_user AND status='OPEN') THEN RAISE EXCEPTION 'FRAUD_REVIEW'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO bal FROM point_transactions WHERE user_id=p_user;
 IF bal < p_points THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
 INSERT INTO withdrawals(user_id,points,method,account_number,account_name) VALUES(p_user,p_points,p_method,p_account,p_name) RETURNING id INTO wid;
 INSERT INTO point_transactions(user_id,amount,type,reference_id,description) VALUES(p_user,-p_points,'WITHDRAWAL',wid,'Poin ditahan untuk withdrawal');
 RETURN wid;
END $$;
REVOKE ALL ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) TO service_role;
