import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Container, Paper, Grid, Group, Text, Title, Box,
  TextInput, NumberInput, Checkbox, ScrollArea, Badge,
  Divider, Button, Loader, ActionIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconPrinter, IconRefresh, IconFileSpreadsheet,
  IconDownload, IconCheck, IconDeviceFloppy,
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
  paid:          false,
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

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Payment Register Ledger',
    pageStyle: `
      @media print {
        body { font-size: 10px; }
        @page { size: A3 landscape; margin: 8mm; }
        .no-print { display: none !important; }
        .print-show { display: table-cell !important; }
      }
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
  const [applying,     setApplying]     = useState({});
  const [quantityUnit, setQuantityUnit] = useState('Litre');

  /* ─── Load settings on mount → set dates only, no auto-load ─── */
  useEffect(() => {
    Promise.all([dairySettingsAPI.get(), milkPurchaseSettingsAPI.getSummary()])
      .then(([dsRes, msRes]) => {
        const s    = dsRes?.data || dsRes || {};
        const days = s.paymentDays || 15;
        setSettingsDays(days);
        setQuantityUnit(msRes?.data?.quantityUnit || 'Litre');
        let from, to;
        if (s.paymentFromDate) {
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
      paidAmount:    '',    // user types amount manually
      signature:     '',
      paid:          false,
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
      paidAmount:    '',    // user types amount manually
      signature:     '',
      paid:          false,
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

      // Fetch milk data, welfare rule, and existing payments all in parallel
      const [res, welfareAmt, pmtRes] = await Promise.all([
        paymentRegisterAPI.generateProducers({ fromDate: fd, toDate: td }),
        getWelfareAmount(),
        paymentAPI.getAll({ periodFrom: fd, periodTo: td, limit: 500 }),
      ]);
      const entries  = res?.data?.entries || [];
      const payments = pmtRes?.data || [];

      // Build farmerId → FarmerPayment map (most recent payment per farmer)
      const pmtMap = {};
      payments.forEach(pmt => {
        const fid = pmt.farmerId?._id?.toString() || pmt.farmerId?.toString() || '';
        if (fid && !pmtMap[fid]) pmtMap[fid] = pmt; // take first (most recent)
      });

      // Helper: extract deduction amount by type from a FarmerPayment
      const getDed = (pmt, ...types) =>
        (pmt?.deductions || [])
          .filter(d => types.includes(d.type))
          .reduce((s, d) => s + (d.amount || 0), 0);

      // Merge a row with its existing FarmerPayment (if any)
      const mergePayment = (row) => {
        const pmt = pmtMap[row.farmerId];
        if (!pmt) return row;
        return recalc({
          ...row,
          cfRec:      getDed(pmt, 'CF Recovery', 'CF Advance')   || row.cfRec,
          cashRec:    getDed(pmt, 'Cash Recovery', 'Cash Advance') || row.cashRec,
          loanRec:    getDed(pmt, 'Loan Recovery', 'Loan Advance', 'Loan EMI') || row.loanRec,
          welfare:    getDed(pmt, 'Welfare Recovery') || row.welfare,
          paidAmount: pmt.paidAmount || row.paidAmount,
          paid:       pmt.status === 'Paid' || pmt.status === 'Partial',
        });
      };

      if (entries.length > 0) {
        const mapped = entries.map((e, i) => {
          let row = toRow(e, i);
          // Apply welfare from PeriodicalRule if backend returned 0
          if (!n(row.welfare) && welfareAmt > 0) row = recalc({ ...row, welfare: welfareAmt });
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
  const advanceCycle = useCallback(() => {
    const nextFrom = dayjs(toDate).add(1, 'day').toDate();
    const nextTo   = dayjs(nextFrom).add(settingsDays - 1, 'day').toDate();
    setFromDate(nextFrom);
    setToDate(nextTo);
    setRegisterId(null);
    setDateConfirmed(false);
    // Keep farmer rows — reset amounts only, preserve farmerId/producerId/producerName
    setRows(prev => prev
      .filter(r => r.producerName?.trim())
      .map((r, i) => ({
        sn:            i + 1,
        _entryId:      '',
        farmerId:      r.farmerId,
        producerId:    r.producerId,
        producerName:  r.producerName,
        qty:           '',
        milkValue:     '',
        prevBalance:   '',
        otherEarnings: '',
        totalEarnings: '',
        welfare:       '',
        cfAdv:         '',
        cfRec:         '',
        cashAdv:       '',
        cashRec:       '',
        loanAdv:       '',
        loanRec:       '',
        otherDed:      '',
        totalDed:      '',
        netPay:        '',
        payMode:       'Cash',
        paidAmount:    '',
        signature:     '',
        paid:          false,
      }))
    );
    notifications.show({
      title:   'Cycle Advanced',
      message: `Next period: ${dayjs(nextFrom).format('DD/MM/YYYY')} – ${dayjs(nextTo).format('DD/MM/YYYY')}`,
      color:   'blue',
    });
  }, [toDate, settingsDays]);

  /* ─── Build payment payload for a row ─── */
  const buildPayload = (row) => {
    const deductions = [];
    // cfAdv/cashAdv/loanAdv are reference-only — NOT included as deductions
    // Only Rec (recovery) amounts + welfare + otherDed are actual deductions
    if (n(row.welfare)  > 0) deductions.push({ type: 'Welfare Recovery', amount: n(row.welfare),  description: 'Welfare' });
    if (n(row.cfRec)    > 0) deductions.push({ type: 'CF Recovery',      amount: n(row.cfRec),    description: 'CF Recovery' });
    if (n(row.cashRec)  > 0) deductions.push({ type: 'Cash Recovery',    amount: n(row.cashRec),  description: 'Cash Recovery' });
    if (n(row.loanRec)  > 0) deductions.push({ type: 'Loan Recovery',    amount: n(row.loanRec),  description: 'Loan Recovery' });
    if (n(row.otherDed) > 0) deductions.push({ type: 'Other',            amount: n(row.otherDed), description: 'Other' });
    const bonuses = n(row.otherEarnings) > 0
      ? [{ type: 'Other', amount: n(row.otherEarnings), description: 'Other Earnings' }]
      : [];
    return {
      farmerId:        row.farmerId,
      farmerName:      row.producerName || '',
      paymentDate:     new Date(),
      paymentPeriod:   { fromDate, toDate, periodType: 'Custom' },
      milkAmount:      n(row.milkValue),
      previousBalance: n(row.prevBalance),
      bonuses,
      deductions,
      paidAmount:      n(row.paidAmount) || n(row.netPay),
      paymentMode:     row.payMode || 'Cash',
      remarks:         `Ledger — ${dayjs(fromDate).format('DD/MM')}–${dayjs(toDate).format('DD/MM/YYYY')}`,
    };
  };

  /* ─── Apply Payment per row ─── */
  const applyPayment = async (idx) => {
    const row = rows[idx];
    if (!row.farmerId) {
      notifications.show({ title: 'Error', message: 'No farmer ID', color: 'red' }); return;
    }
    if (n(row.netPay) <= 0) {
      notifications.show({ title: 'Warning', message: 'Net payable is 0 or negative', color: 'orange' }); return;
    }
    setApplying(prev => ({ ...prev, [idx]: true }));
    try {
      await paymentAPI.create(buildPayload(row));
      setRows(prev => prev.map((r, i) =>
        i === idx ? { ...r, paid: true, payMode: r.payMode || 'Cash' } : r
      ));
      notifications.show({
        title:   'Payment Applied',
        message: `${row.producerName} — ₹${(n(row.paidAmount) || n(row.netPay)).toFixed(2)} (${row.payMode || 'Cash'})`,
        color:   'green',
        icon:    <IconCheck size={14} />,
        autoClose: 3000,
      });
    } catch (err) {
      notifications.show({ title: 'Failed', message: err.message, color: 'red' });
    } finally {
      setApplying(prev => ({ ...prev, [idx]: false }));
    }
  };

  /* ─── Apply ALL unpaid rows ─── */
  const [applyingAll, setApplyingAll] = useState(false);
  const applyAllPayments = async () => {
    const unpaid = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.paid && r.farmerId && n(r.netPay) > 0);
    if (unpaid.length === 0) {
      notifications.show({ title: 'Nothing to Apply', message: 'All rows are already applied', color: 'orange' });
      return;
    }
    setApplyingAll(true);
    let done = 0;
    for (const { r, i } of unpaid) {
      try {
        await paymentAPI.create(buildPayload(r));
        setRows(prev => prev.map((row, idx) =>
          idx === i ? { ...row, paid: true, payMode: row.payMode || 'Cash' } : row
        ));
        done++;
      } catch { /* continue */ }
    }
    setApplyingAll(false);
    notifications.show({
      title:   'All Payments Applied',
      message: `${done} of ${unpaid.length} applied`,
      color:   done === unpaid.length ? 'green' : 'orange',
      icon:    <IconCheck size={14} />,
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
      netPay: s('netPay'), paidAmount: s('paidAmount'),
    };
  }, [rows]);

  const filledRows  = rows.filter(r => r.producerName.trim());
  const paidRows    = rows.filter(r => r.paid);
  const pendingRows = filledRows.filter(r => !r.paid);

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
              color="green"
              variant="filled"
              leftSection={applyingAll ? <Loader size={12} color="white" /> : <IconCheck size={13} />}
              onClick={applyAllPayments}
              disabled={applyingAll || !dateConfirmed || pendingRows.length === 0}
            >
              {applyingAll ? 'Applying…' : `Apply All (${pendingRows.length})`}
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
      <Paper ref={printRef} withBorder shadow="sm" style={{ background: '#fff', overflow: 'hidden' }}>

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
                  <th style={thSection('#2d3748')} rowSpan={2} className="no-print">Apply</th>
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
                  <th style={thCol('#1a4731')}>Paid Amt</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const rowBg  = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                  const isPaid = row.paid;
                  const netClr = n(row.netPay) >= 0 ? '#00695c' : '#c53030';
                  const netBg  = n(row.netPay) >= 0
                    ? (idx % 2 === 0 ? '#e6fffa' : '#d4f5ee')
                    : (idx % 2 === 0 ? '#fff5f5' : '#fde8e8');

                  return (
                    <tr key={idx} style={{ background: isPaid ? '#f0fff4' : rowBg }}>

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

                      {/* Other Earnings */}
                      <td style={td({ background: '#f0fff4' })}>
                        <NumberInput {...numPropsRO()} value={row.otherEarnings} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#276749', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Total Earnings — auto */}
                      <td style={td({ background: '#e6fffa' })}>
                        <NumberInput {...numPropsRO()} value={row.totalEarnings} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#276749', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* Welfare — always editable */}
                      <td style={td({ background: '#fff3cd' })}>
                        <NumberInput {...numProps()} value={row.welfare} placeholder="0"
                          onChange={(v) => updateRow(idx, 'welfare', v)}
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#92400e', width: '100%' } }} />
                      </td>

                      {/* CF Advance — read-only */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numPropsRO()} value={row.cfAdv} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#7b341e', width: '100%', cursor: 'default' } }} />
                      </td>

                      {/* CF Recovery — EDITABLE (locked when paid) */}
                      <td style={td({ background: '#fff9f0' })}>
                        {isPaid
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

                      {/* Cash Recovery — EDITABLE (locked when paid) */}
                      <td style={td({ background: '#fff9f0' })}>
                        {isPaid
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

                      {/* Loan Recovery — EDITABLE (locked when paid) */}
                      <td style={td({ background: '#fff9f0' })}>
                        {isPaid
                          ? <NumberInput {...numPropsRO()} value={row.loanRec} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.loanRec}
                              onChange={(v) => updateRow(idx, 'loanRec', v)} placeholder="0.00"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#c05621', width: '100%', ...EDIT_STYLE } }} />
                        }
                      </td>

                      {/* Other Deductions — read-only */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numPropsRO()} value={row.otherDed} placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, width: '100%', cursor: 'default' } }} />
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
                            onChange={() => !isPaid && togglePayMode(idx, 'Bank')}
                            color="blue"
                            disabled={isPaid}
                          />
                        </Group>
                      </td>

                      {/* Cash checkbox */}
                      <td style={td({ background: '#f0fff4', padding: '0 2px' })}>
                        <Group justify="center" align="center" style={{ height: 28 }} gap={2}>
                          <Checkbox size="xs" label={<Text size={9} fw={600}>Ca</Text>}
                            checked={row.payMode === 'Cash'}
                            onChange={() => !isPaid && togglePayMode(idx, 'Cash')}
                            color="green" disabled={isPaid} />
                        </Group>
                      </td>

                      {/* Cheque checkbox */}
                      <td style={td({ background: '#f0fff4', padding: '0 2px' })}>
                        <Group justify="center" align="center" style={{ height: 28 }} gap={2}>
                          <Checkbox size="xs" label={<Text size={9} fw={600}>Chq</Text>}
                            checked={row.payMode === 'Cheque'}
                            onChange={() => !isPaid && togglePayMode(idx, 'Cheque')}
                            color="violet" disabled={isPaid} />
                        </Group>
                      </td>

                      {/* Paid Amount — user types manually */}
                      <td style={td({ background: '#f0f4ff' })}>
                        {isPaid
                          ? <NumberInput {...numPropsRO()} value={row.paidAmount} placeholder="—"
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 600, color: '#1a365d', width: '100%', cursor: 'default' } }} />
                          : <NumberInput {...numProps()} value={row.paidAmount} placeholder="0.00"
                              onChange={(v) => updateRow(idx, 'paidAmount', v)}
                              styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 600, color: '#1a365d', width: '100%' } }} />
                        }
                      </td>

                      {/* Signature — print-only */}
                      <td style={{ ...td(), display: 'none' }} className="print-show">
                        <TextInput
                          variant="unstyled" size="xs"
                          value={row.signature}
                          onChange={(e) => !isPaid && updateRow(idx, 'signature', e.target.value)}
                          readOnly={isPaid}
                          placeholder="Sign."
                          styles={{ input: { fontSize: 10, height: 26, padding: '0 4px', borderBottom: '1px dashed #cbd5e0', fontStyle: 'italic', width: '100%' } }}
                        />
                      </td>

                      {/* Apply Payment — screen only */}
                      <td style={td({ padding: '0 2px' })} className="no-print">
                        {isPaid ? (
                          <Group justify="center" gap={2} wrap="nowrap">
                            <IconCheck size={12} color="#38a169" />
                            <Text size={9} c="green" fw={600}>Paid</Text>
                          </Group>
                        ) : row.producerName.trim() ? (
                          <ActionIcon
                            size="sm" color="blue" variant="light"
                            loading={!!applying[idx]}
                            onClick={() => applyPayment(idx)}
                            title="Apply Payment"
                          >
                            <IconDeviceFloppy size={13} />
                          </ActionIcon>
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
                  <td style={{ ...tdTotal, background: '#f0f4ff', color: '#1a365d' }}>{fmtN(totals.paidAmount || totals.netPay)}</td>
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
              <Badge color="orange" variant="light" size="sm">Pending: {pendingRows.length}</Badge>
              <Badge color="teal"   variant="filled" size="sm">Net Pay: ₹{fmtN(totals.netPay)}</Badge>
            </Group>
          </Group>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentRegisterLedger;
