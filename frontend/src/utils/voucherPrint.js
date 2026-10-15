/**
 * Receipt / Payment voucher print — A4 sheet, 4-inch wide voucher slip,
 * black & white.
 *
 * The same HTML document is used for the on-screen preview (rendered in an
 * iframe, where the A4 sheet is drawn at its real 210mm x 297mm size) and for
 * the actual print, so the preview always matches the printed page.
 */
import dayjs from 'dayjs';
import { escapeHtml, printHtmlDocument } from './printA4';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim());
const threeDigits = (n) => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
};

/** Indian-system amount in words: "Rupees One Lakh Twenty Only". */
export const amountInWords = (amount) => {
  const value = Math.round((Number(amount) || 0) * 100);
  let rupees = Math.floor(value / 100);
  const paise = value % 100;
  if (!rupees && !paise) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupees) parts.push(threeDigits(rupees));
  let words = parts.length ? `Rupees ${parts.join(' ')}` : 'Rupees Zero';
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
};

const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CSS = `
  @page { size: A4 portrait; margin: 10mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; font-size: 10px; }
  .sheet { background: #fff; }
  .slip { width: 4in; border: 1.25px solid #000; padding: 8px 10px; margin-bottom: 10mm;
    page-break-inside: avoid; break-inside: avoid; }
  .org { text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .title { text-align: center; margin: 4px auto 6px; font-size: 11px; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 1px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .line { display: flex; gap: 4px; padding: 3px 0; border-bottom: 0.75px dashed #000; }
  .line .lbl { font-weight: 700; white-space: nowrap; }
  .line .val { flex: 1; overflow-wrap: anywhere; }
  .amt-box { margin: 6px 0 4px; border: 1px solid #000; padding: 4px 6px; display: flex; justify-content: space-between;
    align-items: center; }
  .amt-box .lbl { font-weight: 700; }
  .amt-box .val { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .words { font-style: italic; font-size: 9px; margin-bottom: 4px; }
  .sign { display: flex; justify-content: space-between; margin-top: 28px; }
  .sign div { min-width: 1.1in; border-top: 1px solid #000; padding-top: 2px; text-align: center; font-size: 9px; font-weight: 700; }

  /* On screen (preview) draw the real A4 sheet; print uses @page instead. */
  @media screen {
    html { background: #9e9e9e; }
    body { padding: 16px 0; background: #9e9e9e; }
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 10mm;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
  }
`;

/**
 * @param {'Receipt'|'Payment'} kind
 * Receipt: head of account is the credit leg (Cash is debited).
 * Payment: head of account is the debit leg (Cash is credited).
 */
const slipHtml = (voucher, kind, orgName) => {
  const isReceipt = kind === 'Receipt';
  const head = voucher.entries?.find(e => (isReceipt ? e.creditAmount > 0 : e.debitAmount > 0))?.ledgerName || '-';
  const amount = voucher.totalDebit || 0;
  return `
    <div class="slip">
      <div class="org">${escapeHtml(orgName)}</div>
      <div class="title">${isReceipt ? 'Receipt Voucher' : 'Payment Voucher'}</div>
      <div class="row">
        <span><b>No:</b> ${escapeHtml(voucher.voucherNumber || '-')}</span>
        <span><b>Date:</b> ${escapeHtml(dayjs(voucher.voucherDate).format('DD-MM-YYYY'))}</span>
      </div>
      <div class="line"><span class="lbl">${isReceipt ? 'Received from:' : 'Paid to:'}</span><span class="val">${escapeHtml(head)}</span></div>
      <div class="line"><span class="lbl">Narration:</span><span class="val">${escapeHtml(voucher.narration || '-')}</span></div>
      <div class="amt-box"><span class="lbl">Amount (Rs.)</span><span class="val">${fmt(amount)}</span></div>
      <div class="words">${escapeHtml(amountInWords(amount))}</div>
      <div class="sign">
        <div>${isReceipt ? 'Paid by' : 'Receiver'}</div>
        <div>Secretary</div>
      </div>
    </div>`;
};

/** Full HTML document for one or more vouchers (each a 4-inch slip on A4). */
export const buildVoucherPrintHtml = (vouchers, kind, orgName) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${kind} Voucher${vouchers.length === 1 && vouchers[0].voucherNumber ? ` - ${escapeHtml(vouchers[0].voucherNumber)}` : ''}</title>
  <style>${CSS}</style>
</head>
<body><div class="sheet">${vouchers.map(v => slipHtml(v, kind, orgName)).join('')}</div></body>
</html>`;

export const printVoucherHtml = printHtmlDocument;

export const printVouchers = (vouchers, kind, orgName) =>
  printVoucherHtml(buildVoucherPrintHtml(vouchers, kind, orgName));
