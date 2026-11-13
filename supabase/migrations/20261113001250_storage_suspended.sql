-- Audit fix: suspended accounts can't upload files (everything else was already blocked for them).
-- (Storage policies exist only on hosted Supabase; the local test stack skips *storage* migrations.)
drop policy if exists "media: owners upload into their folder" on storage.objects;
create policy "media: owners upload into their folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and app.is_active((select auth.uid())));
drop policy if exists "media: owners update their files" on storage.objects;
create policy "media: owners update their files" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and app.is_active((select auth.uid())));
drop policy if exists "private: members upload as themselves" on storage.objects;
create policy "private: members upload as themselves" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-media'
              and (storage.foldername(name))[2] = (select auth.uid())::text
              and app.is_active((select auth.uid()))
              and exists (select 1 from public.conversation_members m
                          where m.conversation_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid())));
