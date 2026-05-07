import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Badge, Stack, SimpleGrid, ThemeIcon, Loader, Center,
  SegmentedControl
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconPackageImport, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox, IconShoppingCart, IconPackage, IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI, itemAPI, supplierAPI } from '../../services/api';
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset] = useState('thisMonth');
  const [dateRange, setDateRange] = useState(getPresetRange('thisMonth'));
  const [viewMode, setViewMode] = useState('dateWise');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemOptions, setItemOptions] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const printRef = useRef(null);

  useEffect(() => {
    itemAPI.getAll({ status: 'Active', limit: 1000 }).then(res => {
      const list = res.data || [];
      setItemOptions(list.map(i => ({ value: i._id, label: `${i.itemCode} - ${i.itemName}` })));
    }).catch(() => {});

    supplierAPI.getAll({ status: 'Active', limit: 1000 }).then(res => {
      const list = res.data || res || [];
      const arr = Array.isArray(list) ? list : (list.suppliers || list.data || []);
      setSupplierOptions(arr.map(s => ({
        value: s._id,
        label: s.supplierId ? `${s.supplierId} - ${s.name}` : s.name
      })));
    }).catch(() => {});
  }, []);

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
      const params = {
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate: dayjs(end).format('YYYY-MM-DD')
      };
      if (selectedItem) params.itemId = selectedItem;
      if (selectedSupplier) params.supplierId = selectedSupplier;
      const res = await reportAPI.inventoryPurchaseRegister(params);
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
        'Purchase Rate': fmt(r.rate),
        'Sales Rate': fmt(r.salesRate),
        'Purchase Amt': fmt(r.purchAmount),
        Earnings: fmt(r.earnings),
        Recovery: fmt(r.recovery),
        'Net Amount': fmt(r.purchAmount - r.earnings - r.recovery)
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

  // Product-wise grouping
  const productGroups = useMemo(() => {
    const map = {};
    rows.forEach(row => {
      const key = row.product || 'Unknown';
      if (!map[key]) {
        map[key] = { product: key, unit: row.unit, invoices: 0, qty: 0, freeQty: 0, purchAmount: 0, earnings: 0, recovery: 0, rateSum: 0 };
      }
      map[key].invoices++;
      map[key].qty += parseFloat(row.qty || 0);
      map[key].freeQty += parseFloat(row.freeQty || 0);
      map[key].purchAmount += parseFloat(row.purchAmount || 0);
      map[key].earnings += parseFloat(row.earnings || 0);
      map[key].recovery += parseFloat(row.recovery || 0);
      map[key].rateSum += parseFloat(row.rate || 0);
    });
    return Object.values(map).sort((a, b) => a.product.localeCompare(b.product));
  }, [rows]);

  const productGrandTotal = useMemo(() => productGroups.reduce((acc, p) => ({
    invoices: acc.invoices + p.invoices,
    qty: acc.qty + p.qty,
    freeQty: acc.freeQty + p.freeQty,
    purchAmount: acc.purchAmount + p.purchAmount,
    earnings: acc.earnings + p.earnings,
    recovery: acc.recovery + p.recovery,
    netAmt: acc.netAmt + (p.purchAmount - p.earnings - p.recovery)
  }), { invoices: 0, qty: 0, freeQty: 0, purchAmount: 0, earnings: 0, recovery: 0, netAmt: 0 }), [productGroups]);

  const handleExportProductWise = () => {
    if (!productGroups.length) return;
    const data = productGroups.map((p, i) => ({
      '#': i + 1,
      Product: p.product,
      Unit: p.unit,
      Invoices: p.invoices,
      Qty: fmt(p.qty),
      'Free Qty': fmt(p.freeQty),
      'Total Qty': fmt(p.qty + p.freeQty),
      'Avg Rate': fmt(p.invoices ? p.rateSum / p.invoices : 0),
      'Purch. Amount': fmt(p.purchAmount),
      Earnings: fmt(p.earnings),
      Recovery: fmt(p.recovery),
      'Net Amount': fmt(p.purchAmount - p.earnings - p.recovery)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Wise');
    XLSX.writeFile(wb, `purchase_product_wise_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Product-wise report exported to Excel', color: 'green' });
  };

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
          <Table.Td colSpan={16} style={{ padding: '5px 12px', fontWeight: 800, color: '#1d4ed8', fontSize: 12 }}>
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
            <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmt(row.salesRate)}</Table.Td>
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

  const COL_HEADERS = ['#', 'Date', 'Invoice No', 'Inv. Date', 'Supplier', 'Product', 'Unit', 'Qty', 'Free Qty', 'Total Qty', 'Purchase Rate', 'Sales Rate', 'Purchase Amt', 'Earnings', 'Recovery', 'Net Amt'];

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
        <Stack gap="sm">
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
            <Select
              label="Product"
              placeholder="All Products"
              data={itemOptions}
              value={selectedItem}
              onChange={setSelectedItem}
              searchable
              clearable
              style={{ flex: '2 1 220px' }}
              size="sm"
            />
            <Select
              label="Supplier"
              placeholder="All Suppliers"
              data={supplierOptions}
              value={selectedSupplier}
              onChange={setSelectedSupplier}
              searchable
              clearable
              style={{ flex: '2 1 220px' }}
              size="sm"
            />
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} size="sm" color="green">
              Generate
            </Button>
          </Group>
          {rows.length > 0 && (
            <Group gap="md" wrap="wrap" align="center">
              <SegmentedControl
                value={viewMode}
                onChange={setViewMode}
                size="sm"
                data={[
                  { value: 'dateWise', label: <Group gap={4}><IconShoppingCart size={14} /><span>Date Wise</span></Group> },
                  { value: 'productWise', label: <Group gap={4}><IconPackage size={14} /><span>Product Wise</span></Group> }
                ]}
              />
              <Button
                leftSection={<IconFileExport size={16} />}
                variant="light" color="teal" size="sm"
                onClick={viewMode === 'productWise' ? handleExportProductWise : handleExport}
              >
                Export Excel
              </Button>
              <Button
                leftSection={<IconPrinter size={16} />}
                variant="light" color="blue" size="sm"
                onClick={() => printReport(printRef, {
                  title: viewMode === 'productWise' ? 'Purchase Register — Product Wise' : 'Purchase Register',
                  orientation: viewMode === 'productWise' ? 'portrait' : 'landscape'
                })}
              >
                Print A4
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box style={{ background: `linear-gradient(90deg, ${GREEN} 0%, #15803d 100%)`, padding: '10px 16px' }}>
          <Group justify="space-between">
            <Text fw={700} size="sm" c="white">
              {viewMode === 'productWise' ? 'Product Wise Purchase Summary' : 'Daily Purchase Flow'}
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
          ) : viewMode === 'productWise' ? (
            <Table withColumnBorders style={{ fontSize: 12 }}>
              <Table.Thead>
                <Table.Tr>
                  {['#', 'Product', 'Unit', 'Invoices', 'Qty', 'Free Qty', 'Total Qty', 'Avg Rate', 'Purch. Amt', 'Earnings', 'Recovery', 'Net Amount'].map(col => (
                    <Table.Th key={col} style={thStyle}>{col}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {productGroups.map((p, i) => {
                  const totalQty = p.qty + p.freeQty;
                  const netAmt = p.purchAmount - p.earnings - p.recovery;
                  const avgRate = p.invoices ? p.rateSum / p.invoices : 0;
                  return (
                    <Table.Tr key={p.product} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <Table.Td style={{ ...tdStyle, color: '#6b7280' }}>{i + 1}</Table.Td>
                      <Table.Td style={{ ...tdStyle, fontWeight: 700 }}>{p.product}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Badge size="xs" variant="light" color="gray">{p.unit}</Badge>
                      </Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Badge size="sm" variant="light" color="blue">{p.invoices}</Badge>
                      </Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(p.qty)}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#92400e' }}>{fmt(p.freeQty)}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(totalQty)}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmt(avgRate)}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right' }}>₹{fmt(p.purchAmount)}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#166534' }}>₹{fmt(p.earnings)}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right', color: '#dc2626' }}>₹{fmt(p.recovery)}</Table.Td>
                      <Table.Td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>₹{fmt(netAmt)}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr style={{ background: '#dcfce7' }}>
                  <Table.Td colSpan={3} style={{ padding: '8px 10px', fontWeight: 800, color: GREEN, fontSize: 12 }}>
                    Grand Total ({productGroups.length} product{productGroups.length !== 1 ? 's' : ''})
                  </Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>{productGrandTotal.invoices}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{fmt(productGrandTotal.qty)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{fmt(productGrandTotal.freeQty)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{fmt(productGrandTotal.qty + productGrandTotal.freeQty)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px' }} />
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt(productGrandTotal.purchAmount)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>₹{fmt(productGrandTotal.earnings)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>₹{fmt(productGrandTotal.recovery)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt(productGrandTotal.netAmt)}</Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
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
              {viewMode === 'dateWise' && <Text size="xs" c="dimmed">Blue rows = Day headers | Light blue rows = Day subtotals</Text>}
            </Group>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default InventoryPurchaseRegister;
