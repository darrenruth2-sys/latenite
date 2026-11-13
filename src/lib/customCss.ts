// The all-in-one build has its data built in, so nothing is loaded from disk at runtime (the default build crashes on Vercel).
import * as csstree from 'css-tree/dist/csstree.esm';

/**
 * Custom profile CSS, made safe.
 *
 * What people can do: restyle anything on their own profile (colors, fonts, borders, spacing, animations,
 * backgrounds using pictures they uploaded to SignedOn).
 * What they can't: touch anything outside their profile, load anything from other websites (no trackers,
 * no fake-login images), pin things over the screen, or hide/cover the Add friend / Message / Report / Block buttons.
 *
 * Every rule is rewritten to live under `.so-css` (the profile area). `html`, `body` and `:root` mean the profile page box.
 */

export const CSS_MAX = 20000;
const SCOPE = '.so-css';
const PAGE = '.so-page';
const MAX_RULES = 600;

const BLOCKED_AT = new Set(['import', 'font-face', 'namespace', 'charset', 'page', 'property', 'layer', 'container', 'counter-style', 'font-feature-values', 'scope', 'starting-style']);
const ALLOWED_AT = new Set(['media', 'supports', 'keyframes', '-webkit-keyframes']);
const BLOCKED_PROPS = new Set(['behavior', '-moz-binding', 'src', 'unicode-range']);
const BLOCKED_FUNCS = new Set(['image-set', '-webkit-image-set', 'element', '-moz-element', 'paint', 'env', 'src', 'expression']);

function allowedUrl(u: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return !!base && u.startsWith(`${base}/storage/v1/object/public/media/`) && !/[\s"'()<>\\]/.test(u);
}

/** Returns CSS that is safe to drop into a <style> tag, plus notes about anything removed. */
export function sanitizeCss(input: string | null | undefined): { css: string; removed: string[] } {
  const removed = new Set<string>();
  if (!input || !input.trim()) return { css: '', removed: [] };
  const src = input.slice(0, CSS_MAX);
  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(src, { parseValue: true, parseCustomProperty: false, onParseError: () => removed.add('Some lines had typos and were skipped') });
  } catch { return { css: '', removed: ['Could not read this CSS'] }; }

  let rules = 0;
  // 0) animation names are global in CSS, so give the person's keyframes their own prefix (can't clash with the site's)
  const frames = new Set<string>();
  csstree.walk(ast, { visit: 'Atrule', enter(node) {
    if (/keyframes$/i.test(node.name) && node.prelude) { const n = csstree.generate(node.prelude).trim(); if (/^[\w-]{1,60}$/.test(n)) { frames.add(n); node.prelude = csstree.parse(`u-${n}`, { context: 'atrulePrelude', atrule: 'keyframes' }) as csstree.AtrulePrelude; } }
  } });
  if (frames.size) csstree.walk(ast, { visit: 'Declaration', enter(d) {
    if (/^(-webkit-)?animation(-name)?$/i.test(d.property)) csstree.walk(d.value, { visit: 'Identifier', enter(id) { if (frames.has(id.name)) id.name = `u-${id.name}`; } });
  } });

  // 1) at-rules
  csstree.walk(ast, {
    visit: 'Atrule',
    enter(node, item, list) {
      const name = node.name.toLowerCase();
      if (BLOCKED_AT.has(name) || !ALLOWED_AT.has(name)) { removed.add(`@${name} isn't allowed`); if (list && item) list.remove(item); }
    },
  });

  // 2) declarations
  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node, item, list) {
      const prop = node.property.toLowerCase();
      const drop = (why: string) => { removed.add(why); if (list && item) list.remove(item); };
      if (BLOCKED_PROPS.has(prop)) return drop(`"${prop}" isn't allowed`);
      const text = csstree.generate(node.value).toLowerCase();
      if (/expression\s*\(|javascript:|vbscript:|data:/.test(text)) return drop('Scripts and data links aren\'t allowed');
      let bad = '';
      csstree.walk(node.value, (n) => {
        if (n.type === 'Url' && !allowedUrl(n.value)) bad = 'Pictures from other websites aren\'t allowed (upload them to SignedOn instead)';
        if (n.type === 'Function' && BLOCKED_FUNCS.has(n.name.toLowerCase())) bad = `${n.name}() isn't allowed`;
      });
      if (bad) return drop(bad);
      if (prop === 'position' && /fixed|sticky/.test(text)) return drop('position: fixed/sticky isn\'t allowed (it could cover the screen)');
      if (prop === 'z-index' && Math.abs(parseInt(text, 10) || 0) > 100) return drop('z-index above 100 isn\'t allowed');
    },
  });

  // 3) selectors: scope everything to the profile area
  csstree.walk(ast, {
    visit: 'Rule',
    enter(node, item, list) {
      if (++rules > MAX_RULES) { removed.add('Too many rules'); if (list && item) list.remove(item); return; }
      if (node.prelude.type !== 'SelectorList') return;
      // inside @keyframes the "selectors" are 0%/from/to: leave them alone
      const pre = csstree.generate(node.prelude).trim();
      if (/^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/i.test(pre)) return;
      const parts: string[] = [];
      node.prelude.children.forEach((sel) => { const t = csstree.generate(sel).trim(); if (t) parts.push(t); });
      const scoped = parts.map((sel) => {
        if (/^(html|body|:root)\b/i.test(sel)) { const rest = sel.replace(/^(html|body|:root)(\s*(html|body))*/i, '').trim(); return rest ? `${SCOPE} ${rest}` : PAGE; }
        return `${SCOPE} ${sel}`;
      }).join(', ');
      try { node.prelude = csstree.parse(scoped, { context: 'selectorList' }) as csstree.SelectorList; }
      catch { removed.add('A selector couldn\'t be read and was skipped'); if (list && item) list.remove(item); }
    },
  });

  // Never let CSS break out of the <style> tag.
  const css = csstree.generate(ast).replace(/</g, '\\3c ');
  return { css, removed: [...removed] };
}

/** Always added AFTER the person's CSS: the safety buttons and the page frame can't be hidden, moved or covered. */
export const SAFETY_CSS = `
${PAGE}{isolation:isolate}
${SCOPE}{contain:paint;position:relative}
${PAGE} .so-safe{display:flex!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:2147483647!important;
  transform:none!important;filter:none!important;clip-path:none!important;pointer-events:auto!important;width:auto!important;height:auto!important;
  max-width:none!important;max-height:none!important;overflow:visible!important;font-size:16px!important}
${PAGE} .so-safe *{visibility:visible!important;opacity:1!important;pointer-events:auto!important}
`;
