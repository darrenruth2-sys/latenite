'use client';
import { useEffect } from 'react';
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main id="main" className="bg-dots flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="pixel text-3xl text-pink">ERROR · CONNECTION DROPPED</p>
      <h1 className="font-display text-4xl font-extrabold">Something glitched.</h1>
      <p className="max-w-md text-muted">That one&apos;s on us. Try again — and if it keeps happening, refresh the page.</p>
      <div className="flex gap-2"><button onClick={reset} className="btn-cyan">Try again</button><a href="/feed" className="btn-ghost">Back to feed</a></div>
      {error.digest && <p className="text-xs text-dim">Error code: {error.digest}</p>}
    </main>
  );
}
