import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { GuestbookForm } from './GuestbookForm';
import { Countdown } from './Countdown';
import { GoFundMeWidget } from './GoFundMe';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: 'SignedOn Social — opening Jan 4, 2027' },
  description: 'Whoa, you’re early. SignedOn is a nostalgic new social network — custom profiles, Top 8, guestbooks, away messages and nudges. Doors open Monday, January 4, 2027.',
};

const safeUrl = (v?: string) => (v && /^https:\/\/[^\s"'<>]+$/.test(v) ? v : null);
const gfmUrl = (v?: string) => (v && /^https:\/\/(www\.)?gofundme\.com\/f\/[A-Za-z0-9_-]+\/?$/.test(v) ? v.replace(/^https:\/\/gofundme/, 'https://www.gofundme') : null);
const usd = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
type Backer = { id: string; name: string; note: string | null; amount_usd: number | null; created_at: string; total: number };

const FEATURES = [
  ['CUSTOM PROFILES', '#FF4FA3'], ['PROFILE SONGS', '#38E1FF'], ['TOP 8 DRAMA', '#9B7BFF'], ['GUESTBOOKS', '#5CFF8A'],
  ['AWAY MESSAGES', '#FFC23D'], ['NUDGES', '#FF8A5C'], ['BLOGS', '#38E1FF'], ['BULLETINS', '#FF4FA3'],
] as const;

export default async function ComingSoon() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('waitlist_count');
  const count = Number(data ?? 0);
  const { data: backerRows } = await supabase.rpc('recent_backers', { p_limit: 12 });
  const backers = (backerRows ?? []) as Backer[];
  const launchAt = process.env.LAUNCH_AT || '2027-01-04T00:00:00-05:00';
  const gofundme = gfmUrl(process.env.GOFUNDME_URL);

  const discord = safeUrl(process.env.DISCORD_URL);
  const support = safeUrl(process.env.SUPPORT_URL) || gofundme;
  const supportLabel = (process.env.SUPPORT_LABEL || (gofundme && !process.env.SUPPORT_URL ? 'Donate on GoFundMe' : 'Back the project')).slice(0, 40);
  const email = process.env.CONTACT_EMAIL || 'darrenruth2@gmail.com';

  return (
    <div className="bg-dots min-h-dvh">
      {/* under construction tape */}
      <header className="overflow-hidden border-b-4 border-ink bg-[repeating-linear-gradient(-45deg,#FFC23D_0_22px,#0a0a18_22px_44px)] py-1.5">
        <p className="mx-auto w-fit bg-ink px-4 py-1 pixel text-lg tracking-widest text-amber sm:text-xl">⚠ UNDER CONSTRUCTION ⚠<span className="hidden sm:inline"> PARDON OUR DUST ⚠</span></p>
      </header>

      <main id="main" className="mx-auto flex max-w-[1100px] flex-col gap-16 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        {/* hero */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/signedon-logo.png" alt="SignedOn Social" width="1400" height="472" className="h-auto w-[300px] sm:w-[440px]" />
            <p className="pixel text-[22px] tracking-wide text-lime">&gt; CONNECTING… <span className="animate-blink">█</span></p>
            <h1 className="font-display text-[clamp(44px,7vw,84px)] font-extrabold leading-[0.92] tracking-[-0.04em]">
              Whoa.<br />You&apos;re a little <span className="text-pink">early.</span>
            </h1>
            <p className="max-w-[540px] text-[19px] leading-relaxed text-muted">
              You found us before the doors opened. SignedOn Social is a new social network built like the ones we grew up on — custom pages,
              profile songs, Top 8, guestbooks, away messages and the nudge. Your feed is just your friends, newest first.
            </p>
            <div className="flex flex-wrap items-stretch gap-3">
              <div className="flex flex-col justify-center border-2 border-fg bg-pink px-5 py-2 text-ink shadow-[6px_6px_0_#9B7BFF]">
                <span className="pixel text-xl leading-none">DOORS OPEN</span>
                <span className="font-display text-3xl font-extrabold leading-none tracking-tight">JAN 4, 2027</span>
              </div>
              <div className="flex flex-col justify-center border-2 border-line px-5 py-2">
                <span className="pixel text-xl leading-none text-dim">AT</span>
                <span className="font-display text-3xl font-extrabold leading-none tracking-tight">signedon.social</span>
              </div>
            </div>
            <Countdown target={launchAt} label="MON · JAN 4 · 2027" />
          </div>

          {/* away message window */}
          <div aria-label="Away message" role="figure" className="mx-auto w-full max-w-[440px] rotate-1 border-2 border-ink bg-paper text-plum shadow-[10px_10px_0_#38E1FF]">
            <div className="flex items-center justify-between bg-cyan px-3 py-2 text-sm font-bold text-ink">
              <span>Away Message — SignedOn</span><span className="pixel text-xl" aria-hidden="true">— □ ×</span>
            </div>
            <div className="flex flex-col gap-3 p-4 text-[15px] leading-relaxed">
              <p><b className="text-[#A1125C]">Auto response from SignedOn:</b></p>
              <p className="font-mono text-[14px]">brb ~ building the internet u remember ♡<br />back mon jan 4th. sign my guestbook while u wait ;)</p>
              <p className="w-fit border border-dashed border-pink bg-[#FFE3F1] px-2 py-1 pixel text-lg text-[#A1125C]">SignedOn sent you a nudge!</p>
              <div className="flex items-center gap-2 border-t border-[#d8d4f0] pt-3 text-[13px] text-[#5b5480]">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber" aria-hidden="true" />
                <span>Status: <b>Away</b> · ♫ now playing: the dial-up sound</span>
              </div>
            </div>
          </div>
        </section>

        {/* feature marquee */}
        <section aria-label="What’s coming" className="-mx-4 overflow-hidden border-y-2 border-line py-3 sm:-mx-6">
          <div className="flex w-max gap-3 motion-safe:animate-[marquee_28s_linear_infinite]">
            {[...FEATURES, ...FEATURES].map(([t, c], i) => (
              <span key={i} aria-hidden={i >= FEATURES.length} className="border-2 px-3 py-1 pixel text-2xl whitespace-nowrap" style={{ borderColor: c, color: c }}>★ {t}</span>
            ))}
          </div>
        </section>

        {/* guestbook / waitlist */}
        <section className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col gap-3">
            <p className="pixel text-2xl text-cyan">&gt; SIGN MY GUESTBOOK</p>
            <h2 className="font-display text-[clamp(32px,4.5vw,52px)] font-extrabold leading-[0.95] tracking-[-0.03em]">Be here on day one.</h2>
            <p className="text-lg leading-relaxed text-muted">Drop your email and we&apos;ll tell you the second SignedOn opens — so you can grab your username before someone else does.</p>
          </div>
          <div className="panel-hard p-5 sm:p-7"><GuestbookForm initialCount={count} /></div>
        </section>

        {/* be part of history */}
        <section className="border-4 border-ink bg-violet p-6 text-ink sm:p-10">
          <div className={gofundme ? 'grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start' : ''}>
          <div>
          <p className="pixel text-2xl">&gt; WANNA BE PART OF HISTORY?</p>
          <h2 className="mt-2 max-w-[760px] font-display text-[clamp(32px,4.5vw,56px)] font-extrabold leading-[0.95] tracking-[-0.03em]">Help bring the fun internet back.</h2>
          <p className="mt-4 max-w-[720px] text-lg font-medium leading-relaxed">
            SignedOn is independent — no big tech, no ad algorithm, built by one person who misses the old internet as much as you do.
            Hang out with the early crew, share ideas, or chip in to help it launch.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {discord && <a href={discord} target="_blank" rel="noopener noreferrer" className="btn border-ink bg-ink px-6 text-lg text-fg hover:shadow-[4px_4px_0_#FF4FA3]">Join the Discord</a>}
            {support && <a href={support} target="_blank" rel="noopener noreferrer" className="btn border-ink bg-pink px-6 text-lg text-ink hover:shadow-[4px_4px_0_#0a0a18]">{supportLabel}</a>}
            <a href={`mailto:${email}?subject=${encodeURIComponent('SignedOn Social')}`} className="btn border-ink bg-paper px-6 text-lg text-ink hover:shadow-[4px_4px_0_#0a0a18]">Email the founder</a>
          </div>
          </div>
          {gofundme && (
            <div className="border-2 border-ink bg-paper shadow-[8px_8px_0_#0a0a18]">
              <div className="flex items-center justify-between bg-pink px-3 py-2 text-sm font-bold text-ink">
                <span>fundraiser.exe — live from GoFundMe</span><span className="pixel text-xl" aria-hidden="true">— □ ×</span>
              </div>
              <GoFundMeWidget url={gofundme} />
            </div>
          )}
          </div>

          {(gofundme || backers.length > 0) && (
            <div className="mt-10 border-t-4 border-ink pt-6">
              <p className="pixel text-2xl">&gt; FOUNDING BACKERS {backers.length > 0 && <span>({Number(backers[0].total).toLocaleString('en-US')})</span>}</p>
              {backers.length === 0 ? (
                <p className="mt-2 text-lg font-medium">No names on the wall yet. Back SignedOn and yours could be the first — founding backers get thanked here forever.</p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {backers.map((b) => (
                    <li key={b.id} className="border-2 border-ink bg-paper p-3 text-plum">
                      <p className="flex items-baseline justify-between gap-2">
                        <b className="truncate">{b.name}</b>
                        {b.amount_usd !== null && <span className="pixel text-xl text-[#A1125C]">{usd(Number(b.amount_usd))}</span>}
                      </p>
                      {b.note && <p className="mt-1 text-sm text-[#5b5480]">&ldquo;{b.note}&rdquo;</p>}
                      <p className="mt-1 pixel text-base text-[#5b5480]">
                        {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* founder note */}
        <section className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="flex h-24 w-24 items-center justify-center border-4 border-pink bg-amber font-display text-4xl font-extrabold text-plum" aria-hidden="true">DR</div>
          <div className="flex flex-col gap-2">
            <p className="pixel text-xl text-dim">A NOTE FROM THE FOUNDER</p>
            <p className="max-w-[720px] text-lg leading-relaxed text-muted">
              Hey — I&apos;m Darren Rutherford, the founder and developer of SignedOn. Got a question, an idea, a feature you miss from the old days,
              or want to help out? I read everything: <a className="link" href={`mailto:${email}`}>{email}</a>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-dim sm:px-6">
          <span className="pixel text-lg">© {new Date().getFullYear()} SIGNEDON SOCIAL</span>
          <span>Founded &amp; developed by Darren Rutherford</span>
          <span className="pixel text-lg">BEST VIEWED AT 1024×768</span>
          <a href="/terms" className="hover:text-fg">Terms</a>
          <a href="/privacy" className="hover:text-fg">Privacy</a>
          <a href="/copyright" className="hover:text-fg">Copyright</a>
          <a href="/report-content" className="hover:text-fg">Report content</a>
          <span className="pixel text-lg">ADULTS 18+</span>
        </div>
      </footer>
    </div>
  );
}
