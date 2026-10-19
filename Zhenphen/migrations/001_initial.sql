CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'supporter', 'admin', 'ssuAdmin')),
  member_type VARCHAR(80) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  bio VARCHAR(500) NOT NULL DEFAULT '',
  skills VARCHAR(300) NOT NULL DEFAULT '',
  avatar_mime VARCHAR(30),
  avatar_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ssu_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(140) NOT NULL,
  event_date DATE NOT NULL,
  location VARCHAR(180) NOT NULL,
  description VARCHAR(500) NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  status VARCHAR(10) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  work_status VARCHAR(15) NOT NULL DEFAULT 'Upcoming' CHECK (work_status IN ('Upcoming', 'In progress', 'Completed')),
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ssu_registrations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES ssu_events(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance VARCHAR(12) NOT NULL DEFAULT 'Registered' CHECK (attendance IN ('Registered', 'Checked in', 'Checked out')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS volunteer_applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest VARCHAR(140) NOT NULL,
  availability VARCHAR(140) NOT NULL,
  skills VARCHAR(500) NOT NULL DEFAULT '',
  ssu_collaboration BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'Received',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE volunteer_applications
  ADD COLUMN IF NOT EXISTS ssu_collaboration BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_presence (
  session_id VARCHAR(128) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_content (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  homepage_title VARCHAR(120) NOT NULL,
  homepage_summary VARCHAR(500) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES users(id)
);

INSERT INTO site_content (id, homepage_title, homepage_summary)
VALUES (
  1,
  'Together, We Build a Stronger Community.',
  'We connect people who want to help with communities that need support. Through service, donations, volunteering, and solidarity, small acts become lasting change.'
)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS ssu_events_date_idx ON ssu_events(event_date);
CREATE INDEX IF NOT EXISTS ssu_registrations_user_idx ON ssu_registrations(user_id);
CREATE INDEX IF NOT EXISTS volunteer_applications_user_idx ON volunteer_applications(user_id);
CREATE INDEX IF NOT EXISTS user_presence_last_seen_idx ON user_presence(last_seen);

-- Preserve access for existing and operator-provisioned accounts; signup explicitly sets FALSE.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verification_user_idx ON email_verification_tokens(user_id);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  message VARCHAR(3000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
