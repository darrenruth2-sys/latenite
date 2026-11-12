export const PALETTE = ['#38E1FF', '#FF4FA3', '#9B7BFF', '#5CFF8A', '#FFC23D', '#FF8A5C', '#7CF5D0', '#FFB3D9', '#B3E5FF', '#D4C2FF'];

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string) {
  const parts = name.replace(/[._]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24); if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d > 300 ? 'numeric' : undefined });
}

export function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const CODES: Record<string, string> = {
  AH_UNDERAGE: 'You need to be 18 or older to join SignedOn.',
  AH_INVALID_BIRTHDATE: 'That birthday doesn’t look right.',
  AH_USERNAME_RESERVED: 'That username is reserved. Try another.',
  AH_RATE_LIMIT: 'Whoa, slow down a little. Try again in a bit.',
  AH_NOT_ALLOWED: 'You can’t do that here.',
  AH_NOT_FOUND: 'That doesn’t exist anymore.',
  AH_AUTH: 'Please log in first.',
  AH_NUDGES_OFF: 'They’ve turned nudges off.',
  AH_NUDGE_COOLDOWN: 'Easy — wait a few seconds before nudging again.',
  AH_NOT_FRIENDS: 'You can only do that with friends.',
  AH_BAD_TARGET: 'That didn’t work. Try again.',
};

/** Turns a database / auth error into something a person can read. */
export function friendlyError(err: unknown): string {
  const msg = typeof err === 'string' ? err : (err as { message?: string })?.message || '';
  for (const code of Object.keys(CODES)) if (msg.includes(code)) return CODES[code];
  if (/duplicate key.*username/i.test(msg)) return 'That username was just taken. Try another.';
  if (/Database error saving new user/i.test(msg)) return 'We couldn’t create that account. Check your username and birthday.';
  if (/captcha/i.test(msg)) return 'Finish the “are you a person” check, then try again.';
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(msg)) return 'Check your inbox and confirm your email first.';
  if (/User already registered/i.test(msg)) return 'There’s already an account with that email.';
  if (/Password should be/i.test(msg)) return 'Password needs at least 8 characters.';
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Wait a minute and try again.';
  if (/fetch failed|network/i.test(msg)) return 'Can’t reach SignedOn right now. Check your connection.';
  return 'Something went wrong. Try again.';
}

export function clamp(n: number, a: number, b: number) { return Math.min(b, Math.max(a, n)); }
