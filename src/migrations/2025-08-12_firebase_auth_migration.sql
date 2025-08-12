-- Migration: Add firebase_uid and drop password_hash usage for Firebase Auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;

-- password_hash may exist; keep column for backward compatibility if present, but no longer required
-- Ensure phone_number can be NULL since Firebase may authenticate via email only
ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;

-- Default active true for Firebase users
ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Note: Move any admin accounts to Firebase and backfill firebase_uid when available.
