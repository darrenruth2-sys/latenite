import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getUser } from '@/lib/supabase/server';
import { ClaimForm } from './ClaimForm';

const FEATURES = [
  { n: '01', c: '#FF4FA3', t: 'Top Friends', d: 'Top 4, 8, 12 or 16. Drag to rank. Yes, people will notice. You can hide the order if you’d rather keep the peace.' },
  { n: '02', c: '#38E1FF', t: 'Profile songs', d: 'Pick a song for your page from Spotify, YouTube, Apple Music or SoundCloud. Visitors press play — no surprise autoplay.' },
  { n: '03', c: '#5CFF8A', t: 'Who’s been by', d: 'See recent visitors and your visit count. Browse privately whenever you want — and the rules are the same for everyone.' },
  { n: '04', c: '#FFC23D', t: 'The guestbook', d: 'Leave messages, stickers and pics on a friend’s page. Owners can hide or delete anything, any time.' },
  { n: '05', c: '#9B7BFF', t: 'Messenger', d: 'Buddy list, away messages, custom status and the nudge. Rate-limited so it stays fun, and you can switch nudges off.' },
  { n: '06', c: '#FF8A5C', t: 'Blogs', d: 'Long posts, poetry, 2am thoughts. Drafts, privacy settings and your own blog theme.' },
];
const RULES = ['Your main feed is your friends, newest first.', 'No streaks. No guilt notifications.', 'No fake activity. Every visit and like is real.',
  'Discovery is opt-in, for you and for your page.', 'Export or delete your data in one click.'];

export default async function Home() {
  const { user } = await getUser();
  if (user) redirect('/feed');
  return (
    <div className="bg-dots min-h-dvh">
      <header className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-3 px-4 py-5 sm:px-6">
        <Logo size="lg" cursor />
        <nav aria-label="Main" className="hidden flex-1 gap-6 text-[15px] font-medium text-muted sm:flex">
          <a href="#features" className="hover:text-fg">Features</a><a href="#rules" className="hover:text-fg">House rules</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login" className="btn-ghost whitespace-nowrap border-transparent">Log in</Link>
          <Link href="/signup" className="btn-pink whitespace-nowrap"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Get your page</span></Link>
        </div>
      </header>
      <main id="main">
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-2 lg:pt-14">
          <div className="flex flex-col gap-6">
            <p className="pixel text-[22px] tracking-wide text-lime">&gt; EST. 2026 · NO ALGORITHM INCLUDED</p>
            <h1 className="font-display text-[clamp(48px,7vw,92px)] font-extrabold leading-[0.92] tracking-[-0.04em]">
              Your profile.<br />Your music.<br />Your friends.<br /><span className="text-pink">Your internet.</span>
            </h1>
            <p className="max-w-[520px] text-[19px] leading-relaxed text-muted">The social network that remembers when the internet was fun. Build a page that&apos;s actually yours, rank your Top 8, sign the guestbook, and nudge your friends until they answer.</p>
            <ClaimForm />
          </div>
          <HeroCollage />
        </section>
        <section id="features" className="mx-auto flex max-w-[1200px] flex-col gap-9 px-4 pb-24 sm:px-6">
          <h2 className="max-w-[820px] font-display text-[clamp(34px,4.5vw,56px)] font-extrabold leading-none tracking-[-0.03em]">Everything you missed about the old internet. <span className="text-dim">None of what you didn&apos;t.</span></h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.n} className="group flex flex-col gap-3 border-2 border-line bg-panel p-6 transition-transform hover:-translate-y-1 hover:border-pink">
                <div className="flex items-center justify-between"><span className="pixel text-[28px]" style={{ color: f.c }}>{f.n}</span><span className="h-3 w-3" style={{ background: f.c }} /></div>
                <h3 className="font-display text-[26px] font-extrabold tracking-tight">{f.t}</h3>
                <p className="leading-relaxed text-muted">{f.d}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="rules" className="border-y-4 border-ink bg-pink text-ink">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="pixel text-2xl">&gt; THE HOUSE RULES</p>
              <h2 className="font-display text-[clamp(38px,5vw,64px)] font-extrabold leading-[0.95] tracking-[-0.04em]">We built it the way we wish they still did.</h2>
            </div>
            <ol className="flex flex-col">
              {RULES.map((r, i) => (
                <li key={r} className="flex items-baseline gap-4 border-b-2 border-ink py-3.5 text-xl font-semibold"><span className="pixel text-[26px]">0{i + 1}</span>{r}</li>
              ))}
            </ol>
          </div>
        </section>
        <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/signedon-logo.png" alt="SignedOn Social" width="1400" height="472" className="h-auto w-[320px] sm:w-[420px]" />
          <h2 className="font-display text-[clamp(40px,6vw,78px)] font-extrabold leading-[0.95] tracking-[-0.04em]">Your page is waiting.<br /><span className="text-cyan">Bring your friends.</span></h2>
          <p className="max-w-[560px] text-lg text-muted">Free to join. Adults 18+. Your feed is your friends, newest first — and that&apos;s the whole trick.</p>
          <Link href="/signup" className="btn-cyan px-8 text-lg">Get your page</Link>
        </section>
      </main>
      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-7 gap-y-3 px-4 py-7 text-sm text-dim sm:px-6">
          <span className="pixel text-lg">© 2026 SIGNEDON</span>
          <Link href="/terms" className="hover:text-fg">Terms</Link><Link href="/privacy" className="hover:text-fg">Privacy</Link><Link href="/rules" className="hover:text-fg">Community rules</Link>
        </div>
      </footer>
    </div>
  );
}

function HeroCollage() {
  const top = [['KX', '#38E1FF'], ['DS', '#FF4FA3'], ['MR', '#9B7BFF'], ['T8', '#5CFF8A'], ['BB', '#FFC23D'], ['LQ', '#FF8A5C'], ['RW', '#C9C6EE'], ['PZ', '#7CF5D0']];
  return (
    <div aria-hidden="true" className="relative mx-auto h-[420px] w-full max-w-[600px] sm:h-[540px]">
      <p className="absolute -top-6 right-0 pixel text-base text-dim">example page</p>
      <div className="absolute left-0 top-2 w-[300px] -rotate-3 border-2 border-pink bg-[#1B1033] shadow-[10px_10px_0_#FF4FA3] sm:w-[360px]">
        <div className="h-20 bg-[repeating-linear-gradient(45deg,#2B0F4D_0_14px,#3A1466_14px_28px)]" />
        <div className="-mt-10 flex flex-col gap-3 px-5 pb-5">
          <div className="flex items-end gap-3.5">
            <div className="relative flex h-20 w-20 items-center justify-center border-4 border-[#1B1033] bg-amber font-display text-3xl font-extrabold text-[#1B1033]">JM
              <span className="absolute -bottom-1.5 -right-1.5 h-4 w-4 animate-pulse-online rounded-full border-[3px] border-[#1B1033] bg-lime" /></div>
            <div className="pb-1"><div className="font-display text-xl font-extrabold">jules</div><div className="pixel text-lg text-amber">mood: nostalgic</div></div>
          </div>
          <div className="pixel text-lg text-dim">TOP 8</div>
          <div className="grid grid-cols-4 gap-2">{top.map(([i, c]) => <div key={i} className="flex aspect-square items-center justify-center font-display font-extrabold text-ink" style={{ background: c }}>{i}</div>)}</div>
        </div>
      </div>
      <div className="absolute right-0 top-[230px] w-[260px] rotate-2 border-2 border-ink bg-fg text-ink shadow-[8px_8px_0_#38E1FF] sm:top-[250px] sm:w-[300px]">
        <div className="flex items-center justify-between bg-cyan px-3 py-2 text-[13px] font-bold"><span>kayla.exe</span><span className="pixel text-lg">— □ ×</span></div>
        <div className="flex flex-col gap-2 p-3.5 text-sm">
          <div><b className="text-[#8A1F5B]">kayla.exe says:</b><br />ok who is the new #2 in ur top 8 ??</div>
          <div className="border border-dashed border-pink bg-[#FFE3F1] px-2 py-1.5 pixel text-lg text-[#8A1F5B]">kayla.exe just sent you a nudge!</div>
        </div>
      </div>
    </div>
  );
}
