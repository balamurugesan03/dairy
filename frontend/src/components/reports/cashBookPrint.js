/**
 * Cash Book — dedicated A4 print, built from the day cards (not a clone of
 * the screen). Same layout as the Day Book print: society header, Receipt /
 * Payment sides, Transaction (Subtotal) → Opening / Closing Balance → Grand
 * Total, then President (left) / Secretary (right) with the Generated date
 * centred.
 *
 * Sheet layout and date-wise pagination live in shared/dayPrintLayout.js.
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
     <td class="amt">${fmtBlank(e.amount)}</td>`
  : `<td class="${sideClass}"></td><td></td><td></td>`;

const summaryCells = (label, amount, sideClass = '') => `
  <td class="${sideClass}" colspan="2">${escapeHtml(label)}</td>
  <td class="amt">${fmtAmt(amount)}</td>`;

const dayHtml = (card, ctx) => {
  const rows = Math.max(card.receipts.length, card.payments.length);
  const ob = card.openingBalance;
  const cb = card.closingBalance;

  const body = rows === 0
    ? `<tr class="empty"><td colspan="3">No transactions</td><td colspan="3" class="split">No transactions</td></tr>`
    : Array.from({ length: rows }, (_, i) =>
        `<tr>${entryCells(card.receipts[i])}${entryCells(card.payments[i], 'split')}</tr>`).join('');

  return `
  <section class="day">
    ${dayHeaderHtml(ctx, 'Cash Book', dayjs(card.date).format('DD / MM / YYYY  (dddd)'),
      `<span>Opening: ${fmtAmt(ob)}</span><span>Closing: ${fmtAmt(cb)}</span>`)}
    <table class="cb">
      <colgroup>
        <col style="width:31%"><col style="width:8%"><col style="width:11%">
        <col style="width:31%"><col style="width:8%"><col style="width:11%">
      </colgroup>
      <thead>
        <tr><th class="side" colspan="3">Receipt (Dr)</th><th class="side split" colspan="3">Payment (Cr)</th></tr>
        <tr>
          <th>Description</th><th>Rcpt No</th><th>Cash</th>
          <th class="split">Description</th><th>Vr No</th><th>Cash</th>
        </tr>
      </thead>
      <tbody class="rows">${body}</tbody>
      <tbody class="tail">
        <tr class="row-txn">${summaryCells('Transaction (Subtotal)', card.receiptTotal)}${summaryCells('Transaction (Subtotal)', card.paymentTotal, 'split')}</tr>
        <tr class="row-bal">${summaryCells('Opening Balance', ob)}${summaryCells('Closing Balance', cb, 'split')}</tr>
        <tr class="row-grand">${summaryCells('Grand Total', ob + card.receiptTotal)}${summaryCells('Grand Total', cb + card.paymentTotal, 'split')}</tr>
      </tbody>
    </table>
    ${daySignHtml(ctx.generatedOn)}
  </section>`;
};

/**
 * @param {Array} cards  day cards from CashBook (receipts, payments, totals, balances)
 * @param {object} ctx   { societyName, societyCode, place, generatedOn, title }
 * @param {'portrait'|'landscape'} orientation
 */
export const buildCashBookPrintHtml = (cards, ctx, orientation = 'portrait') => dayPrintDocument({
  title: ctx.title || 'Cash Book',
  orientation,
  blocksHtml: cards.map(c => dayHtml(c, ctx)).join('')
});
