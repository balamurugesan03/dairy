/**
 * Accounts report typography — the Receipt & Disbursement standard
 * (shared/rdPrint.js RD_CSS) applied to Day Book, Cash Book and General
 * Ledger so all four read the same:
 *   • Times New Roman, black on white
 *   • body / data rows 10pt (9pt on dense portrait prints)
 *   • society name 1.25 × body, uppercase, regular weight
 *   • report title body size, bold, underlined, uppercase
 *   • column headers body size, bold, centred
 *   • totals bold; opening / closing balances bold italic
 *   • narration / secondary text 0.9 × body
 */
export const RPT_FONT = "'Times New Roman', Times, serif";

// On-screen sizes (the R&D screen shows the A4 sheet at 10pt)
export const RPT = {
  body:  '10pt',
  org:   '12.5pt',
  title: '10pt',
  th:    '10pt',
  small: '9pt',
};

// Print body size by orientation — mirrors rdPageSpec (narrow sheet → 9pt)
export const rptPrintSize = (orientation) => (orientation === 'portrait' ? '9pt' : '10pt');
