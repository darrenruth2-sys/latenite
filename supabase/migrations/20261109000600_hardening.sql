-- Pin search_path on the small validation helpers too (Supabase security advisor).
alter function app.effective_status(public.presence) set search_path = '';
alter function app.is_hex(jsonb) set search_path = '';
alter function app.reserved_usernames() set search_path = '';
alter function app.valid_music(jsonb) set search_path = '';
alter function app.valid_theme(jsonb) set search_path = '';
alter function app.valid_layout(jsonb) set search_path = '';
