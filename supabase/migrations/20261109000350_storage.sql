-- Storage buckets + policies (hosted Supabase only; skipped by the local test stack).
-- `media`: public images (avatars, banners, post photos, guestbook images). Files live under <user id>/...
-- `private-media`: messenger photos + voice notes, read through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-media', 'private-media', false, 10485760,
        array['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "media: owners upload into their folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: owners update their files" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: owners delete their files" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- private-media paths: <conversation id>/<sender id>/<file>
create policy "private: members upload as themselves" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-media'
              and (storage.foldername(name))[2] = (select auth.uid())::text
              and exists (select 1 from public.conversation_members m
                          where m.conversation_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid())));
create policy "private: members read" on storage.objects for select to authenticated
  using (bucket_id = 'private-media'
         and exists (select 1 from public.conversation_members m
                     where m.conversation_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid())));
create policy "private: senders delete" on storage.objects for delete to authenticated
  using (bucket_id = 'private-media' and (storage.foldername(name))[2] = (select auth.uid())::text);
