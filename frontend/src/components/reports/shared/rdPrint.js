import dayjs from 'dayjs';
import { openA4Print, escapeHtml } from '../../../utils/printA4';

// Receipt and Disbursements statement (Single / Two / Three Column) — one
// HTML builder shared by the on-screen view and the A4 print, so the two
// always match. Layout follows the society's statutory format: serif type,
// black on white, solid outer border with dotted inner lines.
//
// Expects the unified shape returned by /reports/rd-statement-unified:
//   { openingBalance, closingBalance, openingBalanceFY, closingBalanceFY,
//     monthStart, sections: [{ sectionName, ledgers: [...], groupTotal }], grandTotal }
// where each ledger / groupTotal / grandTotal carries receiptCash, receiptAdj,
// receiptTotal, paymentCash, paymentAdj, paymentTotal and uptoR, duringR,
// eomR, uptoP, duringP, eomP.

// Plain 2-decimal amounts, no thousand separators; blank when zero.
const f  = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toFixed(2); };
const fz = (n) => parseFloat(n || 0).toFixed(2);
const td = (v) => `<td class="amt">${v}</td>`;

// Scoped under .rd-doc so it can be injected on screen without leaking.
export const RD_CSS = `
  .rd-doc { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; font-size: var(--rd-fs, 13px); }
  .rd-doc .rd-head { text-align: center; margin-bottom: 8px; line-height: 1.35; }
  .rd-doc .rd-head__org { font-size: 1.25em; text-transform: uppercase; }
  .rd-doc .rd-head__title { margin-top: 2px; font-weight: 700; text-decoration: underline; text-transform: uppercase; }
  .rd-doc table.rd { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #000; }
  .rd-doc table.rd th, .rd-doc table.rd td { border: 1px dotted #000; padding: 2px 5px; vertical-align: top;
    overflow-wrap: anywhere; word-break: break-word; }
  .rd-doc table.rd th { font-weight: 700; text-align: center; vertical-align: middle; }
  .rd-doc table.rd thead { display: table-header-group; }
  .rd-doc table.rd tr { page-break-inside: avoid; break-inside: avoid; }
  .rd-doc .amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .rd-doc .rd-grp td { font-weight: 700; }
  .rd-doc .rd-led td:first-child { padding-left: 24px; text-transform: uppercase; }
  .rd-doc table.rd-two .rd-led td:first-child { padding-left: 5px; }
  .rd-doc table.rd th.sub { font-weight: 400; text-align: right; }
  .rd-doc .rd-gt td { font-weight: 700; }
  .rd-doc .rd-gt td:first-child { text-align: center; }
  .rd-doc table.rd-three .rd-gt td:first-child { text-align: right; }
  .rd-doc .rd-tot td { font-weight: 700; border-top: 1.5px solid #000; }
  .rd-doc .rd-tot td:first-child, .rd-doc .rd-grand td:first-child { text-align: right; }
  .rd-doc .rd-cash td { font-weight: 700; font-style: italic; }
  .rd-doc .rd-cash td:first-child { text-align: center; }
  .rd-doc .rd-grand td { font-weight: 700; border-top: 3px double #000; border-bottom: 3px double #000; }
`;

const CASH_LABEL = 'Cash Balance (Opening Balance) (Closing Balance)';

// Group header + ledger rows + group total, shared by every format.
const sectionRows = (data, showGroups, totalLabel, colCount, cells) => {
  let rows = '';
  data.sections.forEach(sec => {
    if (showGroups) rows += `<tr class="rd-grp"><td colspan="${colCount}">${escapeHtml(sec.sectionName)}</td></tr>`;
    sec.ledgers.forEach(l => { rows += `<tr class="rd-led"><td>${escapeHtml(l.ledgerName)}</td>${cells(l, f)}</tr>`; });
    if (showGroups) rows += `<tr class="rd-gt"><td>${totalLabel}</td>${cells(sec.groupTotal, f)}</tr>`;
  });
  return rows;
};

const singleHtml = (data, showGroups, totalLabel) => {
  const ob = data.openingBalance || 0;
  const cb = data.closingBalance || 0;
  const gt = data.grandTotal || {};
  let rows = sectionRows(data, showGroups, totalLabel, 3, (o, fmt) => td(fmt(o.receiptTotal)) + td(fmt(o.paymentTotal)));
  rows += `<tr class="rd-tot"><td>Total</td>${td(fz(gt.receiptTotal))}${td(fz(gt.paymentTotal))}</tr>`;
  rows += `<tr class="rd-cash"><td>${CASH_LABEL}</td>${td(fz(ob))}${td(fz(cb))}</tr>`;
  rows += `<tr class="rd-grand"><td>Grand Total</td>${td(fz((gt.receiptTotal || 0) + ob))}${td(fz((gt.paymentTotal || 0) + cb))}</tr>`;
  return `
    <table class="rd">
      <colgroup><col style="width:65%"><col style="width:17.5%"><col style="width:17.5%"></colgroup>
      <thead><tr><th>Ledger</th><th>Receipt</th><th>Payment</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

// Two Column — one table: Receipt (Adjustment | Cash | Total) and
// Payment (Adjustment | Cash | Total) side by side on every ledger row.
const twoHtml = (data, showGroups, totalLabel) => {
  const ob = data.openingBalance || 0;
  const cb = data.closingBalance || 0;
  const gt = data.grandTotal || {};
  const six = (o, fmt) => ['receiptAdj', 'receiptCash', 'receiptTotal', 'paymentAdj', 'paymentCash', 'paymentTotal']
    .map(k => td(fmt(o[k]))).join('');
  let rows = sectionRows(data, showGroups, totalLabel, 7, six);
  rows += `<tr class="rd-tot"><td>Total</td>${six(gt, fz)}</tr>`;
  rows += `<tr class="rd-cash"><td>${CASH_LABEL}</td>${td('')}${td(fz(ob))}${td(fz(ob))}${td('')}${td(fz(cb))}${td(fz(cb))}</tr>`;
  rows += `<tr class="rd-grand"><td>Grand Total</td>`
    + `${td('')}${td(fz((gt.receiptCash || 0) + ob))}${td(fz((gt.receiptTotal || 0) + ob))}`
    + `${td('')}${td(fz((gt.paymentCash || 0) + cb))}${td(fz((gt.paymentTotal || 0) + cb))}</tr>`;
  const sub = '<th class="sub">Adjustment</th><th class="sub">Cash</th><th class="sub">Total</th>';
  return `
    <table class="rd rd-two">
      <colgroup><col style="width:40%">${'<col style="width:10%">'.repeat(6)}</colgroup>
      <thead>
        <tr><th rowspan="2">Ledger</th><th colspan="3">Receipt</th><th colspan="3">Payment</th></tr>
        <tr>${sub}${sub}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

// Three Column — Upto Month | During the Month | End of the Month (FY-anchored).
// Cash row: Receipt side carries the opening balances (FY start, month start,
// FY start); Payment side the closings (before the month, month end, month
// end). Each Grand Total column = its Total + its Cash Balance, so Receipt
// and Payment agree column by column.
const threeHtml = (data, showGroups, totalLabel) => {
  const obFY    = data.openingBalanceFY ?? data.openingBalance ?? 0;
  const obMonth = data.openingBalanceMonth ?? obFY;
  const cb      = data.closingBalanceFY ?? data.closingBalance ?? 0;
  const gt = data.grandTotal || {};
  const keys = ['uptoR', 'duringR', 'eomR', 'uptoP', 'duringP', 'eomP'];
  const cash = [obFY, obMonth, obFY, obMonth, cb, cb];
  const six = (o, fmt) => keys.map(k => td(fmt(o[k]))).join('');
  const label = totalLabel === 'Account Group Total' ? 'Group Total' : totalLabel;
  let rows = sectionRows(data, showGroups, label, 7, six);
  rows += `<tr class="rd-tot"><td>Total</td>${six(gt, fz)}</tr>`;
  rows += `<tr class="rd-cash"><td>${CASH_LABEL}</td>${cash.map(v => td(fz(v))).join('')}</tr>`;
  rows += `<tr class="rd-grand"><td>Grand Total</td>${keys.map((k, i) => td(fz((gt[k] || 0) + cash[i]))).join('')}</tr>`;
  const sub = '<th>Upto Month</th><th>During the Month</th><th>End of the Month</th>';
  return `
    <table class="rd rd-three">
      <colgroup><col style="width:32%">${'<col style="width:11.33%">'.repeat(6)}</colgroup>
      <thead>
        <tr><th rowspan="2">Ledger</th><th colspan="3">Receipt</th><th colspan="3">Payment</th></tr>
        <tr>${sub}${sub}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/**
 * Full statement document (header + table) as an HTML string.
 * @param {object} opts
 * @param {object} opts.data          unified R&D data (see top of file)
 * @param {'single'|'two'|'three'} opts.columnFormat
 * @param {boolean} opts.showGroups   print group header / total rows
 * @param {string}  opts.totalLabel   label of each group's total row
 * @param {string}  opts.companyName
 * @param {string}  [opts.societyCode]
 * @param {Date[]}  opts.dateRange    [from, to]
 */
export const rdDocHtml = ({ data, columnFormat, showGroups = true, totalLabel = 'Account Group Total', companyName, societyCode = '', dateRange }) => {
  const monthDate = columnFormat === 'three' ? (data.monthStart || dateRange[1]) : dateRange[0];
  const month = monthDate ? dayjs(monthDate).format('MMMM-YYYY').toUpperCase() : '';
  const table = columnFormat === 'two'
    ? twoHtml(data, showGroups, totalLabel)
    : columnFormat === 'three'
      ? threeHtml(data, showGroups, totalLabel)
      : singleHtml(data, showGroups, totalLabel);
  return `
    <div class="rd-head">
      <div class="rd-head__org">${escapeHtml(companyName)}</div>
      ${societyCode ? `<div>${escapeHtml(societyCode)}</div>` : ''}
      <div class="rd-head__title">Receipt and Disbursement for the month ${month}</div>
      <div>End of The Month</div>
    </div>
    ${table}`;
};

/** A4 print — portrait for Single / Two Column, landscape for Three Column. */
export const printRDStatement = (opts) => {
  const { columnFormat, companyName } = opts;
  openA4Print({
    title: `Receipt and Disbursements – ${companyName}`,
    orientation: columnFormat === 'three' ? 'landscape' : 'portrait',
    css: RD_CSS,
    bodyHtml: `<div class="rd-doc" style="--rd-fs:${columnFormat === 'single' ? '10pt' : '9pt'}">${rdDocHtml(opts)}</div>`
  });
};
