import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Grid, Group, Text, Title, Box,
  TextInput, NumberInput, Checkbox, ScrollArea, Badge,
  Divider, Button, Loader, Pagination, Select, Progress, Modal, Stack, RingProgress, Center,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconPrinter, IconRefresh, IconFileSpreadsheet,
  IconDownload, IconCheck, IconDeviceFloppy, IconBuildingBank,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import {
  paymentAPI, dairySettingsAPI, paymentRegisterAPI, producerOpeningAPI, periodicalRuleAPI, milkPurchaseSettingsAPI,
  cattleFeedAdvanceAPI,
} from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const TOTAL_ROWS = 25;

const initRow = (sn) => ({
  sn,
  farmerId:      '',
  producerId:    '',
  producerName:  '',
  qty:           '',
  milkValue:     '',
  prevBalance:   '',
  otherEarnings: '',
  totalEarnings: '',   // auto: milkValue + prevBalance + otherEarnings
  welfare:       '',
  cfAdv:         '',   // from opening (auto)
  cfRec:         '',   // CF Recovery — typing
  cashAdv:       '',   // from opening (auto)
  cashRec:       '',   // Cash Recovery — typing
  loanAdv:       '',   // from opening (auto)
  loanRec:       '',   // Loan Recovery — typing
  otherDed:      '',
  totalDed:      '',   // auto
  netPay:        '',   // auto: totalEarnings - totalDed
  payMode:       '',   // 'Bank' | 'Cash'
  paidAmount:    '',
  signature:     '',
  locked:        false, // user locked via checkbox (before Save Payment)
  paid:          false,
  bankPending:   false, // true = queued for bank transfer (saved, pending bank transfer apply)
});

/* ─── helpers ─── */
const n   = (v) => parseFloat(v) || 0;
const fmt = (v) => (v === 0 ? '' : v.toFixed(2));
const fmtN = (v) => (v === 0 ? '0.00' : v.toFixed(2));

/* ─── style constants ─── */
const BORDER      = '1px solid #ccc';
const BORDER_DARK = '1px solid #a0aec0';

const thSection = (bg) => ({
  background: bg, color: '#fff', textAlign: 'center',
  fontSize: 11, fontWeight: 700, padding: '6px 4px',
  border: BORDER_DARK, letterSpacing: 0.8, userSelect: 'none',
});
const thCol = (bg) => ({
  background: bg, color: '#e2e8f0', textAlign: 'center',
  fontSize: 10, fontWeight: 600, padding: '5px 2px',
  border: BORDER_DARK, whiteSpace: 'nowrap', userSelect: 'none',
});
const td = (extra = {}) => ({
  border: BORDER, padding: 0, textAlign: 'center',
  height: 28, verticalAlign: 'middle', ...extra,
});
const tdTotal = {
  border: BORDER_DARK, padding: '3px 4px', textAlign: 'center',
  fontSize: 11, fontWeight: 700, color: '#1a365d',
  background: '#edf2f7', verticalAlign: 'middle',
};
const tdBal = { ...tdTotal, background: '#e6fffa', color: '#276749' };

const EDIT_STYLE = { borderBottom: '1px dashed #a0aec0', background: 'transparent' };
const numProps = (extra = {}) => ({
  variant: 'unstyled', size: 'xs', hideControls: true, decimalScale: 2,
  styles: { input: { textAlign: 'center', fontSize: 11, height: 26, padding: '0 2px', width: '100%', ...EDIT_STYLE } },
  ...extra,
});
const numPropsRO = (extra = {}) => ({
  variant: 'unstyled', size: 'xs', hideControls: true, decimalScale: 2, readOnly: true,
  styles: { input: { textAlign: 'center', fontSize: 11, height: 26, padding: '0 2px', width: '100%', cursor: 'default' } },
  ...extra,
});
const txtProps = (extra = {}) => ({
  variant: 'unstyled', size: 'xs',
  styles: { input: { textAlign: 'center', fontSize: 11, height: 26, padding: '0 2px', width: '100%', ...EDIT_STYLE } },
  ...extra,
});

const recalc = (row) => {
  const milkVal   = n(row.milkValue);
  const prev      = n(row.prevBalance);
  const other     = n(row.otherEarnings);
  const totalEarn = milkVal + prev + other;

  // cfAdv / cashAdv / loanAdv are reference-only opening balances — NOT deducted
  // Only the Rec (recovery) amounts + welfare + otherDed go into totalDed
  const welfare   = n(row.welfare);
  const cfRec     = n(row.cfRec);
  const cashRec   = n(row.cashRec);
  const loanRec   = n(row.loanRec);
  const otherDed  = n(row.otherDed);
  const totalDed  = welfare + cfRec + cashRec + loanRec + otherDed;
  const netPay    = totalEarn - totalDed;

  return {
    ...row,
    totalEarnings: totalEarn !== 0 ? totalEarn : '',
    totalDed:      totalDed  > 0  ? totalDed  : '',
    netPay:        netPay    !== 0 ? netPay    : '',
  };
};

/* ════════════════════════════════════════════════════════════
   MEMOISED ROW — re-renders only when its own row data changes
════════════════════════════════════════════════════════════ */
const PaymentRow = React.memo(function PaymentRow({ row, idx, quantityUnit, onUpdate, onToggleLock, isPrinting = false }) {
  const isPaid     = row.paid;
  const isBankPend = row.bankPending;
  const netClr = n(row.netPay) >= 0 ? '#00695c' : '#c53030';
  const netBg  = n(row.netPay) >= 0
    ? (idx % 2 === 0 ? '#e6fffa' : '#d4f5ee')
    : (idx % 2 === 0 ? '#fff5f5' : '#fde8e8');
  const rowBg = isBankPend ? '#ebf8ff' : isPaid ? '#f0fff4' : row.locked ? '#f0fff4' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb');

  // Print-only compact row: plain-text cells so inputs/values render reliably on paper.
  if (isPrinting) {
    const fmt2 = (v) => (v == null || v === '' || isNaN(Number(v))) ? '—' : Number(v).toFixed(2);
    const fmtQ = (v) => (v == null || v === '' || isNaN(Number(v))) ? '—' : Number(v).toFixed(quantityUnit === 'KG' ? 3 : 1);
    const ptd = (extra = {}) => ({
      border: '1px solid #999', padding: '2px 3px', fontSize: 8,
      textAlign: 'center', fontVariantNumeric: 'tabular-nums', ...extra,
    });
    return (
      <tr>
        <td style={ptd({ fontWeight: 600 })}>{row.sn}</td>
        <td style={ptd()}>{row.producerId}</td>
        <td style={ptd({ textAlign: 'left', fontWeight: 600 })}>{row.producerName}</td>
        <td style={ptd()}>{fmtQ(row.qty)}</td>
        <td style={ptd()}>{fmt2(row.milkValue)}</td>
        <td style={ptd()}>{fmt2(row.prevBalance)}</td>
        <td style={ptd()}>{fmt2(row.otherEarnings)}</td>
        <td style={ptd({ fontWeight: 700 })}>{fmt2(row.totalEarnings)}</td>
        <td style={ptd()}>{fmt2(row.welfare)}</td>
        <td style={ptd()}>{fmt2(row.cfAdv)}</td>
        <td style={ptd()}>{fmt2(row.cfRec)}</td>
        <td style={ptd()}>{fmt2(row.cashAdv)}</td>
        <td style={ptd()}>{fmt2(row.cashRec)}</td>
        <td style={ptd()}>{fmt2(row.loanAdv)}</td>
        <td style={ptd()}>{fmt2(row.loanRec)}</td>
        <td style={ptd()}>{fmt2(row.otherDed)}</td>
        <td style={ptd({ fontWeight: 700 })}>{fmt2(row.totalDed)}</td>
        <td style={ptd({ fontWeight: 700, color: netClr })}>{fmt2(row.netPay)}</td>
        <td style={ptd({ fontWeight: 600 })}>{fmt2(row.netPay)}</td>
        <td style={ptd({ height: 22 })} />
      </tr>
    );
  }

  return (
    <tr style={{ background: rowBg }}>
      <td style={td({ background: '#f7fafc', fontSize: 11, fontWeight: 600, color: '#718096' })}>{row.sn}</td>
      <td style={td({ fontSize: 10, color: '#4a5568', padding: '0 4px' })}>{row.producerId}</td>
      <td style={td({ textAlign: 'left', fontSize: 11, color: '#1a202c', padding: '0 5px', fontWeight: 500 })}>{row.producerName}</td>

      {/* QTY */}
      <td style={td()}>
        <NumberInput {...numPropsRO({ decimalScale: quantityUnit === 'KG' ? 3 : 1 })} value={row.qty} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, width: '100%', cursor: 'default' } }} />
      </td>
      {/* Milk Value */}
      <td style={td({ background: '#fffff0' })}>
        <NumberInput {...numPropsRO()} value={row.milkValue} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 600, color: '#1a365d', width: '100%', cursor: 'default' } }} />
      </td>
      {/* Prev Balance */}
      <td style={td({ background: '#ebf8ff' })}>
        <NumberInput {...numPropsRO()} value={row.prevBalance} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#2b6cb0', width: '100%', cursor: 'default' } }} />
      </td>
      {/* Other Earnings */}
      <td style={td({ background: '#f0fff4' })}>
        {(isPaid || row.locked)
          ? <NumberInput {...numPropsRO()} value={row.otherEarnings} placeholder="—"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#276749', width: '100%', cursor: 'default' } }} />
          : <NumberInput {...numProps()} value={row.otherEarnings} placeholder="0.00"
              onChange={(v) => onUpdate(idx, 'otherEarnings', v)}
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#276749', width: '100%', ...EDIT_STYLE } }} />
        }
      </td>
      {/* Total Earnings */}
      <td style={td({ background: '#e6fffa' })}>
        <NumberInput {...numPropsRO()} value={row.totalEarnings} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#276749', width: '100%', cursor: 'default' } }} />
      </td>

      {/* Welfare */}
      <td style={td({ background: '#fff3cd' })}>
        {(isPaid || row.locked)
          ? <NumberInput {...numPropsRO()} value={row.welfare} placeholder="—"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#92400e', width: '100%', cursor: 'default' } }} />
          : <NumberInput {...numProps()} value={row.welfare} placeholder="0"
              onChange={(v) => onUpdate(idx, 'welfare', v)}
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#92400e', width: '100%' } }} />
        }
      </td>
      {/* CF Advance */}
      <td style={td({ background: '#fffaf0' })}>
        <NumberInput {...numPropsRO()} value={row.cfAdv} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#7b341e', width: '100%', cursor: 'default' } }} />
      </td>
      {/* CF Recovery */}
      <td style={td({ background: '#fff9f0' })}>
        {(isPaid || row.locked)
          ? <NumberInput {...numPropsRO()} value={row.cfRec} placeholder="—"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', cursor: 'default' } }} />
          : <NumberInput {...numProps()} value={row.cfRec}
              onChange={(v) => onUpdate(idx, 'cfRec', v)} placeholder="0.00"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', ...EDIT_STYLE } }} />
        }
      </td>
      {/* Cash Advance */}
      <td style={td({ background: '#fffaf0' })}>
        <NumberInput {...numPropsRO()} value={row.cashAdv} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#7b341e', width: '100%', cursor: 'default' } }} />
      </td>
      {/* Cash Recovery */}
      <td style={td({ background: '#fff9f0' })}>
        {(isPaid || row.locked)
          ? <NumberInput {...numPropsRO()} value={row.cashRec} placeholder="—"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', cursor: 'default' } }} />
          : <NumberInput {...numProps()} value={row.cashRec}
              onChange={(v) => onUpdate(idx, 'cashRec', v)} placeholder="0.00"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', ...EDIT_STYLE } }} />
        }
      </td>
      {/* Loan Advance */}
      <td style={td({ background: '#fffaf0' })}>
        <NumberInput {...numPropsRO()} value={row.loanAdv} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#7b341e', width: '100%', cursor: 'default' } }} />
      </td>
      {/* Loan Recovery */}
      <td style={td({ background: '#fff9f0' })}>
        {(isPaid || row.locked)
          ? <NumberInput {...numPropsRO()} value={row.loanRec} placeholder="—"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', cursor: 'default' } }} />
          : <NumberInput {...numProps()} value={row.loanRec}
              onChange={(v) => onUpdate(idx, 'loanRec', v)} placeholder="0.00"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', ...EDIT_STYLE } }} />
        }
      </td>
      {/* Other Deductions */}
      <td style={td({ background: '#fffaf0' })}>
        {(isPaid || row.locked)
          ? <NumberInput {...numPropsRO()} value={row.otherDed} placeholder="—"
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, width: '100%', cursor: 'default' } }} />
          : <NumberInput {...numProps()} value={row.otherDed} placeholder="0.00"
              onChange={(v) => onUpdate(idx, 'otherDed', v)}
              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, width: '100%', ...EDIT_STYLE } }} />
        }
      </td>
      {/* Total Deductions */}
      <td style={td({ background: '#ffe0b2' })}>
        <NumberInput {...numPropsRO()} value={row.totalDed} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#7b341e', width: '100%', cursor: 'default' } }} />
      </td>
      {/* Net Pay */}
      <td style={td({ background: netBg })}>
        <NumberInput {...numPropsRO()} value={row.netPay} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: netClr, width: '100%', cursor: 'default' } }} />
      </td>
      {/* To Transfer */}
      <td style={td({ background: '#f0f4ff' })}>
        <NumberInput {...numPropsRO()} value={row.netPay} placeholder="—"
          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 600, color: '#1a365d', width: '100%', cursor: 'default' } }} />
      </td>
      {/* Signature — only rendered while printing */}
      {isPrinting && (
        <td style={{ ...td(), height: 28, borderBottom: '1px solid #999' }}>
          {/* Empty cell for handwritten sign on the printout */}
        </td>
      )}
      {/* Lock checkbox */}
      <td style={td({ padding: '0 4px', background: row.locked || isPaid ? '#f0fff4' : '#fff' })} className="no-print">
        {row.producerName?.trim() ? (
          isPaid ? (
            isBankPend ? (
              <Group justify="center" gap={2} wrap="nowrap">
                <IconBuildingBank size={12} color="#2b6cb0" />
                <Text size={9} c="blue" fw={600}>Bank</Text>
              </Group>
            ) : (
              <Group justify="center" gap={2} wrap="nowrap">
                <IconCheck size={12} color="#38a169" />
                <Text size={9} c="green" fw={600}>Paid</Text>
              </Group>
            )
          ) : (
            <Group justify="center" align="center" style={{ height: 28 }} gap={0}>
              <Checkbox
                size="xs"
                checked={row.locked}
                onChange={() => onToggleLock(idx)}
                color="teal"
                title={row.locked ? 'Locked — click to unlock' : 'Lock this farmer\'s payment'}
                styles={{ input: { cursor: 'pointer' } }}
              />
            </Group>
          )
        ) : null}
      </td>
    </tr>
  );
});

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
const PaymentRegisterLedger = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();
  const [searchParams] = useSearchParams();

  // Render-all-rows flag: pagination shows only the current page on screen,
  // but the print needs every row of the loaded cycle. Toggled before/after
  // print via react-to-print callbacks.
  const [isPrinting, setIsPrinting] = useState(false);

  // react-to-print v3 uses `contentRef` (was `content` callback in v2).
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Payment Register Detailed',
    onBeforePrint: () => new Promise((resolve) => {
      setIsPrinting(true);
      // Wait one paint so the de-paginated DOM is committed before printing.
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }),
    onAfterPrint: () => setIsPrinting(false),
    pageStyle: `
      @page { size: A4 landscape; margin: 5mm; }
      html, body { background: #fff !important; }
      body { font-size: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      * { overflow: visible !important; max-height: none !important; box-shadow: none !important; }
      .no-print { display: none !important; }
      .print-show { display: table-cell !important; }
      .print-header { display: block !important; }
      /* Drop scroll-area and minWidth wrappers so the table can shrink to the page */
      [class*="ScrollArea"], [class*="scrollarea"] { overflow: visible !important; }
      .print-fit-wrap { min-width: 0 !important; width: 100% !important; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; }
      th, td { border: 1px solid #999; padding: 1.5px 2px; font-size: 7px; word-wrap: break-word; line-height: 1.15; }
      thead th { background: #e2e8f0 !important; color: #1a202c !important; font-weight: 700; }
    `,
  });

  /* ─── header state ─── */
  const [fromDate,      setFromDate]      = useState(null);
  const [toDate,        setToDate]        = useState(null);
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [settingsDays,  setSettingsDays]  = useState(15);
  // Latest applied/saved cycle's toDate — used to lock date pickers so the
  // user cannot pick a date inside an already-paid cycle.
  const [latestPaidTo,  setLatestPaidTo]  = useState(null);
  // Cycle anchor — the first valid cycle-start date. All valid cycle starts are
  // anchor + N*settingsDays, so date pickers can disable everything in between.
  const [cycleAnchor,   setCycleAnchor]   = useState(null);
  const minPickDate = latestPaidTo ? dayjs(latestPaidTo).add(1, 'day').toDate() : undefined;

  // Returns true when `d` is NOT a valid cycle boundary (used by DateInput.excludeDate).
  // role = 'from' → enforce that d is a cycle-start; 'to' → enforce that d is a cycle-end.
  const isOutsideCycleBoundary = (d, role) => {
    if (!cycleAnchor || !settingsDays) return false;
    const target = role === 'to' ? dayjs(d).add(1, 'day') : dayjs(d);
    const diff   = target.startOf('day').diff(dayjs(cycleAnchor).startOf('day'), 'day');
    if (diff < 0) return true;
    return diff % settingsDays !== 0;
  };

  /* ─── data state ─── */
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [quantityUnit, setQuantityUnit] = useState('Litre');

  /* ─── Pagination ─── */
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(20);

  /* ─── Previous cycle carry-forward (farmerId → carry data) ─── */
  const prevCycleRef = useRef({});

  const storeCycleData = (currentRows) => {
    const data = {};
    currentRows.forEach(r => {
      if (!r.farmerId) return;
      const netPay = n(r.netPay);
      // bankPending rows have paidAmount=0 — their full netPay is the prevBalance
      // individually-paid rows: prevBalance = 0 (or partial remainder)
      const paid       = r.bankPending ? 0 : (n(r.paidAmount) || netPay);
      const prevBalance = Math.max(0, netPay - paid);
      data[r.farmerId] = {
        prevBalance,
        cfAdv:   Math.max(0, n(r.cfAdv)   - n(r.cfRec)),
        cashAdv: Math.max(0, n(r.cashAdv) - n(r.cashRec)),
        loanAdv: Math.max(0, n(r.loanAdv) - n(r.loanRec)),
      };
    });
    prevCycleRef.current = data;
  };

  const applyPrevCycle = (row) => {
    const prev = prevCycleRef.current[row.farmerId];
    if (!prev) return row;
    return recalc({ ...row, ...prev });
  };

  /* ─── Load settings on mount → auto-advance to next unpaid cycle ─── */
  /* If navigated from Ledger History with ?from=&to= params, use those dates directly */
  useEffect(() => {
    const paramFrom = searchParams.get('from');
    const paramTo   = searchParams.get('to');

    // If URL params supplied (reverse-navigate from history), skip auto-advance and use them
    if (paramFrom && paramTo) {
      Promise.all([
        dairySettingsAPI.get(),
        milkPurchaseSettingsAPI.getSummary(),
      ]).then(([dsRes, msRes]) => {
        const s    = dsRes?.data || dsRes || {};
        setSettingsDays(s.paymentDays || 15);
        setQuantityUnit(msRes?.data?.quantityUnit || 'Litre');
        setFromDate(dayjs(paramFrom).toDate());
        setToDate(dayjs(paramTo).toDate());
        setCycleAnchor(dayjs(paramFrom).toDate());
      }).catch(() => {
        setFromDate(dayjs(paramFrom).toDate());
        setToDate(dayjs(paramTo).toDate());
        setCycleAnchor(dayjs(paramFrom).toDate());
      });
      return;
    }

    Promise.all([
      dairySettingsAPI.get(),
      milkPurchaseSettingsAPI.getSummary(),
      paymentAPI.getLatestPeriod(),
    ]).then(([dsRes, msRes, lpRes]) => {
      const s    = dsRes?.data || dsRes || {};
      const days = s.paymentDays || 15;
      setSettingsDays(days);
      setQuantityUnit(msRes?.data?.quantityUnit || 'Litre');

      const latestToDate = lpRes?.data?.latestToDate;
      setLatestPaidTo(latestToDate || null);

      let from, to;
      // Anchor for cycle-boundary lock: prefer the configured paymentFromDate
      // (the original first cycle start) so subsequent cycles always align.
      const anchor = s.paymentFromDate
        ? dayjs(s.paymentFromDate).toDate()
        : (latestToDate ? dayjs(latestToDate).add(1, 'day').toDate() : dayjs().startOf('month').toDate());
      setCycleAnchor(anchor);

      if (latestToDate) {
        // Next cycle starts the day after the last applied period ended
        from = dayjs(latestToDate).add(1, 'day').toDate();
        to   = dayjs(from).add(days - 1, 'day').toDate();
      } else if (s.paymentFromDate) {
        // No payments yet — use settings start date
        from = dayjs(s.paymentFromDate).toDate();
        to   = dayjs(s.paymentFromDate).add(days - 1, 'day').toDate();
      } else {
        from = dayjs().startOf('month').toDate();
        to   = dayjs().startOf('month').add(days - 1, 'day').toDate();
      }
      setFromDate(from);
      setToDate(to);
      // No auto-load — user must click Generate
    }).catch(() => {
      const fallbackFrom = dayjs().startOf('month').toDate();
      setFromDate(fallbackFrom);
      setToDate(dayjs(fallbackFrom).add(14, 'day').toDate());
      setCycleAnchor(fallbackFrom);
    });
  }, []); // eslint-disable-line

  /* ─── Map a generated entry → ledger row ─── */
  const toRow = (e, i) => {
    const nz = (v) => (v != null && v !== 0 ? v : '');
    return recalc({
      sn:            i + 1,
      _entryId:      '',
      farmerId:      e.farmerId?.toString() || '',
      producerId:    e.productId   || '',
      producerName:  e.productName || '',
      qty:           nz(e.qty),
      milkValue:     nz(e.milkValue),
      prevBalance:   nz(e.previousBalance),
      otherEarnings: '',
      totalEarnings: '',
      welfare:       nz(e.welfare),
      cfAdv:         nz(e.cfRec),      // generateProducers returns cfRec = CF advance balance
      cfRec:         '',
      cashAdv:       nz(e.cashPocket),
      cashRec:       '',
      loanAdv:       nz(e.loanAdv),
      loanRec:       '',
      otherDed:      '',
      totalDed:      '',
      netPay:        '',
      payMode:       '',    // no checkbox pre-ticked — user selects
      paidAmount:    '',
      signature:     '',
      locked:        false,
      paid:          false,
      bankPending:   false,
      // Cycle 2+ marker — backend already carried (cfAdv - cfRec) from prior
      // saved register. Stops applyCFAdvance from re-introducing the original.
      _hasPriorRegister: !!e.hasPriorRegister,
    });
  };

  /* ─── Map a ProducerOpening → ledger row (fallback when no milk data) ─── */
  const openingToRow = (o, i) => {
    const nz  = (v) => (v != null && v !== 0 ? v : '');
    const fid = o.farmerId?._id?.toString() || o.farmerId?.toString() || '';
    return recalc({
      sn:            i + 1,
      _entryId:      '',
      farmerId:      fid,
      producerId:    o.producerNumber || o.farmerId?.farmerNumber || '',
      producerName:  o.producerName  || o.farmerId?.personalDetails?.name || '',
      qty:           '',
      milkValue:     '',
      prevBalance:   nz(o.dueAmount),
      otherEarnings: '',
      totalEarnings: '',
      welfare:       '',
      cfAdv:         nz(o.cfAdvance),
      cfRec:         '',
      cashAdv:       nz(o.cashAdvance),
      cashRec:       '',
      loanAdv:       nz(o.loanAdvance),
      loanRec:       '',
      otherDed:      '',
      totalDed:      '',
      netPay:        '',
      payMode:       '',    // no checkbox pre-ticked — user selects
      paidAmount:    '',
      signature:     '',
      locked:        false,
      paid:          false,
      bankPending:   false,
    });
  };

  /* ─── Get welfare fixed amount from PeriodicalRule (called once per load) ─── */
  const getWelfareAmount = async () => {
    try {
      const res   = await periodicalRuleAPI.getAll({ component: 'DEDUCTIONS' });
      const rules = res?.data || [];
      const rule  = rules.find(r => r.basedOn === 'FIXED_AMOUNT' && r.active);
      return rule?.fixedRate || 0;
    } catch { return 0; }
  };

  /* ─── Core load: generateProducers for milk data (qty + value + advances) ───
     Falls back to ProducerOpening rows if no milk collections exist for period.
     Welfare auto-filled from PeriodicalRule if backend returns 0.           ─── */
  const loadData = async (from, to, silent = false) => {
    setLoading(true);
    try {
      const fd  = dayjs(from).format('YYYY-MM-DD');
      const td  = dayjs(to).format('YYYY-MM-DD');

      // Fetch milk data, welfare rule, existing payments, and CF advance balances — all in parallel.
      // Payments: query without period filter (avoid UTC/IST mismatch) — period overlap checked below.
      const [res, welfareAmt, pmtRes, cfAdvRes] = await Promise.all([
        paymentRegisterAPI.generateProducers({ fromDate: fd, toDate: td }),
        getWelfareAmount(),
        paymentAPI.getAll({ limit: 1000 }),
        cattleFeedAdvanceAPI.getSummary({ toDate: td }).catch(() => ({ success: false })),
      ]);

      // Build farmerId → outstanding CF advance balance map
      // balance > 0 means farmer owes this amount (to be auto-deducted)
      const cfAdvMap = {};
      (cfAdvRes?.data?.rows || []).forEach(r => {
        if (r.farmerId && r.balance > 0) cfAdvMap[r.farmerId] = r.balance;
      });

      // Apply CF advance balance. Only on the very FIRST cycle for this
      // company — once any prior cycle has been paid, the backend's carry
      // forward value (= prev cycle's cfAdv − cfRec) is authoritative and the
      // live CF Advance summary must not overwrite it back to the original
      // ProducerOpening figure. Cash and Loan have no equivalent override and
      // already carry correctly from the backend.
      const isFirstCycleForCompany = !latestPaidTo;
      const applyCFAdvance = (row) => {
        if (!isFirstCycleForCompany) return row;            // cycle 2+ → trust backend carry
        if (row._hasPriorRegister) return row;              // backend carry wins
        if (prevCycleRef.current[row.farmerId]) return row; // in-memory carry wins
        const cfBal = cfAdvMap[row.farmerId];
        if (!cfBal) return row;
        return recalc({ ...row, cfAdv: cfBal, cfRec: cfBal });
      };
      const entries  = res?.data?.entries || [];
      const payments = pmtRes?.data || [];

      // Use YYYY-MM-DD string comparison — avoids IST/UTC midnight shift ambiguity.
      // Exact overlap: payment must share at least one day with the displayed cycle.
      const cycleFromStr = dayjs(from).format('YYYY-MM-DD');
      const cycleToStr   = dayjs(to).format('YYYY-MM-DD');

      // Build farmerId → FarmerPayment map for THIS exact cycle. We only merge
      // a prior payment when its period matches the displayed cycle within
      // ±2 days (IST/UTC drift tolerance). Overlap-only matching pulled in
      // payments from neighbouring cycles (e.g. May 1–15 vs the new May 1–10),
      // marking the new rows as already-paid and silently skipping the new
      // FarmerPayment creation on save.
      const cycleFromDjs = dayjs(cycleFromStr);
      const cycleToDjs   = dayjs(cycleToStr);
      const sameCycle = (pmtFrom, pmtTo) => {
        if (!pmtFrom || !pmtTo) return false;
        return Math.abs(pmtFrom.diff(cycleFromDjs, 'day')) <= 2
            && Math.abs(pmtTo.diff(cycleToDjs,   'day')) <= 2;
      };

      const pmtMap = {};
      payments.forEach(pmt => {
        const fid = pmt.farmerId?._id?.toString() || pmt.farmerId?.toString() || '';
        if (!fid) return;
        if (pmt.status === 'Cancelled') return; // skip reversed/cancelled payments

        const pmtFrom = pmt.paymentPeriod?.fromDate ? dayjs(pmt.paymentPeriod.fromDate) : null;
        const pmtTo   = pmt.paymentPeriod?.toDate   ? dayjs(pmt.paymentPeriod.toDate)   : null;
        if (!sameCycle(pmtFrom, pmtTo)) return;

        const existing = pmtMap[fid];
        if (!existing) {
          pmtMap[fid] = pmt;
        } else {
          // Prefer individually-paid (Ledger/PaymentRegister) over BankTransfer-pending
          const isPaid = (src) => !src || src === 'Ledger' || src === 'PaymentRegister';
          if (!isPaid(existing.paymentSource) && isPaid(pmt.paymentSource)) pmtMap[fid] = pmt;
        }
      });

      // Helper: extract deduction amount by type from a FarmerPayment
      const getDed = (pmt, ...types) =>
        (pmt?.deductions || [])
          .filter(d => types.includes(d.type))
          .reduce((s, d) => s + (d.amount || 0), 0);

      // Merge a row with its existing FarmerPayment (if any)
      // 'Ledger' or 'PaymentRegister' source = individually paid → show paidAmount, mark paid.
      // 'BankTransfer' source = queued for bank transfer → lock row, show "Bank" badge, paidAmount stays empty.
      const mergePayment = (row) => {
        const pmt = pmtMap[row.farmerId];
        if (!pmt) return row;
        const isLedgerPmt   = !pmt.paymentSource
                              || pmt.paymentSource === 'Ledger'
                              || pmt.paymentSource === 'PaymentRegister';
        const isBankPending = pmt.paymentSource === 'BankTransfer';
        return recalc({
          ...row,
          cfRec:       getDed(pmt, 'CF Recovery', 'CF Advance')                 || row.cfRec,
          cashRec:     getDed(pmt, 'Cash Recovery', 'Cash Advance')              || row.cashRec,
          loanRec:     getDed(pmt, 'Loan Recovery', 'Loan Advance', 'Loan EMI')  || row.loanRec,
          welfare:     getDed(pmt, 'Welfare Recovery')                           || row.welfare,
          paidAmount:  isLedgerPmt ? (pmt.paidAmount || row.paidAmount) : row.paidAmount,
          paid:        isLedgerPmt ? (pmt.status === 'Paid' || pmt.status === 'Partial') : isBankPending,
          bankPending: isBankPending,
          locked:      isLedgerPmt || isBankPending,
        });
      };

      if (entries.length > 0) {
        const mapped = entries
          .map((e, i) => {
            let row = toRow(e, i);
            // Welfare is once per farmer per calendar month (first cycle they pour milk).
            // The backend returns 0 for farmers who already had welfare in an earlier
            // cycle of the same month — DON'T auto-fill (would re-charge them).
            // Only fill when the backend omitted welfare entirely (null = no data).
            if (e.welfare == null && welfareAmt > 0) row = recalc({ ...row, welfare: welfareAmt });
            row = applyPrevCycle(row);
            row = applyCFAdvance(row);
            return mergePayment(row);
          })
          .sort((a, b) => {
            const na = parseInt(a.producerId, 10);
            const nb = parseInt(b.producerId, 10);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a.producerId || '').localeCompare(String(b.producerId || ''));
          })
          .map((r, i) => ({ ...r, sn: i + 1 }));
        setPage(1);
        setRows(mapped);
        setDateConfirmed(true);
        const paidCount = mapped.filter(r => r.paid).length;
        if (!silent) notifications.show({
          title: 'Generated',
          message: `${entries.length} producer(s) · ${paidCount > 0 ? `${paidCount} already paid · ` : ''}${dayjs(from).format('DD/MM/YYYY')} – ${dayjs(to).format('DD/MM/YYYY')}`,
          color: 'teal', icon: <IconCheck size={14} />,
        });
      } else {
        // No milk data — show from ProducerOpening, still merge any existing payments
        const oRes     = await producerOpeningAPI.getAll({ limit: 500 });
        const openings = oRes?.data || [];
        if (openings.length > 0) {
          const mapped = openings
            .map((o, i) => {
              let row = openingToRow(o, i);
              // No milk data path: auto-fill welfare for all producers since we have
              // no per-farmer context here. mergePayment will override with 0 for any
              // farmer whose payment already carries a welfare deduction this cycle.
              if (!n(row.welfare) && welfareAmt > 0) row = recalc({ ...row, welfare: welfareAmt });
              row = applyPrevCycle(row);
              row = applyCFAdvance(row);
              return mergePayment(row);
            })
            .sort((a, b) => {
              const na = parseInt(a.producerId, 10);
              const nb = parseInt(b.producerId, 10);
              if (!isNaN(na) && !isNaN(nb)) return na - nb;
              return String(a.producerId || '').localeCompare(String(b.producerId || ''));
            })
            .map((r, i) => ({ ...r, sn: i + 1 }));
          setRows(mapped);
          setDateConfirmed(true);
          if (!silent) notifications.show({
            title: 'No Milk Data',
            message: 'No milk collections for this period. Showing producers with opening balances.',
            color: 'orange',
          });
        }
      }
    } catch (err) {
      console.error('PaymentRegisterLedger loadData error:', err);
      if (!silent) notifications.show({ title: 'Load Failed', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleFromDateChange = (v) => {
    setFromDate(v);
    if (v) setToDate(dayjs(v).add(settingsDays - 1, 'day').toDate());
    setDateConfirmed(false);
  };
  const handleToDateChange = (v) => { setToDate(v); setDateConfirmed(false); };

  /* ─── Load button: reload for selected dates ─── */
  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate) {
      notifications.show({ title: 'Select Dates', message: 'Please select From and To dates', color: 'orange' });
      return;
    }
    await loadData(fromDate, toDate, false);
  }, [fromDate, toDate]);

  /* ─── Row update — stable reference (no deps, uses functional setRows) ─── */
  const updateRow = useCallback((idx, field, value) => {
    setRows(prev => {
      const next = [...prev];
      next[idx]  = recalc({ ...next[idx], [field]: value });
      return next;
    });
  }, []);

  /* ─── Toggle lock per row ─── */
  const toggleLock = useCallback((idx) => {
    setRows(prev => {
      const next = [...prev];
      if (next[idx].paid || next[idx].bankPending) return next;
      next[idx] = { ...next[idx], locked: !next[idx].locked };
      return next;
    });
  }, []);

  /* ─── Lock ALL unlocked rows at once ─── */
  const lockAllRows = useCallback(() => {
    setRows(prev => prev.map(r =>
      r.producerName?.trim() && !r.paid && !r.bankPending ? { ...r, locked: true } : r
    ));
  }, []);

  /* ─── Advance period to next cycle ─── */
  const advanceCycle = () => {
    if (!toDate) return;
    const nextFrom = dayjs(toDate).add(1, 'day').toDate();
    const nextTo   = dayjs(nextFrom).add(settingsDays - 1, 'day').toDate();
    setFromDate(nextFrom);
    setToDate(nextTo);
    setRows([]);
    setDateConfirmed(false);
    notifications.show({
      title:   'Cycle Advanced',
      message: `Next period: ${dayjs(nextFrom).format('DD/MM/YYYY')} – ${dayjs(nextTo).format('DD/MM/YYYY')}`,
      color:   'blue',
    });
  };

  /* ─── Save Payment — locks all farmers & queues for Bank Transfer ─── */
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0, name: '' });

  const savePayment = async () => {
    if (filledRows.length === 0) {
      notifications.show({ title: 'No Data', message: 'Generate the register first', color: 'orange' });
      return;
    }

    const unlockedNow = filledRows.filter(r => !r.locked && !r.paid && !r.bankPending);
    if (unlockedNow.length > 0) {
      notifications.show({
        title:   'Lock All Farmers First',
        message: `${unlockedNow.length} farmer(s) not yet locked. Set recovery amounts and click the lock ✓ checkbox for each farmer.`,
        color:   'orange',
        autoClose: 5000,
      });
      return;
    }

    const saveStart = Date.now();
    setSaving(true);
    const periodFrom = fromDate;
    const periodTo   = toDate;

    // Rows to create FarmerPayment for: locked by user, not yet individually paid or bank-pending
    const toSave = filledRows.filter(r => r.locked && !r.paid && !r.bankPending);

    setSaveProgress({ current: 0, total: toSave.length, name: '' });

    let done = 0;
    let totalCashRec = 0;
    let totalCfRec   = 0;
    let totalLoanRec = 0;
    const savedFarmerIds = new Set();
    const failedRows = [];

    for (const [idx, row] of toSave.entries()) {
      setSaveProgress({ current: idx, total: toSave.length, name: row.producerName || '' });
      try {
        const deductions = [];
        if (n(row.welfare)  > 0) deductions.push({ type: 'Welfare Recovery', amount: n(row.welfare),  description: 'Welfare' });
        if (n(row.cfRec)    > 0) deductions.push({ type: 'CF Recovery',      amount: n(row.cfRec),    description: 'CF Recovery' });
        if (n(row.cashRec)  > 0) deductions.push({ type: 'Cash Recovery',    amount: n(row.cashRec),  description: 'Cash Recovery' });
        if (n(row.loanRec)  > 0) deductions.push({ type: 'Loan Recovery',    amount: n(row.loanRec),  description: 'Loan Recovery' });
        if (n(row.otherDed) > 0) deductions.push({ type: 'Other',            amount: n(row.otherDed), description: 'Other Deductions' });
        const bonuses = n(row.otherEarnings) > 0
          ? [{ type: 'Other', amount: n(row.otherEarnings), description: 'Other Earnings' }]
          : [];

        // Only rows with a positive Net Pay are queued for Bank Transfer.
        // Recovery-only rows (net pay ≤ 0) save the deductions in the date-
        // based ledger but stay on Payment Register Detailed only — no Bank
        // Transfer entry is needed when there's nothing to disburse.
        const netPay = n(row.netPay);
        const isBankPayable = netPay > 0;

        const res = await paymentAPI.create({
          farmerId:        row.farmerId,
          farmerName:      row.producerName || '',
          paymentDate:     periodTo,          // last date of the generated cycle
          paymentPeriod:   { fromDate: periodFrom, toDate: periodTo, periodType: 'Custom' },
          milkAmount:      n(row.milkValue),
          previousBalance: n(row.prevBalance),
          bonuses,
          deductions,
          paidAmount:      0,                              // no amount paid yet
          paymentMode:     row.payMode || 'Cash',          // cash/bank stored for Bank Transfer sorting
          paymentSource:   isBankPayable ? 'BankTransfer' : 'PaymentRegister',
          remarks:         `Payment Register — ${dayjs(periodFrom).format('DD/MM')}–${dayjs(periodTo).format('DD/MM/YYYY')}`,
        });
        if (res && res.success === false) {
          failedRows.push({ name: row.producerName, msg: res.message || 'Unknown error' });
          continue;
        }
        savedFarmerIds.add(row.farmerId);
        totalCashRec += n(row.cashRec);
        totalCfRec   += n(row.cfRec);
        totalLoanRec += n(row.loanRec);
        done++;
      } catch (err) {
        console.error('FarmerPayment create failed:', row.producerName, err.message);
        failedRows.push({ name: row.producerName, msg: err.message || 'request failed' });
      }
    }

    // Surface any failures so the user knows recoveries didn't post
    if (failedRows.length > 0) {
      notifications.show({
        title:   `${failedRows.length} farmer payment(s) failed to save`,
        message: failedRows.slice(0, 5).map(f => `${f.name}: ${f.msg}`).join(' | ')
                 + (failedRows.length > 5 ? ` … +${failedRows.length - 5} more` : ''),
        color:   'red',
        autoClose: 8000,
      });
    }

    // Confirm what was posted to advance modules so the user can verify on their pages
    if (done > 0 && (totalCashRec > 0 || totalCfRec > 0 || totalLoanRec > 0)) {
      const parts = [];
      if (totalCashRec > 0) parts.push(`Cash ₹${totalCashRec.toFixed(2)}`);
      if (totalCfRec   > 0) parts.push(`CF ₹${totalCfRec.toFixed(2)}`);
      if (totalLoanRec > 0) parts.push(`Loan ₹${totalLoanRec.toFixed(2)}`);
      notifications.show({
        title:   `Recoveries posted (${done} farmer${done > 1 ? 's' : ''})`,
        message: parts.join(' · ') + ' — balances reduced on Cash Advance / CF Advance / Loans pages.',
        color:   'teal',
        autoClose: 6000,
      });
    }

    // Mark saved rows as bankPending in UI
    if (savedFarmerIds.size > 0) {
      setRows(prev => prev.map(r =>
        savedFarmerIds.has(r.farmerId) ? { ...r, paid: true, bankPending: true } : r
      ));
    }

    // Save PaymentRegister history log (includes individually-paid + newly-saved rows)
    try {
      await paymentRegisterAPI.create({
        fromDate:     dayjs(periodFrom).format('YYYY-MM-DD'),
        toDate:       dayjs(periodTo).format('YYYY-MM-DD'),
        registerType: 'Ledger',
        status:       'Saved',
        entries: filledRows.map(r => ({
          farmerId:        r.farmerId,
          productId:       r.producerId   || '',
          productName:     r.producerName || '',
          producerId:      r.producerId   || '',
          producerName:    r.producerName || '',
          qty:             n(r.qty),
          milkValue:       n(r.milkValue),
          previousBalance: n(r.prevBalance),
          otherEarnings:   n(r.otherEarnings),
          totalEarnings:   n(r.totalEarnings),
          welfare:         n(r.welfare),
          cfAdv:           n(r.cfAdv),
          cfRec:           n(r.cfRec),
          cashAdv:         n(r.cashAdv),
          cashRec:         n(r.cashRec),
          loanAdv:         n(r.loanAdv),
          loanRec:         n(r.loanRec),
          otherDed:        n(r.otherDed),
          totalDed:        n(r.totalDed),
          netPay:          n(r.netPay),
          paidAmount:      n(r.netPay),
          payMode:         r.payMode || 'Cash',
          paymentMode:     r.payMode || 'Cash',
          paid:            true,
        })),
      });
    } catch (err) {
      notifications.show({ title: 'History Log Failed', message: err.message, color: 'orange' });
    }

    // Mark progress complete before unhiding the modal
    setSaveProgress({ current: toSave.length, total: toSave.length, name: '' });
    setSaving(false);
    // Reset progress shortly after so the modal doesn't flash old numbers next time
    setTimeout(() => setSaveProgress({ current: 0, total: 0, name: '' }), 400);

    if (done === 0 && toSave.length > 0) {
      notifications.show({ title: 'Save Failed', message: 'Could not queue payments for bank transfer', color: 'red' });
      return;
    }

    const elapsed = ((Date.now() - saveStart) / 1000).toFixed(1);

    // Store carry-forward data for next cycle
    storeCycleData(filledRows);

    // Lock the just-saved cycle: bump latestPaidTo so date pickers can't
    // navigate back into this period without first deleting the saved register.
    setLatestPaidTo(prev => {
      const cur = prev ? new Date(prev) : null;
      return (!cur || periodTo > cur) ? periodTo : prev;
    });

    // Advance to next cycle — clear rows; user must click Generate to load next cycle
    const nextFrom = dayjs(periodTo).add(1, 'day').toDate();
    const nextTo   = dayjs(nextFrom).add(settingsDays - 1, 'day').toDate();
    setFromDate(nextFrom);
    setToDate(nextTo);
    setRows([]);
    setDateConfirmed(false);

    notifications.show({
      title:   'Payment Saved',
      message: `${done > 0 ? `${done} farmer(s) queued for Bank Transfer. ` : 'All individually paid. '}Next cycle: ${dayjs(nextFrom).format('DD/MM/YYYY')} – ${dayjs(nextTo).format('DD/MM/YYYY')} · Saved in ${elapsed}s`,
      color:   'teal',
      icon:    <IconCheck size={14} />,
      autoClose: 8000,
    });
  };

  /* ─── Reset ─── */
  const handleReset = () => {
    setRows([]);
    setDateConfirmed(false);
  };

  /* ─── Totals ─── */
  const totals = useMemo(() => {
    const s = (f) => rows.reduce((acc, r) => acc + n(r[f]), 0);
    return {
      qty: s('qty'), milkValue: s('milkValue'), prevBalance: s('prevBalance'),
      otherEarnings: s('otherEarnings'), totalEarnings: s('totalEarnings'),
      welfare: s('welfare'), cfAdv: s('cfAdv'), cfRec: s('cfRec'),
      cashAdv: s('cashAdv'), cashRec: s('cashRec'),
      loanAdv: s('loanAdv'), loanRec: s('loanRec'),
      otherDed: s('otherDed'), totalDed: s('totalDed'),
      netPay: s('netPay'),
    };
  }, [rows]);

  const filledRows   = rows.filter(r => r.producerName?.trim());
  const paidRows     = rows.filter(r => r.paid);
  const lockedRows   = filledRows.filter(r => r.locked && !r.paid && !r.bankPending);
  const unlockedRows = filledRows.filter(r => !r.locked && !r.paid && !r.bankPending);
  const allLocked    = filledRows.length > 0 && filledRows.every(r => r.paid || r.locked || r.bankPending);
  const totalPages   = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows    = rows.slice((page - 1) * pageSize, page * pageSize);

  /* ════════════════ RENDER ════════════════ */
  const savePct = saveProgress.total > 0
    ? Math.round((saveProgress.current / saveProgress.total) * 100)
    : 0;

  return (
    <Container fluid p="md" style={{ background: '#f0f2f5', minHeight: '100vh' }}>
      <style>{`@media print { .no-print { display: none !important; } .print-show { display: table-cell !important; } .print-header { display: block !important; } }`}</style>

      {/* ── SAVE PROGRESS MODAL ── */}
      <Modal
        opened={saving && saveProgress.total > 0}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        centered
        size="sm"
        title={
          <Group gap="xs">
            <IconDeviceFloppy size={18} color="#2c5282" />
            <Text fw={700}>Saving Payment Register…</Text>
          </Group>
        }
      >
        <Stack gap="md" align="center">
          <RingProgress
            size={140}
            thickness={12}
            roundCaps
            sections={[{ value: savePct, color: 'indigo' }]}
            label={
              <Center>
                <Stack gap={2} align="center">
                  <Text size="lg" fw={700} c="indigo">{savePct}%</Text>
                  <Text size="xs" c="dimmed">{saveProgress.current} / {saveProgress.total}</Text>
                </Stack>
              </Center>
            }
          />
          <Progress value={savePct} size="sm" radius="xl" color="indigo" w="100%" animated />
          <Text size="sm" c="dimmed" lineClamp={1} ta="center" w="100%">
            {saveProgress.name
              ? `Posting: ${saveProgress.name}`
              : (savePct === 100 ? 'Finalising…' : 'Preparing…')}
          </Text>
        </Stack>
      </Modal>

      {/* ── HEADER ── */}
      <Paper withBorder shadow="sm" p="md" mb="md" style={{ background: '#fff' }} className="no-print">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Group gap="xs" align="center">
              <IconFileSpreadsheet size={22} color="#2c5282" />
              <Title order={3} style={{ color: '#1a365d', letterSpacing: 0.3 }}>
                Payment Register Detailed 
              </Title>
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              {selectedCompany?.companyName || 'Dairy Cooperative Society'} · Cycle: {settingsDays} days
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              color="blue"
              variant="filled"
              leftSection={loading ? <Loader size={12} color="white" /> : <IconDownload size={13} />}
              onClick={fetchData}
              disabled={loading || !fromDate || !toDate}
            >
              {loading ? 'Generating…' : 'Generate'}
            </Button>
            <Button
              size="xs"
              color={allLocked ? 'teal' : 'orange'}
              variant="filled"
              leftSection={saving ? <Loader size={12} color="white" /> : <IconDeviceFloppy size={13} />}
              onClick={savePayment}
              disabled={saving || !dateConfirmed || filledRows.length === 0}
              title={!allLocked ? `${unlockedRows.length} farmer(s) not yet locked` : 'Save all payments to Bank Transfer queue'}
            >
              {saving ? 'Saving…' : allLocked ? 'Save Payment' : `Save Payment (${unlockedRows.length} unlocked)`}
            </Button>
            <Button size="xs" variant="light" color="gray" leftSection={<IconRefresh size={13} />} onClick={handleReset}>
              Reset
            </Button>
            <Button size="xs" leftSection={<IconPrinter size={13} />} onClick={handlePrint} disabled={!dateConfirmed}>
              Print
            </Button>
          </Group>
        </Group>

        <Divider my="sm" />

        {/* Filter row */}
        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <DateInput
              label="From Date"
              value={fromDate}
              onChange={handleFromDateChange}
              leftSection={<IconCalendar size={14} />}
              minDate={minPickDate}
              excludeDate={(d) => isOutsideCycleBoundary(d, 'from')}
              description={latestPaidTo
                ? `Locked up to ${dayjs(latestPaidTo).format('DD/MM/YYYY')} (already paid)`
                : `Only cycle starts (${settingsDays}-day) are selectable`}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <DateInput
              label="To Date"
              value={toDate}
              onChange={handleToDateChange}
              leftSection={<IconCalendar size={14} />}
              minDate={fromDate || minPickDate}
              excludeDate={(d) => isOutsideCycleBoundary(d, 'to')}
              description={`Only cycle ends (${settingsDays}-day) are selectable`}
              size="sm"
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── LEDGER TABLE ── */}
      <Paper ref={printRef} withBorder shadow="sm" style={{ background: '#fff' }}>

        {/* Print-only header */}
        <Box style={{ display: 'none' }} className="print-header">
          <Title order={4} ta="center">{selectedCompany?.companyName || 'Dairy Cooperative Society'}</Title>
          <Text size="sm" ta="center" fw={600}>PAYMENT REGISTER — DETAILED LEDGER</Text>
          <Text size="xs" ta="center" c="dimmed">
            Period: {dayjs(fromDate).format('DD MMM YYYY')} – {dayjs(toDate).format('DD MMM YYYY')}
          </Text>
          <Divider my={4} />
        </Box>

        <ScrollArea type="scroll" scrollbarSize={8} scrollHideDelay={0}>
          <Box className="print-fit-wrap" style={{ minWidth: isPrinting ? 0 : 2180 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                {/* SN */}<col style={{ width: 34 }} />
                {/* Producer ID */}<col style={{ width: 62 }} />
                {/* Producer Name */}<col style={{ width: 130 }} />
                {/* QTY */}<col style={{ width: 58 }} />
                {/* Milk Value */}<col style={{ width: 72 }} />
                {/* Prev Balance */}<col style={{ width: 68 }} />
                {/* Other Earnings */}<col style={{ width: 68 }} />
                {/* Total Earnings */}<col style={{ width: 72 }} />
                {/* Welfare */}<col style={{ width: 60 }} />
                {/* CF Adv */}<col style={{ width: 60 }} />
                {/* CF Rec */}<col style={{ width: 60 }} />
                {/* Cash Adv */}<col style={{ width: 60 }} />
                {/* Cash Rec */}<col style={{ width: 60 }} />
                {/* Loan Adv */}<col style={{ width: 60 }} />
                {/* Loan Rec */}<col style={{ width: 60 }} />
                {/* Other Ded */}<col style={{ width: 60 }} />
                {/* Total Ded */}<col style={{ width: 68 }} />
                {/* Net Pay */}<col style={{ width: 78 }} />
                {/* To Transfer */}<col style={{ width: 72 }} />
                {/* Signature — only when printing */}
                {isPrinting && <col style={{ width: 90 }} />}
                {/* Lock */}<col style={{ width: 52 }} />
              </colgroup>

              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Row 1 — Section labels */}
                <tr>
                  <th style={thSection('#2d3748')} rowSpan={2}>SN</th>
                  <th style={thSection('#2d3748')} rowSpan={2}>Prod ID</th>
                  <th style={thSection('#2d3748')} rowSpan={2}>Producer Name</th>
                  {/* EARNINGS */}
                  <th style={thSection('#1a365d')} colSpan={5}>EARNINGS</th>
                  {/* DEDUCTIONS */}
                  <th style={thSection('#744210')} colSpan={9}>DEDUCTIONS</th>
                  {/* NET PAY */}
                  <th style={thSection('#276749')} rowSpan={2}>NET PAY</th>
                  {/* PAYMENT */}
                  <th style={thSection('#1a4731')} rowSpan={2}>To Transfer</th>
                  {/* Signature — print only (driven by isPrinting flag) */}
                  {isPrinting && <th style={thSection('#2d3748')} rowSpan={2}>Signature</th>}
                  {/* Lock All — screen only */}
                  <th style={thSection('#276749')} rowSpan={2} className="no-print">
                    <Box ta="center">
                      <Checkbox
                        size="xs" color="teal"
                        checked={filledRows.length > 0 && filledRows.every(r => r.paid || r.locked || r.bankPending)}
                        onChange={lockAllRows}
                        title="Lock all farmers"
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                      <Text size={9} fw={700} c="white" mt={2}>Lock All</Text>
                    </Box>
                  </th>
                </tr>
                <tr>
                  {/* Earnings sub */}
                  {[`QTY (${quantityUnit === 'KG' ? 'Kg' : 'L'})`, 'Milk Value', 'Prev. Bal', 'Other Earn', 'Total Earn'].map(h => (
                    <th key={h} style={thCol('#2c5282')}>{h}</th>
                  ))}
                  {/* Deductions sub */}
                  <th style={thCol('#975a16')}>Welfare</th>
                  <th style={thCol('#7b341e')}>CF Adv</th>
                  <th style={thCol('#975a16')}>CF Rec</th>
                  <th style={thCol('#7b341e')}>Cash Adv</th>
                  <th style={thCol('#975a16')}>Cash Rec</th>
                  <th style={thCol('#7b341e')}>Loan Adv</th>
                  <th style={thCol('#975a16')}>Loan Rec</th>
                  <th style={thCol('#744210')}>Other Ded</th>
                  <th style={thCol('#7b341e')}>Total Ded</th>
                </tr>
              </thead>

              <tbody>
                {(isPrinting ? rows : pagedRows).map((row, idx) => (
                  <PaymentRow
                    key={row.farmerId || idx}
                    row={row}
                    idx={isPrinting ? idx : (page - 1) * pageSize + idx}
                    quantityUnit={quantityUnit}
                    onUpdate={updateRow}
                    onToggleLock={toggleLock}
                    isPrinting={isPrinting}
                  />
                ))}

                {/* TOTAL ROW */}
                <tr style={{ borderTop: '2px solid #2d3748' }}>
                  <td colSpan={3} style={{ ...tdTotal, background: '#2d3748', color: '#fff', textAlign: 'center', letterSpacing: 1 }}>
                    TOTAL
                  </td>
                  <td style={tdTotal}>{fmtN(totals.qty)}</td>
                  <td style={{ ...tdTotal, background: '#fffff0' }}>{fmtN(totals.milkValue)}</td>
                  <td style={{ ...tdTotal, background: '#ebf8ff', color: '#2b6cb0' }}>{fmtN(totals.prevBalance)}</td>
                  <td style={{ ...tdTotal, background: '#f0fff4', color: '#276749' }}>{fmtN(totals.otherEarnings)}</td>
                  <td style={tdBal}>{fmtN(totals.totalEarnings)}</td>
                  <td style={{ ...tdTotal, background: '#fff3cd', color: '#92400e' }}>{fmtN(totals.welfare)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0', color: '#7b341e' }}>{fmtN(totals.cfAdv)}</td>
                  <td style={{ ...tdTotal, background: '#fff9f0', color: '#c05621' }}>{fmtN(totals.cfRec)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0', color: '#7b341e' }}>{fmtN(totals.cashAdv)}</td>
                  <td style={{ ...tdTotal, background: '#fff9f0', color: '#c05621' }}>{fmtN(totals.cashRec)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0', color: '#7b341e' }}>{fmtN(totals.loanAdv)}</td>
                  <td style={{ ...tdTotal, background: '#fff9f0', color: '#c05621' }}>{fmtN(totals.loanRec)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0' }}>{fmtN(totals.otherDed)}</td>
                  <td style={{ ...tdTotal, background: '#ffe0b2', color: '#7b341e' }}>{fmtN(totals.totalDed)}</td>
                  <td style={{ ...tdBal, background: '#b2f5ea', fontSize: 12 }}>{fmtN(totals.netPay)}</td>
                  <td style={{ ...tdTotal, background: '#f0f4ff', color: '#1a365d' }}>{fmtN(totals.netPay)}</td>
                  {isPrinting && <td style={tdTotal} />}
                  <td style={tdTotal} className="no-print" />
                </tr>
              </tbody>
            </table>
          </Box>
        </ScrollArea>

        {/* FOOTER STATS */}
        <Box px="md" py="xs" style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }} className="no-print">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="xs" c="dimmed">
              Period: <strong>{fromDate ? dayjs(fromDate).format('DD MMM YYYY') : '—'} – {toDate ? dayjs(toDate).format('DD MMM YYYY') : '—'}</strong>
              &nbsp;· Cycle: <strong>{settingsDays} days</strong>
            </Text>
            <Group gap="sm" wrap="nowrap">
              <Badge color="blue"   variant="light" size="sm">Producers: {filledRows.length}</Badge>
              <Badge color="green"  variant="light" size="sm">Paid: {paidRows.length}</Badge>
              <Badge color="orange" variant="light" size="sm">Unlocked: {unlockedRows.length}</Badge>
              <Badge color="violet" variant="light" size="sm">Locked: {lockedRows.length}</Badge>
              <Badge color="teal"   variant="filled" size="sm">Net Pay: ₹{fmtN(totals.netPay)}</Badge>
            </Group>
          </Group>
          {rows.length > 0 && (
            <Group justify="space-between" align="center" mt="xs">
              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">Rows per page:</Text>
                <Select
                  size="xs"
                  value={String(pageSize)}
                  onChange={v => { setPageSize(Number(v)); setPage(1); }}
                  data={['10','20','30','50','100']}
                  styles={{ input: { width: 64, fontSize: 12 } }}
                />
                <Text size="xs" c="dimmed">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length}
                </Text>
              </Group>
              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                size="xs"
                radius="sm"
                color="blue"
              />
            </Group>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentRegisterLedger;
