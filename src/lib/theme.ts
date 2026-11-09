// Profile theme tokens → CSS custom properties. Tokens are validated in the database too;
// everything here re-validates before it touches a style, so a theme can never inject CSS.

export type ThemeTokens = {
  preset?: string; page?: string; card?: string; text?: string; muted?: string; line?: string; accent?: string; on_accent?: string;
  banner_a?: string; banner_b?: string; pattern?: Pattern; font?: FontKey; bg_image?: string | null; radius?: 'none' | 'soft' | 'round'; shadow?: 'none' | 'hard' | 'glow';
};
export type Pattern = 'none' | 'dots' | 'grid' | 'stripes' | 'checker' | 'scanlines' | 'stars' | 'hearts';
export type FontKey = 'bold' | 'serif' | 'pixel' | 'mono' | 'round';
type Full = Required<Omit<ThemeTokens, 'bg_image'>> & { bg_image: string | null };

export const FONTS: Record<FontKey, { label: string; stack: string }> = {
  bold: { label: 'Bold', stack: 'var(--font-display)' },
  serif: { label: 'Serif', stack: 'var(--font-serif)' },
  pixel: { label: 'Pixel', stack: 'var(--font-pixel)' },
  mono: { label: 'Mono', stack: 'var(--font-mono)' },
  round: { label: 'Round', stack: 'ui-rounded, "SF Pro Rounded", var(--font-display)' },
};
export const PATTERNS: Pattern[] = ['none', 'dots', 'grid', 'stripes', 'checker', 'scanlines', 'stars', 'hearts'];

export const PRESETS: Record<string, { name: string } & Full> = {
  midnight: { name: 'Midnight', preset: 'midnight', page: '#0A0A18', card: '#13132A', text: '#EDEBFF', muted: '#C9C6EE', line: '#2A2A55', accent: '#FF4FA3', on_accent: '#0A0A18', banner_a: '#2B0F4D', banner_b: '#3A1466', pattern: 'dots', font: 'bold', bg_image: null, radius: 'none', shadow: 'hard' },
  bubblegum: { name: 'Bubblegum', preset: 'bubblegum', page: '#FFD6EC', card: '#FFFFFF', text: '#1A0F2E', muted: '#5A3D6B', line: '#E7B8D2', accent: '#D4146F', on_accent: '#FFFFFF', banner_a: '#FF8FC8', banner_b: '#FFFFFF', pattern: 'checker', font: 'round', bg_image: null, radius: 'soft', shadow: 'hard' },
  static: { name: 'Static', preset: 'static', page: '#0E0E0E', card: '#121A13', text: '#E6FFE9', muted: '#9FD8A8', line: '#2F5A38', accent: '#5CFF8A', on_accent: '#0A0A18', banner_a: '#0E2A14', banner_b: '#163D1E', pattern: 'scanlines', font: 'pixel', bg_image: null, radius: 'none', shadow: 'glow' },
  arcade: { name: 'Arcade', preset: 'arcade', page: '#120A2E', card: '#1E1147', text: '#FFF6DA', muted: '#E5D7A8', line: '#6B4FB8', accent: '#FFC23D', on_accent: '#0A0A18', banner_a: '#FF4FA3', banner_b: '#FF8A5C', pattern: 'stars', font: 'bold', bg_image: null, radius: 'none', shadow: 'hard' },
  paper: { name: 'Notebook (light)', preset: 'paper', page: '#F4F1E8', card: '#FFFFFF', text: '#1D1B26', muted: '#4D4A5C', line: '#C9C3B2', accent: '#2457D6', on_accent: '#FFFFFF', banner_a: '#DCE6FF', banner_b: '#F4F1E8', pattern: 'grid', font: 'serif', bg_image: null, radius: 'none', shadow: 'hard' },
  forest: { name: 'Forest Rave', preset: 'forest', page: '#07170F', card: '#0E2619', text: '#E8FFF1', muted: '#A8D9BC', line: '#1F5A3A', accent: '#C6FF3D', on_accent: '#07170F', banner_a: '#0E3D24', banner_b: '#14532F', pattern: 'stripes', font: 'mono', bg_image: null, radius: 'none', shadow: 'glow' },
  sunset: { name: 'Sunset Strip', preset: 'sunset', page: '#2A0E1F', card: '#3B1430', text: '#FFEFE6', muted: '#F2C4B5', line: '#7A2E52', accent: '#FF8A5C', on_accent: '#1A0710', banner_a: '#FF4FA3', banner_b: '#FFC23D', pattern: 'none', font: 'serif', bg_image: null, radius: 'soft', shadow: 'hard' },
  ocean: { name: 'Deep End', preset: 'ocean', page: '#04131F', card: '#0A2236', text: '#E6F6FF', muted: '#A9CDE3', line: '#1B4B6E', accent: '#38E1FF', on_accent: '#04131F', banner_a: '#0B3A5C', banner_b: '#0E4F7A', pattern: 'dots', font: 'round', bg_image: null, radius: 'round', shadow: 'none' },
  chrome: { name: 'Y2K Chrome', preset: 'chrome', page: '#DDE3EE', card: '#F7F9FC', text: '#151A26', muted: '#46506A', line: '#9AA6BE', accent: '#7A3CFF', on_accent: '#FFFFFF', banner_a: '#B8C4DA', banner_b: '#EEF2F8', pattern: 'stripes', font: 'round', bg_image: null, radius: 'round', shadow: 'hard' },
  goth: { name: 'Black Lace', preset: 'goth', page: '#050505', card: '#111111', text: '#F2F2F2', muted: '#BDBDBD', line: '#3A3A3A', accent: '#C21E56', on_accent: '#FFFFFF', banner_a: '#1A1A1A', banner_b: '#2A0A14', pattern: 'hearts', font: 'serif', bg_image: null, radius: 'none', shadow: 'none' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const URL_OK = /^https?:\/\/[^\s"'()<>\\]+$/;

export function resolveTheme(t: ThemeTokens | null | undefined): Full {
  const base = PRESETS[t?.preset || 'midnight'] || PRESETS.midnight;
  const pick = (k: keyof Full, ok: (v: unknown) => boolean) => (t && ok(t[k as keyof ThemeTokens]) ? t[k as keyof ThemeTokens] : base[k]);
  const hex = (v: unknown) => typeof v === 'string' && HEX.test(v);
  return {
    preset: base.preset,
    page: pick('page', hex) as string, card: pick('card', hex) as string, text: pick('text', hex) as string, muted: pick('muted', hex) as string,
    line: pick('line', hex) as string, accent: pick('accent', hex) as string, on_accent: pick('on_accent', hex) as string,
    banner_a: pick('banner_a', hex) as string, banner_b: pick('banner_b', hex) as string,
    pattern: pick('pattern', (v) => PATTERNS.includes(v as Pattern)) as Pattern,
    font: pick('font', (v) => typeof v === 'string' && v in FONTS) as FontKey,
    radius: pick('radius', (v) => v === 'none' || v === 'soft' || v === 'round') as Full['radius'],
    shadow: pick('shadow', (v) => v === 'none' || v === 'hard' || v === 'glow') as Full['shadow'],
    bg_image: typeof t?.bg_image === 'string' && URL_OK.test(t.bg_image) ? t.bg_image : null,
  };
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function patternCss(p: Pattern, color: string): { image: string; size: string } {
  const c = rgba(color, 0.22), c2 = rgba(color, 0.08);
  switch (p) {
    case 'dots': return { image: `radial-gradient(${c} 1px, transparent 1px)`, size: '26px 26px' };
    case 'grid': return { image: `linear-gradient(${c2} 1px, transparent 1px), linear-gradient(90deg, ${c2} 1px, transparent 1px)`, size: '28px 28px' };
    case 'stripes': return { image: `repeating-linear-gradient(45deg, ${c2} 0 12px, transparent 12px 24px)`, size: 'auto' };
    case 'checker': return { image: `repeating-conic-gradient(${c2} 0 25%, transparent 0 50%)`, size: '40px 40px' };
    case 'scanlines': return { image: `repeating-linear-gradient(0deg, ${c2} 0 2px, transparent 2px 4px)`, size: 'auto' };
    case 'stars': return { image: `radial-gradient(${c} 1.5px, transparent 2px), radial-gradient(${c2} 1px, transparent 1.5px)`, size: '60px 60px, 23px 23px' };
    case 'hearts': return { image: `radial-gradient(circle at 30% 40%, ${c2} 4px, transparent 5px), radial-gradient(circle at 70% 40%, ${c2} 4px, transparent 5px)`, size: '36px 36px' };
    default: return { image: 'none', size: 'auto' };
  }
}

/** CSS variables + page background for a themed profile. */
export function themeVars(t: Full): React.CSSProperties {
  const pat = patternCss(t.pattern, t.text);
  const radius = t.radius === 'round' ? '18px' : t.radius === 'soft' ? '8px' : '0px';
  const shadow = t.shadow === 'hard' ? `6px 6px 0 ${t.accent}` : t.shadow === 'glow' ? `0 0 24px ${rgba(t.accent, 0.45)}` : 'none';
  return {
    '--pg': t.page, '--card': t.card, '--text': t.text, '--muted': t.muted, '--line': t.line, '--accent': t.accent, '--on-accent': t.on_accent,
    '--banner': `repeating-linear-gradient(45deg, ${t.banner_a} 0 18px, ${t.banner_b} 18px 36px)`,
    '--head': FONTS[t.font].stack, '--radius': radius, '--shadow': shadow,
    backgroundColor: t.page,
    backgroundImage: t.bg_image ? `url("${t.bg_image}")` : pat.image,
    backgroundSize: t.bg_image ? 'cover' : pat.size,
    backgroundAttachment: t.bg_image ? 'fixed' : undefined,
    backgroundPosition: t.bg_image ? 'center' : undefined,
    color: t.text,
    colorScheme: luminance(t.page) > 0.5 ? 'light' : 'dark',
  } as React.CSSProperties;
}

export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Only the tokens that differ from the preset get stored. */
export function compactTheme(t: Full): ThemeTokens {
  const base = PRESETS[t.preset] || PRESETS.midnight;
  const out: ThemeTokens = { preset: t.preset };
  (Object.keys(t) as (keyof Full)[]).forEach((k) => {
    if (k !== 'preset' && t[k] !== base[k] && t[k] != null) (out as Record<string, unknown>)[k] = t[k];
  });
  return out;
}

export const SECTION_LABELS: Record<string, string> = {
  top: 'Top Friends', about: 'About me', guestbook: 'Guestbook', posts: 'Posts', friends: 'All friends', blog: 'Blog', gifts: 'Gift shelf', poll: 'Poll',
};
export const STICKERS: Record<string, { label: string; bg: string; fg: string }> = {
  glitter: { label: '✶ glitter bomb ✶', bg: '#FFC23D', fg: '#0A0A18' }, star: { label: '★ gold star ★', bg: '#FFE08A', fg: '#0A0A18' },
  heart: { label: '♥ big love ♥', bg: '#FF4FA3', fg: '#0A0A18' }, fire: { label: '~ on fire ~', bg: '#FF8A5C', fg: '#0A0A18' },
  skull: { label: '☠ dead lol ☠', bg: '#EDEBFF', fg: '#0A0A18' }, sparkle: { label: '✧ sparkle ✧', bg: '#D4C2FF', fg: '#0A0A18' },
  rainbow: { label: '≈ rainbow ≈', bg: '#7CF5D0', fg: '#0A0A18' }, music: { label: '♫ certified bop ♫', bg: '#38E1FF', fg: '#0A0A18' },
  crown: { label: '♛ royalty ♛', bg: '#FFC23D', fg: '#0A0A18' }, ghost: { label: '◌ boo ◌', bg: '#C9C6EE', fg: '#0A0A18' },
};
