import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Table,
  Badge,
  Button,
  LoadingOverlay,
  Center,
  Box,
  Grid,
  Card,
  ThemeIcon,
  Divider,
  ActionIcon,
  Tooltip,
  Collapse,
  Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconChartBar,
  IconCalendar,
  IconPrinter,
  IconFileSpreadsheet,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconScale,
  IconTrendingUp,
  IconTrendingDown,
  IconWallet,
  IconBuildingBank,
  IconReceipt,
  IconCash
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';

const VyaparTrialBalance = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);
  const [viewMode, setViewMode] = useState('detailed'); // 'detailed' or 'grouped'
  const [expandedGroups, setExpandedGroups] = useState({
    Assets: true,
    Liabilities: true,
    Income: true,
    Expenses: true,
    Capital: true,
    Other: true
  });

  // Quick filter options
  const quickFilters = [
    { value: 'today', label: 'Today' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'financialYear', label: 'Financial Year' }
  ];

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount
  useEffect(() => {
    fetchReport({ filterType: 'thisMonth' });
  }, []);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.vyaparTrialBalance(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch trial balance');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (filterType) => {
    fetchReport({ filterType });
  };

  const handleDateRangeApply = () => {
    if (dateRange[0] && dateRange[1]) {
      fetchReport({
        filterType: 'custom',
        customStart: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        customEnd: dayjs(dateRange[1]).format('YYYY-MM-DD')
      });
    } else {
      message.warning('Please select both start and end dates');
    }
  };

  const handleRefresh = () => {
    if (dateRange[0] && dateRange[1]) {
      handleDateRangeApply();
    } else {
      fetchReport({ filterType: 'thisMonth' });
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Assets': <IconWallet size={16} />,
      'Liabilities': <IconBuildingBank size={16} />,
      'Income': <IconTrendingUp size={16} />,
      'Expenses': <IconTrendingDown size={16} />,
      'Capital': <IconCash size={16} />,
      'Other': <IconReceipt size={16} />
    };
    return icons[category] || <IconReceipt size={16} />;
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Assets': 'blue',
      'Liabilities': 'orange',
      'Income': 'green',
      'Expenses': 'red',
      'Capital': 'violet',
      'Other': 'gray'
    };
    return colors[category] || 'gray';
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!reportData?.ledgers?.length) {
      message.warning('No data to export');
      return;
    }

    const exportData = reportData.ledgers.map((ledger, idx) => ({
      '#': idx + 1,
      'Ledger Name': ledger.ledgerName,
      'Category': ledger.category,
      'Ledger Type': ledger.ledgerType,
      'Opening Dr': ledger.openingDr.toFixed(2),
      'Opening Cr': ledger.openingCr.toFixed(2),
      'Debit': ledger.debitAmount.toFixed(2),
      'Credit': ledger.creditAmount.toFixed(2),
      'Closing Dr': ledger.closingDr.toFixed(2),
      'Closing Cr': ledger.closingCr.toFixed(2)
    }));

    // Add totals row
    exportData.push({
      '#': '',
      'Ledger Name': 'TOTAL',
      'Category': '',
      'Ledger Type': '',
      'Opening Dr': reportData.summary.openingDebit.toFixed(2),
      'Opening Cr': reportData.summary.openingCredit.toFixed(2),
      'Debit': reportData.summary.totalDebit.toFixed(2),
      'Credit': reportData.summary.totalCredit.toFixed(2),
      'Closing Dr': reportData.summary.closingDebit.toFixed(2),
      'Closing Cr': reportData.summary.closingCredit.toFixed(2)
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
    XLSX.writeFile(wb, `Trial_Balance_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  // Print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const startDate = reportData?.filters?.startDate ? formatDate(reportData.filters.startDate) : '';
    const endDate = reportData?.filters?.endDate ? formatDate(reportData.filters.endDate) : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trial Balance</title>
        <style>
          @media print { @page { size: A4 landscape; margin: 10mm; } }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; padding: 15px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { margin: 0; color: #1976d2; font-size: 18px; }
          .header p { margin: 5px 0 0; color: #666; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9px; }
          th, td { padding: 6px 8px; border: 1px solid #ddd; }
          th { background: #f5f7fa; font-weight: 600; text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .category-row { background: #e3f2fd; font-weight: 600; }
          .total-row { background: #fff3e0; font-weight: 700; font-size: 10px; }
          .dr { color: #c62828; }
          .cr { color: #2e7d32; }
          .balanced { color: #2e7d32; font-weight: bold; }
          .not-balanced { color: #c62828; font-weight: bold; }
          .summary { margin-top: 15px; text-align: right; }
          .footer { margin-top: 15px; text-align: center; font-size: 9px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TRIAL BALANCE</h1>
          <p>Period: ${startDate} to ${endDate}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 30px;">#</th>
              <th rowspan="2" style="text-align: left;">Ledger Name</th>
              <th rowspan="2">Category</th>
              <th colspan="2">Opening Balance</th>
              <th colspan="2">Transactions</th>
              <th colspan="2">Closing Balance</th>
            </tr>
            <tr>
              <th>Debit</th>
              <th>Credit</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            ${reportData?.ledgers?.map((ledger, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td class="text-left">${ledger.ledgerName}</td>
                <td style="text-align: center;">${ledger.category}</td>
                <td class="text-right dr">${ledger.openingDr > 0 ? formatCurrency(ledger.openingDr) : '-'}</td>
                <td class="text-right cr">${ledger.openingCr > 0 ? formatCurrency(ledger.openingCr) : '-'}</td>
                <td class="text-right dr">${ledger.debitAmount > 0 ? formatCurrency(ledger.debitAmount) : '-'}</td>
                <td class="text-right cr">${ledger.creditAmount > 0 ? formatCurrency(ledger.creditAmount) : '-'}</td>
                <td class="text-right dr">${ledger.closingDr > 0 ? formatCurrency(ledger.closingDr) : '-'}</td>
                <td class="text-right cr">${ledger.closingCr > 0 ? formatCurrency(ledger.closingCr) : '-'}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;"><strong>TOTAL</strong></td>
              <td class="text-right dr"><strong>${formatCurrency(reportData?.summary?.openingDebit)}</strong></td>
              <td class="text-right cr"><strong>${formatCurrency(reportData?.summary?.openingCredit)}</strong></td>
              <td class="text-right dr"><strong>${formatCurrency(reportData?.summary?.totalDebit)}</strong></td>
              <td class="text-right cr"><strong>${formatCurrency(reportData?.summary?.totalCredit)}</strong></td>
              <td class="text-right dr"><strong>${formatCurrency(reportData?.summary?.closingDebit)}</strong></td>
              <td class="text-right cr"><strong>${formatCurrency(reportData?.summary?.closingCredit)}</strong></td>
            </tr>
          </tbody>
        </table>
        <div class="summary">
          <p class="${reportData?.summary?.isBalanced ? 'balanced' : 'not-balanced'}">
            Status: ${reportData?.summary?.isBalanced ? 'BALANCED' : 'NOT BALANCED (Difference: ' + formatCurrency(reportData?.summary?.difference) + ')'}
          </p>
        </div>
        <div class="footer">
          <p>Generated on ${dayjs().format('DD/MM/YYYY HH:mm:ss')}</p>
        </div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Render grouped view
  const renderGroupedView = () => {
    if (!reportData?.groupedLedgers) return null;

    const categories = ['Assets', 'Liabilities', 'Income', 'Expenses', 'Capital', 'Other'];

    return categories.map(category => {
      const ledgers = reportData.groupedLedgers[category] || [];
      if (ledgers.length === 0) return null;

      const categoryTotals = {
        openingDr: ledgers.reduce((sum, l) => sum + l.openingDr, 0),
        openingCr: ledgers.reduce((sum, l) => sum + l.openingCr, 0),
        debitAmount: ledgers.reduce((sum, l) => sum + l.debitAmount, 0),
        creditAmount: ledgers.reduce((sum, l) => sum + l.creditAmount, 0),
        closingDr: ledgers.reduce((sum, l) => sum + l.closingDr, 0),
        closingCr: ledgers.reduce((sum, l) => sum + l.closingCr, 0)
      };

      return (
        <Box key={category} mb="md">
          {/* Category Header */}
          <Paper
            p="xs"
            mb={0}
            style={{
              backgroundColor: `var(--mantine-color-${getCategoryColor(category)}-0)`,
              borderLeft: `4px solid var(--mantine-color-${getCategoryColor(category)}-6)`,
              cursor: 'pointer'
            }}
            onClick={() => toggleGroup(category)}
          >
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon size="sm" variant="light" color={getCategoryColor(category)}>
                  {getCategoryIcon(category)}
                </ThemeIcon>
                <Text fw={600} c={`${getCategoryColor(category)}.7`}>
                  {category} ({ledgers.length})
                </Text>
                {expandedGroups[category] ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </Group>
              <Group gap="lg">
                <Text size="sm" fw={500}>
                  Closing Dr: <Text component="span" c="red.7" fw={600}>{formatCurrency(categoryTotals.closingDr)}</Text>
                </Text>
                <Text size="sm" fw={500}>
                  Closing Cr: <Text component="span" c="green.7" fw={600}>{formatCurrency(categoryTotals.closingCr)}</Text>
                </Text>
              </Group>
            </Group>
          </Paper>

          {/* Category Ledgers */}
          <Collapse in={expandedGroups[category]}>
            <Table striped highlightOnHover withTableBorder withColumnBorders style={{ borderTop: 0 }}>
              <Table.Tbody>
                {ledgers.map((ledger, idx) => (
                  <Table.Tr key={ledger.ledgerId || idx}>
                    <Table.Td style={{ width: 40, textAlign: 'center' }}>{idx + 1}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{ledger.ledgerName}</Text>
                      <Text size="xs" c="dimmed">{ledger.ledgerType}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', width: 100 }}>
                      {ledger.openingDr > 0 ? (
                        <Text size="sm" c="red.7">{formatCurrency(ledger.openingDr)}</Text>
                      ) : '-'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', width: 100 }}>
                      {ledger.openingCr > 0 ? (
                        <Text size="sm" c="green.7">{formatCurrency(ledger.openingCr)}</Text>
                      ) : '-'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', width: 100 }}>
                      {ledger.debitAmount > 0 ? (
                        <Text size="sm" c="red.7">{formatCurrency(ledger.debitAmount)}</Text>
                      ) : '-'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', width: 100 }}>
                      {ledger.creditAmount > 0 ? (
                        <Text size="sm" c="green.7">{formatCurrency(ledger.creditAmount)}</Text>
                      ) : '-'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', width: 100 }}>
                      {ledger.closingDr > 0 ? (
                        <Text size="sm" fw={600} c="red.7">{formatCurrency(ledger.closingDr)}</Text>
                      ) : '-'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', width: 100 }}>
                      {ledger.closingCr > 0 ? (
                        <Text size="sm" fw={600} c="green.7">{formatCurrency(ledger.closingCr)}</Text>
                      ) : '-'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {/* Category Total Row */}
                <Table.Tr style={{ backgroundColor: `var(--mantine-color-${getCategoryColor(category)}-0)` }}>
                  <Table.Td colSpan={2} style={{ textAlign: 'right' }}>
                    <Text fw={600}>{category} Total:</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c="red.7">{formatCurrency(categoryTotals.openingDr)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c="green.7">{formatCurrency(categoryTotals.openingCr)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c="red.7">{formatCurrency(categoryTotals.debitAmount)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c="green.7">{formatCurrency(categoryTotals.creditAmount)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c="red.7">{formatCurrency(categoryTotals.closingDr)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700} c="green.7">{formatCurrency(categoryTotals.closingCr)}</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Collapse>
        </Box>
      );
    });
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Page Header */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <ThemeIcon size="xl" variant="light" color="blue" radius="md">
                <IconScale size={28} />
              </ThemeIcon>
              <Box>
                <Title order={2} fw={600}>Trial Balance</Title>
                <Text size="sm" c="dimmed">
                  Opening Balance, Transactions & Closing Balance for all Ledgers
                </Text>
              </Box>
            </Group>
            <Group gap="xs">
              <Tooltip label="Refresh">
                <ActionIcon variant="light" size="lg" onClick={handleRefresh}>
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
        </Paper>

        {/* Filters */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Stack gap="md">
            {/* Quick Filters */}
            <Group gap="xs">
              <Text size="sm" fw={500} c="dimmed">Quick:</Text>
              {quickFilters.map(filter => (
                <Button
                  key={filter.value}
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => handleQuickFilter(filter.value)}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  {filter.label}
                </Button>
              ))}
            </Group>

            {/* Date Range */}
            <Group gap="md">
              <DatePickerInput
                type="range"
                placeholder="Select date range"
                value={dateRange}
                onChange={setDateRange}
                leftSection={<IconCalendar size={16} />}
                valueFormat="DD/MM/YYYY"
                style={{ flex: 1, maxWidth: 300 }}
              />
              <Button
                leftSection={<IconChartBar size={16} />}
                onClick={handleDateRangeApply}
                style={{ backgroundColor: '#1976d2' }}
              >
                Apply Filter
              </Button>
              <Select
                value={viewMode}
                onChange={setViewMode}
                data={[
                  { value: 'detailed', label: 'Detailed View' },
                  { value: 'grouped', label: 'Grouped by Category' }
                ]}
                style={{ width: 180 }}
              />
            </Group>
          </Stack>
        </Paper>

        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && (
          <>
            {/* Summary Cards - Only show if there's data */}
            {reportData.ledgers?.length > 0 && (
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                <Card p="md" withBorder bg="blue.0">
                  <Text size="xs" c="blue.7" fw={500}>Total Ledgers</Text>
                  <Text size="xl" fw={700} c="blue.7">{reportData.summary.totalLedgers}</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                <Card p="md" withBorder bg="orange.0">
                  <Text size="xs" c="orange.7" fw={500}>Opening Dr</Text>
                  <Text size="lg" fw={700} c="red.7">{formatCurrency(reportData.summary.openingDebit)}</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                <Card p="md" withBorder bg="teal.0">
                  <Text size="xs" c="teal.7" fw={500}>Opening Cr</Text>
                  <Text size="lg" fw={700} c="green.7">{formatCurrency(reportData.summary.openingCredit)}</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                <Card p="md" withBorder bg="red.0">
                  <Text size="xs" c="red.7" fw={500}>Closing Dr</Text>
                  <Text size="lg" fw={700} c="red.7">{formatCurrency(reportData.summary.closingDebit)}</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                <Card p="md" withBorder bg="green.0">
                  <Text size="xs" c="green.7" fw={500}>Closing Cr</Text>
                  <Text size="lg" fw={700} c="green.7">{formatCurrency(reportData.summary.closingCredit)}</Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                <Card p="md" withBorder bg={reportData.summary.isBalanced ? 'green.0' : 'red.0'}>
                  <Text size="xs" c={reportData.summary.isBalanced ? 'green.7' : 'red.7'} fw={500}>Status</Text>
                  <Text size="lg" fw={700} c={reportData.summary.isBalanced ? 'green.7' : 'red.7'}>
                    {reportData.summary.isBalanced ? 'Balanced' : 'Not Balanced'}
                  </Text>
                  {!reportData.summary.isBalanced && (
                    <Text size="xs" c="red.6">Diff: {formatCurrency(reportData.summary.difference)}</Text>
                  )}
                </Card>
              </Grid.Col>
            </Grid>
            )}

            {/* Report Period Info - Only show if there's data */}
            {reportData.ledgers?.length > 0 && (
            <Paper p="sm" withBorder bg="gray.0">
              <Group justify="center" gap="lg">
                <Text size="sm" fw={500}>
                  Period: {reportData.filters?.startDate && formatDate(reportData.filters.startDate)} to {reportData.filters?.endDate && formatDate(reportData.filters.endDate)}
                </Text>
                <Divider orientation="vertical" />
                <Text size="sm">
                  Total Debit: <Text component="span" fw={600} c="red.7">{formatCurrency(reportData.summary.totalDebit)}</Text>
                </Text>
                <Text size="sm">
                  Total Credit: <Text component="span" fw={600} c="green.7">{formatCurrency(reportData.summary.totalCredit)}</Text>
                </Text>
              </Group>
            </Paper>
            )}

            {/* Trial Balance Table */}
            <Paper withBorder style={{ overflow: 'hidden' }} ref={printRef}>
              {/* Table Header */}
              <Box p="sm" style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                <Table withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th rowSpan={2} style={{ width: 40, textAlign: 'center', verticalAlign: 'middle' }}>#</Table.Th>
                      <Table.Th rowSpan={2} style={{ verticalAlign: 'middle' }}>Ledger Name</Table.Th>
                      <Table.Th colSpan={2} style={{ textAlign: 'center', backgroundColor: '#fff3e0' }}>Opening Balance</Table.Th>
                      <Table.Th colSpan={2} style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>Transactions</Table.Th>
                      <Table.Th colSpan={2} style={{ textAlign: 'center', backgroundColor: '#e8f5e9' }}>Closing Balance</Table.Th>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Th style={{ textAlign: 'center', backgroundColor: '#fff3e0', width: 100 }}>Debit</Table.Th>
                      <Table.Th style={{ textAlign: 'center', backgroundColor: '#fff3e0', width: 100 }}>Credit</Table.Th>
                      <Table.Th style={{ textAlign: 'center', backgroundColor: '#e3f2fd', width: 100 }}>Debit</Table.Th>
                      <Table.Th style={{ textAlign: 'center', backgroundColor: '#e3f2fd', width: 100 }}>Credit</Table.Th>
                      <Table.Th style={{ textAlign: 'center', backgroundColor: '#e8f5e9', width: 100 }}>Debit</Table.Th>
                      <Table.Th style={{ textAlign: 'center', backgroundColor: '#e8f5e9', width: 100 }}>Credit</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                </Table>
              </Box>

              {/* Table Body */}
              <Box style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {viewMode === 'grouped' ? (
                  renderGroupedView()
                ) : (
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Tbody>
                      {(!reportData.ledgers || reportData.ledgers.length === 0) ? (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Center py="xl">
                              <Stack align="center" gap="sm">
                                <ThemeIcon size={60} variant="light" color="gray">
                                  <IconScale size={30} />
                                </ThemeIcon>
                                <Text c="dimmed" size="lg" fw={500}>No transactions found for the selected period</Text>
                                <Text c="dimmed" size="sm">
                                  {reportData.filters?.startDate && reportData.filters?.endDate
                                    ? `${formatDate(reportData.filters.startDate)} to ${formatDate(reportData.filters.endDate)}`
                                    : 'Try selecting a different date range'}
                                </Text>
                                <Text c="dimmed" size="xs">
                                  No voucher entries exist in this date range
                                </Text>
                              </Stack>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        reportData.ledgers.map((ledger, idx) => (
                          <Table.Tr key={ledger.ledgerId || idx}>
                            <Table.Td style={{ width: 40, textAlign: 'center' }}>
                              <Text size="sm" c="dimmed">{idx + 1}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Text size="sm" fw={500}>{ledger.ledgerName}</Text>
                                <Badge size="xs" variant="light" color={getCategoryColor(ledger.category)}>
                                  {ledger.category}
                                </Badge>
                              </Group>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', backgroundColor: '#fffde7' }}>
                              {ledger.openingDr > 0 ? (
                                <Text size="sm" c="red.7">{formatCurrency(ledger.openingDr)}</Text>
                              ) : <Text size="sm" c="dimmed">-</Text>}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', backgroundColor: '#fffde7' }}>
                              {ledger.openingCr > 0 ? (
                                <Text size="sm" c="green.7">{formatCurrency(ledger.openingCr)}</Text>
                              ) : <Text size="sm" c="dimmed">-</Text>}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', backgroundColor: '#e3f2fd' }}>
                              {ledger.debitAmount > 0 ? (
                                <Text size="sm" c="red.7">{formatCurrency(ledger.debitAmount)}</Text>
                              ) : <Text size="sm" c="dimmed">-</Text>}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', backgroundColor: '#e3f2fd' }}>
                              {ledger.creditAmount > 0 ? (
                                <Text size="sm" c="green.7">{formatCurrency(ledger.creditAmount)}</Text>
                              ) : <Text size="sm" c="dimmed">-</Text>}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', backgroundColor: '#e8f5e9' }}>
                              {ledger.closingDr > 0 ? (
                                <Text size="sm" fw={600} c="red.7">{formatCurrency(ledger.closingDr)}</Text>
                              ) : <Text size="sm" c="dimmed">-</Text>}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', backgroundColor: '#e8f5e9' }}>
                              {ledger.closingCr > 0 ? (
                                <Text size="sm" fw={600} c="green.7">{formatCurrency(ledger.closingCr)}</Text>
                              ) : <Text size="sm" c="dimmed">-</Text>}
                            </Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                )}
              </Box>

              {/* Table Footer - Totals */}
              {reportData.ledgers?.length > 0 && (
                <Box p="sm" style={{ backgroundColor: '#fff3e0', borderTop: '2px solid #1976d2' }}>
                  <Table withColumnBorders>
                    <Table.Tfoot>
                      <Table.Tr style={{ backgroundColor: '#fff3e0' }}>
                        <Table.Td colSpan={2} style={{ textAlign: 'right' }}>
                          <Text fw={700} size="sm">GRAND TOTAL</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', width: 100 }}>
                          <Text fw={700} c="red.7">{formatCurrency(reportData.summary.openingDebit)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', width: 100 }}>
                          <Text fw={700} c="green.7">{formatCurrency(reportData.summary.openingCredit)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', width: 100 }}>
                          <Text fw={700} c="red.7">{formatCurrency(reportData.summary.totalDebit)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', width: 100 }}>
                          <Text fw={700} c="green.7">{formatCurrency(reportData.summary.totalCredit)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', width: 100 }}>
                          <Text fw={700} c="red.7">{formatCurrency(reportData.summary.closingDebit)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', width: 100 }}>
                          <Text fw={700} c="green.7">{formatCurrency(reportData.summary.closingCredit)}</Text>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </Box>
              )}
            </Paper>

            {/* Balance Status - Only show if there's data */}
            {reportData.ledgers?.length > 0 ? (
            <Paper p="md" withBorder bg={reportData.summary.isBalanced ? 'green.0' : 'red.0'}>
              <Group justify="center" gap="lg">
                <ThemeIcon
                  size="lg"
                  variant="filled"
                  color={reportData.summary.isBalanced ? 'green' : 'red'}
                  radius="xl"
                >
                  <IconScale size={20} />
                </ThemeIcon>
                <Text size="lg" fw={700} c={reportData.summary.isBalanced ? 'green.7' : 'red.7'}>
                  {reportData.summary.isBalanced
                    ? 'Trial Balance is BALANCED - Total Debit equals Total Credit'
                    : `Trial Balance is NOT BALANCED - Difference: ${formatCurrency(reportData.summary.difference)}`
                  }
                </Text>
              </Group>
            </Paper>
            ) : (
              /* No Data Message for selected period */
              <Paper p="xl" withBorder>
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <ThemeIcon size={80} variant="light" color="gray">
                      <IconScale size={40} />
                    </ThemeIcon>
                    <Text c="dimmed" size="lg" fw={500}>No transactions found for the selected period</Text>
                    <Text c="dimmed" size="sm">
                      {reportData.filters?.startDate && reportData.filters?.endDate
                        ? `${formatDate(reportData.filters.startDate)} to ${formatDate(reportData.filters.endDate)}`
                        : ''}
                    </Text>
                    <Text c="dimmed" size="xs">
                      No voucher entries exist in this date range. Try selecting a different period.
                    </Text>
                  </Stack>
                </Center>
              </Paper>
            )}
          </>
        )}

        {/* Empty State - No report data at all */}
        {!reportData && !loading && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size={80} variant="light" color="gray">
                <IconScale size={40} />
              </ThemeIcon>
              <Text c="dimmed" size="lg" fw={500}>Select a date range to generate Trial Balance</Text>
              <Button
                variant="light"
                onClick={() => fetchReport({ filterType: 'thisMonth' })}
                style={{ backgroundColor: '#1976d2', color: 'white' }}
              >
                Load This Month's Report
              </Button>
            </Stack>
          </Center>
        )}
      </Stack>
    </Container>
  );
};

export default VyaparTrialBalance;
