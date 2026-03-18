import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Group, Stack, Text, Title, Badge, Button,
  ActionIcon, Tooltip, TextInput, Table, ScrollArea,
  ThemeIcon, Loader, Center, Checkbox, Pagination, Paper
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconTrendingUp, IconTrendingDown, IconPackage, IconCurrencyRupee,
  IconSearch, IconRefresh, IconPrinter, IconFileSpreadsheet,
  IconCalendar, IconSortAscending, IconSortDescending, IconArrowsSort
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { printReport } from '../../../utils/printReport';

const PER_PAGE = 15;

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n || 0));

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <Card withBorder radius="md" p="md" style={{ borderTop: `3px solid var(--mantine-color-${color}-6)`, flex: 1 }}>
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Text fz="xs" c="dimmed" fw={700} tt="uppercase" style={{ letterSpacing: '0.5px' }}>{label}</Text>
        <Text fz="xl" fw={900} c={`${color}.7`}>{value}</Text>
        {sub && <Text fz="xs" c="dimmed">{sub}</Text>}
      </Stack>
      <ThemeIcon size={44} radius="md" color={color} variant="light">
        <Icon size={22} />
      </ThemeIcon>
    </Group>
  </Card>
);

export default function VyaparItemWiseProfit() {
  const { selectedBusinessType } = useCompany();
  const navigate   = useNavigate();
  const printRef   = useRef(null);

  const [loading,          setLoading]          = useState(false);
  const [reportData,       setReportData]       = useState(null);
  const [fromDate,         setFromDate]         = useState(dayjs().startOf('month').toDate());
  const [toDate,           setToDate]           = useState(dayjs().endOf('month').toDate());
  const [itemsHavingSale,  setItemsHavingSale]  = useState(false);
  const [search,           setSearch]           = useState('');
  const [sortField,        setSortField]        = useState('itemName');
  const [sortDir,          setSortDir]          = useState('asc');
  const [page,             setPage]             = useState(1);

  // Guard — Private Firm only
  useEffect(() => {
    if (selectedBusinessType && selectedBusinessType !== 'Private Firm') {
      notifications.show({ color: 'orange', message: 'This report is only available for Private Firm' });
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  useEffect(() => { fetchReport(); }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, itemsHavingSale, sortField, sortDir]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        filterType: 'custom',
        customStart: dayjs(fromDate).format('YYYY-MM-DD'),
        customEnd: dayjs(toDate).format('YYYY-MM-DD'),
        itemsHavingSale
      };
      const response = await reportAPI.vyaparItemWiseProfit(params);
      setReportData(response.data);
      setPage(1);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err?.message || 'Failed to fetch item-wise profit' });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <IconArrowsSort size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <IconSortAscending size={12} color="#1d4ed8" /> : <IconSortDescending size={12} color="#1d4ed8" />;
  };

  const allItems = reportData?.items || [];

  // Filter
  const filtered = allItems
    .filter(i => !itemsHavingSale || (i.sale || 0) > 0)
    .filter(i => !search.trim() || (i.itemName || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortField] ?? 0, bv = b[sortField] ?? 0;
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv || '').toLowerCase(); }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Totals (all filtered, not just current page)
  const totals = filtered.reduce((acc, i) => ({
    sale:            acc.sale            + (i.sale            || 0),
    creditNote:      acc.creditNote      + (i.creditNote      || 0),
    purchase:        acc.purchase        + (i.purchase        || 0),
    debitNote:       acc.debitNote       + (i.debitNote       || 0),
    openingStock:    acc.openingStock    + (i.openingStock    || 0),
    closingStock:    acc.closingStock    + (i.closingStock    || 0),
    taxReceivable:   acc.taxReceivable   + (i.taxReceivable   || 0),
    taxPayable:      acc.taxPayable      + (i.taxPayable      || 0),
    netProfitLoss:   acc.netProfitLoss   + (i.netProfitLoss   || 0),
  }), { sale: 0, creditNote: 0, purchase: 0, debitNote: 0, openingStock: 0, closingStock: 0, taxReceivable: 0, taxPayable: 0, netProfitLoss: 0 });

  const itemsWithSale  = allItems.filter(i => (i.sale || 0) > 0).length;
  const profitItems    = allItems.filter(i => (i.netProfitLoss || 0) > 0).length;
  const lossItems      = allItems.filter(i => (i.netProfitLoss || 0) < 0).length;

  const exportToExcel = () => {
    if (!filtered.length) return;
    const rows = filtered.map((i, idx) => ({
      '#':                        idx + 1,
      'Item Name':                i.itemName,
      'Sale':                     parseFloat(i.sale || 0).toFixed(2),
      'Cr. Note / Sale Return':   parseFloat(i.creditNote || 0).toFixed(2),
      'Purchase':                 parseFloat(i.purchase || 0).toFixed(2),
      'Dr. Note / Pur. Return':   parseFloat(i.debitNote || 0).toFixed(2),
      'Opening Stock':            parseFloat(i.openingStock || 0).toFixed(2),
      'Closing Stock':            parseFloat(i.closingStock || 0).toFixed(2),
      'Tax Receivable':           parseFloat(i.taxReceivable || 0).toFixed(2),
      'Tax Payable':              parseFloat(i.taxPayable || 0).toFixed(2),
      'Net Profit / Loss':        parseFloat(i.netProfitLoss || 0).toFixed(2),
    }));
    rows.push({
      '#': '', 'Item Name': 'TOTAL',
      'Sale': totals.sale.toFixed(2),
      'Cr. Note / Sale Return': totals.creditNote.toFixed(2),
      'Purchase': totals.purchase.toFixed(2),
      'Dr. Note / Pur. Return': totals.debitNote.toFixed(2),
      'Opening Stock': totals.openingStock.toFixed(2),
      'Closing Stock': totals.closingStock.toFixed(2),
      'Tax Receivable': totals.taxReceivable.toFixed(2),
      'Tax Payable': totals.taxPayable.toFixed(2),
      'Net Profit / Loss': totals.netProfitLoss.toFixed(2),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item Profit');
    XLSX.writeFile(wb, `Item_Profit_${dayjs().format('DD-MM-YYYY')}.xlsx`);
  };

  const COLS = [
    { key: 'sale',          label: 'Sale' },
    { key: 'creditNote',    label: 'Cr. Note' },
    { key: 'purchase',      label: 'Purchase' },
    { key: 'debitNote',     label: 'Dr. Note' },
    { key: 'openingStock',  label: 'Opening Stock' },
    { key: 'closingStock',  label: 'Closing Stock' },
    { key: 'taxReceivable', label: 'Tax Recv.' },
    { key: 'taxPayable',    label: 'Tax Pay.' },
    { key: 'netProfitLoss', label: 'Net P/L' },
  ];

  const thStyle = {
    fontWeight: 800, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: '0.4px', color: '#1e40af', whiteSpace: 'nowrap',
    padding: '10px 10px', cursor: 'pointer', userSelect: 'none'
  };

  return (
    <Box p="md">
      {/* ── Header ─────────────────────────────────────────── */}
      <Group justify="space-between" mb="md" align="flex-start">
        <Stack gap={2}>
          <Group gap={8}>
            <ThemeIcon size={36} radius="md" color="indigo" variant="light">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <Box>
              <Title order={3} c="dark">Item Wise Profit &amp; Loss</Title>
              <Text fz="xs" c="dimmed">
                {dayjs(fromDate).format('DD/MM/YYYY')} – {dayjs(toDate).format('DD/MM/YYYY')}
              </Text>
            </Box>
          </Group>
        </Stack>
        <Group gap={6}>
          <Tooltip label="Refresh">
            <ActionIcon variant="light" color="blue" size="lg" onClick={fetchReport} loading={loading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Print">
            <ActionIcon variant="light" color="gray" size="lg" onClick={() => printReport(printRef, { title: 'Item Wise Profit & Loss', orientation: 'landscape' })}>
              <IconPrinter size={16} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<IconFileSpreadsheet size={14} />} variant="light" color="green" size="sm" onClick={exportToExcel} disabled={!filtered.length}>
            Export
          </Button>
        </Group>
      </Group>

      {/* ── Date Filter ────────────────────────────────────── */}
      <Card withBorder radius="md" p="sm" mb="md">
        <Group gap="md" align="flex-end" wrap="wrap">
          <DatePickerInput
            label="From"
            value={fromDate}
            onChange={setFromDate}
            valueFormat="DD/MM/YYYY"
            size="xs"
            leftSection={<IconCalendar size={14} />}
            style={{ width: 140 }}
          />
          <DatePickerInput
            label="To"
            value={toDate}
            onChange={setToDate}
            valueFormat="DD/MM/YYYY"
            size="xs"
            leftSection={<IconCalendar size={14} />}
            style={{ width: 140 }}
          />
          <Button size="xs" onClick={fetchReport} loading={loading} mt="xl">
            Apply
          </Button>
          <Checkbox
            label="Items with sale only"
            checked={itemsHavingSale}
            onChange={e => setItemsHavingSale(e.currentTarget.checked)}
            size="xs"
            mt="xl"
          />
        </Group>
      </Card>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      {reportData && (
        <Group grow mb="md" align="stretch">
          <StatCard icon={IconPackage}       label="Total Items"    value={allItems.length}                       sub="In selected period"     color="blue"   />
          <StatCard icon={IconCurrencyRupee} label="Total Sale"     value={`₹ ${fmt(totals.sale)}`}              sub="Gross sales amount"     color="green"  />
          <StatCard icon={IconTrendingUp}    label="Profit Items"   value={profitItems}                          sub="Items in profit"        color="teal"   />
          <StatCard icon={IconTrendingDown}  label="Net P/L"
            value={`${totals.netProfitLoss >= 0 ? '▲' : '▼'} ₹ ${fmt(totals.netProfitLoss)}`}
            sub={totals.netProfitLoss >= 0 ? 'Net Profit' : 'Net Loss'}
            color={totals.netProfitLoss >= 0 ? 'green' : 'red'}
          />
        </Group>
      )}

      {/* ── Loading ────────────────────────────────────────── */}
      {loading && !reportData && (
        <Center py={60}>
          <Stack align="center" gap={8}>
            <Loader size="md" color="indigo" />
            <Text c="dimmed" fz="sm">Fetching item profit data...</Text>
          </Stack>
        </Center>
      )}

      {/* ── No Data ────────────────────────────────────────── */}
      {!loading && reportData && allItems.length === 0 && (
        <Paper withBorder p="xl" ta="center" radius="md">
          <ThemeIcon size={60} color="gray" variant="light" radius="xl" mx="auto" mb="sm">
            <IconPackage size={30} />
          </ThemeIcon>
          <Text fw={700} c="dimmed" fz="md">No items found for selected period</Text>
          <Text c="dimmed" fz="sm" mt={4}>Try adjusting the date range.</Text>
        </Paper>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      {reportData && allItems.length > 0 && (
        <Card withBorder radius="md" p={0} ref={printRef}>
          {/* Toolbar */}
          <Box px="md" py="sm" style={{ borderBottom: '1px solid #e9ecef', background: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <Group gap={8}>
                <Text fw={700} fz="sm">Item Details</Text>
                <Badge color="indigo" variant="filled" size="sm">{filtered.length}</Badge>
                {search && filtered.length !== allItems.length && (
                  <Text fz="xs" c="dimmed">of {allItems.length} total</Text>
                )}
              </Group>
              <TextInput
                placeholder="Search item..."
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                leftSection={<IconSearch size={14} />}
                size="xs"
                radius="md"
                style={{ width: 200 }}
              />
            </Group>
          </Box>

          <ScrollArea>
            <Table highlightOnHover withColumnBorders style={{ fontSize: 12, minWidth: 1200 }}>
              <Table.Thead style={{ background: 'linear-gradient(180deg,#eff6ff,#dbeafe)' }}>
                <Table.Tr>
                  <Table.Th style={{ ...thStyle, width: 36 }}>#</Table.Th>
                  <Table.Th
                    style={{ ...thStyle, minWidth: 160 }}
                    onClick={() => handleSort('itemName')}
                  >
                    <Group gap={4} wrap="nowrap">Item Name <SortIcon field="itemName" /></Group>
                  </Table.Th>
                  {COLS.map(col => (
                    <Table.Th
                      key={col.key}
                      style={{ ...thStyle, textAlign: 'right', minWidth: 100 }}
                      onClick={() => handleSort(col.key)}
                    >
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {col.label} <SortIcon field={col.key} />
                      </Group>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginated.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={11} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No items match your search
                    </Table.Td>
                  </Table.Tr>
                ) : paginated.map((item, i) => {
                  const isProfit = (item.netProfitLoss || 0) >= 0;
                  return (
                    <Table.Tr key={item.itemId || i}>
                      <Table.Td style={{ padding: '8px 10px', color: '#94a3b8', fontWeight: 700 }}>
                        {(page - 1) * PER_PAGE + i + 1}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', fontWeight: 700, color: '#1e293b' }}>
                        {item.itemName}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#166534' }}>
                        {fmt(item.sale)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        {fmt(item.creditNote)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#b45309' }}>
                        {fmt(item.purchase)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        {fmt(item.debitNote)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        {fmt(item.openingStock)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        {fmt(item.closingStock)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#7c3aed' }}>
                        {fmt(item.taxReceivable)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', color: '#7c3aed' }}>
                        {fmt(item.taxPayable)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: isProfit ? '#166534' : '#dc2626' }}>
                        {isProfit ? '' : '('}
                        {fmt(item.netProfitLoss)}
                        {isProfit ? '' : ')'}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>

              {filtered.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#1e293b' }}>
                    <Table.Td colSpan={2} style={{ padding: '9px 10px', fontWeight: 700, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                      Totals ({filtered.length} items)
                    </Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.sale)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.creditNote)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.purchase)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.debitNote)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.openingStock)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.closingStock)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.taxReceivable)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 13 }}>{fmt(totals.taxPayable)}</Table.Td>
                    <Table.Td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: totals.netProfitLoss >= 0 ? '#86efac' : '#fca5a5' }}>
                      {totals.netProfitLoss >= 0 ? '' : '('}
                      {fmt(totals.netProfitLoss)}
                      {totals.netProfitLoss >= 0 ? '' : ')'}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </ScrollArea>

          {/* Footer + Pagination */}
          <Box px="md" py="sm" style={{ borderTop: '1px solid #e9ecef', background: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <Text fz="xs" c="dimmed">
                {filtered.length > 0
                  ? `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, filtered.length)} of ${filtered.length} items`
                  : '0 items'}
              </Text>
              {totalPages > 1 && (
                <Pagination value={page} onChange={setPage} total={totalPages} size="xs" radius="md" siblings={1} />
              )}
              <Text fz="xs" c="dimmed">Private Firm — Item Profit Report</Text>
            </Group>
          </Box>
        </Card>
      )}
    </Box>
  );
}
