'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Keeps "online" status fresh while the app is open (Phase 3 presence). Silent if unavailable. */
export function Heartbeat() {
  useEffect(() => {
    const sb = createClient();
    const beat = () => { if (document.visibilityState === 'visible') sb.rpc('heartbeat').then(() => {}, () => {}); };
    beat();
    const t = setInterval(beat, 45_000);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat); };
  }, []);
  return null;
}
