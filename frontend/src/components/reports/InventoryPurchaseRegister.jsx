import { useState, useRef } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Badge, Stack, SimpleGrid, ThemeIcon, Loader, Center
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconPackageImport, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconShoppingCart
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

const fmt = (n) => parseFloat(n || 0).toFixed(2);
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
const tdStyle = { padding: '6px 10px', fontSize: 12 };

const ZERO_SUB = { purchAmount: 0, earnings: 0, recovery: 0, netAmt: 0, qty: 0, freeQty: 0, totalQty: 0, amount: 0 };

const addToSub = (acc, row) => {
  const totalQty = parseFloat(row.qty) + parseFloat(row.freeQty);
  const netAmt = parseFloat(row.purchAmount) - parseFloat(row.earnings) - parseFloat(row.recovery);
  return {
    purchAmount: acc.purchAmount + parseFloat(row.purchAmount),
    earnings: acc.earnings + parseFloat(row.earnings),
    recovery: acc.recovery + parseFloat(row.recovery),
    netAmt: acc.netAmt + netAmt,
    qty: acc.qty + parseFloat(row.qty),
    freeQty: acc.freeQty + parseFloat(row.freeQty),
    totalQty: acc.totalQty + totalQty,
    amount: acc.amount + totalQty * parseFloat(row.rate)
  };
};

const InventoryPurchaseRegister = () => {
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
      const res = await reportAPI.inventoryPurchaseRegister({
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD')
      });
      setReportData(res.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch report', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!rows.length) return;
    const data = rows.map(r => {
      const totalQty = parseFloat(r.qty) + parseFloat(r.freeQty);
      return {
        Date: fmtDate(r.date),
        'Invoice No': r.invoiceNo,
        'Invoice Date': fmtDate(r.invoiceDate),
        Supplier: r.supplier,
        Product: r.product,
        Unit: r.unit,
        Qty: fmt(r.qty),
        'Free Qty': fmt(r.freeQty),
        'Total Qty': fmt(totalQty),
        Rate: fmt(r.rate),
        'Purch. Amount': fmt(r.purchAmount),
        Earnings: fmt(r.earnings),
        Recovery: fmt(r.recovery),
        'Net Amount': fmt(r.purchAmount - r.earnings - r.recovery),
        Amount: fmt(totalQty * r.rate)
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Register');
    XLSX.writeFile(wb, `purchase_register_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Purchase register exported to Excel', color: 'green' });
  };

  const rows = reportData?.rows || [];
  const gt = reportData?.grandTotals;

  // Group rows by date for daily flow
  const groups = {};
  const groupKeys = [];
  rows.forEach(row => {
    const key = fmtDate(row.date);
    if (!groups[key]) { groups[key] = []; groupKeys.push(key); }
    groups[key].push(row);
  });

  const renderRows = () => {
    if (!groupKeys.length) return null;
    const result = [];
    let serial = 0;

    groupKeys.forEach(key => {
      const grpRows = groups[key];
      const sub = grpRows.reduce((acc, r) => addToSub(acc, r), { ...ZERO_SUB });

      // Date header row
      result.push(
        <Table.Tr key={`hdr-${key}`} style={{ background: '#dbeafe' }}>
          <Table.Td colSpan={15} style={{ padding: '5px 12px', fontWeight: 800, color: '#1d4ed8', fontSize: 12 }}>
            <Group gap="xs">
              <IconShoppingCart size={14} />
              <span>{key}</span>
              <Text span size="xs" c="dimmed" fw={400}>
                — {grpRows.length} invoice{grpRows.length !== 1 ? 's' : ''} &nbsp;|&nbsp;
                Qty: {fmt(sub.qty)} + Free: {fmt(sub.freeQty)} &nbsp;|&nbsp;
                Net: ₹{fmt(sub.netAmt)}
              </Text>
            </Group>
          </Table.Td>
        </Table.Tr>
      );

      // Invoice rows
      grpRows.forEach((row, ri) => {
        serial++;
        const totalQty = parseFloat(row.qty) + parseFloat(row.freeQty);
        const netAmt = parseFloat(row.purchAmount) - parseFloat(row.earnings) - parseFloat(row.recovery);
        result.push(
          <Table.Tr key={`${key}-${ri}`} style={{ background: ri % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
            <Table.Td style={{ ...tdStyle, color: '#6b7280' }}>{serial}</Table.Td>
            <Table.Td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</Table.Td>
            <Table.Td style={tdStyle}>
              <Badge size="sm" variant="light" color="blue" style={{ fontFamily: 'monospace' }}>{row.invoiceNo}</Badge>
            </Table.Td>
            <Table.Td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#6b7280' }}>{fmtDate(row.invoiceDate)}</Table.Td>
            <Table.Td style={{ ...tdStyle, fontWeight: 600 }}>{row.supplier}</Table.Td>
            <Table.Td style={{ ...tdStyle, fontWeight: 600 }}>{row.product}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'center' }}>
              <Badge size="xs" variant="light" color="gray">{row.unit}</Badge>
            </Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.qty)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#92400e' }}>{fmt(row.freeQty)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(totalQty)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmt(row.rate)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmt(row.purchAmount)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#166534' }}>₹{fmt(row.earnings)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626' }}>₹{fmt(row.recovery)}</Table.Td>
            <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>₹{fmt(netAmt)}</Table.Td>
          </Table.Tr>
        );
      });

      // Day subtotal row
      result.push(
        <Table.Tr key={`sub-${key}`} style={{ background: '#eff6ff' }}>
          <Table.Td colSpan={7} style={{ padding: '6px 12px', fontWeight: 700, color: '#1d4ed8', fontSize: 11 }}>
            Day Total — {key}
          </Table.Td>
          <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{fmt(sub.qty)}</Table.Td>
          <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{fmt(sub.freeQty)}</Table.Td>
          <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{fmt(sub.totalQty)}</Table.Td>
          <Table.Td style={{ padding: '6px 10px' }} />
          <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>₹{fmt(sub.purchAmount)}</Table.Td>
          <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#166534' }}>₹{fmt(sub.earnings)}</Table.Td>
          <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#dc2626' }}>₹{fmt(sub.recovery)}</Table.Td>
          <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>₹{fmt(sub.netAmt)}</Table.Td>
        </Table.Tr>
      );
    });

    return result;
  };

  const COL_HEADERS = ['#', 'Date', 'Invoice No', 'Inv. Date', 'Supplier', 'Product', 'Unit', 'Qty', 'Free Qty', 'Total Qty', 'Rate', 'Purch. Amt', 'Earnings', 'Recovery', 'Net Amt'];

  return (
    <Box p="md" ref={printRef}>
      {/* Header */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: '1px solid #a5d6a7' }}>
        <Box style={{ background: 'linear-gradient(90deg, #166534 0%, #15803d 50%, #16a34a 100%)', padding: '10px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconPackageImport size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Purchase Register</Title>
                <Text size="xs" c="rgba(255,255,255,0.8)">Daily purchase flow — dairy cooperative stock-in transactions</Text>
              </Box>
            </Group>
          </Group>
        </Box>

        {reportData && gt && (
          <Box px="xl" py="sm" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #f0fdf4 100%)' }}>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              {[
                { label: 'Total Invoices', value: rows.length, color: 'green.8' },
                { label: 'Total Qty', value: fmt(gt.qty), color: 'blue.8' },
                { label: 'Purchase Amt', value: `₹${fmt(gt.purchAmount)}`, color: 'teal.8' },
                { label: 'Earnings', value: `₹${fmt(gt.earnings)}`, color: 'lime.8' },
                { label: 'Net Amount', value: `₹${fmt(gt.netAmount)}`, color: 'orange.8' }
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
            style={{ flex: '1 1 150px' }}
            size="sm"
          />
          <DatePickerInput
            type="range"
            label="Date Range"
            value={dateRange}
            onChange={(val) => { setDateRange(val); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '2 1 250px' }}
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
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="blue" onClick={() => printReport(printRef, { title: 'Purchase Register', orientation: 'landscape' })} size="sm">
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
            <Text fw={700} size="sm" c="white">Daily Purchase Flow</Text>
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
                <IconPackageImport size={40} color="#bdbdbd" />
                <Text c="dimmed" size="sm">Select a date range and click Generate</Text>
              </Stack>
            </Center>
          ) : rows.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconInbox size={40} color="#bdbdbd" />
                <Text c="dimmed" size="sm">No purchase transactions found for this period</Text>
              </Stack>
            </Center>
          ) : (
            <Table withColumnBorders style={{ fontSize: 12 }}>
              <Table.Thead>
                <Table.Tr>
                  {COL_HEADERS.map(col => (
                    <Table.Th key={col} style={thStyle}>{col}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {renderRows()}
              </Table.Tbody>
              {gt && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#dcfce7' }}>
                    <Table.Td colSpan={7} style={{ padding: '8px 10px', fontWeight: 800, color: GREEN, fontSize: 12 }}>
                      Grand Total ({groupKeys.length} day{groupKeys.length !== 1 ? 's' : ''}, {rows.length} invoices)
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{fmt(gt.qty)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{fmt(gt.freeQty)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{fmt(gt.totalQty)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px' }} />
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt(gt.purchAmount)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹{fmt(gt.earnings)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>₹{fmt(gt.recovery)}</Table.Td>
                    <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt(gt.netAmount)}</Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          )}
        </ScrollArea>

        {rows.length > 0 && (
          <Box p="sm" style={{ borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <Group gap="xl">
              <Text size="xs" c="dimmed">Net Amt = Purch. Amt − Earnings − Recovery</Text>
              <Text size="xs" c="dimmed">Total Qty = Qty + Free Qty</Text>
              <Text size="xs" c="dimmed">Blue rows = Day headers | Light blue rows = Day subtotals</Text>
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default InventoryPurchaseRegister;
