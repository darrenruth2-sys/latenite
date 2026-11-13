-- Hosted Supabase only (skipped by the local test stack): every minute, ask the site to screen whatever
-- Sentinel has waiting. The endpoint only processes queued items, so it's harmless to call.
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.unschedule('sentinel') where exists (select 1 from cron.job where jobname = 'sentinel');
select cron.schedule('sentinel', '* * * * *',
  $$ select net.http_post(url := 'https://signedon.social/api/sentinel', headers := '{"Content-Type": "application/json"}'::jsonb,
                          body := '{}'::jsonb, timeout_milliseconds := 55000) $$);
