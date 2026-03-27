import { useState, useRef } from 'react';
import {
  Box, Paper, Group, Stack, Text, Button, Select,
  Loader, Center, ActionIcon, Tooltip, SegmentedControl
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCalendar, IconRefresh, IconPrinter, IconFileExport,
  IconInbox, IconLayoutColumns, IconLayoutRows, IconColumns3
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

// ── Date presets ──────────────────────────────────────────────────────────
const PRESETS = [
  { value: 'thisMonth',     label: 'This Month' },
  { value: 'lastMonth',     label: 'Last Month' },
  { value: 'thisQuarter',   label: 'This Quarter' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom',        label: 'Custom Range' }
];

const getPresetRange = (preset) => {
  const now = dayjs();
  switch (preset) {
    case 'thisMonth':     return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth':     return [now.subtract(1,'month').startOf('month').toDate(), now.subtract(1,'month').endOf('month').toDate()];
    case 'thisQuarter':   return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fy = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

// ── Formatting ────────────────────────────────────────────────────────────
const f = (n) => {
  const v = parseFloat(n || 0);
  return v === 0 ? '' : v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fz = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';
const fmtMonth = (d) => d ? dayjs(d).format('MMMM-YYYY').toUpperCase() : '';

// ── Shared inline styles ──────────────────────────────────────────────────
const FF = 'Arial, Helvetica, sans-serif';
const BORDER = '1px solid #bbb';
const BORDER2 = '2px solid #555';

const th = (extra = {}) => ({
  border: BORDER,
  padding: '4px 6px',
  fontWeight: 700,
  fontSize: 10,
  background: '#e8e8e8',
  textAlign: 'center',
  fontFamily: FF,
  whiteSpace: 'nowrap',
  ...extra
});

const td = (extra = {}) => ({
  border: BORDER,
  padding: '3px 6px',
  fontSize: 10,
  fontFamily: FF,
  ...extra
});

const secHdr = (extra = {}) => ({
  border: BORDER,
  padding: '4px 6px',
  fontSize: 10,
  fontWeight: 700,
  background: '#d4d4d4',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  fontFamily: FF,
  ...extra
});

const secTot = (extra = {}) => ({
  border: BORDER,
  padding: '3px 6px',
  fontSize: 10,
  fontWeight: 700,
  background: '#f0f0f0',
  fontFamily: FF,
  ...extra
});

// ── Document header (shared) ──────────────────────────────────────────────
const DocHeader = ({ companyName, dateRange, subtitle = 'End of the Month' }) => (
  <div style={{ textAlign: 'center', borderBottom: BORDER2, paddingBottom: 10, marginBottom: 12, fontFamily: FF }}>
    <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>
      {companyName}
    </div>
    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
      RECEIPT AND DISBURSEMENT FOR THE MONTH {fmtMonth(dateRange[0])}
    </div>
    <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>{subtitle}</div>
    <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>
      Period: {fmtDate(dateRange[0])} to {fmtDate(dateRange[1])}
      &nbsp;|&nbsp; Printed: {dayjs().format('DD/MM/YYYY')}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// VIEW 1 — Single 7-column table
// ─────────────────────────────────────────────────────────────────────────
const SingleTable = ({ data }) => {
  const ob = data.openingBalance || 0;
  const cb = data.closingBalance || 0;
  const rT = data.grandTotalReceiptTotal || 0;
  const pT = data.grandTotalPaymentTotal || 0;
  // Grand total with opening/closing balance included
  const grandR = ob + rT;
  const grandP = pT + (cb >= 0 ? cb : 0);
  const grand  = Math.max(grandR, grandP);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th rowSpan={2} style={th({ textAlign: 'left', width: '34%' })}>Ledger</th>
          <th colSpan={2} style={th({ background: '#2c5f8a', color: '#fff' })}>Receipt (Dr)</th>
          <th colSpan={2} style={th({ background: '#7a2a2a', color: '#fff' })}>Payment (Cr)</th>
        </tr>
        <tr>
          <th style={th({ width: '13%' })}>Cash</th>
          <th style={th({ width: '13%' })}>Total</th>
          <th style={th({ width: '13%' })}>Cash</th>
          <th style={th({ width: '13%' })}>Total</th>
        </tr>
      </thead>
      <tbody>
        {/* ── Opening Balance row ── */}
        <tr style={{ background: '#e8f5e9' }}>
          <td style={td({ fontWeight: 700, color: '#2e7d32' })}>Opening Balance (Cash in Hand)</td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
          <td style={td({})}></td>
          <td style={td({})}></td>
        </tr>

        {/* ── Sections ── */}
        {data.sections.map((sec, si) => (
          <>
            <tr key={`sh-${si}`}>
              <td colSpan={5} style={secHdr({ borderTop: BORDER2 })}>
                {sec.name} {sec.subtitle}
              </td>
            </tr>
            {sec.items.map((item, ii) => (
              <tr key={`r-${si}-${ii}`} style={{ background: ii % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={td({ paddingLeft: 14 })}>{item.ledgerName}</td>
                <td style={td({ textAlign: 'right' })}>{f(item.receiptCash)}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.receiptTotal ? 600 : 400 })}>{f(item.receiptTotal)}</td>
                <td style={td({ textAlign: 'right' })}>{f(item.paymentCash)}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.paymentTotal ? 600 : 400 })}>{f(item.paymentTotal)}</td>
              </tr>
            ))}
            <tr key={`st-${si}`}>
              <td style={secTot({ paddingLeft: 14 })}>Account Group Total</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totalReceiptCash)}</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totalReceiptTotal)}</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totalPaymentCash)}</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totalPaymentTotal)}</td>
            </tr>
          </>
        ))}

        {/* ── Sub-total row ── */}
        <tr style={{ background: '#e0e0e0', borderTop: BORDER2 }}>
          <td style={th({ textAlign: 'left', borderTop: BORDER2 })}>SUB-TOTAL (Transactions)</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(data.grandTotalReceiptCash)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(rT)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(data.grandTotalPaymentCash)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(pT)}</td>
        </tr>

        {/* ── Closing Balance row ── */}
        <tr style={{ background: '#fff3e0' }}>
          <td style={td({ fontWeight: 700, color: '#e65100' })}>Closing Balance (Cash in Hand)</td>
          <td style={td({})}></td>
          <td style={td({})}></td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(Math.max(0, cb))}</td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(Math.max(0, cb))}</td>
        </tr>

        {/* ── Grand Total ── */}
        <tr style={{ background: '#b0b0b0' }}>
          <td style={th({ textAlign: 'left', fontSize: 12 })}>GRAND TOTAL</td>
          <td style={th({ fontSize: 12 })}></td>
          <td style={th({ fontSize: 12 })}>{fz(grand)}</td>
          <td style={th({ fontSize: 12 })}></td>
          <td style={th({ fontSize: 12 })}>{fz(grand)}</td>
        </tr>
      </tbody>
    </table>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VIEW 2 — 2-column side-by-side (Receipt | Payment)
// ─────────────────────────────────────────────────────────────────────────
const TwoColumnTable = ({ data }) => {
  const ob  = data.openingBalance || 0;
  const cb  = data.closingBalance || 0;
  const rT  = data.grandTotalReceiptTotal || 0;
  const pT  = data.grandTotalPaymentTotal || 0;
  const grand = ob + rT; // = pT + max(0,cb)

  const halfW = '49.5%';
  const GAP = '1%';

  const SideTable = ({ side }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th({ textAlign: 'left', width: '40%' })}>Ledger</th>
          <th style={th({ width: '20%' })}>Adjustment</th>
          <th style={th({ width: '20%' })}>Cash</th>
          <th style={th({ width: '20%' })}>Total</th>
        </tr>
      </thead>
      <tbody>
        {/* Opening Balance — receipt side only */}
        {side === 'receipt' && (
          <tr style={{ background: '#e8f5e9' }}>
            <td style={td({ fontWeight: 700, color: '#2e7d32' })}>Opening Balance</td>
            <td style={td({})}></td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
          </tr>
        )}

        {data.sections.map((sec, si) => {
          const hasData = sec.items.some(item =>
            side === 'receipt' ? item.receiptTotal > 0 : item.paymentTotal > 0
          );
          if (!hasData) return null;

          return (
            <>
              <tr key={`sh-${si}`}>
                <td colSpan={4} style={secHdr({ borderTop: '1.5px solid #888' })}>
                  {sec.name} {sec.subtitle}
                </td>
              </tr>
              {sec.items
                .filter(item => side === 'receipt' ? item.receiptTotal > 0 : item.paymentTotal > 0)
                .map((item, ii) => (
                  <tr key={`r-${si}-${ii}`} style={{ background: ii % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={td({ paddingLeft: 12 })}>{item.ledgerName}</td>
                    <td style={td({ textAlign: 'right' })}>
                      {side === 'receipt' ? f(item.receiptAdj) : f(item.paymentAdj)}
                    </td>
                    <td style={td({ textAlign: 'right' })}>
                      {side === 'receipt' ? f(item.receiptCash) : f(item.paymentCash)}
                    </td>
                    <td style={td({ textAlign: 'right', fontWeight: 600 })}>
                      {side === 'receipt' ? f(item.receiptTotal) : f(item.paymentTotal)}
                    </td>
                  </tr>
                ))}
              <tr key={`st-${si}`}>
                <td style={secTot({ paddingLeft: 12 })}>Account Group Total</td>
                <td style={secTot({ textAlign: 'right' })}>
                  {side === 'receipt' ? fz(sec.totalReceiptAdj) : fz(sec.totalPaymentAdj)}
                </td>
                <td style={secTot({ textAlign: 'right' })}>
                  {side === 'receipt' ? fz(sec.totalReceiptCash) : fz(sec.totalPaymentCash)}
                </td>
                <td style={secTot({ textAlign: 'right' })}>
                  {side === 'receipt' ? fz(sec.totalReceiptTotal) : fz(sec.totalPaymentTotal)}
                </td>
              </tr>
            </>
          );
        })}

        {/* Sub-total */}
        <tr style={{ background: '#e0e0e0', borderTop: BORDER2 }}>
          <td style={th({ textAlign: 'left', borderTop: BORDER2 })}>
            {side === 'receipt' ? 'SUB-TOTAL (Receipts)' : 'SUB-TOTAL (Payments)'}
          </td>
          <td style={th({ borderTop: BORDER2 })}>
            {fz(side === 'receipt' ? data.grandTotalReceiptAdj : data.grandTotalPaymentAdj)}
          </td>
          <td style={th({ borderTop: BORDER2 })}>
            {fz(side === 'receipt' ? data.grandTotalReceiptCash : data.grandTotalPaymentCash)}
          </td>
          <td style={th({ borderTop: BORDER2 })}>
            {fz(side === 'receipt' ? rT : pT)}
          </td>
        </tr>

        {/* Closing Balance — payment side only */}
        {side === 'payment' && (
          <tr style={{ background: '#fff3e0' }}>
            <td style={td({ fontWeight: 700, color: '#e65100' })}>Closing Balance</td>
            <td style={td({})}></td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(Math.max(0, cb))}</td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(Math.max(0, cb))}</td>
          </tr>
        )}

        {/* Grand Total */}
        <tr style={{ background: '#b0b0b0' }}>
          <td style={th({ textAlign: 'left', fontSize: 12 })}>GRAND TOTAL</td>
          <td style={th({ fontSize: 12 })}></td>
          <td style={th({ fontSize: 12 })}></td>
          <td style={th({ fontSize: 12 })}>{fz(grand)}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start' }}>
      <div style={{ width: halfW }}>
        <div style={{
          textAlign: 'center', fontWeight: 700, fontSize: 11, background: '#2c5f8a',
          color: '#fff', padding: '4px 0', marginBottom: 4, fontFamily: FF
        }}>
          RECEIPT (Dr)
        </div>
        <SideTable side="receipt" />
      </div>
      <div style={{ width: halfW }}>
        <div style={{
          textAlign: 'center', fontWeight: 700, fontSize: 11, background: '#7a2a2a',
          color: '#fff', padding: '4px 0', marginBottom: 4, fontFamily: FF
        }}>
          PAYMENT / DISBURSEMENT (Cr)
        </div>
        <SideTable side="payment" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VIEW 3 — Three-column (Upto Month | During Month | End of Month)
// ─────────────────────────────────────────────────────────────────────────
const ThreeColumnTable = ({ data, dateRange }) => {
  const monthLabel = dateRange[0] ? dayjs(dateRange[0]).format('MMM YYYY') : '';

  const thc = (extra = {}) => th({ ...extra });
  const tdc = (extra = {}) => td({ ...extra });

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        {/* Row 1 — main group headers */}
        <tr>
          <th rowSpan={3} style={thc({ textAlign: 'left', width: '26%', verticalAlign: 'middle' })}>Ledger</th>
          <th colSpan={3} style={thc({ background: '#2c5f8a', color: '#fff' })}>Receipt</th>
          <th colSpan={3} style={thc({ background: '#7a2a2a', color: '#fff' })}>Payment</th>
        </tr>
        {/* Row 2 — sub-group labels */}
        <tr>
          <th style={thc({ width: '12%' })}>Upto Month</th>
          <th style={thc({ width: '12%' })}>During the Month</th>
          <th style={thc({ width: '12%' })}>End of the Month</th>
          <th style={thc({ width: '12%' })}>Upto Month</th>
          <th style={thc({ width: '12%' })}>During the Month</th>
          <th style={thc({ width: '12%' })}>End of the Month</th>
        </tr>
        {/* Row 3 — period label */}
        <tr>
          <th style={thc({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Before {monthLabel}</th>
          <th style={thc({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>{monthLabel}</th>
          <th style={thc({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Cumulative</th>
          <th style={thc({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Before {monthLabel}</th>
          <th style={thc({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>{monthLabel}</th>
          <th style={thc({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Cumulative</th>
        </tr>
      </thead>
      <tbody>
        {data.sections.map((sec, si) => (
          <>
            {/* Section header */}
            <tr key={`sh-${si}`}>
              <td colSpan={7} style={secHdr({ borderTop: si > 0 ? '2px solid #888' : BORDER })}>
                {sec.name} {sec.subtitle}
              </td>
            </tr>

            {/* Ledger rows */}
            {sec.items.map((item, ii) => (
              <tr key={`r-${si}-${ii}`} style={{ background: ii % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={tdc({ paddingLeft: 14 })}>{item.ledgerName}</td>
                <td style={tdc({ textAlign: 'right' })}>{f(item.uptoR)}</td>
                <td style={tdc({ textAlign: 'right', fontWeight: item.duringR ? 600 : 400 })}>{f(item.duringR)}</td>
                <td style={tdc({ textAlign: 'right', fontWeight: item.eomR ? 700 : 400, background: '#f9f9e8' })}>{f(item.eomR)}</td>
                <td style={tdc({ textAlign: 'right' })}>{f(item.uptoP)}</td>
                <td style={tdc({ textAlign: 'right', fontWeight: item.duringP ? 600 : 400 })}>{f(item.duringP)}</td>
                <td style={tdc({ textAlign: 'right', fontWeight: item.eomP ? 700 : 400, background: '#f9f0f0' })}>{f(item.eomP)}</td>
              </tr>
            ))}

            {/* Section total */}
            <tr key={`st-${si}`}>
              <td style={secTot({ paddingLeft: 14 })}>Account Group Total</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totUptoR)}</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totDuringR)}</td>
              <td style={secTot({ textAlign: 'right', background: '#f5f5d0' })}>{fz(sec.totEomR)}</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totUptoP)}</td>
              <td style={secTot({ textAlign: 'right' })}>{fz(sec.totDuringP)}</td>
              <td style={secTot({ textAlign: 'right', background: '#f5d0d0' })}>{fz(sec.totEomP)}</td>
            </tr>
          </>
        ))}

        {/* ── Footer ── */}
        {(() => {
          const ob = data.openingBalance || 0;
          const cb = Math.max(0, data.closingBalance || 0);
          const uR = (data.grandUptoR || 0) + ob;
          const dR = data.grandDuringR || 0;
          const eR = (data.grandEomR  || 0) + ob;
          const uP = data.grandUptoP  || 0;
          const dP = data.grandDuringP || 0;
          const eP = (data.grandEomP  || 0) + cb;
          const grandUpto   = Math.max(uR, uP);
          const grandDuring = Math.max(dR, dP);
          const grandEom    = Math.max(eR, eP);
          return (
            <>
              {/* Opening Balance */}
              <tr style={{ background: '#e8f5e9' }}>
                <td style={tdc({ fontWeight: 700, color: '#2e7d32' })}>Opening Balance (Cash)</td>
                <td style={tdc({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
                <td style={tdc({})}></td>
                <td style={tdc({ textAlign: 'right', fontWeight: 700, color: '#2e7d32', background: '#f9f9e8' })}>{fz(ob)}</td>
                <td style={tdc({})}></td>
                <td style={tdc({})}></td>
                <td style={tdc({})}></td>
              </tr>
              {/* Sub-total (transactions) */}
              <tr style={{ background: '#e0e0e0', borderTop: BORDER2 }}>
                <td style={th({ textAlign: 'left', borderTop: BORDER2 })}>SUB-TOTAL</td>
                <td style={th({ borderTop: BORDER2 })}>{fz(data.grandUptoR)}</td>
                <td style={th({ borderTop: BORDER2 })}>{fz(data.grandDuringR)}</td>
                <td style={th({ borderTop: BORDER2, background: '#e8e8b0' })}>{fz(data.grandEomR)}</td>
                <td style={th({ borderTop: BORDER2 })}>{fz(data.grandUptoP)}</td>
                <td style={th({ borderTop: BORDER2 })}>{fz(data.grandDuringP)}</td>
                <td style={th({ borderTop: BORDER2, background: '#e8b0b0' })}>{fz(data.grandEomP)}</td>
              </tr>
              {/* Closing Balance */}
              <tr style={{ background: '#fff3e0' }}>
                <td style={tdc({ fontWeight: 700, color: '#e65100' })}>Closing Balance (Cash)</td>
                <td style={tdc({})}></td>
                <td style={tdc({})}></td>
                <td style={tdc({})}></td>
                <td style={tdc({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(cb)}</td>
                <td style={tdc({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(cb)}</td>
                <td style={tdc({ textAlign: 'right', fontWeight: 700, color: '#e65100', background: '#f9f0f0' })}>{fz(cb)}</td>
              </tr>
              {/* Grand Total */}
              <tr style={{ background: '#b0b0b0' }}>
                <td style={th({ textAlign: 'left', fontSize: 12 })}>GRAND TOTAL</td>
                <td style={th({ fontSize: 12 })}>{fz(grandUpto)}</td>
                <td style={th({ fontSize: 12 })}>{fz(grandDuring)}</td>
                <td style={th({ fontSize: 12, background: '#d8d890' })}>{fz(grandEom)}</td>
                <td style={th({ fontSize: 12 })}>{fz(grandUpto)}</td>
                <td style={th({ fontSize: 12 })}>{fz(grandDuring)}</td>
                <td style={th({ fontSize: 12, background: '#d8d890' })}>{fz(grandEom)}</td>
              </tr>
            </>
          );
        })()}
      </tbody>
    </table>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
const CooperativeRDReport = () => {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'VILLOOR KSS';

  const [loading, setLoading]     = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]       = useState('thisMonth');
  const [dateRange, setDateRange] = useState(getPresetRange('thisMonth'));
  const [viewMode, setViewMode]   = useState('single'); // 'single' | 'two'
  const printRef = useRef(null);

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const fetchReport = async () => {
    const [start, end] = dateRange;
    if (!start || !end) {
      notifications.show({ title: 'Error', message: 'Select a date range', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.cooperativeRD({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // ── Print ─────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const pw = window.open('', '_blank');
    if (!pw) { alert('Pop-up blocked. Please allow pop-ups.'); return; }
    const clone = el.cloneNode(true);
    clone.querySelectorAll('[data-no-print]').forEach(e => e.remove());
    const orientation = viewMode === 'single' ? 'portrait' : 'landscape';
    pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>R&D – ${companyName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000;
           background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 8mm; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: middle; }
    th { background: #e8e8e8 !important; font-weight: 700; text-align: center; font-size: 10px; }
    .text-right { text-align: right !important; }
    .text-left  { text-align: left !important; }
    @page { size: A4 ${orientation}; margin: 8mm; }
  </style>
</head>
<body>${clone.innerHTML}</body>
</html>`);
    pw.document.close();
    setTimeout(() => { pw.focus(); pw.print(); }, 400);
  };

  // ── Excel Export ──────────────────────────────────────────────────────
  const handleExport = () => {
    if (!reportData?.sections?.length) {
      notifications.show({ title: 'No data', message: 'Generate the report first', color: 'orange' });
      return;
    }
    const rows = [];
    rows.push([companyName + ' – RECEIPT AND DISBURSEMENT']);
    rows.push([`Period: ${fmtDate(dateRange[0])} to ${fmtDate(dateRange[1])}`]);
    rows.push([]);
    rows.push(['Ledger',
      'Receipt Adjustment', 'Receipt Cash', 'Receipt Total',
      'Payment Adjustment', 'Payment Cash', 'Payment Total'
    ]);

    reportData.sections.forEach(sec => {
      rows.push([`${sec.name} ${sec.subtitle}`, '', '', '', '', '', '']);
      sec.items.forEach(item => {
        rows.push([item.ledgerName,
          item.receiptAdj || '', item.receiptCash || '', item.receiptTotal || '',
          item.paymentAdj || '', item.paymentCash || '', item.paymentTotal || ''
        ]);
      });
      rows.push([`Account Group Total – ${sec.name}`,
        sec.totalReceiptAdj, sec.totalReceiptCash, sec.totalReceiptTotal,
        sec.totalPaymentAdj, sec.totalPaymentCash, sec.totalPaymentTotal
      ]);
      rows.push([]);
    });
    rows.push(['GRAND TOTAL',
      reportData.grandTotalReceiptAdj, reportData.grandTotalReceiptCash, reportData.grandTotalReceiptTotal,
      reportData.grandTotalPaymentAdj, reportData.grandTotalPaymentCash, reportData.grandTotalPaymentTotal
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'R&D Report');
    XLSX.writeFile(wb, `RD_${companyName}_${dayjs(dateRange[0]).format('MMM_YYYY')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Excel downloaded', color: 'green' });
  };

  const DOC_STYLE = {
    maxWidth: viewMode === 'two' ? 1100 : viewMode === 'three' ? 1050 : 820,
    background: '#fff',
    border: '1px solid #ccc',
    padding: '22px 28px 32px',
    fontFamily: FF,
    margin: '0 auto'
  };

  return (
    <Box p="md">
      {/* ── Control Panel ── */}
      <Paper shadow="xs" withBorder p="md" mb="md" data-no-print>
        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select
            label="Period"
            data={PRESETS}
            value={preset}
            onChange={handlePresetChange}
            w={155}
          />
          <DatePickerInput
            type="range"
            label="Date Range"
            value={dateRange}
            onChange={(val) => { setDateRange(val); setPreset('custom'); }}
            leftSection={<IconCalendar size={14} />}
            disabled={preset !== 'custom'}
            w={250}
            clearable={false}
          />
          <Button
            onClick={fetchReport}
            loading={loading}
            leftSection={<IconRefresh size={16} />}
            color="blue"
          >
            Generate
          </Button>

          {/* ── Layout toggle ── */}
          {reportData && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>Layout</Text>
              <SegmentedControl
                value={viewMode}
                onChange={setViewMode}
                data={[
                  { value: 'single', label: <Group gap={4}><IconLayoutRows size={14}/><span>1 Column</span></Group> },
                  { value: 'two',    label: <Group gap={4}><IconLayoutColumns size={14}/><span>2 Column</span></Group> },
                  { value: 'three',  label: <Group gap={4}><IconColumns3 size={14}/><span>3 Column</span></Group> }
                ]}
                size="sm"
              />
            </Box>
          )}

          <Tooltip label="Print">
            <ActionIcon variant="light" color="dark" size="lg" onClick={handlePrint} disabled={!reportData}>
              <IconPrinter size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Export Excel">
            <ActionIcon variant="light" color="green" size="lg" onClick={handleExport} disabled={!reportData}>
              <IconFileExport size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      {/* ── Loading ── */}
      {loading && (
        <Center py={60}>
          <Stack align="center" gap="sm">
            <Loader size="lg" />
            <Text c="dimmed" size="sm">Generating report…</Text>
          </Stack>
        </Center>
      )}

      {/* ── Empty state ── */}
      {!loading && !reportData && (
        <Center py={80}>
          <Stack align="center" gap="xs">
            <IconInbox size={52} color="#ccc" />
            <Text c="dimmed" size="md">Select a period and click Generate</Text>
          </Stack>
        </Center>
      )}

      {/* ── Document ── */}
      {!loading && reportData && (
        <Box ref={printRef}>
          <div style={DOC_STYLE}>
            <DocHeader
              companyName={companyName}
              dateRange={dateRange}
              subtitle={viewMode === 'three' ? 'Three Column' : viewMode === 'two' ? 'Two Column' : 'End of the Month'}
            />

            {viewMode === 'single' && <SingleTable data={reportData} />}
            {viewMode === 'two'    && <TwoColumnTable data={reportData} />}
            {viewMode === 'three'  && <ThreeColumnTable data={reportData} dateRange={dateRange} />}

            <div style={{ marginTop: 24, fontSize: 9, color: '#888', textAlign: 'right', fontFamily: FF }}>
              Computer generated statement — No signature required.
            </div>
          </div>
        </Box>
      )}
    </Box>
  );
};

export default CooperativeRDReport;
