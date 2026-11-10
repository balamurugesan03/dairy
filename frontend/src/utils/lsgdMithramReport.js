/**
 * LSGD Reports → LSGD Mithram Statement: columns, totals, and the three
 * outputs built from the SAME rows / visible columns — print HTML (also the
 * preview), PDF (jsPDF + autotable) and Excel (SheetJS).
 *
 * Rows come from /lsgd-mithram/statement; the screen keeps two edits on top:
 * removed farmers and manually changed Subsidy Allotted amounts. Calculations
 * never depend on which columns are shown.
 */
import { escapeHtml } from './printA4';
import { getFarmerDocumentImages, documentPagesHtml, DOCUMENT_PAGE_CSS } from './farmerDocumentsPrint';

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const fmt2 = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtQty = fmt2;
export const fmtAmt = fmt2;

/** 'YYYY-MM-DD' → 'DD-MM-YYYY' */
export const dmy = (ymd) => (ymd ? String(ymd).slice(0, 10).split('-').reverse().join('-') : '');

// ── Columns ──────────────────────────────────────────────────────
// type: text (left), qty (litres), rate (₹/litre), amt (₹). `group` = shared header above month columns.
export const DETAIL_COLUMNS = [
  { key: 'sl',            label: 'Sl No',          type: 'text', width: 5,  align: 'center' },
  { key: 'producerNo',    label: 'Producer No',    type: 'text', width: 8,  align: 'center' },
  { key: 'name',          label: 'Name',           type: 'text', width: 22 },
  { key: 'listNo',        label: 'List No',        type: 'text', width: 7,  align: 'center' },
  { key: 'accountNumber', label: 'Account Number', type: 'text', width: 17 },
  { key: 'ifsc',          label: 'IFSC Code',      type: 'text', width: 12 },
  { key: 'aadhaar',       label: 'Aadhaar Number', type: 'text', width: 15 },
];
export const AMOUNT_COLUMNS = [
  { key: 'totalMilk',       label: 'Total Milk (Litre)',         type: 'qty',  width: 11 },
  { key: 'rate',            label: 'Incentive Amount (₹/Litre)', type: 'rate', width: 10 },
  { key: 'totalAmount',     label: 'Total Amount (₹)',           type: 'amt',  width: 12 },
  { key: 'subsidyAllotted', label: 'Subsidy Allotted (₹)',       type: 'amt',  width: 12 },
];
export const MONTH_GROUP = 'Milk Quantity (Litre)';
export const monthColumns = (months = []) => months.map((m) => ({
  key: `m:${m.key}`, monthKey: m.key, label: m.label, type: 'qty', width: 9, group: MONTH_GROUP,
}));
export const allColumns = (months) => [...DETAIL_COLUMNS, ...monthColumns(months), ...AMOUNT_COLUMNS];
export const visibleColumns = (months, hidden) => allColumns(months).filter((c) => !hidden.has(c.key));

// ── Rows + totals (frontend and backend use the same r2(qty × rate)) ─────────
/**
 * @param baseRows  rows from the API
 * @param rate      subsidy ₹ per litre
 * @param overrides { farmerId: amount } — manual Subsidy Allotted
 * @param removed   Set of farmerIds dropped from this statement
 */
export const computeRows = (baseRows = [], rate = 0, overrides = {}, removed = new Set()) => {
  const out = [];
  for (const r of baseRows) {
    if (removed.has(r.farmerId)) continue;
    const totalAmount = r2(r.totalMilk * (Number(rate) || 0));
    const manual = Object.prototype.hasOwnProperty.call(overrides, r.farmerId);
    out.push({ ...r, rate: Number(rate) || 0, totalAmount, subsidyAllotted: manual ? r2(overrides[r.farmerId]) : totalAmount, manual });
  }
  return out;
};

export const computeTotals = (rows, months = []) => ({
  monthly: Object.fromEntries(months.map((m) => [m.key, r2(rows.reduce((s, r) => s + (r.monthly?.[m.key] || 0), 0))])),
  totalMilk: r2(rows.reduce((s, r) => s + r.totalMilk, 0)),
  totalAmount: r2(rows.reduce((s, r) => s + r.totalAmount, 0)),
  subsidyAllotted: r2(rows.reduce((s, r) => s + r.subsidyAllotted, 0)),
});

/** Raw value of a cell: number for qty/rate/amt columns, string otherwise. */
export const cellValue = (row, col, index) => {
  if (col.key === 'sl') return String(index + 1);
  if (col.monthKey) return row.monthly?.[col.monthKey] || 0;
  const v = row[col.key];
  if (col.type === 'text') return v == null ? '' : String(v);
  return Number(v) || 0;
};
export const totalValue = (totals, col) => {
  if (col.monthKey) return totals.monthly[col.monthKey] || 0;
  if (col.key === 'rate' || col.type === 'text') return null;
  return totals[col.key] || 0;
};
const formatCell = (v, col) => (col.type === 'text' ? v : (col.type === 'qty' ? fmtQty(v) : fmtAmt(v)));

// ── Header facts shared by every output ──────────────────────────
/** @param opts { meta, wardNumber, wardMember, rate } */
export const headerFacts = ({ meta = {}, ward, wardNumber, wardMember, rate }) => ({
  panchayat: String(meta.panchayat || '').toUpperCase(),
  society: String(meta.societyName || '').toUpperCase(),
  title: 'LSGD MITHRAM STATEMENT',
  financialYear: meta.financialYear || '',
  period: `${dmy(meta.fromDate)} to ${dmy(meta.toDate)}`,
  ward: ward ?? meta.ward ?? '',
  wardNumber: wardNumber || '',
  wardMember: wardMember || '',
  rate: Number(rate ?? meta.rate) || 0,
});

export const SIGNATURES = (facts) => [
  { title: 'Prepared By' },
  { title: 'Verified By' },
  { title: 'Ward Member', name: facts.wardMember },
  { title: 'Secretary / President' },
];

/** A4 landscape up to 16 columns, A3 landscape beyond — no column is cut off. */
export const paperFor = (columnCount) => (columnCount > 16 ? 'a3' : 'a4');
const printFontPx = (n, paper) => {
  const base = n <= 11 ? 10 : n <= 14 ? 9 : n <= 16 ? 8 : n <= 20 ? 8.5 : 7.5;
  return paper === 'a3' ? base + 0.5 : base;
};

export const reportFileName = (facts, ext) =>
  `LSGD_Mithram_Statement_${facts.panchayat || 'Panchayat'}${facts.ward ? `_${facts.ward}` : ''}_${facts.period.replace(/ to /, '_')}`
    .replace(/[^\w-]+/g, '_').replace(/_+/g, '_') + ext;

// ════════════════════════════════════════════════════════════════
//  Print / preview HTML
// ════════════════════════════════════════════════════════════════
const tableHeadHtml = (cols) => {
  const months = cols.filter((c) => c.group);
  const hasGroup = months.length > 0;
  let row1 = '';
  let groupDone = false;
  for (const c of cols) {
    if (c.group) {
      if (!groupDone) { row1 += `<th colspan="${months.length}">${escapeHtml(c.group)}</th>`; groupDone = true; }
    } else {
      row1 += `<th${hasGroup ? ' rowspan="2"' : ''}>${escapeHtml(c.label)}</th>`;
    }
  }
  const row2 = hasGroup ? `<tr>${months.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr>` : '';
  return `<thead><tr>${row1}</tr>${row2}</thead>`;
};

const tableBodyHtml = (cols, rows) => rows.map((r, i) => `<tr>${cols.map((c) => {
  const v = cellValue(r, c, i);
  const cls = c.type === 'text' ? (c.align === 'center' ? 'ctr' : '') : 'amt';
  return `<td class="${cls}">${escapeHtml(formatCell(v, c))}</td>`;
}).join('')}</tr>`).join('');

const totalRowHtml = (cols, totals) => {
  const lead = cols.findIndex((c) => c.type !== 'text');
  const textCount = lead === -1 ? cols.length : lead;
  let html = textCount ? `<td colspan="${textCount}" class="ctr">GRAND TOTAL</td>` : '';
  for (const c of cols.slice(textCount)) {
    const v = totalValue(totals, c);
    html += `<td class="amt">${v == null ? '' : escapeHtml(formatCell(v, c))}</td>`;
  }
  return `<tfoot><tr class="row-total">${html}</tr></tfoot>`;
};

const STATEMENT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .st-head { text-align: center; margin-bottom: 6px; }
  .st-head .pan { font-size: 1.55em; font-weight: 700; letter-spacing: 1px; }
  .st-head .soc { font-size: 1.3em; font-weight: 700; margin-top: 2px; }
  .st-head .ttl { display: inline-block; margin-top: 4px; padding: 2px 18px; font-size: 1.3em; font-weight: 700;
    letter-spacing: 2px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
  .st-head .fy { margin-top: 3px; font-size: 1.1em; font-weight: 700; }
  .st-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 18px; font-size: 1.05em;
    border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 2px; margin-bottom: 5px; }
  .st-meta b { font-weight: 700; }
  table.st { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.st th, table.st td { border: 0.75px solid #333; padding: 2px 3px; vertical-align: middle; overflow-wrap: anywhere; }
  table.st th { background: #e4e4e4; font-weight: 700; text-align: center; font-size: 0.95em; }
  table.st thead { display: table-header-group; }
  table.st tfoot { display: table-row-group; }
  table.st tr { page-break-inside: avoid; break-inside: avoid; }
  .amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .ctr { text-align: center; }
  .row-total td { background: #d9d9d9; font-weight: 700; border-top: 1.5px solid #000; border-bottom: 2.5px double #000; }
  .st-sign { margin-top: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; padding-top: 34px;
    page-break-inside: avoid; break-inside: avoid; }
  .st-sign div { text-align: center; border-top: 1px solid #000; padding-top: 3px; font-weight: 700; font-size: 1.05em; }
  .st-sign small { display: block; font-weight: 400; font-size: 0.9em; min-height: 1em; }
  .st-gen { margin-top: 6px; font-size: 0.85em; color: #333; }
  .doc-owner { font-size: 13px; }
`;

export const statementBodyHtml = ({ facts, columns, rows, totals }) => {
  const sig = SIGNATURES(facts);
  return `
  <div class="st-head">
    ${facts.panchayat ? `<div class="pan">${escapeHtml(facts.panchayat)}</div>` : ''}
    ${facts.society ? `<div class="soc">${escapeHtml(facts.society)}</div>` : ''}
    <div class="ttl">${escapeHtml(facts.title)}</div>
    ${facts.financialYear ? `<div class="fy">Financial Year ${escapeHtml(facts.financialYear)}</div>` : ''}
  </div>
  <div class="st-meta">
    <span><b>Period:</b> ${escapeHtml(facts.period)}</span>
    <span><b>Ward:</b> ${escapeHtml(facts.ward || 'All Wards')}${facts.wardNumber ? ` &nbsp;<b>Ward No:</b> ${escapeHtml(facts.wardNumber)}` : ''}</span>
    <span><b>Ward Member:</b> ${escapeHtml(facts.wardMember || '-')}</span>
    <span><b>Incentive:</b> ₹ ${escapeHtml(fmtAmt(facts.rate))} per litre</span>
    <span><b>Producers:</b> ${rows.length}</span>
  </div>
  <table class="st">
    <colgroup>${(() => { const tw = columns.reduce((s, c) => s + c.width, 0) || 1; return columns.map((c) => `<col style="width:${((c.width / tw) * 100).toFixed(2)}%" />`).join(''); })()}</colgroup>
    ${tableHeadHtml(columns)}
    <tbody>${tableBodyHtml(columns, rows) || `<tr><td colspan="${columns.length}" class="ctr">No producers</td></tr>`}</tbody>
    ${totalRowHtml(columns, totals)}
  </table>
  <div class="st-sign">
    ${sig.map((s) => `<div>${escapeHtml(s.title)}<small>${escapeHtml(s.name || '')}</small></div>`).join('')}
  </div>
  <div class="st-gen">Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>`;
};

export const buildStatementHtml = ({ facts, columns, rows, totals, documentsHtml = '' }) => {
  const paper = paperFor(columns.length);
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8" />
<title>${escapeHtml(reportFileName(facts, ''))}</title>
<style>
  @page { size: ${paper.toUpperCase()} landscape; margin: 8mm 7mm; }
  @page docs { size: A4 portrait; margin: 10mm; }
  ${STATEMENT_CSS}
  body { font-size: ${printFontPx(columns.length, paper)}px; }
  ${DOCUMENT_PAGE_CSS}
  .farmer-doc-page { page: docs; }
</style></head>
<body>${statementBodyHtml({ facts, columns, rows, totals })}${documentsHtml}</body></html>`;
};

// ── Attached documents, farmer-wise ──────────────────────────────
const hasAnyDoc = (r) => !!(r.docs && (r.docs.bankPassbook || r.docs.aadhaar || r.docs.rationCard));

/**
 * Document images for every row that has an upload (4 at a time).
 * @returns { groups: [{ row, pages }], skipped: [label], failed: [farmer] }
 */
export const collectDocuments = async (rows, onProgress) => {
  const targets = rows.filter(hasAnyDoc);
  const groups = new Array(targets.length);
  const skipped = [];
  const failed = [];
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < targets.length) {
      const i = next++;
      const row = targets[i];
      try {
        const res = await getFarmerDocumentImages(row.farmerId);
        groups[i] = { row, pages: res.pages };
        res.skipped.forEach((s) => skipped.push(`${row.producerNo} ${s}`));
      } catch {
        groups[i] = { row, pages: [] };
        failed.push(`${row.producerNo} ${row.name}`);
      }
      done += 1;
      onProgress?.(done, targets.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
  return { groups: groups.filter((g) => g && g.pages.length), skipped, failed };
};

export const documentsHtmlOf = (groups) => groups
  .map(({ row, pages }) => documentPagesHtml(pages, `${row.producerNo} - ${row.name}`)).join('');

/**
 * Print: open the window inside the click, fetch documents if asked, then print.
 * @returns { ok, message?, docCount, failed }
 */
export const printStatement = async ({ facts, columns, rows, totals, withDocuments, onProgress }) => {
  const win = window.open('', '_blank');
  if (!win) return { ok: false, message: 'Allow pop-ups to print' };
  win.document.write('<p style="font:14px Arial;padding:24px">Preparing LSGD Mithram Statement…</p>');
  let docs = { groups: [], failed: [] };
  if (withDocuments) {
    try { docs = await collectDocuments(rows, onProgress); } catch { /* print the statement anyway */ }
  }
  win.document.open();
  win.document.write(buildStatementHtml({ facts, columns, rows, totals, documentsHtml: documentsHtmlOf(docs.groups) }));
  win.document.close();
  const imgs = [...win.document.images];
  await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  win.focus();
  setTimeout(() => { win.print(); }, 300);
  return { ok: true, docCount: docs.groups.length, failed: docs.failed };
};

// ════════════════════════════════════════════════════════════════
//  PDF
// ════════════════════════════════════════════════════════════════
const pdfText = (s) => String(s ?? '').replace(/₹/g, 'Rs.');

/** Image (data URL or URL) → JPEG data URL + size, through a canvas (any format, smaller file). */
const toJpeg = (src, maxSide = 1700) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    try { resolve({ data: c.toDataURL('image/jpeg', 0.85), w, h }); } catch (e) { reject(e); }
  };
  img.onerror = () => reject(new Error('image'));
  img.src = src;
});

/**
 * Build the PDF (jsPDF document) — statement in landscape, then documents
 * one A4 portrait page each when docGroups is given.
 */
export const buildStatementPdf = async ({ facts, columns, rows, totals, docGroups = [] }) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const paper = paperFor(columns.length);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: paper });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 7;
  let y = 10;
  const center = (text, size, bold = true) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(pdfText(text), pageW / 2, y, { align: 'center' });
    y += size * 0.45;
  };
  if (facts.panchayat) center(facts.panchayat, 14);
  if (facts.society) center(facts.society, 12);
  center(facts.title, 12);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 40, y - 4.2, pageW / 2 + 40, y - 4.2);
  if (facts.financialYear) center(`Financial Year ${facts.financialYear}`, 10);
  y += 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const metaParts = [
    `Period: ${facts.period}`,
    `Ward: ${facts.ward || 'All Wards'}${facts.wardNumber ? `   Ward No: ${facts.wardNumber}` : ''}`,
    `Ward Member: ${facts.wardMember || '-'}`,
    `Incentive: Rs. ${fmtAmt(facts.rate)} per litre`,
    `Producers: ${rows.length}`,
  ];
  const slot = (pageW - margin * 2) / metaParts.length;
  doc.line(margin, y - 3.5, pageW - margin, y - 3.5);
  metaParts.forEach((t, i) => doc.text(pdfText(t), margin + slot * i + slot / 2, y, { align: 'center', maxWidth: slot - 2 }));
  doc.line(margin, y + 1.8, pageW - margin, y + 1.8);
  y += 4;

  // Head: months under one group header when there are month columns
  const months = columns.filter((c) => c.group);
  const head = [];
  if (months.length) {
    const r1 = [];
    let groupDone = false;
    for (const c of columns) {
      if (c.group) { if (!groupDone) { r1.push({ content: c.group, colSpan: months.length }); groupDone = true; } }
      else r1.push({ content: pdfText(c.label), rowSpan: 2 });
    }
    head.push(r1, months.map((c) => c.label));
  } else {
    head.push(columns.map((c) => pdfText(c.label)));
  }
  const body = rows.map((r, i) => columns.map((c) => formatCell(cellValue(r, c, i), c)));
  const lead = columns.findIndex((c) => c.type !== 'text');
  const textCount = lead === -1 ? columns.length : lead;
  const foot = [[
    ...(textCount ? [{ content: 'GRAND TOTAL', colSpan: textCount, styles: { halign: 'center' } }] : []),
    ...columns.slice(textCount).map((c) => { const v = totalValue(totals, c); return v == null ? '' : formatCell(v, c); }),
  ]];
  const totalW = columns.reduce((s, c) => s + c.width, 0);
  const usable = pageW - margin * 2;
  const columnStyles = Object.fromEntries(columns.map((c, i) => [i, {
    cellWidth: (c.width / totalW) * usable,
    halign: c.type === 'text' ? (c.align || 'left') : 'right',
  }]));
  const fontSize = columns.length <= 12 ? 8 : columns.length <= 16 ? 7 : columns.length <= 22 ? 7 : 6;

  autoTable(doc, {
    startY: y,
    head, body, foot,
    showHead: 'everyPage',
    showFoot: 'lastPage',
    theme: 'grid',
    margin: { left: margin, right: margin, top: 10, bottom: 12 },
    styles: { font: 'helvetica', fontSize, cellPadding: 1, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: 0, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [217, 217, 217], textColor: 0, fontStyle: 'bold', halign: 'right' },
    columnStyles,
  });

  // Signatures (new page if they don't fit)
  let sy = (doc.lastAutoTable?.finalY || y) + 20;
  const pageH = doc.internal.pageSize.getHeight();
  if (sy > pageH - 14) { doc.addPage(paper, 'landscape'); sy = 30; }
  const sig = SIGNATURES(facts);
  const w = (pageW - margin * 2) / sig.length;
  doc.setFontSize(9);
  sig.forEach((s, i) => {
    const cx = margin + w * i + w / 2;
    doc.setLineWidth(0.25);
    doc.line(cx - w / 2 + 8, sy, cx + w / 2 - 8, sy);
    doc.setFont('helvetica', 'bold');
    doc.text(s.title, cx, sy + 4, { align: 'center' });
    if (s.name) { doc.setFont('helvetica', 'normal'); doc.text(pdfText(s.name), cx, sy + 8, { align: 'center' }); }
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, margin, sy + 13);

  const statementPages = doc.getNumberOfPages();
  for (let p = 1; p <= statementPages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.text(`Page ${p} of ${statementPages}`, pageW - margin, pageH - 5, { align: 'right' });
  }

  // Attached documents — A4 portrait, one image per page
  for (const { row, pages } of docGroups) {
    for (const pg of pages) {
      let img;
      try { img = await toJpeg(pg.img); } catch { continue; }
      doc.addPage('a4', 'portrait');
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(pdfText(`${row.producerNo} - ${row.name} — ${pg.title}`).toUpperCase(), pw / 2, 12, { align: 'center', maxWidth: pw - 20 });
      doc.setLineWidth(0.3);
      doc.line(10, 14.5, pw - 10, 14.5);
      const maxW = pw - 20;
      const maxH = ph - 28;
      const s = Math.min(maxW / img.w, maxH / img.h);
      const dw = img.w * s;
      const dh = img.h * s;
      doc.addImage(img.data, 'JPEG', (pw - dw) / 2, 18, dw, dh);
    }
  }
  return doc;
};

// ════════════════════════════════════════════════════════════════
//  Excel
// ════════════════════════════════════════════════════════════════
export const buildStatementWorkbook = async ({ facts, columns, rows, totals }) => {
  const XLSX = await import('xlsx');
  const n = columns.length;
  const aoa = [];
  const merges = [];
  const mergeRow = (r) => merges.push({ s: { r, c: 0 }, e: { r, c: Math.max(0, n - 1) } });
  const titleLines = [facts.panchayat, facts.society, facts.title, facts.financialYear ? `Financial Year ${facts.financialYear}` : ''].filter(Boolean);
  titleLines.forEach((t) => { mergeRow(aoa.length); aoa.push([t]); });
  mergeRow(aoa.length);
  aoa.push([`Period: ${facts.period}    Ward: ${facts.ward || 'All Wards'}${facts.wardNumber ? `    Ward No: ${facts.wardNumber}` : ''}    Ward Member: ${facts.wardMember || '-'}    Incentive: ₹ ${fmtAmt(facts.rate)} per litre`]);
  aoa.push([]);

  // Header rows
  const months = columns.filter((c) => c.group);
  const h1 = aoa.length;
  if (months.length) {
    const r1 = [];
    const r2row = [];
    columns.forEach((c, i) => {
      if (c.group) {
        r1.push(c === months[0] ? c.group : '');
        r2row.push(c.label);
      } else {
        r1.push(c.label);
        r2row.push('');
        merges.push({ s: { r: h1, c: i }, e: { r: h1 + 1, c: i } });
      }
    });
    const first = columns.indexOf(months[0]);
    if (months.length > 1) merges.push({ s: { r: h1, c: first }, e: { r: h1, c: first + months.length - 1 } });
    aoa.push(r1, r2row);
  } else {
    aoa.push(columns.map((c) => c.label));
  }

  // Data rows: numbers stay numbers; account / Aadhaar / numbers-as-text stay text
  const dataStart = aoa.length;
  rows.forEach((r, i) => {
    aoa.push(columns.map((c) => {
      if (c.key === 'sl') return i + 1;
      return cellValue(r, c, i);
    }));
  });
  const dataEnd = aoa.length - 1;
  const totalRow = aoa.length;
  aoa.push(columns.map(() => ''));
  aoa.push([]);
  aoa.push([]);
  const signRow = aoa.length;
  const sig = SIGNATURES(facts);
  const signLine = columns.map(() => '');
  const slot = Math.max(1, Math.floor(n / sig.length));
  sig.forEach((s, i) => { signLine[Math.min(n - 1, i * slot)] = s.name ? `${s.title} (${s.name})` : s.title; });
  aoa.push(signLine);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lead = columns.findIndex((c) => c.type !== 'text');
  const textCount = lead === -1 ? n : lead;
  const labelCol = textCount ? 0 : null;
  if (labelCol !== null) {
    ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = { t: 's', v: 'GRAND TOTAL' };
    if (textCount > 1) merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: textCount - 1 } });
  }
  columns.forEach((c, i) => {
    if (c.type === 'text') return;
    // numeric cells: 2-decimal format
    for (let r = dataStart; r <= dataEnd; r += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: i })];
      if (cell && cell.t === 'n') cell.z = '#,##0.00';
    }
    const v = totalValue(totals, c);
    if (v == null) return;
    const col = XLSX.utils.encode_col(i);
    const ref = XLSX.utils.encode_cell({ r: totalRow, c: i });
    ws[ref] = rows.length
      ? { t: 'n', v, f: `ROUND(SUM(${col}${dataStart + 1}:${col}${dataEnd + 1}),2)`, z: '#,##0.00' }
      : { t: 'n', v: 0, z: '#,##0.00' };
  });
  ws['!merges'] = merges;
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(c.width + 2, String(c.label).length > 14 ? 14 : String(c.label).length + 2) }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: signRow, c: Math.max(0, n - 1) } });
  if (!ws['!rows']) ws['!rows'] = [];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mithram Statement');
  return { XLSX, wb };
};

// ── Helpers for download / email ─────────────────────────────────
export const arrayBufferToBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
export const PDF_TYPE = 'application/pdf';
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
