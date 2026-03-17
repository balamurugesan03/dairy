import { useState, useRef, useMemo } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Stack, SimpleGrid, Loader, Center, Badge, Divider, Card
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconMilk, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconChartBar, IconDroplet
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

// ── Formatters ─────────────────────────────────────────────────────────────
const fmt2 = (n) => parseFloat(n || 0).toFixed(2);
const fmt3 = (n) => parseFloat(n || 0).toFixed(3);
const fmtQ = (n) => { const v = parseFloat(n || 0); return v === 0 ? '-' : v.toFixed(3); };
const fmtV = (n) => { const v = parseFloat(n || 0); return v === 0 ? '-' : v.toFixed(2); };

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtMonth = (year, month) => `${MONTH_NAMES[month - 1]} ${year}`;

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
    case 'thisMonth':   return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth':   return [now.subtract(1,'month').startOf('month').toDate(), now.subtract(1,'month').endOf('month').toDate()];
    case 'thisQuarter': return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fy = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

// ── Design tokens ──────────────────────────────────────────────────────────
const TEAL  = '#0d6b5e';
const TEAL2 = '#0f8a7a';
const TEAL3 = '#1ba896';

// Column header style
const thG = (bg = TEAL) => ({
  padding: '6px 8px', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', color: '#fff', whiteSpace: 'pre-line',
  textAlign: 'center', background: bg,
  border: '1px solid rgba(255,255,255,0.25)', lineHeight: 1.3
});

const tdBase  = { padding: '5px 8px', fontSize: 11, border: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const tdR     = { ...tdBase, textAlign: 'right', fontFamily: 'monospace' };
const tdC     = { ...tdBase, textAlign: 'center' };
const tdMonth = { ...tdBase, fontWeight: 700, background: '#f0fdf4', whiteSpace: 'nowrap', minWidth: 90 };
const tdTotal = (bg = '#0d6b5e') => ({ ...tdR, background: bg, color: '#fff', fontWeight: 700 });
const tdTotalC = (bg = '#0d6b5e') => ({ ...tdC, background: bg, color: '#fff', fontWeight: 700 });

// Group header backgrounds
const BG = {
  purchase:    '#0d6b5e',
  localSales:  '#1a6e3c',
  creditSales: '#155e75',
  schoolSales: '#713f12',
  sampleSales: '#4c1d95',
  union:       '#1e3a8a',
  salesTotal:  '#7f1d1d',
  profit:      '#166534',
  other:       '#374151',
};

// ── Column spec ────────────────────────────────────────────────────────────
// Each entry: { group, groupBg, subLabel }
const COLS = [
  // Milk Purchase
  { group: 'Milk Purchase',  groupBg: BG.purchase,    sub: 'Qty (Ltr)',    key: 'purchase.qty',        fmt: fmtQ },
  { group: '',               groupBg: BG.purchase,    sub: 'Avg Rate',     key: 'purchase.avgRate',    fmt: fmtV },
  { group: '',               groupBg: BG.purchase,    sub: 'Value (₹)',    key: 'purchase.value',      fmt: fmtV },
  { group: '',               groupBg: BG.purchase,    sub: 'Shortage',     key: 'purchase.shortage',   fmt: fmtQ },
  { group: '',               groupBg: BG.purchase,    sub: 'Excess',       key: 'purchase.excess',     fmt: fmtQ },
  { group: '',               groupBg: BG.purchase,    sub: 'Handled Qty',  key: 'purchase.handledQty', fmt: fmtQ },
  // Local Sales
  { group: 'Local Sales',    groupBg: BG.localSales,  sub: 'Qty (Ltr)',    key: 'localSales.qty',      fmt: fmtQ },
  { group: '',               groupBg: BG.localSales,  sub: 'Avg Rate',     key: 'localSales.avgRate',  fmt: fmtV },
  { group: '',               groupBg: BG.localSales,  sub: 'Value (₹)',    key: 'localSales.value',    fmt: fmtV },
  // Credit Sales
  { group: 'Credit Sales',   groupBg: BG.creditSales, sub: 'Qty (Ltr)',    key: 'creditSales.qty',     fmt: fmtQ },
  { group: '',               groupBg: BG.creditSales, sub: 'Avg Rate',     key: 'creditSales.avgRate', fmt: fmtV },
  { group: '',               groupBg: BG.creditSales, sub: 'Value (₹)',    key: 'creditSales.value',   fmt: fmtV },
  // School Sales
  { group: 'School Sales',   groupBg: BG.schoolSales, sub: 'Qty (Ltr)',    key: 'schoolSales.qty',     fmt: fmtQ },
  { group: '',               groupBg: BG.schoolSales, sub: 'Avg Rate',     key: 'schoolSales.avgRate', fmt: fmtV },
  { group: '',               groupBg: BG.schoolSales, sub: 'Value (₹)',    key: 'schoolSales.value',   fmt: fmtV },
  // Sample Sales
  { group: 'Sample Sales',   groupBg: BG.sampleSales, sub: 'Qty (Ltr)',    key: 'sampleSales.qty',     fmt: fmtQ },
  { group: '',               groupBg: BG.sampleSales, sub: 'Avg Rate',     key: 'sampleSales.avgRate', fmt: fmtV },
  { group: '',               groupBg: BG.sampleSales, sub: 'Value (₹)',    key: 'sampleSales.value',   fmt: fmtV },
  // Union Sales
  { group: 'Union Sales',    groupBg: BG.union,       sub: 'Send Qty',     key: 'union.sendQty',       fmt: fmtQ },
  { group: '',               groupBg: BG.union,       sub: 'Recd Qty',     key: 'union.receivedQty',   fmt: fmtQ },
  { group: '',               groupBg: BG.union,       sub: 'Avg Rate',     key: 'union.avgRate',       fmt: fmtV },
  { group: '',               groupBg: BG.union,       sub: 'Value (₹)',    key: 'union.value',         fmt: fmtV },
  { group: '',               groupBg: BG.union,       sub: 'Spoilage',     key: 'union.spoilage',      fmt: fmtQ },
  { group: '',               groupBg: BG.union,       sub: 'Excess',       key: 'union.excess',        fmt: fmtQ },
  { group: '',               groupBg: BG.union,       sub: 'Shortage',     key: 'union.shortage',      fmt: fmtQ },
  // Sales Total
  { group: 'Sales Total',    groupBg: BG.salesTotal,  sub: 'Qty (Ltr)',    key: 'salesTotal.qty',      fmt: fmtQ },
  { group: '',               groupBg: BG.salesTotal,  sub: 'Avg Rate',     key: 'salesTotal.avgRate',  fmt: fmtV },
  { group: '',               groupBg: BG.salesTotal,  sub: 'Value (₹)',    key: 'salesTotal.value',    fmt: fmtV },
  // Profit / Other
  { group: 'Profit (₹)',     groupBg: BG.profit,      sub: 'Profit',       key: 'profit',              fmt: fmtV },
  { group: 'Other Disposal', groupBg: BG.other,       sub: 'BMC',          key: 'bmc',                 fmt: fmtQ },
  { group: '',               groupBg: BG.other,       sub: 'Prod Unit',    key: 'prodUnit',            fmt: fmtQ },
];

// Groups for header row-1 with colSpan
const GROUP_SPANS = (() => {
  const spans = [];
  let i = 0;
  while (i < COLS.length) {
    const g = COLS[i].group;
    let span = 1;
    while (i + span < COLS.length && COLS[i + span].group === '') span++;
    spans.push({ label: g || COLS[i - 1]?.group, bg: COLS[i].groupBg, span });
    i += span;
  }
  return spans;
})();

// Helper to dig nested value from row object
const dig = (obj, path) => {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
};

// ── Component ──────────────────────────────────────────────────────────────
const DairyAbstractReport = () => {
  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]         = useState('financialYear');
  const [dateRange, setDateRange]   = useState(getPresetRange('financialYear'));
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
      const res = await reportAPI.dairyAbstract({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD'),
      });
      setReportData(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to load report', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const months     = reportData?.months     || [];
  const grandTotal = reportData?.grandTotal || null;
  const summary    = reportData?.summary    || null;

  // ── Export to Excel
  const handleExport = () => {
    if (!months.length) return;
    const rows = [
      ...months.map(m => ({
        'Month/Year':       fmtMonth(m.year, m.month),
        'Purchase Qty':     fmt3(m.purchase.qty),
        'Purchase Avg Rate':fmt2(m.purchase.avgRate),
        'Purchase Value':   fmt2(m.purchase.value),
        'Purchase Shortage':fmt3(m.purchase.shortage),
        'Purchase Excess':  fmt3(m.purchase.excess),
        'Handled Qty':      fmt3(m.purchase.handledQty),
        'Local Qty':        fmt3(m.localSales.qty),
        'Local Avg Rate':   fmt2(m.localSales.avgRate),
        'Local Value':      fmt2(m.localSales.value),
        'Credit Qty':       fmt3(m.creditSales.qty),
        'Credit Avg Rate':  fmt2(m.creditSales.avgRate),
        'Credit Value':     fmt2(m.creditSales.value),
        'School Qty':       fmt3(m.schoolSales.qty),
        'School Avg Rate':  fmt2(m.schoolSales.avgRate),
        'School Value':     fmt2(m.schoolSales.value),
        'Sample Qty':       fmt3(m.sampleSales.qty),
        'Sample Avg Rate':  fmt2(m.sampleSales.avgRate),
        'Sample Value':     fmt2(m.sampleSales.value),
        'Union Send Qty':   fmt3(m.union.sendQty),
        'Union Recd Qty':   fmt3(m.union.receivedQty),
        'Union Avg Rate':   fmt2(m.union.avgRate),
        'Union Value':      fmt2(m.union.value),
        'Union Spoilage':   fmt3(m.union.spoilage),
        'Union Excess':     fmt3(m.union.excess),
        'Union Shortage':   fmt3(m.union.shortage),
        'Sales Total Qty':  fmt3(m.salesTotal.qty),
        'Sales Avg Rate':   fmt2(m.salesTotal.avgRate),
        'Sales Total Value':fmt2(m.salesTotal.value),
        'Profit':           fmt2(m.profit),
        'BMC':              fmt3(m.bmc),
        'Prod Unit':        fmt3(m.prodUnit),
      })),
    ];
    if (grandTotal) {
      rows.push({
        'Month/Year': 'GRAND TOTAL',
        'Purchase Qty': fmt3(grandTotal.purchase.qty),
        'Purchase Avg Rate': fmt2(grandTotal.purchase.avgRate),
        'Purchase Value': fmt2(grandTotal.purchase.value),
        'Purchase Shortage': fmt3(grandTotal.purchase.shortage),
        'Purchase Excess': fmt3(grandTotal.purchase.excess),
        'Handled Qty': fmt3(grandTotal.purchase.handledQty),
        'Local Qty': fmt3(grandTotal.localSales.qty),
        'Local Avg Rate': fmt2(grandTotal.localSales.avgRate),
        'Local Value': fmt2(grandTotal.localSales.value),
        'Credit Qty': fmt3(grandTotal.creditSales.qty),
        'Credit Avg Rate': fmt2(grandTotal.creditSales.avgRate),
        'Credit Value': fmt2(grandTotal.creditSales.value),
        'School Qty': fmt3(grandTotal.schoolSales.qty),
        'School Avg Rate': fmt2(grandTotal.schoolSales.avgRate),
        'School Value': fmt2(grandTotal.schoolSales.value),
        'Sample Qty': fmt3(grandTotal.sampleSales.qty),
        'Sample Avg Rate': fmt2(grandTotal.sampleSales.avgRate),
        'Sample Value': fmt2(grandTotal.sampleSales.value),
        'Union Send Qty': fmt3(grandTotal.union.sendQty),
        'Union Recd Qty': fmt3(grandTotal.union.receivedQty),
        'Union Avg Rate': fmt2(grandTotal.union.avgRate),
        'Union Value': fmt2(grandTotal.union.value),
        'Union Spoilage': fmt3(grandTotal.union.spoilage),
        'Union Excess': fmt3(grandTotal.union.excess),
        'Union Shortage': fmt3(grandTotal.union.shortage),
        'Sales Total Qty': fmt3(grandTotal.salesTotal.qty),
        'Sales Avg Rate': fmt2(grandTotal.salesTotal.avgRate),
        'Sales Total Value': fmt2(grandTotal.salesTotal.value),
        'Profit': fmt2(grandTotal.profit),
        'BMC': '0.000',
        'Prod Unit': '0.000',
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dairy Abstract');
    XLSX.writeFile(wb, `dairy_abstract_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Excel file downloaded', color: 'green' });
  };

  const [start, end] = dateRange;
  const periodLabel = start && end
    ? `${dayjs(start).format('DD/MM/YYYY')} TO ${dayjs(end).format('DD/MM/YYYY')}`
    : '—';

  // ── Summary card data
  const summaryCards1 = summary ? [
    { label: 'Collection Days',           value: summary.collectionDays, suffix: ' Days' },
    { label: 'Avg Purchase Rate',         value: fmt2(summary.avgPurchaseRate), suffix: ' ₹/Ltr' },
    { label: 'Total Shortage',            value: fmt3(summary.totalShortage), suffix: ' Ltr' },
    { label: 'Avg Production / Day',      value: fmt3(summary.avgProductionPerDay), suffix: ' Ltr' },
    { label: 'Avg Shortage / Day',        value: fmt3(summary.avgShortagePerDay), suffix: ' Ltr' },
    { label: 'Total Handled Qty',         value: fmt3(summary.totalHandledQty), suffix: ' Ltr' },
  ] : [];

  const summaryCards2 = grandTotal ? [
    { label: 'Total Purchase Value', value: `₹ ${fmt2(grandTotal.purchase.value)}`,   color: '#0d6b5e' },
    { label: 'Local Sales Value',    value: `₹ ${fmt2(grandTotal.localSales.value)}`,  color: '#1a6e3c' },
    { label: 'Credit Sales Value',   value: `₹ ${fmt2(grandTotal.creditSales.value)}`, color: '#155e75' },
    { label: 'School Sales Value',   value: `₹ ${fmt2(grandTotal.schoolSales.value)}`, color: '#713f12' },
    { label: 'Union Sales Value',    value: `₹ ${fmt2(grandTotal.union.value)}`,        color: '#1e3a8a' },
    { label: 'Total Sales Value',    value: `₹ ${fmt2(grandTotal.salesTotal.value)}`,  color: '#7f1d1d' },
    { label: 'Net Profit / Loss',    value: `₹ ${fmt2(grandTotal.profit)}`,            color: grandTotal.profit >= 0 ? '#166534' : '#b91c1c' },
  ] : [];

  return (
    <Box p="md" ref={printRef}>

      {/* ── Header ── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden' }}>
        <Box style={{
          background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL2} 60%, ${TEAL3} 100%)`,
          padding: '14px 24px'
        }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Box style={{
                background: 'rgba(255,255,255,0.15)', borderRadius: 10,
                padding: '8px', display: 'flex', alignItems: 'center'
              }}>
                <IconDroplet size={26} color="#fff" />
              </Box>
              <Stack gap={0}>
                <Title order={4} c="white" style={{ letterSpacing: 0.5 }}>
                  Dairy Abstract Report
                </Title>
                <Text size="xs" c="rgba(255,255,255,0.75)">
                  Consolidated Dairy Register — {periodLabel}
                </Text>
              </Stack>
            </Group>
            <Badge size="lg" color="white" c={TEAL} variant="filled" radius="md">
              {months.length} Month{months.length !== 1 ? 's' : ''}
            </Badge>
          </Group>
        </Box>

        {/* Summary strip */}
        {summary && (
          <Box px="xl" py="sm" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' }}>
            <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="xs">
              {summaryCards1.map((c, i) => (
                <Box key={i} style={{ textAlign: 'center', padding: '4px 0' }}>
                  <Text size="xs" c="dimmed" fw={500}>{c.label}</Text>
                  <Text size="sm" fw={800} c={TEAL}>{c.value}{c.suffix}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Paper>

      {/* ── Filters ── */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select
            label="Period" size="sm" w={150}
            value={preset} onChange={handlePresetChange}
            data={PRESETS}
          />
          <DatePickerInput
            type="range" size="sm"
            label="Date Range" w={250}
            value={dateRange}
            onChange={(val) => { setDateRange(val); setPreset('custom'); }}
            leftSection={<IconCalendar size={14} />}
            clearable
          />
          <Button
            size="sm" onClick={fetchReport} loading={loading}
            leftSection={<IconRefresh size={14} />}
            style={{ background: TEAL }}
          >
            Generate Report
          </Button>
          {months.length > 0 && (
            <>
              <Button
                size="sm" variant="outline" color="teal"
                leftSection={<IconFileExport size={14} />}
                onClick={handleExport}
              >
                Export Excel
              </Button>
              <Button
                size="sm" variant="outline" color="gray"
                leftSection={<IconPrinter size={14} />}
                onClick={() => printReport(printRef, {
                  title: `Dairy Abstract Report — ${periodLabel}`,
                  orientation: 'landscape',
                  extraCss: `
                    table { font-size: 8px !important; }
                    th, td { padding: 3px 5px !important; }
                  `
                })}
              >
                Print
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* ── Table ── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }} mb="xl">
        {/* Table header bar */}
        <Box style={{
          background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL2} 100%)`,
          padding: '10px 18px'
        }}>
          <Group justify="space-between">
            <Stack gap={0}>
              <Text fw={800} c="white" size="sm" style={{ letterSpacing: 1 }}>
                DAIRY ABSTRACT FOR THE PERIOD OF {periodLabel}
              </Text>
              <Text size="xs" c="rgba(255,255,255,0.7)">Consolidated Dairy Register</Text>
            </Stack>
            <IconChartBar size={22} color="rgba(255,255,255,0.5)" />
          </Group>
        </Box>

        {loading ? (
          <Center py={60}><Loader color="teal" size="md" /></Center>
        ) : !reportData ? (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <IconMilk size={40} color="#94a3b8" />
              <Text c="dimmed" size="sm">Select a period and click Generate Report</Text>
            </Stack>
          </Center>
        ) : months.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <IconInbox size={40} color="#94a3b8" />
              <Text c="dimmed" size="sm">No data found for the selected period</Text>
            </Stack>
          </Center>
        ) : (
          <ScrollArea>
            <Table
              style={{ borderCollapse: 'collapse', tableLayout: 'auto' }}
              withColumnBorders
            >
              <Table.Thead>
                {/* Row 1: Group headers */}
                <Table.Tr>
                  <Table.Th
                    rowSpan={2}
                    style={{ ...thG(), minWidth: 90, verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 2 }}
                  >
                    Month{'\n'}Year
                  </Table.Th>
                  {GROUP_SPANS.map((g, i) => (
                    <Table.Th
                      key={i}
                      colSpan={g.span}
                      style={{ ...thG(g.bg), verticalAlign: 'middle' }}
                    >
                      {g.label}
                    </Table.Th>
                  ))}
                </Table.Tr>

                {/* Row 2: Sub-column headers */}
                <Table.Tr>
                  {COLS.map((c, i) => (
                    <Table.Th
                      key={i}
                      style={{ ...thG(c.groupBg), opacity: 0.9, minWidth: 70 }}
                    >
                      {c.sub}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {months.map((m, ri) => (
                  <Table.Tr
                    key={m.key}
                    style={{ background: ri % 2 === 0 ? '#fff' : '#f8fffe' }}
                  >
                    <Table.Td style={{ ...tdMonth, position: 'sticky', left: 0, zIndex: 1 }}>
                      {fmtMonth(m.year, m.month)}
                    </Table.Td>
                    {COLS.map((c, ci) => {
                      const val = dig(m, c.key);
                      return (
                        <Table.Td key={ci} style={tdR}>
                          {c.fmt(val)}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}

                {/* Grand total row */}
                {grandTotal && (
                  <Table.Tr>
                    <Table.Td style={{ ...tdTotalC(TEAL), position: 'sticky', left: 0, zIndex: 1, fontSize: 10 }}>
                      TOTAL
                    </Table.Td>
                    {/* Purchase */}
                    <Table.Td style={tdTotal(BG.purchase)}>{fmtQ(grandTotal.purchase.qty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.purchase)}>{fmtV(grandTotal.purchase.avgRate)}</Table.Td>
                    <Table.Td style={tdTotal(BG.purchase)}>{fmtV(grandTotal.purchase.value)}</Table.Td>
                    <Table.Td style={tdTotal(BG.purchase)}>{fmtQ(grandTotal.purchase.shortage)}</Table.Td>
                    <Table.Td style={tdTotal(BG.purchase)}>{fmtQ(grandTotal.purchase.excess)}</Table.Td>
                    <Table.Td style={tdTotal(BG.purchase)}>{fmtQ(grandTotal.purchase.handledQty)}</Table.Td>
                    {/* Local */}
                    <Table.Td style={tdTotal(BG.localSales)}>{fmtQ(grandTotal.localSales.qty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.localSales)}>{fmtV(grandTotal.localSales.avgRate)}</Table.Td>
                    <Table.Td style={tdTotal(BG.localSales)}>{fmtV(grandTotal.localSales.value)}</Table.Td>
                    {/* Credit */}
                    <Table.Td style={tdTotal(BG.creditSales)}>{fmtQ(grandTotal.creditSales.qty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.creditSales)}>{fmtV(grandTotal.creditSales.avgRate)}</Table.Td>
                    <Table.Td style={tdTotal(BG.creditSales)}>{fmtV(grandTotal.creditSales.value)}</Table.Td>
                    {/* School */}
                    <Table.Td style={tdTotal(BG.schoolSales)}>{fmtQ(grandTotal.schoolSales.qty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.schoolSales)}>{fmtV(grandTotal.schoolSales.avgRate)}</Table.Td>
                    <Table.Td style={tdTotal(BG.schoolSales)}>{fmtV(grandTotal.schoolSales.value)}</Table.Td>
                    {/* Sample */}
                    <Table.Td style={tdTotal(BG.sampleSales)}>{fmtQ(grandTotal.sampleSales.qty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.sampleSales)}>{fmtV(grandTotal.sampleSales.avgRate)}</Table.Td>
                    <Table.Td style={tdTotal(BG.sampleSales)}>{fmtV(grandTotal.sampleSales.value)}</Table.Td>
                    {/* Union */}
                    <Table.Td style={tdTotal(BG.union)}>{fmtQ(grandTotal.union.sendQty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.union)}>{fmtQ(grandTotal.union.receivedQty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.union)}>{fmtV(grandTotal.union.avgRate)}</Table.Td>
                    <Table.Td style={tdTotal(BG.union)}>{fmtV(grandTotal.union.value)}</Table.Td>
                    <Table.Td style={tdTotal(BG.union)}>{fmtQ(grandTotal.union.spoilage)}</Table.Td>
                    <Table.Td style={tdTotal(BG.union)}>{fmtQ(grandTotal.union.excess)}</Table.Td>
                    <Table.Td style={tdTotal(BG.union)}>{fmtQ(grandTotal.union.shortage)}</Table.Td>
                    {/* Sales Total */}
                    <Table.Td style={tdTotal(BG.salesTotal)}>{fmtQ(grandTotal.salesTotal.qty)}</Table.Td>
                    <Table.Td style={tdTotal(BG.salesTotal)}>{fmtV(grandTotal.salesTotal.avgRate)}</Table.Td>
                    <Table.Td style={tdTotal(BG.salesTotal)}>{fmtV(grandTotal.salesTotal.value)}</Table.Td>
                    {/* Profit + Other */}
                    <Table.Td style={tdTotal(grandTotal.profit >= 0 ? BG.profit : '#b91c1c')}>{fmtV(grandTotal.profit)}</Table.Td>
                    <Table.Td style={tdTotal(BG.other)}>-</Table.Td>
                    <Table.Td style={tdTotal(BG.other)}>-</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {/* Color legend */}
        {months.length > 0 && (
          <Box px="md" py="xs" style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <Group gap="lg" wrap="wrap">
              {[
                { color: BG.purchase,    label: 'Milk Purchase' },
                { color: BG.localSales,  label: 'Local Sales' },
                { color: BG.creditSales, label: 'Credit Sales' },
                { color: BG.schoolSales, label: 'School Sales' },
                { color: BG.sampleSales, label: 'Sample Sales' },
                { color: BG.union,       label: 'Union Sales' },
                { color: BG.salesTotal,  label: 'Sales Total' },
                { color: BG.profit,      label: 'Profit' },
                { color: BG.other,       label: 'Other' },
              ].map((l, i) => (
                <Group key={i} gap={4}>
                  <Box style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                  <Text size="xs" c="dimmed">{l.label}</Text>
                </Group>
              ))}
            </Group>
          </Box>
        )}
      </Paper>

      {/* ── Summary Cards ── */}
      {summary && grandTotal && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">

          {/* Left: Milk Purchase Summary */}
          <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
            <Box style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL2} 100%)`, padding: '10px 16px' }}>
              <Group gap="xs">
                <IconMilk size={16} color="white" />
                <Text fw={700} c="white" size="sm">Milk Purchase Summary</Text>
              </Group>
            </Box>
            <Box p="md">
              <Stack gap="xs">
                {[
                  { label: 'Collection Days',           value: `${summary.collectionDays} Days` },
                  { label: 'Average Purchase Rate',     value: `₹ ${fmt2(summary.avgPurchaseRate)} / Ltr` },
                  { label: 'Shortage (Ltr.)',            value: `${fmt3(summary.totalShortage)} Ltr` },
                  { label: 'Average Production / Day',  value: `${fmt3(summary.avgProductionPerDay)} Ltr` },
                  { label: 'Average Shortage / Day',    value: `${fmt3(summary.avgShortagePerDay)} Ltr` },
                  { label: 'Total Handled Qty',         value: `${fmt3(summary.totalHandledQty)} Ltr` },
                  { label: 'Total Purchase Qty',        value: `${fmt3(grandTotal.purchase.qty)} Ltr` },
                  { label: 'Total Purchase Value',      value: `₹ ${fmt2(grandTotal.purchase.value)}` },
                ].map((r, i) => (
                  <Group key={i} justify="space-between" style={{
                    borderBottom: i < 7 ? '1px dashed #e2e8f0' : 'none',
                    paddingBottom: 6
                  }}>
                    <Text size="sm" c="dimmed">{r.label}</Text>
                    <Text size="sm" fw={700} c={TEAL}>{r.value}</Text>
                  </Group>
                ))}
              </Stack>
            </Box>
          </Paper>

          {/* Right: Sales Summary */}
          <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
            <Box style={{ background: `linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)`, padding: '10px 16px' }}>
              <Group gap="xs">
                <IconChartBar size={16} color="white" />
                <Text fw={700} c="white" size="sm">Sales & Profit Summary</Text>
              </Group>
            </Box>
            <Box p="md">
              <Stack gap="xs">
                {summaryCards2.map((r, i) => (
                  <Group key={i} justify="space-between" style={{
                    borderBottom: i < summaryCards2.length - 1 ? '1px dashed #e2e8f0' : 'none',
                    paddingBottom: 6
                  }}>
                    <Text size="sm" c="dimmed">{r.label}</Text>
                    <Text size="sm" fw={700} style={{ color: r.color }}>{r.value}</Text>
                  </Group>
                ))}
              </Stack>
            </Box>
          </Paper>

        </SimpleGrid>
      )}
    </Box>
  );
};

export default DairyAbstractReport;
