-- Users: login accounts. role + optional student_id link a student login to a record.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  student_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id INTEGER NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'teacher', 'student', 'user', 'moderator'));

-- School records tables.
-- An older students table from the first version had an email column; replace it once.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'students'
      AND column_name = 'email'
  ) THEN
    DROP TABLE IF EXISTS marks;
    DROP TABLE IF EXISTS students;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  roll_no VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  date_of_birth DATE NOT NULL,
  class_name VARCHAR(2) NOT NULL,
  section CHAR(1) NOT NULL,
  guardian_name VARCHAR(80) NOT NULL,
  guardian_phone VARCHAR(20) NOT NULL,
  guardian_relation VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link student accounts after students exists (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_student_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS marks (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  exam VARCHAR(20) NOT NULL,
  subject VARCHAR(80) NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  max_score NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, exam, subject)
);

CREATE TABLE IF NOT EXISTS teacher_classes (
  teacher_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  class_name VARCHAR(2) NOT NULL,
  section CHAR(1) NOT NULL,
  PRIMARY KEY (teacher_user_id, class_name, section)
);
