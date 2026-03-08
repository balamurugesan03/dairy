import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Group,
  Stack,
  Text,
  Title,
  Select,
  Table,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  Divider,
  Flex,
  LoadingOverlay,
  Card,
  SimpleGrid,
  ThemeIcon
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCalendar,
  IconFileSpreadsheet,
  IconPrinter,
  IconRefresh,
  IconArrowDownRight,
  IconArrowUpRight,
  IconCash,
  IconTrendingUp,
  IconTrendingDown,
  IconScale,
  IconCreditCard
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import * as XLSX from 'xlsx';

const VyaparCashflowReport = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const [dateFilterType, setDateFilterType] = useState('thisMonth');
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);
  const [paymentModeFilter, setPaymentModeFilter] = useState('All');

  const paymentModeOptions = [
    { value: 'All', label: 'All Modes' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' },
    { value: 'Cheque', label: 'Cheque' },
    { value: 'Card', label: 'Card' }
  ];

  const dateFilterOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Redirect if not Private Firm
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch on mount
  useEffect(() => {
    fetchReport();
  }, []);

  // Update date range when filter type changes
  useEffect(() => {
    const now = dayjs();
    let start, end;
    switch (dateFilterType) {
      case 'today':
        start = now.startOf('day'); end = now.endOf('day'); break;
      case 'yesterday':
        start = now.subtract(1, 'day').startOf('day'); end = now.subtract(1, 'day').endOf('day'); break;
      case 'thisWeek':
        start = now.startOf('week'); end = now.endOf('week'); break;
      case 'lastWeek':
        start = now.subtract(1, 'week').startOf('week'); end = now.subtract(1, 'week').endOf('week'); break;
      case 'thisMonth':
        start = now.startOf('month'); end = now.endOf('month'); break;
      case 'lastMonth':
        start = now.subtract(1, 'month').startOf('month'); end = now.subtract(1, 'month').endOf('month'); break;
      case 'thisQuarter':
        start = now.startOf('quarter'); end = now.endOf('quarter'); break;
      case 'thisYear':
        start = now.startOf('year'); end = now.endOf('year'); break;
      case 'custom':
        return;
      default:
        start = now.startOf('month'); end = now.endOf('month');
    }
    setDateRange([start.toDate(), end.toDate()]);
  }, [dateFilterType]);

  // Re-fetch when date range or mode filter changes
  useEffect(() => {
    fetchReport();
  }, [dateRange, paymentModeFilter]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await reportAPI.vyaparCashflow({
        filterType: 'custom',
        customStart: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        customEnd: dayjs(dateRange[1]).format('YYYY-MM-DD'),
        paymentMode: paymentModeFilter
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cashflow report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const handleExportExcel = () => {
    if (!reportData?.transactions?.length) {
      message.warning('No data to export');
      return;
    }
    const exportData = reportData.transactions.map(t => ({
      'Date': formatDate(t.date),
      'Ref No': t.voucherNumber || '-',
      'Particulars': t.particulars,
      'Category': t.category,
      'Mode': t.mode,
      'Type': t.type,
      'Inflow (₹)': t.type === 'Inflow' ? t.amount.toFixed(2) : '',
      'Outflow (₹)': t.type === 'Outflow' ? t.amount.toFixed(2) : '',
      'Balance (₹)': t.balance.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cashflow');
    XLSX.writeFile(wb, `Cashflow_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported to Excel');
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cashflow Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .inflow { color: #2e7d32; }
            .outflow { color: #c62828; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const summary = reportData?.summary || {};
  const transactions = reportData?.transactions || [];

  return (
    <Box pos="relative" p="md">
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 2 }} />

      {/* Header */}
      <Paper shadow="xs" p="md" mb="md" withBorder style={{ backgroundColor: '#fff' }}>
        <Group justify="space-between" align="center" mb="md">
          <Title order={3} fw={600} c="dark">Cashflow Report</Title>
          <Group gap="xs">
            <Tooltip label="Refresh">
              <ActionIcon variant="light" size="lg" onClick={fetchReport}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Export to Excel">
              <ActionIcon variant="light" color="green" size="lg" onClick={handleExportExcel}>
                <IconFileSpreadsheet size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print">
              <ActionIcon variant="light" color="blue" size="lg" onClick={handlePrint}>
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Filters */}
        <Flex gap="md" wrap="wrap" align="flex-end">
          <Select
            label="Period"
            placeholder="Select period"
            data={dateFilterOptions}
            value={dateFilterType}
            onChange={setDateFilterType}
            leftSection={<IconCalendar size={16} />}
            style={{ minWidth: 160 }}
            styles={{ input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' } }}
          />
          <DatePickerInput
            type="range"
            label="Date Range"
            placeholder="Select date range"
            value={dateRange}
            onChange={setDateRange}
            leftSection={<IconCalendar size={16} />}
            style={{ minWidth: 280 }}
            disabled={dateFilterType !== 'custom'}
            styles={{ input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' } }}
          />
          <Select
            label="Payment Mode"
            placeholder="Select mode"
            data={paymentModeOptions}
            value={paymentModeFilter}
            onChange={(val) => setPaymentModeFilter(val || 'All')}
            leftSection={<IconCreditCard size={16} />}
            style={{ minWidth: 160 }}
            styles={{ input: { backgroundColor: '#fff', border: '1px solid #e0e0e0' } }}
          />
        </Flex>
      </Paper>

      {/* Summary Cards */}
      {reportData && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md" mb="md">
          <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#e3f2fd' }}>
            <Group gap="sm" mb="xs">
              <ThemeIcon size="md" variant="light" color="blue" radius="xl">
                <IconScale size={16} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={500}>Opening Balance</Text>
            </Group>
            <Text fw={700} size="lg" c="blue.7">{formatCurrency(summary.openingBalance)}</Text>
          </Card>

          <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#e8f5e9' }}>
            <Group gap="sm" mb="xs">
              <ThemeIcon size="md" variant="light" color="green" radius="xl">
                <IconArrowDownRight size={16} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={500}>Total Inflow</Text>
            </Group>
            <Text fw={700} size="lg" c="green.7">{formatCurrency(summary.totalInflow)}</Text>
            <Text size="xs" c="dimmed">{summary.inflowCount || 0} transactions</Text>
          </Card>

          <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#ffebee' }}>
            <Group gap="sm" mb="xs">
              <ThemeIcon size="md" variant="light" color="red" radius="xl">
                <IconArrowUpRight size={16} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={500}>Total Outflow</Text>
            </Group>
            <Text fw={700} size="lg" c="red.7">{formatCurrency(summary.totalOutflow)}</Text>
            <Text size="xs" c="dimmed">{summary.outflowCount || 0} transactions</Text>
          </Card>

          <Card shadow="none" padding="md" radius="md" withBorder style={{ borderColor: '#fff3e0' }}>
            <Group gap="sm" mb="xs">
              <ThemeIcon size="md" variant="light" color="orange" radius="xl">
                <IconTrendingUp size={16} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={500}>Net Cashflow</Text>
            </Group>
            <Text fw={700} size="lg" c={summary.netCashflow >= 0 ? 'green.7' : 'red.7'}>
              {formatCurrency(summary.netCashflow)}
            </Text>
          </Card>

          <Card shadow="sm" padding="md" radius="md" style={{ backgroundColor: '#e8f5e9', border: '2px solid #4caf50' }}>
            <Group gap="sm" mb="xs">
              <ThemeIcon size="md" variant="filled" color="green" radius="xl">
                <IconCash size={16} />
              </ThemeIcon>
              <Text size="xs" c="green.8" fw={600}>Closing Balance</Text>
            </Group>
            <Text fw={700} size="xl" c={summary.closingBalance >= 0 ? 'green.8' : 'red.8'}>
              {formatCurrency(summary.closingBalance)}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Transactions Table */}
      <Paper shadow="xs" withBorder style={{ backgroundColor: '#fff' }} ref={printRef}>
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 900 }}>
            <Table.Thead style={{ backgroundColor: '#f5f5f5' }}>
              <Table.Tr>
                <Table.Th style={{ width: 100 }}>Date</Table.Th>
                <Table.Th style={{ width: 130 }}>Ref No</Table.Th>
                <Table.Th>Particulars</Table.Th>
                <Table.Th style={{ width: 110 }}>Category</Table.Th>
                <Table.Th style={{ width: 90 }}>Mode</Table.Th>
                <Table.Th style={{ width: 80, textAlign: 'center' }}>Type</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Inflow (₹)</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Outflow (₹)</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>Balance (₹)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transactions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Flex direction="column" align="center" justify="center" py={60}>
                      <IconCash size={48} color="#ccc" />
                      <Text c="dimmed" size="lg" mt="md">No cashflow data for selected period</Text>
                      <Text c="dimmed" size="sm">Record sales or purchases to see cashflow</Text>
                    </Flex>
                  </Table.Td>
                </Table.Tr>
              ) : (
                transactions.map((txn, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Text size="sm">{formatDate(txn.date)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{txn.voucherNumber || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{txn.particulars}</Text>
                      {txn.narration && (
                        <Text size="xs" c="dimmed">{txn.narration}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={txn.category === 'Sales' ? 'green' : 'orange'} size="sm">
                        {txn.category}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{txn.mode || '-'}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge
                        variant="filled"
                        color={txn.type === 'Inflow' ? 'green' : 'red'}
                        size="sm"
                      >
                        {txn.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {txn.type === 'Inflow' ? (
                        <Text size="sm" fw={600} c="green.7">{formatCurrency(txn.amount)}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {txn.type === 'Outflow' ? (
                        <Text size="sm" fw={600} c="red.7">{formatCurrency(txn.amount)}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={600} c={txn.balance >= 0 ? 'dark' : 'red'}>
                        {formatCurrency(txn.balance)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
            {transactions.length > 0 && (
              <Table.Tfoot style={{ backgroundColor: '#f8f9fa' }}>
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'right' }}>
                    <Text fw={700}>Totals:</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c="green.7">{formatCurrency(summary.totalInflow)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c="red.7">{formatCurrency(summary.totalOutflow)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c={summary.closingBalance >= 0 ? 'dark' : 'red'}>
                      {formatCurrency(summary.closingBalance)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Box>
      </Paper>
    </Box>
  );
};

export default VyaparCashflowReport;
