import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box, Group, Text, Button, Select, Paper, Container, Loader, Center, Alert, ScrollArea, Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPrinter, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { milkBillAPI, farmerAPI, paymentRegisterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { openA4Print, escapeHtml } from '../../utils/printA4';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const f1  = (v) => (v == null || v === 0) ? '' : (+v).toFixed(1);
const f2  = (v) => (v == null || v === 0) ? '' : (+v).toFixed(2);
const fN  = (v) => (+(v || 0)).toFixed(2);
const fI  = (v) => (v == null || v === 0) ? '' : Math.round(+v);
const fD  = (d) => dayjs(d).format('DD/MM/YYYY');

const ALL = 'all';

/* ── Screen styles ──────────────────────────────────────────────────────────── */
const FONT = "'Courier New', Courier, monospace";
const B    = '1px solid #555';
const BH   = '1.5px solid #000';
const BL   = '1px solid #bbb';
const FS   = 9;

const thSec = (extra = {}) => ({
  background: '#ddd', color: '#000', fontWeight: 700, fontSize: FS + 0.5, textAlign: 'center',
  border: BH, padding: '3px 2px', letterSpacing: 0.6, fontFamily: FONT, ...extra,
});
const thCol = (extra = {}) => ({
  background: '#eee', color: '#000', fontWeight: 700, fontSize: FS, textAlign: 'center',
  border: B, padding: '2px 2px', whiteSpace: 'nowrap', fontFamily: FONT, ...extra,
});
const td = (extra = {}) => ({
  border: BL, padding: '1px 3px', fontSize: FS, fontFamily: FONT, textAlign: 'right',
  verticalAlign: 'middle', height: 16, lineHeight: '16px', ...extra,
});
const tdDay = { ...td(), textAlign: 'center', fontWeight: 600, background: '#f5f5f5', border: B, width: 32 };
const tdTot = { ...td(), fontWeight: 700, background: '#ddd', border: BH, fontSize: FS + 0.5 };
const sumLbl = (bold) => ({
  fontFamily: FONT, fontSize: FS + 0.5, fontWeight: bold ? 700 : 400,
  color: '#000', padding: '2px 4px 2px 0', textAlign: 'left', whiteSpace: 'nowrap',
});
const sumVal = (bold) => ({
  fontFamily: FONT, fontSize: FS + 0.5, fontWeight: bold ? 700 : 400,
  color: '#000', padding: '2px 0 2px 8px', textAlign: 'right', whiteSpace: 'nowrap', minWidth: 80,
});
const secTitle = (mt = 0) => ({
  fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000', borderBottom: BH,
  paddingBottom: 2, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, marginTop: mt,
});

// Deductions side of the summary (shared by screen and print)
const totalDeductionsOf = (s) =>
  (s.previousBalance < 0 ? Math.abs(s.previousBalance) : 0) + s.totalCattleFeed + s.totalDeductions + s.totalPayments;

/* ══════════════════════════════════════════════════════════════════════════════
   One producer's bill on screen
══════════════════════════════════════════════════════════════════════════════ */
const BillSheet = React.memo(({ bill, societyName }) => {
  const { days = [], cattleFeedRows = [], deductionRows = [], paymentRows = [], summary = {}, farmer = {}, period = {} } = bill;
  let secNo = 1;
  return (
    <Paper withBorder p={0} radius={0}
      style={{ background: '#fff', border: '1px solid #999', maxWidth: 820, margin: '0 auto 18px' }}>
      <Box p="xs" style={{ background: '#fff' }}>

        {/* ── HEADER ── */}
        <Box ta="center" mb={4} style={{ borderBottom: BH, paddingBottom: 4 }}>
          <Text fw={900} style={{ fontSize: 14, letterSpacing: 2, fontFamily: FONT, color: '#000', textDecoration: 'underline' }}>
            {societyName}
          </Text>
          <Text fw={700} style={{ fontSize: 12, fontFamily: FONT, color: '#000', letterSpacing: 1 }}>
            MILK BILL — PRODUCER STATEMENT
          </Text>
        </Box>

        {/* ── PRODUCER INFO BAR ── */}
        <Box style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
          gap: 4, borderBottom: B, paddingBottom: 4, marginBottom: 6 }}>
          <Text style={{ fontSize: 9.5, fontFamily: FONT, fontWeight: 700, color: '#000' }}>
            Name: {farmer.name?.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 9.5, fontFamily: FONT, color: '#000' }}>
            Producer No: <strong>{farmer.number}</strong>
            {farmer.memberId && farmer.memberId !== farmer.number ? `  |  Member No: ${farmer.memberId}` : ''}
            {farmer.centre ? `  |  ${farmer.centre}` : ''}
          </Text>
          <Text style={{ fontSize: 9.5, fontFamily: FONT, color: '#000' }}>
            Cycle: <strong>{fD(period.fromDate)} to {fD(period.toDate)}</strong>
          </Text>
        </Box>

        {/* ══ MILK COLLECTION ══ */}
        <Text style={secTitle()}>{secNo++}. Milk Collection Details</Text>
        <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              {[64, 50, 26, 30, 30, 40, 50, 26, 30, 30, 40, 50, 40, 62].map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={thSec({ border: BH })} rowSpan={2}>Date</th>
                <th style={thSec()} colSpan={5}>MORNING (AM)</th>
                <th style={thSec()} colSpan={5}>EVENING (PM)</th>
                <th style={thSec()} colSpan={3}>TOTAL</th>
              </tr>
              <tr>
                {['Ltr', 'CLR', 'FAT', 'SNF', 'Rate', 'Ltr', 'CLR', 'FAT', 'SNF', 'Rate', 'Ltr', 'Rate', 'Amount']
                  .map((h, i) => <th key={i} style={thCol()}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map(({ date, am, pm }) => {
                const totQty = (am?.qty || 0) + (pm?.qty || 0);
                const totAmt = (am?.amount || 0) + (pm?.amount || 0);
                const avgR   = totQty > 0 ? totAmt / totQty : 0;
                return (
                  <tr key={date} style={{ background: '#fff' }}>
                    <td style={tdDay}>{fD(date)}</td>
                    <td style={td()}>{f1(am?.qty)}</td>
                    <td style={td({ textAlign: 'center' })}>{fI(am?.clr)}</td>
                    <td style={td({ textAlign: 'center' })}>{f1(am?.fat)}</td>
                    <td style={td({ textAlign: 'center' })}>{f1(am?.snf)}</td>
                    <td style={td()}>{f2(am?.rate)}</td>
                    <td style={td()}>{f1(pm?.qty)}</td>
                    <td style={td({ textAlign: 'center' })}>{fI(pm?.clr)}</td>
                    <td style={td({ textAlign: 'center' })}>{f1(pm?.fat)}</td>
                    <td style={td({ textAlign: 'center' })}>{f1(pm?.snf)}</td>
                    <td style={td()}>{f2(pm?.rate)}</td>
                    <td style={td({ fontWeight: totQty ? 600 : 400 })}>{f1(totQty || null)}</td>
                    <td style={td()}>{totQty ? f2(avgR) : ''}</td>
                    <td style={td({ fontWeight: totQty ? 600 : 400 })}>{totAmt ? fN(totAmt) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...tdTot, textAlign: 'center' }}>TOTAL</td>
                <td style={tdTot}>{fN(summary.amQty)}</td>
                <td style={tdTot} /><td style={tdTot} /><td style={tdTot} /><td style={tdTot} />
                <td style={tdTot}>{fN(summary.pmQty)}</td>
                <td style={tdTot} /><td style={tdTot} /><td style={tdTot} /><td style={tdTot} />
                <td style={tdTot}>{fN(summary.totalMilkQty)}</td>
                <td style={tdTot}>{summary.totalMilkQty > 0 ? f2(summary.totalMilkAmt / summary.totalMilkQty) : ''}</td>
                <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalMilkAmt)}</td>
              </tr>
            </tfoot>
          </table>
        </Box>

        {/* ══ CATTLE FEED ══ */}
        {cattleFeedRows.length > 0 && (
          <>
            <Text style={secTitle(8)}>{secNo++}. Cattle Feed Purchase Details</Text>
            <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thCol({ textAlign: 'left', width: 80 })}>Date</th>
                    <th style={thCol({ textAlign: 'left' })}>Item</th>
                    <th style={thCol({ width: 50 })}>Bill No</th>
                    <th style={thCol({ width: 50 })}>Qty</th>
                    <th style={thCol({ width: 50 })}>Rate</th>
                    <th style={thCol({ width: 72 })}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cattleFeedRows.map((row, i) => (
                    <tr key={i} style={{ background: '#fff' }}>
                      <td style={td({ textAlign: 'left' })}>{fD(row.date)}</td>
                      <td style={td({ textAlign: 'left' })}>{row.itemName}</td>
                      <td style={td({ textAlign: 'center' })}>{row.billNumber}</td>
                      <td style={td()}>{row.quantity}</td>
                      <td style={td()}>{f2(row.rate)}</td>
                      <td style={td({ fontWeight: 600 })}>{fN(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ ...tdTot, textAlign: 'right' }}>Total Cattle Feed</td>
                    <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalCattleFeed)}</td>
                  </tr>
                </tfoot>
              </table>
            </Box>
          </>
        )}

        {/* ══ DEDUCTIONS ══ */}
        {deductionRows.length > 0 && (
          <>
            <Text style={secTitle(8)}>{secNo++}. Other Deductions</Text>
            <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thCol({ textAlign: 'left', width: 80 })}>Date</th>
                    <th style={thCol({ textAlign: 'left' })}>Description</th>
                    <th style={thCol({ width: 80 })}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {deductionRows.map((row, i) => (
                    <tr key={i} style={{ background: '#fff' }}>
                      <td style={td({ textAlign: 'left' })}>{fD(row.date)}</td>
                      <td style={td({ textAlign: 'left' })}>{row.itemName}</td>
                      <td style={td({ fontWeight: 600 })}>{fN(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ ...tdTot, textAlign: 'right' }}>Total Deductions</td>
                    <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalDeductions)}</td>
                  </tr>
                </tfoot>
              </table>
            </Box>
          </>
        )}

        {/* ══ PAYMENTS ══ */}
        {paymentRows.length > 0 && (
          <>
            <Text style={secTitle(8)}>{secNo++}. Payments Made</Text>
            <Box style={{ overflowX: 'auto', marginBottom: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thCol({ textAlign: 'left', width: 80 })}>Date</th>
                    <th style={thCol({ textAlign: 'left' })}>Mode</th>
                    <th style={thCol({ textAlign: 'left' })}>Reference</th>
                    <th style={thCol({ width: 80 })}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((row, i) => (
                    <tr key={i} style={{ background: '#fff' }}>
                      <td style={td({ textAlign: 'left' })}>{fD(row.date)}</td>
                      <td style={td({ textAlign: 'left' })}>{row.mode}</td>
                      <td style={td({ textAlign: 'left' })}>{row.refNo}</td>
                      <td style={td({ fontWeight: 600 })}>{fN(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ ...tdTot, textAlign: 'right' }}>Total Payments</td>
                    <td style={{ ...tdTot, fontSize: FS + 1 }}>{fN(summary.totalPayments)}</td>
                  </tr>
                </tfoot>
              </table>
            </Box>
          </>
        )}

        {/* ══ SUMMARY ══ */}
        <Box mt={8} style={{ border: BH }}>
          <Box style={{ background: '#ddd', padding: '3px 6px', borderBottom: BH }}>
            <Text style={{ fontFamily: FONT, fontSize: FS + 1, fontWeight: 700, color: '#000', textTransform: 'uppercase', letterSpacing: 1 }}>
              Summary
            </Text>
          </Box>
          <Box style={{ display: 'flex', gap: 0 }}>
            <Box style={{ flex: 1, borderRight: BH, padding: '5px 8px' }}>
              <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000', marginBottom: 3, textDecoration: 'underline' }}>
                EARNINGS
              </Text>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={sumLbl()}>Milk Total ({fN(summary.totalMilkQty)} Ltr)</td>
                    <td style={sumVal()}>{fN(summary.totalMilkAmt)}</td>
                  </tr>
                  {summary.previousBalance !== 0 && (
                    <tr>
                      <td style={sumLbl()}>Previous Balance {summary.previousBalance > 0 ? '(Cr)' : '(Dr)'}</td>
                      <td style={sumVal()}>{summary.previousBalance < 0 ? '− ' : '+ '}{fN(Math.abs(summary.previousBalance))}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: B }}>
                    <td style={sumLbl(true)}>Gross Total</td>
                    <td style={sumVal(true)}>{fN(summary.totalMilkAmt + Math.max(0, summary.previousBalance))}</td>
                  </tr>
                </tbody>
              </table>
            </Box>
            <Box style={{ flex: 1.2, padding: '5px 8px' }}>
              <Text style={{ fontFamily: FONT, fontSize: FS, fontWeight: 700, color: '#000', marginBottom: 3, textDecoration: 'underline' }}>
                DEDUCTIONS & PAYMENTS
              </Text>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {summary.previousBalance < 0 && (
                    <tr><td style={sumLbl()}>Previous Due (Dr)</td><td style={sumVal()}>{fN(Math.abs(summary.previousBalance))}</td></tr>
                  )}
                  {summary.totalCattleFeed > 0 && (
                    <tr><td style={sumLbl()}>Cattle Feed</td><td style={sumVal()}>{fN(summary.totalCattleFeed)}</td></tr>
                  )}
                  {summary.totalDeductions > 0 && (
                    <tr><td style={sumLbl()}>Other Deductions</td><td style={sumVal()}>{fN(summary.totalDeductions)}</td></tr>
                  )}
                  {summary.totalBankPay > 0 && (
                    <tr><td style={sumLbl()}>Bank Payment</td><td style={sumVal()}>{fN(summary.totalBankPay)}</td></tr>
                  )}
                  {summary.totalCashPay > 0 && (
                    <tr><td style={sumLbl()}>Cash Payment</td><td style={sumVal()}>{fN(summary.totalCashPay)}</td></tr>
                  )}
                  <tr style={{ borderTop: B }}>
                    <td style={sumLbl(true)}>Total Deductions</td>
                    <td style={sumVal(true)}>{fN(totalDeductionsOf(summary))}</td>
                  </tr>
                </tbody>
              </table>
              <Box style={{
                marginTop: 4, borderTop: BH, padding: '4px 0', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', background: summary.netAmount >= 0 ? '#e8f5e9' : '#fce4ec',
              }}>
                <Text style={{ fontFamily: FONT, fontSize: FS + 2, fontWeight: 700, color: '#000', paddingLeft: 4 }}>
                  {summary.netAmount >= 0 ? 'Net Payable (To Producer)' : 'Net Due (From Producer)'}
                </Text>
                <Text style={{ fontFamily: FONT, fontSize: FS + 3, fontWeight: 900, color: '#000', paddingRight: 4 }}>
                  Rs.&nbsp;{fN(Math.abs(summary.netAmount))}
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── FOOTER ── */}
        <Box mt={6} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: BH, paddingTop: 5 }}>
          <Text style={{ fontSize: 9, fontFamily: FONT, color: '#000' }}>Statement Date: {dayjs().format('DD/MM/YYYY')}</Text>
          <Box ta="center">
            <Box style={{ width: 140, borderBottom: B, marginBottom: 2 }} />
            <Text style={{ fontSize: 9, fontFamily: FONT, color: '#000' }}>Clerk / Secretary</Text>
          </Box>
          <Box ta="center">
            <Box style={{ width: 140, borderBottom: B, marginBottom: 2 }} />
            <Text style={{ fontSize: 9, fontFamily: FONT, color: '#000' }}>Producer Signature</Text>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
});
BillSheet.displayName = 'BillSheet';

/* ══════════════════════════════════════════════════════════════════════════════
   PRINT — A4 portrait, each bill in one half of the page (left | right) with a
   vertical line between them; two producers per page. A pair taller than the
   page is scaled down to fit, so nothing is cut off or split across pages.
══════════════════════════════════════════════════════════════════════════════ */
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 8mm 7mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .mb-page { display: grid; grid-template-columns: 1fr 1fr; column-gap: 0; width: 100%;
    page-break-after: always; break-after: page; transform-origin: top left; }
  .mb-page:last-child { page-break-after: auto; break-after: auto; }
  .mb-half { padding: 0 3.5mm; min-width: 0; }
  .mb-half + .mb-half { border-left: 1.2px solid #000; }
  .mb-head { text-align: center; border-bottom: 1.4px solid #000; padding-bottom: 3px; margin-bottom: 3px; }
  .mb-soc { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .mb-title { font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px; }
  .mb-info { font-size: 8.5px; line-height: 1.35; border-bottom: 1px solid #555; padding-bottom: 3px; margin-bottom: 4px; }
  .mb-info b { font-weight: 700; }
  .mb-info .row { display: flex; justify-content: space-between; gap: 6px; }
  .mb-sec { font-size: 8px; font-weight: 700; text-transform: uppercase; border-bottom: 1.2px solid #000;
    margin: 5px 0 2px; padding-bottom: 1px; }
  table.mb { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.mb th, table.mb td { border: 0.6px solid #666; padding: 1px 1.5px; font-size: 7.4px; line-height: 1.25;
    overflow: hidden; white-space: nowrap; }
  table.mb th { background: #e5e5e5; font-weight: 700; text-align: center; }
  table.mb td { text-align: right; font-variant-numeric: tabular-nums; }
  table.mb td.c { text-align: center; }
  table.mb td.l { text-align: left; white-space: normal; }
  table.mb tr.tot td { font-weight: 700; background: #e5e5e5; border-top: 1.1px solid #000; }
  .mb-sum { display: grid; grid-template-columns: 1fr 1fr; border: 1.1px solid #000; margin-top: 5px; font-size: 8px; }
  .mb-sum > div { padding: 3px 4px; }
  .mb-sum > div + div { border-left: 1.1px solid #000; }
  .mb-sum h4 { font-size: 7.6px; text-decoration: underline; margin-bottom: 2px; }
  .mb-sum .r { display: flex; justify-content: space-between; gap: 4px; }
  .mb-sum .r.b { font-weight: 700; border-top: 0.6px solid #555; margin-top: 1px; padding-top: 1px; }
  .mb-net { display: flex; justify-content: space-between; font-weight: 700; font-size: 9px;
    border: 1.1px solid #000; border-top: none; padding: 3px 4px; }
  .mb-foot { display: flex; justify-content: space-between; margin-top: 18px; font-size: 7.6px; }
  .mb-foot span { border-top: 0.8px solid #000; padding-top: 1px; min-width: 70px; text-align: center; }
`;

const fitScript = `
<script>
  (function () {
    // A4 portrait content height in CSS px (297mm − 16mm margins)
    var PAGE_H = 1060;
    document.querySelectorAll('.mb-page').forEach(function (el) {
      var z = PAGE_H / el.scrollHeight;
      if (z < 1) el.style.zoom = Math.max(z, 0.5);
    });
  })();
</script>`;

const billHtml = (bill, societyName) => {
  const { days = [], cattleFeedRows = [], deductionRows = [], paymentRows = [], summary: s = {}, farmer = {}, period = {} } = bill;
  const e = escapeHtml;
  let no = 1;
  const milk = days.map(({ date, am, pm }) => {
    const q = (am?.qty || 0) + (pm?.qty || 0);
    const a = (am?.amount || 0) + (pm?.amount || 0);
    return `<tr><td class="c">${dayjs(date).format('DD/MM')}</td>
      <td>${f1(am?.qty)}</td><td class="c">${fI(am?.clr)}</td><td class="c">${f1(am?.fat)}</td><td class="c">${f1(am?.snf)}</td><td>${f2(am?.rate)}</td>
      <td>${f1(pm?.qty)}</td><td class="c">${fI(pm?.clr)}</td><td class="c">${f1(pm?.fat)}</td><td class="c">${f1(pm?.snf)}</td><td>${f2(pm?.rate)}</td>
      <td><b>${f1(q || null)}</b></td><td>${q ? f2(a / q) : ''}</td><td><b>${a ? fN(a) : ''}</b></td></tr>`;
  }).join('');
  const list = (title, head, widths, rows, totalLabel, total) => (rows.length ? `
    <div class="mb-sec">${no++}. ${title}</div>
    <table class="mb"><colgroup>${widths.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
      <thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}<tr class="tot"><td colspan="${head.length - 1}">${totalLabel}</td><td>${fN(total)}</td></tr></tbody>
    </table>` : '');
  const line = (label, value, bold) => `<div class="r${bold ? ' b' : ''}"><span>${label}</span><span>${value}</span></div>`;
  const prev = s.previousBalance || 0;

  return `
    <div class="mb-head">
      <div class="mb-soc">${e(societyName)}</div>
      <div class="mb-title">MILK BILL — PRODUCER STATEMENT</div>
    </div>
    <div class="mb-info">
      <div class="row"><span>Name: <b>${e((farmer.name || '').toUpperCase())}</b></span><span>No: <b>${e(farmer.number)}</b></span></div>
      <div class="row"><span>${farmer.centre ? `Centre: ${e(farmer.centre)}` : ''}${farmer.memberId && farmer.memberId !== farmer.number ? ` · Member No: ${e(farmer.memberId)}` : ''}</span>
        <span>Cycle: <b>${fD(period.fromDate)} – ${fD(period.toDate)}</b></span></div>
    </div>

    <div class="mb-sec">${no++}. Milk Collection Details</div>
    <table class="mb">
      <colgroup><col style="width:10%">${[7, 5, 5.5, 5.5, 7, 7, 5, 5.5, 5.5, 7].map(w => `<col style="width:${w}%">`).join('')}<col style="width:8%"><col style="width:7%"><col style="width:15%"></colgroup>
      <thead>
        <tr><th rowspan="2">Date</th><th colspan="5">MORNING (AM)</th><th colspan="5">EVENING (PM)</th><th colspan="3">TOTAL</th></tr>
        <tr>${['Ltr', 'CLR', 'FAT', 'SNF', 'Rate', 'Ltr', 'CLR', 'FAT', 'SNF', 'Rate', 'Ltr', 'Rate', 'Amount'].map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>${milk || '<tr><td colspan="14" class="c">No milk in this cycle</td></tr>'}
        <tr class="tot"><td class="c">TOTAL</td><td>${fN(s.amQty)}</td><td colspan="4"></td><td>${fN(s.pmQty)}</td><td colspan="4"></td>
          <td>${fN(s.totalMilkQty)}</td><td>${s.totalMilkQty > 0 ? f2(s.totalMilkAmt / s.totalMilkQty) : ''}</td><td>${fN(s.totalMilkAmt)}</td></tr>
      </tbody>
    </table>

    ${list('Cattle Feed Purchase', ['Date', 'Item', 'Bill', 'Qty', 'Rate', 'Amount'], [15, 37, 12, 10, 11, 15],
      cattleFeedRows.map(r => `<tr><td class="c">${fD(r.date)}</td><td class="l">${e(r.itemName)}</td><td class="c">${e(r.billNumber)}</td><td>${e(r.quantity)}</td><td>${f2(r.rate)}</td><td>${fN(r.amount)}</td></tr>`),
      'Total Cattle Feed', s.totalCattleFeed)}
    ${list('Other Deductions', ['Date', 'Description', 'Amount'], [18, 62, 20],
      deductionRows.map(r => `<tr><td class="c">${fD(r.date)}</td><td class="l">${e(r.itemName)}</td><td>${fN(r.amount)}</td></tr>`),
      'Total Deductions', s.totalDeductions)}
    ${list('Payments Made', ['Date', 'Mode', 'Reference', 'Amount'], [18, 22, 40, 20],
      paymentRows.map(r => `<tr><td class="c">${fD(r.date)}</td><td class="l">${e(r.mode)}</td><td class="l">${e(r.refNo)}</td><td>${fN(r.amount)}</td></tr>`),
      'Total Payments', s.totalPayments)}

    <div class="mb-sum">
      <div>
        <h4>EARNINGS</h4>
        ${line(`Milk (${fN(s.totalMilkQty)} L)`, fN(s.totalMilkAmt))}
        ${prev !== 0 ? line(`Prev. Balance ${prev > 0 ? '(Cr)' : '(Dr)'}`, `${prev < 0 ? '− ' : '+ '}${fN(Math.abs(prev))}`) : ''}
        ${line('Gross Total', fN(s.totalMilkAmt + Math.max(0, prev)), true)}
      </div>
      <div>
        <h4>DEDUCTIONS &amp; PAYMENTS</h4>
        ${prev < 0 ? line('Previous Due', fN(Math.abs(prev))) : ''}
        ${s.totalCattleFeed > 0 ? line('Cattle Feed', fN(s.totalCattleFeed)) : ''}
        ${s.totalDeductions > 0 ? line('Other Deductions', fN(s.totalDeductions)) : ''}
        ${s.totalBankPay > 0 ? line('Bank Payment', fN(s.totalBankPay)) : ''}
        ${s.totalCashPay > 0 ? line('Cash Payment', fN(s.totalCashPay)) : ''}
        ${line('Total Deductions', fN(totalDeductionsOf(s)), true)}
      </div>
    </div>
    <div class="mb-net"><span>${s.netAmount >= 0 ? 'Net Payable (To Producer)' : 'Net Due (From Producer)'}</span><span>Rs. ${fN(Math.abs(s.netAmount))}</span></div>
    <div class="mb-foot"><span>Date: ${dayjs().format('DD/MM/YYYY')}</span><span>Clerk / Secretary</span><span>Producer Signature</span></div>`;
};

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
const MilkBillReport = () => {
  const { selectedCompany } = useCompany();

  const [farmers,  setFarmers]  = useState([]);
  const [cycles,   setCycles]   = useState([]);
  const [farmerId, setFarmerId] = useState(ALL);     // All Farmers / All Members by default
  const [cycleId,  setCycleId]  = useState(null);
  const [loadingF, setLoadingF] = useState(false);
  const [loadingC, setLoadingC] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [bills,    setBills]    = useState(null);    // [bill] — one producer or all of them
  const [error,    setError]    = useState('');

  /* ── Load farmers ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setLoadingF(true);
      try {
        const res = await farmerAPI.getAll({ status: 'Active', limit: 2000 });
        const list = res.data || [];
        setFarmers(list.map((f) => ({
          value: f._id,
          label: `${f.farmerNumber} — ${f.personalDetails?.name || ''}`,
        })));
      } catch {
        notifications.show({ title: 'Error', message: 'Could not load farmers', color: 'red' });
      } finally {
        setLoadingF(false);
      }
    };
    load();
  }, []);

  /* ── Load saved Producers cycles — the latest one is selected by default ── */
  useEffect(() => {
    const load = async () => {
      setLoadingC(true);
      try {
        const [savedRes, printedRes] = await Promise.all([
          paymentRegisterAPI.getAll({ registerType: 'Producers', status: 'Saved',   limit: 200 }),
          paymentRegisterAPI.getAll({ registerType: 'Producers', status: 'Printed', limit: 200 }),
        ]);
        const list = [...(savedRes.data || []), ...(printedRes.data || [])]
          .sort((a, b) => new Date(b.toDate) - new Date(a.toDate) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        const opts = list.map((c) => ({
          value: c._id,
          label: `${fD(c.fromDate)} – ${fD(c.toDate)}`,
          fromDate: c.fromDate,
          toDate:   c.toDate,
        }));
        setCycles(opts);
        if (opts.length) setCycleId(prev => prev || opts[0].value);
      } catch {
        notifications.show({ title: 'Error', message: 'Could not load cycles', color: 'red' });
      } finally {
        setLoadingC(false);
      }
    };
    load();
  }, []);

  const farmerOptions = useMemo(
    () => [{ value: ALL, label: 'All Farmers / All Members' }, ...farmers],
    [farmers]
  );

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.value === cycleId) || null,
    [cycles, cycleId]
  );

  /* ── Fetch bill(s) ───────────────────────────────────────────────────────── */
  const handleFetch = useCallback(async () => {
    if (!selectedCycle) {
      notifications.show({ title: 'Select cycle', message: 'Choose a payment cycle', color: 'orange' });
      return;
    }
    setLoading(true);
    setError('');
    setBills(null);
    const params = { fromDate: selectedCycle.fromDate, toDate: selectedCycle.toDate };
    try {
      if (farmerId === ALL) {
        const res = await milkBillAPI.getAllByCycle(params);
        if (!res.success) throw new Error(res.message || 'Failed');
        setBills(res.bills || []);
      } else {
        const res = await milkBillAPI.getByCycle(farmerId, params);
        if (!res.success) throw new Error(res.message || 'Failed');
        setBills([res]);
      }
    } catch (e) {
      setError(e.message || 'Failed to load milk bill');
    } finally {
      setLoading(false);
    }
  }, [farmerId, selectedCycle]);

  const societyName = (selectedCompany?.societyName || selectedCompany?.companyName || 'DAIRY COOPERATIVE SOCIETY').toUpperCase();

  /* ── Print: two producers per A4 portrait page, side by side ─────────────── */
  const handlePrint = () => {
    if (!bills?.length) return;
    const pages = [];
    for (let i = 0; i < bills.length; i += 2) {
      const pair = bills.slice(i, i + 2);
      pages.push(`<div class="mb-page">${pair.map(b => `<div class="mb-half">${billHtml(b, societyName)}</div>`).join('')}</div>`);
    }
    openA4Print({
      title: bills.length === 1 ? `Milk Bill ${bills[0].farmer?.number || ''}` : `Milk Bills ${selectedCycle?.label || ''}`,
      orientation: 'portrait',
      css: PRINT_CSS,
      bodyHtml: pages.join('') + fitScript,
    });
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <Container fluid px="md" py="sm">
      {/* ── Controls ───────────────────────────────────────────────────── */}
      <Paper withBorder p="sm" radius="md" mb="md" style={{ background: '#f8f9fa' }}>
        <Group wrap="wrap" gap="sm" align="flex-end">
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>Producer Number</Text>
            <Select
              data={farmerOptions}
              value={farmerId}
              onChange={(v) => { setFarmerId(v || ALL); setBills(null); }}
              placeholder={loadingF ? 'Loading...' : 'Search producer...'}
              searchable allowDeselect={false}
              style={{ minWidth: 280 }}
              size="sm"
              rightSection={loadingF ? <Loader size={14} /> : undefined}
            />
          </Box>

          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>Cycle</Text>
            <Select
              data={cycles}
              value={cycleId}
              onChange={(v) => { setCycleId(v); setBills(null); }}
              placeholder={loadingC ? 'Loading...' : 'Select cycle...'}
              searchable clearable
              style={{ minWidth: 220 }}
              size="sm"
              disabled={loadingC}
              rightSection={loadingC ? <Loader size={14} /> : undefined}
              nothingFoundMessage="No saved cycles found"
            />
          </Box>

          <Button leftSection={<IconRefresh size={14} />} size="sm" color="blue" loading={loading} onClick={handleFetch}>
            Generate Report
          </Button>

          <Button leftSection={<IconPrinter size={14} />} size="sm" variant="outline" disabled={!bills?.length} onClick={handlePrint}>
            Print
          </Button>

          {bills && (
            <Badge size="lg" variant="light" color="blue" ml="auto">
              {bills.length} producer{bills.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </Group>
      </Paper>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>
      )}

      {loading && <Center py="xl"><Loader size="md" /></Center>}

      {!loading && !bills && !error && (
        <Center py="xl">
          <Text c="dimmed" size="sm">
            Select a producer (or All Farmers / All Members) and a payment cycle, then click <strong>Generate Report</strong>.
          </Text>
        </Center>
      )}

      {!loading && bills && bills.length === 0 && (
        <Center py="xl"><Text c="dimmed" size="sm">No milk collection in this cycle.</Text></Center>
      )}

      {/* ══ BILLS — one after another, scrolling vertically ══════════════ */}
      {!loading && bills && bills.length > 0 && (
        <ScrollArea h="calc(100vh - 190px)" type="always" offsetScrollbars>
          {bills.map((b) => <BillSheet key={b.farmer?._id || b.farmer?.number} bill={b} societyName={societyName} />)}
        </ScrollArea>
      )}
    </Container>
  );
};

export default MilkBillReport;
