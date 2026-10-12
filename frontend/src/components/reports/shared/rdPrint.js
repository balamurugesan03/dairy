import dayjs from 'dayjs';
import { openA4Print, a4Header, escapeHtml } from '../../../utils/printA4';

// Dedicated A4 print for the Receipt & Disbursement statement (Single / Two /
// Three Column). Expects the unified R&D shape returned by
// /reports/rd-statement-unified:
//   { openingBalance, closingBalance, openingBalanceFY, closingBalanceFY,
//     monthStart, sections: [{ sectionName, ledgers: [...], groupTotal }], grandTotal }
// where each ledger / groupTotal / grandTotal carries receiptCash, receiptAdj,
// receiptTotal, paymentCash, paymentAdj, paymentTotal and uptoR, duringR,
// eomR, uptoP, duringP, eomP.

const f  = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const fz = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const td = (v, cls = 'amt') => `<td class="${cls}">${v}</td>`;

const singleHtml = (data, showGroups, totalLabel) => {
  const ob = data.openingBalance || 0;
  const cb = Math.max(0, data.closingBalance || 0);
  const rT = data.grandTotal?.receiptTotal || 0;
  const pT = data.grandTotal?.paymentTotal || 0;
  const grand = Math.max(ob + rT, pT + cb);
  let rows = `<tr class="row-bal"><td>Opening Balance (Cash in Hand)</td>${td(fz(ob))}${td('')}</tr>`;
  data.sections.forEach(sec => {
    if (showGroups) rows += `<tr class="row-sec"><td colspan="3">${escapeHtml(sec.sectionName)}</td></tr>`;
    sec.ledgers.forEach(l => {
      rows += `<tr><td class="indent">${escapeHtml(l.ledgerName)}</td>${td(f(l.receiptTotal))}${td(f(l.paymentTotal))}</tr>`;
    });
    if (showGroups) rows += `<tr class="row-sub"><td class="indent">${totalLabel}</td>${td(fz(sec.groupTotal.receiptTotal))}${td(fz(sec.groupTotal.paymentTotal))}</tr>`;
  });
  rows += `<tr class="row-sub"><td>SUB-TOTAL (Transactions)</td>${td(fz(rT))}${td(fz(pT))}</tr>`;
  rows += `<tr class="row-bal"><td>Closing Balance (Cash in Hand)</td>${td('')}${td(fz(cb))}</tr>`;
  rows += `<tr class="row-grand"><td>GRAND TOTAL</td>${td(fz(grand))}${td(fz(grand))}</tr>`;
  return `
    <table class="a4">
      <colgroup><col style="width:52%"><col style="width:24%"><col style="width:24%"></colgroup>
      <thead><tr><th>Ledger</th><th>Receipt (Dr)</th><th>Payment (Cr)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
};

const twoSideHtml = (side, data, showGroups, totalLabel) => {
  const isR = side === 'receipt';
  const ob = data.openingBalance || 0;
  const cb = Math.max(0, data.closingBalance || 0);
  const gt = data.grandTotal || {};
  const k = (l, part) => l[(isR ? 'receipt' : 'payment') + part];
  let rows = isR ? `<tr class="row-bal"><td>Opening Balance</td>${td('')}${td(fz(ob))}${td(fz(ob))}</tr>` : '';
  data.sections.forEach(sec => {
    const items = sec.ledgers.filter(l => k(l, 'Total') > 0);
    if (!items.length) return;
    if (showGroups) rows += `<tr class="row-sec"><td colspan="4">${escapeHtml(sec.sectionName)}</td></tr>`;
    items.forEach(l => {
      rows += `<tr><td class="indent">${escapeHtml(l.ledgerName)}</td>${td(f(k(l, 'Adj')))}${td(f(k(l, 'Cash')))}${td(f(k(l, 'Total')))}</tr>`;
    });
    if (showGroups) {
      const t = sec.groupTotal;
      rows += `<tr class="row-sub"><td class="indent">${totalLabel}</td>${td(fz(k(t, 'Adj')))}${td(fz(k(t, 'Cash')))}${td(fz(k(t, 'Total')))}</tr>`;
    }
  });
  rows += `<tr class="row-sub"><td>${isR ? 'SUB-TOTAL (Receipts)' : 'SUB-TOTAL (Payments)'}</td>${td(fz(k(gt, 'Adj')))}${td(fz(k(gt, 'Cash')))}${td(fz(k(gt, 'Total')))}</tr>`;
  if (!isR) rows += `<tr class="row-bal"><td>Closing Balance</td>${td('')}${td(fz(cb))}${td(fz(cb))}</tr>`;
  const grand = Math.max(ob + (gt.receiptTotal || 0), (gt.paymentTotal || 0) + cb);
  rows += `<tr class="row-grand"><td>GRAND TOTAL</td>${td('')}${td('')}${td(fz(grand))}</tr>`;
  return `
    <div class="rd-half">
      <div class="rd-side-title">${isR ? 'Receipt (Dr)' : 'Payment / Disbursement (Cr)'}</div>
      <table class="a4">
        <colgroup><col style="width:43%"><col style="width:19%"><col style="width:19%"><col style="width:19%"></colgroup>
        <thead><tr><th>Ledger</th><th>Adjustment</th><th>Cash</th><th>Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
};

const threeHtml = (data, showGroups, totalLabel) => {
  const monthLabel = data.monthStart ? dayjs(data.monthStart).format('MMM YYYY') : '';
  const ob = data.openingBalanceFY ?? data.openingBalance ?? 0;
  const cb = Math.max(0, (data.closingBalanceFY ?? data.closingBalance) || 0);
  const gt = data.grandTotal || {};
  const grandUpto   = Math.max((gt.uptoR || 0) + ob, gt.uptoP || 0);
  const grandDuring = Math.max(gt.duringR || 0, gt.duringP || 0);
  const grandEom    = Math.max((gt.eomR || 0) + ob, (gt.eomP || 0) + cb);
  const six = (o, fmt) => ['uptoR', 'duringR', 'eomR', 'uptoP', 'duringP', 'eomP']
    .map((key, i) => td(fmt(o[key]), i === 3 ? 'amt split' : 'amt')).join('');
  let rows = '';
  data.sections.forEach(sec => {
    if (showGroups) rows += `<tr class="row-sec"><td colspan="7">${escapeHtml(sec.sectionName)}</td></tr>`;
    sec.ledgers.forEach(l => { rows += `<tr><td class="indent">${escapeHtml(l.ledgerName)}</td>${six(l, f)}</tr>`; });
    if (showGroups) rows += `<tr class="row-sub"><td class="indent">${totalLabel}</td>${six(sec.groupTotal, fz)}</tr>`;
  });
  rows += `<tr class="row-bal"><td>Opening Balance (Cash)</td>${td(fz(ob))}${td('')}${td(fz(ob))}${td('', 'split')}${td('')}${td('')}</tr>`;
  rows += `<tr class="row-sub"><td>SUB-TOTAL</td>${six(gt, fz)}</tr>`;
  rows += `<tr class="row-bal"><td>Closing Balance (Cash)</td>${td('')}${td('')}${td('')}${td(fz(cb), 'amt split')}${td(fz(cb))}${td(fz(cb))}</tr>`;
  rows += `<tr class="row-grand"><td>GRAND TOTAL</td>${td(fz(grandUpto))}${td(fz(grandDuring))}${td(fz(grandEom))}`
    + `${td(fz(grandUpto), 'amt split')}${td(fz(grandDuring))}${td(fz(grandEom))}</tr>`;
  return `
    <table class="a4">
      <colgroup><col style="width:28%">${'<col style="width:12%">'.repeat(6)}</colgroup>
      <thead>
        <tr><th rowspan="2">Ledger</th><th colspan="3">Receipt</th><th colspan="3" class="split">Payment</th></tr>
        <tr>
          <th>Upto Month<br/><i>Before ${monthLabel}</i></th><th>During the Month<br/><i>${monthLabel}</i></th><th>End of the Month<br/><i>Cumulative</i></th>
          <th class="split">Upto Month<br/><i>Before ${monthLabel}</i></th><th>During the Month<br/><i>${monthLabel}</i></th><th>End of the Month<br/><i>Cumulative</i></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

/**
 * @param {object} opts
 * @param {object} opts.data          unified R&D data (see top of file)
 * @param {'single'|'two'|'three'} opts.columnFormat
 * @param {boolean} opts.showGroups   print section header / total rows
 * @param {string}  opts.totalLabel   label of each section's total row
 * @param {string}  opts.companyName
 * @param {Date[]}  opts.dateRange    [from, to]
 * @param {string}  [opts.viewLabel]  e.g. "Account Group Wise"
 */
export const printRDStatement = ({ data, columnFormat, showGroups = true, totalLabel = 'Account Group Total', companyName, dateRange, viewLabel = '' }) => {
  const monthDate = columnFormat === 'three' ? (data.monthStart || dateRange[1]) : dateRange[0];
  const formatLabel = columnFormat === 'three' ? 'Three Column' : columnFormat === 'two' ? 'Two Column' : 'Single Column';
  const body = columnFormat === 'two'
    ? `<div class="rd-two">${twoSideHtml('receipt', data, showGroups, totalLabel)}${twoSideHtml('payment', data, showGroups, totalLabel)}</div>`
    : columnFormat === 'three'
      ? threeHtml(data, showGroups, totalLabel)
      : singleHtml(data, showGroups, totalLabel);

  openA4Print({
    title: `R&D Statement – ${companyName}`,
    orientation: columnFormat === 'single' ? 'portrait' : 'landscape',
    css: `
      .rd-two { display: flex; gap: 6px; align-items: flex-start; }
      .rd-half { flex: 1 1 0; min-width: 0; }
      .rd-side-title { text-align: center; font-weight: 700; font-size: 10px; text-transform: uppercase;
        letter-spacing: 1px; padding: 2px 0; border: 0.75px solid #444; border-bottom: none; background: #d9d9d9; }
      table.a4 th i { font-weight: 400; text-transform: none; font-size: 7.5px; }
      .rd-foot { margin-top: 10px; font-size: 8.5px; color: #333; text-align: right; }
    `,
    bodyHtml: a4Header({
      orgName: companyName,
      title: `Receipt and Disbursement for the month ${monthDate ? dayjs(monthDate).format('MMMM-YYYY').toUpperCase() : ''}`,
      period: `${dayjs(dateRange[0]).format('DD/MM/YYYY')} to ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`,
      extra: `${formatLabel}${viewLabel ? ` · ${escapeHtml(viewLabel)}` : ''} &nbsp;|&nbsp; Printed: ${dayjs().format('DD/MM/YYYY')}`
    }) + body + '<div class="rd-foot">Computer generated statement — No signature required.</div>'
  });
};
