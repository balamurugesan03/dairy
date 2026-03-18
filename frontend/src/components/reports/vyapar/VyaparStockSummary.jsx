import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Group, Stack, Text, Title, Badge, Button,
  ActionIcon, Tooltip, TextInput, Table, ScrollArea,
  ThemeIcon, Loader, Center, Select, Checkbox, Pagination,
  Paper
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPackage, IconPackageOff, IconBox, IconCurrencyRupee,
  IconSearch, IconRefresh, IconPrinter, IconFileSpreadsheet,
  IconCalendar, IconFilter
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI, businessItemAPI } from '../../../services/api';
import { printReport } from '../../../utils/printReport';

const PER_PAGE = 15;

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

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

export default function VyaparStockSummary() {
  const { selectedBusinessType } = useCompany();
  const navigate  = useNavigate();
  const printRef  = useRef(null);

  const [loading,    setLoading]    = useState(false);
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);

  // Filters
  const [search,            setSearch]            = useState('');
  const [selectedCategory,  setSelectedCategory]  = useState('all');
  const [enableDateFilter,  setEnableDateFilter]  = useState(false);
  const [selectedDate,      setSelectedDate]      = useState(new Date());
  const [showOnlyInStock,   setShowOnlyInStock]   = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // Guard — Private Firm only
  useEffect(() => {
    if (selectedBusinessType && selectedBusinessType !== 'Private Firm') {
      notifications.show({ color: 'orange', message: 'This report is only available for Private Firm' });
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  useEffect(() => { fetchCategories(); }, []);

  useEffect(() => { fetchReport(); }, [selectedCategory, enableDateFilter, selectedDate, showOnlyInStock]);

  // Reset to page 1 when search or filters change
  useEffect(() => { setPage(1); }, [search, selectedCategory, enableDateFilter, selectedDate, showOnlyInStock]);

  const fetchCategories = async () => {
    try {
      const response = await businessItemAPI.getAll({ limit: 1000 });
      const items = response.data?.items || response.data || [];
      const unique = [...new Set(items.map(i => i.category).filter(Boolean))];
      setCategories(unique.map(c => ({ value: c, label: c })));
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = { inventoryType: 'Business' };
      if (selectedCategory && selectedCategory !== 'all') params.category = selectedCategory;
      if (enableDateFilter && selectedDate) params.asOfDate = dayjs(selectedDate).format('YYYY-MM-DD');
      if (showOnlyInStock) params.showOnlyInStock = true;

      const response = await reportAPI.vyaparStockSummary(params);
      setReportData(response.data);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err?.message || 'Failed to fetch stock summary' });
    } finally {
      setLoading(false);
    }
  };

  const allItems = reportData?.items || [];

  // Apply search filter
  const filtered = search.trim()
    ? allItems.filter(r =>
        (r.itemName || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.category || '').toLowerCase().includes(search.toLowerCase())
      )
    : allItems;

  // Pagination slice
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Summary stats (from all items, not filtered)
  const totalItems   = allItems.length;
  const inStockCount = allItems.filter(i => (i.stockQty ?? 0) > 0).length;
  const outOfStock   = allItems.filter(i => (i.stockQty ?? 0) === 0).length;
  const totalValue   = allItems.reduce((s, i) => s + (i.stockValue || 0), 0);

  // Totals for filtered set
  const filteredTotalQty   = filtered.reduce((s, i) => s + (i.stockQty || 0), 0);
  const filteredTotalValue = filtered.reduce((s, i) => s + (i.stockValue || 0), 0);

  const exportToExcel = () => {
    if (!filtered.length) return;
    const rows = filtered.map((r, i) => ({
      '#':               i + 1,
      'Item Name':       r.itemName,
      'Category':        r.category || '-',
      'Unit':            r.unit || '-',
      'Sale Price':      parseFloat(r.salePrice || 0).toFixed(2),
      'Purchase Price':  parseFloat(r.purchasePrice || 0).toFixed(2),
      'Stock Qty':       parseFloat(r.stockQty || 0).toFixed(2),
      'Stock Value':     parseFloat(r.stockValue || 0).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Summary');
    XLSX.writeFile(wb, `Stock_Summary_${dayjs().format('DD-MM-YYYY')}.xlsx`);
  };

  return (
    <Box p="md">
      {/* ── Header ───────────────────────────────────────────── */}
      <Group justify="space-between" mb="md" align="flex-start">
        <Stack gap={2}>
          <Group gap={8}>
            <ThemeIcon size={36} radius="md" color="blue" variant="light">
              <IconBox size={20} />
            </ThemeIcon>
            <Box>
              <Title order={3} c="dark">Stock Summary</Title>
              <Text fz="xs" c="dimmed">Current stock levels and values for all items</Text>
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
            <ActionIcon variant="light" color="gray" size="lg" onClick={() => printReport(printRef, { title: 'Stock Summary', orientation: 'portrait' })}>
              <IconPrinter size={16} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<IconFileSpreadsheet size={14} />} variant="light" color="green" size="sm" onClick={exportToExcel} disabled={!filtered.length}>
            Export
          </Button>
        </Group>
      </Group>

      {/* ── Stat Cards ───────────────────────────────────────── */}
      {reportData && (
        <Group grow mb="md" align="stretch">
          <StatCard icon={IconPackage}      label="Total Items"     value={totalItems}              sub="All inventory items"         color="blue"   />
          <StatCard icon={IconBox}          label="In Stock"        value={inStockCount}            sub="Items with stock > 0"        color="green"  />
          <StatCard icon={IconPackageOff}   label="Out of Stock"    value={outOfStock}              sub="Zero quantity items"         color="red"    />
          <StatCard icon={IconCurrencyRupee} label="Total Value"    value={`₹ ${fmt(totalValue)}`} sub="At purchase price"           color="violet" />
        </Group>
      )}

      {/* ── Filters ──────────────────────────────────────────── */}
      <Card withBorder radius="md" p="sm" mb="md">
        <Group gap="md" align="flex-end" wrap="wrap">
          <ThemeIcon size={28} radius="sm" color="gray" variant="light">
            <IconFilter size={14} />
          </ThemeIcon>
          <Select
            label="Category"
            placeholder="All Categories"
            value={selectedCategory}
            onChange={setSelectedCategory}
            data={[{ value: 'all', label: 'All Categories' }, ...categories]}
            size="xs"
            style={{ width: 180 }}
            clearable
          />
          <Checkbox
            checked={enableDateFilter}
            onChange={(e) => setEnableDateFilter(e.currentTarget.checked)}
            label="As on date"
            size="xs"
            mt="xl"
          />
          {enableDateFilter && (
            <DatePickerInput
              label="Date"
              value={selectedDate}
              onChange={setSelectedDate}
              valueFormat="DD/MM/YYYY"
              size="xs"
              leftSection={<IconCalendar size={14} />}
              style={{ width: 150 }}
            />
          )}
          <Checkbox
            checked={showOnlyInStock}
            onChange={(e) => setShowOnlyInStock(e.currentTarget.checked)}
            label="In stock only"
            size="xs"
            mt="xl"
          />
        </Group>
      </Card>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && !reportData && (
        <Center py={60}>
          <Stack align="center" gap={8}>
            <Loader size="md" color="blue" />
            <Text c="dimmed" fz="sm">Fetching stock data...</Text>
          </Stack>
        </Center>
      )}

      {/* ── No Data ───────────────────────────────────────────── */}
      {!loading && reportData && allItems.length === 0 && (
        <Paper withBorder p="xl" ta="center" radius="md">
          <ThemeIcon size={60} color="gray" variant="light" radius="xl" mx="auto" mb="sm">
            <IconBox size={30} />
          </ThemeIcon>
          <Text fw={700} c="dimmed" fz="md">No items found</Text>
          <Text c="dimmed" fz="sm" mt={4}>Try adjusting filters or check if stock data exists.</Text>
        </Paper>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      {reportData && allItems.length > 0 && (
        <Card withBorder radius="md" p={0} ref={printRef}>
          {/* Table toolbar */}
          <Box px="md" py="sm" style={{ borderBottom: '1px solid #e9ecef', background: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <Group gap={8}>
                <Text fw={700} fz="sm">Stock Items</Text>
                <Badge color="blue" variant="filled" size="sm">{filtered.length}</Badge>
                {search && filtered.length !== allItems.length && (
                  <Text fz="xs" c="dimmed">of {allItems.length} total</Text>
                )}
              </Group>
              <TextInput
                placeholder="Search item or category..."
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                leftSection={<IconSearch size={14} />}
                size="xs"
                radius="md"
                style={{ width: 220 }}
              />
            </Group>
          </Box>

          <ScrollArea>
            <Table highlightOnHover withColumnBorders style={{ fontSize: 13 }}>
              <Table.Thead style={{ background: 'linear-gradient(180deg,#eff6ff,#dbeafe)' }}>
                <Table.Tr>
                  {['#', 'Item Name', 'Category', 'Unit', 'Sale Price', 'Purchase Price', 'Stock Qty', 'Stock Value'].map(h => (
                    <Table.Th key={h} style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#1e40af', whiteSpace: 'nowrap', padding: '10px 12px' }}>
                      {h}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginated.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                      No items match your search
                    </Table.Td>
                  </Table.Tr>
                ) : paginated.map((r, i) => {
                  const isZero = (r.stockQty ?? 0) === 0;
                  return (
                    <Table.Tr key={r.itemId || i} style={{ background: isZero ? '#fff5f5' : undefined }}>
                      <Table.Td style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 700, width: 36 }}>
                        {(page - 1) * PER_PAGE + i + 1}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>{r.itemName}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', color: '#64748b' }}>{r.category || '—'}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', color: '#64748b' }}>{r.unit || '—'}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', color: '#0369a1' }}>₹ {fmt(r.salePrice)}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>₹ {fmt(r.purchasePrice)}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: isZero ? '#dc2626' : '#166534' }}>
                        {fmt(r.stockQty)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#7c3aed' }}>
                        ₹ {fmt(r.stockValue)}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>

              {filtered.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#1e293b' }}>
                    <Table.Td colSpan={6} style={{ padding: '9px 12px', fontWeight: 700, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                      Totals ({filtered.length} items)
                    </Table.Td>
                    <Table.Td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 14 }}>
                      {fmt(filteredTotalQty)}
                    </Table.Td>
                    <Table.Td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 14 }}>
                      ₹ {fmt(filteredTotalValue)}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </ScrollArea>

          {/* Footer with pagination */}
          <Box px="md" py="sm" style={{ borderTop: '1px solid #e9ecef', background: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <Text fz="xs" c="dimmed">
                {filtered.length > 0
                  ? `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, filtered.length)} of ${filtered.length} items`
                  : '0 items'}
              </Text>
              {totalPages > 1 && (
                <Pagination
                  value={page}
                  onChange={setPage}
                  total={totalPages}
                  size="xs"
                  radius="md"
                  siblings={1}
                />
              )}
              <Text fz="xs" c="dimmed">Private Firm — Stock Summary</Text>
            </Group>
          </Box>
        </Card>
      )}
    </Box>
  );
}
