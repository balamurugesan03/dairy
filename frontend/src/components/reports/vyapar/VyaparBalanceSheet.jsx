import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Group, Stack, Text, Title, Button, ActionIcon,
  Tooltip, Badge, Grid, Divider, LoadingOverlay, ThemeIcon,
  Table, Flex, Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconScale, IconPrinter, IconFileSpreadsheet, IconRefresh,
  IconCalendar, IconTrendingUp, IconTrendingDown,
  IconBuildingBank, IconCash, IconUsers, IconPackage,
  IconChartBar
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import * as XLSX from 'xlsx';

// Group label map
const GROUP_LABELS = {
  'Cash-in-Hand':      'Cash in Hand',
  'Bank Accounts':     'Bank Accounts',
  'Sundry Debtors':    'Sundry Debtors',
  'Stock-in-Hand':     'Stock in Hand',
  'Fixed Assets':      'Fixed Assets',
  'Current Assets':    'Current Assets',
  'Loans & Advances':  'Loans & Advances',
  'Investments':       'Investments',
  'Sundry Creditors':  'Sundry Creditors',
  'Current Liabilities':'Current Liabilities',
  'Duties & Taxes':    'Duties & Taxes',
  'Provisions':        'Provisions',
  'Suspense Account':  'Suspense Account',
  'Capital Account':   'Capital Account',
  'Reserves & Surplus':'Reserves & Surplus',
};

const ASSET_GROUP_ORDER = [
  'Cash-in-Hand','Bank Accounts','Stock-in-Hand','Sundry Debtors',
  'Current Assets','Loans & Advances','Fixed Assets','Investments'
];
const LIABILITY_GROUP_ORDER = [
  'Sundry Creditors','Current Liabilities','Duties & Taxes','Provisions','Suspense Account'
];
const CAPITAL_GROUP_ORDER = ['Capital Account','Reserves & Surplus'];

function groupBySection(items, groupOrder) {
  const map = {};
  for (const item of items) {
    const g = item.group || 'Other';
    if (!map[g]) map[g] = [];
    map[g].push(item);
  }
  const result = [];
  for (const g of groupOrder) {
    if (map[g]) { result.push({ group: g, label: GROUP_LABELS[g] || g, items: map[g] }); delete map[g]; }
  }
  for (const g of Object.keys(map)) {
    result.push({ group: g, label: GROUP_LABELS[g] || g, items: map[g] });
  }
  return result;
}

const fmt = (v) => `₹${Math.abs(parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SectionTable = ({ title, sections, grandTotal, accentColor }) => {
  const totalRows = sections.reduce((s, sec) => s + sec.items.length + 1, 0);
  if (totalRows === 0) return (
    <Box p="xl" ta="center">
      <Text c="dimmed" size="sm">No data</Text>
    </Box>
  );

  return (
    <Stack gap={0}>
      {sections.map((sec) => (
        <Box key={sec.group}>
          {/* Group header */}
          <Box px="md" py={6} style={{ background: '#f8fafc', borderBottom: '1px solid #e9ecef' }}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.5px' }}>
              {sec.label}
            </Text>
          </Box>
          {/* Items */}
          {sec.items.map((item, i) => (
            <Flex
              key={i}
              justify="space-between"
              align="center"
              px="md"
              py={7}
              style={{
                borderBottom: '1px solid #f1f3f5',
                background: item.isNetPL ? (item.ledgerName.includes('Profit') ? '#f0fdf4' : '#fff5f5') : 'white'
              }}
            >
              <Text size="sm" c={item.isNetPL ? (item.ledgerName.includes('Profit') ? 'green.7' : 'red.7') : 'dark'} fw={item.isNetPL ? 600 : 400}>
                {item.ledgerName}
              </Text>
              <Text size="sm" fw={600} c={item.balance < 0 ? 'red.6' : 'dark'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(item.balance)}
              </Text>
            </Flex>
          ))}
          {/* Section subtotal (if >1 item) */}
          {sec.items.length > 1 && (
            <Flex
              justify="space-between"
              px="md"
              py={6}
              style={{ background: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}
            >
              <Text size="xs" fw={700} c="dimmed">Total {sec.label}</Text>
              <Text size="xs" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmt(sec.items.reduce((s, i) => s + Math.abs(i.balance), 0))}
              </Text>
            </Flex>
          )}
        </Box>
      ))}

      {/* Grand Total */}
      <Flex
        justify="space-between"
        align="center"
        px="md"
        py={10}
        style={{ background: accentColor, borderTop: `2px solid ${accentColor === '#e8f5e9' ? '#a5d6a7' : '#ef9a9a'}` }}
      >
        <Text fw={800} size="sm" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Grand Total</Text>
        <Text fw={800} size="md" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(grandTotal)}</Text>
      </Flex>
    </Stack>
  );
};

const VyaparBalanceSheet = () => {
  const { selectedBusinessType, selectedCompany } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);
  const [fromDate, setFromDate]     = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate]         = useState(new Date());
  const asOnDate = toDate;

  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async (from, to) => {
    const t = to || toDate;
    setLoading(true);
    try {
      // Balance Sheet is cumulative — only asOnDate matters, not fromDate
      const res = await reportAPI.vyaparBalanceSheet({
        asOnDate: dayjs(t).format('YYYY-MM-DD')
      });
      setReportData(res.data);
    } catch (err) {
      message.error(err.message || 'Failed to fetch balance sheet');
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset) => {
    const today = dayjs();
    let f, t;
    if (preset === 'today') {
      f = today.startOf('day').toDate();
      t = today.toDate();
    } else if (preset === 'lastMonth') {
      f = today.subtract(1, 'month').startOf('month').toDate();
      t = today.subtract(1, 'month').endOf('month').toDate();
    } else if (preset === 'financialYear') {
      const fyStartYear = today.month() >= 3 ? today.year() : today.year() - 1;
      f = dayjs(`${fyStartYear}-04-01`).toDate();
      t = dayjs(`${fyStartYear + 1}-03-31`).toDate();
    }
    setFromDate(f);
    setToDate(t);
    fetchReport(f, t);
  };

  const handleExport = () => {
    if (!reportData) return;
    const rows = [
      [selectedCompany?.companyName || 'Company'],
      [`BALANCE SHEET AS ON ${dayjs(asOnDate).format('DD-MMM-YYYY')}`],
      [],
      ['LIABILITIES & CAPITAL', '', 'ASSETS', ''],
      ['Particular', 'Amount (₹)', 'Particular', 'Amount (₹)']
    ];

    const liabCap = [...(reportData.liabilities || []), ...(reportData.capital || [])];
    const assets  = reportData.assets || [];
    const maxLen = Math.max(liabCap.length, assets.length);

    for (let i = 0; i < maxLen; i++) {
      const l = liabCap[i];
      const a = assets[i];
      rows.push([
        l ? l.ledgerName : '', l ? fmt(l.balance) : '',
        a ? a.ledgerName : '', a ? fmt(a.balance) : ''
      ]);
    }
    rows.push(['TOTAL', fmt(reportData.summary?.liabilitiesAndCapital || 0), 'TOTAL', fmt(reportData.summary?.totalAssets || 0)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 36 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
    XLSX.writeFile(wb, `balance_sheet_${dayjs(asOnDate).format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported successfully');
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Balance Sheet</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Segoe UI',sans-serif;font-size:10px;color:#1a1a2e}
        .header{text-align:center;padding:12px 0;border-bottom:2px solid #1a1a2e;margin-bottom:12px}
        .company{font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:2px}
        .title{font-size:12px;font-weight:600;letter-spacing:4px;margin:4px 0}
        .date{font-size:10px;color:#555}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .side{border:1px solid #ccc;border-radius:4px;overflow:hidden}
        .side-header{padding:6px 10px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1px}
        .liab-header{background:#ffebee;color:#c62828}
        .asset-header{background:#e8f5e9;color:#2e7d32}
        .group-hdr{background:#f5f5f5;padding:4px 10px;font-weight:700;font-size:8px;text-transform:uppercase;color:#666;border-bottom:1px solid #eee}
        .row{display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #f0f0f0;font-size:9px}
        .subtotal{background:#f1f3f5;font-weight:600;padding:3px 10px;display:flex;justify-content:space-between;font-size:9px;border-bottom:2px solid #ddd}
        .grand{background:#e8e8f0;font-weight:800;padding:6px 10px;display:flex;justify-content:space-between;font-size:10px;border-top:2px solid #333}
        @page{size:A4 landscape;margin:8mm}
      </style>
    </head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const liabCapItems = [...(reportData?.liabilities || []), ...(reportData?.capital || [])];
  const liabSections = groupBySection(
    reportData?.liabilities || [],
    LIABILITY_GROUP_ORDER
  );
  const capSections  = groupBySection(
    reportData?.capital || [],
    CAPITAL_GROUP_ORDER
  );
  const assetSections = groupBySection(
    reportData?.assets || [],
    ASSET_GROUP_ORDER
  );

  const liabCapTotal = (reportData?.summary?.totalLiabilities || 0) + (reportData?.summary?.totalCapital || 0);
  const totalAssets  = reportData?.summary?.totalAssets || 0;
  const isBalanced   = Math.abs(totalAssets - liabCapTotal) < 1;
  const netPL        = reportData?.summary?.netPL || 0;

  return (
    <Box p="md" pos="relative">
      <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} zIndex={1000} />

      {/* ── Toolbar ── */}
      <Paper withBorder shadow="xs" p="md" mb="md" radius="md">
        <Flex justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="indigo" radius="md">
              <IconScale size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4} fw={700}>Balance Sheet</Title>
              <Text size="xs" c="dimmed">As on date financial position</Text>
            </Box>
          </Group>

          <Group gap="xs">
            <DatePickerInput
              label="From Date"
              value={fromDate}
              onChange={(d) => setFromDate(d)}
              valueFormat="DD/MM/YYYY"
              leftSection={<IconCalendar size={15} />}
              size="sm"
              w={155}
              clearable={false}
              maxDate={toDate}
            />
            <DatePickerInput
              label="To Date"
              value={toDate}
              onChange={(d) => setToDate(d)}
              valueFormat="DD/MM/YYYY"
              leftSection={<IconCalendar size={15} />}
              size="sm"
              w={155}
              clearable={false}
              minDate={fromDate}
              maxDate={new Date()}
            />

            <Button size="sm" mt={18} radius="md" onClick={() => fetchReport()}>
              Generate
            </Button>

            <Group gap={4} mt={18}>
              <Button size="xs" variant="light" color="blue" radius="md" onClick={() => applyPreset('today')}>
                Today
              </Button>
              <Button size="xs" variant="light" color="teal" radius="md" onClick={() => applyPreset('lastMonth')}>
                Last Month
              </Button>
              <Button size="xs" variant="light" color="violet" radius="md" onClick={() => applyPreset('financialYear')}>
                Financial Year
              </Button>
            </Group>

            <Tooltip label="Refresh">
              <ActionIcon variant="light" size="lg" mt={18} onClick={() => fetchReport()}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Export Excel">
              <ActionIcon variant="light" color="green" size="lg" mt={18} onClick={handleExport} disabled={!reportData}>
                <IconFileSpreadsheet size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print">
              <ActionIcon variant="light" color="blue" size="lg" mt={18} onClick={handlePrint} disabled={!reportData}>
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Flex>
      </Paper>

      {/* ── Summary Cards ── */}
      {reportData && (
        <Grid mb="md" gutter="md">
          <Grid.Col span={3}>
            <Paper withBorder radius="md" p="md" style={{ borderLeft: '4px solid #339af0' }}>
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" fw={500}>Total Assets</Text>
                  <Text fw={800} size="lg" c="blue.7">{fmt(totalAssets)}</Text>
                </Box>
                <ThemeIcon size="xl" variant="light" color="blue" radius="md">
                  <IconBuildingBank size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
          </Grid.Col>
          <Grid.Col span={3}>
            <Paper withBorder radius="md" p="md" style={{ borderLeft: '4px solid #f03e3e' }}>
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" fw={500}>Total Liabilities</Text>
                  <Text fw={800} size="lg" c="red.7">{fmt(reportData.summary?.totalLiabilities || 0)}</Text>
                </Box>
                <ThemeIcon size="xl" variant="light" color="red" radius="md">
                  <IconUsers size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
          </Grid.Col>
          <Grid.Col span={3}>
            <Paper withBorder radius="md" p="md" style={{ borderLeft: '4px solid #40c057' }}>
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" fw={500}>Capital & Reserves</Text>
                  <Text fw={800} size="lg" c="green.7">{fmt(reportData.summary?.totalCapital || 0)}</Text>
                </Box>
                <ThemeIcon size="xl" variant="light" color="green" radius="md">
                  <IconCash size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
          </Grid.Col>
          <Grid.Col span={3}>
            <Paper withBorder radius="md" p="md" style={{ borderLeft: `4px solid ${netPL >= 0 ? '#40c057' : '#f03e3e'}` }}>
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" fw={500}>{netPL >= 0 ? 'Net Profit' : 'Net Loss'}</Text>
                  <Text fw={800} size="lg" c={netPL >= 0 ? 'green.7' : 'red.7'}>{fmt(netPL)}</Text>
                </Box>
                <ThemeIcon size="xl" variant="light" color={netPL >= 0 ? 'green' : 'red'} radius="md">
                  {netPL >= 0 ? <IconTrendingUp size={22} /> : <IconTrendingDown size={22} />}
                </ThemeIcon>
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>
      )}

      {/* ── Balance Status Banner ── */}
      {reportData && (
        <Paper
          withBorder radius="md" p="xs" mb="md"
          style={{ background: isBalanced ? '#f0fdf4' : '#fff5f5', borderColor: isBalanced ? '#86efac' : '#fca5a5' }}
        >
          <Group justify="center" gap="xs">
            <Badge size="lg" color={isBalanced ? 'green' : 'red'} variant="light" radius="md">
              {isBalanced ? '✓ Balance Sheet is Balanced' : `⚠ Difference: ${fmt(Math.abs(totalAssets - liabCapTotal))}`}
            </Badge>
            <Text size="sm" c="dimmed">{dayjs(fromDate).format('DD MMM YYYY')} — {dayjs(toDate).format('DD MMM YYYY')}</Text>
          </Group>
        </Paper>
      )}

      {/* ── Main Balance Sheet ── */}
      {reportData && (
        <div ref={printRef}>
          {/* Print Header (hidden on screen) */}
          <Box className="header" style={{ display: 'none' }}>
            <div className="company">{selectedCompany?.companyName || 'Company'}</div>
            <div className="title">BALANCE SHEET</div>
            <div className="date">As on {dayjs(asOnDate).format('DD MMMM YYYY')}</div>
          </Box>

          <Grid gutter="md">
            {/* ── LEFT: Liabilities + Capital ── */}
            <Grid.Col span={6}>
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                {/* Header */}
                <Box px="md" py={10} style={{ background: '#ffebee', borderBottom: '2px solid #ef9a9a' }}>
                  <Group justify="space-between">
                    <Text fw={800} size="sm" tt="uppercase" c="red.8" style={{ letterSpacing: '1px' }}>
                      Liabilities &amp; Capital
                    </Text>
                    <Text fw={700} size="sm" c="red.7">{fmt(liabCapTotal)}</Text>
                  </Group>
                </Box>

                {/* Liabilities */}
                {liabSections.length > 0 && (
                  <>
                    <Box px="md" py={6} style={{ background: '#fce4ec', borderBottom: '1px solid #f48fb1' }}>
                      <Text size="xs" fw={800} tt="uppercase" c="red.9" style={{ letterSpacing: '1px' }}>Liabilities</Text>
                    </Box>
                    <SectionTable
                      sections={liabSections}
                      grandTotal={reportData.summary?.totalLiabilities || 0}
                      accentColor="#ffebee"
                    />
                  </>
                )}

                {/* Capital */}
                {capSections.length > 0 && (
                  <>
                    <Box px="md" py={6} style={{ background: '#ede7f6', borderTop: '2px solid #ce93d8', borderBottom: '1px solid #ce93d8' }}>
                      <Text size="xs" fw={800} tt="uppercase" c="violet.9" style={{ letterSpacing: '1px' }}>Capital &amp; Reserves</Text>
                    </Box>
                    <SectionTable
                      sections={capSections}
                      grandTotal={reportData.summary?.totalCapital || 0}
                      accentColor="#ede7f6"
                    />
                  </>
                )}

                {liabSections.length === 0 && capSections.length === 0 && (
                  <Box p="xl" ta="center">
                    <Text c="dimmed" size="sm">No liabilities or capital data</Text>
                  </Box>
                )}
              </Paper>
            </Grid.Col>

            {/* ── RIGHT: Assets ── */}
            <Grid.Col span={6}>
              <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                {/* Header */}
                <Box px="md" py={10} style={{ background: '#e8f5e9', borderBottom: '2px solid #a5d6a7' }}>
                  <Group justify="space-between">
                    <Text fw={800} size="sm" tt="uppercase" c="green.8" style={{ letterSpacing: '1px' }}>
                      Assets
                    </Text>
                    <Text fw={700} size="sm" c="green.7">{fmt(totalAssets)}</Text>
                  </Group>
                </Box>

                {assetSections.length > 0 ? (
                  <SectionTable
                    sections={assetSections}
                    grandTotal={totalAssets}
                    accentColor="#e8f5e9"
                  />
                ) : (
                  <Box p="xl" ta="center">
                    <Text c="dimmed" size="sm">No asset data</Text>
                  </Box>
                )}
              </Paper>
            </Grid.Col>
          </Grid>
        </div>
      )}

      {/* ── Empty State ── */}
      {!reportData && !loading && (
        <Paper withBorder radius="md" p="xl" ta="center">
          <ThemeIcon size={60} variant="light" color="gray" radius="xl" mx="auto" mb="md">
            <IconChartBar size={30} />
          </ThemeIcon>
          <Text c="dimmed" fw={500}>Select a date and click Refresh to generate the Balance Sheet</Text>
        </Paper>
      )}
    </Box>
  );
};

export default VyaparBalanceSheet;
