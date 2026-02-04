import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import {
  Container,
  Title,
  Text,
  Card,
  Grid,
  Table,
  Group,
  Badge,
  Button,
  LoadingOverlay,
  Center,
  Stack,
  Paper,
  Box,
  Divider,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  ScrollArea,
  Progress,
  ThemeIcon,
  Collapse,
  Select,
  TextInput,
  NumberFormatter
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileExport,
  IconCalendar,
  IconPrinter,
  IconChevronDown,
  IconChevronUp,
  IconArrowLeft,
  IconTrendingUp,
  IconTrendingDown,
  IconUsers,
  IconBuildingStore,
  IconCash,
  IconReceipt,
  IconArrowUpRight,
  IconArrowDownRight,
  IconSearch,
  IconFilter,
  IconRefresh,
  IconChartBar,
  IconWallet,
  IconCreditCard
} from '@tabler/icons-react';

const VyaparPartyWiseProfit = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);
  const [partyType, setPartyType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('netProfit');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedParty, setExpandedParty] = useState(null);

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
      const params = {
        ...filterData
      };
      if (filterData.fromDate && filterData.toDate) {
        params.customStart = dayjs(filterData.fromDate).format('YYYY-MM-DD');
        params.customEnd = dayjs(filterData.toDate).format('YYYY-MM-DD');
        params.filterType = 'custom';
      }
      if (partyType !== 'all') {
        params.partyType = partyType;
      }
      const response = await reportAPI.vyaparPartyWiseProfit(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch party-wise profit report');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFilter = (filterType) => {
    let newDateRange;
    switch (filterType) {
      case 'today':
        newDateRange = [dayjs().toDate(), dayjs().toDate()];
        break;
      case 'thisWeek':
        newDateRange = [dayjs().startOf('week').toDate(), dayjs().endOf('week').toDate()];
        break;
      case 'thisMonth':
        newDateRange = [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()];
        break;
      case 'thisQuarter':
        newDateRange = [dayjs().startOf('quarter').toDate(), dayjs().endOf('quarter').toDate()];
        break;
      case 'thisYear':
        newDateRange = [dayjs().startOf('year').toDate(), dayjs().endOf('year').toDate()];
        break;
      default:
        newDateRange = dateRange;
    }
    setDateRange(newDateRange);
    fetchReport({ filterType });
  };

  const handleApplyFilter = () => {
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

  const formatCurrency = (amount) => {
    const value = parseFloat(amount || 0);
    return `₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (value) => `${parseFloat(value || 0).toFixed(2)}%`;

  // Get status badge
  const getStatusBadge = (status) => {
    const colors = {
      'Profit': 'green',
      'Loss': 'red',
      'Break-even': 'gray'
    };
    const icons = {
      'Profit': <IconTrendingUp size={14} />,
      'Loss': <IconTrendingDown size={14} />,
      'Break-even': <IconChartBar size={14} />
    };
    return (
      <Badge
        color={colors[status]}
        variant="light"
        leftSection={icons[status]}
        size="sm"
      >
        {status}
      </Badge>
    );
  };

  // Get party type badge
  const getPartyTypeBadge = (type) => {
    return (
      <Badge
        color={type === 'Customer' ? 'blue' : 'orange'}
        variant="outline"
        size="sm"
      >
        {type}
      </Badge>
    );
  };

  // Filter and sort parties
  const getFilteredParties = () => {
    if (!reportData?.parties) return [];

    let filtered = [...reportData.parties];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.partyName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  };

  // Toggle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort indicator
  const SortIndicator = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />;
  };

  // Print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintContent();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const generatePrintContent = () => {
    if (!reportData) return '';

    const parties = getFilteredParties();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Party-Wise Profit & Loss Report</title>
        <style>
          @media print { @page { size: A4 landscape; margin: 10mm; } }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { margin: 0; color: #1976d2; font-size: 16px; }
          .summary { display: flex; justify-content: space-around; margin-bottom: 15px; padding: 10px; background: #f5f7fa; border-radius: 4px; }
          .summary-item { text-align: center; }
          .summary-item .label { font-size: 9px; color: #666; }
          .summary-item .value { font-size: 12px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th, td { padding: 6px 8px; border: 1px solid #e0e0e0; }
          th { background: #f5f7fa; font-weight: 600; text-align: left; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .profit { color: #2e7d32; }
          .loss { color: #c62828; }
          .total-row { background: #e3f2fd; font-weight: 600; }
          .footer { margin-top: 15px; text-align: center; font-size: 9px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PARTY-WISE PROFIT & LOSS REPORT</h1>
          <p>${dayjs(dateRange[0]).format('DD/MM/YYYY')} to ${dayjs(dateRange[1]).format('DD/MM/YYYY')}</p>
        </div>
        <div class="summary">
          <div class="summary-item"><div class="label">Total Parties</div><div class="value">${reportData.summary.totalParties}</div></div>
          <div class="summary-item"><div class="label">Net Sales</div><div class="value">${formatCurrency(reportData.summary.netSales)}</div></div>
          <div class="summary-item"><div class="label">Net Purchases</div><div class="value">${formatCurrency(reportData.summary.netPurchases)}</div></div>
          <div class="summary-item"><div class="label">Gross Profit</div><div class="value">${formatCurrency(reportData.summary.totalGrossProfit)}</div></div>
          <div class="summary-item"><div class="label">Net Profit</div><div class="value ${reportData.summary.totalNetProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(reportData.summary.totalNetProfit)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Party Name</th>
              <th>Type</th>
              <th class="text-right">Total Sales</th>
              <th class="text-right">Sales Returns</th>
              <th class="text-right">Net Sales</th>
              <th class="text-right">Total Purchases</th>
              <th class="text-right">Purchase Returns</th>
              <th class="text-right">COGS</th>
              <th class="text-right">Gross Profit</th>
              <th class="text-right">Expenses</th>
              <th class="text-right">Net Profit</th>
              <th class="text-right">Receivable</th>
              <th class="text-right">Payable</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${parties.map((party, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${party.partyName}</td>
                <td>${party.partyType}</td>
                <td class="text-right">${formatCurrency(party.totalSales)}</td>
                <td class="text-right loss">${formatCurrency(party.salesReturns)}</td>
                <td class="text-right">${formatCurrency(party.netSales)}</td>
                <td class="text-right">${formatCurrency(party.totalPurchases)}</td>
                <td class="text-right profit">${formatCurrency(party.purchaseReturns)}</td>
                <td class="text-right">${formatCurrency(party.costOfGoodsSold)}</td>
                <td class="text-right ${party.grossProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(party.grossProfit)}</td>
                <td class="text-right loss">${formatCurrency(party.relatedExpenses)}</td>
                <td class="text-right ${party.netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(party.netProfit)}</td>
                <td class="text-right">${formatCurrency(party.receivable)}</td>
                <td class="text-right">${formatCurrency(party.payable)}</td>
                <td class="text-center">${party.status}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>TOTALS</strong></td>
              <td class="text-right">${formatCurrency(reportData.summary.totalSales)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalSalesReturns)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.netSales)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalPurchases)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalPurchaseReturns)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalCogs)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalGrossProfit)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalExpenses)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalNetProfit)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalReceivable)}</td>
              <td class="text-right">${formatCurrency(reportData.summary.totalPayable)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          <p>Generated on ${dayjs().format('DD/MM/YYYY HH:mm:ss')}</p>
        </div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); }</script>
      </body>
      </html>
    `;
  };

  // Export to CSV
  const handleExport = () => {
    if (!reportData) return;

    const parties = getFilteredParties();
    const headers = [
      'Party Name', 'Type', 'Total Sales', 'Sales GST', 'Sales Returns', 'Net Sales',
      'Total Purchases', 'Purchase GST', 'Purchase Returns', 'Net Purchases',
      'COGS', 'Gross Profit', 'Expenses', 'Net Profit', 'Margin %',
      'Receivable', 'Payable', 'Status', 'Sales Count', 'Purchase Count'
    ];

    const rows = parties.map(p => [
      `"${p.partyName}"`,
      p.partyType,
      p.totalSales.toFixed(2),
      p.salesGst.toFixed(2),
      p.salesReturns.toFixed(2),
      p.netSales.toFixed(2),
      p.totalPurchases.toFixed(2),
      p.purchaseGst.toFixed(2),
      p.purchaseReturns.toFixed(2),
      p.netPurchases.toFixed(2),
      p.costOfGoodsSold.toFixed(2),
      p.grossProfit.toFixed(2),
      p.relatedExpenses.toFixed(2),
      p.netProfit.toFixed(2),
      p.profitMargin.toFixed(2),
      p.receivable.toFixed(2),
      p.payable.toFixed(2),
      p.status,
      p.salesCount,
      p.purchaseCount
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PartyWiseProfit_${dayjs().format('DDMMYYYY_HHmmss')}.csv`;
    link.click();
  };

  const filteredParties = getFilteredParties();

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Page Header */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => navigate('/reports/vyapar')}
                size="lg"
              >
                <IconArrowLeft size={20} />
              </ActionIcon>
              <div>
                <Title order={2} style={{ color: '#1976d2', fontWeight: 700 }}>
                  PARTY-WISE PROFIT & LOSS
                </Title>
                <Text c="dimmed" size="sm" mt={4}>
                  Comprehensive profitability analysis by customer/supplier
                </Text>
              </div>
            </Group>
            <Group gap="xs">
              <Tooltip label="Refresh">
                <ActionIcon
                  color="gray"
                  variant="light"
                  size="lg"
                  onClick={() => fetchReport({ filterType: 'thisMonth' })}
                >
                  <IconRefresh size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Export to CSV">
                <ActionIcon
                  color="green"
                  variant="light"
                  size="lg"
                  onClick={handleExport}
                  disabled={!reportData}
                >
                  <IconFileExport size={20} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Print Report">
                <ActionIcon
                  color="blue"
                  variant="light"
                  size="lg"
                  onClick={handlePrint}
                  disabled={!reportData}
                >
                  <IconPrinter size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {/* Filters */}
        <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="md">
                <DatePickerInput
                  type="range"
                  label="Date Range"
                  placeholder="Select date range"
                  value={dateRange}
                  onChange={setDateRange}
                  leftSection={<IconCalendar size={16} />}
                  size="sm"
                  style={{ width: 280 }}
                  valueFormat="DD/MM/YYYY"
                />
                <Select
                  label="Party Type"
                  placeholder="All Parties"
                  value={partyType}
                  onChange={setPartyType}
                  data={[
                    { value: 'all', label: 'All Parties' },
                    { value: 'Customer', label: 'Customers Only' },
                    { value: 'Supplier', label: 'Suppliers Only' }
                  ]}
                  size="sm"
                  style={{ width: 160 }}
                  leftSection={<IconFilter size={16} />}
                />
                <Button
                  onClick={handleApplyFilter}
                  size="sm"
                  style={{ backgroundColor: '#1976d2', marginTop: 24 }}
                >
                  Apply Filter
                </Button>
              </Group>
              <TextInput
                placeholder="Search party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftSection={<IconSearch size={16} />}
                size="sm"
                style={{ width: 200, marginTop: 24 }}
              />
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">Quick Filters:</Text>
              {['today', 'thisWeek', 'thisMonth', 'thisQuarter', 'thisYear'].map((filter) => (
                <Button
                  key={filter}
                  variant="subtle"
                  size="xs"
                  onClick={() => handleQuickFilter(filter)}
                  style={{ border: '1px solid #e0e0e0' }}
                >
                  {filter === 'today' ? 'Today' :
                    filter === 'thisWeek' ? 'This Week' :
                      filter === 'thisMonth' ? 'This Month' :
                        filter === 'thisQuarter' ? 'This Quarter' : 'This Year'}
                </Button>
              ))}
            </Group>
          </Stack>
        </Paper>

        <Box pos="relative">
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

          {reportData && !loading && (
            <Stack gap="md">
              {/* Summary Cards - Row 1 */}
              <Grid>
                <Grid.Col span={2.4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: '4px solid #1976d2' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Total Parties</Text>
                        <Title order={3} mt={4}>{reportData.summary.totalParties}</Title>
                        <Text size="xs" c="dimmed" mt={4}>
                          {reportData.summary.totalCustomers} Customers, {reportData.summary.totalSuppliers} Suppliers
                        </Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color="blue">
                        <IconUsers size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: '4px solid #2e7d32' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Net Sales</Text>
                        <Title order={3} mt={4} style={{ color: '#2e7d32' }}>{formatCurrency(reportData.summary.netSales)}</Title>
                        <Text size="xs" c="dimmed" mt={4}>
                          Returns: {formatCurrency(reportData.summary.totalSalesReturns)}
                        </Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color="green">
                        <IconReceipt size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: '4px solid #ed6c02' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Net Purchases</Text>
                        <Title order={3} mt={4} style={{ color: '#ed6c02' }}>{formatCurrency(reportData.summary.netPurchases)}</Title>
                        <Text size="xs" c="dimmed" mt={4}>
                          Returns: {formatCurrency(reportData.summary.totalPurchaseReturns)}
                        </Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color="orange">
                        <IconBuildingStore size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: '4px solid #9c27b0' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Gross Profit</Text>
                        <Title order={3} mt={4} style={{ color: '#9c27b0' }}>{formatCurrency(reportData.summary.totalGrossProfit)}</Title>
                        <Text size="xs" c="dimmed" mt={4}>
                          COGS: {formatCurrency(reportData.summary.totalCogs)}
                        </Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color="grape">
                        <IconChartBar size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={2.4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: `4px solid ${reportData.summary.totalNetProfit >= 0 ? '#1976d2' : '#c62828'}` }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                          Net {reportData.summary.totalNetProfit >= 0 ? 'Profit' : 'Loss'}
                        </Text>
                        <Title order={3} mt={4} style={{ color: reportData.summary.totalNetProfit >= 0 ? '#1976d2' : '#c62828' }}>
                          {formatCurrency(reportData.summary.totalNetProfit)}
                        </Title>
                        <Text size="xs" c="dimmed" mt={4}>
                          Expenses: {formatCurrency(reportData.summary.totalExpenses)}
                        </Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color={reportData.summary.totalNetProfit >= 0 ? 'blue' : 'red'}>
                        {reportData.summary.totalNetProfit >= 0 ? <IconTrendingUp size={20} /> : <IconTrendingDown size={20} />}
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
              </Grid>

              {/* Summary Cards - Row 2: Balances */}
              <Grid>
                <Grid.Col span={4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: '4px solid #00897b' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Total Receivable</Text>
                        <Title order={3} mt={4} style={{ color: '#00897b' }}>{formatCurrency(reportData.summary.totalReceivable)}</Title>
                        <Text size="xs" c="dimmed" mt={4}>Amount to be received from parties</Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color="teal">
                        <IconArrowDownRight size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: '4px solid #d32f2f' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Total Payable</Text>
                        <Title order={3} mt={4} style={{ color: '#d32f2f' }}>{formatCurrency(reportData.summary.totalPayable)}</Title>
                        <Text size="xs" c="dimmed" mt={4}>Amount to be paid to parties</Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color="red">
                        <IconArrowUpRight size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Card withBorder padding="md" radius="md" style={{ borderLeft: `4px solid ${reportData.summary.netBalance >= 0 ? '#388e3c' : '#d32f2f'}` }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Net Balance</Text>
                        <Title order={3} mt={4} style={{ color: reportData.summary.netBalance >= 0 ? '#388e3c' : '#d32f2f' }}>
                          {formatCurrency(reportData.summary.netBalance)}
                        </Title>
                        <Text size="xs" c="dimmed" mt={4}>
                          {reportData.summary.netBalance >= 0 ? 'Net Receivable' : 'Net Payable'}
                        </Text>
                      </div>
                      <ThemeIcon size="lg" variant="light" color={reportData.summary.netBalance >= 0 ? 'green' : 'red'}>
                        <IconWallet size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
              </Grid>

              {/* Profit/Loss Distribution */}
              <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
                <Text fw={600} mb="sm">Profit/Loss Distribution</Text>
                <Group grow>
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" c="green">Parties in Profit</Text>
                      <Text size="sm" fw={600} c="green">{reportData.summary.partiesInProfit}</Text>
                    </Group>
                    <Progress value={(reportData.summary.partiesInProfit / reportData.summary.totalParties) * 100} color="green" size="sm" />
                  </div>
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" c="red">Parties in Loss</Text>
                      <Text size="sm" fw={600} c="red">{reportData.summary.partiesInLoss}</Text>
                    </Group>
                    <Progress value={(reportData.summary.partiesInLoss / reportData.summary.totalParties) * 100} color="red" size="sm" />
                  </div>
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" c="gray">Break-even</Text>
                      <Text size="sm" fw={600} c="gray">{reportData.summary.partiesBreakEven}</Text>
                    </Group>
                    <Progress value={(reportData.summary.partiesBreakEven / reportData.summary.totalParties) * 100} color="gray" size="sm" />
                  </div>
                </Group>
              </Paper>

              {/* Main Data Table */}
              <Paper withBorder style={{ borderColor: '#e0e0e0', overflow: 'hidden' }}>
                <Box p="md" style={{ backgroundColor: '#1976d2', color: 'white' }}>
                  <Group justify="space-between">
                    <Text fw={600}>Party-Wise Profit & Loss Details</Text>
                    <Text size="sm">{filteredParties.length} parties</Text>
                  </Group>
                </Box>
                <ScrollArea>
                  <Table striped highlightOnHover withTableBorder style={{ minWidth: 1400 }}>
                    <Table.Thead style={{ backgroundColor: '#f5f7fa' }}>
                      <Table.Tr>
                        <Table.Th style={{ width: 40 }}>#</Table.Th>
                        <Table.Th style={{ cursor: 'pointer' }} onClick={() => handleSort('partyName')}>
                          <Group gap={4}>Party Name <SortIndicator field="partyName" /></Group>
                        </Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('totalSales')}>
                          <Group gap={4} justify="flex-end">Sales <SortIndicator field="totalSales" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Returns</Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('netSales')}>
                          <Group gap={4} justify="flex-end">Net Sales <SortIndicator field="netSales" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('totalPurchases')}>
                          <Group gap={4} justify="flex-end">Purchases <SortIndicator field="totalPurchases" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('costOfGoodsSold')}>
                          <Group gap={4} justify="flex-end">COGS <SortIndicator field="costOfGoodsSold" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('grossProfit')}>
                          <Group gap={4} justify="flex-end">Gross Profit <SortIndicator field="grossProfit" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Expenses</Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('netProfit')}>
                          <Group gap={4} justify="flex-end">Net Profit <SortIndicator field="netProfit" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('profitMargin')}>
                          <Group gap={4} justify="flex-end">Margin % <SortIndicator field="profitMargin" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('receivable')}>
                          <Group gap={4} justify="flex-end">Receivable <SortIndicator field="receivable" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('payable')}>
                          <Group gap={4} justify="flex-end">Payable <SortIndicator field="payable" /></Group>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredParties.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={15} style={{ textAlign: 'center', padding: '40px' }}>
                            <Text c="dimmed">No parties found for the selected filters</Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        <>
                          {filteredParties.map((party, idx) => (
                            <Table.Tr
                              key={party.partyId}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setExpandedParty(expandedParty === party.partyId ? null : party.partyId)}
                            >
                              <Table.Td>{idx + 1}</Table.Td>
                              <Table.Td>
                                <Group gap={4}>
                                  {expandedParty === party.partyId ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                  <Text fw={500}>{party.partyName}</Text>
                                </Group>
                              </Table.Td>
                              <Table.Td>{getPartyTypeBadge(party.partyType)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: '#2e7d32' }}>{formatCurrency(party.totalSales)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: '#c62828' }}>{formatCurrency(party.salesReturns)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(party.netSales)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: '#ed6c02' }}>{formatCurrency(party.totalPurchases)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(party.costOfGoodsSold)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: party.grossProfit >= 0 ? '#2e7d32' : '#c62828', fontWeight: 500 }}>
                                {formatCurrency(party.grossProfit)}
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: '#c62828' }}>{formatCurrency(party.relatedExpenses)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: party.netProfit >= 0 ? '#1976d2' : '#c62828', fontWeight: 600 }}>
                                {formatCurrency(party.netProfit)}
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Badge color={party.profitMargin >= 0 ? 'blue' : 'red'} variant="light" size="sm">
                                  {formatPercent(party.profitMargin)}
                                </Badge>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: '#00897b' }}>{formatCurrency(party.receivable)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right', color: '#d32f2f' }}>{formatCurrency(party.payable)}</Table.Td>
                              <Table.Td style={{ textAlign: 'center' }}>{getStatusBadge(party.status)}</Table.Td>
                            </Table.Tr>
                          ))}
                          {/* Totals Row */}
                          <Table.Tr style={{ backgroundColor: '#e3f2fd', fontWeight: 600 }}>
                            <Table.Td colSpan={3} style={{ textAlign: 'right' }}>TOTALS</Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: '#2e7d32' }}>{formatCurrency(reportData.summary.totalSales)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: '#c62828' }}>{formatCurrency(reportData.summary.totalSalesReturns)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.summary.netSales)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: '#ed6c02' }}>{formatCurrency(reportData.summary.totalPurchases)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.summary.totalCogs)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: reportData.summary.totalGrossProfit >= 0 ? '#2e7d32' : '#c62828' }}>
                              {formatCurrency(reportData.summary.totalGrossProfit)}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: '#c62828' }}>{formatCurrency(reportData.summary.totalExpenses)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: reportData.summary.totalNetProfit >= 0 ? '#1976d2' : '#c62828' }}>
                              {formatCurrency(reportData.summary.totalNetProfit)}
                            </Table.Td>
                            <Table.Td></Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: '#00897b' }}>{formatCurrency(reportData.summary.totalReceivable)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: '#d32f2f' }}>{formatCurrency(reportData.summary.totalPayable)}</Table.Td>
                            <Table.Td></Table.Td>
                          </Table.Tr>
                        </>
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>

              {/* Transaction Summary */}
              <Paper p="md" withBorder style={{ borderColor: '#e0e0e0' }}>
                <Grid>
                  <Grid.Col span={3}>
                    <Text size="sm" c="dimmed">Total Sales Bills</Text>
                    <Text size="lg" fw={600}>{reportData.summary.totalSalesBills}</Text>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Text size="sm" c="dimmed">Total Purchase Bills</Text>
                    <Text size="lg" fw={600}>{reportData.summary.totalPurchaseBills}</Text>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Text size="sm" c="dimmed">Sales GST Collected</Text>
                    <Text size="lg" fw={600} c="green">{formatCurrency(reportData.summary.totalSalesGst)}</Text>
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <Text size="sm" c="dimmed">Purchase GST Paid</Text>
                    <Text size="lg" fw={600} c="orange">{formatCurrency(reportData.summary.totalPurchaseGst)}</Text>
                  </Grid.Col>
                </Grid>
              </Paper>
            </Stack>
          )}

          {!reportData && !loading && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <Text c="dimmed">Select a date range to view Party-wise Profit report</Text>
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
        </Box>
      </Stack>
    </Container>
  );
};

export default VyaparPartyWiseProfit;
