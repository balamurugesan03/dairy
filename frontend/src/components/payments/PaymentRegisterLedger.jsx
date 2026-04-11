import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Container, Paper, Grid, Group, Text, Title, Box,
  TextInput, NumberInput, Checkbox, ScrollArea, Badge,
  Divider, Button, Loader,
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
   COMPONENT
════════════════════════════════════════════════════════════ */
const PaymentRegisterLedger = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();
  const [searchParams] = useSearchParams();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Payment Register Ledger',
    pageStyle: `
      @page { size: A3 landscape; margin: 8mm; }
      body { font-size: 10px; }
      * { overflow: visible !important; max-height: none !important; }
      .no-print { display: none !important; }
      .print-show { display: table-cell !important; }
      .print-header { display: block !important; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #999; padding: 3px 4px; font-size: 9px; }
    `,
  });

  /* ─── header state ─── */
  const [fromDate,      setFromDate]      = useState(null);
  const [toDate,        setToDate]        = useState(null);
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [settingsDays,  setSettingsDays]  = useState(15);

  /* ─── data state ─── */
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [quantityUnit, setQuantityUnit] = useState('Litre');

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
      }).catch(() => {
        setFromDate(dayjs(paramFrom).toDate());
        setToDate(dayjs(paramTo).toDate());
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

      let from, to;
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
      setFromDate(dayjs().startOf('month').toDate());
      setToDate(dayjs().startOf('month').add(14, 'day').toDate());
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

      // Fetch milk data, welfare rule, and existing payments all in parallel.
      // Payments: query without period filter (avoid UTC/IST mismatch) — period overlap checked below.
      const [res, welfareAmt, pmtRes] = await Promise.all([
        paymentRegisterAPI.generateProducers({ fromDate: fd, toDate: td }),
        getWelfareAmount(),
        paymentAPI.getAll({ limit: 1000 }),
      ]);
      const entries  = res?.data?.entries || [];
      const payments = pmtRes?.data || [];

      // Use YYYY-MM-DD string comparison — avoids IST/UTC midnight shift ambiguity.
      // Exact overlap: payment must share at least one day with the displayed cycle.
      const cycleFromStr = dayjs(from).format('YYYY-MM-DD');
      const cycleToStr   = dayjs(to).format('YYYY-MM-DD');

      // Build farmerId → FarmerPayment map filtered to the current displayed period.
      // Prefer Ledger-paid over BankTransfer-pending when a farmer has both.
      const pmtMap = {};
      payments.forEach(pmt => {
        const fid = pmt.farmerId?._id?.toString() || pmt.farmerId?.toString() || '';
        if (!fid) return;

        // Skip payments whose period does not overlap with the displayed cycle
        const pmtFrom = pmt.paymentPeriod?.fromDate ? dayjs(pmt.paymentPeriod.fromDate) : null;
        const pmtTo   = pmt.paymentPeriod?.toDate   ? dayjs(pmt.paymentPeriod.toDate)   : null;
        if (pmtFrom && pmtTo) {
          const pmtFromStr = pmtFrom.format('YYYY-MM-DD');
          const pmtToStr   = pmtTo.format('YYYY-MM-DD');
          // no overlap: payment ended before cycle starts OR payment started after cycle ends
          if (pmtToStr < cycleFromStr || pmtFromStr > cycleToStr) return;
        }

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
        const mapped = entries.map((e, i) => {
          let row = toRow(e, i);
          // Apply welfare from PeriodicalRule if backend returned 0
          if (!n(row.welfare) && welfareAmt > 0) row = recalc({ ...row, welfare: welfareAmt });
          // Apply previous cycle carry-forward (prevBalance, cfAdv, cashAdv, loanAdv)
          row = applyPrevCycle(row);
          // Merge existing individual payment data
          return mergePayment(row);
        });
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
          const mapped = openings.map((o, i) => {
            let row = openingToRow(o, i);
            if (!n(row.welfare) && welfareAmt > 0) row = recalc({ ...row, welfare: welfareAmt });
            row = applyPrevCycle(row);
            return mergePayment(row);
          });
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

  /* ─── Row update ─── */
  const updateRow = (idx, field, value) => {
    setRows(prev => {
      const next = [...prev];
      next[idx]  = recalc({ ...next[idx], [field]: value });
      return next;
    });
  };

  /* ─── Toggle lock state per row (UI-only — no API call) ─── */
  const toggleLock = (idx) => {
    setRows(prev => {
      const next = [...prev];
      if (next[idx].paid || next[idx].bankPending) return next; // already saved, cannot unlock
      next[idx] = { ...next[idx], locked: !next[idx].locked };
      return next;
    });
  };

  /* Toggle pay mode (Bank/Cash — mutually exclusive checkbox) */
  const togglePayMode = (idx, mode) => {
    setRows(prev => {
      const next = [...prev];
      next[idx]  = { ...next[idx], payMode: next[idx].payMode === mode ? '' : mode };
      return next;
    });
  };

  /* Select ALL rows' pay mode at once */
  const selectAllPayMode = (mode) => {
    setRows(prev => prev.map(r =>
      r.producerName?.trim() ? { ...r, payMode: r.payMode === mode ? '' : mode } : r
    ));
  };

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

  const savePayment = async () => {
    if (filledRows.length === 0) {
      notifications.show({ title: 'No Data', message: 'Generate the register first', color: 'orange' });
      return;
    }

    // Rows not yet locked or individually paid
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

    setSaving(true);
    const periodFrom = fromDate;
    const periodTo   = toDate;

    // Rows to create FarmerPayment for: locked by user, not yet individually paid or bank-pending
    const toSave = filledRows.filter(r => r.locked && !r.paid && !r.bankPending);

    let done = 0;
    const savedFarmerIds = new Set();

    for (const row of toSave) {
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

        await paymentAPI.create({
          farmerId:        row.farmerId,
          farmerName:      row.producerName || '',
          paymentDate:     new Date(),
          paymentPeriod:   { fromDate: periodFrom, toDate: periodTo, periodType: 'Custom' },
          milkAmount:      n(row.milkValue),
          previousBalance: n(row.prevBalance),
          bonuses,
          deductions,
          paidAmount:      0,                        // no amount paid yet — goes to Bank Transfer
          paymentMode:     row.payMode || 'Cash',    // cash/bank stored for Bank Transfer sorting
          paymentSource:   'BankTransfer',           // all locked rows go to Bank Transfer module
          remarks:         `Payment Register — ${dayjs(periodFrom).format('DD/MM')}–${dayjs(periodTo).format('DD/MM/YYYY')}`,
        });
        savedFarmerIds.add(row.farmerId);
        done++;
      } catch (err) {
        console.error('FarmerPayment create failed:', row.producerName, err.message);
      }
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

    setSaving(false);

    if (done === 0 && toSave.length > 0) {
      notifications.show({ title: 'Save Failed', message: 'Could not queue payments for bank transfer', color: 'red' });
      return;
    }

    // Store carry-forward data for next cycle
    storeCycleData(filledRows);

    // Advance to next cycle
    const nextFrom = dayjs(periodTo).add(1, 'day').toDate();
    const nextTo   = dayjs(nextFrom).add(settingsDays - 1, 'day').toDate();
    setFromDate(nextFrom);
    setToDate(nextTo);
    setRows([]);
    setDateConfirmed(false);

    notifications.show({
      title:   'Payment Saved',
      message: `${done > 0 ? `${done} farmer(s) queued for Bank Transfer. ` : 'All individually paid. '}Next cycle: ${dayjs(nextFrom).format('DD/MM/YYYY')} – ${dayjs(nextTo).format('DD/MM/YYYY')}`,
      color:   'teal',
      icon:    <IconCheck size={14} />,
      autoClose: 6000,
    });

    await loadData(nextFrom, nextTo, false);
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

  /* ════════════════ RENDER ════════════════ */
  return (
    <Container fluid p="md" style={{ background: '#f0f2f5', minHeight: '100vh' }}>
      <style>{`@media print { .no-print { display: none !important; } .print-show { display: table-cell !important; } .print-header { display: block !important; } }`}</style>

      {/* ── HEADER ── */}
      <Paper withBorder shadow="sm" p="md" mb="md" style={{ background: '#fff' }} className="no-print">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Group gap="xs" align="center">
              <IconFileSpreadsheet size={22} color="#2c5282" />
              <Title order={3} style={{ color: '#1a365d', letterSpacing: 0.3 }}>
                Payment Register — Detailed Ledger
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
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <DateInput
              label="To Date"
              value={toDate}
              onChange={handleToDateChange}
              leftSection={<IconCalendar size={14} />}
              minDate={fromDate || undefined}
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
          <Box style={{ minWidth: 2000 }}>
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
                {/* Bank */}<col style={{ width: 38 }} />
                {/* Cash */}<col style={{ width: 38 }} />
                {/* Cheque */}<col style={{ width: 44 }} />
                {/* Paid Amt */}<col style={{ width: 72 }} />
                {/* Signature */}<col style={{ width: 90 }} />
                {/* Apply */}<col style={{ width: 48 }} />
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
                  <th style={thSection('#1a4731')} colSpan={4}>PAYMENT</th>
                  {/* Print-only */}
                  <th style={{ ...thSection('#2d3748'), display: 'none' }} className="print-show" rowSpan={2}>Signature</th>
                  {/* Screen only */}
                  <th style={thSection('#276749')} rowSpan={2} className="no-print">Lock</th>
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
                  {/* Payment sub — header checkboxes select all rows */}
                  <th style={thCol('#276749')}>
                    <Group justify="center" gap={2} align="center">
                      <Checkbox
                        size="xs"
                        color="blue"
                        checked={filledRows.length > 0 && filledRows.every(r => r.payMode === 'Bank')}
                        onChange={() => selectAllPayMode('Bank')}
                        title="Select Bank for all"
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                      <Text size={9} fw={700} c="white">Bank</Text>
                    </Group>
                  </th>
                  <th style={thCol('#276749')}>
                    <Group justify="center" gap={2} align="center">
                      <Checkbox
                        size="xs"
                        color="green"
                        checked={filledRows.length > 0 && filledRows.every(r => r.payMode === 'Cash')}
                        onChange={() => selectAllPayMode('Cash')}
                        title="Select Cash for all"
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                      <Text size={9} fw={700} c="white">Cash</Text>
                    </Group>
                  </th>
                  <th style={thCol('#276749')}>
                    <Group justify="center" gap={2} align="center">
                      <Checkbox
                        size="xs"
                        color="violet"
                        checked={filledRows.length > 0 && filledRows.every(r => r.payMode === 'Cheque')}
                        onChange={() => selectAllPayMode('Cheque')}
                        title="Select Cheque for all"
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                      <Text size={9} fw={700} c="white">Cheque</Text>
                    </Group>
                  </th>
                  <th style={thCol('#1a4731')}>To Transfer</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const rowBg      = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                  const isPaid     = row.paid;
                  const isBankPend = row.bankPending;
                  const netClr = n(row.netPay) >= 0 ? '#00695c' : '#c53030';
                  const netBg  = n(row.netPay) >= 0
                    ? (idx % 2 === 0 ? '#e6fffa' : '#d4f5ee')
                    : (idx % 2 === 0 ? '#fff5f5' : '#fde8e8');

                  return (
                    <tr key={idx} style={{ background: isBankPend ? '#ebf8ff' : isPaid ? '#f0fff4' : row.locked ? '#f0fff4' : rowBg }}>

                      {/* SN */}
                      <td style={td({ background: '#f7fafc', fontSize: 11, fontWeight: 600, color: '#718096' })}>
                        {row.sn}
                      </td>

                      {/* Producer ID */}
                      <td style={td({ fontSize: 10, color: '#4a5568', padding: '0 4px' })}>
                        {row.producerId}
                      </td>

                      {/* Producer Name */}
                      <td style={td({ textAlign: 'left', fontSize: 11, color: '#1a202c', padding: '0 5px', fontWeight: 500 })}>
                        {row.producerName}
                      </td>

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

                      {/* Other Earnings — editable unless locked */}
                      <td style={td({ background: '#f0fff4' })}>
                        {(isPaid || row.locked)
                          ? <NumberInput {...numPropsRO()} value={row.otherEarnings} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#276749', width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.otherEarnings} placeholder="0.00"
                              onChange={(v) => updateRow(idx, 'otherEarnings', v)}
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#276749', width: '100%', ...EDIT_STYLE } }} />
                        }
                      </td>

                      {/* Total Earnings — auto */}
                      <td style={td({ background: '#e6fffa' })}>
                        <NumberInput {...numPropsRO()} value={row.totalEarnings} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#276749', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Welfare — editable unless locked */}
                      <td style={td({ background: '#fff3cd' })}>
                        {(isPaid || row.locked)
                          ? <NumberInput {...numPropsRO()} value={row.welfare} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#92400e', width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.welfare} placeholder="0"
                              onChange={(v) => updateRow(idx, 'welfare', v)}
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#92400e', width: '100%' } }} />
                        }
                      </td>

                      {/* CF Advance — read-only */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numPropsRO()} value={row.cfAdv} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#7b341e', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* CF Recovery — EDITABLE (locked when paid or user-locked) */}
                      <td style={td({ background: '#fff9f0' })}>
                        {(isPaid || row.locked)
                          ? <NumberInput {...numPropsRO()} value={row.cfRec} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.cfRec}
                              onChange={(v) => updateRow(idx, 'cfRec', v)} placeholder="0.00"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', ...EDIT_STYLE } }} />
                        }
                      </td>

                      {/* Cash Advance — read-only */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numPropsRO()} value={row.cashAdv} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#7b341e', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Cash Recovery — EDITABLE (locked when paid or user-locked) */}
                      <td style={td({ background: '#fff9f0' })}>
                        {(isPaid || row.locked)
                          ? <NumberInput {...numPropsRO()} value={row.cashRec} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.cashRec}
                              onChange={(v) => updateRow(idx, 'cashRec', v)} placeholder="0.00"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', ...EDIT_STYLE } }} />
                        }
                      </td>

                      {/* Loan Advance — read-only */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numPropsRO()} value={row.loanAdv} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#7b341e', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Loan Recovery — EDITABLE (locked when paid or user-locked) */}
                      <td style={td({ background: '#fff9f0' })}>
                        {(isPaid || row.locked)
                          ? <NumberInput {...numPropsRO()} value={row.loanRec} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.loanRec}
                              onChange={(v) => updateRow(idx, 'loanRec', v)} placeholder="0.00"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', ...EDIT_STYLE } }} />
                        }
                      </td>

                      {/* Other Deductions — editable unless locked */}
                      <td style={td({ background: '#fffaf0' })}>
                        {(isPaid || row.locked)
                          ? <NumberInput {...numPropsRO()} value={row.otherDed} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.otherDed} placeholder="0.00"
                              onChange={(v) => updateRow(idx, 'otherDed', v)}
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, width: '100%', ...EDIT_STYLE } }} />
                        }
                      </td>

                      {/* Total Deductions — auto */}
                      <td style={td({ background: '#ffe0b2' })}>
                        <NumberInput {...numPropsRO()} value={row.totalDed} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#7b341e', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Net Pay — auto */}
                      <td style={td({ background: netBg })}>
                        <NumberInput {...numPropsRO()} value={row.netPay} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: netClr, width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Bank checkbox */}
                      <td style={td({ background: '#f0fff4', padding: '0 4px' })}>
                        <Group justify="center" align="center" style={{ height: 28 }} gap={4}>
                          <Checkbox
                            size="xs"
                            label={<Text size={9} fw={600}>Bk</Text>}
                            checked={row.payMode === 'Bank'}
                            onChange={() => !(isPaid || row.locked) && togglePayMode(idx, 'Bank')}
                            color="blue"
                            disabled={isPaid || row.locked}
                          />
                        </Group>
                      </td>

                      {/* Cash checkbox */}
                      <td style={td({ background: '#f0fff4', padding: '0 2px' })}>
                        <Group justify="center" align="center" style={{ height: 28 }} gap={2}>
                          <Checkbox size="xs" label={<Text size={9} fw={600}>Ca</Text>}
                            checked={row.payMode === 'Cash'}
                            onChange={() => !(isPaid || row.locked) && togglePayMode(idx, 'Cash')}
                            color="green" disabled={isPaid || row.locked} />
                        </Group>
                      </td>

                      {/* Cheque checkbox */}
                      <td style={td({ background: '#f0fff4', padding: '0 2px' })}>
                        <Group justify="center" align="center" style={{ height: 28 }} gap={2}>
                          <Checkbox size="xs" label={<Text size={9} fw={600}>Chq</Text>}
                            checked={row.payMode === 'Cheque'}
                            onChange={() => !(isPaid || row.locked) && togglePayMode(idx, 'Cheque')}
                            color="violet" disabled={isPaid || row.locked} />
                        </Group>
                      </td>

                      {/* Net Pay (reference — transfer amount going to Bank Transfer) */}
                      <td style={td({ background: '#f0f4ff' })}>
                        <NumberInput {...numPropsRO()} value={row.netPay} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 600, color: '#1a365d', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Signature — print-only */}
                      <td style={{ ...td(), display: 'none' }} className="print-show">
                        <TextInput
                          variant="unstyled" size="xs"
                          value={row.signature}
                          onChange={(e) => !(isPaid || row.locked) && updateRow(idx, 'signature', e.target.value)}
                          readOnly={isPaid || row.locked}
                          placeholder="Sign."
                          styles={{ input: { fontSize: 10, height: 26, padding: '0 4px', borderBottom: '1px dashed #cbd5e0', fontStyle: 'italic', width: '100%' } }}
                        />
                      </td>

                      {/* Lock checkbox — screen only; replaces old Apply button */}
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
                                onChange={() => toggleLock(idx)}
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
                })}

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
                  <td colSpan={3} style={tdTotal} className="no-print" />
                  <td style={{ ...tdTotal, background: '#f0f4ff', color: '#1a365d' }}>{fmtN(totals.netPay)}</td>
                  <td style={tdTotal} className="print-show" />
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
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentRegisterLedger;
