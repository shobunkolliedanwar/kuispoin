-- KuisPoin milestone 2: missions, withdrawals, fraud signals, atomic reward operations.
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  metric TEXT NOT NULL CHECK(metric IN ('ANSWERS','CORRECT_ANSWERS','COMPLETED_QUIZZES')),
  target INTEGER NOT NULL CHECK(target>0), reward_points INTEGER NOT NULL CHECK(reward_points>=0), is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS mission_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE, period_date DATE NOT NULL,
  reward_points INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id,mission_id,period_date)
);
CREATE TABLE IF NOT EXISTS fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE SET NULL, code TEXT NOT NULL, risk_score INTEGER NOT NULL DEFAULT 1,
  detail TEXT, status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REVIEWED','DISMISSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id);
CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_mission_once ON point_transactions(user_id,type,reference_id) WHERE type='MISSION_REWARD' AND reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_withdraw_once ON point_transactions(user_id,type,reference_id) WHERE type='WITHDRAWAL' AND reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mission_claims_user_date_idx ON mission_claims(user_id,period_date DESC);
CREATE INDEX IF NOT EXISTS fraud_flags_user_idx ON fraud_flags(user_id,created_at DESC);
ALTER TABLE missions ENABLE ROW LEVEL SECURITY; ALTER TABLE mission_claims ENABLE ROW LEVEL SECURITY; ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;
INSERT INTO missions(code,title,metric,target,reward_points) VALUES
('ANSWER_5','Jawab 5 soal','ANSWERS',5,2),('CORRECT_3','Jawab benar 3 soal','CORRECT_ANSWERS',3,3),('QUIZ_3','Selesaikan 3 kuis','COMPLETED_QUIZZES',3,5)
ON CONFLICT(code) DO UPDATE SET title=EXCLUDED.title,metric=EXCLUDED.metric,target=EXCLUDED.target,reward_points=EXCLUDED.reward_points;

CREATE OR REPLACE FUNCTION create_withdrawal_atomic(p_user UUID,p_points INT,p_method TEXT,p_account TEXT,p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE bal BIGINT; wid UUID;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text));
 IF p_points < 1000 THEN RAISE EXCEPTION 'MIN_WITHDRAWAL'; END IF;
 IF p_method NOT IN ('DANA','GOPAY','OVO','SHOPEEPAY') THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
 SELECT COALESCE(SUM(amount),0) INTO bal FROM point_transactions WHERE user_id=p_user;
 IF bal < p_points THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
 INSERT INTO withdrawals(user_id,points,method,account_number,account_name) VALUES(p_user,p_points,p_method,p_account,p_name) RETURNING id INTO wid;
 INSERT INTO point_transactions(user_id,amount,type,reference_id,description) VALUES(p_user,-p_points,'WITHDRAWAL',wid,'Poin ditahan untuk withdrawal');
 RETURN wid;
END $$;

CREATE OR REPLACE FUNCTION reject_withdrawal_atomic(p_withdrawal UUID,p_admin UUID,p_note TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE w withdrawals%ROWTYPE;
BEGIN
 SELECT * INTO w FROM withdrawals WHERE id=p_withdrawal FOR UPDATE;
 IF w.id IS NULL OR w.status <> 'PENDING' THEN RAISE EXCEPTION 'INVALID_WITHDRAWAL'; END IF;
 UPDATE withdrawals SET status='REJECTED',processed_at=NOW(),processed_by=p_admin,note=p_note WHERE id=p_withdrawal;
 INSERT INTO point_transactions(user_id,amount,type,reference_id,description) VALUES(w.user_id,w.points,'ADJUSTMENT',w.id,'Refund withdrawal ditolak');
END $$;
-- RPC sensitif hanya boleh dipanggil backend dengan service-role key.
REVOKE ALL ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_withdrawal_atomic(UUID,INT,TEXT,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION reject_withdrawal_atomic(UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reject_withdrawal_atomic(UUID,UUID,TEXT) TO service_role;
