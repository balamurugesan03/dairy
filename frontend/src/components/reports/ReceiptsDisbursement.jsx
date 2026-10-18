import React, { useState, useMemo } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { reportAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { printRDStatement, rdDocHtml, RD_CSS } from './shared/rdPrint';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Stack, Loader, Center, ThemeIcon, Container
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

const COLUMN_FORMAT_OPTS = [
  { value: 'single', label: 'Single Column' },
  { value: 'two',    label: 'Two Column' },
  { value: 'three',  label: 'Three Column' }
];

const CATEGORY_LABELS = {
  ASSETS: 'Assets', LIABILITIES: 'Liabilities', INCOME: 'Income',
  EXPENSES: 'Expenses', CAPITAL: 'Capital & Reserves', OTHER: 'Other'
};

const fz      = (n) => parseFloat(n || 0).toFixed(2);
const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';

// Group header text: "Trade Income (INCOME)" for Account Group Wise.
const sectionLabel = (groupBy, sec) => {
  if (groupBy === 'category') return CATEGORY_LABELS[sec.sectionName] || sec.sectionName;
  if (groupBy === 'accountGroup' && sec.parentGroup) return `${sec.sectionName} (${sec.parentGroup})`;
  return sec.sectionName;
};

// ═════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════
const ReceiptsDisbursement = () => {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const societyCode = selectedCompany?.societyCode || '';

  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset]         = useState('thisMonth');
  const [dateRange, setDateRange]   = useState(getPresetRange('thisMonth'));
  const [groupBy, setGroupBy]       = useState('accountGroup');       // Account Group Wise is the default/first preference
  const [columnFormat, setColumnFormat] = useState('single');         // single | two | three

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
      message.error(err.message || 'Failed to fetch Receipt and Disbursements');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupByChange = (val) => {
    if (!val) return;
    setGroupBy(val);
    if (reportData) fetchReport(val); // grouping is computed server-side
  };

  // Shared by screen and print so both render the identical statement.
  const docOpts = useMemo(() => reportData?.sections && ({
    data: {
      ...reportData,
      sections: reportData.sections.map(sec => ({ ...sec, sectionName: sectionLabel(reportData.groupBy, sec) }))
    },
    columnFormat,
    showGroups: reportData.groupBy !== 'ledger',
    totalLabel: reportData.groupBy === 'category' ? 'Category Total' : 'Account Group Total',
    companyName,
    societyCode,
    dateRange
  }), [reportData, columnFormat, companyName, societyCode, dateRange]);

  // ── Print ─────────────────────────────────────────────────────────────
  // A4 portrait for Single / Two Column, landscape for Three Column.
  const handlePrint = () => {
    if (!docOpts) { message.error('Generate the report first'); return; }
    printRDStatement(docOpts);
  };

  // ── Excel Export — full detail (Cash/Adjustment/Total + Upto/During/End),
  //    regardless of which column format is currently on screen ──────────
  const handleExport = () => {
    if (!reportData?.sections?.length) { message.error('Generate the report first'); return; }
    const rows = [];
    rows.push([companyName.toUpperCase() + ' – RECEIPT AND DISBURSEMENTS']);
    rows.push([`Period: ${fmtDate(dateRange[0])} to ${fmtDate(dateRange[1])}`, `View: ${GROUP_BY_OPTS.find(o => o.value === groupBy)?.label}`]);
    rows.push([]);
    rows.push(['Ledger',
      'Receipt Adjustment', 'Receipt Cash', 'Receipt Total',
      'Payment Adjustment', 'Payment Cash', 'Payment Total',
      'Receipt Upto Month', 'Receipt During Month', 'Receipt End of Month',
      'Payment Upto Month', 'Payment During Month', 'Payment End of Month'
    ]);
    reportData.sections.forEach(sec => {
      const name = sectionLabel(reportData.groupBy, sec);
      rows.push([name]);
      sec.ledgers.forEach(item => {
        rows.push([item.ledgerName,
          item.receiptAdj || '', item.receiptCash || '', item.receiptTotal || '',
          item.paymentAdj || '', item.paymentCash || '', item.paymentTotal || '',
          item.uptoR || '', item.duringR || '', item.eomR || '',
          item.uptoP || '', item.duringP || '', item.eomP || ''
        ]);
      });
      rows.push([`Total – ${name}`,
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
    XLSX.utils.book_append_sheet(wb, ws, 'Receipt and Disbursements');
    XLSX.writeFile(wb, `Receipt_Disbursements_${dayjs(dateRange[0]).format('DDMMYYYY')}_${dayjs(dateRange[1]).format('DDMMYYYY')}.xlsx`);
    message.success('Exported to Excel');
  };

  // ── Summary figures (match whichever balance basis the active column
  //    format uses, so the fields and table always agree) ─────────────────
  const usingFY = columnFormat === 'three';
  const ob = usingFY ? (reportData?.openingBalanceFY ?? 0) : (reportData?.openingBalance ?? 0);
  const cb = usingFY ? (reportData?.closingBalanceFY ?? 0) : (reportData?.closingBalance ?? 0);
  const gt = reportData?.grandTotal || {};
  const totalReceipts = usingFY ? (gt.eomR || 0) : (gt.receiptTotal || 0);
  const totalPayments = usingFY ? (gt.eomP || 0) : (gt.paymentTotal || 0);

  const SUMMARY = [
    { label: 'Opening Balance', value: ob,            color: 'blue',  bg: 'blue.0',  Icon: IconWallet },
    { label: 'Total Receipts',  value: totalReceipts, color: 'green', bg: 'green.0', Icon: IconArrowUpRight },
    { label: 'Total Payments',  value: totalPayments, color: 'red',   bg: 'red.0',   Icon: IconArrowDownRight },
    { label: 'Closing Balance', value: cb,            color: 'teal',  bg: 'teal.0',  Icon: IconCurrencyRupee }
  ];

  const DOC_MAXW = columnFormat === 'single' ? 820 : columnFormat === 'two' ? 1000 : 1200;

  return (
    <Container size="xl" py="sm">
      <Group justify="space-between" align="center" mb="xs" wrap="wrap" gap="sm">
        <Group gap="sm">
          <ThemeIcon size={32} radius="md" color="indigo" variant="light"><IconReceipt size={18} /></ThemeIcon>
          <Title order={4}>Receipt and Disbursements</Title>
        </Group>
        <Group gap="xs">
          <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" onClick={handlePrint} size="xs" disabled={!reportData}>
            Print
          </Button>
          <Button leftSection={<IconFileExport size={16} />} variant="light" color="green" onClick={handleExport} size="xs" disabled={!reportData}>
            Export Excel
          </Button>
        </Group>
      </Group>

      {/* ── Filters — one row ── */}
      <Paper p="xs" mb="xs" withBorder data-no-print>
        <Group gap="sm" wrap="nowrap" align="flex-end" style={{ overflowX: 'auto' }}>
          <Select label="Period" value={preset} onChange={handlePresetChange} data={PRESETS} w={135} size="xs" />
          <DatePickerInput
            label="From Date" value={dateRange[0]}
            onChange={(val) => { setDateRange([val, dateRange[1]]); setPreset('custom'); }}
            leftSection={<IconCalendar size={14} />} w={130} size="xs"
          />
          <DatePickerInput
            label="To Date" value={dateRange[1]}
            onChange={(val) => { setDateRange([dateRange[0], val]); setPreset('custom'); }}
            leftSection={<IconCalendar size={14} />} w={130} size="xs"
          />
          <Select label="Report View" value={groupBy} onChange={handleGroupByChange} data={GROUP_BY_OPTS} w={170} size="xs" allowDeselect={false} />
          <Select label="Column Format" value={columnFormat} onChange={(v) => v && setColumnFormat(v)} data={COLUMN_FORMAT_OPTS} w={145} size="xs" allowDeselect={false} />
          <Button leftSection={<IconRefresh size={14} />} onClick={() => fetchReport()} loading={loading} size="xs">
            Generate
          </Button>
        </Group>
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
          {/* Summary fields — compact, same logic across all three formats */}
          <Group gap="xs" mb="xs" wrap="wrap" data-no-print>
            {SUMMARY.map(({ label, value, color, bg, Icon }) => (
              <Paper key={label} px={8} py={4} withBorder bg={bg} w={140}>
                <Group gap={6} wrap="nowrap">
                  <Icon size={16} color={`var(--mantine-color-${color}-6)`} />
                  <div><Text size="xs" c="dimmed" lh={1.2}>{label}</Text><Text size="sm" fw={700} c={color}>{fz(value)}</Text></div>
                </Group>
              </Paper>
            ))}
          </Group>

          <Paper withBorder shadow="sm" style={{ overflow: 'auto', background: '#fff' }}>
            <Box p="md">
              <style>{RD_CSS}</style>
              {reportData.sections.length === 0 ? (
                <Center py={40}><Text c="dimmed">No transactions found for this period</Text></Center>
              ) : (
                <div
                  className="rd-doc"
                  style={{ maxWidth: DOC_MAXW, margin: '0 auto' }}
                  dangerouslySetInnerHTML={{ __html: rdDocHtml(docOpts) }}
                />
              )}
            </Box>
          </Paper>
        </>
      )}
    </Container>
  );
};

export default ReceiptsDisbursement;
