/**
 * Day Book — dedicated A4 print, built from the day cards (not a clone of the
 * screen) but laid out like it: society header, Receipt / Payment sides,
 * Transaction (Subtotal) → Opening / Closing Balance → Grand Total, then
 * President (left) / Secretary (right) with the Generated date centred.
 *
 * Sheet layout and date-wise pagination live in shared/dayPrintLayout.js
 * (shared with the Cash Book print).
 */
import dayjs from 'dayjs';
import { escapeHtml } from '../../utils/printA4';
import { dayHeaderHtml, daySignHtml, dayPrintDocument } from './shared/dayPrintLayout';

const fmtAmt = (n) => {
  const num = parseFloat(n || 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtBlank = (n) => (parseFloat(n || 0) === 0 ? '' : fmtAmt(n));

const entryCells = (e, sideClass = '') => e
  ? `<td class="${sideClass}">${escapeHtml(e.description)}${e.narration && e.narration !== e.description ? `<span class="narr">${escapeHtml(e.narration)}</span>` : ''}</td>
     <td class="ctr">${escapeHtml(e.voucherNumber)}</td>
     <td class="amt">${fmtBlank(e.cash)}</td>
     <td class="amt">${fmtBlank(e.adjustment)}</td>
     <td class="amt">${fmtBlank(e.total)}</td>`
  : `<td class="${sideClass}"></td><td></td><td></td><td></td><td></td>`;

const summaryCells = (label, cash, adj, total, sideClass = '') => `
  <td class="${sideClass}" colspan="2">${escapeHtml(label)}</td>
  <td class="amt">${cash === null ? '' : fmtAmt(cash)}</td>
  <td class="amt">${adj === null ? '' : fmtAmt(adj)}</td>
  <td class="amt">${fmtAmt(total)}</td>`;

const dayHtml = (card, ctx) => {
  const rows = Math.max(card.receipts.length, card.payments.length);
  const r = card.receiptTotals;
  const p = card.paymentTotals;
  const ob = card.openingBalance;
  const cb = card.closingBalance;

  const body = rows === 0
    ? `<tr class="empty"><td colspan="5">No transactions</td><td colspan="5" class="split">No transactions</td></tr>`
    : Array.from({ length: rows }, (_, i) =>
        `<tr>${entryCells(card.receipts[i])}${entryCells(card.payments[i], 'split')}</tr>`).join('');

  const colgroup = `
    <col style="width:20%"><col style="width:6%"><col style="width:8.5%"><col style="width:7%"><col style="width:8.5%">
    <col style="width:20%"><col style="width:6%"><col style="width:8.5%"><col style="width:7%"><col style="width:8.5%">`;

  return `
  <section class="day">
    ${dayHeaderHtml(ctx, 'Day Book', dayjs(card.date).format('DD / MM / YYYY  (dddd)'),
      `<span>Opening: ${fmtAmt(ob)}</span><span>Closing: ${fmtAmt(cb)}</span>`)}
    <table class="db">
      <colgroup>${colgroup}</colgroup>
      <thead>
        <tr><th class="side" colspan="5">Receipt (Dr)</th><th class="side split" colspan="5">Payment (Cr)</th></tr>
        <tr>
          <th>Description</th><th>Rcpt No</th><th>Cash</th><th>Adjust&shy;ment</th><th>Total</th>
          <th class="split">Description</th><th>Vr No</th><th>Cash</th><th>Adjust&shy;ment</th><th>Total</th>
        </tr>
      </thead>
      <tbody class="rows">${body}</tbody>
      <tbody class="tail">
        <tr class="row-txn">${summaryCells('Transaction (Subtotal)', r.cash, r.adj, r.total)}${summaryCells('Transaction (Subtotal)', p.cash, p.adj, p.total, 'split')}</tr>
        <tr class="row-bal">${summaryCells('Opening Balance', ob, null, ob)}${summaryCells('Closing Balance', cb, null, cb, 'split')}</tr>
        <tr class="row-grand">${summaryCells('Grand Total', ob + r.cash, r.adj, ob + r.total)}${summaryCells('Grand Total', cb + p.cash, p.adj, cb + p.total, 'split')}</tr>
      </tbody>
    </table>
    ${daySignHtml(ctx.generatedOn)}
  </section>`;
};

/**
 * @param {Array} cards  day cards from DayBook (receipts, payments, totals, balances)
 * @param {object} ctx   { societyName, societyCode, place, generatedOn, title }
 * @param {'portrait'|'landscape'} orientation
 */
export const buildDayBookPrintHtml = (cards, ctx, orientation = 'landscape') => dayPrintDocument({
  title: ctx.title || 'Day Book',
  orientation,
  blocksHtml: cards.map(c => dayHtml(c, ctx)).join('')
});
