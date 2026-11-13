// One place for the legal details shown across Terms, Privacy, Copyright and the takedown page.
// Set these in Vercel → Settings → Environment Variables once Darren decides them (see the legal playbook):
//   LEGAL_ENTITY      the business that runs SignedOn (e.g. an LLC). Until set, the founder is named.
//   LEGAL_ADDRESS     a mailing address (a PO box is fine) for legal notices and copyright notices.
//   DMCA_AGENT_NAME   the copyright agent registered with the U.S. Copyright Office.
//   DMCA_AGENT_EMAIL  where copyright notices go (defaults to the contact email).
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'support@signedon.social';
export const LEGAL_ENTITY = process.env.LEGAL_ENTITY || 'Darren Rutherford, doing business as SignedOn Social';
export const LEGAL_ADDRESS = process.env.LEGAL_ADDRESS || '';
export const DMCA_AGENT_NAME = process.env.DMCA_AGENT_NAME || 'Copyright Agent, SignedOn Social';
export const DMCA_AGENT_EMAIL = process.env.DMCA_AGENT_EMAIL || CONTACT_EMAIL;
export const TERMS_UPDATED = 'November 13, 2026';
export const PRIVACY_UPDATED = 'November 13, 2026';
export const MAIL_LINE = LEGAL_ADDRESS ? `by mail at ${LEGAL_ADDRESS}` : 'by mail at the address we’ll give you on request';
