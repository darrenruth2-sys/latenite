-- Rename: LateNite Social → SignedOn (signedon.social).
-- Reserve the new brand names as usernames (old ones stay reserved too) and update user-facing badge text.

create or replace function app.reserved_usernames() returns text[] language sql immutable set search_path = '' as $$
  select array['admin','administrator','afterhours','latenite','latenitesocial','signedon','signedonsocial','signed_on','support','help',
               'moderator','mod','staff','system','root','api','www','mail','settings','login','logout','signup','about','privacy','terms',
               'security','official','team','null','undefined','everyone','me','you'];
$$;

update public.badges set description = 'One of the first 1,000 people on SignedOn' where key = 'early_bird';
