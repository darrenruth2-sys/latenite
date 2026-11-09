'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export function MarkRead() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user) { await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null); router.refresh(); }
    }, 1500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
