import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import {
  Container,
  Title,
  Text,
  Paper,
  Box,
  Group,
  Stack,
  Grid,
  Select,
  TextInput,
  ActionIcon,
  Tooltip,
  Table,
  LoadingOverlay,
  Center,
  Divider,
  Badge,
  Pagination,
  Card,
  ThemeIcon
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet,
  IconPrinter,
  IconSearch,
  IconCalendar,
  IconSortAscending,
  IconSortDescending,
  IconArrowsSort,
  IconReportAnalytics,
  IconCurrencyRupee,
  IconShoppingCart,
  IconTruck,
  IconUsers
} from '@tabler/icons-react';

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const ITEMS_PER_PAGE = 15;

const QUICK_RANGES = [
  { value: 'today',       label: 'Today' },
  { value: 'yesterday',   label: 'Yesterday' },
  { value: 'thisWeek',    label: 'This Week' },
  { value: 'lastWeek',    label: 'Last Week' },
  { value: 'thisMonth',   label: 'This Month' },
  { value: 'lastMonth',   label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'thisYear',    label: 'This Year' },
  { value: 'custom',      label: 'Custom Range' }
];

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n || 0);

const fmtQty = (n) => parseFloat(n || 0).toFixed(2);

/* ─────────────────────────────────────────────
   Summary Card
───────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <Card withBorder radius="md" p="md" style={{ borderLeft: `4px solid ${color}` }}>
    <Group position="apart" noWrap>
      <div>
        <Text size="xs" color="dimmed" weight={500} transform="uppercase" mb={2}>
          {label}
        </Text>
        <Text size="lg" weight={700} color={color}>
          {value}
        </Text>
        {sub && (
          <Text size="xs" color="dimmed" mt={2}>
            {sub}
          </Text>
        )}
      </div>
      <ThemeIcon size={44} radius="md" color={color} variant="light">
        <Icon size={22} />
      </ThemeIcon>
    </Group>
  </Card>
);

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const VyaparItemReportByParty = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();

  const [loading, setLoading]       = useState(false);
  const [reportData, setReportData] = useState(null);

  // Filters
  const [filterType, setFilterType]           = useState('thisMonth');
  const [dateRange, setDateRange]             = useState([null, null]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem]       = useState('all');
  const [searchQuery, setSearchQuery]         = useState('');

  // Table
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField]     = useState('partyName');
  const [sortDir, setSortDir]         = useState('asc');

  /* redirect if wrong business type */
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  /* initial load */
  useEffect(() => {
    fetchReport({ filterType: 'thisMonth' });
  }, []);

  /* debounced search */
  useEffect(() => {
    const t = setTimeout(() => {
      if (reportData) fetchReport({ filterType });
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  /* ── Fetch ── */
  const fetchReport = async (filterData = {}) => {
    setLoading(true);
    try {
      const params = {
        filterType: filterData.filterType ?? filterType,
        ...(filterData.customStart && { customStart: filterData.customStart }),
        ...(filterData.customEnd   && { customEnd:   filterData.customEnd }),
        ...(selectedCategory !== 'all' && { categoryId: selectedCategory }),
        ...(selectedItem     !== 'all' && { itemId:     selectedItem }),
        ...(searchQuery && { searchParty: searchQuery })
      };
      const response = await reportAPI.vyaparItemByParty(params);
      setReportData(response.data);
      setCurrentPage(1);
    } catch (err) {
      message.error(err.message || 'Failed to fetch party report by item');
    } finally {
      setLoading(false);
    }
  };

  /* ── Filter handlers ── */
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
        filterType:  'custom',
        customStart: dayjs(next[0]).format('YYYY-MM-DD'),
        customEnd:   dayjs(next[1]).format('YYYY-MM-DD')
      });
    }
  };

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    setSelectedItem('all');
    fetchReport({ filterType });
  };

  const handleItemChange = (val) => {
    setSelectedItem(val);
    fetchReport({ filterType });
  };

  /* ── Sort ── */
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  /* ── Derived data ── */
  const processedRecords = useMemo(() => {
    if (!reportData?.records) return [];
    return [...reportData.records].sort((a, b) => {
      let av = a[sortField] ?? '';
      let bv = b[sortField] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [reportData?.records, sortField, sortDir]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [processedRecords, currentPage]);

  const totalPages = Math.ceil(processedRecords.length / ITEMS_PER_PAGE);

  const summary = reportData?.summary || {};

  const categoryOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Categories' }];
    (reportData?.categories || []).forEach((c) => opts.push({ value: c, label: c }));
    return opts;
  }, [reportData?.categories]);

  const itemOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Items' }];
    let items = reportData?.items || [];
    if (selectedCategory !== 'all') items = items.filter((i) => i.category === selectedCategory);
    items.forEach((i) => opts.push({ value: i._id, label: i.itemName }));
    return opts;
  }, [reportData?.items, selectedCategory]);

  /* ── Period label ── */
  const periodLabel = useMemo(() => {
    if (filterType === 'custom' && dateRange[0] && dateRange[1]) {
      return `${dayjs(dateRange[0]).format('DD/MM/YYYY')} – ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`;
    }
    return QUICK_RANGES.find((r) => r.value === filterType)?.label || filterType;
  }, [filterType, dateRange]);

  /* ── Export ── */
  const handleExport = () => {
    if (!processedRecords.length) { message.warning('No data to export'); return; }
    const csv = [
      ['#', 'Party Name', 'Party Type', 'Sale Qty', 'Sale Amount', 'Purchase Qty', 'Purchase Amount'],
      ...processedRecords.map((r, i) => [
        i + 1,
        r.partyName,
        r.partyType || '',
        fmtQty(r.saleQty),
        (r.saleAmount || 0).toFixed(2),
        fmtQty(r.purchaseQty),
        (r.purchaseAmount || 0).toFixed(2)
      ])
    ].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Party_Report_By_Item_${dayjs().format('DD-MM-YYYY')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Report exported successfully');
  };

  /* ── Print ── */
  const handlePrint = () => {
    const rows = processedRecords.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          ${r.partyName}
          ${r.partyType ? `<span class="badge badge-${r.partyType.toLowerCase()}">${r.partyType}</span>` : ''}
        </td>
        <td class="right">${fmtQty(r.saleQty)}</td>
        <td class="right sale">${fmt(r.saleAmount)}</td>
        <td class="right">${fmtQty(r.purchaseQty)}</td>
        <td class="right purchase">${fmt(r.purchaseAmount)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Party Report By Item</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;font-size:12px;color:#222}
    .header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1976d2}
    .header h1{color:#1976d2;font-size:22px;margin-bottom:4px}
    .header p{color:#666;font-size:11px}
    .meta{display:flex;gap:24px;margin-bottom:16px;padding:10px 14px;background:#f5f7fa;border-radius:6px;font-size:11px}
    .meta b{color:#333}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
    .card{padding:12px;border-radius:6px;border-left:4px solid}
    .card.sale{border-color:#2e7d32;background:#f1f8e9}
    .card.purchase{border-color:#c62828;background:#ffebee}
    .card.parties{border-color:#1976d2;background:#e3f2fd}
    .card.net{border-color:#f57c00;background:#fff3e0}
    .card-label{font-size:10px;color:#666;font-weight:600;text-transform:uppercase;margin-bottom:4px}
    .card-value{font-size:16px;font-weight:700}
    .card.sale .card-value{color:#2e7d32}
    .card.purchase .card-value{color:#c62828}
    .card.parties .card-value{color:#1976d2}
    .card.net .card-value{color:#f57c00}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    thead th{background:#1976d2;color:#fff;padding:9px 10px;font-size:11px;font-weight:600}
    thead th.right{text-align:right}
    tbody td{padding:7px 10px;border-bottom:1px solid #ebebeb;font-size:11px}
    tbody tr:nth-child(even){background:#fafafa}
    tfoot td{padding:10px;font-weight:700;font-size:12px;background:#e3f2fd;border-top:2px solid #1976d2}
    .right{text-align:right}
    .sale{color:#2e7d32;font-weight:600}
    .purchase{color:#c62828;font-weight:600}
    .badge{display:inline-block;font-size:9px;padding:1px 6px;border-radius:10px;margin-left:6px;font-weight:600}
    .badge-customer{background:#e3f2fd;color:#1565c0}
    .badge-supplier{background:#fff3e0;color:#e65100}
    @media print{@page{margin:12mm;size:A4 landscape}body{padding:0}}
  </style>
</head>
<body>
  <div class="header">
    <h1>Party Report by Item</h1>
    <p>Period: ${periodLabel} &nbsp;|&nbsp; Generated: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
  </div>
  <div class="cards">
    <div class="card sale">
      <div class="card-label">Total Sale Amount</div>
      <div class="card-value">${fmt(summary.totalSaleAmount)}</div>
    </div>
    <div class="card purchase">
      <div class="card-label">Total Purchase Amount</div>
      <div class="card-value">${fmt(summary.totalPurchaseAmount)}</div>
    </div>
    <div class="card parties">
      <div class="card-label">Total Parties</div>
      <div class="card-value">${processedRecords.length}</div>
    </div>
    <div class="card net">
      <div class="card-label">Net (Sale − Purchase)</div>
      <div class="card-value">${fmt((summary.totalSaleAmount || 0) - (summary.totalPurchaseAmount || 0))}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Party Name</th>
        <th class="right">Sale Qty</th><th class="right">Sale Amount</th>
        <th class="right">Purchase Qty</th><th class="right">Purchase Amount</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:30px;color:#999">No data available</td></tr>'}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total (${processedRecords.length} parties)</td>
        <td class="right">${fmtQty(summary.totalSaleQty)}</td>
        <td class="right sale">${fmt(summary.totalSaleAmount)}</td>
        <td class="right">${fmtQty(summary.totalPurchaseQty)}</td>
        <td class="right purchase">${fmt(summary.totalPurchaseAmount)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); setTimeout(() => win.close(), 1000); };
  };

  /* ── Sortable column header ── */
  const ColHeader = ({ field, label, align = 'left' }) => {
    const active = sortField === field;
    const Icon   = active ? (sortDir === 'asc' ? IconSortAscending : IconSortDescending) : IconArrowsSort;
    return (
      <th
        onClick={() => handleSort(field)}
        style={{
          backgroundColor: '#1976d2',
          color: 'white',
          fontWeight: 600,
          fontSize: 12,
          textAlign: align,
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          padding: '10px 14px'
        }}
      >
        <Group spacing={4} position={align === 'right' ? 'right' : 'left'} noWrap>
          <span>{label}</span>
          <Icon size={13} style={{ opacity: active ? 1 : 0.45 }} />
        </Group>
      </th>
    );
  };

  /* ─────── RENDER ─────── */
  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

      <Stack spacing="md">

        {/* ── Header ── */}
        <Group position="apart" align="flex-start">
          <Group spacing="sm">
            <ThemeIcon size={42} radius="md" color="blue" variant="light">
              <IconReportAnalytics size={24} />
            </ThemeIcon>
            <div>
              <Title order={3} style={{ color: '#1565c0', margin: 0, lineHeight: 1.2 }}>
                Party Report by Item
              </Title>
              <Text size="xs" color="dimmed" mt={2}>
                Party-wise sales &amp; purchase summary • {periodLabel}
              </Text>
            </div>
          </Group>

          <Group spacing="xs">
            <Tooltip label="Export CSV">
              <ActionIcon
                size="lg"
                color="teal"
                variant="light"
                onClick={handleExport}
                style={{ border: '1px solid #b2dfdb' }}
              >
                <IconFileSpreadsheet size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print Report">
              <ActionIcon
                size="lg"
                color="blue"
                variant="light"
                onClick={handlePrint}
                style={{ border: '1px solid #bbdefb' }}
              >
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* ── Summary Cards ── */}
        <Grid gutter="md">
          <Grid.Col span={3}>
            <StatCard
              icon={IconShoppingCart}
              label="Total Sale Amount"
              value={fmt(summary.totalSaleAmount)}
              color="#2e7d32"
              sub={`Qty: ${fmtQty(summary.totalSaleQty)}`}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <StatCard
              icon={IconTruck}
              label="Total Purchase Amount"
              value={fmt(summary.totalPurchaseAmount)}
              color="#c62828"
              sub={`Qty: ${fmtQty(summary.totalPurchaseQty)}`}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <StatCard
              icon={IconUsers}
              label="Total Parties"
              value={processedRecords.length}
              color="#1976d2"
              sub="in this period"
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <StatCard
              icon={IconCurrencyRupee}
              label="Net (Sale − Purchase)"
              value={fmt((summary.totalSaleAmount || 0) - (summary.totalPurchaseAmount || 0))}
              color="#f57c00"
            />
          </Grid.Col>
        </Grid>

        {/* ── Filter Bar ── */}
        <Paper withBorder radius="md" p="md" style={{ backgroundColor: '#fafbfc' }}>
          <Group spacing="md" align="flex-end" wrap="wrap">

            {/* Quick Range */}
            <Select
              label="Period"
              data={QUICK_RANGES}
              value={filterType}
              onChange={handleQuickRange}
              size="sm"
              style={{ width: 150 }}
            />

            {/* Date range */}
            <Stack spacing={4}>
              <Text size="xs" color="dimmed" weight={500}>From – To</Text>
              <Group spacing="xs" noWrap>
                <DatePickerInput
                  placeholder="DD/MM/YYYY"
                  value={dateRange[0]}
                  onChange={(d) => handleDateChange(0, d)}
                  size="sm"
                  style={{ width: 130 }}
                  leftSection={<IconCalendar size={14} />}
                  valueFormat="DD/MM/YYYY"
                  clearable
                />
                <Text size="sm" color="dimmed">–</Text>
                <DatePickerInput
                  placeholder="DD/MM/YYYY"
                  value={dateRange[1]}
                  onChange={(d) => handleDateChange(1, d)}
                  size="sm"
                  style={{ width: 130 }}
                  valueFormat="DD/MM/YYYY"
                  clearable
                />
              </Group>
            </Stack>

            {/* Category */}
            <Select
              label="Category"
              data={categoryOptions}
              value={selectedCategory}
              onChange={handleCategoryChange}
              size="sm"
              style={{ width: 175 }}
              searchable
              clearable={false}
            />

            {/* Item */}
            <Select
              label="Item"
              data={itemOptions}
              value={selectedItem}
              onChange={handleItemChange}
              size="sm"
              style={{ width: 195 }}
              searchable
              clearable={false}
            />

            {/* Search */}
            <TextInput
              label="Search Party"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<IconSearch size={14} />}
              size="sm"
              style={{ width: 195 }}
            />
          </Group>
        </Paper>

        {/* ── Data Table ── */}
        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>

          {/* Table meta bar */}
          <Box
            px="md"
            py="xs"
            style={{
              background: 'linear-gradient(90deg,#e3f2fd 0%,#f5f7fa 100%)',
              borderBottom: '1px solid #e0e0e0'
            }}
          >
            <Group position="apart">
              <Text size="sm" weight={600} color="blue">
                {processedRecords.length} {processedRecords.length === 1 ? 'party' : 'parties'} found
              </Text>
              {totalPages > 1 && (
                <Text size="xs" color="dimmed">
                  Page {currentPage} of {totalPages}
                </Text>
              )}
            </Group>
          </Box>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <Table
              horizontalSpacing="md"
              verticalSpacing="sm"
              striped
              highlightOnHover
              style={{ minWidth: 750 }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      backgroundColor: '#1976d2',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 12,
                      width: 48,
                      padding: '10px 14px'
                    }}
                  >
                    #
                  </th>
                  <ColHeader field="partyName"      label="Party Name" />
                  <ColHeader field="saleQty"        label="Sale Qty"        align="right" />
                  <ColHeader field="saleAmount"     label="Sale Amount"     align="right" />
                  <ColHeader field="purchaseQty"    label="Purchase Qty"    align="right" />
                  <ColHeader field="purchaseAmount" label="Purchase Amount" align="right" />
                </tr>
              </thead>

              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <Center py={70}>
                        <Stack align="center" spacing="md">
                          <ThemeIcon size={80} radius="50%" color="gray" variant="light">
                            <IconReportAnalytics size={40} />
                          </ThemeIcon>
                          <div style={{ textAlign: 'center' }}>
                            <Text size="md" weight={600} color="dimmed">
                              No party data found
                            </Text>
                            <Text size="sm" color="dimmed" mt={4}>
                              Adjust your filters or date range to see results.
                            </Text>
                          </div>
                        </Stack>
                      </Center>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((record, idx) => (
                    <tr key={record.partyId || idx}>
                      <td style={{ color: '#9e9e9e', fontWeight: 500, fontSize: 12 }}>
                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </td>

                      <td>
                        <Group spacing={6} noWrap>
                          <Text size="sm" weight={600}>
                            {record.partyName}
                          </Text>
                          {record.partyType && (
                            <Badge
                              size="xs"
                              radius="sm"
                              variant="light"
                              color={
                                record.partyType === 'Customer'
                                  ? 'blue'
                                  : record.partyType === 'Supplier'
                                  ? 'orange'
                                  : 'gray'
                              }
                            >
                              {record.partyType}
                            </Badge>
                          )}
                        </Group>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 500, fontSize: 13 }}>
                        {fmtQty(record.saleQty)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#2e7d32' }}>
                        {fmt(record.saleAmount)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 500, fontSize: 13 }}>
                        {fmtQty(record.purchaseQty)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#c62828' }}>
                        {fmt(record.purchaseAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Totals footer */}
              {processedRecords.length > 0 && (
                <tfoot>
                  <tr
                    style={{
                      backgroundColor: '#e3f2fd',
                      borderTop: '2px solid #1976d2'
                    }}
                  >
                    <td
                      colSpan={2}
                      style={{
                        padding: '11px 14px',
                        fontWeight: 700,
                        color: '#1565c0',
                        fontSize: 13
                      }}
                    >
                      Total &nbsp;
                      <Text span size="xs" color="dimmed" weight={400}>
                        ({processedRecords.length} parties)
                      </Text>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, padding: '11px 14px', fontSize: 13 }}>
                      {fmtQty(summary.totalSaleQty)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, padding: '11px 14px', fontSize: 13, color: '#2e7d32' }}>
                      {fmt(summary.totalSaleAmount)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, padding: '11px 14px', fontSize: 13 }}>
                      {fmtQty(summary.totalPurchaseQty)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, padding: '11px 14px', fontSize: 13, color: '#c62828' }}>
                      {fmt(summary.totalPurchaseAmount)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <>
              <Divider />
              <Box px="md" py="sm" style={{ backgroundColor: '#f8f9fa' }}>
                <Group position="apart">
                  <Text size="sm" color="dimmed">
                    Showing{' '}
                    <b>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</b>–
                    <b>{Math.min(currentPage * ITEMS_PER_PAGE, processedRecords.length)}</b>{' '}
                    of <b>{processedRecords.length}</b> entries
                  </Text>
                  <Pagination
                    value={currentPage}
                    onChange={setCurrentPage}
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
