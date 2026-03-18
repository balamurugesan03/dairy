import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Group, Stack, Grid, Card,
  ThemeIcon, Badge, Button, ActionIcon, Tooltip, Divider,
  Table, Box, Center, Pagination, Select, TextInput,
  LoadingOverlay, Tabs, SegmentedControl
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconReportAnalytics, IconShoppingCart, IconTruck,
  IconUsers, IconCurrencyRupee, IconFileSpreadsheet,
  IconPrinter, IconRefresh, IconSearch, IconCalendar,
  IconArrowUp, IconArrowDown, IconArrowsSort,
  IconReceipt, IconBuildingStore, IconPackage
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';

/* ── Constants ─────────────────────────────── */
const PER_PAGE = 15;

const QUICK_RANGES = [
  { value: 'today',         label: 'Today' },
  { value: 'yesterday',     label: 'Yesterday' },
  { value: 'thisWeek',      label: 'This Week' },
  { value: 'lastWeek',      label: 'Last Week' },
  { value: 'thisMonth',     label: 'This Month' },
  { value: 'lastMonth',     label: 'Last Month' },
  { value: 'thisQuarter',   label: 'This Quarter' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom',        label: 'Custom Range' },
];

/* ── Formatters ─────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n || 0);

const fmtQty = (n) => {
  const v = parseFloat(n || 0);
  return v % 1 === 0 ? v.toString() : v.toFixed(2);
};

/* ── Summary Card ───────────────────────────── */
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <Card withBorder radius="md" p="md" style={{ borderLeft: `3px solid var(--mantine-color-${color}-6)` }}>
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <div>
        <Text fz="xs" c="dimmed" fw={600} tt="uppercase" lh={1.2} mb={4}>{label}</Text>
        <Text fz="lg" fw={800} c={`${color}.8`} lh={1.1}>{value}</Text>
        {sub && <Text fz="xs" c="dimmed" mt={3}>{sub}</Text>}
      </div>
      <ThemeIcon size={40} radius="md" color={color} variant="light">
        <Icon size={20} />
      </ThemeIcon>
    </Group>
  </Card>
);

/* ── Sort Icon ───────────────────────────────── */
const SortIcon = ({ field, sortField, sortDir }) => {
  if (sortField !== field) return <IconArrowsSort size={12} style={{ opacity: 0.35 }} />;
  return sortDir === 'asc'
    ? <IconArrowUp size={12} style={{ opacity: 0.9 }} />
    : <IconArrowDown size={12} style={{ opacity: 0.9 }} />;
};

/* ── Party Type Badge ────────────────────────── */
const PartyBadge = ({ type }) => {
  const map = {
    Customer: { color: 'blue',   label: 'Customer' },
    Supplier: { color: 'orange', label: 'Supplier' },
    Cash:     { color: 'gray',   label: 'Cash' },
  };
  const cfg = map[type] || map.Cash;
  return (
    <Badge size="xs" radius="sm" variant="light" color={cfg.color}>
      {cfg.label}
    </Badge>
  );
};

/* ── Main Component ─────────────────────────── */
const VyaparItemReportByParty = () => {
  const { selectedBusinessType, selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Company';
  const navigate = useNavigate();

  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);

  // Filters
  const [filterType, setFilterType]   = useState('thisMonth');
  const [dateRange, setDateRange]     = useState([null, null]);
  const [selCategory, setSelCategory] = useState('all');
  const [selItem, setSelItem]         = useState('all');
  const [search, setSearch]           = useState('');
  const [partyTab, setPartyTab]       = useState('all'); // all | Customer | Supplier

  // Table
  const [page, setPage]           = useState(1);
  const [sortField, setSortField] = useState('totalAmount');
  const [sortDir, setSortDir]     = useState('desc');

  /* ── Guard ── */
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  /* ── Initial load ── */
  useEffect(() => { fetchReport({ filterType: 'thisMonth' }); }, []);

  /* ── Fetch ── */
  const fetchReport = async (override = {}) => {
    setLoading(true);
    try {
      const ft = override.filterType ?? filterType;
      const params = {
        filterType: ft,
        ...(override.customStart && { customStart: override.customStart }),
        ...(override.customEnd   && { customEnd:   override.customEnd   }),
        ...(selCategory !== 'all' && { categoryId: selCategory }),
        ...(selItem     !== 'all' && { itemId:     selItem     }),
        ...(search && { searchParty: search }),
      };
      const res = await reportAPI.vyaparItemByParty(params);
      setReportData(res.data);
      setPage(1);
    } catch (err) {
      message.error(err.message || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  /* ── Handlers ── */
  const handleQuickRange = (val) => {
    setFilterType(val);
    setDateRange([null, null]);
    fetchReport({ filterType: val });
  };

  const handleDateChange = (idx, date) => {
    const next = idx === 0 ? [date, dateRange[1]] : [dateRange[0], date];
    setDateRange(next);
    if (next[0] && next[1]) {
      setFilterType('custom');
      fetchReport({
        filterType: 'custom',
        customStart: dayjs(next[0]).format('YYYY-MM-DD'),
        customEnd:   dayjs(next[1]).format('YYYY-MM-DD'),
      });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  /* ── Derived ── */
  const allRecords = useMemo(() => {
    if (!reportData?.records) return [];
    // Add computed field
    return reportData.records.map(r => ({
      ...r,
      totalAmount: (r.saleAmount || 0) + (r.purchaseAmount || 0),
      netAmount:   (r.saleAmount || 0) - (r.purchaseAmount || 0),
    }));
  }, [reportData?.records]);

  const filteredRecords = useMemo(() => {
    let rows = allRecords;
    if (partyTab !== 'all') rows = rows.filter(r => r.partyType === partyTab);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.partyName?.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      let av = a[sortField] ?? 0;
      let bv = b[sortField] ?? 0;
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [allRecords, partyTab, search, sortField, sortDir]);

  const paged = useMemo(() => {
    const s = (page - 1) * PER_PAGE;
    return filteredRecords.slice(s, s + PER_PAGE);
  }, [filteredRecords, page]);

  const totalPages = Math.ceil(filteredRecords.length / PER_PAGE);

  const summary = useMemo(() => ({
    totalSaleAmount:     filteredRecords.reduce((s, r) => s + (r.saleAmount || 0), 0),
    totalPurchaseAmount: filteredRecords.reduce((s, r) => s + (r.purchaseAmount || 0), 0),
    totalSaleQty:        filteredRecords.reduce((s, r) => s + (r.saleQty || 0), 0),
    totalPurchaseQty:    filteredRecords.reduce((s, r) => s + (r.purchaseQty || 0), 0),
    totalParties:        filteredRecords.length,
    totalSaleBills:      filteredRecords.reduce((s, r) => s + (r.saleBillCount || 0), 0),
    totalPurchaseBills:  filteredRecords.reduce((s, r) => s + (r.purchaseBillCount || 0), 0),
  }), [filteredRecords]);

  const categoryOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Categories' }];
    (reportData?.categories || []).forEach(c => opts.push({ value: c, label: c }));
    return opts;
  }, [reportData?.categories]);

  const itemOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Items' }];
    let items = reportData?.items || [];
    if (selCategory !== 'all') items = items.filter(i => i.category === selCategory);
    items.forEach(i => opts.push({ value: i._id, label: i.itemName }));
    return opts;
  }, [reportData?.items, selCategory]);

  const periodLabel = useMemo(() => {
    if (filterType === 'custom' && dateRange[0] && dateRange[1])
      return `${dayjs(dateRange[0]).format('DD/MM/YYYY')} – ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`;
    return QUICK_RANGES.find(r => r.value === filterType)?.label || filterType;
  }, [filterType, dateRange]);

  /* ── Tab counts ── */
  const tabCounts = useMemo(() => ({
    all:      allRecords.length,
    Customer: allRecords.filter(r => r.partyType === 'Customer').length,
    Supplier: allRecords.filter(r => r.partyType === 'Supplier').length,
  }), [allRecords]);

  /* ── Th helper ── */
  const Th = ({ field, label, align = 'left', width }) => (
    <Table.Th
      onClick={() => handleSort(field)}
      style={{
        background: '#1565c0', color: '#fff', fontWeight: 600,
        fontSize: 11, cursor: 'pointer', userSelect: 'none',
        textAlign: align, whiteSpace: 'nowrap', width,
        padding: '10px 12px',
      }}
    >
      <Group gap={4} justify={align === 'right' ? 'flex-end' : 'flex-start'} wrap="nowrap">
        <span>{label}</span>
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </Group>
    </Table.Th>
  );

  /* ── Excel Export ── */
  const handleExport = () => {
    if (!filteredRecords.length) { message.warning('No data to export'); return; }
    const rows = filteredRecords.map((r, i) => ({
      '#':              i + 1,
      'Party Name':     r.partyName,
      'Party Type':     r.partyType || '',
      'Sale Bills':     r.saleBillCount || 0,
      'Sale Qty':       parseFloat((r.saleQty || 0).toFixed(2)),
      'Sale Amount':    parseFloat((r.saleAmount || 0).toFixed(2)),
      'Purchase Bills': r.purchaseBillCount || 0,
      'Purchase Qty':   parseFloat((r.purchaseQty || 0).toFixed(2)),
      'Purchase Amount':parseFloat((r.purchaseAmount || 0).toFixed(2)),
      'Net (S-P)':      parseFloat(((r.saleAmount || 0) - (r.purchaseAmount || 0)).toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ItemByParty');
    XLSX.writeFile(wb, `Item_By_Party_${dayjs().format('DD-MM-YYYY')}.xlsx`);
    message.success('Exported successfully');
  };

  /* ── Print ── */
  const handlePrint = () => {
    const rows = filteredRecords.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          ${r.partyName}
          <span class="badge ${(r.partyType || '').toLowerCase()}">${r.partyType || ''}</span>
        </td>
        <td class="num">${(r.saleBillCount || 0) + (r.purchaseBillCount || 0)}</td>
        <td class="num">${fmtQty(r.saleQty)}</td>
        <td class="num grn">${fmt(r.saleAmount)}</td>
        <td class="num">${fmtQty(r.purchaseQty)}</td>
        <td class="num red">${fmt(r.purchaseAmount)}</td>
        <td class="num ${(r.saleAmount || 0) >= (r.purchaseAmount || 0) ? 'grn' : 'red'}">
          ${fmt((r.saleAmount || 0) - (r.purchaseAmount || 0))}
        </td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Item by Party Report</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;font-size:12px;color:#222}
    .hdr{text-align:center;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #1565c0}
    .hdr h1{font-size:20px;color:#1565c0;margin-bottom:3px}
    .hdr p{color:#666;font-size:11px}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
    .card{padding:10px 12px;border-radius:5px;border-left:3px solid}
    .cs{border-color:#2e7d32;background:#f1f8e9}.cl{font-size:9px;color:#555;font-weight:600;text-transform:uppercase;margin-bottom:2px}.cv{font-size:15px;font-weight:700;color:#1b5e20}
    .cp{border-color:#c62828;background:#ffebee}.cp .cv{color:#b71c1c}
    .cpt{border-color:#1565c0;background:#e3f2fd}.cpt .cv{color:#0d47a1}
    .cn{border-color:#e65100;background:#fff3e0}.cn .cv{color:#bf360c}
    table{width:100%;border-collapse:collapse;font-size:11px}
    thead th{background:#1565c0;color:#fff;padding:8px 10px;font-weight:600;text-align:left}
    thead th.num{text-align:right}
    tbody td{padding:6px 10px;border-bottom:1px solid #eee}
    tbody tr:nth-child(even){background:#fafafa}
    tfoot td{padding:8px 10px;font-weight:700;background:#e3f2fd;border-top:2px solid #1565c0}
    .num{text-align:right}.grn{color:#2e7d32;font-weight:600}.red{color:#c62828;font-weight:600}
    .badge{display:inline-block;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:5px;font-weight:600}
    .customer{background:#e3f2fd;color:#1565c0}.supplier{background:#fff3e0;color:#e65100}
    @media print{@page{size:A4 landscape;margin:10mm}body{padding:0}}
  </style>
</head>
<body>
  <div class="hdr">
    <h1>Item by Party Report</h1>
    <p>${companyName} &nbsp;|&nbsp; Period: ${periodLabel} &nbsp;|&nbsp; ${partyTab !== 'all' ? partyTab + 's only &nbsp;|&nbsp; ' : ''}Generated: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
  </div>
  <div class="cards">
    <div class="card cs"><div class="cl">Total Sales</div><div class="cv">${fmt(summary.totalSaleAmount)}</div><div style="font-size:10px;color:#555">Qty: ${fmtQty(summary.totalSaleQty)} | Bills: ${summary.totalSaleBills}</div></div>
    <div class="card cp"><div class="cl">Total Purchases</div><div class="cv">${fmt(summary.totalPurchaseAmount)}</div><div style="font-size:10px;color:#555">Qty: ${fmtQty(summary.totalPurchaseQty)} | Bills: ${summary.totalPurchaseBills}</div></div>
    <div class="card cpt"><div class="cl">Total Parties</div><div class="cv">${summary.totalParties}</div></div>
    <div class="card cn"><div class="cl">Net (Sale − Purchase)</div><div class="cv">${fmt(summary.totalSaleAmount - summary.totalPurchaseAmount)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Party Name</th><th class="num">Bills</th>
        <th class="num">Sale Qty</th><th class="num">Sale Amount</th>
        <th class="num">Purchase Qty</th><th class="num">Purchase Amount</th>
        <th class="num">Net</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:30px;color:#999">No data</td></tr>'}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total (${filteredRecords.length} parties)</td>
        <td class="num">${summary.totalSaleBills + summary.totalPurchaseBills}</td>
        <td class="num">${fmtQty(summary.totalSaleQty)}</td>
        <td class="num grn">${fmt(summary.totalSaleAmount)}</td>
        <td class="num">${fmtQty(summary.totalPurchaseQty)}</td>
        <td class="num red">${fmt(summary.totalPurchaseAmount)}</td>
        <td class="num">${fmt(summary.totalSaleAmount - summary.totalPurchaseAmount)}</td>
      </tr>
    </tfoot>
  </table>
</body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.print(); setTimeout(() => w.close(), 1000); };
  };

  /* ─── RENDER ─────────────────────────────── */
  return (
    <Container size="xl" py="md">
      <Stack gap="md">

        {/* ── Page Header ── */}
        <Paper withBorder radius="md" p="md"
          style={{ background: 'linear-gradient(135deg,#e3f2fd 0%,#f8f9fa 100%)', borderColor: '#90caf9' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={46} radius="md" color="blue" variant="light">
                <IconReportAnalytics size={24} />
              </ThemeIcon>
              <div>
                <Title order={3} c="blue.8" style={{ lineHeight: 1.2 }}>
                  Item by Party Report
                </Title>
                <Text fz="xs" c="dimmed">
                  Party-wise sales &amp; purchase summary &nbsp;•&nbsp; {periodLabel}
                </Text>
              </div>
            </Group>
            <Group gap="xs">
              <Tooltip label="Refresh">
                <ActionIcon size="lg" variant="light" color="blue" onClick={() => fetchReport()} loading={loading}>
                  <IconRefresh size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Export Excel">
                <ActionIcon size="lg" variant="light" color="teal" onClick={handleExport}>
                  <IconFileSpreadsheet size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Print">
                <ActionIcon size="lg" variant="light" color="indigo" onClick={handlePrint}>
                  <IconPrinter size={17} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {/* ── Summary Cards ── */}
        <Grid gutter="sm">
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <StatCard
              icon={IconShoppingCart} color="green" label="Total Sale Amount"
              value={fmt(summary.totalSaleAmount)}
              sub={`${fmtQty(summary.totalSaleQty)} qty • ${summary.totalSaleBills} bills`}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <StatCard
              icon={IconTruck} color="red" label="Total Purchase Amount"
              value={fmt(summary.totalPurchaseAmount)}
              sub={`${fmtQty(summary.totalPurchaseQty)} qty • ${summary.totalPurchaseBills} bills`}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <StatCard
              icon={IconUsers} color="blue" label="Total Parties"
              value={summary.totalParties}
              sub={`${tabCounts.Customer} customers • ${tabCounts.Supplier} suppliers`}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <StatCard
              icon={IconCurrencyRupee}
              color={summary.totalSaleAmount >= summary.totalPurchaseAmount ? 'orange' : 'red'}
              label="Net (Sale − Purchase)"
              value={fmt(summary.totalSaleAmount - summary.totalPurchaseAmount)}
            />
          </Grid.Col>
        </Grid>

        {/* ── Filter Bar ── */}
        <Paper withBorder radius="md" p="md" style={{ background: '#fafbfc' }}>
          <Group gap="md" align="flex-end" wrap="wrap">

            <Select
              label="Period"
              data={QUICK_RANGES}
              value={filterType}
              onChange={handleQuickRange}
              size="sm"
              w={155}
            />

            <Stack gap={4}>
              <Text fz="xs" c="dimmed" fw={500}>From – To</Text>
              <Group gap="xs" wrap="nowrap">
                <DatePickerInput
                  placeholder="Start date"
                  value={dateRange[0]}
                  onChange={d => handleDateChange(0, d)}
                  size="sm" w={128}
                  leftSection={<IconCalendar size={13} />}
                  valueFormat="DD/MM/YYYY"
                  clearable
                />
                <Text fz="sm" c="dimmed">–</Text>
                <DatePickerInput
                  placeholder="End date"
                  value={dateRange[1]}
                  onChange={d => handleDateChange(1, d)}
                  size="sm" w={128}
                  valueFormat="DD/MM/YYYY"
                  clearable
                />
              </Group>
            </Stack>

            <Select
              label="Category"
              data={categoryOptions}
              value={selCategory}
              onChange={v => { setSelCategory(v); setSelItem('all'); }}
              size="sm" w={170} searchable
            />

            <Select
              label="Item"
              data={itemOptions}
              value={selItem}
              onChange={v => { setSelItem(v); }}
              size="sm" w={190} searchable
            />

            <TextInput
              label="Search Party"
              placeholder="Name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              leftSection={<IconSearch size={13} />}
              size="sm" w={185}
            />

            <Button
              size="sm"
              variant="filled"
              color="blue"
              onClick={() => fetchReport()}
              leftSection={<IconRefresh size={14} />}
            >
              Apply
            </Button>
          </Group>
        </Paper>

        {/* ── Party Type Tabs ── */}
        <Tabs value={partyTab} onChange={v => { setPartyTab(v); setPage(1); }}>
          <Tabs.List>
            <Tabs.Tab value="all" leftSection={<IconUsers size={14} />}>
              All Parties
              <Badge ml={6} size="xs" variant="light" color="gray" radius="sm">{tabCounts.all}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="Customer" leftSection={<IconBuildingStore size={14} />}>
              Customers
              <Badge ml={6} size="xs" variant="light" color="blue" radius="sm">{tabCounts.Customer}</Badge>
            </Tabs.Tab>
            <Tabs.Tab value="Supplier" leftSection={<IconPackage size={14} />}>
              Suppliers
              <Badge ml={6} size="xs" variant="light" color="orange" radius="sm">{tabCounts.Supplier}</Badge>
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* ── Data Table ── */}
        <Paper withBorder radius="md" style={{ overflow: 'hidden', position: 'relative' }}>
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

          {/* Table meta bar */}
          <Box px="md" py="xs"
            style={{ background: 'linear-gradient(90deg,#e3f2fd,#f5f7fa)', borderBottom: '1px solid #e0e0e0' }}>
            <Group justify="space-between">
              <Text fz="sm" fw={600} c="blue.8">
                {filteredRecords.length} {filteredRecords.length === 1 ? 'party' : 'parties'}
                {partyTab !== 'all' && ` (${partyTab}s only)`}
              </Text>
              {totalPages > 1 && (
                <Text fz="xs" c="dimmed">Page {page} of {totalPages}</Text>
              )}
            </Group>
          </Box>

          <div style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withColumnBorders={false} style={{ minWidth: 860 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ background: '#1565c0', color: '#fff', fontWeight: 600,
                    fontSize: 11, width: 44, padding: '10px 12px' }}>
                    #
                  </Table.Th>
                  <Th field="partyName"       label="Party Name"        />
                  <Th field="saleBillCount"    label="Sale Bills"        align="right" width={80} />
                  <Th field="saleQty"          label="Sale Qty"          align="right" width={90} />
                  <Th field="saleAmount"       label="Sale Amount"       align="right" width={130} />
                  <Th field="purchaseBillCount" label="Pur. Bills"       align="right" width={80} />
                  <Th field="purchaseQty"      label="Purchase Qty"      align="right" width={100} />
                  <Th field="purchaseAmount"   label="Purchase Amount"   align="right" width={140} />
                  <Th field="netAmount"        label="Net (S−P)"         align="right" width={130} />
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {paged.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Center py={70}>
                        <Stack align="center" gap="sm">
                          <ThemeIcon size={72} radius="50%" color="gray" variant="light">
                            <IconReportAnalytics size={36} />
                          </ThemeIcon>
                          <Text fw={600} c="dimmed">No party data found</Text>
                          <Text fz="xs" c="dimmed">Adjust your filters or date range</Text>
                        </Stack>
                      </Center>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  paged.map((r, idx) => {
                    const net = (r.saleAmount || 0) - (r.purchaseAmount || 0);
                    return (
                      <Table.Tr key={r.partyId || idx}>
                        <Table.Td style={{ color: '#aaa', fontSize: 12, fontWeight: 500 }}>
                          {(page - 1) * PER_PAGE + idx + 1}
                        </Table.Td>

                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Text fz="sm" fw={600} style={{ lineHeight: 1.3 }}>
                              {r.partyName}
                            </Text>
                            <PartyBadge type={r.partyType} />
                          </Group>
                        </Table.Td>

                        {/* Sale bills */}
                        <Table.Td style={{ textAlign: 'right' }}>
                          {r.saleBillCount > 0 ? (
                            <Badge size="xs" variant="light" color="green" radius="sm">
                              {r.saleBillCount}
                            </Badge>
                          ) : <Text fz="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        <Table.Td style={{ textAlign: 'right', fontSize: 13 }}>
                          {r.saleQty > 0 ? fmtQty(r.saleQty) : <Text span fz="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13,
                          color: r.saleAmount > 0 ? '#2e7d32' : '#9e9e9e' }}>
                          {r.saleAmount > 0 ? fmt(r.saleAmount) : '—'}
                        </Table.Td>

                        {/* Purchase bills */}
                        <Table.Td style={{ textAlign: 'right' }}>
                          {r.purchaseBillCount > 0 ? (
                            <Badge size="xs" variant="light" color="orange" radius="sm">
                              {r.purchaseBillCount}
                            </Badge>
                          ) : <Text fz="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        <Table.Td style={{ textAlign: 'right', fontSize: 13 }}>
                          {r.purchaseQty > 0 ? fmtQty(r.purchaseQty) : <Text span fz="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13,
                          color: r.purchaseAmount > 0 ? '#c62828' : '#9e9e9e' }}>
                          {r.purchaseAmount > 0 ? fmt(r.purchaseAmount) : '—'}
                        </Table.Td>

                        {/* Net */}
                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13,
                          color: net > 0.01 ? '#1565c0' : net < -0.01 ? '#c62828' : '#9e9e9e' }}>
                          {Math.abs(net) > 0.01
                            ? <>{fmt(Math.abs(net))}<Text span fz={10} ml={3}>{net > 0 ? 'Cr' : 'Dr'}</Text></>
                            : '—'}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>

              {/* Totals Footer */}
              {filteredRecords.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#e3f2fd', borderTop: '2px solid #1565c0' }}>
                    <Table.Td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700,
                      color: '#1565c0', fontSize: 13 }}>
                      Grand Total
                      <Text span fz="xs" c="dimmed" fw={400} ml={6}>
                        ({filteredRecords.length} parties)
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700, padding: '10px 12px', fontSize: 13 }}>
                      {summary.totalSaleBills}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700, padding: '10px 12px', fontSize: 13 }}>
                      {fmtQty(summary.totalSaleQty)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 800, padding: '10px 12px',
                      fontSize: 13, color: '#2e7d32' }}>
                      {fmt(summary.totalSaleAmount)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700, padding: '10px 12px', fontSize: 13 }}>
                      {summary.totalPurchaseBills}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700, padding: '10px 12px', fontSize: 13 }}>
                      {fmtQty(summary.totalPurchaseQty)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 800, padding: '10px 12px',
                      fontSize: 13, color: '#c62828' }}>
                      {fmt(summary.totalPurchaseAmount)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 800, padding: '10px 12px',
                      fontSize: 13,
                      color: summary.totalSaleAmount >= summary.totalPurchaseAmount ? '#1565c0' : '#c62828' }}>
                      {fmt(Math.abs(summary.totalSaleAmount - summary.totalPurchaseAmount))}
                      <Text span fz={10} ml={3}>
                        {summary.totalSaleAmount >= summary.totalPurchaseAmount ? 'Cr' : 'Dr'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <>
              <Divider />
              <Box px="md" py="sm" style={{ background: '#f8f9fa' }}>
                <Group justify="space-between">
                  <Text fz="sm" c="dimmed">
                    Showing{' '}
                    <b>{(page - 1) * PER_PAGE + 1}</b>–<b>{Math.min(page * PER_PAGE, filteredRecords.length)}</b>
                    {' '}of <b>{filteredRecords.length}</b>
                  </Text>
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={totalPages}
                    size="sm"
                    radius="sm"
                    color="blue"
                  />
                </Group>
              </Box>
            </>
          )}
        </Paper>

      </Stack>
    </Container>
  );
};

export default VyaparItemReportByParty;
