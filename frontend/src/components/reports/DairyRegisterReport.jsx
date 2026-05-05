import React, { useState, useRef } from 'react';
import {
  Box, Paper, Group, Text, Button, Select, Title, Badge,
  Stack, SimpleGrid, Loader, Center, ScrollArea, Divider
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCalendar, IconRefresh, IconPrinter, IconFileExport,
  IconInbox, IconDroplet, IconChartBar
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

// ── Formatters ───────────────────────────────────────────────────────────────
const f3  = (n) => parseFloat(n || 0).toFixed(3);
const f2  = (n) => parseFloat(n || 0).toFixed(2);
const f0  = (n) => Math.round(n || 0).toString();
const fz3 = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toFixed(3); };
const fz2 = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toFixed(2); };
const fz0 = (n) => { const v = Math.round(n || 0); return v === 0 ? '' : v.toString(); };
const fmtDate = (d) => dayjs(d).format('DD-MM-YYYY');
const fmtDay  = (d) => dayjs(d).format('ddd');

const PRESETS = [
  { value: 'today',         label: 'Today' },
  { value: 'yesterday',     label: 'Yesterday' },
  { value: 'thisWeek',      label: 'This Week' },
  { value: 'thisMonth',     label: 'This Month' },
  { value: 'lastMonth',     label: 'Last Month' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom',        label: 'Custom Range' },
];

const getPresetRange = (preset) => {
  const now = dayjs();
  switch (preset) {
    case 'today':       return [now.startOf('day').toDate(), now.endOf('day').toDate()];
    case 'yesterday':   return [now.subtract(1,'day').startOf('day').toDate(), now.subtract(1,'day').endOf('day').toDate()];
    case 'thisWeek':    return [now.startOf('week').toDate(), now.endOf('week').toDate()];
    case 'thisMonth':   return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth':   return [now.subtract(1,'month').startOf('month').toDate(), now.subtract(1,'month').endOf('month').toDate()];
    case 'financialYear': {
      const fy = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const CLR = {
  primary:     '#0f2244',
  member:      '#14532d',
  nonMember:   '#7c2d12',
  purchase:    '#1e3a8a',
  local:       '#065f46',
  credit:      '#1e40af',
  school:      '#78350f',
  sample:      '#4c1d95',
  milma:       '#1e3a8a',
  profit:      '#7f1d1d',
  dateBg:      '#eff6ff',
  amBg:        '#f0fdf4',
  pmBg:        '#fffbeb',
  totalBg:     '#dbeafe',
  grandBg:     '#0f2244',
  border:      '#94a3b8',
};

const BDR = `1px solid ${CLR.border}`;

// ── Table cell components ─────────────────────────────────────────────────────
const TH = ({ children, bg, colSpan, rowSpan, align = 'center', minW, style = {} }) => (
  <th
    colSpan={colSpan}
    rowSpan={rowSpan}
    style={{
      background: bg || CLR.primary,
      color: '#fff',
      border: BDR,
      padding: '5px 6px',
      fontSize: 9,
      fontWeight: 700,
      textAlign: align,
      whiteSpace: 'pre-line',
      lineHeight: 1.3,
      letterSpacing: 0.3,
      verticalAlign: 'middle',
      minWidth: minW,
      ...style,
    }}
  >
    {children}
  </th>
);

const TD = ({ children, bold, bg, color, align = 'right', style = {} }) => (
  <td
    style={{
      border: BDR,
      padding: '3px 6px',
      fontSize: 10,
      textAlign: align,
      fontFamily: 'monospace',
      fontWeight: bold ? 700 : 400,
      background: bg || 'transparent',
      color: color || '#1a1a1a',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </td>
);

// ── Data Row (renders one <tr> — do NOT wrap in another <tr>) ────────────────
const DataRow = ({ row, bg, bold, shiftLabel, shiftBg, isGrand }) => {
  const fn3 = isGrand ? f3 : fz3;
  const fn2 = isGrand ? f2 : fz2;
  const fn0 = isGrand ? f0 : fz0;
  const clr = isGrand ? '#fff' : '#1a1a1a';
  const rowBg = isGrand ? CLR.grandBg : bg;

  return (
    <tr>
      {/* Shift */}
      <TD
        align="center"
        bold={bold}
        bg={shiftBg || rowBg}
        color={isGrand ? '#fff' : '#374151'}
        style={{ fontSize: isGrand ? 9 : 10, fontFamily: 'sans-serif', fontWeight: 700 }}
      >
        {shiftLabel}
      </TD>

      {/* ── Member ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn0(row.memberNos)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.memberQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.memberAmt)}</TD>

      {/* ── Non-Member ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn0(row.nonMemberNos)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.nonMemberQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.nonMemberAmt)}</TD>

      {/* ── Purchase Total ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn0(row.totalNos)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.procQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.handQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.purchaseAmt)}</TD>
      <TD bold={bold} bg={rowBg} color={row.shortage > 0 ? (isGrand ? '#fca5a5' : '#dc2626') : clr}>{fn3(row.shortage)}</TD>
      <TD bold={bold} bg={rowBg} color={row.excess > 0   ? (isGrand ? '#86efac' : '#16a34a') : clr}>{fn3(row.excess)}</TD>

      {/* ── Local Sales ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.localQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.localAmt)}</TD>

      {/* ── Credit Sales ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.creditQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.creditAmt)}</TD>

      {/* ── School Sales ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.schoolQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.schoolAmt)}</TD>

      {/* ── Sample Sales ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.sampleQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.sampleAmt)}</TD>

      {/* ── Milma / Union Sales ── */}
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.unionSendQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.milmaQtyLtr)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.unionAmt)}</TD>
      <TD bold={bold} bg={rowBg} color={row.unionSpoilage > 0 ? (isGrand ? '#fca5a5' : '#dc2626') : clr}>{fn3(row.unionSpoilage)}</TD>
      <TD bold={bold} bg={rowBg} color={row.unionExcess > 0   ? (isGrand ? '#86efac' : '#16a34a') : clr}>{fn3(row.unionExcess)}</TD>
      <TD bold={bold} bg={rowBg} color={row.unionShortage > 0 ? (isGrand ? '#fca5a5' : '#dc2626') : clr}>{fn3(row.unionShortage)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn3(row.milmaTotalQty)}</TD>
      <TD bold={bold} bg={rowBg} color={clr}>{fn2(row.milmaTotalAmt)}</TD>

      {/* ── Profit ── */}
      <TD
        bold={bold}
        bg={rowBg}
        color={isGrand
          ? (row.profit >= 0 ? '#86efac' : '#fca5a5')
          : (row.profit >= 0 ? '#15803d' : '#dc2626')}
      >
        {fn2(row.profit)}
      </TD>
    </tr>
  );
};

// Total data columns = 1(shift)+3(member)+3(nonMember)+6(purchase)+8(sales)+8(milma)+1(profit) = 30
const TOTAL_COLS = 30;

// ── Main Component ────────────────────────────────────────────────────────────
const DairyRegisterReport = () => {
  const [loading, setLoading]     = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]       = useState('thisMonth');
  const [dateRange, setDateRange] = useState(getPresetRange('thisMonth'));
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
      const res = await reportAPI.dairyRegister({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD'),
      });
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to load', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const days       = reportData?.days       || [];
  const grandTotal = reportData?.grandTotal || null;

  const [start, end] = dateRange;
  const periodLabel  = start && end
    ? `${dayjs(start).format('DD/MM/YYYY')} TO ${dayjs(end).format('DD/MM/YYYY')}`
    : '—';

  // ── Excel Export ─────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!days.length) return;
    const rows = [];
    for (const d of days) {
      const base = { Date: fmtDate(d.dateStr) };
      const toRow = (row, shift) => ({
        ...base, Shift: shift,
        'Member Nos': row.memberNos, 'Member Qty': row.memberQty, 'Member Amt': row.memberAmt,
        'NonMember Nos': row.nonMemberNos, 'NonMember Qty': row.nonMemberQty, 'NonMember Amt': row.nonMemberAmt,
        'Total Nos': row.totalNos, 'Proc Qty': row.procQty, 'Hand Qty': row.handQty,
        'Purchase Amt': row.purchaseAmt, 'Shortage': row.shortage, 'Excess': row.excess,
        'Local Qty': row.localQty, 'Local Amt': row.localAmt,
        'Credit Qty': row.creditQty, 'Credit Amt': row.creditAmt,
        'School Qty': row.schoolQty, 'School Amt': row.schoolAmt,
        'Sample Qty': row.sampleQty, 'Sample Amt': row.sampleAmt,
        'Send Qty': row.unionSendQty, 'Milma Qty Ltr': row.milmaQtyLtr,
        'Milma Value': row.unionAmt, 'Milma Spoilage': row.unionSpoilage,
        'Milma Excess': row.unionExcess, 'Milma Shortage': row.unionShortage,
        'Total Sales Qty': row.milmaTotalQty, 'Total Sales Amt': row.milmaTotalAmt,
        'Profit': row.profit,
      });
      rows.push(toRow(d.am, 'AM'), toRow(d.pm, 'PM'), toRow(d.total, 'Total'));
    }
    if (grandTotal) rows.push({ Date: 'GRAND TOTAL', Shift: '', ...grandTotal });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dairy Register');
    XLSX.writeFile(wb, `dairy_register_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'File downloaded', color: 'green' });
  };

  // ── Summary cards ─────────────────────────────────────────────────────────
  const summaryCards = grandTotal ? [
    { label: 'Total Purchase', value: `${f3(grandTotal.procQty)} Ltr`, sub: `₹ ${f2(grandTotal.purchaseAmt)}`, color: CLR.purchase },
    { label: 'Local Sales',    value: `${f3(grandTotal.localQty)} Ltr`,  sub: `₹ ${f2(grandTotal.localAmt)}`,  color: CLR.local },
    { label: 'Credit Sales',   value: `${f3(grandTotal.creditQty)} Ltr`, sub: `₹ ${f2(grandTotal.creditAmt)}`, color: CLR.credit },
    { label: 'Milma Sales',    value: `${f3(grandTotal.milmaTotalQty)} Ltr`, sub: `₹ ${f2(grandTotal.milmaTotalAmt)}`, color: CLR.milma },
    { label: 'Net Profit',     value: `₹ ${f2(grandTotal.profit)}`, sub: grandTotal.profit >= 0 ? 'Profit' : 'Loss', color: grandTotal.profit >= 0 ? '#166534' : '#b91c1c' },
  ] : [];

  // ── Legend items ──────────────────────────────────────────────────────────
  const LEGEND = [
    { color: CLR.member,    label: 'Member' },
    { color: CLR.nonMember, label: 'Non-Member' },
    { color: CLR.purchase,  label: 'Milk Purchase' },
    { color: CLR.local,     label: 'Local Sales' },
    { color: CLR.credit,    label: 'Credit Sales' },
    { color: CLR.school,    label: 'School Sales' },
    { color: CLR.sample,    label: 'Sample Sales' },
    { color: CLR.milma,     label: 'Milma Sales' },
    { color: CLR.profit,    label: 'Profit' },
  ];

  return (
    <Box p="md" ref={printRef}>

      {/* ── Page Header ── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden' }}>
        <Box style={{
          background: `linear-gradient(135deg, ${CLR.primary} 0%, #1e3a8a 60%, #1d4ed8 100%)`,
          padding: '14px 24px',
        }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Box style={{
                background: 'rgba(255,255,255,0.15)', borderRadius: 10,
                padding: '8px', display: 'flex', alignItems: 'center',
              }}>
                <IconDroplet size={26} color="#fff" />
              </Box>
              <Stack gap={0}>
                <Title order={4} c="white" style={{ letterSpacing: 0.5 }}>
                  Dairy Register Report
                </Title>
                <Text size="xs" c="rgba(255,255,255,0.75)">
                  Date-wise AM/PM milk collection — {periodLabel}
                </Text>
              </Stack>
            </Group>
            <Group gap="sm">
              {days.length > 0 && (
                <Badge size="lg" color="white" c={CLR.primary} variant="filled" radius="md">
                  {days.length} Day{days.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </Group>
          </Group>
        </Box>

        {/* Summary strip */}
        {summaryCards.length > 0 && (
          <Box px="xl" py="sm" style={{ background: '#f0f4ff' }}>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
              {summaryCards.map((c, i) => (
                <Box key={i} style={{
                  textAlign: 'center', padding: '6px 4px',
                  borderRight: i < summaryCards.length - 1 ? '1px solid #cbd5e1' : 'none',
                }}>
                  <Text size="xs" c="dimmed" fw={500}>{c.label}</Text>
                  <Text size="sm" fw={800} style={{ color: c.color }}>{c.value}</Text>
                  <Text size="xs" c="dimmed">{c.sub}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Paper>

      {/* ── Filter Bar ── */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select
            label="Period" size="sm" w={150}
            value={preset} onChange={handlePresetChange}
            data={PRESETS}
          />
          <DatePickerInput
            type="range" size="sm" label="Date Range" w={250}
            value={dateRange}
            onChange={(val) => { setDateRange(val); setPreset('custom'); }}
            leftSection={<IconCalendar size={14} />}
            clearable
          />
          <Button
            size="sm" loading={loading}
            leftSection={<IconRefresh size={14} />}
            onClick={fetchReport}
            style={{ background: CLR.primary }}
          >
            Generate
          </Button>
          {days.length > 0 && (
            <>
              <Button
                size="sm" variant="outline" color="blue"
                leftSection={<IconFileExport size={14} />}
                onClick={handleExport}
              >
                Export Excel
              </Button>
              <Button
                size="sm" variant="outline" color="gray"
                leftSection={<IconPrinter size={14} />}
                onClick={() => printReport(printRef, {
                  title: `Dairy Register — ${periodLabel}`,
                  orientation: 'landscape',
                  extraCss: `
                    @page { size: A4 landscape; margin: 5mm; }
                    body { width: 287mm; }
                    table {
                      font-size: 6px !important;
                      border-collapse: collapse !important;
                      width: 100% !important;
                      table-layout: auto !important;
                    }
                    th, td {
                      padding: 1px 2px !important;
                      min-width: 0 !important;
                      font-size: 6px !important;
                      white-space: nowrap !important;
                    }
                    td[colspan="30"] {
                      font-size: 8px !important;
                      padding: 3px 6px !important;
                      white-space: normal !important;
                    }
                  `
                })}
              >
                Print
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* ── Report Table ── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>

        {/* Table header bar */}
        <Box style={{
          background: `linear-gradient(135deg, ${CLR.primary} 0%, #1e3a8a 100%)`,
          padding: '10px 18px',
        }}>
          <Group justify="space-between">
            <Stack gap={0}>
              <Text fw={800} c="white" size="sm" style={{ letterSpacing: 1 }}>
                DAIRY REGISTER — {periodLabel}
              </Text>
              <Text size="xs" c="rgba(255,255,255,0.65)">
                Date-wise AM / PM milk purchase & sales register
              </Text>
            </Stack>
            <IconChartBar size={22} color="rgba(255,255,255,0.4)" />
          </Group>
        </Box>

        {loading ? (
          <Center py={80}><Loader color="blue" size="md" /></Center>
        ) : !reportData ? (
          <Center py={80}>
            <Stack align="center" gap="xs">
              <IconDroplet size={42} color="#94a3b8" />
              <Text c="dimmed" size="sm">Select a period and click Generate</Text>
            </Stack>
          </Center>
        ) : days.length === 0 ? (
          <Center py={80}>
            <Stack align="center" gap="xs">
              <IconInbox size={42} color="#94a3b8" />
              <Text c="dimmed" size="sm">No data found for the selected period</Text>
            </Stack>
          </Center>
        ) : (
          <ScrollArea>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'auto' }}>
              {/* ══ THEAD — 3 header rows ══ */}
              <thead>
                {/* Row 1 — Major group labels */}
                <tr>
                  {/* Shift — spans 3 rows */}
                  <TH rowSpan={3} minW={46} style={{ fontSize: 9 }}>{'Shift'}</TH>

                  {/* Member */}
                  <TH colSpan={3} bg={CLR.member}>Member</TH>

                  {/* Non-Member */}
                  <TH colSpan={3} bg={CLR.nonMember}>Non-Member</TH>

                  {/* Milk Purchase */}
                  <TH colSpan={6} bg={CLR.purchase}>Milk Purchase</TH>

                  {/* Milk Sales */}
                  <TH colSpan={8} bg="#065f46">Milk Sales</TH>

                  {/* Milma / Union */}
                  <TH colSpan={8} bg={CLR.milma}>Milma / Union Sales</TH>

                  {/* Profit */}
                  <TH rowSpan={3} bg={CLR.profit} minW={68}>{'Profit\n(₹)'}</TH>
                </tr>

                {/* Row 2 — Sub-group labels */}
                <tr>
                  {/* Member sub */}
                  <TH rowSpan={2} bg={CLR.member} minW={36}>Nos</TH>
                  <TH rowSpan={2} bg={CLR.member} minW={66}>{'Qty\n(Ltr)'}</TH>
                  <TH rowSpan={2} bg={CLR.member} minW={66}>{'Value\n(₹)'}</TH>

                  {/* Non-Member sub */}
                  <TH rowSpan={2} bg={CLR.nonMember} minW={36}>Nos</TH>
                  <TH rowSpan={2} bg={CLR.nonMember} minW={66}>{'Qty\n(Ltr)'}</TH>
                  <TH rowSpan={2} bg={CLR.nonMember} minW={66}>{'Value\n(₹)'}</TH>

                  {/* Purchase — total sub group */}
                  <TH colSpan={6} bg={CLR.purchase}>Total Procured</TH>

                  {/* Sales sub groups */}
                  <TH colSpan={2} bg={CLR.local}>Local</TH>
                  <TH colSpan={2} bg={CLR.credit}>Credit</TH>
                  <TH colSpan={2} bg={CLR.school}>School</TH>
                  <TH colSpan={2} bg={CLR.sample}>Sample</TH>

                  {/* Milma sub */}
                  <TH rowSpan={2} bg={CLR.milma} minW={64}>{'Send\nQty'}</TH>
                  <TH rowSpan={2} bg={CLR.milma} minW={66}>{'Milma\nQty (Ltr)'}</TH>
                  <TH rowSpan={2} bg={CLR.milma} minW={66}>{'Value\n(₹)'}</TH>
                  <TH rowSpan={2} bg={CLR.milma} minW={58} style={{ color: '#fca5a5' }}>{'Spoilage\n(Ltr)'}</TH>
                  <TH rowSpan={2} bg={CLR.milma} minW={50} style={{ color: '#86efac' }}>{'Excess\n(Ltr)'}</TH>
                  <TH rowSpan={2} bg={CLR.milma} minW={50} style={{ color: '#fca5a5' }}>{'Short-\nage'}</TH>
                  <TH rowSpan={2} bg={CLR.milma} minW={66}>{'Total\nQty'}</TH>
                  <TH rowSpan={2} bg={CLR.milma} minW={70}>{'Total\nValue (₹)'}</TH>
                </tr>

                {/* Row 3 — Leaf headers */}
                <tr>
                  {/* Purchase leaves */}
                  <TH bg={CLR.purchase} minW={36}>Nos</TH>
                  <TH bg={CLR.purchase} minW={66}>{'Proc\nQty'}</TH>
                  <TH bg={CLR.purchase} minW={66}>{'Hand\nQty'}</TH>
                  <TH bg={CLR.purchase} minW={66}>{'Value\n(₹)'}</TH>
                  <TH bg={CLR.purchase} minW={54} style={{ color: '#fca5a5' }}>{'Short-\nage'}</TH>
                  <TH bg={CLR.purchase} minW={50} style={{ color: '#86efac' }}>Excess</TH>

                  {/* Sales leaves */}
                  <TH bg={CLR.local}  minW={66}>{'Qty\n(Ltr)'}</TH>
                  <TH bg={CLR.local}  minW={66}>{'Value\n(₹)'}</TH>
                  <TH bg={CLR.credit} minW={66}>{'Qty\n(Ltr)'}</TH>
                  <TH bg={CLR.credit} minW={66}>{'Value\n(₹)'}</TH>
                  <TH bg={CLR.school} minW={66}>{'Qty\n(Ltr)'}</TH>
                  <TH bg={CLR.school} minW={66}>{'Value\n(₹)'}</TH>
                  <TH bg={CLR.sample} minW={66}>{'Qty\n(Ltr)'}</TH>
                  <TH bg={CLR.sample} minW={66}>{'Value\n(₹)'}</TH>
                </tr>
              </thead>

              {/* ══ TBODY ══ */}
              <tbody>
                {days.map((d, di) => (
                  <React.Fragment key={d.dateStr}>
                    {/* ── Date section header ── */}
                    <tr>
                      <td
                        colSpan={TOTAL_COLS}
                        style={{
                          background: CLR.dateBg,
                          border: BDR,
                          borderLeft: `4px solid ${CLR.purchase}`,
                          padding: '5px 12px',
                          fontSize: 11,
                          fontWeight: 800,
                          color: CLR.primary,
                          letterSpacing: 0.3,
                        }}
                      >
                        <Group gap="xs">
                          <Text span fw={900} style={{ fontFamily: 'monospace', color: '#64748b', fontSize: 10 }}>
                            {String(di + 1).padStart(2, '0')}
                          </Text>
                          <Text span fw={800} style={{ color: CLR.primary }}>
                            {fmtDate(d.dateStr)}
                          </Text>
                          <Badge size="xs" variant="light" color="blue" radius="sm">
                            {fmtDay(d.dateStr)}
                          </Badge>
                          <Text span size="xs" c="dimmed" style={{ marginLeft: 4 }}>
                            Purchase: {f3(d.total?.procQty)} Ltr &nbsp;|&nbsp;
                            Sales: {f3((d.total?.localQty||0)+(d.total?.creditQty||0)+(d.total?.schoolQty||0)+(d.total?.sampleQty||0)+(d.total?.milmaTotalQty||0))} Ltr &nbsp;|&nbsp;
                            Profit: ₹{f2(d.total?.profit)}
                          </Text>
                        </Group>
                      </td>
                    </tr>

                    {/* AM row */}
                    <DataRow
                      row={d.am}
                      bg={CLR.amBg}
                      shiftLabel="AM"
                      shiftBg="#dcfce7"
                    />

                    {/* PM row */}
                    <DataRow
                      row={d.pm}
                      bg={CLR.pmBg}
                      shiftLabel="PM"
                      shiftBg="#fef9c3"
                    />

                    {/* Daily Total row */}
                    <DataRow
                      row={d.total}
                      bg={CLR.totalBg}
                      bold
                      shiftLabel="Total"
                      shiftBg="#bfdbfe"
                    />
                  </React.Fragment>
                ))}

                {/* ── Grand Total section ── */}
                {grandTotal && (
                  <>
                    <tr>
                      <td
                        colSpan={TOTAL_COLS}
                        style={{
                          background: CLR.grandBg,
                          border: BDR,
                          padding: '5px 14px',
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#fff',
                          letterSpacing: 2,
                          textAlign: 'center',
                        }}
                      >
                        ★ &nbsp; GRAND TOTAL — {days.length} Day{days.length !== 1 ? 's' : ''} &nbsp; ★
                      </td>
                    </tr>
                    <DataRow
                      row={grandTotal}
                      isGrand
                      shiftLabel="G.Total"
                      shiftBg={CLR.grandBg}
                    />
                  </>
                )}
              </tbody>
            </table>
          </ScrollArea>
        )}

        {/* ── Footer Legend ── */}
        {days.length > 0 && (
          <Box px="md" py="xs" style={{ borderTop: `1px solid #e2e8f0`, background: '#f8fafc' }}>
            <Group gap="xl" wrap="wrap" justify="space-between">
              <Group gap="md" wrap="wrap">
                {LEGEND.map((l, i) => (
                  <Group key={i} gap={4}>
                    <Box style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                    <Text size="xs" c="dimmed">{l.label}</Text>
                  </Group>
                ))}
              </Group>
              <Group gap="lg">
                <Group gap={4}>
                  <Box style={{ width: 14, height: 8, borderRadius: 2, background: '#dcfce7' }} />
                  <Text size="xs" c="dimmed">AM shift</Text>
                </Group>
                <Group gap={4}>
                  <Box style={{ width: 14, height: 8, borderRadius: 2, background: '#fef9c3' }} />
                  <Text size="xs" c="dimmed">PM shift</Text>
                </Group>
                <Group gap={4}>
                  <Box style={{ width: 14, height: 8, borderRadius: 2, background: '#bfdbfe' }} />
                  <Text size="xs" c="dimmed">Daily Total</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Proc = Procured &nbsp;|&nbsp; Hand = Handled
                </Text>
              </Group>
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default DairyRegisterReport;
