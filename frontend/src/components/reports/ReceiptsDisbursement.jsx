import React, { useState, useRef } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { printRDStatement } from './shared/rdPrint';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Stack, SimpleGrid, Loader, Center, Badge,
  SegmentedControl, ThemeIcon, Divider, Container
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconReceipt, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconWallet, IconArrowUpRight,
  IconArrowDownRight, IconCurrencyRupee
} from '@tabler/icons-react';

// ── Presets ───────────────────────────────────────────────────────────────
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
    case 'lastMonth':     return [now.subtract(1, 'month').startOf('month').toDate(), now.subtract(1, 'month').endOf('month').toDate()];
    case 'thisQuarter':   return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fy = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

// ── Report-view (groupBy) options — Account Group Wise is the default ──────
const GROUP_BY_OPTS = [
  { value: 'accountGroup', label: 'Account Group Wise' },
  { value: 'ledger',       label: 'Ledger Wise' },
  { value: 'category',     label: 'Category Wise' }
];

const CATEGORY_LABELS = {
  ASSETS: 'Assets', LIABILITIES: 'Liabilities', INCOME: 'Income',
  EXPENSES: 'Expenses', CAPITAL: 'Capital & Reserves', OTHER: 'Other'
};

// ── Shared inline table styles (print-friendly, matches the statutory R&D
//    statement layout used elsewhere in this codebase) ─────────────────────
const FF = 'Arial, Helvetica, sans-serif';
const BORDER  = '1px solid #bbb';
const BORDER2 = '2px solid #555';

const th = (extra = {}) => ({
  border: BORDER, padding: '4px 6px', fontWeight: 700, fontSize: 10,
  background: '#e8e8e8', textAlign: 'center', fontFamily: FF, whiteSpace: 'nowrap', ...extra
});
const td = (extra = {}) => ({
  border: BORDER, padding: '3px 6px', fontSize: 10, fontFamily: FF, ...extra
});
const secHdr = (extra = {}) => ({
  border: BORDER, padding: '4px 6px', fontSize: 10, fontWeight: 700,
  background: '#d4d4d4', textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: FF, ...extra
});
const secTot = (extra = {}) => ({
  border: BORDER, padding: '3px 6px', fontSize: 10, fontWeight: 700, background: '#f0f0f0', fontFamily: FF, ...extra
});

const f  = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const fz = (n) => parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate  = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';
const fmtMonth = (d) => d ? dayjs(d).format('MMMM-YYYY').toUpperCase() : '';

const sectionLabel = (groupBy, name) => groupBy === 'category' ? (CATEGORY_LABELS[name] || name) : name;

// ─────────────────────────────────────────────────────────────────────────
// VIEW — Single Column: Cash + Adjustment combined into one Amount per side
// ─────────────────────────────────────────────────────────────────────────
const SingleTable = ({ data }) => {
  const ob = data.openingBalance || 0;
  const cb = data.closingBalance || 0;
  const rT = data.grandTotal?.receiptTotal || 0;
  const pT = data.grandTotal?.paymentTotal || 0;
  const grandR = ob + rT;
  const grandP = pT + Math.max(0, cb);
  const grand  = Math.max(grandR, grandP);
  const showGroups = data.groupBy !== 'ledger';

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th({ textAlign: 'left', width: '46%' })}>Ledger</th>
          <th style={th({ width: '27%', background: '#2c5f8a', color: '#fff' })}>Receipt (Dr)</th>
          <th style={th({ width: '27%', background: '#7a2a2a', color: '#fff' })}>Payment (Cr)</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ background: '#e8f5e9' }}>
          <td style={td({ fontWeight: 700, color: '#2e7d32' })}>Opening Balance (Cash in Hand)</td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
          <td style={td({})}></td>
        </tr>

        {data.sections.map((sec, si) => (
          <React.Fragment key={si}>
            {showGroups && (
              <tr>
                <td colSpan={3} style={secHdr({ borderTop: BORDER2 })}>{sectionLabel(data.groupBy, sec.sectionName)}</td>
              </tr>
            )}
            {sec.ledgers.map((item, ii) => (
              <tr key={ii} style={{ background: ii % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={td({ paddingLeft: 14 })}>{item.ledgerName}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.receiptTotal ? 600 : 400 })}>{f(item.receiptTotal)}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.paymentTotal ? 600 : 400 })}>{f(item.paymentTotal)}</td>
              </tr>
            ))}
            {showGroups && (
              <tr>
                <td style={secTot({ paddingLeft: 14 })}>{data.groupBy === 'category' ? 'Category Total' : 'Account Group Total'}</td>
                <td style={secTot({ textAlign: 'right' })}>{fz(sec.groupTotal.receiptTotal)}</td>
                <td style={secTot({ textAlign: 'right' })}>{fz(sec.groupTotal.paymentTotal)}</td>
              </tr>
            )}
          </React.Fragment>
        ))}

        <tr style={{ background: '#e0e0e0', borderTop: BORDER2 }}>
          <td style={th({ textAlign: 'left', borderTop: BORDER2 })}>SUB-TOTAL (Transactions)</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(rT)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(pT)}</td>
        </tr>

        <tr style={{ background: '#fff3e0' }}>
          <td style={td({ fontWeight: 700, color: '#e65100' })}>Closing Balance (Cash in Hand)</td>
          <td style={td({})}></td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(Math.max(0, cb))}</td>
        </tr>

        <tr style={{ background: '#b0b0b0' }}>
          <td style={th({ textAlign: 'left', fontSize: 12 })}>GRAND TOTAL</td>
          <td style={th({ fontSize: 12 })}>{fz(grand)}</td>
          <td style={th({ fontSize: 12 })}>{fz(grand)}</td>
        </tr>
      </tbody>
    </table>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VIEW — Two Column side-by-side: Cash and Adjustment shown separately
// ─────────────────────────────────────────────────────────────────────────
const TwoColumnSideTable = ({ side, data, ob, cb, rT, pT }) => {
  const showGroups = data.groupBy !== 'ledger';
  return (
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
        {side === 'receipt' && (
          <tr style={{ background: '#e8f5e9' }}>
            <td style={td({ fontWeight: 700, color: '#2e7d32' })}>Opening Balance</td>
            <td style={td({})}></td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
          </tr>
        )}

        {data.sections.map((sec, si) => {
          const items = sec.ledgers.filter(it => side === 'receipt' ? it.receiptTotal > 0 : it.paymentTotal > 0);
          if (items.length === 0) return null;
          return (
            <React.Fragment key={si}>
              {showGroups && (
                <tr>
                  <td colSpan={4} style={secHdr({ borderTop: '1.5px solid #888' })}>{sectionLabel(data.groupBy, sec.sectionName)}</td>
                </tr>
              )}
              {items.map((item, ii) => (
                <tr key={ii} style={{ background: ii % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={td({ paddingLeft: 12 })}>{item.ledgerName}</td>
                  <td style={td({ textAlign: 'right' })}>{side === 'receipt' ? f(item.receiptAdj) : f(item.paymentAdj)}</td>
                  <td style={td({ textAlign: 'right' })}>{side === 'receipt' ? f(item.receiptCash) : f(item.paymentCash)}</td>
                  <td style={td({ textAlign: 'right', fontWeight: 600 })}>{side === 'receipt' ? f(item.receiptTotal) : f(item.paymentTotal)}</td>
                </tr>
              ))}
              {showGroups && (
                <tr>
                  <td style={secTot({ paddingLeft: 12 })}>{data.groupBy === 'category' ? 'Category Total' : 'Account Group Total'}</td>
                  <td style={secTot({ textAlign: 'right' })}>{side === 'receipt' ? fz(sec.groupTotal.receiptAdj) : fz(sec.groupTotal.paymentAdj)}</td>
                  <td style={secTot({ textAlign: 'right' })}>{side === 'receipt' ? fz(sec.groupTotal.receiptCash) : fz(sec.groupTotal.paymentCash)}</td>
                  <td style={secTot({ textAlign: 'right' })}>{side === 'receipt' ? fz(sec.groupTotal.receiptTotal) : fz(sec.groupTotal.paymentTotal)}</td>
                </tr>
              )}
            </React.Fragment>
          );
        })}

        <tr style={{ background: '#e0e0e0', borderTop: BORDER2 }}>
          <td style={th({ textAlign: 'left', borderTop: BORDER2 })}>{side === 'receipt' ? 'SUB-TOTAL (Receipts)' : 'SUB-TOTAL (Payments)'}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(side === 'receipt' ? data.grandTotal?.receiptAdj : data.grandTotal?.paymentAdj)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(side === 'receipt' ? data.grandTotal?.receiptCash : data.grandTotal?.paymentCash)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(side === 'receipt' ? rT : pT)}</td>
        </tr>

        {side === 'payment' && (
          <tr style={{ background: '#fff3e0' }}>
            <td style={td({ fontWeight: 700, color: '#e65100' })}>Closing Balance</td>
            <td style={td({})}></td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(Math.max(0, cb))}</td>
            <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(Math.max(0, cb))}</td>
          </tr>
        )}

        <tr style={{ background: '#b0b0b0' }}>
          <td style={th({ textAlign: 'left', fontSize: 12 })}>GRAND TOTAL</td>
          <td style={th({ fontSize: 12 })}></td>
          <td style={th({ fontSize: 12 })}></td>
          <td style={th({ fontSize: 12 })}>{fz(ob + rT)}</td>
        </tr>
      </tbody>
    </table>
  );
};

const TwoColumnTable = ({ data }) => {
  const ob = data.openingBalance || 0;
  const cb = data.closingBalance || 0;
  const rT = data.grandTotal?.receiptTotal || 0;
  const pT = data.grandTotal?.paymentTotal || 0;
  const halfW = '49.5%';

  return (
    <div style={{ display: 'flex', gap: '1%', alignItems: 'flex-start' }}>
      <div style={{ width: halfW }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, background: '#2c5f8a', color: '#fff', padding: '4px 0', marginBottom: 4, fontFamily: FF }}>
          RECEIPT (Dr)
        </div>
        <TwoColumnSideTable side="receipt" data={data} ob={ob} cb={cb} rT={rT} pT={pT} />
      </div>
      <div style={{ width: halfW }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, background: '#7a2a2a', color: '#fff', padding: '4px 0', marginBottom: 4, fontFamily: FF }}>
          PAYMENT / DISBURSEMENT (Cr)
        </div>
        <TwoColumnSideTable side="payment" data={data} ob={ob} cb={cb} rT={rT} pT={pT} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VIEW — Three Column: Upto the Month | During the Month | End of the Month
// (Cash + Adjustment always combined — no separate breakup in this format)
// ─────────────────────────────────────────────────────────────────────────
const ThreeColumnTable = ({ data }) => {
  const monthAnchor = data.monthStart;
  const monthLabel = monthAnchor ? dayjs(monthAnchor).format('MMM YYYY') : '';
  const showGroups = data.groupBy !== 'ledger';

  const ob = data.openingBalanceFY ?? data.openingBalance ?? 0;
  const cb = Math.max(0, (data.closingBalanceFY ?? data.closingBalance) || 0);
  const gt = data.grandTotal || {};
  const uR = (gt.uptoR || 0) + ob;
  const dR = gt.duringR || 0;
  const eR = (gt.eomR || 0) + ob;
  const uP = gt.uptoP || 0;
  const dP = gt.duringP || 0;
  const eP = (gt.eomP || 0) + cb;
  const grandUpto   = Math.max(uR, uP);
  const grandDuring = Math.max(dR, dP);
  const grandEom    = Math.max(eR, eP);

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th rowSpan={3} style={th({ textAlign: 'left', width: '26%', verticalAlign: 'middle' })}>Ledger</th>
          <th colSpan={3} style={th({ background: '#2c5f8a', color: '#fff' })}>Receipt</th>
          <th colSpan={3} style={th({ background: '#7a2a2a', color: '#fff' })}>Payment</th>
        </tr>
        <tr>
          <th style={th({ width: '12%' })}>Upto Month</th>
          <th style={th({ width: '12%' })}>During the Month</th>
          <th style={th({ width: '12%' })}>End of the Month</th>
          <th style={th({ width: '12%' })}>Upto Month</th>
          <th style={th({ width: '12%' })}>During the Month</th>
          <th style={th({ width: '12%' })}>End of the Month</th>
        </tr>
        <tr>
          <th style={th({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Before {monthLabel}</th>
          <th style={th({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>{monthLabel}</th>
          <th style={th({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Cumulative</th>
          <th style={th({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Before {monthLabel}</th>
          <th style={th({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>{monthLabel}</th>
          <th style={th({ fontWeight: 400, fontSize: 9, fontStyle: 'italic' })}>Cumulative</th>
        </tr>
      </thead>
      <tbody>
        {data.sections.map((sec, si) => (
          <React.Fragment key={si}>
            {showGroups && (
              <tr>
                <td colSpan={7} style={secHdr({ borderTop: si > 0 ? '2px solid #888' : BORDER })}>{sectionLabel(data.groupBy, sec.sectionName)}</td>
              </tr>
            )}
            {sec.ledgers.map((item, ii) => (
              <tr key={ii} style={{ background: ii % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={td({ paddingLeft: 14 })}>{item.ledgerName}</td>
                <td style={td({ textAlign: 'right' })}>{f(item.uptoR)}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.duringR ? 600 : 400 })}>{f(item.duringR)}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.eomR ? 700 : 400, background: '#f9f9e8' })}>{f(item.eomR)}</td>
                <td style={td({ textAlign: 'right' })}>{f(item.uptoP)}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.duringP ? 600 : 400 })}>{f(item.duringP)}</td>
                <td style={td({ textAlign: 'right', fontWeight: item.eomP ? 700 : 400, background: '#f9f0f0' })}>{f(item.eomP)}</td>
              </tr>
            ))}
            {showGroups && (
              <tr>
                <td style={secTot({ paddingLeft: 14 })}>{data.groupBy === 'category' ? 'Category Total' : 'Account Group Total'}</td>
                <td style={secTot({ textAlign: 'right' })}>{fz(sec.groupTotal.uptoR)}</td>
                <td style={secTot({ textAlign: 'right' })}>{fz(sec.groupTotal.duringR)}</td>
                <td style={secTot({ textAlign: 'right', background: '#f5f5d0' })}>{fz(sec.groupTotal.eomR)}</td>
                <td style={secTot({ textAlign: 'right' })}>{fz(sec.groupTotal.uptoP)}</td>
                <td style={secTot({ textAlign: 'right' })}>{fz(sec.groupTotal.duringP)}</td>
                <td style={secTot({ textAlign: 'right', background: '#f5d0d0' })}>{fz(sec.groupTotal.eomP)}</td>
              </tr>
            )}
          </React.Fragment>
        ))}

        <tr style={{ background: '#e8f5e9' }}>
          <td style={td({ fontWeight: 700, color: '#2e7d32' })}>Opening Balance (Cash)</td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32' })}>{fz(ob)}</td>
          <td style={td({})}></td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#2e7d32', background: '#f9f9e8' })}>{fz(ob)}</td>
          <td style={td({})}></td><td style={td({})}></td><td style={td({})}></td>
        </tr>
        <tr style={{ background: '#e0e0e0', borderTop: BORDER2 }}>
          <td style={th({ textAlign: 'left', borderTop: BORDER2 })}>SUB-TOTAL</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(gt.uptoR)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(gt.duringR)}</td>
          <td style={th({ borderTop: BORDER2, background: '#e8e8b0' })}>{fz(gt.eomR)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(gt.uptoP)}</td>
          <td style={th({ borderTop: BORDER2 })}>{fz(gt.duringP)}</td>
          <td style={th({ borderTop: BORDER2, background: '#e8b0b0' })}>{fz(gt.eomP)}</td>
        </tr>
        <tr style={{ background: '#fff3e0' }}>
          <td style={td({ fontWeight: 700, color: '#e65100' })}>Closing Balance (Cash)</td>
          <td style={td({})}></td><td style={td({})}></td><td style={td({})}></td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(cb)}</td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100' })}>{fz(cb)}</td>
          <td style={td({ textAlign: 'right', fontWeight: 700, color: '#e65100', background: '#f9f0f0' })}>{fz(cb)}</td>
        </tr>
        <tr style={{ background: '#b0b0b0' }}>
          <td style={th({ textAlign: 'left', fontSize: 12 })}>GRAND TOTAL</td>
          <td style={th({ fontSize: 12 })}>{fz(grandUpto)}</td>
          <td style={th({ fontSize: 12 })}>{fz(grandDuring)}</td>
          <td style={th({ fontSize: 12, background: '#d8d890' })}>{fz(grandEom)}</td>
          <td style={th({ fontSize: 12 })}>{fz(grandUpto)}</td>
          <td style={th({ fontSize: 12 })}>{fz(grandDuring)}</td>
          <td style={th({ fontSize: 12, background: '#d8d890' })}>{fz(grandEom)}</td>
        </tr>
      </tbody>
    </table>
  );
};

// Document header (shared across the three formats)
const DocHeader = ({ companyName, dateRange, columnFormat, monthLabelDate }) => (
  <div style={{ textAlign: 'center', borderBottom: BORDER2, paddingBottom: 10, marginBottom: 12, fontFamily: FF }}>
    <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>{companyName}</div>
    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
      RECEIPT AND DISBURSEMENT FOR THE MONTH {fmtMonth(monthLabelDate || dateRange[0])}
    </div>
    <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>
      {columnFormat === 'three' ? 'Three Column' : columnFormat === 'two' ? 'Two Column' : 'Single Column'}
    </div>
    <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>
      Period: {fmtDate(dateRange[0])} to {fmtDate(dateRange[1])} &nbsp;|&nbsp; Printed: {dayjs().format('DD/MM/YYYY')}
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════
const ReceiptsDisbursement = () => {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';

  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]         = useState('thisMonth');
  const [dateRange, setDateRange]   = useState(getPresetRange('thisMonth'));
  const [groupBy, setGroupBy]       = useState('accountGroup');       // Account Group Wise is the default/first preference
  const [columnFormat, setColumnFormat] = useState('single');         // single | two | three
  const printRef = useRef(null);

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const fetchReport = async (gb = groupBy) => {
    const [start, end] = dateRange;
    if (!start || !end) { message.error('Select a date range'); return; }
    setLoading(true);
    try {
      const res = await reportAPI.rdStatementUnified({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD'),
        groupBy: gb
      });
      setReportData(res?.data || res);
    } catch (err) {
      message.error(err.message || 'Failed to fetch R&D Statement');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupByChange = (val) => {
    setGroupBy(val);
    if (reportData) fetchReport(val); // grouping is computed server-side
  };

  // ── Print ─────────────────────────────────────────────────────────────
  // Dedicated A4 layout (portrait for Single Column, landscape for Two /
  // Three Column) built from the report data, not a copy of the screen.
  const handlePrint = () => {
    if (!reportData?.sections) { message.error('Generate the report first'); return; }
    printRDStatement({
      data: {
        ...reportData,
        sections: reportData.sections.map(sec => ({ ...sec, sectionName: sectionLabel(groupBy, sec.sectionName) }))
      },
      columnFormat,
      showGroups: reportData.groupBy !== 'ledger',
      totalLabel: reportData.groupBy === 'category' ? 'Category Total' : 'Account Group Total',
      companyName,
      dateRange,
      viewLabel: GROUP_BY_OPTS.find(o => o.value === groupBy)?.label
    });
  };

  // ── Excel Export — full detail (Cash/Adjustment/Total + Upto/During/End),
  //    regardless of which column format is currently on screen ──────────
  const handleExport = () => {
    if (!reportData?.sections?.length) { message.error('Generate the report first'); return; }
    const rows = [];
    rows.push([companyName.toUpperCase() + ' – RECEIPT AND DISBURSEMENT STATEMENT']);
    rows.push([`Period: ${fmtDate(dateRange[0])} to ${fmtDate(dateRange[1])}`, `View: ${GROUP_BY_OPTS.find(o => o.value === groupBy)?.label}`]);
    rows.push([]);
    rows.push(['Ledger',
      'Receipt Adjustment', 'Receipt Cash', 'Receipt Total',
      'Payment Adjustment', 'Payment Cash', 'Payment Total',
      'Receipt Upto Month', 'Receipt During Month', 'Receipt End of Month',
      'Payment Upto Month', 'Payment During Month', 'Payment End of Month'
    ]);
    reportData.sections.forEach(sec => {
      rows.push([sectionLabel(groupBy, sec.sectionName)]);
      sec.ledgers.forEach(item => {
        rows.push([item.ledgerName,
          item.receiptAdj || '', item.receiptCash || '', item.receiptTotal || '',
          item.paymentAdj || '', item.paymentCash || '', item.paymentTotal || '',
          item.uptoR || '', item.duringR || '', item.eomR || '',
          item.uptoP || '', item.duringP || '', item.eomP || ''
        ]);
      });
      rows.push([`Total – ${sectionLabel(groupBy, sec.sectionName)}`,
        sec.groupTotal.receiptAdj, sec.groupTotal.receiptCash, sec.groupTotal.receiptTotal,
        sec.groupTotal.paymentAdj, sec.groupTotal.paymentCash, sec.groupTotal.paymentTotal,
        sec.groupTotal.uptoR, sec.groupTotal.duringR, sec.groupTotal.eomR,
        sec.groupTotal.uptoP, sec.groupTotal.duringP, sec.groupTotal.eomP
      ]);
      rows.push([]);
    });
    const gt = reportData.grandTotal || {};
    rows.push(['GRAND TOTAL',
      gt.receiptAdj, gt.receiptCash, gt.receiptTotal,
      gt.paymentAdj, gt.paymentCash, gt.paymentTotal,
      gt.uptoR, gt.duringR, gt.eomR, gt.uptoP, gt.duringP, gt.eomP
    ]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = Array(13).fill({ wch: 15 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'R&D Statement');
    XLSX.writeFile(wb, `RD_Statement_${dayjs(dateRange[0]).format('DDMMYYYY')}_${dayjs(dateRange[1]).format('DDMMYYYY')}.xlsx`);
    message.success('Exported to Excel');
  };

  // ── Summary figures (match whichever balance basis the active column
  //    format uses, so cards and table always agree) ──────────────────────
  const usingFY = columnFormat === 'three';
  const ob = usingFY ? (reportData?.openingBalanceFY ?? 0) : (reportData?.openingBalance ?? 0);
  const cb = usingFY ? (reportData?.closingBalanceFY ?? 0) : (reportData?.closingBalance ?? 0);
  const gt = reportData?.grandTotal || {};
  const totalReceipts = usingFY ? (gt.eomR || 0) : (gt.receiptTotal || 0);
  const totalPayments = usingFY ? (gt.eomP || 0) : (gt.paymentTotal || 0);

  const DOC_MAXW = columnFormat === 'single' ? 820 : columnFormat === 'two' ? 1100 : 1200;

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="sm">
        <Group gap="sm">
          <ThemeIcon size={38} radius="md" color="indigo" variant="light"><IconReceipt size={22} /></ThemeIcon>
          <Box>
            <Title order={4}>R&amp;D Statement</Title>
            <Text size="xs" c="dimmed">Receipts &amp; Disbursement — every Cash, Adjustment and auto-posted transaction for the period, ledger-wise</Text>
          </Box>
        </Group>
        <Group gap="xs">
          <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" onClick={handlePrint} size="sm" disabled={!reportData}>
            Print
          </Button>
          <Button leftSection={<IconFileExport size={16} />} variant="light" color="green" onClick={handleExport} size="sm" disabled={!reportData}>
            Export Excel
          </Button>
        </Group>
      </Group>

      {/* ── Filters ── */}
      <Paper p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select label="Period" value={preset} onChange={handlePresetChange} data={PRESETS} w={150} size="sm" />
          <DatePickerInput
            label="From Date" value={dateRange[0]}
            onChange={(val) => { setDateRange([val, dateRange[1]]); setPreset('custom'); }}
            leftSection={<IconCalendar size={14} />} w={140} size="sm"
          />
          <DatePickerInput
            label="To Date" value={dateRange[1]}
            onChange={(val) => { setDateRange([dateRange[0], val]); setPreset('custom'); }}
            leftSection={<IconCalendar size={14} />} w={140} size="sm"
          />
          <Button leftSection={<IconRefresh size={16} />} onClick={() => fetchReport()} loading={loading} size="sm">
            Generate
          </Button>
        </Group>

        {reportData && (
          <>
            <Divider my="sm" />
            <Group gap="xl" wrap="wrap">
              <Box>
                <Text size="xs" c="dimmed" fw={600} mb={4}>Report View</Text>
                <SegmentedControl value={groupBy} onChange={handleGroupByChange} data={GROUP_BY_OPTS} size="xs" />
              </Box>
              <Box>
                <Text size="xs" c="dimmed" fw={600} mb={4}>Column Format</Text>
                <SegmentedControl
                  value={columnFormat}
                  onChange={setColumnFormat}
                  data={[
                    { value: 'single', label: 'Single Column' },
                    { value: 'two',    label: 'Two Column' },
                    { value: 'three',  label: 'Three Column' }
                  ]}
                  size="xs"
                />
              </Box>
            </Group>
          </>
        )}
      </Paper>

      {loading && (
        <Center py={60}><Stack align="center" gap="sm"><Loader size="lg" /><Text c="dimmed" size="sm">Generating report…</Text></Stack></Center>
      )}

      {!loading && !reportData && (
        <Center py={80}>
          <Stack align="center" gap="xs">
            <IconInbox size={52} color="#ccc" />
            <Text c="dimmed" size="md">Select a period and click Generate</Text>
          </Stack>
        </Center>
      )}

      {!loading && reportData && (
        <>
          {/* Summary cards — same layout/logic across all three formats */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mb="md" data-no-print>
            <Paper p="md" withBorder bg="blue.0">
              <Group gap="xs"><IconWallet size={22} color="var(--mantine-color-blue-6)" />
                <div><Text size="xs" c="dimmed">Opening Balance</Text><Text size="lg" fw={700} c="blue">{fz(ob)}</Text></div>
              </Group>
            </Paper>
            <Paper p="md" withBorder bg="green.0">
              <Group gap="xs"><IconArrowUpRight size={22} color="var(--mantine-color-green-6)" />
                <div><Text size="xs" c="dimmed">Total Receipts</Text><Text size="lg" fw={700} c="green">{fz(totalReceipts)}</Text></div>
              </Group>
            </Paper>
            <Paper p="md" withBorder bg="red.0">
              <Group gap="xs"><IconArrowDownRight size={22} color="var(--mantine-color-red-6)" />
                <div><Text size="xs" c="dimmed">Total Payments</Text><Text size="lg" fw={700} c="red">{fz(totalPayments)}</Text></div>
              </Group>
            </Paper>
            <Paper p="md" withBorder bg="teal.0">
              <Group gap="xs"><IconCurrencyRupee size={22} color="var(--mantine-color-teal-6)" />
                <div><Text size="xs" c="dimmed">Closing Balance</Text><Text size="lg" fw={700} c="teal">{fz(cb)}</Text></div>
              </Group>
            </Paper>
          </SimpleGrid>

          <Paper withBorder shadow="sm" style={{ overflow: 'auto' }}>
            <Box ref={printRef} p="md">
              <div style={{ maxWidth: DOC_MAXW, background: '#fff', margin: '0 auto', fontFamily: FF }}>
                <DocHeader
                  companyName={companyName}
                  dateRange={dateRange}
                  columnFormat={columnFormat}
                  monthLabelDate={columnFormat === 'three' ? (reportData.monthStart || dateRange[1]) : dateRange[0]}
                />
                {reportData.sections.length === 0 ? (
                  <Center py={40}><Text c="dimmed">No transactions found for this period</Text></Center>
                ) : (
                  <>
                    {columnFormat === 'single' && <SingleTable data={reportData} />}
                    {columnFormat === 'two'    && <TwoColumnTable data={reportData} />}
                    {columnFormat === 'three'  && <ThreeColumnTable data={reportData} />}
                  </>
                )}
                <div style={{ marginTop: 20, fontSize: 9, color: '#888', textAlign: 'right' }}>
                  Computer generated statement — No signature required.
                </div>
              </div>
            </Box>
          </Paper>

          <Group mt="sm" gap="xl">
            <Badge variant="light" color="gray">{GROUP_BY_OPTS.find(o => o.value === groupBy)?.label}</Badge>
            <Text size="xs" c="dimmed">Includes Cash, Adjustment (Journal) and auto-posted transactions</Text>
          </Group>
        </>
      )}
    </Container>
  );
};

export default ReceiptsDisbursement;
