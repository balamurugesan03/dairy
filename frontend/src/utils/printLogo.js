/**
 * Society logo on every print header (Settings → Society Information → Logo).
 *
 * The app has dozens of independent print paths (openA4Print, printHtmlDocument,
 * hand-written window.open + document.write, hidden iframes, react-to-print, and a
 * few window.print() pages with @media print CSS). Rather than editing each one,
 * installPrintLogoHook() is called once at start-up and puts the logo into any
 * document about to be printed:
 *   • print windows (window.open)  — when the document is closed after writing,
 *                                    and again (sync) when print() is called
 *   • print iframes                — when print() is called on their window
 *   • the main window              — on beforeprint, only inside print areas
 *                                    (id / class containing "print"); removed again
 *                                    on afterprint
 * Headers are found by text: every (deepest) element whose text is the society
 * name — one per page / slip when a print repeats its header. The logo sits on the LEFT of that header line, vertically centred,
 * absolutely positioned so the centred header text keeps its place (same row).
 */

const LOGO_ATTR = 'data-society-logo';
// Fired after Society Information is saved so the print branding reloads
export const SOCIETY_BRANDING_EVENT = 'society-branding-changed';
let branding = { logo: '', names: [] };

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Set from the Society Information branding (logo + the names a header may show). */
export const setPrintBranding = ({ logo = '', names = [] } = {}) => {
  branding = {
    logo: logo || '',
    names: [...new Set(names.map(norm).filter((n) => n.length >= 3))],
  };
};

export const getPrintLogo = () => branding.logo;

const matchesName = (el) => {
  const t = norm(el.textContent);
  if (!t || t.length > 200) return false;
  return branding.names.some((n) => t === n || t.startsWith(`${n} `) || t.startsWith(n));
};

// Every element whose own text is the society name and none of whose children
// also match — i.e. the header lines (one per page / per slip when repeated).
const MAX_HEADERS = 60;
const findHeaderLines = (doc, accept) => {
  const out = [];
  if (!doc?.body || !branding.names.length) return out;
  const walker = doc.createTreeWalker(doc.body, 1 /* NodeFilter.SHOW_ELEMENT */);
  let n;
  let seen = 0;
  while ((n = walker.nextNode()) && seen++ < 20000 && out.length < MAX_HEADERS) {
    if (/^(SCRIPT|STYLE|IMG|SVG|INPUT|SELECT|TEXTAREA|BUTTON|OPTION)$/i.test(n.tagName)) continue;
    if (!matchesName(n)) continue;
    if ([...n.children].some(matchesName)) continue;          // a child is the real line
    if (accept && !accept(n)) continue;
    out.push(n);
  }
  return out;
};

// The block the logo is positioned in: the header group around the name line
// (org + title lines) when it is small, else the name line itself.
const headerBlock = (line) => {
  const p = line.parentElement;
  if (p && p.tagName !== 'BODY' && norm(p.textContent).length < 400 && p.children.length <= 8) return p;
  return line;
};

const injectInto = (doc, accept) => {
  try {
    if (!branding.logo || !doc?.body || doc.querySelector(`[${LOGO_ATTR}]`)) return;
    const view = doc.defaultView;
    const done = new Set();
    findHeaderLines(doc, accept).forEach((line) => {
      const block = headerBlock(line);
      if (done.has(block)) return;
      done.add(block);
      const pos = view ? view.getComputedStyle(block).position : '';
      if (!pos || pos === 'static') {
        block.setAttribute('data-society-logo-pos', '1');
        block.style.position = 'relative';
      }
      const img = doc.createElement('img');
      img.setAttribute(LOGO_ATTR, '1');
      img.src = branding.logo;
      img.alt = '';
      Object.assign(img.style, {
        position: 'absolute', left: '2px', top: '50%', transform: 'translateY(-50%)',
        maxHeight: '46px', maxWidth: '64px', height: 'auto', width: 'auto', objectFit: 'contain',
        printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
      });
      block.insertBefore(img, block.firstChild);
    });
  } catch { /* never block a print */ }
};

const removeFrom = (doc) => {
  doc.querySelectorAll(`[${LOGO_ATTR}]`).forEach((el) => el.remove());
  doc.querySelectorAll('[data-society-logo-pos]').forEach((el) => {
    el.style.position = '';
    el.removeAttribute('data-society-logo-pos');
  });
};

// Wrap a (same-origin) window's print() so the logo is in before it prints
const wrapPrint = (win) => {
  try {
    if (!win || win.__societyLogoWrapped) return;
    const orig = win.print;
    if (typeof orig !== 'function') return;
    win.__societyLogoWrapped = true;
    win.print = function printWithLogo(...args) {
      injectInto(win.document);
      return orig.apply(win, args);
    };
  } catch { /* cross-origin or closed — ignore */ }
};

// Print windows: also inject as soon as the written document is closed, so the
// image is decoded long before print() runs
const wrapDocumentClose = (win) => {
  try {
    const doc = win?.document;
    if (!doc || doc.__societyLogoClose) return;
    const orig = doc.close;
    doc.__societyLogoClose = true;
    doc.close = function closeWithLogo(...args) {
      const r = orig.apply(doc, args);
      injectInto(doc);
      return r;
    };
  } catch { /* ignore */ }
};

const inPrintArea = (el) => {
  for (let n = el; n && n !== n.ownerDocument.body; n = n.parentElement) {
    const id = (n.id || '').toLowerCase();
    const cls = typeof n.className === 'string' ? n.className.toLowerCase() : '';
    if (id.includes('print') || cls.includes('print')) return !cls.includes('no-print');
  }
  return false;
};

let installed = false;

export function installPrintLogoHook() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // 1. window.open print windows
  const origOpen = window.open;
  window.open = function openWithLogo(...args) {
    const w = origOpen.apply(window, args);
    if (w) {
      wrapPrint(w);
      wrapDocumentClose(w);
      try { w.addEventListener('load', () => { wrapPrint(w); injectInto(w.document); }); } catch { /* ignore */ }
    }
    return w;
  };

  // 2. print iframes (hidden iframe helpers, react-to-print)
  const hookFrame = (f) => {
    wrapPrint(f.contentWindow);
    f.addEventListener('load', () => wrapPrint(f.contentWindow));
  };
  new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach((node) => {
      if (node.tagName === 'IFRAME') hookFrame(node);
      else if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(hookFrame);
    }));
  }).observe(document.body, { childList: true, subtree: true });

  // 3. pages printed in place with @media print
  window.addEventListener('beforeprint', () => injectInto(document, inPrintArea));
  window.addEventListener('afterprint', () => removeFrom(document));
}
