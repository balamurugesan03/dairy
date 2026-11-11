/**
 * Milk Bill (Karur, Tamil Nadu) — bill HTML shared by the screen and the A4 print.
 * Print packs bills on A4 portrait: two per page when both fit, never split.
 */
import dayjs from 'dayjs';
import { openA4Print, escapeHtml as e } from './printA4';

const f1 = (v) => (v == null || v === 0 ? '' : (+v).toFixed(1));
const f2 = (v) => (v == null || v === 0 ? '' : (+v).toFixed(2));
const fN = (v) => (+(v || 0)).toFixed(2);
const fI = (v) => (v == null || v === 0 ? '' : Math.round(+v));
export const fD = (d) => dayjs(d).format('DD/MM/YYYY');

/* ── One bill (screen + print share this HTML) ─────────────────────────────── */
export const BILL_CSS = `
  .kb-bill { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .kb-head { display: flex; align-items: center; gap: 8px; border-bottom: 1.4px solid #000; padding-bottom: 4px; margin-bottom: 4px; }
  .kb-logo { width: 58px; height: 50px; flex: 0 0 58px; display: flex; align-items: center; justify-content: flex-start; }
  .kb-logo img { max-width: 58px; max-height: 50px; object-fit: contain; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .kb-org { flex: 1; text-align: center; min-width: 0; }
  .kb-soc { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .kb-addr { font-size: 8.5px; margin-top: 1px; }
  .kb-title { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; margin-top: 3px; }
  .kb-info { font-size: 9px; line-height: 1.45; border-bottom: 1px solid #555; padding-bottom: 3px; margin-bottom: 4px; }
  .kb-info .row { display: flex; justify-content: space-between; gap: 8px; }
  .kb-info b { font-weight: 700; }
  .kb-sec { font-size: 8.5px; font-weight: 700; text-transform: uppercase; border-bottom: 1.2px solid #000; margin: 4px 0 2px; padding-bottom: 1px; }
  table.kb { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.kb th, table.kb td { border: 0.6px solid #666; padding: 1px 2px; font-size: 8.4px; line-height: 1.3; overflow: hidden; white-space: nowrap; }
  table.kb th { background: #e5e5e5; font-weight: 700; text-align: center; }
  table.kb td { text-align: right; font-variant-numeric: tabular-nums; }
  table.kb td.c { text-align: center; }
  table.kb tr.tot td { font-weight: 700; background: #e5e5e5; border-top: 1.1px solid #000; }
  .kb-sum { border: 1.1px solid #000; margin-top: 5px; font-size: 9px; }
  .kb-sum .h { background: #e5e5e5; font-weight: 700; padding: 2px 5px; border-bottom: 1.1px solid #000; letter-spacing: 0.8px; }
  .kb-sum .r { display: flex; justify-content: space-between; padding: 2px 5px; }
  .kb-sum .r span:last-child { font-variant-numeric: tabular-nums; }
  .kb-net { display: flex; justify-content: space-between; font-weight: 700; font-size: 10.5px; border: 1.1px solid #000; border-top: none; padding: 3px 5px; background: #f0f0f0; }
  .kb-note { font-size: 7.5px; margin-top: 2px; font-style: italic; }
  .kb-foot { display: flex; justify-content: space-between; margin-top: 20px; font-size: 8px; }
  .kb-foot span { border-top: 0.8px solid #000; padding-top: 1px; min-width: 90px; text-align: center; }
`;

export const billHtml = (bill, org, { forPrint = false } = {}) => {
  const { days = [], summary: s = {}, farmer = {}, period = {}, karur = {} } = bill;
  const prev = karur.previousBalance || 0;
  const rec = karur.recoveries || 0;
  const net = karur.netPayable || 0;
  const avg = s.totalMilkQty > 0 ? s.totalMilkAmt / s.totalMilkQty : 0;
  const milk = days.map(({ date, am, pm }) => {
    const q = (am?.qty || 0) + (pm?.qty || 0);
    const a = (am?.amount || 0) + (pm?.amount || 0);
    return `<tr><td class="c">${dayjs(date).format('DD/MM')}</td>
      <td>${f1(am?.qty)}</td><td class="c">${fI(am?.clr)}</td><td class="c">${f1(am?.fat)}</td><td class="c">${f1(am?.snf)}</td><td>${f2(am?.rate)}</td>
      <td>${f1(pm?.qty)}</td><td class="c">${fI(pm?.clr)}</td><td class="c">${f1(pm?.fat)}</td><td class="c">${f1(pm?.snf)}</td><td>${f2(pm?.rate)}</td>
      <td><b>${f1(q || null)}</b></td><td>${q ? f2(a / q) : ''}</td><td><b>${a ? fN(a) : ''}</b></td></tr>`;
  }).join('');
  // data-society-logo: the global print-logo hook sees the logo is already placed and adds none
  const logo = org.logo ? `<img ${forPrint ? 'data-society-logo="1"' : ''} src="${e(org.logo)}" alt="" />` : '';
  const centre = [farmer.centerCode, farmer.centerName].filter(Boolean).join(' - ');

  return `<div class="kb-bill">
    <div class="kb-head">
      <div class="kb-logo">${logo}</div>
      <div class="kb-org">
        <div class="kb-soc">${e(org.name)}${org.code ? ` (${e(org.code)})` : ''}</div>
        ${org.address ? `<div class="kb-addr">${e(org.address)}</div>` : ''}
        ${org.contact ? `<div class="kb-addr">${e(org.contact)}</div>` : ''}
        <div class="kb-title">MILK BILL — PRODUCER STATEMENT</div>
      </div>
      <div class="kb-logo"></div>
    </div>
    <div class="kb-info">
      <div class="row"><span>Name: <b>${e((farmer.name || '').toUpperCase())}</b></span><span>Producer No: <b>${e(farmer.producerId || farmer.number)}</b></span></div>
      <div class="row"><span>Centre: <b>${e(centre || '-')}</b></span><span>Cycle: <b>${fD(period.fromDate)} – ${fD(period.toDate)}</b></span></div>
    </div>

    <div class="kb-sec">1. Milk Collection Details</div>
    <table class="kb">
      <colgroup><col style="width:9%">${[7, 5, 5.5, 5.5, 7, 7, 5, 5.5, 5.5, 7].map((w) => `<col style="width:${w}%">`).join('')}<col style="width:8.5%"><col style="width:7%"><col style="width:15.5%"></colgroup>
      <thead>
        <tr><th rowspan="2">Date</th><th colspan="5">MORNING (AM)</th><th colspan="5">EVENING (PM)</th><th colspan="3">TOTAL</th></tr>
        <tr>${['Ltr', 'CLR', 'FAT', 'SNF', 'Rate', 'Ltr', 'CLR', 'FAT', 'SNF', 'Rate', 'Ltr', 'Rate', 'Amount'].map((h) => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>${milk || '<tr><td colspan="14" class="c">No milk in this cycle</td></tr>'}
        <tr class="tot"><td class="c">TOTAL</td><td>${fN(s.amQty)}</td><td colspan="4"></td><td>${fN(s.pmQty)}</td><td colspan="4"></td>
          <td>${fN(s.totalMilkQty)}</td><td>${avg ? f2(avg) : ''}</td><td>${fN(s.totalMilkAmt)}</td></tr>
      </tbody>
    </table>

    <div class="kb-sum">
      <div class="h">2. PAYMENT SUMMARY</div>
      <div class="r"><span>Milk Quantity</span><span>${fN(s.totalMilkQty)} Ltr</span></div>
      <div class="r"><span>Milk Amount${avg ? ` (avg Rs. ${f2(avg)}/Ltr)` : ''}</span><span>${fN(s.totalMilkAmt)}</span></div>
      ${prev > 0 ? `<div class="r"><span>Add: Previous Outstanding Balance (Cr)</span><span>+ ${fN(prev)}</span></div>` : ''}
      ${prev < 0 ? `<div class="r"><span>Less: Previous Due (Dr)</span><span>− ${fN(-prev)}</span></div>` : ''}
      ${prev === 0 ? '<div class="r"><span>Previous Outstanding Balance</span><span>0.00</span></div>' : ''}
      ${rec > 0.004 ? `<div class="r"><span>Less: Recoveries (as settled)</span><span>− ${fN(rec)}</span></div>` : ''}
      ${rec < -0.004 ? `<div class="r"><span>Add: Other Earnings (as settled)</span><span>+ ${fN(-rec)}</span></div>` : ''}
    </div>
    <div class="kb-net"><span>${net >= 0 ? 'NET PAYABLE AMOUNT (To Producer)' : 'NET DUE (From Producer)'}</span><span>Rs. ${fN(Math.abs(net))}</span></div>
    ${karur.milkChanged ? '<div class="kb-note">Note: milk entries changed after this cycle was settled — Net Payable is as per the saved Payment Register (settled).</div>' : ''}
    ${karur.source === 'milkBill' ? '<div class="kb-note">Producer is not in the saved Payment Register (settled) for this cycle — figures as per Milk Bill (Producers).</div>' : ''}
    <div class="kb-foot"><span>Date: ${dayjs().format('DD/MM/YYYY')}</span><span>Clerk / Secretary</span><span>Producer Signature</span></div>
  </div>`;
};

/* ── Print: pack bills on A4 portrait — two per page when both fit ─────────── */
export const PRINT_CSS = `
  @page { size: A4 portrait; margin: 8mm 9mm; }
  body { background: #fff; }
  ${BILL_CSS}
  .kb-bill.kb-new { break-before: page; page-break-before: always; }
  .kb-bill.kb-cut { border-top: 1px dashed #000; margin-top: 4mm; padding-top: 4mm; }
`;
// A4 portrait printable height (297mm − 16mm) ≈ 1062 CSS px. Measure every bill,
// start a new page when the next one would not fit whole, scale a bill that is
// taller than a page (long cycle) so it is never split.
export const PACK_SCRIPT = `
<script>
(function () {
  var PAGE_H = 1050, GAP = 32, used = 0;
  var bills = document.querySelectorAll('.kb-bill');
  var hs = Array.prototype.map.call(bills, function (b) { return b.getBoundingClientRect().height; });
  Array.prototype.forEach.call(bills, function (b, i) {
    var h = hs[i];
    if (h > PAGE_H) { b.style.zoom = (PAGE_H / h).toFixed(3); h = PAGE_H; }
    if (i === 0) { used = h; return; }
    if (used + GAP + h <= PAGE_H) { b.classList.add('kb-cut'); used += GAP + h; }
    else { b.classList.add('kb-new'); used = h; }
  });
})();
</script>`;

export const printBills = (bills, org, title) => {
  openA4Print({
    title,
    orientation: 'portrait',
    css: PRINT_CSS,
    bodyHtml: bills.map((b) => billHtml(b, org, { forPrint: true })).join('') + PACK_SCRIPT,
  });
};

