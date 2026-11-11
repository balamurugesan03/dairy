/**
 * Producer Dues → Payment Bar Reports → Payment Register (Karur, Tamil Nadu)
 *
 * The Cash and Bank registers each have their own simplified layout. Print,
 * PDF and Excel are all built here from the SAME rows + columns, so the three
 * outputs always match.
 *   Cash: Sl No | Producer ID | Producer Name | Net Payable | Signature
 *   Bank: Sl No | Producer ID | Producer Name | Bank Name | Account Number | IFSC Code | Branch | Net Payable
 * With "All Centers", rows are grouped centre-wise with a centre sub-total.
 */
import { escapeHtml } from './printA4';

export const PDF_TYPE = 'application/pdf';
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const REPORT_TITLE = 'Payment Register (Karur, Tamil Nadu)';

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const fmtAmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const COLUMNS = {
  Cash: [
    { key: 'sl',           label: 'Sl No',         width: 7,  align: 'center' },
    { key: 'producerId',   label: 'Producer ID',   width: 14, align: 'center' },
    { key: 'producerName', label: 'Producer Name', width: 38 },
    { key: 'netPayable',   label: 'Net Payable (₹)', width: 17, amount: true },
    { key: 'signature',    label: 'Signature',     width: 24 },
  ],
  Bank: [
    { key: 'sl',            label: 'Sl No',          width: 5,  align: 'center' },
    { key: 'producerId',    label: 'Producer ID',    width: 9,  align: 'center' },
    { key: 'producerName',  label: 'Producer Name',  width: 22 },
    { key: 'bankName',      label: 'Bank Name',      width: 16 },
    { key: 'accountNumber', label: 'Account Number', width: 17 },
    { key: 'ifsc',          label: 'IFSC Code',      width: 11 },
    { key: 'branch',        label: 'Branch',         width: 13 },
    { key: 'netPayable',    label: 'Net Payable (₹)', width: 12, amount: true },
  ],
};

const centreKey = (r) => r.centerCode || '';
const centreTitle = (r) => (r.centerCode ? `${r.centerCode}${r.centerName ? ` - ${r.centerName}` : ''}` : 'No Centre');

/** Rows → sections: [{ title, rows, total }] (one section when a single centre is shown) */
export const groupByCentre = (rows) => {
  const out = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.key === centreKey(r)) last.rows.push(r);
    else out.push({ key: centreKey(r), title: centreTitle(r), rows: [r] });
  }
  out.forEach((s) => { s.total = r2(s.rows.reduce((t, r) => t + (r.netPayable || 0), 0)); });
  return out;
};

export const grandTotal = (rows) => r2(rows.reduce((t, r) => t + (r.netPayable || 0), 0));

const cellText = (row, col, sl) => {
  if (col.key === 'sl') return String(sl);
  if (col.key === 'signature') return '';
  if (col.amount) return fmtAmt(row[col.key]);
  return row[col.key] == null ? '' : String(row[col.key]);
};

/** Header facts shared by all outputs */
export const headerFacts = ({ society = {}, paymentType, cycle, centerLabel, centerCode = '', bankLabel, paymentDate, registerNumber, bankLedgerName, chequeNumber, chequeDetails }) => ({
  societyName: String(society.societyName || '').toUpperCase(),
  societyCode: society.societyCode || '',
  societyPlace: society.societyPlace || '',
  title: REPORT_TITLE.toUpperCase(),
  subtitle: `${paymentType === 'Bank' ? 'BANK PAYMENT REGISTER' : 'CASH PAYMENT REGISTER'} - ${centerCode ? `CENTER ${centerCode}` : 'ALL CENTERS'}`,
  paymentType,
  cycle,
  centerCode,
  bankName: paymentType === 'Bank' && bankLabel && bankLabel !== 'All Banks' ? bankLabel : '',
  meta: [
    ['Payment Cycle', cycle],
    ['Center', centerLabel || 'All Centers'],
    ...(paymentType === 'Bank' ? [['Bank', bankLabel || 'All Banks']] : []),
    ['Payment Date', paymentDate || '-'],
    ...(registerNumber ? [['Register No', registerNumber]] : []),
    ...(paymentType === 'Bank' ? [['Bank Ledger', bankLedgerName || '-'], ['Cheque No', chequeNumber || '-']] : []),
    ...(paymentType === 'Bank' && chequeDetails ? [['Cheque Details', chequeDetails]] : []),
  ],
});

export const SIGNATURES = ['Prepared By', 'Checked By', 'Secretary', 'President'];

export const reportFileName = (facts, ext) =>
  ['Payment_Register_Karur', facts.paymentType, facts.centerCode || 'All_Centers', facts.bankName, facts.cycle].filter(Boolean).join('_').replace(/[^\w-]+/g, '_').replace(/_+/g, '_') + ext;

// ════════════════════════════════════════════════════════════════
//  Print HTML
// ════════════════════════════════════════════════════════════════
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; font-size: 10px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hd { text-align: center; margin-bottom: 6px; }
  .hd .soc { font-size: 15px; font-weight: 700; letter-spacing: 1px; }
  .hd .plc { font-size: 10px; margin-top: 1px; }
  .hd .ttl { display: inline-block; margin-top: 4px; padding: 2px 16px; font-size: 12.5px; font-weight: 700; letter-spacing: 1.5px;
    border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
  .hd .sub { margin-top: 3px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
  .meta { display: flex; flex-wrap: wrap; gap: 2px 18px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 2px; margin-bottom: 5px; font-size: 10px; }
  .meta b { font-weight: 700; }
  table.rg { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.rg th, table.rg td { border: 0.75px solid #333; padding: 3px 4px; vertical-align: middle; overflow-wrap: anywhere; }
  table.rg th { background: #e4e4e4; font-weight: 700; text-align: center; }
  table.rg thead { display: table-header-group; }
  table.rg tr { page-break-inside: avoid; break-inside: avoid; }
  .ctr { text-align: center; } .amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .cash td { height: 26px; }
  .sec td { background: #f0f0f0; font-weight: 700; }
  .sub td { font-weight: 700; background: #fafafa; }
  .grand td { background: #d9d9d9; font-weight: 700; border-top: 1.5px solid #000; border-bottom: 2.5px double #000; }
  .sign { margin-top: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; padding-top: 34px; page-break-inside: avoid; break-inside: avoid; }
  .sign div { text-align: center; border-top: 1px solid #000; padding-top: 3px; font-weight: 700; }
  .gen { margin-top: 6px; font-size: 8.5px; color: #333; }
`;

export const buildPrintHtml = ({ facts, rows, grouped }) => {
  const cols = COLUMNS[facts.paymentType];
  const tw = cols.reduce((s, c) => s + c.width, 0);
  const amtIdx = cols.findIndex((c) => c.amount);
  const totalRow = (label, amount, cls) => `<tr class="${cls}"><td colspan="${amtIdx}" class="ctr">${escapeHtml(label)}</td>`
    + `<td class="amt">${escapeHtml(fmtAmt(amount))}</td>${cols.length - amtIdx - 1 > 0 ? `<td colspan="${cols.length - amtIdx - 1}"></td>` : ''}</tr>`;
  let sl = 0;
  const line = (r) => {
    sl += 1;
    return `<tr>${cols.map((c) => `<td class="${c.amount ? 'amt' : c.align === 'center' ? 'ctr' : ''}">${escapeHtml(cellText(r, c, sl))}</td>`).join('')}</tr>`;
  };
  let body = '';
  if (grouped) {
    for (const s of groupByCentre(rows)) {
      body += `<tr class="sec"><td colspan="${cols.length}">Center: ${escapeHtml(s.title)} (${s.rows.length})</td></tr>`;
      body += s.rows.map(line).join('');
      body += totalRow(`Center Total — ${s.title}`, s.total, 'sub');
    }
  } else {
    body = rows.map(line).join('');
  }
  if (!rows.length) body = `<tr><td colspan="${cols.length}" class="ctr">No producers</td></tr>`;
  body += totalRow(`GRAND TOTAL (${rows.length} Producers)`, grandTotal(rows), 'grand');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8" />
<title>${escapeHtml(reportFileName(facts, ''))}</title>
<style>@page { size: A4 ${facts.paymentType === 'Bank' ? 'landscape' : 'portrait'}; margin: 10mm 8mm; } ${CSS}</style></head>
<body>
  <div class="hd">
    ${facts.societyName ? `<div class="soc">${escapeHtml(facts.societyName)}${facts.societyCode ? ` (${escapeHtml(facts.societyCode)})` : ''}</div>` : ''}
    ${facts.societyPlace ? `<div class="plc">${escapeHtml(facts.societyPlace)}</div>` : ''}
    <div class="ttl">${escapeHtml(facts.title)}</div>
    <div class="sub">${escapeHtml(facts.subtitle)}</div>
  </div>
  <div class="meta">${facts.meta.map(([k, v]) => `<span><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</span>`).join('')}</div>
  <table class="rg ${facts.paymentType === 'Cash' ? 'cash' : ''}">
    <colgroup>${cols.map((c) => `<col style="width:${((c.width / tw) * 100).toFixed(2)}%" />`).join('')}</colgroup>
    <thead><tr>${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="sign">${SIGNATURES.map((s) => `<div>${escapeHtml(s)}</div>`).join('')}</div>
  <div class="gen">Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
</body></html>`;
};

export const printRegister = ({ facts, rows, grouped }) => {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildPrintHtml({ facts, rows, grouped }));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
  return true;
};

// ════════════════════════════════════════════════════════════════
//  PDF (jsPDF + autotable)
// ════════════════════════════════════════════════════════════════
const pdfText = (s) => String(s ?? '').replace(/₹/g, 'Rs.');

export const buildPdf = async ({ facts, rows, grouped }) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const orientation = facts.paymentType === 'Bank' ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  let y = 11;
  const center = (text, size, bold = true) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(pdfText(text), pageW / 2, y, { align: 'center' });
    y += size * 0.45;
  };
  if (facts.societyName) center(`${facts.societyName}${facts.societyCode ? ` (${facts.societyCode})` : ''}`, 13);
  if (facts.societyPlace) center(facts.societyPlace, 9, false);
  center(facts.title, 11.5);
  center(facts.subtitle, 10);
  y += 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setLineWidth(0.3);
  doc.line(margin, y - 3.5, pageW - margin, y - 3.5);
  const metaText = facts.meta.map(([k, v]) => `${k}: ${v}`).join('     ');
  const metaLines = doc.splitTextToSize(pdfText(metaText), pageW - margin * 2);
  doc.text(metaLines, margin, y);
  y += metaLines.length * 3.6;
  doc.line(margin, y - 2, pageW - margin, y - 2);
  y += 1;

  const cols = COLUMNS[facts.paymentType];
  const amtIdx = cols.findIndex((c) => c.amount);
  const totalLine = (label, amount, fill) => [
    { content: pdfText(label), colSpan: amtIdx, styles: { halign: 'center', fontStyle: 'bold', fillColor: fill } },
    { content: fmtAmt(amount), styles: { halign: 'right', fontStyle: 'bold', fillColor: fill } },
    ...(cols.length - amtIdx - 1 > 0 ? [{ content: '', colSpan: cols.length - amtIdx - 1, styles: { fillColor: fill } }] : []),
  ];
  const body = [];
  let sl = 0;
  const push = (r) => { sl += 1; body.push(cols.map((c) => pdfText(cellText(r, c, sl)))); };
  if (grouped) {
    for (const s of groupByCentre(rows)) {
      body.push([{ content: pdfText(`Center: ${s.title} (${s.rows.length})`), colSpan: cols.length, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
      s.rows.forEach(push);
      body.push(totalLine(`Center Total - ${s.title}`, s.total, [250, 250, 250]));
    }
  } else rows.forEach(push);
  body.push(totalLine(`GRAND TOTAL (${rows.length} Producers)`, grandTotal(rows), [217, 217, 217]));

  const tw = cols.reduce((s, c) => s + c.width, 0);
  const usable = pageW - margin * 2;
  autoTable(doc, {
    startY: y,
    head: [cols.map((c) => pdfText(c.label))],
    body,
    showHead: 'everyPage',
    theme: 'grid',
    margin: { left: margin, right: margin, top: 10, bottom: 12 },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.3, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: 0, overflow: 'linebreak', valign: 'middle',
      minCellHeight: facts.paymentType === 'Cash' ? 8 : 0 },
    headStyles: { fillColor: [228, 228, 228], textColor: 0, fontStyle: 'bold', halign: 'center' },
    columnStyles: Object.fromEntries(cols.map((c, i) => [i, { cellWidth: (c.width / tw) * usable, halign: c.amount ? 'right' : (c.align || 'left') }])),
  });

  let sy = (doc.lastAutoTable?.finalY || y) + 22;
  if (sy > pageH - 14) { doc.addPage('a4', orientation); sy = 30; }
  const w = usable / SIGNATURES.length;
  doc.setFontSize(9);
  SIGNATURES.forEach((s, i) => {
    const cx = margin + w * i + w / 2;
    doc.setLineWidth(0.25);
    doc.line(cx - w / 2 + 8, sy, cx + w / 2 - 8, sy);
    doc.setFont('helvetica', 'bold');
    doc.text(s, cx, sy + 4, { align: 'center' });
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, margin, sy + 10);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 5, { align: 'right' });
  }
  return doc;
};

// ════════════════════════════════════════════════════════════════
//  Excel (SheetJS) — same columns and order as the PDF
// ════════════════════════════════════════════════════════════════
export const buildWorkbook = async ({ facts, rows, grouped }) => {
  const XLSX = await import('xlsx');
  const cols = COLUMNS[facts.paymentType];
  const n = cols.length;
  const amtIdx = cols.findIndex((c) => c.amount);
  const aoa = [];
  const merges = [];
  const mergeRow = (r, from = 0, to = n - 1) => merges.push({ s: { r, c: from }, e: { r, c: to } });
  [
    facts.societyName ? `${facts.societyName}${facts.societyCode ? ` (${facts.societyCode})` : ''}` : '',
    facts.societyPlace, facts.title, facts.subtitle,
  ].filter(Boolean).forEach((t) => { mergeRow(aoa.length); aoa.push([t]); });
  facts.meta.forEach(([k, v]) => { mergeRow(aoa.length); aoa.push([`${k}: ${v}`]); });
  aoa.push([]);
  aoa.push(cols.map((c) => c.label));

  const amountRows = [];
  const totalRows = [];
  let sl = 0;
  const pushRow = (r) => {
    sl += 1;
    amountRows.push(aoa.length);
    aoa.push(cols.map((c) => {
      if (c.key === 'sl') return sl;
      if (c.key === 'signature') return '';
      if (c.amount) return r2(r[c.key]);
      return r[c.key] == null ? '' : String(r[c.key]);   // account numbers stay text
    }));
  };
  const pushTotal = (label, amount, firstRow, lastRow) => {
    const line = cols.map(() => '');
    line[0] = label;
    line[amtIdx] = amount;
    if (amtIdx > 1) mergeRow(aoa.length, 0, amtIdx - 1);
    totalRows.push({ r: aoa.length, firstRow, lastRow, amount });
    aoa.push(line);
  };
  const sectionStarts = [];
  if (grouped) {
    for (const s of groupByCentre(rows)) {
      mergeRow(aoa.length);
      aoa.push([`Center: ${s.title} (${s.rows.length})`]);
      const first = aoa.length;
      sectionStarts.push(first);
      s.rows.forEach(pushRow);
      pushTotal(`Center Total — ${s.title}`, s.total, first, aoa.length - 1);
    }
  } else rows.forEach(pushRow);
  const grandAt = aoa.length;
  const line = cols.map(() => '');
  line[0] = `GRAND TOTAL (${rows.length} Producers)`;
  line[amtIdx] = grandTotal(rows);
  if (amtIdx > 1) mergeRow(grandAt, 0, amtIdx - 1);
  aoa.push(line);
  aoa.push([], []);
  const signLine = cols.map(() => '');
  const slot = Math.max(1, Math.floor(n / SIGNATURES.length));
  SIGNATURES.forEach((s, i) => { signLine[Math.min(n - 1, i * slot)] = s; });
  aoa.push(signLine);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const col = XLSX.utils.encode_col(amtIdx);
  amountRows.forEach((r) => { const c = ws[XLSX.utils.encode_cell({ r, c: amtIdx })]; if (c) c.z = '#,##0.00'; });
  totalRows.forEach(({ r, firstRow, lastRow, amount }) => {
    ws[XLSX.utils.encode_cell({ r, c: amtIdx })] = { t: 'n', v: amount, f: `ROUND(SUM(${col}${firstRow + 1}:${col}${lastRow + 1}),2)`, z: '#,##0.00' };
  });
  ws[XLSX.utils.encode_cell({ r: grandAt, c: amtIdx })] = totalRows.length
    ? { t: 'n', v: grandTotal(rows), f: `ROUND(${totalRows.map(({ r }) => `${col}${r + 1}`).join('+')},2)`, z: '#,##0.00' }
    : amountRows.length
      ? { t: 'n', v: grandTotal(rows), f: `ROUND(SUM(${col}${amountRows[0] + 1}:${col}${amountRows[amountRows.length - 1] + 1}),2)`, z: '#,##0.00' }
      : { t: 'n', v: 0, z: '#,##0.00' };
  ws['!merges'] = merges;
  ws['!cols'] = cols.map((c) => ({ wch: c.key === 'signature' ? 24 : c.key === 'producerName' ? 30 : Math.max(c.width + 3, c.label.length + 2) }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: n - 1 } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, facts.paymentType === 'Bank' ? 'Bank Payment Register' : 'Cash Payment Register');
  return { XLSX, wb };
};

export const arrayBufferToBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
