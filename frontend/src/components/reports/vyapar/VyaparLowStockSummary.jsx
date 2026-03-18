import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Group, Stack, Text, Title, Badge, Button,
  ActionIcon, Tooltip, TextInput, Table, ScrollArea,
  ThemeIcon, Loader, Center, Divider, Paper
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle, IconPackageOff, IconAlertCircle,
  IconCurrencyRupee, IconSearch, IconRefresh, IconPrinter,
  IconFileSpreadsheet, IconBox
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { printReport } from '../../../utils/printReport';

/* ── helpers ─────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const STATUS_META = {
  'Out of Stock': { color: 'red',    bg: '#fff0f0', border: '#fca5a5' },
  'Critical':     { color: 'orange', bg: '#fff7ed', border: '#fdba74' },
  'Low Stock':    { color: 'yellow', bg: '#fefce8', border: '#fde047' },
};

/* ── Stat Card ───────────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════ */
export default function VyaparLowStockSummary() {
  const { selectedBusinessType } = useCompany();
  const navigate   = useNavigate();
  const printRef   = useRef(null);
  const [loading,    setLoading]    = useState(false);
  const [data,       setData]       = useState(null);
  const [search,     setSearch]     = useState('');

  // Guard — Private Firm only
  useEffect(() => {
    if (selectedBusinessType && selectedBusinessType !== 'Private Firm') {
      notifications.show({ color: 'orange', message: 'This report is only available for Private Firm' });
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await reportAPI.vyaparLowStockSummary();
      setData(res?.data || res);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err?.message || 'Failed to fetch low stock report' });
    } finally {
      setLoading(false);
    }
  };

  const items = data?.items || data?.records || [];
  const summary = data?.summary || {};

  const filtered = search.trim()
    ? items.filter(r =>
        (r.itemName || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.category || '').toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const exportToExcel = () => {
    if (!filtered.length) return;
    const rows = filtered.map((r, i) => ({
      '#':             i + 1,
      'Item Name':     r.itemName,
      'Category':      r.category || '-',
      'Unit':          r.unit || '-',
      'Current Stock': r.currentStock ?? r.currentBalance ?? 0,
      'Reorder Level': r.minStock ?? r.reorderLevel ?? 0,
      'Shortage':      r.shortage ?? 0,
      'Stock Value':   parseFloat(r.stockValue || 0).toFixed(2),
      'Status':        r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Low Stock');
    XLSX.writeFile(wb, 'low_stock_summary.xlsx');
  };

  return (
    <Box p="md">
      {/* ── Header ─────────────────────────────────────────── */}
      <Group justify="space-between" mb="md" align="flex-start">
        <Stack gap={2}>
          <Group gap={8}>
            <ThemeIcon size={36} radius="md" color="red" variant="light">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
            <Box>
              <Title order={3} c="dark">Low Stock Summary</Title>
              <Text fz="xs" c="dimmed">Items with stock at or below reorder level</Text>
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
            <ActionIcon variant="light" color="gray" size="lg" onClick={() => printReport(printRef, { title: 'Low Stock Summary', orientation: 'portrait' })}>
              <IconPrinter size={16} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<IconFileSpreadsheet size={14} />} variant="light" color="green" size="sm" onClick={exportToExcel} disabled={!filtered.length}>
            Export
          </Button>
        </Group>
      </Group>

      {/* ── Summary Cards ───────────────────────────────────── */}
      {data && (
        <Group grow mb="md" align="stretch">
          <StatCard
            icon={IconPackageOff}
            label="Out of Stock"
            value={summary.outOfStock ?? summary.outOfStockItems ?? 0}
            sub="Zero quantity items"
            color="red"
          />
          <StatCard
            icon={IconAlertCircle}
            label="Critical"
            value={summary.criticalItems ?? 0}
            sub="Below 25% of reorder level"
            color="orange"
          />
          <StatCard
            icon={IconAlertTriangle}
            label="Low Stock"
            value={summary.lowStockItems ?? summary.totalLowStockItems ?? 0}
            sub="Total items below reorder"
            color="yellow"
          />
          <StatCard
            icon={IconCurrencyRupee}
            label="Total Stock Value"
            value={`₹ ${fmt(summary.totalValue ?? summary.totalStockValue ?? 0)}`}
            sub="Of low-stock items"
            color="blue"
          />
        </Group>
      )}

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading && !data && (
        <Center py={60}>
          <Stack align="center" gap={8}>
            <Loader size="md" color="red" />
            <Text c="dimmed" fz="sm">Fetching low stock data...</Text>
          </Stack>
        </Center>
      )}

      {/* ── No Data ─────────────────────────────────────────── */}
      {!loading && data && items.length === 0 && (
        <Paper withBorder p="xl" ta="center" radius="md">
          <ThemeIcon size={60} color="green" variant="light" radius="xl" mx="auto" mb="sm">
            <IconBox size={30} />
          </ThemeIcon>
          <Text fw={700} c="green.7" fz="md">All items are well stocked!</Text>
          <Text c="dimmed" fz="sm" mt={4}>No items are below their reorder level.</Text>
        </Paper>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      {data && items.length > 0 && (
        <Card withBorder radius="md" p={0} ref={printRef}>
          {/* Table toolbar */}
          <Box px="md" py="sm" style={{ borderBottom: '1px solid #e9ecef', background: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <Group gap={8}>
                <Text fw={700} fz="sm">Items Below Reorder Level</Text>
                <Badge color="red" variant="filled" size="sm">{filtered.length}</Badge>
                {search && filtered.length !== items.length && (
                  <Text fz="xs" c="dimmed">of {items.length} total</Text>
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
              <Table.Thead style={{ background: 'linear-gradient(180deg,#fff0f0,#fde8e8)' }}>
                <Table.Tr>
                  {['#', 'Item Name', 'Category', 'Unit', 'Current Stock', 'Reorder Level', 'Shortage', 'Stock Value', 'Status'].map(h => (
                    <Table.Th key={h} style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#991b1b', whiteSpace: 'nowrap', padding: '10px 12px' }}>
                      {h}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((r, i) => {
                  const meta  = STATUS_META[r.status] || STATUS_META['Low Stock'];
                  const stock = r.currentStock ?? r.currentBalance ?? 0;
                  const reorder = r.minStock ?? r.reorderLevel ?? 0;
                  const shortage = r.shortage ?? Math.max(0, reorder - stock);
                  return (
                    <Table.Tr key={r.itemId || i} style={{ background: meta.bg }}>
                      <Table.Td style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 700, width: 36 }}>{i + 1}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>{r.itemName}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', color: '#64748b' }}>{r.category || '—'}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', color: '#64748b' }}>{r.unit || '—'}</Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: stock === 0 ? '#dc2626' : '#c2410c' }}>
                        {parseFloat(stock).toFixed(2)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                        {parseFloat(reorder).toFixed(2)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>
                        {parseFloat(shortage).toFixed(2)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0369a1' }}>
                        ₹ {fmt(r.stockValue || 0)}
                      </Table.Td>
                      <Table.Td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <Badge color={meta.color} variant="filled" size="sm" radius="sm">{r.status}</Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>

              {filtered.length > 0 && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#1e293b' }}>
                    <Table.Td colSpan={7} style={{ padding: '9px 12px', fontWeight: 700, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                      Totals
                    </Table.Td>
                    <Table.Td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 900, color: 'white', fontSize: 14 }}>
                      ₹ {fmt(filtered.reduce((s, r) => s + (r.stockValue || 0), 0))}
                    </Table.Td>
                    <Table.Td />
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </ScrollArea>

          {/* Footer */}
          <Box px="md" py="xs" style={{ borderTop: '1px solid #e9ecef', background: '#f8f9fa' }}>
            <Group justify="space-between">
              <Text fz="xs" c="dimmed">{filtered.length} items shown</Text>
              <Text fz="xs" c="dimmed">Private Firm — Low Stock Report</Text>
            </Group>
          </Box>
        </Card>
      )}
    </Box>
  );
}
