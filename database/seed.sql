-- Seed idempotent untuk kuis pertama.
INSERT INTO quizzes (title, slug, description, reward_per_correct)
VALUES ('Kuis Harian', 'kuis-harian', 'Pengetahuan umum untuk MVP KuisPoin.', 5)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE qz UUID; q1 UUID; q2 UUID; q3 UUID;
BEGIN
  SELECT id INTO qz FROM quizzes WHERE slug='kuis-harian';
  IF NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id=qz) THEN
    INSERT INTO questions(quiz_id,question_text,position) VALUES(qz,'Planet terbesar di Tata Surya adalah?',1) RETURNING id INTO q1;
    INSERT INTO question_options(question_id,option_text,is_correct,position) VALUES
      (q1,'Bumi',false,1),(q1,'Mars',false,2),(q1,'Jupiter',true,3),(q1,'Venus',false,4);
    INSERT INTO questions(quiz_id,question_text,position) VALUES(qz,'Hasil 12 × 8 adalah?',2) RETURNING id INTO q2;
    INSERT INTO question_options(question_id,option_text,is_correct,position) VALUES
      (q2,'86',false,1),(q2,'96',true,2),(q2,'106',false,3),(q2,'108',false,4);
    INSERT INTO questions(quiz_id,question_text,position) VALUES(qz,'Ibu kota Jepang adalah?',3) RETURNING id INTO q3;
    INSERT INTO question_options(question_id,option_text,is_correct,position) VALUES
      (q3,'Osaka',false,1),(q3,'Kyoto',false,2),(q3,'Tokyo',true,3),(q3,'Nagoya',false,4);
  END IF;
END $$;
