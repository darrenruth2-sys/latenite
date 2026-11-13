import Link from 'next/link';

export const metadata = { title: 'Community rules' };

const RULES: [string, React.ReactNode][] = [
  ['18+ only', 'SignedOn is for adults. Give your real birthday. Accounts that appear to belong to someone under 18 are removed. If you think someone is under 18, report their profile.'],
  ['Be decent', 'No harassment, bullying, threats, stalking, or targeting people for who they are (race, ethnicity, religion, gender, sexual orientation, disability and so on). No encouraging self-harm.'],
  ['Zero tolerance for child exploitation', <>Nothing sexual involving anyone under 18. Ever. Not drawings, not “jokes,” not AI. We remove it, preserve it as the law requires, report it to NCMEC and ban the account. If a child is in danger, call 911.</>],
  ['Consent for intimate images', <>Never share nude or sexual images or videos of anyone without their consent, including fakes and AI-generated ones, and never threaten to. If it happened to you, <Link className="link" href="/report-content?type=intimate_image">request removal</Link>, even without an account. We act within 48 hours.</>],
  ['Real people, real activity', 'No fake accounts, bots, impersonation, ban evasion or bought engagement. Parody pages must clearly say they’re parody.'],
  ['Respect privacy', 'Don’t post other people’s private info (addresses, phone numbers, IDs, private messages or photos) without their consent.'],
  ['Your stuff only', <>Only upload photos and art you have the right to share. Profile songs must come from the music services we support. Copyright owners can file a notice under our <Link className="link" href="/copyright">Copyright Policy</Link>. Repeat infringers lose their accounts.</>],
  ['No scams or spam', 'No phishing, fake giveaways, money requests, pyramid schemes, or flooding people with messages and friend requests.'],
  ['Keep it legal', 'Don’t use SignedOn for anything illegal, like selling drugs or weapons, or promoting violence or terrorism.'],
  ['Customize, don’t trick', 'Custom CSS is for decorating your page. Don’t use it to imitate SignedOn’s login, fake buttons, or hide anything that helps people stay safe.'],
  ['Use the tools', 'Block anyone, hide guestbook entries, turn off nudges, make your page private, and report anything that breaks these rules. Reports are confidential.'],
];

export default function Rules() {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">Community rules</h1>
      <p className="text-muted">Breaking these can get content removed or your account suspended or banned. Serious or repeated violations mean a permanent ban, and we report illegal content to the authorities. Full details are in the <Link className="link" href="/terms">Terms</Link>.</p>
      <ol className="flex flex-col gap-4">{RULES.map(([t, d], i) => (
        <li key={t} className="panel flex gap-4 p-5"><span className="pixel text-3xl text-pink">{String(i + 1).padStart(2, '0')}</span><div><h2 className="font-display text-xl font-extrabold">{t}</h2><p className="mt-1 text-muted">{d}</p></div></li>))}
      </ol>
      <p className="text-sm text-dim">Something here that shouldn’t be? <Link className="link" href="/report-content">Report it</Link>.</p>
    </div>
  );
}
