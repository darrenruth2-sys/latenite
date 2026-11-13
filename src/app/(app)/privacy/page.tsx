import Link from 'next/link';
import { LegalDoc, type LegalSection } from '@/components/LegalDoc';
import { CONTACT_EMAIL, LEGAL_ENTITY, MAIL_LINE, PRIVACY_UPDATED } from '@/lib/legal';

export const metadata = { title: 'Privacy Policy' };

const UL = ({ items }: { items: React.ReactNode[] }) => <ul className="flex list-disc flex-col gap-1 pl-5">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>;

export default function Privacy() {
  const S: LegalSection[] = [
    { id: 'collect', title: 'What we collect', body: <>
      <p><b>What you give us:</b></p>
      <UL items={[
        'Account: email, password (stored only as a secure hash, which we can’t read), username, display name and birthday. Your birthday is used only to confirm you’re 18+ and is never shown.',
        'Your page and activity: profile details, photos, banner, theme and CSS, profile song link, posts, comments, reactions, guestbook entries, blogs, bulletins, polls, gifts, communities, Top Friends, moods and settings.',
        'Messages: chats, photos and voice notes you send in Messenger.',
        'Reports and requests you send us, like abuse reports, takedown requests and emails.',
        'Launch list: if you signed the guestbook before launch, your email plus the name and note you chose to give.',
      ]} />
      <p><b>What’s collected automatically:</b></p>
      <UL items={[
        'Activity that runs the site’s features: when you were last online (for green dots and away status), message read receipts, and profile visits (see section 4).',
        'Technical data: our hosting and database providers keep standard server logs (IP address, browser type, time of request) for security and troubleshooting.',
        'Bot protection: our signup and login forms use Cloudflare Turnstile, which checks browser signals to tell people from bots.',
      ]} />
    </> },
    { id: 'use', title: 'How we use it', body: <>
      <UL items={[
        'To run SignedOn: show your page and posts to the people you choose, deliver messages, and keep you logged in.',
        'To keep people safe: enforce our rules, review reports, prevent spam and abuse, and secure accounts.',
        'To contact you about your account (security, password resets, changes to our terms) and, if you’re on the launch list, to tell you when SignedOn opens.',
        'To meet legal obligations, like answering valid legal requests and reporting child exploitation to NCMEC.',
      ]} />
    </> },
    { id: 'dont', title: 'What we don’t do', body: <>
      <UL items={[
        'We don’t sell your personal information or “share” it for targeted advertising.',
        'We don’t run ads profiling or third-party ad trackers, and there’s no algorithm deciding what you see in your friends feed.',
        'We don’t use facial recognition or collect biometric data.',
        'We don’t upload your phone contacts or address book, and we never send invitations in your name.',
        'We never use information you give us for security (like your email for login or account recovery) for marketing.',
        'We never send fake notifications. If SignedOn says someone visited, messaged or signed your guestbook, they really did.',
      ]} />
    </> },
    { id: 'visibility', title: 'Who sees what', body: <>
      <UL items={[
        'Public pages can be seen by anyone, including people who aren’t logged in. Private pages are visible only to your friends. You choose this in Settings → Privacy.',
        'Posts can be Friends, Top Friends or Public. Guestbook entries follow your guestbook settings.',
        'Messages are seen only by the people in the conversation. They aren’t end-to-end encrypted. We don’t read them, but if someone reports a message, our moderators can see that message to review the report.',
        'Profile visits are recorded once per day per person so page owners can see who stopped by. Turn on private browsing and none of your visits are recorded. You also won’t see your own visitors while it’s on.',
        'Photos you upload to your page are stored as public files so they load fast, so anyone with the exact link can open them. Photos sent in Messenger are private and only open for people in that chat.',
      ]} />
    </> },
    { id: 'share', title: 'Who we share it with', body: <>
      <p>We share personal information only:</p>
      <UL items={[
        <>With service providers who run SignedOn for us, under contracts that limit how they use it: Supabase (database, file storage and login), Vercel (web hosting), Cloudflare (bot protection), our email delivery provider, and GoFundMe (only if you visit our fundraiser).</>,
        'With third-party music players (Spotify, YouTube, Apple Music, SoundCloud) when a song player loads. Most load only after you press play, but if a page owner turns on autoplay for a YouTube or SoundCloud song, that player loads when you open their page. You can switch profile autoplay off for yourself on any player.',
        'When the law requires it, like a valid subpoena or court order, or to report child exploitation to NCMEC.',
        'To protect people: when we believe in good faith that someone’s life or safety is at risk.',
        'If SignedOn is ever sold or merged. We’d tell you first, and this policy would keep applying to your information.',
      ]} />
    </> },
    { id: 'retention', title: 'How long we keep it, and deleting it', body: <>
      <UL items={[
        'Delete a post, photo or message and it’s removed from the site right away.',
        'Delete your account (Settings → Account & data) and we delete your profile, posts, comments, guestbook entries, messages you sent, photos you uploaded (including chat photos) and your settings. Backups expire within 30 days.',
        'Exceptions: we keep content and records we’re legally required to preserve. For example, evidence reported to NCMEC must be kept for at least one year. A suspended account can’t delete itself while it’s under review. Email us and we’ll handle it.',
        'Launch list emails are kept until SignedOn opens and you’ve been told, or until you ask us to remove yours. The scrambled anti-spam code made from your network address is deleted within an hour.',
      ]} />
    </> },
    { id: 'rights', title: 'Your choices and rights', body: <>
      <UL items={[
        'Download everything we have about you, any time, from Settings → Account & data. It’s complete: if any section can’t be included, the file says so.',
        'Correct your information in your settings, or ask us to.',
        'Delete your account and data from Settings → Account & data.',
        'Turn on private browsing, make your page private, block people and control your guestbook.',
        'Unsubscribe from non-essential emails with the link in each one. Account and security emails can’t be turned off while you have an account.',
      ]} />
      <p>Depending on where you live, you may have more rights under your state’s privacy law, like asking what we collect or appealing a decision we made about your request. Email {CONTACT_EMAIL} and we’ll answer within 45 days. We won’t treat you differently for using your privacy rights.</p>
    </> },
    { id: 'cookies', title: 'Cookies and local storage', body: <>
      <p>We use only the cookies needed to run the site: your login session and, before launch, a preview pass. Your browser also remembers a few preferences on your device, like whether profile songs should autoplay for you. We don’t use advertising or cross-site tracking cookies, so there’s nothing to opt out of for Do Not Track or Global Privacy Control signals.</p>
    </> },
    { id: 'security', title: 'Security', body: <>
      <p>Connections to SignedOn are encrypted (HTTPS). Passwords are hashed. Database rules make sure people can only read what they’re allowed to see, and accounts are protected by bot checks and rate limits. No system is perfectly secure, though. If a breach ever affects your personal information, we’ll notify you and the authorities as the law requires. Please use a strong, unique password.</p>
    </> },
    { id: 'age', title: '18+ only', body: <>
      <p>SignedOn is only for adults. We don’t knowingly collect information from anyone under 18. If we learn an account belongs to someone under 18, we delete it. If you believe a minor is using SignedOn, report the profile or email {CONTACT_EMAIL}.</p>
    </> },
    { id: 'where', title: 'Where your data lives', body: <>
      <p>SignedOn is run from Ohio, and your information is stored and processed in the United States. SignedOn is meant for people in the United States.</p>
    </> },
    { id: 'changes', title: 'Changes to this policy', body: <>
      <p>If we make a significant change, we’ll tell you on the site or by email before it takes effect. We won’t use information we already have in a significantly different way without asking you first.</p>
    </> },
    { id: 'contact', title: 'Contact', body: <>
      <p>{LEGAL_ENTITY} · {CONTACT_EMAIL} · {MAIL_LINE}. To report content or request a takedown, use the <Link className="link" href="/report-content">report form</Link>.</p>
    </> },
  ];
  return (
    <LegalDoc title="Privacy Policy" updated={PRIVACY_UPDATED}
      intro={<p>What we collect, why, who sees it, and how to take it with you or delete it.</p>}
      summary={[
        'We collect what you put on SignedOn plus what’s needed to run it. That’s it.',
        'No selling your data, no ad trackers, no facial recognition, no contact uploads.',
        'You choose who sees your page and posts. Messages are private to the chat.',
        'Download everything or delete your account any time, and deleting really deletes.',
        '18+ only.',
      ]}
      sections={S} />
  );
}
