export const metadata = { title: 'Privacy' };
export default function Privacy() {
  const items = [
    ['What we store', 'Your account email, birthday (only to confirm you’re 18+, never shown), what you put on your page, your posts, messages and settings.'],
    ['Who sees what', 'Public pages are visible to anyone; private pages only to friends. Posts can be Friends, Top Friends or Public. Messages are only visible to people in the conversation.'],
    ['Profile visits', 'Visits are recorded once per day per person so the owner can see who stopped by. Turn on private browsing and nothing is recorded — but you won’t see your own visitors either.'],
    ['Music players', 'Profile songs load from Spotify, YouTube, Apple Music or SoundCloud only after you press play. Those services have their own privacy policies.'],
    ['No selling, no ads profiling', 'We don’t sell your data and there’s no algorithm deciding what you see in your friends feed.'],
    ['Launch list', 'If you signed the guestbook before launch, we keep your email (plus the name and note you gave, if any) only to tell you when LateNite opens. It’s never shown publicly or sold. Email us to be removed.'],
    ['Your controls', 'Download everything or delete your account any time from Settings → Account & data.'],
  ];
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">Privacy, in plain words</h1>
      {items.map(([t, d]) => <section key={t} className="panel p-5"><h2 className="font-display text-xl font-extrabold">{t}</h2><p className="mt-1 leading-relaxed text-muted">{d}</p></section>)}
      <p className="text-sm text-dim">This is a plain-language summary for the beta. A full legal policy is needed before public launch.</p>
    </div>
  );
}
