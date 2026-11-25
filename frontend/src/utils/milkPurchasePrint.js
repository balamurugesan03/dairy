/**
 * Milk Purchase A4 portrait print — shared by
 *   • Milk Purchase & Sales → Daily Collection List → Print (A4 Portrait)
 *   • Milk Purchase & Sales → Reports → Milk Purchase Report
 *
 * Header order: Society name first, then address, centre, report title, filters.
 *
 * `sections` lets one print cover several date/shift blocks (the report's
 * date range / All Shifts). Each section is printed exactly like the Daily
 * Collection List: Members and Non-Members panels with sub totals. With more
 * than one section, every section also gets its own total line; the grand
 * total, milk sales summary and averages always cover all records.
 */
import dayjs from 'dayjs';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sum = (list, key) => list.reduce((s, r) => s + (r[key] || 0), 0);

/** Farmer number order (numeric when both are numbers) — the Daily Collection List default. */
export const byFarmerNumber = (a, b) => {
  const na = parseInt(a.farmerNumber, 10);
  const nb = parseInt(b.farmerNumber, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a.farmerNumber || '').localeCompare(String(b.farmerNumber || ''));
};

const EMPTY_SALES = { local: { qty: 0, amt: 0 }, credit: { qty: 0, amt: 0 }, school: { qty: 0, amt: 0 }, sample: { qty: 0, amt: 0 } };

/** Milk sales list → { local, credit, school, sample } litre / amount totals. */
export const summariseMilkSales = (salesList = []) => {
  const sm = JSON.parse(JSON.stringify(EMPTY_SALES));
  salesList.forEach((s) => {
    const mode = (s.saleMode || '').toUpperCase();
    const key = mode === 'LOCAL' ? 'local' : mode === 'CREDIT' ? 'credit' : mode === 'SCHOOL' ? 'school' : mode === 'SAMPLE' ? 'sample' : null;
    if (key) { sm[key].qty += (s.litre || 0); sm[key].amt += (s.amount || 0); }
  });
  return sm;
};

const buildRows = (list) => list.map((r, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td class="c">${esc(r.farmerNumber || '')}</td>
      <td class="l">${esc((r.farmerName || '').substring(0, 28))}</td>
      <td class="r">${(r.fat  || 0).toFixed(2)}</td>
      <td class="r">${(r.clr  || 0).toFixed(1)}</td>
      <td class="r">${(r.snf  || 0).toFixed(2)}</td>
      <td class="r">${(r.qty  || 0).toFixed(2)}</td>
      <td class="r">${(r.rate || 0).toFixed(2)}</td>
      <td class="r bold">${(r.amount || 0).toFixed(2)}</td>
    </tr>`).join('');

const panel = (title, list, isNm) => {
  if (!list.length) return `
    <div class="panel">
      <div class="panel-hdr ${isNm ? 'nm' : ''}">${title} (0)</div>
      <p class="none">No records</p>
    </div>`;
  return `
    <div class="panel">
      <div class="panel-hdr ${isNm ? 'nm' : ''}">${title} (${list.length})</div>
      <table>
        <thead><tr>
          <th class="c" style="width:7%">Sl</th>
          <th class="c" style="width:9%">F.No</th>
          <th class="l" style="width:30%">Name</th>
          <th class="r" style="width:7%">FAT</th>
          <th class="r" style="width:7%">CLR</th>
          <th class="r" style="width:7%">SNF</th>
          <th class="r" style="width:10%">Ltr</th>
          <th class="r" style="width:9%">Rate</th>
          <th class="r" style="width:14%">Amt</th>
        </tr></thead>
        <tbody>
          ${buildRows(list)}
          <tr class="sub">
            <td colspan="6" class="r bold">Sub Total :</td>
            <td class="r bold">${sum(list, 'qty').toFixed(2)}</td>
            <td></td>
            <td class="r bold">${sum(list, 'amount').toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
};

const totalLine = (label, list, cls) => `
  <table class="${cls}"><tbody><tr>
    <td style="width:60%" class="r">${label} (${list.length} entries) :</td>
    <td style="width:15%" class="r">${sum(list, 'qty').toFixed(2)} L</td>
    <td style="width:25%" class="r bold">Rs. ${sum(list, 'amount').toFixed(2)}</td>
  </tr></tbody></table>`;

/**
 * @param {object}   o
 * @param {object}   o.society       { societyName, societyPlace }
 * @param {string}   o.title         report title line (without the *** decoration)
 * @param {Array}    o.sections      [{ heading?: string, records: [] }] — records already sorted
 * @param {string}   o.dateLabel
 * @param {string}   o.shiftLabel
 * @param {string}   o.centerLabel   'All Centers' / 'All Centres' hides the centre line
 * @param {object}   o.salesSummary  from summariseMilkSales()
 * @param {boolean}  [o.autoPrint=true]  false → preview (no print dialog)
 */
export const buildMilkPurchasePrintHtml = ({
  society = {}, title = 'Milk Purchase Report', sections = [], dateLabel = '', shiftLabel = '',
  centerLabel = '', salesSummary = EMPTY_SALES, autoPrint = true,
}) => {
  const all        = sections.flatMap((s) => s.records);
  const members    = all.filter((r) => r.isMembership !== false);
  const nonMembers = all.filter((r) => r.isMembership === false);
  const totalLtr   = sum(all, 'qty');
  const totalAmt   = sum(all, 'amount');
  const n          = all.length;
  const avg        = (k) => (n ? sum(all, k) / n : 0);
  const amCount    = all.filter((r) => r.shift === 'AM').length;
  const pmCount    = all.filter((r) => r.shift === 'PM').length;
  const ss         = salesSummary || EMPTY_SALES;
  const sendLtr    = totalLtr - ss.local.qty - ss.sample.qty - ss.school.qty - ss.credit.qty;
  const multi      = sections.length > 1;
  const showCenter = centerLabel && !/^all cent(er|re)s?$/i.test(centerLabel.trim());
  const societyName = society.societyName || 'Dairy Co-operative Society';

  const body = sections.map((s) => {
    const m  = s.records.filter((r) => r.isMembership !== false);
    const nm = s.records.filter((r) => r.isMembership === false);
    return `
      <div class="section">
        ${s.heading ? `<div class="sec-hdr">${esc(s.heading)}</div>` : ''}
        ${panel('Members', m, false)}
        ${panel('Non-Members', nm, true)}
        ${multi ? totalLine(`${esc(s.heading || 'Section')} Total`, s.records, 'sec-total') : ''}
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; padding:6px; }
  .paper { background:#fff; font-family:'Courier New',monospace; font-size:11.5px; color:#1a1a1a; width:194mm; }
  .hdr { text-align:center; margin-bottom:2mm; }
  .hdr .society { font-size:18px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
  .hdr .addr    { font-size:11.5px; margin-top:2px; }
  .hdr .centre  { font-size:12px; font-weight:700; margin-top:2px; }
  .dash { border:none; border-top:1.5px dashed #444; margin:1.5mm 0; }
  .title-line { text-align:center; font-size:14px; font-weight:700; letter-spacing:2px; text-transform:uppercase; text-decoration:underline; margin:1.5mm 0; }
  .meta { font-size:11.5px; margin-bottom:2mm; display:flex; flex-wrap:wrap; gap:1mm 5mm; }
  .section { margin-bottom:3mm; }
  .sec-hdr { font-weight:700; font-size:12.5px; text-transform:uppercase; letter-spacing:0.8px;
             padding:3px 6px; border:1.5px solid #333; background:#fef3c7; margin-bottom:1.5mm; }
  .panel { margin-bottom:3mm; }
  .panel-hdr { font-weight:700; font-size:12px; letter-spacing:0.8px; text-transform:uppercase;
               padding:3px 6px; text-align:center; border:1.5px solid #333;
               background:#dbeafe; color:#1a3c6e; margin-bottom:1px; }
  .panel-hdr.nm { background:#f3f4f6; color:#374151; }
  .none { font-size:11px; text-align:center; padding:4px; color:#888; }
  table { width:100%; border-collapse:collapse; font-size:11.5px; }
  thead tr th { border-top:1px solid #333; border-bottom:1px solid #555; padding:2.5px 3px;
                font-weight:700; font-size:10.5px; letter-spacing:0.2px; text-transform:uppercase; }
  tbody tr td { padding:2px 3px; border-bottom:1px dotted #ccc; }
  tbody tr:nth-child(odd) td { background:#f7f7f7; }
  .sub td { border-top:1px solid #555; font-weight:700; font-size:11px; background:#e5e7eb; }
  .sec-total td { border-top:1.5px solid #333; border-bottom:1px solid #333; font-weight:700; font-size:11.5px; background:#fef9c3; padding:2px 3px; }
  .grand-row { margin-top:2mm; }
  .grand td { border-top:2px solid #333; border-bottom:1.5px solid #333; font-weight:700; font-size:12.5px; background:#d1fae5; padding:3px 4px; }
  .summary { margin-top:2mm; font-size:11.5px; }
  .summary .dash2 { border:none; border-top:1px solid #555; margin:1.5mm 0; }
  .summary-row { display:flex; justify-content:space-between; padding:1.5px 0; }
  .summary-row .lbl { width:80mm; }
  .summary-row .val  { font-weight:700; text-align:right; width:40mm; }
  .summary-row .val2 { font-weight:700; text-align:right; width:40mm; }
  .avgs { font-size:11px; color:#444; }
  .sig { margin-top:10mm; display:flex; justify-content:space-between; font-size:11.5px; }
  .sig div { border-top:1px solid #555; width:55mm; text-align:center; padding-top:1mm; }
  .printed { text-align:center; font-size:10px; margin-top:3mm; color:#6b7280; }
  .c { text-align:center; } .r { text-align:right; } .l { text-align:left; } .bold { font-weight:700; }
  .panel, tr { page-break-inside:auto; } thead { display:table-header-group; }
  @media print { body { padding:0; } }
</style>
</head>
<body>
<div class="paper">
  <div class="hdr">
    <div class="society">${esc(societyName)}</div>
    ${society.societyPlace ? `<div class="addr">${esc(society.societyPlace)}</div>` : ''}
    ${showCenter ? `<div class="centre">Centre : ${esc(centerLabel)}</div>` : ''}
  </div>
  <hr class="dash"/>
  <div class="title-line">*** ${esc(title)} ***</div>
  <hr class="dash"/>
  <div class="meta">
    <span>Date : ${esc(dateLabel)}</span>
    <span>Shift : ${esc(shiftLabel)}</span>
    ${showCenter ? '' : `<span>Centre : ${esc(centerLabel || 'All Centres')}</span>`}
    <span>Members : ${members.length}</span>
    <span>Non-Members : ${nonMembers.length}</span>
    <span>Total : ${n}</span>
  </div>

  ${n ? body : '<p class="none" style="padding:10mm 0;font-size:13px">No milk purchase records for the selected filters</p>'}

  <div class="grand-row">${totalLine('TOTAL PURCHASE', all, 'grand')}</div>

  <div class="summary">
    <hr class="dash2"/>
    <div class="summary-row">
      <span class="lbl">Total Purchase (Litre)</span>
      <span class="val">${totalLtr.toFixed(3)} L</span>
      <span class="val2">Rs. ${totalAmt.toFixed(2)}</span>
    </div>
    <div class="summary-row"><span class="lbl">Milk Sales — Local</span><span class="val">${ss.local.qty.toFixed(3)} L</span><span class="val2">Rs. ${ss.local.amt.toFixed(2)}</span></div>
    <div class="summary-row"><span class="lbl">Milk Sales — School</span><span class="val">${ss.school.qty.toFixed(3)} L</span><span class="val2">Rs. ${ss.school.amt.toFixed(2)}</span></div>
    <div class="summary-row"><span class="lbl">Milk Sales — Credit</span><span class="val">${ss.credit.qty.toFixed(3)} L</span><span class="val2">Rs. ${ss.credit.amt.toFixed(2)}</span></div>
    <div class="summary-row"><span class="lbl">Milk Sales — Sample</span><span class="val">${ss.sample.qty.toFixed(3)} L</span><span class="val2">Rs. ${ss.sample.amt.toFixed(2)}</span></div>
    <hr class="dash2"/>
    <div class="summary-row bold">
      <span class="lbl">Send to Dairy (Milma)</span>
      <span class="val">${sendLtr.toFixed(3)} L</span>
      <span class="val2"></span>
    </div>
    <hr class="dash2"/>
    <div class="avgs">
      Avg FAT: ${avg('fat').toFixed(2)} &nbsp;|&nbsp; Avg CLR: ${avg('clr').toFixed(1)} &nbsp;|&nbsp; Avg SNF: ${avg('snf').toFixed(2)} &nbsp;|&nbsp; AM: ${amCount} &nbsp;|&nbsp; PM: ${pmCount}
    </div>
  </div>
  <div class="sig">
    <div>Prepared By</div>
    <div>Checked By</div>
    <div>Secretary</div>
  </div>
  <div class="printed">Printed: ${dayjs().format('DD/MM/YYYY HH:mm')} &nbsp;|&nbsp; ${esc(societyName)}</div>
</div>
${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),400);</script>' : ''}
</body></html>`;
};

/** Open the print in a new window (print dialog opens automatically). */
export const openMilkPurchasePrint = (opts) => {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups for this site to use Print.'); return; }
  win.document.write(buildMilkPurchasePrintHtml({ ...opts, autoPrint: true }));
  win.document.close();
};
