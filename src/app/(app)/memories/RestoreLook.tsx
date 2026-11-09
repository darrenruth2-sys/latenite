'use client';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export function RestoreLook({ theme, music, username }: { theme: unknown; music: unknown; username: string }) {
  const router = useRouter();
  async function restore() {
    if (!confirm('Bring back this look?')) return;
    const sb = createClient(); const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('profile_details').update({ theme, music }).eq('id', user!.id);
    if (!error) router.push(`/u/${username}`);
  }
  return <button type="button" onClick={restore} className="btn-ghost btn-sm self-start">Restore</button>;
}
