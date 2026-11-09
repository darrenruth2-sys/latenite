'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function BlockButton({ meId, otherId, name, blocked }: { meId: string; otherId: string; name: string; blocked: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function toggle() {
    if (!blocked && !confirm(`Block ${name}? You'll unfriend each other and they won't be able to see your page, message you or find you.`)) return;
    setBusy(true);
    const sb = createClient();
    if (blocked) await sb.from('blocks').delete().eq('blocker_id', meId).eq('blocked_id', otherId);
    else await sb.from('blocks').insert({ blocker_id: meId, blocked_id: otherId });
    setBusy(false); router.refresh();
  }
  return <button type="button" disabled={busy} onClick={toggle} className="min-h-9 px-2 text-sm text-dim hover:text-fg">{blocked ? 'Unblock' : 'Block'}</button>;
}
