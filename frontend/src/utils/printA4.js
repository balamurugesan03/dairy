/**
 * Dedicated A4 print layout for statutory registers (Cash Book, Ledger
 * Abstract, Receipts & Payments, R&D Statement).
 *
 * Unlike printReportLive (which clones the screen DOM + live CSS so print
 * looks like the web page), this builds a plain black-and-white document
 * from the report data: one report header, compact tables sized for an A4
 * sheet, headers repeated on every page, and a single signature block at
 * the end.
 */

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body {
    font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .a4-header { text-align: center; padding-bottom: 6px; margin-bottom: 8px; border-bottom: 1.5px solid #000; }
  .a4-header__org { font-size: 15px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
  .a4-header__title { display: inline-block; margin-top: 3px; padding: 1px 14px; font-size: 11.5px; font-weight: 700;
    letter-spacing: 3px; text-transform: uppercase; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  .a4-header__meta { margin-top: 4px; font-size: 9px; display: flex; justify-content: space-between; }

  table.a4 { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.a4 th, table.a4 td { border: 0.75px solid #444; padding: 2px 4px; vertical-align: top;
    overflow-wrap: anywhere; word-break: break-word; }
  table.a4 th { background: #e6e6e6; font-weight: 700; font-size: 8.5px; text-transform: uppercase; text-align: center; vertical-align: middle; }
  table.a4 thead { display: table-header-group; }
  table.a4 tr { page-break-inside: avoid; break-inside: avoid; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ctr { text-align: center; }
  .b { font-weight: 700; }
  .split { border-left: 1.75px solid #000 !important; }
  .row-sec td { background: #efefef; font-weight: 700; text-transform: uppercase; }
  .row-sub td { background: #f6f6f6; font-weight: 700; }
  .row-bal td { font-weight: 700; }
  .row-grand td { background: #e0e0e0; font-weight: 700; border-top: 1.5px solid #000; border-bottom: 2.5px double #000; }
  .narr { font-size: 8px; font-style: italic; color: #333; }
  .indent { padding-left: 12px !important; }

  .a4-sign { margin-top: 14px; page-break-inside: avoid; break-inside: avoid; }
  .a4-sign__meta { font-size: 8.5px; color: #333; margin-bottom: 34px; }
  .a4-sign__row { display: flex; justify-content: space-between; padding: 0 24px; }
  .a4-sign__box { min-width: 120px; border-top: 1px solid #000; padding-top: 3px; text-align: center; font-size: 10px; font-weight: 700; }
`;

/** Standard report header: organisation, boxed title, period / printed-on line. */
export const a4Header = ({ orgName, title, period, extra = '' }) => `
  <div class="a4-header">
    <div class="a4-header__org">${escapeHtml(orgName)}</div>
    <div class="a4-header__title">${escapeHtml(title)}</div>
    <div class="a4-header__meta">
      <span>${period ? `Period: ${escapeHtml(period)}` : ''}</span>
      <span>${extra}</span>
    </div>
  </div>`;

/** Single signature block for the last page. */
export const a4Signatures = (names = ['President', 'Secretary'], generatedOn = '') => `
  <div class="a4-sign">
    ${generatedOn ? `<div class="a4-sign__meta">Generated on ${escapeHtml(generatedOn)}</div>` : ''}
    <div class="a4-sign__row">
      ${names.map(n => `<div class="a4-sign__box">${escapeHtml(n)}</div>`).join('')}
    </div>
  </div>`;

/**
 * Open a print window with the given body HTML on an A4 page.
 * @param {object} opts
 * @param {string} opts.title        - window / PDF title
 * @param {string} opts.bodyHtml     - document body
 * @param {'portrait'|'landscape'} [opts.orientation='portrait']
 * @param {string} [opts.css]        - report-specific CSS layered on the base
 */
export const openA4Print = ({ title, bodyHtml, orientation = 'portrait', css = '' }) => {
  const pw = window.open('', '_blank');
  if (!pw) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 ${orientation}; margin: 10mm 8mm; }
    ${BASE_CSS}
    ${css}
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
  pw.document.close();
  let printed = false;
  const doPrint = () => {
    if (printed || pw.closed) return;
    printed = true;
    pw.focus();
    pw.print();
  };
  pw.onload = doPrint;
  // Fallback in case onload doesn't fire after document.write.
  setTimeout(doPrint, 400);
};

/**
 * Print a complete HTML document through a hidden iframe — no pop-up window,
 * so it also works after an async step (pop-up blockers only allow
 * window.open directly on a click). Used by the print previews, which render
 * the very same document in an iframe so preview == print.
 */
export const printHtmlDocument = (html) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    const go = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1000);
    };
    // Wait for any web fonts the document imports (e.g. Malayalam) before printing.
    const fonts = doc.fonts;
    if (fonts && fonts.ready) fonts.ready.then(go, go);
    else go();
  }, 250);
};

/** A4 sheet size in CSS units and in screen pixels (96 dpi) per orientation. */
export const A4_SIZE = {
  portrait:  { w: '210mm', h: '297mm', px: 794 },
  landscape: { w: '297mm', h: '210mm', px: 1123 }
};

/**
 * Compact President / Secretary row shared by the register prints (Day Book,
 * Cash Book, General Ledger): President in the page centre, Secretary beside
 * it, and the Generated On line in the same block.
 */
export const SIGN_CSS = `
  .sign { margin-top: 10px; page-break-inside: avoid; break-inside: avoid; }
  .sign__row { display: grid; grid-template-columns: 1fr auto 1fr; }
  .sign__box { min-width: 120px; padding-top: 22px; text-align: center; }
  .sign__box:first-child { grid-column: 2; }
  .sign__box:last-child { grid-column: 3; justify-self: start; margin-left: 50px; }
  .sign__line { border-top: 1px solid #000; padding-top: 2px; font-size: 10px; font-weight: 700; }
  .sign__meta { margin-top: 4px; font-size: 7.5px; color: #333; }
`;

export const signRowHtml = (generatedOn = '') => `
  <div class="sign">
    <div class="sign__row">
      <div class="sign__box"><div class="sign__line">President</div></div>
      <div class="sign__box"><div class="sign__line">Secretary</div></div>
    </div>
    ${generatedOn ? `<div class="sign__meta">Generated On : ${escapeHtml(generatedOn)}</div>` : ''}
  </div>`;
