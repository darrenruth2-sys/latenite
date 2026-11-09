'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar } from '@/components/Avatar';

export function FriendFilter({ friends }: { friends: { id: string; username: string; display_name: string; avatar_url: string | null; since: string }[] }) {
  const [q, setQ] = useState('');
  const shown = friends.filter((f) => !q || f.username.includes(q.toLowerCase()) || f.display_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <label htmlFor="ff" className="sr-only">Filter friends</label>
      <input id="ff" className="field" placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((f) => (
          <li key={f.id}><Link href={`/u/${f.username}`} className="panel flex flex-col items-center gap-2 p-3 text-center hover:border-cyan">
            <Avatar user={f} size={72} /><span className="w-full truncate font-semibold">{f.display_name}</span>
            <span suppressHydrationWarning className="text-xs text-dim">since {new Date(f.since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span></Link></li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-sm text-dim">No friends match &ldquo;{q}&rdquo;.</p>}
    </>
  );
}
