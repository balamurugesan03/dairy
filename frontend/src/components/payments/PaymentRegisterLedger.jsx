import React, { useState, useMemo, useCallback } from 'react';
import {
  Container,
  Paper,
  Grid,
  Group,
  Text,
  Title,
  Box,
  TextInput,
  NumberInput,
  Checkbox,
  ScrollArea,
  Badge,
  Divider,
  Button,
  Loader,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar,
  IconPrinter,
  IconRefresh,
  IconFileSpreadsheet,
  IconDownload,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { milkCollectionAPI, paymentAPI } from '../../services/api';

const TOTAL_ROWS = 25;

const initRow = (sn) => ({
  sn,
  producerName: '',
  milkQty:       '',
  milkRate:      '',
  other:         '',
  earningTotal:  '',
  earningAdv:    '',
  earningBal:    '',
  cs:            '',
  bs:            '',
  deductAdv:     '',
  deductRate:    '',
  deductBal:     '',
  bank:          '',
  cash:          '',
  payTotal:      '',
  signature:     '',
  paid:          false,
});

/* ─── helpers ─── */
const n = (v) => parseFloat(v) || 0;
const fmt = (v) => (v === 0 ? '' : v.toFixed(2));
const fmtN = (v) => (v === 0 ? '0.00' : v.toFixed(2));

/* ─── style constants ─── */
const BORDER = '1px solid #ccc';
const BORDER_DARK = '1px solid #a0aec0';

const thSection = (bg) => ({
  background: bg,
  color: '#fff',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 700,
  padding: '6px 4px',
  border: BORDER_DARK,
  letterSpacing: 0.8,
  userSelect: 'none',
});

const thCol = (bg) => ({
  background: bg,
  color: '#e2e8f0',
  textAlign: 'center',
  fontSize: 10,
  fontWeight: 600,
  padding: '5px 2px',
  border: BORDER_DARK,
  whiteSpace: 'nowrap',
  userSelect: 'none',
});

const td = (extra = {}) => ({
  border: BORDER,
  padding: 0,
  textAlign: 'center',
  height: 28,
  verticalAlign: 'middle',
  ...extra,
});

const tdAuto = (color) => td({ background: '#fffde7' });

const tdTotal = {
  border: BORDER_DARK,
  padding: '3px 4px',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 700,
  color: '#1a365d',
  background: '#edf2f7',
  verticalAlign: 'middle',
};

const tdBal = {
  ...tdTotal,
  background: '#e6fffa',
  color: '#276749',
};

/* ─── shared input props ─── */
const numProps = (extra = {}) => ({
  variant: 'unstyled',
  size: 'xs',
  hideControls: true,
  decimalScale: 2,
  styles: {
    input: {
      textAlign: 'center',
      fontSize: 11,
      height: 26,
      padding: '0 2px',
      width: '100%',
    },
  },
  ...extra,
});

const txtProps = (extra = {}) => ({
  variant: 'unstyled',
  size: 'xs',
  styles: {
    input: {
      textAlign: 'center',
      fontSize: 11,
      height: 26,
      padding: '0 2px',
      width: '100%',
    },
  },
  ...extra,
});

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
const PaymentRegisterLedger = () => {
  const [header, setHeader] = useState({
    fromDate:        dayjs().startOf('month').toDate(),
    toDate:          dayjs().endOf('month').toDate(),
    producerDetails: '',
    paymentPage:     '1',
  });

  const [rows, setRows] = useState(() =>
    Array.from({ length: TOTAL_ROWS }, (_, i) => initRow(i + 1))
  );

  const [loading, setLoading] = useState(false);

  const updateHeader = (field, value) =>
    setHeader((prev) => ({ ...prev, [field]: value }));

  /* ── Load data from backend ── */
  const fetchData = useCallback(async () => {
    if (!header.fromDate || !header.toDate) return;
    setLoading(true);
    try {
      const fromDate = dayjs(header.fromDate).format('YYYY-MM-DD');
      const toDate   = dayjs(header.toDate).format('YYYY-MM-DD');

      // 1. Milk summary per farmer
      const milkRes  = await milkCollectionAPI.getFarmerWiseSummary({ fromDate, toDate });
      const milkRows = milkRes.data || milkRes || [];

      // 2. Payments in period (large limit to get all)
      const payRes  = await paymentAPI.getAll({ fromDate, toDate, limit: 1000 });
      const payments = payRes.data || payRes?.payments || [];

      // Aggregate payments by farmerId string
      const payMap = {};
      payments.forEach((p) => {
        const fid = p.farmerId?._id?.toString() || p.farmerId?.toString();
        if (!fid) return;
        if (!payMap[fid]) {
          payMap[fid] = { cfAdv: 0, cashAdv: 0, loanAdv: 0, welfare: 0, bank: 0, cash: 0 };
        }
        // Deductions breakdown
        (p.deductions || []).forEach((d) => {
          const t = (d.type || '').toLowerCase();
          if (t.includes('cf')) payMap[fid].cfAdv += d.amount || 0;
          else if (t.includes('cash')) payMap[fid].cashAdv += d.amount || 0;
          else if (t.includes('loan')) payMap[fid].loanAdv += d.amount || 0;
          else if (t.includes('welfare')) payMap[fid].welfare += d.amount || 0;
        });
        // Payment mode split
        const mode = (p.paymentMode || '').toLowerCase();
        if (mode.includes('bank') || mode.includes('cheque') || mode.includes('upi')) {
          payMap[fid].bank += p.paidAmount || 0;
        } else {
          payMap[fid].cash += p.paidAmount || 0;
        }
      });

      // Build rows from milk data
      const newRows = milkRows.map((m, i) => {
        const fid  = m.farmerId?.toString();
        const pay  = fid ? (payMap[fid] || {}) : {};
        const qty  = m.totalQty  || 0;
        const rate = m.avgRate   || 0;
        const other = m.totalIncentive || 0;
        const earningTotal = m.totalAmount || qty * rate + other;
        const earningAdv   = pay.cfAdv || 0;
        const earningBal   = earningTotal - earningAdv;
        const deductAdv    = (pay.cashAdv || 0) + (pay.loanAdv || 0);
        const deductBal    = deductAdv + (pay.welfare || 0);
        const bank = pay.bank || 0;
        const cash = pay.cash || 0;
        return {
          sn:           i + 1,
          producerName: m.farmerName || '',
          milkQty:      qty   || '',
          milkRate:     rate  || '',
          other:        other || '',
          earningTotal: earningTotal || '',
          earningAdv:   earningAdv   || '',
          earningBal:   earningBal   || '',
          cs:           '',
          bs:           '',
          deductAdv:    deductAdv || '',
          deductRate:   '',
          deductBal:    deductBal || '',
          bank:         bank || '',
          cash:         cash || '',
          payTotal:     (bank + cash) || '',
          signature:    '',
          paid:         false,
        };
      });

      // Pad to TOTAL_ROWS
      while (newRows.length < TOTAL_ROWS) {
        newRows.push(initRow(newRows.length + 1));
      }

      setRows(newRows);
      notifications.show({
        title: 'Data Loaded',
        message: `${milkRows.length} producer(s) loaded for the period`,
        color: 'teal',
      });
    } catch (err) {
      console.error('PaymentRegisterLedger fetchData error:', err);
      notifications.show({ title: 'Load Failed', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [header.fromDate, header.toDate]);

  /* recalculate derived fields after each change */
  const updateRow = (idx, field, rawValue) => {
    setRows((prev) => {
      const next = [...prev];
      const row  = { ...next[idx], [field]: rawValue };

      // Earning Total = milkQty × milkRate + other
      const qty   = n(row.milkQty);
      const rate  = n(row.milkRate);
      const other = n(row.other);
      const eAdv  = n(row.earningAdv);
      const eTotal = qty * rate + other;
      row.earningTotal = eTotal > 0 ? eTotal : '';
      row.earningBal   = eTotal - eAdv || '';

      // Payment Total = bank + cash
      const bank = n(row.bank);
      const cash = n(row.cash);
      row.payTotal = bank + cash > 0 ? bank + cash : '';

      next[idx] = row;
      return next;
    });
  };

  const handleReset = () => {
    setRows(Array.from({ length: TOTAL_ROWS }, (_, i) => initRow(i + 1)));
    setHeader({
      fromDate:        dayjs().startOf('month').toDate(),
      toDate:          dayjs().endOf('month').toDate(),
      producerDetails: '',
      paymentPage:     '1',
    });
  };

  /* ── column totals ── */
  const totals = useMemo(() => {
    const s = (f) => rows.reduce((acc, r) => acc + n(r[f]), 0);
    return {
      milkQty:      s('milkQty'),
      other:        s('other'),
      earningTotal: s('earningTotal'),
      earningAdv:   s('earningAdv'),
      earningBal:   s('earningBal'),
      cs:           s('cs'),
      bs:           s('bs'),
      deductAdv:    s('deductAdv'),
      deductBal:    s('deductBal'),
      bank:         s('bank'),
      cash:         s('cash'),
      payTotal:     s('payTotal'),
    };
  }, [rows]);

  const filledRows    = rows.filter((r) => r.producerName.trim());
  const paidRows      = rows.filter((r) => r.paid);
  const pendingRows   = filledRows.filter((r) => !r.paid);

  /* ─────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <Container fluid p="md" style={{ background: '#f0f2f5', minHeight: '100vh' }}>

      {/* ── HEADER PAPER ── */}
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
              Dairy Cooperative Society · Monthly Producer Payment Sheet
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              color="blue"
              leftSection={loading ? <Loader size={12} color="white" /> : <IconDownload size={13} />}
              onClick={fetchData}
              disabled={loading}
            >
              Load Data
            </Button>
            <Button
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconRefresh size={13} />}
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button
              size="xs"
              leftSection={<IconPrinter size={13} />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </Group>
        </Group>

        <Divider my="sm" />

        {/* ── Filter Row ── */}
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <DateInput
              label="From Date"
              placeholder="Select from date"
              value={header.fromDate}
              onChange={(v) => updateHeader('fromDate', v)}
              leftSection={<IconCalendar size={14} />}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <DateInput
              label="To Date"
              placeholder="Select to date"
              value={header.toDate}
              onChange={(v) => updateHeader('toDate', v)}
              leftSection={<IconCalendar size={14} />}
              minDate={header.fromDate || undefined}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
            <TextInput
              label="Producer Details / Group"
              placeholder="Centre name, route, group, etc."
              value={header.producerDetails}
              onChange={(e) => updateHeader('producerDetails', e.target.value)}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <TextInput
              label="Payment Page"
              placeholder="e.g. 1"
              value={header.paymentPage}
              onChange={(e) => updateHeader('paymentPage', e.target.value)}
              size="sm"
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── LEDGER TABLE ── */}
      <Paper withBorder shadow="sm" style={{ background: '#fff', overflow: 'hidden' }}>
        <ScrollArea type="scroll" scrollbarSize={8} scrollHideDelay={0}>
          <Box style={{ minWidth: 1280 }}>
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                tableLayout: 'fixed',
              }}
            >
              {/* ── column widths ── */}
              <colgroup>
                <col style={{ width: 36 }} />   {/* SN */}
                <col style={{ width: 148 }} />  {/* Producer Name */}
                {/* Earning */}
                <col style={{ width: 62 }} />
                <col style={{ width: 62 }} />
                <col style={{ width: 66 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 76 }} />
                {/* Deduction */}
                <col style={{ width: 60 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 76 }} />
                {/* Payment */}
                <col style={{ width: 76 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 96 }} />
              </colgroup>

              {/* ── STICKY THEAD ── */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Row 1 — Section labels */}
                <tr>
                  <th
                    style={thSection('#2d3748')}
                    rowSpan={2}
                  >
                    SN
                  </th>
                  <th
                    style={thSection('#2d3748')}
                    rowSpan={2}
                  >
                    Producer Name
                  </th>
                  {/* Earning */}
                  <th style={thSection('#1a365d')} colSpan={6}>
                    EARNING
                  </th>
                  {/* Deduction */}
                  <th style={thSection('#744210')} colSpan={5}>
                    DEDUCTION
                  </th>
                  {/* Payment */}
                  <th style={thSection('#1a4731')} colSpan={4}>
                    PAYMENT
                  </th>
                </tr>

                {/* Row 2 — Column sub-headers */}
                <tr>
                  {/* Earning */}
                  {['Milk Qty', 'Milk Rate', 'Other', 'Total', 'Advance', 'Balance'].map((h) => (
                    <th key={h} style={thCol('#2c5282')}>{h}</th>
                  ))}
                  {/* Deduction */}
                  {['CS', 'BS', 'Advance', 'Rate', 'Balance'].map((h) => (
                    <th key={h} style={thCol('#975a16')}>{h}</th>
                  ))}
                  {/* Payment */}
                  {['Bank', 'Cash', 'Total', 'Paid ✓ / Sign'].map((h) => (
                    <th key={h} style={thCol('#276749')}>{h}</th>
                  ))}
                </tr>
              </thead>

              {/* ── TBODY — data rows ── */}
              <tbody>
                {rows.map((row, idx) => {
                  const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                  return (
                    <tr key={idx} style={{ background: rowBg }}>

                      {/* SN */}
                      <td
                        style={td({
                          background: '#f7fafc',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#718096',
                          width: 36,
                        })}
                      >
                        {row.sn}
                      </td>

                      {/* Producer Name */}
                      <td style={td()}>
                        <TextInput
                          {...txtProps({
                            styles: {
                              input: {
                                textAlign: 'left',
                                fontSize: 11,
                                height: 26,
                                padding: '0 5px',
                                width: '100%',
                              },
                            },
                          })}
                          value={row.producerName}
                          onChange={(e) => updateRow(idx, 'producerName', e.target.value)}
                          placeholder="Producer name"
                        />
                      </td>

                      {/* Milk Qty */}
                      <td style={td()}>
                        <NumberInput
                          {...numProps({ decimalScale: 1 })}
                          value={row.milkQty}
                          onChange={(v) => updateRow(idx, 'milkQty', v)}
                          placeholder="0.0"
                        />
                      </td>

                      {/* Milk Rate */}
                      <td style={td()}>
                        <NumberInput
                          {...numProps()}
                          value={row.milkRate}
                          onChange={(v) => updateRow(idx, 'milkRate', v)}
                          placeholder="0.00"
                        />
                      </td>

                      {/* Other */}
                      <td style={td()}>
                        <NumberInput
                          {...numProps()}
                          value={row.other}
                          onChange={(v) => updateRow(idx, 'other', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* Earning Total — auto */}
                      <td style={td({ background: '#fffff0' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.earningTotal}
                          readOnly
                          placeholder="—"
                          styles={{
                            input: {
                              textAlign: 'center',
                              fontSize: 11,
                              height: 26,
                              padding: '0 2px',
                              fontWeight: 700,
                              color: '#1a365d',
                              width: '100%',
                            },
                          }}
                        />
                      </td>

                      {/* Earning Advance */}
                      <td style={td()}>
                        <NumberInput
                          {...numProps()}
                          value={row.earningAdv}
                          onChange={(v) => updateRow(idx, 'earningAdv', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* Earning Balance — auto */}
                      <td style={td({ background: '#f0fff4' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.earningBal}
                          readOnly
                          placeholder="—"
                          styles={{
                            input: {
                              textAlign: 'center',
                              fontSize: 11,
                              height: 26,
                              padding: '0 2px',
                              fontWeight: 700,
                              color: '#276749',
                              width: '100%',
                            },
                          }}
                        />
                      </td>

                      {/* CS */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.cs}
                          onChange={(v) => updateRow(idx, 'cs', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* BS */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.bs}
                          onChange={(v) => updateRow(idx, 'bs', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* Deduction Advance */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.deductAdv}
                          onChange={(v) => updateRow(idx, 'deductAdv', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* Deduction Rate */}
                      <td style={td({ background: '#fffaf0' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.deductRate}
                          onChange={(v) => updateRow(idx, 'deductRate', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* Deduction Balance */}
                      <td style={td({ background: '#fff3cd' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.deductBal}
                          onChange={(v) => updateRow(idx, 'deductBal', v)}
                          placeholder="0.00"
                          styles={{
                            input: {
                              textAlign: 'center',
                              fontSize: 11,
                              height: 26,
                              padding: '0 2px',
                              color: '#92400e',
                              fontWeight: 600,
                              width: '100%',
                            },
                          }}
                        />
                      </td>

                      {/* Bank */}
                      <td style={td({ background: '#f0fff4' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.bank}
                          onChange={(v) => updateRow(idx, 'bank', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* Cash */}
                      <td style={td({ background: '#f0fff4' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.cash}
                          onChange={(v) => updateRow(idx, 'cash', v)}
                          placeholder="0"
                        />
                      </td>

                      {/* Pay Total — auto */}
                      <td style={td({ background: '#e6fffa' })}>
                        <NumberInput
                          {...numProps()}
                          value={row.payTotal}
                          readOnly
                          placeholder="—"
                          styles={{
                            input: {
                              textAlign: 'center',
                              fontSize: 11,
                              height: 26,
                              padding: '0 2px',
                              fontWeight: 700,
                              color: '#00695c',
                              width: '100%',
                            },
                          }}
                        />
                      </td>

                      {/* Signature + Paid checkbox */}
                      <td style={td({ padding: '0 4px' })}>
                        <Group gap={4} justify="center" align="center" style={{ height: 28 }} wrap="nowrap">
                          <Checkbox
                            size="xs"
                            checked={row.paid}
                            onChange={(e) =>
                              updateRow(idx, 'paid', e.currentTarget.checked)
                            }
                            color="green"
                            title="Mark as Paid"
                          />
                          <TextInput
                            variant="unstyled"
                            size="xs"
                            value={row.signature}
                            onChange={(e) => updateRow(idx, 'signature', e.target.value)}
                            placeholder="Sign."
                            style={{ flex: 1, minWidth: 0 }}
                            styles={{
                              input: {
                                fontSize: 10,
                                height: 26,
                                padding: '0 2px',
                                borderBottom: '1px dashed #cbd5e0',
                                fontStyle: 'italic',
                              },
                            }}
                          />
                        </Group>
                      </td>
                    </tr>
                  );
                })}

                {/* ── TOTAL ROW ── */}
                <tr style={{ borderTop: '2px solid #2d3748' }}>
                  <td colSpan={2} style={{ ...tdTotal, textAlign: 'center', background: '#2d3748', color: '#fff', letterSpacing: 1 }}>
                    TOTAL
                  </td>
                  {/* Earning totals */}
                  <td style={tdTotal}>{fmtN(totals.milkQty)}</td>
                  <td style={{ ...tdTotal, color: '#718096' }}>—</td>
                  <td style={tdTotal}>{fmtN(totals.other)}</td>
                  <td style={{ ...tdTotal, background: '#fffff0' }}>{fmtN(totals.earningTotal)}</td>
                  <td style={tdTotal}>{fmtN(totals.earningAdv)}</td>
                  <td style={tdBal}>{fmtN(totals.earningBal)}</td>
                  {/* Deduction totals */}
                  <td style={{ ...tdTotal, background: '#fff3cd' }}>{fmtN(totals.cs)}</td>
                  <td style={{ ...tdTotal, background: '#fff3cd' }}>{fmtN(totals.bs)}</td>
                  <td style={{ ...tdTotal, background: '#fff3cd' }}>{fmtN(totals.deductAdv)}</td>
                  <td style={{ ...tdTotal, color: '#718096' }}>—</td>
                  <td style={{ ...tdTotal, background: '#ffe0b2', color: '#7b341e' }}>{fmtN(totals.deductBal)}</td>
                  {/* Payment totals */}
                  <td style={{ ...tdTotal, background: '#e6fffa' }}>{fmtN(totals.bank)}</td>
                  <td style={{ ...tdTotal, background: '#e6fffa' }}>{fmtN(totals.cash)}</td>
                  <td style={{ ...tdBal, background: '#b2f5ea', fontSize: 12 }}>{fmtN(totals.payTotal)}</td>
                  <td style={tdTotal}></td>
                </tr>

                {/* ── BALANCE ROW ── */}
                <tr style={{ borderTop: '1px solid #a0aec0' }}>
                  <td
                    colSpan={2}
                    style={{
                      ...tdTotal,
                      background: '#ebf4ff',
                      color: '#1a365d',
                      textAlign: 'center',
                      letterSpacing: 1,
                    }}
                  >
                    BALANCE
                  </td>
                  <td
                    colSpan={6}
                    style={{ ...tdBal, background: '#ebf8ff', color: '#2b6cb0' }}
                  >
                    <Text size="xs" fw={700} ta="center" c="#2b6cb0">
                      Earning Balance:&nbsp;₹{fmtN(totals.earningBal)}
                    </Text>
                  </td>
                  <td
                    colSpan={5}
                    style={{ ...tdTotal, background: '#fffaf0', color: '#7b341e' }}
                  >
                    <Text size="xs" fw={700} ta="center" c="#c05621">
                      Deduction Balance:&nbsp;₹{fmtN(totals.deductBal)}
                    </Text>
                  </td>
                  <td
                    colSpan={4}
                    style={{ ...tdBal, background: '#f0fff4', color: '#276749', fontSize: 12 }}
                  >
                    <Text size="xs" fw={700} ta="center" c="#276749">
                      Net Payment:&nbsp;₹{fmtN(totals.payTotal)}
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Box>
        </ScrollArea>

        {/* ── FOOTER STATS ── */}
        <Box
          px="md"
          py="xs"
          style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}
        >
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="xs" c="dimmed">
              Period:&nbsp;
              <strong>
                {dayjs(header.fromDate).format('DD MMM YYYY')} –{' '}
                {dayjs(header.toDate).format('DD MMM YYYY')}
              </strong>
              {header.producerDetails ? ` · ${header.producerDetails}` : ''}
              {header.paymentPage ? ` · Page ${header.paymentPage}` : ''}
            </Text>

            <Group gap="sm" wrap="nowrap">
              <Badge color="blue" variant="light" size="sm" radius="sm">
                Producers: {filledRows.length}
              </Badge>
              <Badge color="green" variant="light" size="sm" radius="sm">
                Paid: {paidRows.length}
              </Badge>
              <Badge color="orange" variant="light" size="sm" radius="sm">
                Pending: {pendingRows.length}
              </Badge>
              <Badge color="teal" variant="filled" size="sm" radius="sm">
                ₹ {fmtN(totals.payTotal)}
              </Badge>
            </Group>
          </Group>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentRegisterLedger;
