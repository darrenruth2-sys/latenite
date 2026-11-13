import Link from 'next/link';
import { LegalDoc, type LegalSection } from '@/components/LegalDoc';
import { DMCA_AGENT_EMAIL, DMCA_AGENT_NAME, LEGAL_ADDRESS, LEGAL_ENTITY, TERMS_UPDATED } from '@/lib/legal';

export const metadata = { title: 'Copyright Policy' };

const OL = ({ items }: { items: string[] }) => <ol className="flex list-decimal flex-col gap-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ol>;

export default function Copyright() {
  const S: LegalSection[] = [
    { id: 'policy', title: 'Our policy', body: <>
      <p>SignedOn respects the rights of creators. Users may only post content they own or have permission to share. We respond to clear notices of alleged copyright infringement under the Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512. Profile songs are links to licensed music services (Spotify, YouTube, Apple Music, SoundCloud). SignedOn doesn’t host song files.</p>
    </> },
    { id: 'notice', title: 'Reporting infringement (DMCA notice)', body: <>
      <p>If you believe content on SignedOn infringes a copyright you own or are authorized to act for, send a notice to our designated agent through the <Link className="link" href="/report-content?type=copyright">report form</Link> or by email. Your notice must include:</p>
      <OL items={[
        'Your physical or electronic signature.',
        'A description of the copyrighted work you believe was infringed.',
        'The link(s) to the material on SignedOn that you want removed, specific enough for us to find it.',
        'Your name, address, phone number and email.',
        'A statement that you have a good-faith belief the use isn’t authorized by the copyright owner, its agent, or the law.',
        'A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner’s behalf.',
      ]} />
      <p>When we receive a valid notice, we remove or disable the material quickly and tell the person who posted it.</p>
    </> },
    { id: 'counter', title: 'If your content was removed (counter-notice)', body: <>
      <p>If you believe your content was removed by mistake or misidentification, you can send a counter-notice to our agent that includes:</p>
      <OL items={[
        'Your physical or electronic signature.',
        'A description of the removed material and where it appeared before removal.',
        'A statement, under penalty of perjury, that you have a good-faith belief the material was removed by mistake or misidentification.',
        'Your name, address and phone number, and a statement that you consent to the jurisdiction of the federal district court for your address (or, if you’re outside the U.S., any district where SignedOn may be found), and that you’ll accept service of process from the person who sent the original notice.',
      ]} />
      <p>We’ll forward a valid counter-notice to the person who filed the original notice. Unless they tell us within 10 business days that they’ve filed a court action, we may restore the material 10 to 14 business days after we received your counter-notice.</p>
    </> },
    { id: 'false', title: 'False claims', body: <>
      <p>Under 17 U.S.C. § 512(f), anyone who knowingly makes a material misrepresentation in a notice or counter-notice may be liable for damages. If you’re not sure whether something infringes your rights, consider talking to a lawyer first.</p>
    </> },
    { id: 'repeat', title: 'Repeat infringers', body: <>
      <p>We terminate, in appropriate circumstances, the accounts of users who repeatedly infringe copyrights. As a rule, an account that gets three valid copyright strikes is closed, and we may act sooner for clear or willful infringement.</p>
    </> },
    { id: 'agent', title: 'Our designated copyright agent', body: <>
      <p>{DMCA_AGENT_NAME}<br />{LEGAL_ENTITY}<br />{LEGAL_ADDRESS || 'Mailing address available on request'}<br />Email: <a className="link" href={`mailto:${DMCA_AGENT_EMAIL}`}>{DMCA_AGENT_EMAIL}</a></p>
      <p>This agent handles copyright notices only. For other problems, use the <Link className="link" href="/report-content">report form</Link>.</p>
    </> },
  ];
  return (
    <LegalDoc title="Copyright Policy" updated={TERMS_UPDATED}
      intro={<p>How to report copyright infringement on SignedOn, and what to do if your content was taken down.</p>}
      sections={S} />
  );
}
