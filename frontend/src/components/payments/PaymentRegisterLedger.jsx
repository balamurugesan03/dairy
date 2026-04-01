import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Container, Paper, Grid, Group, Text, Title, Box,
  TextInput, NumberInput, Checkbox, ScrollArea, Badge,
  Divider, Button, Loader, Select, ActionIcon,
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
  milkCollectionAPI, paymentAPI, collectionCenterAPI,
  farmerLedgerAPI, producerOpeningAPI,
} from '../../services/api';

const TOTAL_ROWS = 25;

const initRow = (sn) => ({
  sn,
  farmerId:    '',
  producerId:  '',          // farmerNumber
  producerName: '',
  milkQty:      '',
  milkRate:     '',
  earnings:     '',         // bonus / incentive / individual earnings
  earningTotal: '',         // auto: qty*rate + earnings
  prevBalance:  '',         // previous pending balance
  gross:        '',         // auto: earningTotal + prevBalance
  cfAdv:        '',         // CF Advance deduction
  cashAdv:      '',         // Cash Advance deduction
  loan:         '',         // Loan deduction
  welfare:      '',         // Welfare Recovery
  otherDed:     '',         // other deductions
  totalDed:     '',         // auto
  netPay:       '',         // auto: gross - totalDed
  bank:         '',
  cash:         '',
  payTotal:     '',         // auto: bank + cash
  paid:         false,
  signature:    '',
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

/* ─── shared input props ─── */
const numProps = (extra = {}) => ({
  variant: 'unstyled', size: 'xs', hideControls: true, decimalScale: 2,
  styles: { input: { textAlign: 'center', fontSize: 11, height: 26, padding: '0 2px', width: '100%' } },
  ...extra,
});
const txtProps = (extra = {}) => ({
  variant: 'unstyled', size: 'xs',
  styles: { input: { textAlign: 'center', fontSize: 11, height: 26, padding: '0 2px', width: '100%' } },
  ...extra,
});

/* recalculate all auto fields for a row */
const recalc = (row) => {
  const qty   = n(row.milkQty);
  const rate  = n(row.milkRate);
  const earn  = n(row.earnings);
  const prev  = n(row.prevBalance);
  const cfAdv = n(row.cfAdv);
  const cashA = n(row.cashAdv);
  const loan  = n(row.loan);
  const welf  = n(row.welfare);
  const other = n(row.otherDed);
  const bank  = n(row.bank);
  const cash  = n(row.cash);

  const earningTotal = qty * rate + earn;
  const gross        = earningTotal + prev;
  const totalDed     = cfAdv + cashA + loan + welf + other;
  const netPay       = gross - totalDed;
  const payTotal     = bank + cash;

  return {
    ...row,
    earningTotal: earningTotal > 0 ? earningTotal : '',
    gross:        gross        !== 0 ? gross        : '',
    totalDed:     totalDed     > 0  ? totalDed     : '',
    netPay:       netPay       !== 0 ? netPay       : '',
    payTotal:     payTotal     > 0  ? payTotal      : '',
  };
};

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
const PaymentRegisterLedger = () => {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Payment Register Ledger',
    pageStyle: `
      @media print {
        body { font-size: 10px; }
        @page { size: A3 landscape; margin: 10mm; }
      }
    `,
  });

  /* ─── header state ─── */
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate,   setToDate]   = useState(dayjs().endOf('month').toDate());
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [center,   setCenter]   = useState('');
  const [group,    setGroup]    = useState('');
  const [page,     setPage]     = useState('1');

  /* ─── data state ─── */
  const [rows,    setRows]    = useState(() => Array.from({ length: TOTAL_ROWS }, (_, i) => initRow(i + 1)));
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState({}); // rowIdx -> bool

  /* ─── Load collection centers once ─── */
  useEffect(() => {
    collectionCenterAPI.getAll({ limit: 200 }).then(res => {
      const list = res?.data || res || [];
      setCenters([
        { value: '', label: 'All Centers' },
        ...list.map(c => ({ value: c._id, label: c.centerName || c.name || '' })),
      ]);
    }).catch(() => {});
  }, []);

  /* ─── Cycle preset ─── */
  const handleCycleSelect = (cycle) => {
    setSelectedCycle(cycle);
    setDateConfirmed(false);
    const from = fromDate || new Date();
    let to;
    if (cycle === '7d')       to = dayjs(from).add(6, 'day').toDate();
    else if (cycle === '10d') to = dayjs(from).add(9, 'day').toDate();
    else if (cycle === '15d') to = dayjs(from).add(14, 'day').toDate();
    else if (cycle === '1m')  to = dayjs(from).add(1, 'month').subtract(1, 'day').toDate();
    setToDate(to);
  };

  const handleFromDateChange = (v) => { setFromDate(v); setDateConfirmed(false); };
  const handleToDateChange   = (v) => { setToDate(v);   setDateConfirmed(false); };

  /* ─── Load Data (= OK + fetch) ─── */
  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate) {
      notifications.show({ title: 'Select Dates', message: 'Please select both From and To dates', color: 'orange' });
      return;
    }
    setDateConfirmed(true);
    setLoading(true);
    try {
      const fd = dayjs(fromDate).format('YYYY-MM-DD');
      const td = dayjs(toDate).format('YYYY-MM-DD');

      /* 1. Milk summary per farmer */
      const milkRes  = await milkCollectionAPI.getFarmerWiseSummary({
        fromDate: fd, toDate: td,
        ...(center ? { collectionCenter: center } : {}),
      });
      const milkRows = milkRes.data || milkRes || [];

      /* 2. Payments in period — deduction breakdown + mode */
      const payRes   = await paymentAPI.getAll({ fromDate: fd, toDate: td, limit: 2000 });
      const payments = payRes.data || payRes?.payments || [];

      /* Aggregate by farmerId */
      const payMap = {};
      payments.forEach((p) => {
        const fid = p.farmerId?._id?.toString() || p.farmerId?.toString();
        if (!fid) return;
        if (!payMap[fid]) payMap[fid] = { cfAdv: 0, cashAdv: 0, loan: 0, welfare: 0, other: 0, bank: 0, cash: 0 };
        (p.deductions || []).forEach((d) => {
          const t = (d.type || '').toLowerCase();
          if      (t.includes('cf'))      payMap[fid].cfAdv   += d.amount || 0;
          else if (t.includes('cash'))    payMap[fid].cashAdv += d.amount || 0;
          else if (t.includes('loan'))    payMap[fid].loan    += d.amount || 0;
          else if (t.includes('welfare')) payMap[fid].welfare += d.amount || 0;
          else                            payMap[fid].other   += d.amount || 0;
        });
        const mode = (p.paymentMode || '').toLowerCase();
        if (mode.includes('bank') || mode.includes('cheque') || mode.includes('upi')) {
          payMap[fid].bank += p.paidAmount || 0;
        } else {
          payMap[fid].cash += p.paidAmount || 0;
        }
      });

      /* 3. Previous balance (pending FarmerPayments BEFORE fromDate) */
      const prevPayRes = await paymentAPI.getAll({ limit: 5000 });
      const allPay = prevPayRes.data || prevPayRes?.payments || [];
      const prevMap = {};
      allPay
        .filter(p => (p.status === 'Pending' || p.status === 'Partial') &&
                     new Date(p.paymentDate) < new Date(fromDate))
        .forEach(p => {
          const fid = p.farmerId?._id?.toString() || p.farmerId?.toString();
          if (!fid) return;
          prevMap[fid] = (prevMap[fid] || 0) + (p.balanceAmount || 0);
        });

      /* 3b. Producer Opening balances — dueAmount → prevBalance, deductions → deduction cols */
      const openingRes = await producerOpeningAPI.getAll({ limit: 2000 });
      const openings   = openingRes.data || [];
      const openingMap = {}; // farmerId → { dueAmount, cfAdvance, loanAdvance, cashAdvance, revolvingFund }
      openings.forEach(o => {
        const fid = o.farmerId?._id?.toString() || o.farmerId?.toString();
        if (!fid) return;
        openingMap[fid] = {
          dueAmount:     Number(o.dueAmount)     || 0,
          cfAdvance:     Number(o.cfAdvance)     || 0,
          loanAdvance:   Number(o.loanAdvance)   || 0,
          cashAdvance:   Number(o.cashAdvance)   || 0,
          revolvingFund: Number(o.revolvingFund) || 0,
        };
      });

      /* 4. Welfare amount from periodical rule (single call, applied to all) */
      let welfareAmt = 0;
      try {
        // Use first farmer just to get the periodical rule amount
        if (milkRows.length > 0 && milkRows[0].farmerId) {
          const wRes = await farmerLedgerAPI.checkWelfare(
            milkRows[0].farmerId.toString(),
            fd, fd, td
          );
          welfareAmt = wRes?.data?.amount || 0;
        }
      } catch {}

      /* Build rows */
      const filter = group.trim().toLowerCase();
      const newRows = milkRows
        .filter(m => !filter || (m.farmerName || '').toLowerCase().includes(filter) ||
                                (m.farmerNumber || '').toLowerCase().includes(filter))
        .map((m, i) => {
          const fid     = m.farmerId?.toString();
          const pay     = fid ? (payMap[fid]     || {}) : {};
          const opening = fid ? (openingMap[fid] || {}) : {};
          const prev    = (fid ? (prevMap[fid] || 0) : 0) + (opening.dueAmount || 0);
          const qty     = m.totalQty    || 0;
          const rate    = m.avgRate     || 0;
          const earn    = m.totalIncentive || 0;
          const cfAdv   = (pay.cfAdv   || 0) + (opening.cfAdvance   || 0);
          const cashA   = (pay.cashAdv || 0) + (opening.cashAdvance  || 0);
          const loan    = (pay.loan    || 0) + (opening.loanAdvance  || 0);
          const welF    = pay.welfare || welfareAmt;
          const other   = (pay.other  || 0) + (opening.revolvingFund || 0);
          const bank    = pay.bank    || 0;
          const cash    = pay.cash    || 0;
          return recalc({
            sn:           i + 1,
            farmerId:     fid   || '',
            producerId:   m.farmerNumber || '',
            producerName: m.farmerName   || '',
            milkQty:      qty  || '',
            milkRate:     rate || '',
            earnings:     earn || '',
            prevBalance:  prev || '',
            cfAdv:        cfAdv || '',
            cashAdv:      cashA || '',
            loan:         loan  || '',
            welfare:      welF  || '',
            otherDed:     other || '',
            bank:         bank  || '',
            cash:         cash  || '',
            paid:         false,
            signature:    '',
          });
        });

      while (newRows.length < TOTAL_ROWS) newRows.push(initRow(newRows.length + 1));
      setRows(newRows);
      notifications.show({
        title: 'Data Loaded',
        message: `${milkRows.length} producer(s) for ${dayjs(fromDate).format('DD/MM')} – ${dayjs(toDate).format('DD/MM/YYYY')}`,
        color: 'teal',
      });
    } catch (err) {
      console.error('PaymentRegisterLedger fetchData error:', err);
      notifications.show({ title: 'Load Failed', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, center, group]);

  /* ─── Row update ─── */
  const updateRow = (idx, field, value) => {
    setRows(prev => {
      const next = [...prev];
      next[idx]  = recalc({ ...next[idx], [field]: value });
      return next;
    });
  };

  /* ─── Apply Payment per row ─── */
  const applyPayment = async (idx) => {
    const row = rows[idx];
    if (!row.farmerId) {
      notifications.show({ title: 'Error', message: 'No farmer ID for this row', color: 'red' });
      return;
    }
    const netPay = n(row.netPay);
    if (netPay <= 0) {
      notifications.show({ title: 'Warning', message: 'Net payable is 0 or negative', color: 'orange' });
      return;
    }
    setApplying(prev => ({ ...prev, [idx]: true }));
    try {
      const deductions = [];
      if (n(row.cfAdv)   > 0) deductions.push({ type: 'CF Advance',      amount: n(row.cfAdv),   description: 'CF Advance' });
      if (n(row.cashAdv) > 0) deductions.push({ type: 'Cash Advance',    amount: n(row.cashAdv), description: 'Cash Advance' });
      if (n(row.loan)    > 0) deductions.push({ type: 'Loan Advance',    amount: n(row.loan),    description: 'Loan Deduction' });
      if (n(row.welfare) > 0) deductions.push({ type: 'Welfare Recovery',amount: n(row.welfare), description: 'Welfare Recovery' });
      if (n(row.otherDed)> 0) deductions.push({ type: 'Other',           amount: n(row.otherDed),description: 'Other Deductions' });

      const bonuses = [];
      if (n(row.earnings) > 0) bonuses.push({ type: 'Other', amount: n(row.earnings), description: 'Earnings' });

      const paidAmt = n(row.bank) + n(row.cash) || netPay;
      const payMode = n(row.bank) > 0 ? 'Bank' : 'Cash';

      await paymentAPI.create({
        farmerId:       row.farmerId,
        paymentDate:    new Date(),
        paymentPeriod:  { fromDate, toDate, periodType: 'Custom' },
        milkAmount:     n(row.earningTotal),
        previousBalance: n(row.prevBalance),
        bonuses,
        deductions,
        paidAmount:     paidAmt,
        paymentMode:    payMode,
        remarks:        `Payment Register Ledger — ${dayjs(fromDate).format('DD/MM')} to ${dayjs(toDate).format('DD/MM/YYYY')}`,
      });

      updateRow(idx, 'paid', true);
      notifications.show({
        title: 'Payment Applied',
        message: `${row.producerName} — ₹${paidAmt.toFixed(2)} saved`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({ title: 'Failed', message: err.message, color: 'red' });
    } finally {
      setApplying(prev => ({ ...prev, [idx]: false }));
    }
  };

  /* ─── Reset ─── */
  const handleReset = () => {
    setRows(Array.from({ length: TOTAL_ROWS }, (_, i) => initRow(i + 1)));
    setDateConfirmed(false);
    setSelectedCycle(null);
    setFromDate(dayjs().startOf('month').toDate());
    setToDate(dayjs().endOf('month').toDate());
    setCenter(''); setGroup(''); setPage('1');
  };

  /* ─── Totals ─── */
  const totals = useMemo(() => {
    const s = (f) => rows.reduce((acc, r) => acc + n(r[f]), 0);
    return {
      milkQty: s('milkQty'), earnings: s('earnings'),
      earningTotal: s('earningTotal'), prevBalance: s('prevBalance'),
      gross: s('gross'), cfAdv: s('cfAdv'), cashAdv: s('cashAdv'),
      loan: s('loan'), welfare: s('welfare'), otherDed: s('otherDed'),
      totalDed: s('totalDed'), netPay: s('netPay'),
      bank: s('bank'), cash: s('cash'), payTotal: s('payTotal'),
    };
  }, [rows]);

  const filledRows  = rows.filter(r => r.producerName.trim());
  const paidRows    = rows.filter(r => r.paid);
  const pendingRows = filledRows.filter(r => !r.paid);

  /* ════════════════ RENDER ════════════════ */
  return (
    <Container fluid p="md" style={{ background: '#f0f2f5', minHeight: '100vh' }}>

      {/* ── HEADER ── */}
      <Paper withBorder shadow="sm" p="md" mb="md" style={{ background: '#fff' }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Group gap="xs" align="center">
              <IconFileSpreadsheet size={22} color="#2c5282" />
              <Title order={3} style={{ color: '#1a365d', letterSpacing: 0.3 }}>
                Payment Register — Detailed Ledger
              </Title>
            </Group>
            <Text size="xs" c="dimmed" mt={2}>
              Dairy Cooperative Society · Producer Payment Sheet
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              color={dateConfirmed ? 'teal' : 'blue'}
              variant={dateConfirmed ? 'filled' : 'outline'}
              leftSection={loading ? <Loader size={12} color="white" /> : <IconDownload size={13} />}
              onClick={fetchData}
              disabled={loading || !fromDate || !toDate}
            >
              {loading ? 'Generating…' : dateConfirmed ? `Generated — ${dayjs(fromDate).format('DD/MM')} – ${dayjs(toDate).format('DD/MM')}` : 'Generate'}
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

        {/* Cycle buttons */}
        <Group gap="xs" mb="xs">
          <Text size="xs" fw={600} c="dimmed">Cycle:</Text>
          {[
            { value: '7d', label: '7 Days' },
            { value: '10d', label: '10 Days' },
            { value: '15d', label: '15 Days' },
            { value: '1m',  label: '1 Month' },
          ].map(opt => (
            <Button
              key={opt.value}
              size="xs"
              variant={selectedCycle === opt.value ? 'filled' : 'outline'}
              color="teal"
              onClick={() => handleCycleSelect(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </Group>

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
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label="Collection Center"
              placeholder="All Centers"
              data={centers}
              value={center}
              onChange={(v) => { setCenter(v || ''); setDateConfirmed(false); }}
              size="sm"
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <TextInput
              label="Group / Route Filter"
              placeholder="e.g. Bangalore group, Route A…"
              value={group}
              onChange={(e) => { setGroup(e.target.value); setDateConfirmed(false); }}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3, md: 1 }}>
            <TextInput label="Page" placeholder="1" value={page} onChange={(e) => setPage(e.target.value)} size="sm" />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── LEDGER TABLE ── */}
      <Paper ref={printRef} withBorder shadow="sm" style={{ background: '#fff', overflow: 'hidden' }}>
        {/* Print-only header */}
        <Box style={{ display: 'none' }} className="print-header">
          <Title order={4} ta="center">Payment Register — Detailed Ledger</Title>
          <Text size="sm" ta="center" c="dimmed">
            Period: {dayjs(fromDate).format('DD MMM YYYY')} – {dayjs(toDate).format('DD MMM YYYY')}
            {center ? ` · Center: ${centers.find(c => c.value === center)?.label || ''}` : ''}
            {page ? ` · Page ${page}` : ''}
          </Text>
          <Divider my={4} />
        </Box>
        <style>{`@media print { .print-header { display: block !important; } }`}</style>

        <ScrollArea type="scroll" scrollbarSize={8} scrollHideDelay={0}>
          <Box style={{ minWidth: 1600 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 34 }} />
                <col style={{ width: 58 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 58 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 62 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 68 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 62 }} />
                <col style={{ width: 62 }} />
                <col style={{ width: 58 }} />
                <col style={{ width: 62 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 68 }} />
                <col style={{ width: 78 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 52 }} />
                <col style={{ width: 90 }} />
              </colgroup>

              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Row 1 — Section labels */}
                <tr>
                  <th style={thSection('#2d3748')} rowSpan={2}>SN</th>
                  <th style={thSection('#2d3748')} rowSpan={2}>Prod ID</th>
                  <th style={thSection('#2d3748')} rowSpan={2}>Producer Name</th>
                  <th style={thSection('#1a365d')} colSpan={6}>EARNING</th>
                  <th style={thSection('#744210')} colSpan={6}>DEDUCTION</th>
                  <th style={thSection('#276749')} rowSpan={2}>NET PAY</th>
                  <th style={thSection('#1a4731')} colSpan={5}>PAYMENT</th>
                </tr>
                <tr>
                  {/* Earning */}
                  {['Milk Qty','Rate','Earnings','Total','Prev Bal','Gross'].map(h => (
                    <th key={h} style={thCol('#2c5282')}>{h}</th>
                  ))}
                  {/* Deduction */}
                  {['CF Adv','Cash Adv','Loan','Welfare','Other','Total'].map(h => (
                    <th key={h} style={thCol('#975a16')}>{h}</th>
                  ))}
                  {/* Payment */}
                  {['Bank','Cash','Total','Apply','Paid ✓/Sign'].map(h => (
                    <th key={h} style={thCol('#276749')}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                  const isPaid = row.paid;
                  return (
                    <tr key={idx} style={{ background: isPaid ? '#f0fff4' : rowBg }}>

                      {/* SN */}
                      <td style={td({ background: '#f7fafc', fontSize: 11, fontWeight: 600, color: '#718096' })}>
                        {row.sn}
                      </td>

                      {/* Producer ID */}
                      <td style={td()}>
                        <TextInput
                          {...txtProps()}
                          value={row.producerId}
                          onChange={(e) => updateRow(idx, 'producerId', e.target.value)}
                          placeholder="ID"
                        />
                      </td>

                      {/* Producer Name */}
                      <td style={td()}>
                        <TextInput
                          {...txtProps({ styles: { input: { textAlign: 'left', fontSize: 11, height: 26, padding: '0 5px', width: '100%' } } })}
                          value={row.producerName}
                          onChange={(e) => updateRow(idx, 'producerName', e.target.value)}
                          placeholder="Producer name"
                        />
                      </td>

                      {/* Milk Qty */}
                      <td style={td()}>
                        <NumberInput {...numProps({ decimalScale: 1 })} value={row.milkQty}
                          onChange={(v) => updateRow(idx, 'milkQty', v)} placeholder="0.0" />
                      </td>

                      {/* Milk Rate */}
                      <td style={td()}>
                        <NumberInput {...numProps()} value={row.milkRate}
                          onChange={(v) => updateRow(idx, 'milkRate', v)} placeholder="0.00" />
                      </td>

                      {/* Earnings */}
                      <td style={td({ background: '#f0fff4' })}>
                        <NumberInput {...numProps()} value={row.earnings}
                          onChange={(v) => updateRow(idx, 'earnings', v)} placeholder="0"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, padding: '0 2px', color: '#276749', width: '100%' } }} />
                      </td>

                      {/* Earning Total — auto */}
                      <td style={td({ background: '#fffff0' })}>
                        <NumberInput {...numProps()} value={row.earningTotal} readOnly placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#1a365d', width: '100%' } }} />
                      </td>

                      {/* Prev Balance */}
                      <td style={td({ background: '#ebf8ff' })}>
                        <NumberInput {...numProps()} value={row.prevBalance}
                          onChange={(v) => updateRow(idx, 'prevBalance', v)} placeholder="0"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#2b6cb0', width: '100%' } }} />
                      </td>

                      {/* Gross — auto */}
                      <td style={td({ background: '#e6fffa' })}>
                        <NumberInput {...numProps()} value={row.gross} readOnly placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#276749', width: '100%' } }} />
                      </td>

                      {/* CF Advance */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numProps()} value={row.cfAdv}
                          onChange={(v) => updateRow(idx, 'cfAdv', v)} placeholder="0" />
                      </td>

                      {/* Cash Advance */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numProps()} value={row.cashAdv}
                          onChange={(v) => updateRow(idx, 'cashAdv', v)} placeholder="0" />
                      </td>

                      {/* Loan */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numProps()} value={row.loan}
                          onChange={(v) => updateRow(idx, 'loan', v)} placeholder="0" />
                      </td>

                      {/* Welfare */}
                      <td style={td({ background: '#fff3cd' })}>
                        <NumberInput {...numProps()} value={row.welfare}
                          onChange={(v) => updateRow(idx, 'welfare', v)} placeholder="0"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, color: '#92400e', width: '100%' } }} />
                      </td>

                      {/* Other Deductions */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput {...numProps()} value={row.otherDed}
                          onChange={(v) => updateRow(idx, 'otherDed', v)} placeholder="0" />
                      </td>

                      {/* Total Deduction — auto */}
                      <td style={td({ background: '#ffe0b2' })}>
                        <NumberInput {...numProps()} value={row.totalDed} readOnly placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#7b341e', width: '100%' } }} />
                      </td>

                      {/* Net Pay — auto */}
                      <td style={td({ background: n(row.netPay) >= 0 ? '#e6fffa' : '#fff5f5' })}>
                        <NumberInput {...numProps()} value={row.netPay} readOnly placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700,
                            color: n(row.netPay) >= 0 ? '#00695c' : '#c53030', width: '100%' } }} />
                      </td>

                      {/* Bank */}
                      <td style={td({ background: '#f0fff4' })}>
                        <NumberInput {...numProps()} value={row.bank}
                          onChange={(v) => updateRow(idx, 'bank', v)} placeholder="0" />
                      </td>

                      {/* Cash */}
                      <td style={td({ background: '#f0fff4' })}>
                        <NumberInput {...numProps()} value={row.cash}
                          onChange={(v) => updateRow(idx, 'cash', v)} placeholder="0" />
                      </td>

                      {/* Pay Total — auto */}
                      <td style={td({ background: '#b2f5ea' })}>
                        <NumberInput {...numProps()} value={row.payTotal} readOnly placeholder="—"
                          styles={{ input: { textAlign: 'center', fontSize: 11, height: 26, fontWeight: 700, color: '#00695c', width: '100%' } }} />
                      </td>

                      {/* Apply Payment button */}
                      <td style={td({ padding: '0 2px' })}>
                        {row.producerName.trim() && !isPaid ? (
                          <ActionIcon
                            size="sm"
                            color="blue"
                            variant="light"
                            loading={!!applying[idx]}
                            onClick={() => applyPayment(idx)}
                            title="Apply Payment"
                          >
                            <IconDeviceFloppy size={13} />
                          </ActionIcon>
                        ) : isPaid ? (
                          <IconCheck size={14} color="#38a169" style={{ display: 'block', margin: 'auto' }} />
                        ) : null}
                      </td>

                      {/* Paid checkbox + Signature */}
                      <td style={td({ padding: '0 4px' })}>
                        <Group gap={4} justify="center" align="center" style={{ height: 28 }} wrap="nowrap">
                          <Checkbox
                            size="xs"
                            checked={row.paid}
                            onChange={(e) => updateRow(idx, 'paid', e.currentTarget.checked)}
                            color="green"
                          />
                          <TextInput
                            variant="unstyled" size="xs"
                            value={row.signature}
                            onChange={(e) => updateRow(idx, 'signature', e.target.value)}
                            placeholder="Sign."
                            style={{ flex: 1, minWidth: 0 }}
                            styles={{ input: { fontSize: 10, height: 26, padding: '0 2px', borderBottom: '1px dashed #cbd5e0', fontStyle: 'italic' } }}
                          />
                        </Group>
                      </td>
                    </tr>
                  );
                })}

                {/* TOTAL ROW */}
                <tr style={{ borderTop: '2px solid #2d3748' }}>
                  <td colSpan={3} style={{ ...tdTotal, background: '#2d3748', color: '#fff', textAlign: 'center', letterSpacing: 1 }}>
                    TOTAL
                  </td>
                  <td style={tdTotal}>{fmtN(totals.milkQty)}</td>
                  <td style={{ ...tdTotal, color: '#718096' }}>—</td>
                  <td style={{ ...tdTotal, color: '#276749' }}>{fmtN(totals.earnings)}</td>
                  <td style={{ ...tdTotal, background: '#fffff0' }}>{fmtN(totals.earningTotal)}</td>
                  <td style={{ ...tdTotal, background: '#ebf8ff', color: '#2b6cb0' }}>{fmtN(totals.prevBalance)}</td>
                  <td style={tdBal}>{fmtN(totals.gross)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0' }}>{fmtN(totals.cfAdv)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0' }}>{fmtN(totals.cashAdv)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0' }}>{fmtN(totals.loan)}</td>
                  <td style={{ ...tdTotal, background: '#fff3cd', color: '#92400e' }}>{fmtN(totals.welfare)}</td>
                  <td style={{ ...tdTotal, background: '#fffaf0' }}>{fmtN(totals.otherDed)}</td>
                  <td style={{ ...tdTotal, background: '#ffe0b2', color: '#7b341e' }}>{fmtN(totals.totalDed)}</td>
                  <td style={{ ...tdBal, background: '#b2f5ea', fontSize: 12 }}>{fmtN(totals.netPay)}</td>
                  <td style={{ ...tdTotal, background: '#e6fffa' }}>{fmtN(totals.bank)}</td>
                  <td style={{ ...tdTotal, background: '#e6fffa' }}>{fmtN(totals.cash)}</td>
                  <td style={{ ...tdBal, background: '#b2f5ea', fontSize: 12 }}>{fmtN(totals.payTotal)}</td>
                  <td style={tdTotal} colSpan={2}></td>
                </tr>

                {/* BALANCE ROW */}
                <tr style={{ borderTop: '1px solid #a0aec0' }}>
                  <td colSpan={3} style={{ ...tdTotal, background: '#ebf4ff', color: '#1a365d', textAlign: 'center', letterSpacing: 1 }}>
                    BALANCE
                  </td>
                  <td colSpan={6} style={{ ...tdBal, background: '#ebf8ff', color: '#2b6cb0' }}>
                    <Text size="xs" fw={700} ta="center">Gross Earning: ₹{fmtN(totals.gross)}</Text>
                  </td>
                  <td colSpan={6} style={{ ...tdTotal, background: '#fffaf0', color: '#7b341e' }}>
                    <Text size="xs" fw={700} ta="center">Total Deduction: ₹{fmtN(totals.totalDed)}</Text>
                  </td>
                  <td colSpan={6} style={{ ...tdBal, background: '#f0fff4', fontSize: 12 }}>
                    <Text size="xs" fw={700} ta="center" c="#276749">Net Payable: ₹{fmtN(totals.netPay)}</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Box>
        </ScrollArea>

        {/* FOOTER STATS */}
        <Box px="md" py="xs" style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="xs" c="dimmed">
              Period: <strong>{dayjs(fromDate).format('DD MMM YYYY')} – {dayjs(toDate).format('DD MMM YYYY')}</strong>
              {group ? ` · ${group}` : ''}
              {page  ? ` · Page ${page}` : ''}
            </Text>
            <Group gap="sm" wrap="nowrap">
              <Badge color="blue"   variant="light" size="sm">Producers: {filledRows.length}</Badge>
              <Badge color="green"  variant="light" size="sm">Paid: {paidRows.length}</Badge>
              <Badge color="orange" variant="light" size="sm">Pending: {pendingRows.length}</Badge>
              <Badge color="teal"   variant="filled" size="sm">Net Pay: ₹{fmtN(totals.netPay)}</Badge>
              <Badge color="blue"   variant="filled" size="sm">Paid Out: ₹{fmtN(totals.payTotal)}</Badge>
            </Group>
          </Group>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentRegisterLedger;
