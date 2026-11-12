export const metadata = { title: 'Terms' };

const CONTACT = process.env.CONTACT_EMAIL || 'support@latenite.social';

export default function Terms() {
  const items: [string, string][] = [
    ['The short version', 'LateNite is a place to make a page, keep up with friends and have fun. Be 18+, be decent, own what you post, and don’t use LateNite to hurt anyone. If you break the rules we can remove content or close your account.'],
    ['Who can join', 'You must be at least 18 years old. One person per account. Keep your password private; you’re responsible for what happens on your account. Give us a real email so we can reach you about your account.'],
    ['Your stuff stays yours', 'You own what you post: text, photos, blogs, themes. To run the site, you give LateNite a non-exclusive, worldwide, royalty-free permission to store, display and share it with the people your privacy settings allow, and to make copies needed to run backups and resize images. That permission ends when you delete the content or your account (copies in backups age out on their own).'],
    ['What you can’t post or do', 'Follow the community rules. No harassment, threats, hate, sexual content involving minors, non-consensual intimate images, spam, scams, impersonation, or anything illegal. Don’t post things you don’t have the rights to. Don’t try to break, overload, scrape or get around the site’s security, and don’t make accounts with bots.'],
    ['Music and other services', 'Profile songs and embeds come from Spotify, YouTube, Apple Music and SoundCloud. They’re played by those services under their own terms. LateNite only stores the link you paste.'],
    ['Moderation', 'People can report anything. Moderators may remove content or suspend accounts that break these terms or the community rules, and we may act faster when someone’s safety is at risk. If you think we got it wrong, email us.'],
    ['Supporting LateNite', 'Contributions through our fundraiser are gifts to help build and run LateNite. They aren’t purchases, investments or ownership, and they don’t come with guaranteed perks. Founding Backers are thanked on the site only if they say it’s OK.'],
    ['It’s a work in progress', 'LateNite is new and run by a small team. We work hard to keep it up and keep your data safe, but the site is provided “as is”, without warranties, and features may change. To the extent the law allows, LateNite isn’t liable for indirect or consequential losses, and our total liability is limited to $100.'],
    ['Leaving, or being asked to leave', 'You can download your data or delete your account any time in Settings → Account & data. We may suspend or close accounts that break these terms. Sections that by their nature should survive (like ownership and liability) still apply afterwards.'],
    ['Changes', 'If we change these terms in a meaningful way, we’ll tell you on the site or by email before the change takes effect. Using LateNite after that means you accept the new terms.'],
    ['Law and contact', `These terms are governed by the laws of the State of Ohio, USA. Questions, takedown requests or appeals: ${CONTACT}.`],
  ];
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="font-display text-5xl font-extrabold">Terms of Service</h1>
      <p className="text-muted">The deal between you and LateNite Social, in plain words.</p>
      {items.map(([t, d]) => <section key={t} className="panel p-5"><h2 className="font-display text-xl font-extrabold">{t}</h2><p className="mt-1 leading-relaxed text-muted">{d}</p></section>)}
      <p className="text-sm text-dim">Plain-language terms for launch. Have a lawyer review them as LateNite grows.</p>
    </div>
  );
}
