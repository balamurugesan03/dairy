/**
 * Opens a new browser window containing only the report HTML and prints it.
 * Keeps the toolbar / sidebar completely out of the printout.
 *
 * @param {React.RefObject} contentRef  - ref attached to the printable content div
 * @param {object}          options
 * @param {string}          options.title       - <title> shown in browser print dialog
 * @param {string}          options.orientation - 'landscape' | 'portrait' (default: 'landscape')
 * @param {string}          options.extraCss    - any additional CSS to inject
 */
export const printReport = (contentRef, { title = 'Report', orientation = 'landscape', extraCss = '' } = {}) => {
  const content = contentRef?.current;
  if (!content) {
    console.warn('printReport: contentRef.current is null');
    return;
  }

  const pw = window.open('', '_blank');
  if (!pw) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }

  // Clone DOM so we can strip no-print sections without affecting the page
  const clone = content.cloneNode(true);
  clone.querySelectorAll('[data-no-print]').forEach(el => el.remove());

  pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
      font-size: 12px;
      color: #1a1a2e;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #aaa; padding: 4px 7px; vertical-align: middle; }
    th { background: #eeeeee; font-weight: 700; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; text-align: center; }
    td { font-size: 11.5px; }

    /* ── Utility ── */
    .text-right, [style*="text-align: right"] { text-align: right !important; }
    .text-center { text-align: center !important; }
    .font-bold, b, strong { font-weight: 700; }

    /* ── Mantine leftovers: hide interactive elements ── */
    button, input, select, [data-mantine-component="Button"],
    [data-mantine-component="Select"], [data-mantine-component="DateInput"] { display: none !important; }

    /* ── Page ── */
    @page { size: A4 ${orientation}; margin: 8mm; }

    ${extraCss}
  </style>
</head>
<body>
  ${clone.innerHTML}
</body>
</html>`);

  pw.document.close();
  // Give the browser time to render before printing
  setTimeout(() => {
    pw.focus();
    pw.print();
  }, 400);
};

/**
 * Convenience: call printReport and then close the window after print dialog closes.
 * Same signature as printReport.
 */
export const printAndClose = (contentRef, options = {}) => {
  const content = contentRef?.current;
  if (!content) return;

  const pw = window.open('', '_blank');
  if (!pw) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }

  const clone2 = content.cloneNode(true);
  clone2.querySelectorAll('[data-no-print]').forEach(el => el.remove());

  pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${options.title || 'Report'}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #aaa; padding: 4px 7px; vertical-align: middle; }
    th { background: #eee; font-weight: 700; font-size: 10.5px; text-transform: uppercase; text-align: center; }
    td { font-size: 11.5px; }
    button, input, select { display: none !important; }
    @page { size: A4 ${options.orientation || 'landscape'}; margin: 8mm; }
    ${options.extraCss || ''}
  </style>
</head>
<body>${clone2.innerHTML}</body>
</html>`);
  pw.document.close();
  setTimeout(() => { pw.focus(); pw.print(); pw.close(); }, 400);
};

/**
 * Professional Vyapar print utility.
 *
 * - Copies ALL Mantine/emotion <style> tags to the popup window so Mantine
 *   components (Badge, Table, Card, etc.) render correctly.
 * - Strips buttons, ActionIcons, filters, pagination and [data-no-print] nodes.
 * - Adds a centred professional header: Company name → Report title → Period + date.
 * - Auto-triggers window.print() when the popup loads, then closes.
 *
 * @param {React.RefObject} contentRef
 * @param {object}  options
 * @param {string}  options.title        - Report title (e.g. 'Cashflow Report')
 * @param {string}  options.companyName  - Firm name shown at the top
 * @param {string}  options.period       - e.g. '01/01/2026 – 31/03/2026'
 * @param {string}  options.orientation  - 'landscape' | 'portrait'  (default: 'landscape')
 * @param {string}  options.extraCss     - Optional extra CSS rules
 */
export const printVyaparReport = (contentRef, {
  title = 'Report',
  companyName = '',
  period = '',
  orientation = 'landscape',
  extraCss = ''
} = {}) => {
  const el = contentRef?.current;
  if (!el) { console.warn('printVyaparReport: contentRef.current is null'); return; }

  const pw = window.open('', '_blank');
  if (!pw) {
    alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
    return;
  }

  // ── Copy ALL <style> tags from the current document ────────────────────────
  // Mantine uses emotion (CSS-in-JS) which injects <style> tags into <head>.
  // Copying them ensures Mantine components look correct in the popup window.
  const styleTagsHtml = Array.from(document.querySelectorAll('style'))
    .map(s => s.outerHTML)
    .join('\n');

  // ── Clone content & strip interactive / non-print nodes ───────────────────
  const clone = el.cloneNode(true);
  const REMOVE_SELECTORS = [
    '[data-no-print]',
    'button',
    '[role="button"]',
    // Mantine ActionIcon renders as a <button> variant – caught above, but
    // also strip by class just in case:
    '[class*="ActionIcon"]',
    '[class*="Pagination"]',
    '[class*="LoadingOverlay"]',
    '[class*="Overlay-root"]',
    // Remove filter inputs – Select, DateInput, TextInput
    '[role="combobox"]',
    // actual <input> and <select> HTML elements
    'input',
    'select',
  ].join(', ');
  clone.querySelectorAll(REMOVE_SELECTORS).forEach(e => e.remove());

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${styleTagsHtml}
  <style>
    @page { size: A4 ${orientation}; margin: 10mm; }

    body {
      margin: 0;
      padding: 6px 10px;
      background: #fff !important;
      font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
      font-size: 12px;
      color: #1a1a2e;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* ── Professional report header ── */
    .vpr-header {
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 2px solid #1a1a2e;
      margin-bottom: 10px;
    }
    .vpr-header__company {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #1a1a2e;
    }
    .vpr-header__title {
      display: inline-block;
      margin-top: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #4a4a6a;
      border-top: 1px solid #4a4a6a;
      border-bottom: 1px solid #4a4a6a;
      padding: 2px 14px;
    }
    .vpr-header__meta {
      font-size: 10px;
      color: #555;
      margin-top: 4px;
    }

    /* ── Ensure tables span full width ── */
    table { width: 100% !important; }

    /* ── Force colour rendering ── */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    ${extraCss}
  </style>
</head>
<body>
  <div class="vpr-header">
    ${companyName ? `<div class="vpr-header__company">${companyName}</div>` : ''}
    <div class="vpr-header__title">${title}</div>
    <div class="vpr-header__meta">
      ${period ? `Period: ${period} &nbsp;|&nbsp; ` : ''}Printed: ${today}
    </div>
  </div>
  ${clone.innerHTML}
  <script>
    window.onload = function () {
      window.print();
      setTimeout(function () { window.close(); }, 1200);
    };
  </script>
</body>
</html>`);

  pw.document.close();
};
