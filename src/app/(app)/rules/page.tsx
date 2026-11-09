export const metadata = { title: 'Community rules' };
const RULES = [
  ['18+ only', 'LateNite is for adults. Accounts that appear to belong to someone under 18 are removed.'],
  ['Be decent', 'No harassment, threats, hate speech, or targeting people for who they are.'],
  ['Real people, real activity', 'No fake accounts, bots, impersonation or bought engagement.'],
  ['Respect privacy', 'Don’t post other people’s private info (addresses, phone numbers, private messages) without consent.'],
  ['Your stuff only', 'Only upload photos and music you have the right to share. Profile songs come from licensed services.'],
  ['No sexual content involving anyone without consent — ever', 'And absolutely nothing sexual involving minors. We report it to authorities.'],
  ['Use the tools', 'Block, hide guestbook entries, turn off nudges, and report anything that breaks these rules.'],
];
export default function Rules() {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">Community rules</h1>
      <ol className="flex flex-col gap-4">{RULES.map(([t, d], i) => (
        <li key={t} className="panel flex gap-4 p-5"><span className="pixel text-3xl text-pink">0{i + 1}</span><div><h2 className="font-display text-xl font-extrabold">{t}</h2><p className="mt-1 text-muted">{d}</p></div></li>))}
      </ol>
    </div>
  );
}
