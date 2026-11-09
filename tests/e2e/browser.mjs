// Shared browser-test helpers (uses the preinstalled Playwright + Chromium).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/opt/npm-tools/node_modules/playwright/index.js');
import fs from 'node:fs'; import path from 'node:path';
export const BASE = 'http://localhost:3000';
export const SHOTS = '/tmp/claude-0/-home-claude/467e0814-0f6f-5ae9-a323-9fc71cc6ac47/scratchpad/shots';
const MAIL = '/home/claude/stack/mail';
let browser;
export async function launch() { browser = await chromium.launch(); return browser; }
export async function close() { await browser?.close(); }

/** New page that records console errors, crashes and 5xx responses. */
export async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message + ' @ ' + page.url()));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/realtime|websocket|WebSocket|Failed to load resource: the server responded with a status of (400|401|403|404|406|409)|favicon|net::ERR_ABORTED|net::ERR_CONNECTION_REFUSED|i\.scdn|ytimg|youtube|spotify/i.test(t)) return;
    page.problems.push('console: ' + t + ' @ ' + page.url());
  });
  page.on('response', (r) => { if (r.status() >= 500) page.problems.push(`HTTP ${r.status()} ${r.url()}`); });
  return page;
}

export function latestMail(to, after = 0) {
  const files = fs.readdirSync(MAIL).filter((f) => f.includes(to.replace(/[^a-z0-9@._-]/gi, '_'))).sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const t = Number(files[i].split('-')[0]); if (t < after) continue;
    return JSON.parse(fs.readFileSync(path.join(MAIL, files[i]), 'utf8'));
  }
  return null;
}
export async function waitMail(to, after) {
  for (let i = 0; i < 40; i++) { const m = latestMail(to, after); if (m) return m; await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('no mail for ' + to);
}
export const linkIn = (mail) => (mail.html || mail.text).match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&');

let k = 0;
export const uniq = (p) => (p + Date.now().toString(36).slice(-4) + (k++)).slice(0, 20);

/** Full signup through the UI including the email confirmation link. Returns { page, username, email }. */
export async function signupUI(username, { display = username, birthdate = '1994-03-14', viewport } = {}) {
  const page = await newPage(viewport ? { viewport } : {});
  const email = `${username}@test.local`;
  const t0 = Date.now();
  await page.goto(BASE + '/signup');
  await page.fill('#su-username', username);
  await page.getByText(`@${username} is available.`).waitFor();
  await page.fill('input[name=display_name]', display);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'password123');
  await page.fill('input[name=birthdate]', birthdate);
  await page.check('input[name=agree]');
  await page.click('button[type=submit]');
  await page.waitForURL(/check-email/);
  const mail = await waitMail(email, t0);
  await page.goto(linkIn(mail));
  await page.waitForURL(/\/feed/);
  return { page, username, email };
}
export async function shot(page, name) { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); }
export function assertClean(page, label) {
  if (page.problems.length) throw new Error(`${label}: ${page.problems.join(' | ')}`);
}

/** Fast path: account made through the admin API, then a real UI login. */
export async function apiUserUI(username, opts = {}) {
  const { makeUser } = await import('../helpers.mjs');
  const u = await makeUser(username, opts);
  const page = await newPage(opts.viewport ? { viewport: opts.viewport } : {});
  await page.goto(BASE + '/login');
  await page.fill('input[name=email]', u.email); await page.fill('input[name=password]', 'password123');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/feed/);
  return { ...u, page };
}
