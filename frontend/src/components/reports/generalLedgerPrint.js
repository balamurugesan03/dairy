/**
 * General Ledger — dedicated black & white A4 print built from the processed
 * register data (not a clone of the screen, so no scrollbars or screen
 * colours reach the paper). Only the header row is shaded; month, total and
 * balance rows are set apart with bold text and rules.
 *
 * The same HTML is shown in the print preview (iframe). On paper the page
 * margin comes from @page; on screen .page carries the same margin as
 * padding on an A4-wide sheet, so the content width is identical in preview
 * and print.
 */
import dayjs from 'dayjs';
import { escapeHtml, SIGN_CSS, signRowHtml, A4_SIZE } from '../../utils/printA4';

const fmtAmt = (n) =>
  parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBlank = (n) => (parseFloat(n || 0) === 0 ? '' : fmtAmt(n));

const MARGIN = '8mm';

const css = (orientation) => {
  const portrait = orientation === 'portrait';
  const { w, h } = A4_SIZE[portrait ? 'portrait' : 'landscape'];
  return `
  @page { size: A4 ${orientation}; margin: ${MARGIN}; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: ${portrait ? '8.5px' : '9.5px'};
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .hdr { text-align: center; padding-bottom: 5px; margin-bottom: 6px; border-bottom: 1.5px solid #000; }
  .hdr__org { font-size: ${portrait ? '14px' : '16px'}; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .hdr__sub { font-size: ${portrait ? '9.5px' : '10.5px'}; margin-top: 1px; }
  .hdr__title { display: inline-block; margin-top: 4px; padding: 1px 16px; font-size: ${portrait ? '11px' : '12px'};
    font-weight: 700; letter-spacing: 4px; text-transform: uppercase; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  .hdr__meta { margin-top: 5px; display: flex; justify-content: space-between; align-items: flex-end; text-align: left;
    font-size: ${portrait ? '8.5px' : '9.5px'}; }
  .hdr__meta > div:last-child { text-align: right; }
  .hdr__head { font-size: ${portrait ? '11px' : '12.5px'}; font-weight: 700; text-transform: uppercase; }

  table.gl { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.gl th, table.gl td { border: 0.75px solid #444; padding: 2px 4px; vertical-align: top;
    overflow-wrap: anywhere; word-break: break-word; }
  table.gl th { background: #e6e6e6; font-weight: 700; text-transform: uppercase; text-align: center; vertical-align: middle;
    font-size: ${portrait ? '7.5px' : '8.5px'}; }
  table.gl thead { display: table-header-group; }
  table.gl tr { page-break-inside: avoid; break-inside: avoid; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ctr { text-align: center; }
  .b { font-weight: 700; }
  .bt { font-size: 0.85em; margin-left: 2px; }
  .narr { display: block; font-size: 0.85em; font-style: italic; color: #333; }
  .row-bal td { font-weight: 700; }
  .row-month td { font-weight: 700; text-align: center; letter-spacing: 1px; text-transform: uppercase; border-top: 1.25px solid #000; }
  .row-mtot td { font-weight: 700; border-top: 1.25px solid #000; border-bottom: 1.25px solid #000; }
  .row-grand td { font-weight: 700; border-top: 1.5px solid #000; border-bottom: 2.5px double #000; }
  .empty td { text-align: center; font-style: italic; color: #444; padding: 8px; }

  ${SIGN_CSS}

  @media print { .page { width: auto; padding: 0; } }
  /* Preview only: draw the report on an A4 sheet on a grey desk. */
  @media screen {
    html, body { background: #9e9e9e; }
    body { padding: 12px 0; }
    .page { width: ${w}; min-height: ${h}; padding: ${MARGIN}; margin: 0 auto; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
  }
  `;
};

const blankCells = (n) => '<td></td>'.repeat(n);

/**
 * @param {object} data  processedData from GeneralLedger (months, balances, totals, ledgerName, ledgerType)
 * @param {object} ctx   { societyName, societyCode, place, period, financialYear, generatedOn, title }
 * @param {'portrait'|'landscape'} orientation
 */
export const buildGeneralLedgerPrintHtml = (data, ctx, orientation = 'landscape') => {
  const months = data.months.map((m) => `
    <tr class="row-month"><td colspan="7">Month : ${escapeHtml(m.key)}</td></tr>
    ${m.rows.map((r) => `
      <tr>
        <td class="ctr">${escapeHtml(dayjs(r.date).format('DD'))}</td>
        <td class="amt">${fmtBlank(r.receipt)}</td>
        <td class="amt">${r.receipt > 0 ? fmtAmt(r.progReceipt) : ''}</td>
        <td class="amt">${fmtBlank(r.payment)}</td>
        <td class="amt">${r.payment > 0 ? fmtAmt(r.progPayment) : ''}</td>
        <td class="amt b">${fmtAmt(r.runningBalance)}<span class="bt">${escapeHtml(r.balType)}</span></td>
        <td>${escapeHtml(r.particulars)}${r.narration ? `<span class="narr">${escapeHtml(r.narration)}</span>` : ''}</td>
      </tr>`).join('')}
    <tr class="row-mtot">
      <td></td><td class="amt">${fmtAmt(m.monthReceipt)}</td><td></td>
      <td class="amt">${fmtAmt(m.monthPayment)}</td>${blankCells(2)}
      <td>Total : ${escapeHtml(m.key)}</td>
    </tr>`).join('');

  const body = `
  <section class="page">
    <div class="hdr">
      <div class="hdr__org">${escapeHtml(ctx.societyName)}</div>
      ${ctx.societyCode ? `<div class="hdr__sub">Society Code: ${escapeHtml(ctx.societyCode)}</div>` : ''}
      ${ctx.place ? `<div class="hdr__sub">${escapeHtml(ctx.place)}</div>` : ''}
      <div class="hdr__title">General Ledger</div>
      <div class="hdr__meta">
        <div>
          <div>Head of Account :</div>
          <div class="hdr__head">${escapeHtml(data.ledgerName)}</div>
          <div>Period : ${escapeHtml(ctx.period)}</div>
        </div>
        <div>
          <div>F.Y. : <b>${escapeHtml(ctx.financialYear)}</b></div>
          ${data.ledgerType ? `<div>Ledger Type : ${escapeHtml(data.ledgerType)}</div>` : ''}
        </div>
      </div>
    </div>
    <table class="gl">
      <colgroup>
        <col style="width:5%"><col style="width:11%"><col style="width:12%"><col style="width:11%">
        <col style="width:12%"><col style="width:13%"><col style="width:36%">
      </colgroup>
      <thead>
        <tr>
          <th>Day</th><th>Receipt</th><th>Prog. Receipt</th><th>Payment</th><th>Prog. Payment</th><th>Balance</th>
          <th style="text-align:left">Description</th>
        </tr>
      </thead>
      <tbody>
        <tr class="row-bal">${blankCells(5)}<td class="amt">${fmtAmt(data.openBal)}<span class="bt">${escapeHtml(data.openBalType)}</span></td><td>Opening Balance — Brought Forward</td></tr>
        ${data.months.length ? months : '<tr class="empty"><td colspan="7">No transactions in the selected period</td></tr>'}
        <tr class="row-bal row-mtot">${blankCells(5)}<td class="amt">${fmtAmt(data.closeBal)}<span class="bt">${escapeHtml(data.closeBalType)}</span></td><td>Closing Balance — Carried Forward</td></tr>
        <tr class="row-grand">
          <td></td><td class="amt">${fmtAmt(data.totalReceipts)}</td><td></td>
          <td class="amt">${fmtAmt(data.totalPayments)}</td>${blankCells(2)}
          <td>Grand Total</td>
        </tr>
      </tbody>
    </table>
    ${signRowHtml(ctx.generatedOn)}
  </section>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(ctx.title || 'General Ledger')}</title>
  <style>${css(orientation)}</style>
</head>
<body>${body}</body>
</html>`;
};
