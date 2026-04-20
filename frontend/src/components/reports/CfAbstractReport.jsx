import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Group, Text, Title, Button, Table, ScrollArea,
  Loader, Center, Stack, Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCalendar, IconRefresh, IconFileExport, IconInbox, IconPrinter, IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI, itemAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const fmt = (n, d = 2) => parseFloat(n || 0).toFixed(d);
const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '-';

const getFYRange = () => {
  const now = dayjs();
  const fyStart = now.month() >= 3 ? now.year() : now.year() - 1;
  return [new Date(fyStart, 3, 1), new Date(fyStart + 1, 2, 31)];
};

const PRESETS = [
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom', label: 'Custom' }
];

const getPresetRange = (p) => {
  const now = dayjs();
  switch (p) {
    case 'thisMonth': return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth': return [now.subtract(1, 'month').startOf('month').toDate(), now.subtract(1, 'month').endOf('month').toDate()];
    case 'financialYear': return getFYRange();
    default: return [null, null];
  }
};

/* ─── Print stylesheet injected into the print window ─────────────────────── */
const buildPrintHtml = (rows, grandTotals, companyName, periodLabel, itemOptions) => {
  const itemName = rows[0]?.product || '';
  const rowsHtml = rows.map((r, i) => {
    const totalQty = parseFloat(r.qty || 0) + parseFloat(r.freeQty || 0);
    const netAmt = parseFloat(r.purchAmount || 0) - parseFloat(r.earnings || 0) - parseFloat(r.recovery || 0);
    const amount = totalQty * parseFloat(r.rate || 0);
    const bg = i % 2 === 0 ? '' : 'style="background:#f5f5f5"';
    return `<tr ${bg}>
      <td class="tc">${fmtDate(r.date)}</td>
      <td class="tc">${r.invoiceNo || ''}<br/><span class="sub">${fmtDate(r.invoiceDate)}</span></td>
      <td>${r.supplier || ''}</td>
      <td class="tr">${fmt(r.purchAmount)}</td>
      <td class="tr">${fmt(r.earnings)}</td>
      <td class="tr">${fmt(r.recovery)}</td>
      <td class="tr fw">${fmt(netAmt)}</td>
      <td>${r.product || ''}</td>
      <td class="tr">${fmt(r.qty)}</td>
      <td class="tr">${fmt(r.freeQty)}</td>
      <td class="tr">${fmt(totalQty)}</td>
      <td class="tr">${fmt(r.rate)}</td>
      <td class="tr">${fmt(amount)}</td>
    </tr>`;
  }).join('');

  const gt = grandTotals || {};
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>Inventory Purchase Register – ${companyName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
  .wrap { padding: 10mm 12mm; }
  .co-name { font-size: 16px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 3px; }
  .co-sub  { font-size: 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #d9d9d9; border: 1px solid #666; padding: 5px 4px; font-size: 9px; text-transform: uppercase; text-align: center; font-weight: 800; }
  td { border: 1px solid #aaa; padding: 4px; vertical-align: middle; }
  .tc { text-align: center; }
  .tr { text-align: right; }
  .fw { font-weight: 700; }
  .sub { font-size: 9px; color: #555; }
  .gtotal td { background: #d9d9d9; font-weight: 900; border: 1.5px solid #333; font-size: 11px; }
  .footer { margin-top: 20mm; display: flex; justify-content: space-between; padding: 0 10mm; }
  .footer div { text-align: center; min-width: 100px; }
  .footer .sign-line { border-top: 1px solid #000; margin-bottom: 4px; }
  @media print { @page { size: A3 landscape; margin: 8mm; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="co-name">${companyName}</div>
  <div class="co-sub">INVENTORY PURCHASE REGISTER CHECK LIST FOR THE PERIOD OF ${periodLabel}</div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Inv. No. &amp; Date</th>
        <th>Supplier</th>
        <th>Purch. Amnt</th>
        <th>Earnings</th>
        <th>Recovery</th>
        <th>Net Amnt</th>
        <th>Product</th>
        <th>Qty</th>
        <th>Free Qty</th>
        <th>Total Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="gtotal">
        <td colspan="3" style="text-align:center">G TOTAL (${rows.length} invoices)</td>
        <td class="tr">${fmt(gt.purchAmount)}</td>
        <td class="tr">${fmt(gt.earnings)}</td>
        <td class="tr">${fmt(gt.recovery)}</td>
        <td class="tr">${fmt(gt.netAmount)}</td>
        <td></td>
        <td class="tr">${fmt(gt.qty)}</td>
        <td class="tr">${fmt(gt.freeQty)}</td>
        <td class="tr">${fmt(gt.totalQty)}</td>
        <td></td>
        <td class="tr">${fmt((parseFloat(gt.totalQty || 0)) * (rows.length ? rows.reduce((s, r) => s + parseFloat(r.rate || 0), 0) / rows.length : 0))}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div><div class="sign-line">&nbsp;</div>President</div>
    <div><div class="sign-line">&nbsp;</div>Secretary</div>
  </div>
</div>
</body></html>`;
};

const CfAbstractReport = () => {
  const navigate = useNavigate();
  const printRef = useRef(null);
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'VILLOOR KSS';

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [preset, setPreset] = useState('financialYear');
  const [dateRange, setDateRange] = useState(getFYRange());
  const [itemOptions, setItemOptions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  useState(() => {
    itemAPI.getAll({ status: 'Active', limit: 1000 }).then(res => {
      const list = res.data || [];
      setItemOptions(list.map(i => ({ value: i._id, label: `${i.itemCode} - ${i.itemName}` })));
    }).catch(() => {});
  }, []);

  const fetchReport = async () => {
    if (!dateRange[0] || !dateRange[1]) {
      notifications.show({ title: 'Error', message: 'Please select a date range', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        endDate: dayjs(dateRange[1]).format('YYYY-MM-DD')
      };
      if (selectedItem) params.itemId = selectedItem;
      const res = await reportAPI.inventoryPurchaseRegister(params);
      setReportData(res.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch report', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const rows = reportData?.rows || [];
  const gt = reportData?.grandTotals;

  const periodLabel = dateRange[0] && dateRange[1]
    ? `${fmtDate(dateRange[0])} TO ${fmtDate(dateRange[1])}`
    : '';

  const handlePrint = () => {
    if (!rows.length) return;
    const html = buildPrintHtml(rows, gt, companyName.toUpperCase(), periodLabel, itemOptions);
    const w = window.open('', '_blank', 'width=1200,height=800');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const handleExport = () => {
    if (!rows.length) return;
    const data = rows.map((r, i) => {
      const totalQty = parseFloat(r.qty || 0) + parseFloat(r.freeQty || 0);
      const netAmt = parseFloat(r.purchAmount || 0) - parseFloat(r.earnings || 0) - parseFloat(r.recovery || 0);
      return {
        '#': i + 1,
        Date: fmtDate(r.date),
        'Inv. No': r.invoiceNo || '',
        'Inv. Date': fmtDate(r.invoiceDate),
        Supplier: r.supplier || '',
        'Purch. Amnt': fmt(r.purchAmount),
        Earnings: fmt(r.earnings),
        Recovery: fmt(r.recovery),
        'Net Amnt': fmt(netAmt),
        Product: r.product || '',
        Qty: fmt(r.qty),
        'Free Qty': fmt(r.freeQty),
        'Total Qty': fmt(totalQty),
        Rate: fmt(r.rate),
        Amount: fmt(totalQty * parseFloat(r.rate || 0))
      };
    });
    // Grand total row
    if (gt) data.push({
      '#': 'G TOTAL',
      Date: '', 'Inv. No': '', 'Inv. Date': '', Supplier: '',
      'Purch. Amnt': fmt(gt.purchAmount),
      Earnings: fmt(gt.earnings),
      Recovery: fmt(gt.recovery),
      'Net Amnt': fmt(gt.netAmount),
      Product: '',
      Qty: fmt(gt.qty),
      'Free Qty': fmt(gt.freeQty),
      'Total Qty': fmt(gt.totalQty),
      Rate: '', Amount: ''
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Register');
    XLSX.writeFile(wb, `inventory_purchase_register_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Report exported to Excel', color: 'green' });
  };

  /* ─── Styles ──────────────────────────────────────────────────────────────── */
  const TH = {
    fontWeight: 800, fontSize: 10, textTransform: 'uppercase', color: '#1a1a1a',
    padding: '7px 6px', whiteSpace: 'nowrap', background: '#e0e0e0',
    border: '1px solid #9e9e9e', textAlign: 'center'
  };
  const TD = { padding: '5px 7px', fontSize: 11, border: '1px solid #d0d0d0', color: '#1a1a1a' };
  const TDr = { ...TD, textAlign: 'right' };
  const TDc = { ...TD, textAlign: 'center' };

  return (
    <Box p="md">
      {/* ── Screen Header ──────────────────────────────────────────────────── */}
      <Paper radius="md" mb="md" style={{ overflow: 'hidden', border: '1px solid #bdbdbd' }}>
        <Box style={{ background: '#424242', padding: '10px 20px' }}>
          <Group justify="space-between" align="center">
            <Box>
              <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Inventory Purchase Register</Title>
              <Text size="xs" c="#bdbdbd">Purchase register checklist — inventory stock-in transactions</Text>
            </Box>
            <Button variant="white" color="dark" leftSection={<IconX size={16} />} onClick={() => navigate('/')} size="sm">
              Close
            </Button>
          </Group>
        </Box>

        {/* Summary strip */}
        {gt && rows.length > 0 && (
          <Box px="xl" py="xs" style={{ background: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
            <Group gap="xl" justify="center">
              {[
                { label: 'Invoices', value: rows.length },
                { label: 'Total Qty', value: fmt(gt.qty) },
                { label: 'Purch. Amount', value: `₹${fmt(gt.purchAmount)}` },
                { label: 'Earnings', value: `₹${fmt(gt.earnings)}` },
                { label: 'Recovery', value: `₹${fmt(gt.recovery)}` },
                { label: 'Net Amount', value: `₹${fmt(gt.netAmount)}` }
              ].map(s => (
                <Box key={s.label} style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">{s.label}</Text>
                  <Text fw={800} size="sm" c="#212121">{s.value}</Text>
                </Box>
              ))}
            </Group>
          </Box>
        )}
      </Paper>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Paper radius="md" p="md" mb="md" withBorder>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select
            label="Period"
            value={preset}
            onChange={v => { setPreset(v); if (v !== 'custom') setDateRange(getPresetRange(v)); }}
            data={PRESETS}
            style={{ flex: '1 1 150px' }}
            size="sm"
          />
          <DatePickerInput
            type="range"
            label="Date Range"
            value={dateRange}
            onChange={v => { setDateRange(v); setPreset('custom'); }}
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
            searchable clearable
            style={{ flex: '2 1 220px' }}
            size="sm"
          />
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} color="dark" size="sm">
            Generate
          </Button>
          {rows.length > 0 && (
            <>
              <Button leftSection={<IconFileExport size={16} />} variant="light" color="gray" onClick={handleExport} size="sm">
                Export Excel
              </Button>
              <Button leftSection={<IconPrinter size={16} />} variant="outline" color="dark" onClick={handlePrint} size="sm">
                Print A3 / A4
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* ── Report Table ───────────────────────────────────────────────────── */}
      {loading ? (
        <Center py="xl"><Loader size="md" color="dark" /></Center>
      ) : !reportData ? (
        <Paper radius="md" withBorder>
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text c="dimmed" size="sm">Select a date range and click Generate</Text>
            </Stack>
          </Center>
        </Paper>
      ) : rows.length === 0 ? (
        <Paper radius="md" withBorder>
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconInbox size={40} color="#bdbdbd" />
              <Text c="dimmed" size="sm">No purchase transactions found for this period</Text>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <Paper radius="md" style={{ overflow: 'hidden', border: '1.5px solid #9e9e9e' }}>
          {/* Document-style header (visible on screen, mirrored in print) */}
          <Box style={{ background: '#f5f5f5', borderBottom: '2px solid #424242', padding: '10px 16px', textAlign: 'center' }}>
            <Text fw={900} size="lg" tt="uppercase" style={{ letterSpacing: 2 }}>{companyName}</Text>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: 1 }}>
              INVENTORY PURCHASE REGISTER CHECK LIST FOR THE PERIOD OF {periodLabel}
            </Text>
          </Box>

          <ScrollArea>
            <Table withColumnBorders style={{ fontSize: 11 }}>
              <Table.Thead>
                <Table.Tr>
                  {[
                    { label: '#', w: 30 },
                    { label: 'Date', w: 70 },
                    { label: 'Inv. No. & Date', w: 110 },
                    { label: 'Supplier', w: 130 },
                    { label: 'Purch. Amnt', w: 90 },
                    { label: 'Earnings', w: 80 },
                    { label: 'Recovery', w: 80 },
                    { label: 'Net Amnt', w: 90 },
                    { label: 'Product', w: 160 },
                    { label: 'Qty', w: 65 },
                    { label: 'Free Qty', w: 65 },
                    { label: 'Total Qty', w: 70 },
                    { label: 'Rate', w: 70 },
                    { label: 'Amount', w: 90 }
                  ].map(c => (
                    <Table.Th key={c.label} style={{ ...TH, width: c.w, minWidth: c.w }}>{c.label}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r, i) => {
                  const totalQty = parseFloat(r.qty || 0) + parseFloat(r.freeQty || 0);
                  const netAmt = parseFloat(r.purchAmount || 0) - parseFloat(r.earnings || 0) - parseFloat(r.recovery || 0);
                  const amount = totalQty * parseFloat(r.rate || 0);
                  return (
                    <Table.Tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <Table.Td style={{ ...TDc, color: '#757575', fontSize: 10 }}>{i + 1}</Table.Td>
                      <Table.Td style={{ ...TDc, whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</Table.Td>
                      <Table.Td style={{ ...TDc }}>
                        <Text size="xs" fw={600}>{r.invoiceNo || '—'}</Text>
                        <Text size="10px" c="dimmed">{fmtDate(r.invoiceDate)}</Text>
                      </Table.Td>
                      <Table.Td style={{ ...TD, fontWeight: 600 }}>{r.supplier || '—'}</Table.Td>
                      <Table.Td style={TDr}>{fmt(r.purchAmount)}</Table.Td>
                      <Table.Td style={TDr}>{fmt(r.earnings)}</Table.Td>
                      <Table.Td style={TDr}>{fmt(r.recovery)}</Table.Td>
                      <Table.Td style={{ ...TDr, fontWeight: 700 }}>{fmt(netAmt)}</Table.Td>
                      <Table.Td style={TD}>{r.product || '—'}</Table.Td>
                      <Table.Td style={TDr}>{fmt(r.qty)}</Table.Td>
                      <Table.Td style={TDr}>{fmt(r.freeQty)}</Table.Td>
                      <Table.Td style={{ ...TDr, fontWeight: 700 }}>{fmt(totalQty)}</Table.Td>
                      <Table.Td style={TDr}>{fmt(r.rate)}</Table.Td>
                      <Table.Td style={{ ...TDr, fontWeight: 700 }}>{fmt(amount)}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
              {gt && (
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#e0e0e0' }}>
                    <Table.Td colSpan={4} style={{ ...TD, fontWeight: 900, fontSize: 12, textAlign: 'center', background: '#d4d4d4', border: '1.5px solid #616161' }}>
                      G TOTAL — {rows.length} invoice{rows.length !== 1 ? 's' : ''}
                    </Table.Td>
                    <Table.Td style={{ ...TDr, fontWeight: 900, fontSize: 12, background: '#d4d4d4', border: '1.5px solid #616161' }}>{fmt(gt.purchAmount)}</Table.Td>
                    <Table.Td style={{ ...TDr, fontWeight: 900, fontSize: 12, background: '#d4d4d4', border: '1.5px solid #616161' }}>{fmt(gt.earnings)}</Table.Td>
                    <Table.Td style={{ ...TDr, fontWeight: 900, fontSize: 12, background: '#d4d4d4', border: '1.5px solid #616161' }}>{fmt(gt.recovery)}</Table.Td>
                    <Table.Td style={{ ...TDr, fontWeight: 900, fontSize: 12, background: '#d4d4d4', border: '1.5px solid #616161' }}>{fmt(gt.netAmount)}</Table.Td>
                    <Table.Td style={{ ...TD, background: '#d4d4d4', border: '1.5px solid #616161' }} />
                    <Table.Td style={{ ...TDr, fontWeight: 900, fontSize: 12, background: '#d4d4d4', border: '1.5px solid #616161' }}>{fmt(gt.qty)}</Table.Td>
                    <Table.Td style={{ ...TDr, fontWeight: 900, fontSize: 12, background: '#d4d4d4', border: '1.5px solid #616161' }}>{fmt(gt.freeQty)}</Table.Td>
                    <Table.Td style={{ ...TDr, fontWeight: 900, fontSize: 12, background: '#d4d4d4', border: '1.5px solid #616161' }}>{fmt(gt.totalQty)}</Table.Td>
                    <Table.Td style={{ ...TD, background: '#d4d4d4', border: '1.5px solid #616161' }} />
                    <Table.Td style={{ ...TD, background: '#d4d4d4', border: '1.5px solid #616161' }} />
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </ScrollArea>

          {/* Footer signature block */}
          {rows.length > 0 && (
            <Box p="md" style={{ borderTop: '1px solid #e0e0e0', background: '#fafafa' }}>
              <Group justify="space-between" px="xl">
                <Box style={{ textAlign: 'center', minWidth: 120 }}>
                  <Box style={{ borderTop: '1px solid #424242', paddingTop: 4 }}>
                    <Text size="xs" fw={600} tt="uppercase">President</Text>
                  </Box>
                </Box>
                <Box style={{ textAlign: 'center' }}>
                  <Text size="xs" c="dimmed">Net Amnt = Purch. Amnt − Earnings − Recovery &nbsp;|&nbsp; Total Qty = Qty + Free Qty</Text>
                </Box>
                <Box style={{ textAlign: 'center', minWidth: 120 }}>
                  <Box style={{ borderTop: '1px solid #424242', paddingTop: 4 }}>
                    <Text size="xs" fw={600} tt="uppercase">Secretary</Text>
                  </Box>
                </Box>
              </Group>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default CfAbstractReport;
