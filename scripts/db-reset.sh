#!/bin/bash
# Local only: wipe and re-apply all migrations to the local Postgres used for testing.
set -e
export PGOPTIONS="-c client_min_messages=warning"
P="psql -h 127.0.0.1 -p 54322 -U postgres -v ON_ERROR_STOP=1 -q"
$P <<'SQL'
drop schema if exists app cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
delete from auth.users;
SQL
for f in $(dirname $0)/../supabase/migrations/*.sql; do
  case "$f" in *storage*) continue;; esac   # storage policies only exist on hosted Supabase
  $P -f "$f" >/dev/null && echo "applied $(basename $f)"
done
$P -c "notify pgrst, 'reload schema'"
rm -rf /home/claude/stack/mail/* /home/claude/stack/storage/*
