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
