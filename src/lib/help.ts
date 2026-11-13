// The help bot's answers. Plain list, no AI: it can't make things up, and it costs nothing.
// {me} in a link becomes the signed-in person's username.
export type HelpEntry = { q: string; keys: string[]; a: string; links?: [string, string][] };

export const HELP: HelpEntry[] = [
  { q: 'How do I change my profile song?', keys: ['song', 'music', 'profile song', 'change song', 'add song', 'spotify', 'youtube', 'apple music', 'playlist'],
    a: 'Open your page, tap “Customize my page”, then go to Profile song. Search for a song and tap Use. Songs from the search play automatically when people visit. You can also paste a Spotify song link (visitors press play on those).',
    links: [['Customize my page', '/u/{me}?edit=1']] },
  { q: 'How do I stop songs from autoplaying?', keys: ['autoplay', 'stop music', 'mute', 'turn off music', 'too loud', 'annoying song', 'sound'],
    a: 'Under any profile song, tap “Stop autoplay on profiles”. That turns autoplay off for you on every page. For your own page, uncheck “Play automatically” in Customize my page.' },
  { q: 'How do I customize my page?', keys: ['customize', 'theme', 'colors', 'color', 'background', 'font', 'css', 'layout', 'decorate', 'design', 'pattern', 'edit page'],
    a: 'Open your page and tap “Customize my page”. Pick a theme, colors, fonts and patterns, upload a background, move sections around, or write your own CSS. Changes preview live; nobody sees them until you save.',
    links: [['Customize my page', '/u/{me}?edit=1'], ['Theme gallery', '/themes']] },
  { q: 'How do I change my profile picture or cover photo?', keys: ['profile picture', 'avatar', 'photo', 'pic', 'cover', 'banner', 'header image', 'reposition'],
    a: 'Go to Settings → Edit profile. Upload a profile picture and a cover photo. Drag the cover photo to move it, then tap “Save position”.',
    links: [['Edit profile', '/settings/profile']] },
  { q: 'How do I set my Top 8?', keys: ['top 8', 'top8', 'top friends', 'best friends', 'rank', 'order friends'],
    a: 'Open your page → Customize my page → Top friends. Add people and drag them into order (or use the arrow keys). You can show 4, 8, 12 or 16.',
    links: [['Customize my page', '/u/{me}?edit=1']] },
  { q: 'How do I find and add friends?', keys: ['add friend', 'friend request', 'find people', 'search people', 'find friends', 'follow', 'discover', 'meet people'],
    a: 'Search for someone in the top bar or browse Discover people. On their page, tap “Add friend”. When they accept, you’re friends. See your requests on the Friends page.',
    links: [['Discover people', '/discover'], ['Friends', '/friends']] },
  { q: 'How do I block someone?', keys: ['block', 'blocked', 'harass', 'leave me alone', 'stop messaging', 'creep', 'unblock'],
    a: 'Go to their page and tap Block. They can’t see your page, message you or sign your guestbook, and you won’t see them. To undo it, go to Settings → Privacy & safety → Blocked people.',
    links: [['Privacy & safety', '/settings/privacy']] },
  { q: 'How do I report something?', keys: ['report', 'abuse', 'spam', 'fake account', 'inappropriate', 'nude', 'harassment', 'threat', 'scam'],
    a: 'Tap Report on the post, comment, page, message or song. A moderator reviews every report. For intimate images shared without consent, child safety or copyright, use the Report content form (no account needed).',
    links: [['Report content form', '/report-content'], ['Community rules', '/rules']] },
  { q: 'How do I make my page private?', keys: ['private', 'privacy', 'hide my page', 'friends only', 'public', 'who can see'],
    a: 'Go to Settings → Privacy & safety → Your page and turn on private. Then only friends see your page and posts.',
    links: [['Privacy & safety', '/settings/privacy']] },
  { q: 'Who’s been looking at my page?', keys: ['visitors', 'who viewed', 'views', 'who visited', 'browse privately', 'stalk', 'been by'],
    a: 'Your page shows who stopped by. If you’d rather your own visits weren’t recorded, turn on “Browse privately” in Settings → Privacy & safety → Who’s been by. Same rule for everyone: then you can’t see your visitors either.',
    links: [['Privacy & safety', '/settings/privacy']] },
  { q: 'How does Messenger work?', keys: ['messenger', 'message', 'chat', 'dm', 'away message', 'status', 'nudge', 'buddy list', 'group chat', 'online', 'invisible'],
    a: 'Open Messenger to see your buddy list. Set your status (online, away, busy or appear offline) and an away message. Send photos and voice notes, start group chats, and send a nudge to shake their window.',
    links: [['Open Messenger', '/messenger']] },
  { q: 'How do I show what I’m listening to?', keys: ['now listening', 'now playing', 'last.fm', 'lastfm', 'scrobble', 'listening'],
    a: 'Make a free Last.fm account and connect your Spotify (or a scrobbler app for Apple Music or YouTube Music). Then put your Last.fm username in Settings → Edit profile → Now listening. You can listen invisibly any time.',
    links: [['Edit profile', '/settings/profile']] },
  { q: 'How do I write a blog post?', keys: ['blog', 'write', 'journal', 'diary', 'long post'],
    a: 'Tap New blog post, write it, and choose who can see it. Your blog lives on your page.',
    links: [['New blog post', '/blog/new']] },
  { q: 'What are bulletins?', keys: ['bulletin', 'bulletins', 'announce', 'post to everyone'],
    a: 'Bulletins are short posts that go out to all your friends at once and disappear after a while. Old-school MySpace style.',
    links: [['Bulletins', '/bulletins']] },
  { q: 'What is SignedOn HQ?', keys: ['hq', 'signedon hq', 'announcements', 'news', 'updates', 'community', 'communities', 'group', 'club'],
    a: 'SignedOn HQ is the official community: news from Darren, bug threads and what’s coming next. Everyone starts in it. You can also start your own community for your dorm, team or club.',
    links: [['SignedOn HQ', '/communities/signedon-hq'], ['All communities', '/communities']] },
  { q: 'How do I sign a guestbook?', keys: ['guestbook', 'sign', 'comment on page', 'sticker', 'leave a note'],
    a: 'Go to a friend’s page and scroll to their guestbook. Write a note, add a sticker or a picture. You choose who can sign yours in Customize my page → Who can sign.' },
  { q: 'How do I set my mood?', keys: ['mood', 'feeling', 'emoji status'],
    a: 'Set your mood in Settings → Edit profile, or in Customize my page. It shows on your page and next to your name.',
    links: [['Edit profile', '/settings/profile']] },
  { q: 'How do I change my password?', keys: ['password', 'change password', 'security'],
    a: 'Go to Settings → Account & data → Change password. If you forgot it, use “Forgot password” on the login page.',
    links: [['Account & data', '/settings/account'], ['Forgot password', '/forgot']] },
  { q: 'Can I download my data?', keys: ['download', 'export', 'my data', 'copy of my data', 'backup'],
    a: 'Yes. Settings → Account & data → Download my data gives you everything as a file.',
    links: [['Account & data', '/settings/account']] },
  { q: 'How do I delete my account?', keys: ['delete account', 'delete', 'remove account', 'close account', 'leave signedon', 'deactivate'],
    a: 'Settings → Account & data → Delete account. It permanently deletes your page, posts, photos and messages you sent. Download your data first if you want a copy.',
    links: [['Account & data', '/settings/account']] },
  { q: 'Why was my post hidden?', keys: ['hidden', 'removed', 'taken down', 'deleted my post', 'sentinel', 'banned', 'suspended', 'appeal'],
    a: 'New posts are checked automatically for things that break the community rules. If something looked like it might, it’s hidden until a moderator looks. If it was fine, it comes back. Think it was a mistake? Send a note through Ideas & questions.',
    links: [['Community rules', '/rules'], ['Ideas & questions', '/feedback']] },
  { q: 'How do I invite my friends?', keys: ['invite', 'invite code', 'code', 'key', 'beta', 'get my friends on', 'join'],
    a: 'SignedOn is invite-only during the beta. Ask for codes in SignedOn HQ and Darren will hand them out. The doors open to everyone on January 4, 2027.',
    links: [['SignedOn HQ', '/communities/signedon-hq']] },
  { q: 'Is there an algorithm or ads?', keys: ['algorithm', 'ads', 'advertising', 'feed order', 'sell my data', 'tracking'],
    a: 'No. Your feed is just your friends, newest first. No ads, no ad trackers, and we don’t sell your data.',
    links: [['Privacy policy', '/privacy']] },
  { q: 'Can I video chat?', keys: ['video', 'facetime', 'video call', 'call', 'voice call', 'webcam'],
    a: 'Not yet! It’s on the wish list. Tell Darren you want it in Ideas & questions; the most-asked-for ideas get built first.',
    links: [['Ideas & questions', '/feedback']] },
  { q: 'Something’s broken', keys: ['bug', 'broken', 'not working', 'error', 'glitch', 'crash', 'doesnt work', 'problem'],
    a: 'Sorry about that! Send it through Ideas & questions and pick “Something’s broken”. Say what you tapped and what happened. Darren reads every one.',
    links: [['Report a bug', '/feedback']] },
  { q: 'Who made SignedOn?', keys: ['who made', 'founder', 'darren', 'who built', 'who owns', 'about'],
    a: 'SignedOn was built by Darren Rutherford, a self-taught developer from New Concord, Ohio, who missed the fun internet.' },
  { q: 'Who can join?', keys: ['age', '18', 'kids', 'teen', 'minimum age', 'old enough'],
    a: 'SignedOn is for adults 18 and up only.', links: [['Terms', '/terms']] },
];

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9.+ ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['how', 'do', 'i', 'my', 'a', 'the', 'to', 'can', 'is', 'what', 'where', 'on', 'it', 'me', 'and', 'of', 'in', 'for', 'there', 'an', 'why', 'does', 'you', 'get', 'with', 'this', 'are', 'was', 'be']);

/** Best matches for a question: whole key phrases count most, single words a little. */
export function findHelp(question: string, limit = 3): HelpEntry[] {
  const q = ` ${norm(question)} `;
  const words = q.split(' ').filter((w) => w && !STOP.has(w));
  if (!words.length) return [];
  return HELP.map((h) => {
    let score = 0;
    for (const k of h.keys) { const nk = norm(k); if (q.includes(` ${nk} `) || (nk.length > 4 && q.includes(nk))) score += 3 + nk.split(' ').length; }
    const title = norm(h.q).split(' ');
    for (const w of words) { if (title.includes(w)) score += 1; if (h.keys.some((k) => norm(k).split(' ').includes(w))) score += 1; }
    return { h, score };
  }).filter((x) => x.score >= 2).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.h);
}
