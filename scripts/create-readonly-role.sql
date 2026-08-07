-- Creates the read-only role used for reviewer database access.
--
-- No credentials in this file. Supply the password at run time:
--   psql "$DIRECT_URL" -v readonly_password="'choose-a-strong-password'" \
--        -f scripts/create-readonly-role.sql
--
-- Run against the DIRECT (non-pooled) Neon endpoint. Re-running is safe.

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'moveo_readonly') THEN
    CREATE ROLE moveo_readonly LOGIN;
  END IF;
END
$$;

ALTER ROLE moveo_readonly WITH PASSWORD :readonly_password;

-- Neon requires the owner role to be granted to the new role before it can be
-- given privileges on owner-created objects.
GRANT moveo_readonly TO CURRENT_USER;

GRANT CONNECT ON DATABASE neondb TO moveo_readonly;
GRANT USAGE ON SCHEMA public TO moveo_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO moveo_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO moveo_readonly;

-- Explicitly withhold everything that is not reading.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM moveo_readonly;
REVOKE CREATE ON SCHEMA public FROM moveo_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM moveo_readonly;
