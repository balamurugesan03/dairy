/**
 * Final Accounts — report header, grid, A4 print and Excel export, all built
 * from the same statement model (finalAccountsModel.js). The screen renders
 * the very same header + grid HTML, so screen and paper always match.
 *
 * Grid (reference PDF): 8 columns, Sl. | Particulars | Amount | Total per
 * side; solid 1.5px outer border and header rule, solid 1px vertical lines,
 * dotted 1px horizontal lines between body rows.
 */
import * as XLSX from 'xlsx';
import { escapeHtml, SIGN_CSS, signRowHtml, A4_SIZE } from '../../utils/printA4';
import { fmtAmount, pairRows } from './finalAccountsModel';

/** Must be the first rule of its stylesheet. */
export const FA_FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Serif+Malayalam:wght@400;700&display=swap');";

export const FA_GRID_CSS = `
  .fa-report { font-family: 'Noto Serif', 'DejaVu Serif', 'Noto Serif Malayalam', 'Noto Sans Malayalam', serif;
    font-size: 9.5pt; color: #000; background: #fff; }
  .fa-hdr { text-align: center; }
  .fa-hdr__short { font-size: 13pt; font-weight: 700; text-transform: uppercase; }
  .fa-hdr__reg { font-size: 10pt; margin-top: 1px; }
  .fa-hdr__title { font-size: 11pt; font-weight: 700; text-transform: uppercase; margin-top: 12px; }
  .fa-fy { margin: 8px 0 3px; text-align: left; }

  table.fa-grid { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #000;
    font-variant-numeric: tabular-nums; }
  table.fa-grid th, table.fa-grid td { padding: 2px 5px; vertical-align: middle;
    border-left: 1px solid #000; border-right: 1px solid #000;
    border-top: 1px dotted #000; border-bottom: 1px dotted #000;
    overflow-wrap: anywhere; word-break: break-word; }
  table.fa-grid thead { display: table-header-group; }
  table.fa-grid thead th { font-weight: 700; text-align: center; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
  table.fa-grid thead tr.fa-side th { text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000; }
  table.fa-grid thead tr.fa-side .fa-cap { font-weight: 400; letter-spacing: 0; text-transform: none; }
  table.fa-grid tr { page-break-inside: avoid; break-inside: avoid; }
  table.fa-grid td.fa-sl { text-align: center; }
  table.fa-grid td.fa-amt { text-align: right; white-space: nowrap; }
  table.fa-grid td.fa-group { font-weight: 700; }
  table.fa-grid td.fa-ledger { text-transform: uppercase; }
  table.fa-grid td.fa-ledger.fa-keep { text-transform: none; }
  table.fa-grid.fa-indent td.fa-ledger { padding-left: 21px; }
  table.fa-grid td.fa-red { color: #E00000; }
  table.fa-grid td.fa-carried { font-style: italic; }
  table.fa-grid tr.fa-grand td { font-weight: 700; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
  table.fa-grid tr.fa-grand td.fa-grand-label { text-align: center; }
  table.fa-grid tr.fa-blank td { height: 1.6em; }
`;

const COLGROUP = `
  <colgroup>
    <col style="width:5%"><col style="width:26%"><col style="width:9.5%"><col style="width:9.5%">
    <col style="width:5%"><col style="width:26%"><col style="width:9.5%"><col style="width:9.5%">
  </colgroup>`;

const amt = (v) => (v === undefined || v === null ? '' : escapeHtml(fmtAmount(v)));

const sideCells = (line) => {
  if (!line) return '<td></td><td></td><td></td><td></td>';
  if (line.type === 'group') {
    return `<td class="fa-sl">${line.sl ?? ''}</td><td class="fa-group">${escapeHtml(line.label)}</td><td></td><td></td>`;
  }
  if (line.type === 'carried') {
    return `<td></td><td class="fa-carried">${escapeHtml(line.label)}</td><td></td><td class="fa-amt">${amt(line.total)}</td>`;
  }
  const red = line.contra ? ' fa-red' : '';
  return `<td></td><td class="fa-ledger${line.keepCase ? ' fa-keep' : ''}${red}">${escapeHtml(line.label)}</td><td class="fa-amt${red}">${amt(line.amount)}</td>`
    + `<td class="fa-amt">${line.total !== undefined ? amt(line.total) : ''}</td>`;
};

/** The statement grid as an HTML table. */
export const statementTableHtml = (st) => {
  const sideHead = (s) => `<th colspan="4">${escapeHtml(s.title)}`
    + `${s.caption ? ` <span class="fa-cap">(${escapeHtml(s.caption)})</span>` : ''}</th>`;
  const rows = pairRows(st).map(([l, r]) => `<tr>${sideCells(l)}${sideCells(r)}</tr>`).join('');
  const blanks = '<tr class="fa-blank"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
    .repeat(st.blankRowsBeforeTotal || 0);
  const grand = escapeHtml(st.grandLabel || 'Total');
  const gl = st.grandLabel ? ' class="fa-grand-label"' : '';
  return `
  <table class="fa-grid${st.indentLedgers ? ' fa-indent' : ''}">
    ${COLGROUP}
    <thead>
      ${st.sideTitles ? `<tr class="fa-side">${sideHead(st.left)}${sideHead(st.right)}</tr>` : ''}
      <tr>
        <th>Sl.</th><th>${escapeHtml(st.left.colTitle || 'Particulars')}</th><th>Amount</th><th>Total</th>
        <th>Sl.</th><th>${escapeHtml(st.right.colTitle || 'Particulars')}</th><th>Amount</th><th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}${blanks}
      <tr class="fa-grand">
        <td></td><td${gl}>${grand}</td><td></td><td class="fa-amt">${amt(st.left.total)}</td>
        <td></td><td${gl}>${grand}</td><td></td><td class="fa-amt">${amt(st.right.total)}</td>
      </tr>
    </tbody>
  </table>`;
};

/**
 * Report header: short name (bold, uppercase), registered name with Reg. No.
 * (may be Malayalam), the statement heading, then "Financial Year" above the grid.
 * @param {object} ctx { shortName, registeredName, financialYear }
 */
export const reportHeaderHtml = (st, ctx) => `
  <div class="fa-hdr">
    <div class="fa-hdr__short">${escapeHtml(ctx.shortName)}</div>
    ${ctx.registeredName ? `<div class="fa-hdr__reg">${escapeHtml(ctx.registeredName)}</div>` : ''}
    <div class="fa-hdr__title">${escapeHtml(st.heading)}</div>
  </div>
  <div class="fa-fy">Financial Year : ${escapeHtml(ctx.financialYear)}</div>`;

const MARGIN = '10mm';

const printCss = (orientation) => {
  const { w, h } = A4_SIZE[orientation === 'portrait' ? 'portrait' : 'landscape'];
  return `
  ${FA_FONT_IMPORT}
  @page { size: A4 ${orientation}; margin: ${MARGIN}; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .stmt + .stmt { page-break-before: always; break-before: page; }
  .note { margin-top: 6px; font-weight: 700; text-align: center; }
  ${FA_GRID_CSS}
  ${SIGN_CSS}
  .sign { font-family: inherit; }
  @media screen {
    html, body { background: #9e9e9e; }
    body { padding: 12px 0; }
    .stmt { width: ${w}; min-height: ${h}; padding: ${MARGIN}; margin: 0 auto 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
  }
  `;
};

/**
 * @param {object[]} statements  built statements (null entries are skipped)
 * @param {object} ctx  { shortName, registeredName, financialYear, generatedOn }
 */
export const buildFinalAccountsPrintHtml = (statements, ctx, orientation = 'landscape') => {
  const body = statements.filter(Boolean).map(st => `
  <section class="stmt fa-report">
    ${reportHeaderHtml(st, ctx)}
    ${statementTableHtml(st)}
    ${signRowHtml(ctx.generatedOn)}
  </section>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Final Accounts</title>
  <style>${printCss(orientation)}</style>
</head>
<body>${body}</body>
</html>`;
};

/** One worksheet per statement, laid out like the printed grid. */
export const exportFinalAccountsExcel = (statements, ctx, fileName) => {
  const wb = XLSX.utils.book_new();
  const val = (v) => (v === undefined || v === null ? '' : Math.round(parseFloat(v || 0) * 100) / 100);
  const cells = (line) => {
    if (!line) return ['', '', '', ''];
    if (line.type === 'group') return [line.sl ?? '', line.label, '', ''];
    if (line.type === 'carried') return ['', line.label, '', val(line.total)];
    return ['', line.keepCase ? line.label : String(line.label || '').toUpperCase(), val(line.amount), line.total !== undefined ? val(line.total) : ''];
  };

  statements.filter(Boolean).forEach(st => {
    const head = (s) => ['Sl.', s.colTitle || 'Particulars', 'Amount', 'Total'];
    const rows = [
      [String(ctx.shortName || '').toUpperCase()],
      ...(ctx.registeredName ? [[ctx.registeredName]] : []),
      [st.heading],
      [`Financial Year : ${ctx.financialYear}`],
      ...(st.sideTitles ? [[st.left.title.toUpperCase(), '', '', '', st.right.title.toUpperCase()]] : []),
      [...head(st.left), ...head(st.right)],
      ...pairRows(st).map(([l, r]) => [...cells(l), ...cells(r)]),
      ['', st.grandLabel || 'Total', '', val(st.left.total), '', st.grandLabel || 'Total', '', val(st.right.total)]
    ];
    if (st.note) rows.push([], [st.note.text]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 44 }, { wch: 14 }, { wch: 14 }, { wch: 5 }, { wch: 44 }, { wch: 14 }, { wch: 14 }];
    const titleRows = ctx.registeredName ? 3 : 2;
    ws['!merges'] = Array.from({ length: titleRows }, (_, r) => ({ s: { r, c: 0 }, e: { r, c: 7 } }));
    XLSX.utils.book_append_sheet(wb, ws, st.title.replace(/&/g, 'and').slice(0, 31));
  });

  XLSX.writeFile(wb, fileName);
};
