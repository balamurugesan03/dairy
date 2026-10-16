/**
 * Cash Book — dedicated black & white A4 print, built from the day cards
 * (not a clone of the screen). Same layout as the Day Book print: one date
 * per page; each page carries the society header, the Receipt / Payment
 * sides, and its own President / Secretary signature row.
 *
 * The same HTML is shown in the print preview (iframe), where each page is
 * drawn as a real A4 sheet. Page margins are padding on .page (with
 * @page margin 0), so content width is identical in preview and print.
 */
import dayjs from 'dayjs';
import { escapeHtml, SIGN_CSS, signRowHtml, A4_SIZE } from '../../utils/printA4';

const fmtAmt = (n) => {
  const num = parseFloat(n || 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtBlank = (n) => (parseFloat(n || 0) === 0 ? '' : fmtAmt(n));

const css = (orientation) => {
  const portrait = orientation === 'portrait';
  const { w, h } = A4_SIZE[portrait ? 'portrait' : 'landscape'];
  return `
  @page { size: A4 ${orientation}; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: ${portrait ? '8.5px' : '9.5px'}; }

  .page { width: ${w}; padding: 8mm; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }

  .hdr { text-align: center; padding-bottom: 5px; margin-bottom: 6px; border-bottom: 1.5px solid #000; }
  .hdr__org { font-size: ${portrait ? '14px' : '16px'}; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .hdr__sub { font-size: ${portrait ? '9.5px' : '10.5px'}; margin-top: 1px; }
  .hdr__title { display: inline-block; margin-top: 4px; padding: 1px 16px; font-size: ${portrait ? '11px' : '12px'};
    font-weight: 700; letter-spacing: 4px; text-transform: uppercase; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  .hdr__date { margin-top: 4px; font-size: ${portrait ? '12px' : '13.5px'}; font-weight: 700; }
  .hdr__meta { margin-top: 3px; display: flex; justify-content: space-between; font-size: ${portrait ? '8.5px' : '9.5px'}; }

  table.cb { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.cb th, table.cb td { border: 0.75px solid #444; padding: 2px 3px; vertical-align: top;
    overflow-wrap: anywhere; word-break: break-word; }
  table.cb th { background: #e6e6e6; font-weight: 700; text-transform: uppercase; text-align: center; vertical-align: middle;
    font-size: ${portrait ? '7.5px' : '8.5px'}; }
  table.cb th.side { font-size: ${portrait ? '9px' : '10px'}; letter-spacing: 1px; }
  table.cb tr { page-break-inside: avoid; break-inside: avoid; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ctr { text-align: center; }
  .split { border-left: 1.75px solid #000 !important; }
  .narr { display: block; font-size: 0.85em; font-style: italic; color: #333; }
  .row-bal td { font-weight: 700; background: #f2f2f2; }
  .row-txn td { font-weight: 700; }
  .row-grand td { font-weight: 700; background: #e0e0e0; border-top: 1.5px solid #000; border-bottom: 2.5px double #000; }
  .empty td { text-align: center; font-style: italic; color: #444; }

  ${SIGN_CSS}

  /* Preview only: draw each page as an A4 sheet on a grey desk. */
  @media screen {
    html, body { background: #9e9e9e; }
    body { padding: 12px 0; }
    .page { min-height: ${h}; margin: 0 auto 12px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
  }
  `;
};

const entryCells = (e, sideClass = '') => e
  ? `<td class="${sideClass}">${escapeHtml(e.description)}${e.narration && e.narration !== e.description ? `<span class="narr">${escapeHtml(e.narration)}</span>` : ''}</td>
     <td class="ctr">${escapeHtml(e.voucherNumber)}</td>
     <td class="amt">${fmtBlank(e.amount)}</td>`
  : `<td class="${sideClass}"></td><td></td><td></td>`;

const summaryCells = (label, amount, sideClass = '') => `
  <td class="${sideClass}" colspan="2">${escapeHtml(label)}</td>
  <td class="amt">${fmtAmt(amount)}</td>`;

const pageHtml = (card, ctx) => {
  const rows = Math.max(card.receipts.length, card.payments.length);
  const ob = card.openingBalance;
  const cb = card.closingBalance;

  const body = rows === 0
    ? `<tr class="empty"><td colspan="3">No transactions</td><td colspan="3" class="split">No transactions</td></tr>`
    : Array.from({ length: rows }, (_, i) =>
        `<tr>${entryCells(card.receipts[i])}${entryCells(card.payments[i], 'split')}</tr>`).join('');

  return `
  <section class="page">
    <div class="hdr">
      <div class="hdr__org">${escapeHtml(ctx.societyName)}</div>
      ${ctx.societyCode ? `<div class="hdr__sub">Society Code: ${escapeHtml(ctx.societyCode)}</div>` : ''}
      ${ctx.place ? `<div class="hdr__sub">${escapeHtml(ctx.place)}</div>` : ''}
      <div class="hdr__title">Cash Book</div>
      <div class="hdr__date">${escapeHtml(dayjs(card.date).format('DD / MM / YYYY  (dddd)'))}</div>
      <div class="hdr__meta"><span>Opening: ${fmtAmt(ob)}</span><span>Closing: ${fmtAmt(cb)}</span></div>
    </div>
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
      <tbody>
        ${body}
        <tr class="row-bal">${summaryCells('Opening Balance', ob)}${summaryCells('Closing Balance', cb, 'split')}</tr>
        <tr class="row-txn">${summaryCells('Transactions', card.receiptTotal)}${summaryCells('Transactions', card.paymentTotal, 'split')}</tr>
        <tr class="row-grand">${summaryCells('Grand Total', ob + card.receiptTotal)}${summaryCells('Grand Total', cb + card.paymentTotal, 'split')}</tr>
      </tbody>
    </table>
    ${signRowHtml(ctx.generatedOn)}
  </section>`;
};

/**
 * @param {Array} cards  day cards from CashBook (receipts, payments, totals, balances)
 * @param {object} ctx   { societyName, societyCode, place, generatedOn, title }
 * @param {'portrait'|'landscape'} orientation
 */
export const buildCashBookPrintHtml = (cards, ctx, orientation = 'portrait') => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(ctx.title || 'Cash Book')}</title>
  <style>${css(orientation)}</style>
</head>
<body>${cards.map(c => pageHtml(c, ctx)).join('')}</body>
</html>`;
