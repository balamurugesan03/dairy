import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Stack, SimpleGrid, ThemeIcon, Loader, Center, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconPackages, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconX
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
        mode: 'item'
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
      Item: r.itemName, Unit: r.unit, Rate: r.rate,
      Opening: r.ob, Purchase: r.purchase, 'Sale Return': r.salesReturn,
      Total: r.total, Sales: r.sales, 'Purch. Return': r.purchaseReturn,
      Closing: r.closingStock, 'Stock Value': r.stockValue,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Register');
    XLSX.writeFile(wb, `stock_register_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Stock register exported to Excel', color: 'green' });
  };

  const rows = reportData?.rows || [];
  const gt = reportData?.grandTotal;

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
    { label: '#',             style: thStyle },
    { label: 'Item Name',     style: thStyle },
    { label: 'Unit',          style: { ...thStyle, textAlign: 'center' } },
    { label: 'Rate',          style: thStyleR },
    { label: 'Opening',       style: thStyleR },
    { label: 'Purchase',      style: thStyleR },
    { label: 'Sale Return',   style: thStyleR },
    { label: 'Total',         style: thStyleR },
    { label: 'Sales',         style: thStyleR },
    { label: 'Purch. Return', style: thStyleR },
    { label: 'Closing',       style: thStyleR },
    { label: 'Stock Value',   style: thStyleR },
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
                  Item-wise consolidated stock summary
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
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              {[
                { label: 'Total Rows', value: rows.length, color: 'green.8' },
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
            label="From Date"
            value={dateRange[0]}
            onChange={(val) => { setDateRange([val, dateRange[1]]); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '1 1 140px' }}
            size="sm"
          />
          <DatePickerInput
            label="To Date"
            value={dateRange[1]}
            onChange={(val) => { setDateRange([dateRange[0], val]); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '1 1 140px' }}
            size="sm"
          />
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
            <Text fw={700} size="sm" c="white">Item-wise Stock Summary</Text>
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
                {buildItemRows()}
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
              <Text size="xs" c="dimmed">Opening = Balance at start of period</Text>
              <Text size="xs" c="dimmed">Total = Opening + Purchase + Sale Return</Text>
              <Text size="xs" c="dimmed">Closing = Total − Sales − Purchase Return</Text>
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default StockRegister;
