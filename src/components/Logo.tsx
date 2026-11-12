import Link from 'next/link';

/** Darren's SignedOn Social logo (public/brand/signedon-logo.png, 1400×472). */
export function Logo({ href = '/', size = 'md' }: { href?: string; size?: 'sm' | 'md' | 'lg'; cursor?: boolean }) {
  const h = size === 'lg' ? 52 : size === 'sm' ? 34 : 42;
  return (
    <Link href={href} className="flex shrink-0 items-center no-underline" aria-label="SignedOn home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/signedon-logo.png" alt="SignedOn Social" width={Math.round((h * 1400) / 472)} height={h} style={{ height: h, width: 'auto' }} />
    </Link>
  );
}
