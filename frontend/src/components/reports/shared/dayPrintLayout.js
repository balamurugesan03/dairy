/**
 * Shared date-wise A4 print layout for the Day Book and Cash Book.
 *
 * Each date is a `<section class="day">` holding the society header, one
 * table (`tbody.rows` for entries, `tbody.tail` for Transaction (Subtotal) →
 * Opening / Closing Balance → Grand Total) and the signature row.
 *
 * Date-wise pagination: an inline script measures every date block and packs
 * the blocks onto A4 sheets. A date continues on the current sheet when the
 * whole block fits in the space left; otherwise it moves to a fresh sheet so
 * it is never split just to fill a gap. Only a date taller than a full sheet
 * is split, at row boundaries, with its header repeated ("Contd.").
 *
 * The same HTML is shown in the print preview (iframe), where each sheet is
 * drawn as a real A4 page. Page margins are padding on .page (with @page
 * margin 0), so content width is identical in preview and print.
 */
import { escapeHtml } from '../../../utils/printA4';
import { RPT_FONT, rptPrintSize } from './reportTypography';

const PAD_MM = 8;     // sheet padding (= printed margin)
const SAFETY_MM = 4;  // slack so rounding never pushes a packed sheet onto two pages
const GAP_MM = 5;     // space between two dates sharing a sheet

export const dayLayoutCss = (orientation) => {
  const portrait = orientation === 'portrait';
  const [w, h] = portrait ? ['210mm', '297mm'] : ['297mm', '210mm'];
  return `
  @page { size: A4 ${orientation}; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  /* Typography = Receipt & Disbursement standard (reportTypography.js) */
  body { font-family: ${RPT_FONT}; color: #000; font-size: ${rptPrintSize(orientation)};
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .page, .measure { width: ${w}; padding: ${PAD_MM}mm; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page > .day + .day { margin-top: ${GAP_MM}mm; padding-top: ${GAP_MM}mm; border-top: 1px dashed #888; }
  .measure .day { break-inside: avoid; page-break-inside: avoid; }
  .measure .day + .day { margin-top: ${GAP_MM * 2}mm; }  /* margin only: kept out of the measured height */

  .hdr { text-align: center; padding-bottom: 5px; margin-bottom: 6px; border-bottom: 1.5px solid #000; }
  .hdr { line-height: 1.35; }
  .hdr__org { font-size: 1.25em; text-transform: uppercase; }
  .hdr__sub { font-size: 1em; }
  .hdr__title { margin-top: 2px; font-size: 1em; font-weight: 700; text-decoration: underline; text-transform: uppercase; }
  .hdr__date { margin-top: 2px; font-size: 1em; font-weight: 700; }
  .hdr__contd { font-size: 0.9em; font-weight: 400; font-style: italic; }
  .hdr__meta { margin-top: 3px; display: flex; justify-content: space-between; font-size: 0.9em; }

  .day table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .day table th, .day table td { border: 0.75px solid #444; padding: 2px 3px; vertical-align: top;
    overflow-wrap: anywhere; word-break: break-word; }
  /* The header row is the only shaded part — all report content prints on plain white */
  .day table th { background: #e6e6e6; font-weight: 700; text-transform: uppercase; text-align: center; vertical-align: middle;
    font-size: 0.8em; padding: 2px 2px; overflow-wrap: normal; word-break: normal; hyphens: manual; }  /* split only at a soft hyphen (Adjust-ment) */
  .day table th.side { font-size: 1em; letter-spacing: 1px; }
  .day table thead { display: table-header-group; }
  .day table tr { page-break-inside: avoid; break-inside: avoid; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ctr { text-align: center; }
  .split { border-left: 1.75px solid #000 !important; }
  .narr { display: block; font-size: 0.9em; font-style: italic; color: #333; }
  .row-txn td { font-weight: 700; border-top: 1.5px solid #000; }
  .day table .row-bal td { font-weight: 700; font-style: italic; text-align: center; vertical-align: middle;
    padding-top: 3px; padding-bottom: 3px; }
  .row-grand td { font-weight: 700; border-top: 3px double #000; border-bottom: 3px double #000; }
  .empty td { text-align: center; font-style: italic; color: #444; }

  .dsign { margin-top: 8px; break-inside: avoid; page-break-inside: avoid; }
  .dsign__row { display: flex; justify-content: space-between; align-items: flex-end; }
  .dsign__box { min-width: 130px; padding-top: 24px; text-align: center; }
  .dsign__line { border-top: 1px solid #000; padding-top: 2px; font-size: 1em; font-weight: 700; }
  .dsign__meta { margin-top: 4px; text-align: center; font-size: 0.9em; color: #333; }

  /* Preview only: draw each page as an A4 sheet on a grey desk. */
  @media screen {
    html, body { background: #9e9e9e; }
    body { padding: 12px 0; }
    .page, .measure { min-height: ${h}; margin: 0 auto 12px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
  }
  `;
};

/** Society header for one date block (name, code, address from Society Info). */
export const dayHeaderHtml = (ctx, title, dateLabel, metaHtml) => `
    <div class="hdr">
      <div class="hdr__org">${escapeHtml(ctx.societyName)}</div>
      ${ctx.societyCode ? `<div class="hdr__sub">Society Code: ${escapeHtml(ctx.societyCode)}</div>` : ''}
      ${ctx.place ? `<div class="hdr__sub">${escapeHtml(ctx.place)}</div>` : ''}
      <div class="hdr__title">${escapeHtml(title)}</div>
      <div class="hdr__date">${escapeHtml(dateLabel)}</div>
      <div class="hdr__meta">${metaHtml}</div>
    </div>`;

/** President bottom-left, Secretary bottom-right, Generated date centred below. */
export const daySignHtml = (generatedOn = '') => `
    <div class="dsign">
      <div class="dsign__row">
        <div class="dsign__box"><div class="dsign__line">President</div></div>
        <div class="dsign__box"><div class="dsign__line">Secretary</div></div>
      </div>
      ${generatedOn ? `<div class="dsign__meta">Generated On : ${escapeHtml(generatedOn)}</div>` : ''}
    </div>`;

// Runs inside the print / preview document. Kept as plain ES5 source text.
const paginateScript = (orientation) => {
  const sheetMm = orientation === 'portrait' ? 297 : 210;
  return `
(function () {
  var src = document.getElementById('days');
  if (!src) return;
  try {
    var MM = 96 / 25.4;
    var PAGE = (${sheetMm} - ${PAD_MM * 2} - ${SAFETY_MM}) * MM;
    var GAP = ${GAP_MM * 2} * MM + 1;   // margin + padding + dashed rule
    var hgt = function (el) { return el ? el.getBoundingClientRect().height : 0; };
    var days = Array.prototype.slice.call(src.querySelectorAll('.day'));

    // Measure while every block still sits at the printed content width.
    var info = days.map(function (day) {
      var rows = Array.prototype.slice.call(day.querySelectorAll('tbody.rows > tr'));
      var dayRect = day.getBoundingClientRect();
      var tableRect = day.querySelector('table').getBoundingClientRect();
      var full = dayRect.height;
      var rowH = rows.map(hgt);
      var rowsSum = rowH.reduce(function (s, v) { return s + v; }, 0);
      var tailH = hgt(day.querySelector('tbody.tail')) + (dayRect.bottom - tableRect.bottom);
      return { day: day, full: full, rowH: rowH, fixedLast: full - rowsSum, fixedMid: full - rowsSum - tailH };
    });

    // Sheets are built detached and swapped in only once packing succeeds.
    var out = [], cur = null, used = 0;
    var newPage = function () {
      cur = document.createElement('section');
      cur.className = 'page';
      out.push(cur);
      used = 0;
    };
    var room = function () { return used > 0 ? PAGE - used - GAP : PAGE; };
    var place = function (el, h) { used += (used > 0 ? GAP : 0) + h; cur.appendChild(el); };

    // Clone a date block keeping only rows [from, to); a non-final chunk drops
    // the summary rows and signatures, a continuation is marked "Contd.".
    var chunk = function (d, from, to, last, contd) {
      var el = d.day.cloneNode(true);
      var rows = el.querySelectorAll('tbody.rows > tr');
      for (var k = rows.length - 1; k >= 0; k--) if (k < from || k >= to) rows[k].parentNode.removeChild(rows[k]);
      if (!last) {
        el.querySelector('tbody.tail').parentNode.removeChild(el.querySelector('tbody.tail'));
        el.querySelector('.dsign').parentNode.removeChild(el.querySelector('.dsign'));
      }
      if (contd) el.querySelector('.hdr__date').insertAdjacentHTML('beforeend', ' <span class="hdr__contd">(Contd.)</span>');
      return el;
    };

    newPage();
    info.forEach(function (d) {
      if (d.full <= room()) { place(d.day.cloneNode(true), d.full); return; }
      if (d.full <= PAGE) { newPage(); place(d.day.cloneNode(true), d.full); return; }

      // Taller than a whole sheet: split at row boundaries. Start in the space
      // left on this sheet only if the heading and a few rows fit there.
      var r = d.rowH, n = r.length, i = 0, first = true;
      var lead = d.fixedMid + r.slice(0, 3).reduce(function (s, v) { return s + v; }, 0);
      if (used > 0 && room() < lead) newPage();
      while (i < n) {
        var avail = room(), acc = d.fixedMid, j = i;
        while (j < n && acc + r[j] <= avail) { acc += r[j]; j++; }
        if (j === n && acc - d.fixedMid + d.fixedLast <= avail) {
          place(chunk(d, i, n, true, !first), acc - d.fixedMid + d.fixedLast);
          return;
        }
        if (j === n) j = n - 1;               // keep a row to carry the totals over
        if (j <= i) {
          if (used > 0) { newPage(); continue; }
          j = i + 1;                          // a single row taller than a sheet
        }
        place(chunk(d, i, j, false, !first), acc);
        first = false;
        i = j;
        newPage();
      }
      // Rows ran out exactly at a break: totals + signatures on their own.
      place(chunk(d, n, n, true, true), d.fixedLast);
    });
    out.forEach(function (pg) { if (pg.childNodes.length) document.body.insertBefore(pg, src); });
    src.parentNode.removeChild(src);
  } catch (e) {
    // Leave the unpaginated blocks in place; print still keeps each date together via CSS.
  }
})();`;
};

/** Full print document: date blocks in a measuring sheet, then packed by the script. */
export const dayPrintDocument = ({ title, orientation, extraCss = '', blocksHtml }) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>${dayLayoutCss(orientation)}${extraCss}</style>
</head>
<body>
  <div id="days" class="measure">${blocksHtml}</div>
  <script>${paginateScript(orientation)}</script>
</body>
</html>`;
