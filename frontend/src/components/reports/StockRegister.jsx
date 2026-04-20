import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Group, Text, Title, Button, Select, SegmentedControl,
  Table, ScrollArea, Stack, SimpleGrid, ThemeIcon, Loader, Center, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconPackages, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconBox, IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

const fmt3 = (n) => parseFloat(n || 0).toFixed(3);
const fmt2 = (n) => parseFloat(n || 0).toFixed(2);
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

const GREEN = '#166534';
const TH_BG = '#f0fdf4';

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom', label: 'Custom' }
];

const getPresetRange = (preset) => {
  const now = dayjs();
  switch (preset) {
    case 'today': return [now.startOf('day').toDate(), now.endOf('day').toDate()];
    case 'thisWeek': return [now.startOf('week').toDate(), now.endOf('week').toDate()];
    case 'thisMonth': return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth': return [now.subtract(1, 'month').startOf('month').toDate(), now.subtract(1, 'month').endOf('month').toDate()];
    case 'thisQuarter': return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fyStart = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fyStart, 3, 1), new Date(fyStart + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

const thStyle = {
  fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
  color: GREEN, padding: '8px 10px', whiteSpace: 'nowrap', background: TH_BG
};
const thStyleR = { ...thStyle, textAlign: 'right' };
const tdStyle = { padding: '6px 10px', fontSize: 12 };

const StockRegister = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset] = useState('thisMonth');
  const [dateRange, setDateRange] = useState(getPresetRange('thisMonth'));
  const [mode, setMode] = useState('day');
  const printRef = useRef(null);

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const fetchReport = async () => {
    const [start, end] = dateRange;
    if (!start || !end) {
      notifications.show({ title: 'Error', message: 'Please select a date range', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.stockRegister({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD'),
        mode
      });
      setReportData(res.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!rows.length) return;
    const data = rows.map(r => ({
      ...(mode === 'day' ? { Date: fmtDate(r.date) } : {}),
      ...(mode === 'month' ? { Month: r.month } : {}),
      Item: r.itemName, Unit: r.unit, Rate: r.rate,
      Opening: r.ob, Purchase: r.purchase, 'Sale Return': r.salesReturn,
      Total: r.total, Sales: r.sales, 'Purch. Return': r.purchaseReturn,
      Closing: r.closingStock, 'Stock Value': r.stockValue
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Register');
    XLSX.writeFile(wb, `stock_register_${mode}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Stock register exported to Excel', color: 'green' });
  };

  const rows = reportData?.rows || [];
  const gt = reportData?.grandTotal;

  // Build grouped rows for day/month modes
  const buildGroupedRows = () => {
    const groups = {};
    const keys = [];
    rows.forEach(row => {
      const key = mode === 'day' ? fmtDate(row.date) : row.month;
      if (!groups[key]) { groups[key] = []; keys.push(key); }
      groups[key].push(row);
    });

    const result = [];
    keys.forEach(key => {
      const grpRows = groups[key];
      // Compute group subtotals
      const sub = grpRows.reduce((acc, r) => ({
        purchase: acc.purchase + parseFloat(r.purchase || 0),
        salesReturn: acc.salesReturn + parseFloat(r.salesReturn || 0),
        sales: acc.sales + parseFloat(r.sales || 0),
        purchaseReturn: acc.purchaseReturn + parseFloat(r.purchaseReturn || 0),
        stockValue: acc.stockValue + parseFloat(r.stockValue || 0)
      }), { purchase: 0, salesReturn: 0, sales: 0, purchaseReturn: 0, stockValue: 0 });

      // Group header
      result.push(
        <Table.Tr key={`hdr-${key}`} style={{ background: '#dbeafe' }}>
          <Table.Td colSpan={12} style={{ padding: '5px 12px', fontWeight: 800, color: '#1d4ed8', fontSize: 12 }}>
            <Group gap="xs">
              <IconBox size={14} />
              <span>{key}</span>
              <Text span size="xs" c="dimmed" fw={400}>
                — {grpRows.length} item{grpRows.length !== 1 ? 's' : ''} &nbsp;|&nbsp;
                Purchase: {fmt3(sub.purchase)} &nbsp;|&nbsp;
                Sales: {fmt3(sub.sales)} &nbsp;|&nbsp;
                Value: ₹{fmt2(sub.stockValue)}
              </Text>
            </Group>
          </Table.Td>
        </Table.Tr>
      );

      // Item rows under this group
      grpRows.forEach((row, ri) => {
        result.push(
          <Table.Tr key={`${key}-${ri}`} style={{ background: ri % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
            <Table.Td style={{ ...tdStyle, color: '#6b7280' }}>{ri + 1}</Table.Td>
            <Table.Td style={{ ...tdStyle, fontWeight: 600 }}>{row.itemName}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'center' }}>
              <Badge size="xs" variant="light" color="gray">{row.unit}</Badge>
            </Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>₹{row.rate}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#1d4ed8', fontWeight: 600 }}>{fmt3(row.ob)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#166534' }}>{fmt3(row.purchase)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#92400e' }}>{fmt3(row.salesReturn)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt3(row.total)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#7c3aed' }}>{fmt3(row.sales)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#be185d' }}>{fmt3(row.purchaseReturn)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#065f46' }}>{fmt3(row.closingStock)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>₹{fmt2(row.stockValue)}</Table.Td>
          </Table.Tr>
        );
      });
    });
    return result;
  };

  const buildItemRows = () =>
    rows.map((row, idx) => (
      <Table.Tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
        <Table.Td style={{ ...tdStyle, color: '#6b7280' }}>{idx + 1}</Table.Td>
        <Table.Td style={{ ...tdStyle, fontWeight: 600 }}>{row.itemName}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'center' }}>
          <Badge size="xs" variant="light" color="gray">{row.unit}</Badge>
        </Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>₹{row.rate}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#1d4ed8', fontWeight: 600 }}>{fmt3(row.ob)}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#166534' }}>{fmt3(row.purchase)}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#92400e' }}>{fmt3(row.salesReturn)}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt3(row.total)}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#7c3aed' }}>{fmt3(row.sales)}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#be185d' }}>{fmt3(row.purchaseReturn)}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#065f46' }}>{fmt3(row.closingStock)}</Table.Td>
        <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>₹{fmt2(row.stockValue)}</Table.Td>
      </Table.Tr>
    ));

  const COL_HEADERS = [
    { label: '#',            style: thStyle },
    { label: 'Item Name',    style: thStyle },
    { label: 'Unit',         style: { ...thStyle, textAlign: 'center' } },
    { label: 'Rate',         style: thStyleR },
    { label: 'Opening',      style: thStyleR },
    { label: 'Purchase',     style: thStyleR },
    { label: 'Sale Return',  style: thStyleR },
    { label: 'Total',        style: thStyleR },
    { label: 'Sales',        style: thStyleR },
    { label: 'Purch. Return',style: thStyleR },
    { label: 'Closing',      style: thStyleR },
    { label: 'Stock Value',  style: thStyleR },
  ];

  return (
    <Box p="md" ref={printRef}>
      {/* Header */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: '1px solid #a5d6a7' }}>
        <Box style={{ background: 'linear-gradient(90deg, #166534 0%, #15803d 50%, #16a34a 100%)', padding: '10px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconPackages size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Stock Register</Title>
                <Text size="xs" c="rgba(255,255,255,0.8)">
                  {mode === 'day' ? 'Daily stock flow — opening to closing per item per day' :
                   mode === 'month' ? 'Monthly stock flow — per item per month' :
                   'Item-wise consolidated stock summary'}
                </Text>
              </Box>
            </Group>
            <Group gap="xs">
              {reportData?.financialYear && (
                <Badge size="lg" variant="white" color="green">FY {reportData.financialYear}</Badge>
              )}
              <Button
                variant="white"
                color="dark"
                leftSection={<IconX size={16} />}
                onClick={() => navigate('/')}
                size="sm"
              >
                Close
              </Button>
            </Group>
          </Group>
        </Box>

        {reportData && gt && (
          <Box px="xl" py="sm" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #f0fdf4 100%)' }}>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              {[
                { label: 'Total Rows', value: rows.length, color: 'green.8' },
                { label: 'Opening Stock', value: fmt3(gt.ob), color: 'blue.8' },
                { label: 'Total Purchase', value: fmt3(gt.purchase), color: 'teal.8' },
                { label: 'Total Sales', value: fmt3(gt.sales), color: 'violet.8' },
                { label: 'Stock Value', value: `₹${fmt2(gt.stockValue)}`, color: 'orange.8' }
              ].map(s => (
                <Box key={s.label} style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">{s.label}</Text>
                  <Text fw={800} c={s.color} size="sm">{s.value}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Paper>

      {/* Filters */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select
            label="Period"
            value={preset}
            onChange={handlePresetChange}
            data={PRESETS}
            style={{ flex: '1 1 140px' }}
            size="sm"
          />
          <DatePickerInput
            type="range"
            label="Date Range"
            value={dateRange}
            onChange={(val) => { setDateRange(val); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '2 1 240px' }}
            size="sm"
          />
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>View Mode</Text>
            <SegmentedControl
              value={mode}
              onChange={setMode}
              data={[
                { value: 'item', label: 'Item-wise' },
                { value: 'day', label: 'Day-wise' },
                { value: 'month', label: 'Month-wise' }
              ]}
              size="sm"
            />
          </Box>
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} size="sm" color="green">
            Generate
          </Button>
          {rows.length > 0 && (
            <>
              <Button leftSection={<IconFileExport size={16} />} variant="light" color="teal" onClick={handleExport} size="sm">
                Export Excel
              </Button>
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="blue" onClick={() => printReport(printRef, { title: 'Stock Register', orientation: 'landscape' })} size="sm">
                Print
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box style={{ background: `linear-gradient(90deg, ${GREEN} 0%, #15803d 100%)`, padding: '10px 16px' }}>
          <Group justify="space-between">
            <Text fw={700} size="sm" c="white">
              {mode === 'day' ? 'Daily Stock Flow Register' : mode === 'month' ? 'Monthly Stock Flow Register' : 'Item-wise Stock Summary'}
            </Text>
            {dateRange[0] && dateRange[1] && (
              <Text size="xs" c="rgba(255,255,255,0.8)">
                {fmtDate(dateRange[0])} — {fmtDate(dateRange[1])}
              </Text>
            )}
          </Group>
        </Box>

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="md" color="green" /></Center>
          ) : !reportData ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconPackages size={40} color="#bdbdbd" />
                <Text c="dimmed" size="sm">Select a date range and click Generate</Text>
              </Stack>
            </Center>
          ) : rows.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconInbox size={40} color="#bdbdbd" />
                <Text c="dimmed" size="sm">No stock movements found for this period</Text>
              </Stack>
            </Center>
          ) : (
            <Table withColumnBorders style={{ fontSize: 12 }}>
              <Table.Thead>
                <Table.Tr>
                  {COL_HEADERS.map(col => (
                    <Table.Th key={col.label} style={col.style}>{col.label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {mode === 'item' ? buildItemRows() : buildGroupedRows()}
              </Table.Tbody>
              {gt && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#dcfce7' }}>
                    <Table.Td colSpan={4} style={{ padding: '8px 10px', fontWeight: 800, color: GREEN, fontSize: 12 }}>
                      Grand Total
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1d4ed8' }}>{fmt3(gt.ob)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>{fmt3(gt.purchase)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#92400e' }}>{fmt3(gt.salesReturn)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{fmt3(gt.total)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#7c3aed' }}>{fmt3(gt.sales)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#be185d' }}>{fmt3(gt.purchaseReturn)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#065f46' }}>{fmt3(gt.closingStock)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt2(gt.stockValue)}</Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          )}
        </ScrollArea>

        {rows.length > 0 && (
          <Box p="sm" style={{ borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <Group gap="xl">
              <Text size="xs" c="dimmed">Opening (OB) = Balance at start of period</Text>
              <Text size="xs" c="dimmed">Total = OB + Purchase + Sale Return</Text>
              <Text size="xs" c="dimmed">Closing = Total − Sales − Purchase Return</Text>
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default StockRegister;
