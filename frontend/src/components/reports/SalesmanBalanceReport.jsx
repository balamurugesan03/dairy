import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Text, Group, Button, LoadingOverlay,
  Stack, Title, Grid, Card, Badge, Select, TextInput,
  ScrollArea, Divider, ActionIcon, Tooltip, Box
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet, IconPrinter, IconSearch, IconX,
  IconReportAnalytics, IconCalendar, IconUser, IconCurrencyRupee
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { milkSalesAPI, customerAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';
import { useCompany } from '../../context/CompanyContext';
import { message } from '../../utils/toast';
import * as XLSX from 'xlsx';

/* ─── helpers ─────────────────────────────────────────────────── */
const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '');

/* ─── Print Styles (injected once) ──────────────────────────────── */
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #salesman-balance-print, #salesman-balance-print * { visibility: visible !important; }
  #salesman-balance-print { position: fixed; inset: 0; padding: 12mm 14mm; font-size: 10px; }
  .no-print { display: none !important; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5px; }
  th, td { border: 1px solid #333; padding: 3px 5px; }
  .report-header { text-align: center; margin-bottom: 8px; }
  @page { size: A4 landscape; margin: 10mm; }
}
`;

/* ════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════ */
const SalesmanBalanceReport = () => {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const navigate = useNavigate();

  const [fromDate, setFromDate]         = useState(null);
  const [toDate, setToDate]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [report, setReport]             = useState(null);

  // Customer search
  const [customers, setCustomers]       = useState([]);
  const [custSearch, setCustSearch]     = useState('');
  const [selectedCust, setSelectedCust] = useState(null);   // { _id, name }
  const [custLoading, setCustLoading]   = useState(false);

  const styleRef = useRef(null);
  const printRef = useRef(null);

  // Inject print styles once
  if (!styleRef.current) {
    const s = document.createElement('style');
    s.textContent = PRINT_STYLE;
    document.head.appendChild(s);
    styleRef.current = s;
  }

  /* ── Customer search ─────────────────────────────────────────── */
  const searchCustomers = useCallback(async (q) => {
    if (!q || q.length < 2) { setCustomers([]); return; }
    setCustLoading(true);
    try {
      const res = await customerAPI.getAll({ search: q, limit: 20 });
      setCustomers((res.data || []).map(c => ({ value: c._id, label: c.name })));
    } catch { /* ignore */ } finally { setCustLoading(false); }
  }, []);

  /* ── Fetch report ────────────────────────────────────────────── */
  const fetchReport = async () => {
    if (!fromDate || !toDate) { message.error('Please select date range'); return; }
    if (dayjs(toDate).isBefore(dayjs(fromDate))) { message.error('End date must be after start date'); return; }

    setLoading(true);
    try {
      const params = {
        startDate: dayjs(fromDate).format('YYYY-MM-DD'),
        endDate:   dayjs(toDate).format('YYYY-MM-DD'),
      };
      if (selectedCust) params.creditorId = selectedCust._id;

      const res = await milkSalesAPI.getBalanceReport(params);
      if (res?.success) {
        setReport({ ...res.data, startDate: params.startDate, endDate: params.endDate });
      } else {
        message.error(res?.message || 'Failed to load report');
      }
    } catch (err) {
      message.error(err?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  /* ── Excel export ────────────────────────────────────────────── */
  const exportExcel = () => {
    if (!report) return;
    const rows = report.rows.map(r => ({
      'Date':              fmtDate(r.date),
      'Opening Balance':   r.ob.toFixed(2),
      'AM - QTY (Ltr)':   r.am.qty.toFixed(3),
      'AM - Value (₹)':   r.am.value.toFixed(2),
      'PM - QTY (Ltr)':   r.pm.qty.toFixed(3),
      'PM - Value (₹)':   r.pm.value.toFixed(2),
      'AM & PM Sales':     r.totalSalesValue.toFixed(2),
      'DayBook Payment':   r.payment.toFixed(2),
      'DayBook Receipt':   r.receipt.toFixed(2),
      'Balance':           r.balance.toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Report');
    XLSX.writeFile(wb, `salesman_balance_${report.startDate}_to_${report.endDate}.xlsx`);
  };

  /* ── Summary cards ───────────────────────────────────────────── */
  const renderSummaryCards = () => {
    if (!report) return null;
    const t = report.totals;
    return (
      <Grid mb="md">
        {[
          { label: 'Total AM Sales',  value: `${fmt(t.amQty)} Ltr / ₹${fmt(t.amValue)}`, color: 'blue',  icon: <IconCurrencyRupee size={22} /> },
          { label: 'Total PM Sales',  value: `${fmt(t.pmQty)} Ltr / ₹${fmt(t.pmValue)}`, color: 'cyan',  icon: <IconCurrencyRupee size={22} /> },
          { label: 'Total Sales',     value: `₹${fmt(t.totalSalesValue)}`,                color: 'green', icon: <IconReportAnalytics size={22} /> },
          { label: 'Closing Balance', value: `₹${fmt(report.closingBalance)}`,            color: 'teal',  icon: <IconCurrencyRupee size={22} /> },
        ].map(c => (
          <Grid.Col key={c.label} span={{ base: 12, sm: 6, md: 3 }}>
            <Card p="md" withBorder bg={`${c.color}.0`}>
              <Group gap="xs">
                <Box c={`${c.color}.6`}>{c.icon}</Box>
                <div>
                  <Text size="xs" c="dimmed">{c.label}</Text>
                  <Text size="md" fw={700} c={c.color}>{c.value}</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    );
  };

  /* ══════════════════════════════════════════════════════════════
     Render
  ═══════════════════════════════════════════════════════════════ */
  return (
    <Container size="xl" py="md">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <Paper p="md" withBorder mb="md" bg="blue.0">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm">
            <Box c="blue.7"><IconReportAnalytics size={32} /></Box>
            <div>
              <Title order={3} c="blue.8">Salesman Balance Report</Title>
              <Text size="sm" c="dimmed">
                {report
                  ? `Period: ${fmtDate(report.startDate)} to ${fmtDate(report.endDate)}`
                  : 'Day-wise sales & outstanding balance statement'}
              </Text>
            </div>
          </Group>
          <Group gap="sm" className="no-print">
            {report && (<>
              <Button leftSection={<IconFileSpreadsheet size={16} />} variant="light" color="green" size="sm" onClick={exportExcel}>
                Export Excel
              </Button>
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" size="sm" onClick={() => printReport(printRef, { title: 'Salesman Balance Report', orientation: 'landscape' })}>
                Print / PDF
              </Button>
            </>)}
            <Button leftSection={<IconX size={16} />} variant="default" size="sm" onClick={() => navigate('/')}>
              Close
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <Paper p="md" withBorder mb="md" shadow="xs" className="no-print">
        <Grid align="flex-end">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <DatePickerInput
              label="From Date"
              placeholder="Select start date"
              value={fromDate}
              onChange={setFromDate}
              leftSection={<IconCalendar size={16} />}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <DatePickerInput
              label="To Date"
              placeholder="Select end date"
              value={toDate}
              onChange={setToDate}
              leftSection={<IconCalendar size={16} />}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8, md: 4 }}>
            <Select
              label="Customer / Creditor (optional)"
              placeholder="Search customer by name..."
              data={customers}
              searchable
              clearable
              onSearchChange={(q) => { setCustSearch(q); searchCustomers(q); }}
              searchValue={custSearch}
              nothingFoundMessage={custLoading ? 'Searching...' : 'No customers found'}
              leftSection={<IconUser size={16} />}
              onChange={(val) => {
                if (!val) { setSelectedCust(null); return; }
                const found = customers.find(c => c.value === val);
                setSelectedCust(found ? { _id: found.value, name: found.label } : null);
              }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4, md: 2 }}>
            <Button
              leftSection={<IconSearch size={16} />}
              fullWidth
              onClick={fetchReport}
              loading={loading}
            >
              Generate
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* ── Main Report ─────────────────────────────────────────── */}
      <Paper p="lg" withBorder shadow="sm" pos="relative" id="salesman-balance-print" ref={printRef}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {report && !loading && (
          <>
            {/* ── Summary Cards ─────────────────────────────────── */}
            <div className="no-print">{renderSummaryCards()}</div>

            {/* ── Report Header (print-visible) ─────────────────── */}
            <Paper p="sm" mb="md" withBorder bg="gray.0" className="report-header">
              <Stack gap={2} align="center">
                <Title order={3} tt="uppercase">{companyName}</Title>
                <Title order={5}>SALESMAN AS ON DATE BALANCE STATEMENT</Title>
                <Text size="sm" fw={500}>
                  FOR THE PERIOD OF {fmtDate(report.startDate)} TO {fmtDate(report.endDate)}
                </Text>
                {selectedCust && (
                  <Text size="sm" c="dimmed">
                    Customer: <strong>{selectedCust.name}</strong>
                  </Text>
                )}
                {report.creditorName && !selectedCust && (
                  <Text size="sm" c="dimmed">Customer: <strong>{report.creditorName}</strong></Text>
                )}
              </Stack>
            </Paper>

            {/* ── Table ─────────────────────────────────────────── */}
            <ScrollArea>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  {/* ── Row 1: group headers ─── */}
                  <tr style={{ backgroundColor: '#1c7ed6', color: '#fff' }}>
                    <th rowSpan={2} style={th({ width: 85 })}>Date</th>
                    <th rowSpan={2} style={th({ width: 85 })}>OB</th>
                    <th colSpan={2} style={th()}>AM — Credit Sales</th>
                    <th colSpan={2} style={th()}>PM — Credit Sales</th>
                    <th rowSpan={2} style={th({ width: 85 })}>AM & PM<br />Sales Value</th>
                    <th colSpan={2} style={th()}>Posted in Day Book</th>
                    <th rowSpan={2} style={th({ width: 85 })}>Balance</th>
                  </tr>
                  {/* ── Row 2: sub-headers ──── */}
                  <tr style={{ backgroundColor: '#339af0', color: '#fff' }}>
                    <th style={th({ width: 70 })}>QTY</th>
                    <th style={th({ width: 85 })}>Value</th>
                    <th style={th({ width: 70 })}>QTY</th>
                    <th style={th({ width: 85 })}>Value</th>
                    <th style={th({ width: 85 })}>Payment</th>
                    <th style={th({ width: 85 })}>Receipt</th>
                  </tr>
                </thead>

                <tbody>
                  {report.rows.map((r, i) => (
                    <tr
                      key={r.date}
                      style={{
                        backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e7f5ff'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#f8fafc'}
                    >
                      <td style={td({ fontWeight: 600 })}>{fmtDate(r.date)}</td>
                      <td style={td({ textAlign: 'right', color: r.ob < 0 ? '#e03131' : undefined })}>{fmt(r.ob)}</td>
                      <td style={td({ textAlign: 'right' })}>{r.am.qty ? r.am.qty.toFixed(3) : '—'}</td>
                      <td style={td({ textAlign: 'right' })}>{r.am.value ? fmt(r.am.value) : '—'}</td>
                      <td style={td({ textAlign: 'right' })}>{r.pm.qty ? r.pm.qty.toFixed(3) : '—'}</td>
                      <td style={td({ textAlign: 'right' })}>{r.pm.value ? fmt(r.pm.value) : '—'}</td>
                      <td style={td({ textAlign: 'right', fontWeight: 600, color: '#2f9e44' })}>
                        {r.totalSalesValue ? fmt(r.totalSalesValue) : '—'}
                      </td>
                      <td style={td({ textAlign: 'right', color: '#e03131' })}>{r.payment ? fmt(r.payment) : '—'}</td>
                      <td style={td({ textAlign: 'right', color: '#1864ab' })}>{r.receipt ? fmt(r.receipt) : '—'}</td>
                      <td style={td({ textAlign: 'right', fontWeight: 700, color: r.balance < 0 ? '#c92a2a' : '#2b8a3e' })}>
                        {fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* ── Customer Total ─────────────────────────────── */}
                <tfoot>
                  <tr style={{ backgroundColor: '#d3f9d8', fontWeight: 700 }}>
                    <td colSpan={2} style={td({ textAlign: 'right', fontSize: '12px' })}>Customer Total</td>
                    <td style={td({ textAlign: 'right' })}>{report.totals.amQty.toFixed(3)}</td>
                    <td style={td({ textAlign: 'right', color: '#2f9e44' })}>{fmt(report.totals.amValue)}</td>
                    <td style={td({ textAlign: 'right' })}>{report.totals.pmQty.toFixed(3)}</td>
                    <td style={td({ textAlign: 'right', color: '#2f9e44' })}>{fmt(report.totals.pmValue)}</td>
                    <td style={td({ textAlign: 'right', color: '#2f9e44' })}>{fmt(report.totals.totalSalesValue)}</td>
                    <td style={td({ textAlign: 'right', color: '#e03131' })}>{fmt(report.totals.payment)}</td>
                    <td style={td({ textAlign: 'right', color: '#1864ab' })}>{fmt(report.totals.receipt)}</td>
                    <td style={td({ textAlign: 'right', color: report.closingBalance < 0 ? '#c92a2a' : '#2b8a3e' })}>
                      {fmt(report.closingBalance)}
                    </td>
                  </tr>

                  {/* ── Grand Total (same as customer total for single-creditor report) ── */}
                  <tr style={{ backgroundColor: '#1c7ed6', color: '#fff', fontWeight: 700, fontSize: '13px' }}>
                    <td colSpan={2} style={td({ textAlign: 'right', color: '#fff' })}>Grand Total</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{report.totals.amQty.toFixed(3)}</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{fmt(report.totals.amValue)}</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{report.totals.pmQty.toFixed(3)}</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{fmt(report.totals.pmValue)}</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{fmt(report.totals.totalSalesValue)}</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{fmt(report.totals.payment)}</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{fmt(report.totals.receipt)}</td>
                    <td style={td({ textAlign: 'right', color: '#fff' })}>{fmt(report.closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>

            {/* ── Balance formula note ───────────────────────────── */}
            <Divider my="md" />
            <Group gap="xl" wrap="wrap">
              <Text size="xs" c="dimmed">
                <strong>Balance Formula:</strong> Balance = (OB + AM & PM Sales Value) − Receipt
              </Text>
              <Text size="xs" c="dimmed">
                <strong>OB:</strong> Opening Balance carried from previous day
              </Text>
              <Text size="xs" c="dimmed">
                <strong>Opening Balance:</strong> ₹{fmt(report.openingBalance)}
              </Text>
            </Group>
          </>
        )}

        {/* ── Empty state ─────────────────────────────────────────── */}
        {!report && !loading && (
          <Stack align="center" py="xl">
            <Box c="gray.4"><IconReportAnalytics size={72} /></Box>
            <Text c="dimmed" size="lg" ta="center">
              Select a date range and click <strong>Generate</strong> to view the report
            </Text>
            <Text c="dimmed" size="sm" ta="center">
              Optionally filter by a specific Customer / Creditor
            </Text>
          </Stack>
        )}
      </Paper>
    </Container>
  );
};

/* ─── inline style helpers ────────────────────────────────────── */
const th = (extra = {}) => ({
  border: '1px solid #a5d8ff',
  padding: '6px 8px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  ...extra,
});

const td = (extra = {}) => ({
  border: '1px solid #dee2e6',
  padding: '5px 8px',
  whiteSpace: 'nowrap',
  ...extra,
});

export default SalesmanBalanceReport;
