import Link from 'next/link';

/** Crescent + sparkles mark (matches the LateNite logo). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="ln-moon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E040FB" /><stop offset="0.55" stopColor="#FF2D95" /><stop offset="1" stopColor="#8B3DFF" />
        </linearGradient>
      </defs>
      <path d="M24 5a15.5 15.5 0 1 0 12 24.5A13 13 0 0 1 24 5z" fill="url(#ln-moon)" />
      <path d="M30 4l1.4 3.6L35 9l-3.6 1.4L30 14l-1.4-3.6L25 9l3.6-1.4z" fill="#FFFFFF" />
      <path d="M36 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="#FF2D95" />
    </svg>
  );
}

export function Logo({ href = '/', size = 'md', cursor = false }: { href?: string; size?: 'sm' | 'md' | 'lg'; cursor?: boolean }) {
  const text = size === 'lg' ? 'text-[27px]' : size === 'sm' ? 'text-[19px]' : 'text-[23px]';
  return (
    <Link href={href} className="flex items-center gap-1.5 text-fg no-underline" aria-label="LateNite home">
      <LogoMark size={size === 'lg' ? 38 : size === 'sm' ? 26 : 32} />
      <span className={`font-display font-extrabold italic tracking-[-0.035em] ${text}`}>
        Late<span className="text-[#FF2D95]">Nite</span>{cursor && <span className="animate-blink not-italic text-cyan">_</span>}
      </span>
    </Link>
  );
}
