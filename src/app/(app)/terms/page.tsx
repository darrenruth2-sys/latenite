import Link from 'next/link';
import { LegalDoc, type LegalSection } from '@/components/LegalDoc';
import { CONTACT_EMAIL, DMCA_AGENT_EMAIL, LEGAL_ENTITY, MAIL_LINE, TERMS_UPDATED } from '@/lib/legal';

export const metadata = { title: 'Terms of Service' };

const UL = ({ items }: { items: string[] }) => <ul className="flex list-disc flex-col gap-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
const Caps = ({ children }: { children: React.ReactNode }) => <p className="font-semibold uppercase tracking-wide text-[var(--text,#EDE8FF)]">{children}</p>;

export default function Terms() {
  const S: LegalSection[] = [
    { id: 'agree', title: 'Agreeing to these terms', body: <>
      <p>These Terms of Service (“Terms”) are an agreement between you and {LEGAL_ENTITY} (“SignedOn,” “we,” “us”). They cover your use of signedon.social and anything else we offer under the SignedOn name (the “Service”).</p>
      <p>By creating an account or using the Service, you agree to these Terms, our <Link className="link" href="/privacy">Privacy Policy</Link>, our <Link className="link" href="/rules">Community Rules</Link> and our <Link className="link" href="/copyright">Copyright Policy</Link>. If you don’t agree, don’t use the Service.</p>
      <p><b>Please read section 20 (Disputes).</b> It requires most disputes to be settled by individual arbitration instead of in court, and it waives class actions. You can opt out within 30 days.</p>
    </> },
    { id: 'eligibility', title: 'Who can use SignedOn', body: <>
      <UL items={[
        'You must be at least 18 years old. SignedOn is for adults only. We don’t knowingly allow anyone under 18, and we close accounts we believe belong to minors.',
        'You must give your real date of birth. Giving a false birthday to get around the age limit breaks these Terms.',
        'You can’t use the Service if we’ve previously banned you, or if the law where you live doesn’t allow you to.',
        'Some U.S. states require social networks to verify every user’s age with documents. Until we offer that, we may not accept new accounts from those states.',
        'One person per account. Accounts are personal, can’t be sold or transferred, and can’t be run by bots.',
      ]} />
    </> },
    { id: 'account', title: 'Your account', body: <>
      <p>Keep your password private and your email current. You’re responsible for what happens on your account. Tell us right away at {CONTACT_EMAIL} if you think someone else got in. We may ask you to verify your identity before helping with account access.</p>
    </> },
    { id: 'content', title: 'Your content', body: <>
      <p><b>You own what you post.</b> Text, photos, blogs, themes, CSS and anything else you put on SignedOn (“Your Content”) stays yours.</p>
      <p><b>The permission you give us.</b> To run the Service, you give SignedOn a worldwide, non-exclusive, royalty-free license to host, store, copy, display, format (for example, resize images) and share Your Content with the people your settings allow. We use this only to operate, improve and promote the Service, never to sell Your Content or use it in ads without asking you first. The license ends when you delete the content or your account, except for (a) copies in backups, which expire on their own, (b) things other people already shared or saved where your settings allowed it, and (c) anything we must keep by law (see section 8).</p>
      <p><b>Your promises about Your Content.</b> You promise you have the rights to post it, that it doesn’t violate anyone else’s rights (copyright, trademark, privacy or publicity), and that it follows these Terms and the Community Rules. You’re responsible for Your Content and the consequences of posting it.</p>
      <p><b>Feedback.</b> If you send ideas or suggestions, we may use them freely without paying you or owing you anything.</p>
    </> },
    { id: 'ours', title: 'SignedOn’s own stuff', body: <>
      <p>The SignedOn name, logo, design, software and site content we create belong to us or our licensors. We give you a limited, personal, revocable, non-transferable permission to use the Service as these Terms allow. Don’t copy, sell or reuse our branding or code, or suggest we endorse you, without our written permission.</p>
    </> },
    { id: 'beta', title: 'Early access and beta features', body: <>
      <p>Parts of SignedOn may be labeled beta, preview or early access, and invite codes may be used to control who gets in. Those features can change or disappear, may have bugs, and are provided as is (see section 17). Invite codes are personal, have no cash value, and can be revoked if misused.</p>
    </> },
    { id: 'rules', title: 'What you can’t do', body: <>
      <p>Follow the <Link className="link" href="/rules">Community Rules</Link>. In particular, you may not use SignedOn to:</p>
      <UL items={[
        'Post or request any sexual content involving minors, or anything that sexualizes, grooms or endangers a child.',
        'Share intimate images or videos of anyone without their consent, including fake or AI-generated ones (“deepfakes”), or threaten to.',
        'Harass, bully, threaten, stalk or dox anyone, or encourage violence or self-harm.',
        'Post hate speech, or content that’s illegal where you are or in the United States.',
        'Impersonate a person, brand or organization, or mislead people about who you are.',
        'Post content you don’t have the rights to, like copyrighted photos or music files.',
        'Spam, scam, phish, run pyramid schemes, or sell things through SignedOn without our permission.',
        'Collect other users’ data, or scrape, crawl or copy the Service with bots.',
        'Hack, overload, probe, reverse-engineer or get around the Service’s security, limits or bans, or create accounts by automated means.',
        'Use bots, scripts or automation to post, message, invite, add friends or collect data. Security research requires our written permission first (email us).',
        'Use custom CSS or anything else to trick people, imitate SignedOn’s login or interface, or hide safety features.',
        'Help or encourage anyone else to do any of these things.',
      ]} />
    </> },
    { id: 'child-safety', title: 'Child safety: zero tolerance', body: <>
      <p>We have zero tolerance for child sexual exploitation. When we learn of apparent child sexual abuse material, we remove it from view, preserve it as the law requires, report it to the National Center for Missing &amp; Exploited Children (NCMEC), and permanently ban the accounts involved. We cooperate with law enforcement. If a child is in immediate danger, call 911. You can also report directly to NCMEC at <a className="link" href="https://report.cybertip.org" target="_blank" rel="noopener noreferrer">report.cybertip.org</a>.</p>
    </> },
    { id: 'ncii', title: 'Intimate images shared without consent', body: <>
      <p>If an intimate image or video of you, real or AI-generated, was posted on SignedOn without your consent, you don’t need an account to ask us to remove it. Use our <Link className="link" href="/report-content?type=intimate_image">removal request form</Link> or email {CONTACT_EMAIL}. We’ll remove the content, and any identical copies we can find, within 48 hours of a valid request, as the federal TAKE IT DOWN Act requires. Accounts that share this content are banned.</p>
    </> },
    { id: 'copyright', title: 'Copyright', body: <>
      <p>We respect copyright and respond to proper notices under the Digital Millennium Copyright Act (DMCA). See our <Link className="link" href="/copyright">Copyright Policy</Link> for how to send a notice or counter-notice. Our copyright agent can be reached at {DMCA_AGENT_EMAIL}. We terminate the accounts of repeat infringers.</p>
    </> },
    { id: 'moderation', title: 'Moderation and enforcement', body: <>
      <p>Anyone can report content. We review reports and may remove or limit content, or warn, suspend or ban accounts, that we believe break these Terms or the Community Rules, or that put people or the Service at risk. We decide in our reasonable judgment, and we may act without notice when safety requires it.</p>
      <p>We don’t review everything before it’s posted and we’re not responsible for what users post. Content on SignedOn comes from its users, not from us. If you think we made a mistake, email {CONTACT_EMAIL} and we’ll take another look.</p>
    </> },
    { id: 'third-party', title: 'Music, embeds and other services', body: <>
      <p>Profile songs and embeds play from third-party services (Spotify, YouTube, Apple Music, SoundCloud). SignedOn only stores the link you paste. Those services play the content under their own terms and privacy policies, and we’re not responsible for them, their content or their availability. The same goes for links to other websites and for our fundraiser page on GoFundMe.</p>
    </> },
    { id: 'customize', title: 'Themes and custom CSS', body: <>
      <p>You can decorate your page with themes, pictures and custom CSS. Customizations only affect your own page and pass through safety filters. We may remove or change any customization that breaks the Service, hurts readability or accessibility, hides safety tools, or breaks these Terms. Themes you share in the gallery can be used by others under the same license as Your Content.</p>
    </> },
    { id: 'support', title: 'Supporting SignedOn', body: <>
      <p>Contributions through our fundraiser are voluntary gifts to help build and run SignedOn. They aren’t purchases, loans, investments, shares or ownership, they don’t earn any return, and they don’t come with guaranteed perks. They are not tax-deductible charitable donations. Payment, refund and fee questions are handled under the fundraising platform’s own terms. Founding Backers are named on the site only with their permission.</p>
    </> },
    { id: 'privacy', title: 'Privacy', body: <>
      <p>Our <Link className="link" href="/privacy">Privacy Policy</Link> explains what we collect and how we use it. By using the Service, you understand that we process your information as described there.</p>
    </> },
    { id: 'changes-service', title: 'Changes to the Service, and keeping your own copies', body: <>
      <p>SignedOn is new and changes often. We may add, change or remove features, and we may suspend or discontinue the Service, with notice where reasonable. If we ever shut down, we’ll give at least 30 days’ notice so you can download your data. We back up the Service, but things can still go wrong, so please keep your own copies of anything important. Settings → Account &amp; data lets you download everything at any time.</p>
    </> },
    { id: 'disclaimers', title: 'Disclaimers', body: <>
      <Caps>The Service is provided “as is” and “as available.” To the fullest extent the law allows, SignedOn disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, title and non-infringement, and any warranty that the Service will be uninterrupted, secure, error-free or free of harmful content.</Caps>
      <p>We don’t control and aren’t responsible for what users say or do, on or off SignedOn. Be careful about what you share and who you meet. Never send money to someone you only know online.</p>
    </> },
    { id: 'liability', title: 'Limitation of liability', body: <>
      <Caps>To the fullest extent the law allows, SignedOn and its owners, team and partners will not be liable for any indirect, incidental, special, consequential, exemplary or punitive damages, or for any lost profits, data, goodwill or use, arising out of or related to the Service or these Terms, even if we were told they were possible.</Caps>
      <Caps>Our total liability for all claims related to the Service or these Terms is limited to the greater of $100 or what you paid us for the Service in the 12 months before the claim.</Caps>
      <p>Some places don’t allow some of these limits, so they apply only as far as your local law permits. Nothing in these Terms limits liability that can’t be limited by law.</p>
    </> },
    { id: 'indemnity', title: 'Your responsibility for claims about your actions', body: <>
      <p>If someone brings a claim against SignedOn because of Your Content, your use of the Service, or your breaking these Terms or anyone’s rights, you agree to defend and indemnify SignedOn, and hold it harmless, from that claim and its related costs, including reasonable attorneys’ fees, to the extent the law allows. We’ll tell you about the claim and may choose to handle our own defense.</p>
    </> },
    { id: 'disputes', title: 'Disputes: talk first, then individual arbitration', body: <>
      <p><b>Talk to us first.</b> Most problems can be fixed quickly. Before filing any claim, email {CONTACT_EMAIL} with your name, contact info, what happened and what you want. We’ll try to resolve it informally within 60 days.</p>
      <p><b>Arbitration.</b> If we can’t resolve it, you and SignedOn agree that any dispute arising out of or relating to these Terms or the Service will be resolved by final, binding, individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, instead of in court. The Federal Arbitration Act governs this section. Arbitration may be held by video or phone, or in the county where you live.</p>
      <p><b>Exceptions.</b> Either of us may bring an individual claim in small-claims court, and either of us may ask a court to stop infringement or misuse of intellectual property.</p>
      <p><b>No class actions.</b> You and SignedOn may bring claims only individually, not as a plaintiff or class member in any class, collective or representative action, and the arbitrator may not combine claims or award class-wide relief. If this waiver is found unenforceable for a claim, that claim goes to court, not to arbitration.</p>
      <p><b>Opting out.</b> You can opt out of this arbitration agreement by emailing {CONTACT_EMAIL} within 30 days after you first accept these Terms, saying you opt out and including your username. Opting out doesn’t change anything else in these Terms.</p>
    </> },
    { id: 'law', title: 'Governing law and where disputes are heard', body: <>
      <p>These Terms are governed by the laws of the State of Ohio and applicable U.S. federal law, without regard to conflict-of-law rules. For anything not covered by arbitration, you and SignedOn agree to the exclusive jurisdiction of the state and federal courts located in Ohio.</p>
    </> },
    { id: 'termination', title: 'Leaving, or being asked to leave', body: <>
      <p>You can delete your account any time in Settings → Account &amp; data. We may suspend or end your access if you break these Terms, if the law requires it, or to protect people or the Service. Sections that by their nature should survive (including ownership, licenses already used, disclaimers, limits of liability, indemnity and disputes) continue to apply after your account ends.</p>
    </> },
    { id: 'changes-terms', title: 'Changes to these Terms', body: <>
      <p>We may update these Terms. If a change is significant, we’ll tell you on the site or by email at least 14 days before it takes effect (unless the change is required by law or fixes a safety problem, in which case it may apply sooner). Changes don’t apply to disputes already in progress. If you keep using SignedOn after a change takes effect, you accept it. If you don’t, you can delete your account.</p>
    </> },
    { id: 'misc', title: 'The fine print', body: <>
      <p>These Terms, together with the policies they link to, are the whole agreement between you and SignedOn about the Service. If any part is found unenforceable, the rest still applies. If we don’t enforce a part right away, we haven’t given up the right to. You can’t transfer these Terms without our permission. We may transfer them as part of a merger, sale or reorganization. Nothing here creates a partnership, employment or agency relationship.</p>
    </> },
    { id: 'contact', title: 'Contact', body: <>
      <p>{LEGAL_ENTITY} · {CONTACT_EMAIL} · {MAIL_LINE}.</p>
    </> },
  ];
  return (
    <LegalDoc title="Terms of Service" updated={TERMS_UPDATED}
      intro={<p>The deal between you and SignedOn Social. We kept it as readable as we could, but it’s still a real agreement.</p>}
      summary={[
        'You must be 18+, give your real birthday, and run one account: yours.',
        'You own what you post. We only use it to run SignedOn, never to sell it or put it in ads.',
        'Be decent. No harassment, hate, scams, stolen content, or sharing intimate images without consent.',
        'Child exploitation means an instant ban and a report to NCMEC. Non-consensual intimate images are removed within 48 hours of a valid request.',
        'SignedOn is new and provided “as is”. Keep copies of what matters, and our liability is limited.',
        'Disputes: talk to us first, then individual arbitration with no class actions. You can opt out within 30 days.',
      ]}
      sections={S} />
  );
}
