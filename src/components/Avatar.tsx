import { colorFor, initials } from '@/lib/utils';

type Props = {
  user: { id: string; username: string; display_name?: string | null; avatar_url?: string | null };
  size?: number; online?: boolean | null; border?: string; className?: string; square?: boolean;
};

export function Avatar({ user, size = 48, online, border = 'var(--color-fg)', className = '' }: Props) {
  const name = user.display_name || user.username;
  const font = Math.max(11, Math.round(size * 0.36));
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt="" width={size} height={size} className="h-full w-full object-cover" style={{ border: `2px solid ${border}` }} />
      ) : (
        <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-display font-extrabold text-ink"
          style={{ background: colorFor(user.id), border: `2px solid ${border}`, fontSize: font }}>
          {initials(name)}
        </span>
      )}
      {online != null && (
        <span title={online ? 'Online' : 'Offline'}
          className={`absolute -bottom-1 -right-1 rounded-full border-[3px] border-ink ${online ? 'animate-pulse-online bg-lime' : 'bg-dim'}`}
          style={{ width: Math.max(12, size * 0.22), height: Math.max(12, size * 0.22) }} />
      )}
    </span>
  );
}
