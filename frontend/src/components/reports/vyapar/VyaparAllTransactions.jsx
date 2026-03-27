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
  ActionIcon,
  Tooltip,
  Flex,
  TextInput,
  LoadingOverlay,
  ThemeIcon,
  Menu,
  Divider,
  Button,
  ScrollArea
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileText,
  IconSearch,
  IconFileSpreadsheet,
  IconPrinter,
  IconFilter,
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconFileDescription,
  IconCalendar,
  IconShare,
  IconDownload,
  IconBuilding,
  IconReceipt,
  IconX,
  IconPlayerPlay
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { useCompany } from '../../../context/CompanyContext';

// Extend dayjs with quarter plugin
dayjs.extend(quarterOfYear);
import { reportAPI } from '../../../services/api';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import { printVyaparReport } from '../../../utils/printReport';

const VyaparAllTransactions = () => {
  const { selectedBusinessType, selectedCompany } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  // State
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter state
  const [dateFilter, setDateFilter] = useState('thisMonth');
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);
  const [firmFilter, setFirmFilter] = useState('all');
  const [transactionType, setTransactionType] = useState('All Transaction');

  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Column filters
  const [columnFilters, setColumnFilters] = useState({
    partyName: '',
    categoryName: '',
    type: ''
  });

  // Date filter options (Tally/Vyapar style)
  const dateFilterOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'lastQuarter', label: 'Last Quarter' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'lastYear', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const transactionTypeOptions = [
    { value: 'All Transaction', label: 'All Transaction' },
    { value: 'Receipt', label: 'Receipt' },
    { value: 'Payment', label: 'Payment' },
    { value: 'Journal', label: 'Journal' },
    { value: 'Sale', label: 'Sale' },
    { value: 'Purchase', label: 'Purchase' },
    { value: 'Contra', label: 'Contra' }
  ];

  const firmOptions = [
    { value: 'all', label: 'ALL FIRMS' }
  ];

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType && selectedBusinessType !== 'Private Firm') {
      notifications.show({ color: 'orange', message: 'This report is only available for Private Firm' });
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);


  // Update date range when preset filter changes; then auto-fetch
  useEffect(() => {
    const now = dayjs();
    let start, end;

    switch (dateFilter) {
      case 'today':
        start = now.startOf('day');       end = now.endOf('day');       break;
      case 'yesterday':
        start = now.subtract(1,'day').startOf('day'); end = now.subtract(1,'day').endOf('day'); break;
      case 'thisWeek':
        start = now.startOf('week');      end = now.endOf('week');      break;
      case 'lastWeek':
        start = now.subtract(1,'week').startOf('week'); end = now.subtract(1,'week').endOf('week'); break;
      case 'thisMonth':
        start = now.startOf('month');     end = now.endOf('month');     break;
      case 'lastMonth':
        start = now.subtract(1,'month').startOf('month'); end = now.subtract(1,'month').endOf('month'); break;
      case 'thisQuarter':
        start = now.startOf('quarter');   end = now.endOf('quarter');   break;
      case 'lastQuarter':
        start = now.subtract(1,'quarter').startOf('quarter'); end = now.subtract(1,'quarter').endOf('quarter'); break;
      case 'thisYear':
        start = now.startOf('year');      end = now.endOf('year');      break;
      case 'lastYear':
        start = now.subtract(1,'year').startOf('year'); end = now.subtract(1,'year').endOf('year'); break;
      case 'custom':
        return; // custom range — user clicks Generate manually
      default:
        start = now.startOf('month');     end = now.endOf('month');
    }

    const newRange = [start.toDate(), end.toDate()];
    setDateRange(newRange);

    // Auto-fetch when preset changes
    setLoading(true);
    const params = {
      filterType: dateFilter,
      customStart: start.format('YYYY-MM-DD'),
      customEnd:   end.format('YYYY-MM-DD'),
      voucherType: transactionType,
    };
    reportAPI.vyaparAllTransactions(params)
      .then(res => setReportData(res.data))
      .catch(err => notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to fetch' }))
      .finally(() => setLoading(false));
  }, [dateFilter, transactionType]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        filterType: dateFilter === 'custom' ? 'custom' : dateFilter,
        customStart: dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : undefined,
        customEnd: dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : undefined,
        voucherType: transactionType,
        firm: firmFilter !== 'all' ? firmFilter : undefined
      };
      const response = await reportAPI.vyaparAllTransactions(params);
      setReportData(response.data);
    } catch (error) {
      notifications.show({ color: 'red', title: 'Error', message: error.message || 'Failed to fetch transactions' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchReport();
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const handleExportExcel = () => {
    if (!filteredTransactions?.length) return;

    const exportData = filteredTransactions.map((txn, index) => ({
      '#': index + 1,
      'Date': formatDate(txn.date),
      'Ref No.': txn.refNo || '',
      'Party Name': txn.partyName || '',
      'Category Name': txn.categoryName || '',
      'Type': txn.type || '',
      'Total': txn.total || 0,
      'Received': txn.received || 0,
      'Balance': txn.balance || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Transactions');
    XLSX.writeFile(wb, `All_Transactions_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ color: 'green', message: 'Exported to Excel successfully' });
  };

  const handlePrint = () => {
    printVyaparReport(printRef, {
      title: 'All Transactions Report',
      companyName: selectedCompany?.companyName || '',
      orientation: 'landscape'
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (txn) => {
    if (txn.referenceType === 'BusinessSales' && txn.referenceId) {
      navigate(`/business-sales/view/${txn.referenceId}`);
    } else if (txn.referenceType === 'BusinessPurchase') {
      navigate('/business-inventory/stock');
    }
  };

  // Filter and sort transactions
  const filteredTransactions = (reportData?.transactions || [])
    .filter(txn => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !txn.partyName?.toLowerCase().includes(query) &&
          !txn.refNo?.toLowerCase().includes(query) &&
          !txn.categoryName?.toLowerCase().includes(query) &&
          !txn.type?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Column filters
      if (columnFilters.partyName && !txn.partyName?.toLowerCase().includes(columnFilters.partyName.toLowerCase())) {
        return false;
      }
      if (columnFilters.categoryName && !txn.categoryName?.toLowerCase().includes(columnFilters.categoryName.toLowerCase())) {
        return false;
      }
      if (columnFilters.type && !txn.type?.toLowerCase().includes(columnFilters.type.toLowerCase())) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'date') {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? (aVal || '').localeCompare(bVal || '')
          : (bVal || '').localeCompare(aVal || '');
      }
      return sortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });

  const getSortIcon = (field) => {
    if (sortField !== field) return <IconSelector size={14} color="#aaa" />;
    return sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  const SortableHeader = ({ field, children, align = 'left' }) => (
    <Table.Th style={{ cursor: 'pointer', textAlign: align }} onClick={() => handleSort(field)}>
      <Group gap={4} justify={align === 'right' ? 'flex-end' : 'flex-start'}>
        {children}
        {getSortIcon(field)}
      </Group>
    </Table.Th>
  );

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'Receipt': return 'green';
      case 'Payment': return 'red';
      case 'Journal': return 'orange';
      case 'Sale': return 'blue';
      case 'Purchase': return 'grape';
      case 'Contra': return 'cyan';
      default: return 'gray';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Sales': return 'blue';
      case 'Purchase': return 'grape';
      case 'Expense': return 'red';
      case 'Income': return 'green';
      case 'Customer': return 'teal';
      case 'Supplier': return 'orange';
      case 'Bank': return 'indigo';
      default: return 'gray';
    }
  };

  // Calculate totals from filtered data
  const totals = filteredTransactions.reduce((acc, txn) => ({
    total: acc.total + (txn.total || 0),
    received: acc.received + (txn.received || 0),
    balance: acc.balance + (txn.balance || 0)
  }), { total: 0, received: 0, balance: 0 });

  return (
    <Box pos="relative" p="md" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 2 }} />

      {/* Header Section with Filters */}
      <Paper shadow="xs" p="md" mb="md" withBorder radius="md" style={{ backgroundColor: '#fff' }}>
        {/* Title Row */}
        <Group justify="space-between" align="center" mb="lg">
          <Group gap="sm">
            <ThemeIcon size="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} radius="md">
              <IconFileText size={24} />
            </ThemeIcon>
            <Box>
              <Title order={3} fw={600} c="dark">All Transactions</Title>
              <Text size="sm" c="dimmed">Complete transaction history across all voucher types</Text>
            </Box>
          </Group>
          {reportData && (
            <Group gap="xs">
              <Badge variant="light" color="blue" size="lg" radius="md">
                {filteredTransactions.length} records
              </Badge>
              <Badge variant="light" color="green" size="lg" radius="md">
                Total: ₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Badge>
              <Badge variant="light" color="teal" size="lg" radius="md">
                Received: ₹{totals.received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Badge>
              <Badge variant="light" color="red" size="lg" radius="md">
                Balance: ₹{totals.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Badge>
            </Group>
          )}
          <Group gap="xs">
            <Tooltip label="Refresh">
              <ActionIcon variant="light" size="lg" radius="md" onClick={handleRefresh}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Excel Report">
              <ActionIcon variant="light" color="green" size="lg" radius="md" onClick={handleExportExcel}>
                <IconFileSpreadsheet size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print">
              <ActionIcon variant="light" color="blue" size="lg" radius="md" onClick={handlePrint}>
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Divider mb="md" />

        {/* Filter Row - Tally/Vyapar Style */}
        <Flex gap="md" wrap="wrap" align="flex-end">
          {/* Date Period Dropdown */}
          <Select
            label="Period"
            placeholder="Select period"
            data={dateFilterOptions}
            value={dateFilter}
            onChange={setDateFilter}
            leftSection={<IconCalendar size={16} />}
            style={{ minWidth: 150 }}
            styles={{
              input: {
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 8
              }
            }}
          />

          {/* Date Range - Between */}
          <Box>
            <Text size="xs" fw={500} mb={4} c="dimmed">Between</Text>
            <Group gap="xs">
              <DatePickerInput
                placeholder="From"
                value={dateRange[0]}
                onChange={(date) => {
                  setDateRange([date, dateRange[1]]);
                  setDateFilter('custom');
                }}
                valueFormat="DD/MM/YYYY"
                style={{ width: 130 }}
                styles={{
                  input: {
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: 8
                  }
                }}
              />
              <Text size="sm" c="dimmed">to</Text>
              <DatePickerInput
                placeholder="To"
                value={dateRange[1]}
                onChange={(date) => {
                  setDateRange([dateRange[0], date]);
                  setDateFilter('custom');
                }}
                valueFormat="DD/MM/YYYY"
                style={{ width: 130 }}
                styles={{
                  input: {
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: 8
                  }
                }}
              />
            </Group>
          </Box>

          {/* Firm Filter */}
          <Select
            label="Firm"
            placeholder="Select firm"
            data={firmOptions}
            value={firmFilter}
            onChange={setFirmFilter}
            leftSection={<IconBuilding size={16} />}
            style={{ minWidth: 150 }}
            styles={{
              input: {
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 8
              }
            }}
          />

          {/* Transaction Type Filter */}
          <Select
            label="Transaction Type"
            placeholder="Select type"
            data={transactionTypeOptions}
            value={transactionType}
            onChange={setTransactionType}
            leftSection={<IconReceipt size={16} />}
            style={{ minWidth: 160 }}
            styles={{
              input: {
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 8
              }
            }}
          />

          {/* Generate Button */}
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            onClick={fetchReport}
            loading={loading}
            color="blue"
            style={{ alignSelf: 'flex-end' }}
          >
            Generate
          </Button>
        </Flex>
      </Paper>

      {/* Table Section */}
      <Paper shadow="xs" withBorder radius="md" style={{ backgroundColor: '#fff' }}>
        {/* Search Bar */}
        <Box p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
          <TextInput
            placeholder="Search by party name, ref no, category, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              searchQuery && (
                <ActionIcon variant="subtle" size="sm" onClick={() => setSearchQuery('')}>
                  <IconX size={14} />
                </ActionIcon>
              )
            }
            style={{ maxWidth: 400 }}
            styles={{
              input: {
                backgroundColor: '#f8f9fa',
                border: '1px solid #e0e0e0',
                borderRadius: 8
              }
            }}
          />
        </Box>

        {/* Data Table */}
        <ScrollArea>
          <Box style={{ minWidth: 1000 }} ref={printRef}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead style={{ backgroundColor: '#f8f9fa' }}>
                <Table.Tr>
                  <Table.Th style={{ width: 50, textAlign: 'center' }}>#</Table.Th>
                  <SortableHeader field="date">Date</SortableHeader>
                  <SortableHeader field="refNo">Ref No.</SortableHeader>
                  <SortableHeader field="partyName">
                    <Group gap={4}>
                      Party Name
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" size="xs" color={columnFilters.partyName ? 'blue' : 'gray'} onClick={(e) => e.stopPropagation()}>
                            <IconFilter size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                          <TextInput
                            placeholder="Filter party name..."
                            value={columnFilters.partyName}
                            onChange={(e) => setColumnFilters(f => ({ ...f, partyName: e.target.value }))}
                            size="xs"
                          />
                          <Menu.Divider />
                          <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, partyName: '' }))}>
                            Clear Filter
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </SortableHeader>
                  <SortableHeader field="categoryName">
                    <Group gap={4}>
                      Category Name
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" size="xs" color={columnFilters.categoryName ? 'blue' : 'gray'} onClick={(e) => e.stopPropagation()}>
                            <IconFilter size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                          <TextInput
                            placeholder="Filter category..."
                            value={columnFilters.categoryName}
                            onChange={(e) => setColumnFilters(f => ({ ...f, categoryName: e.target.value }))}
                            size="xs"
                          />
                          <Menu.Divider />
                          <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, categoryName: '' }))}>
                            Clear Filter
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </SortableHeader>
                  <SortableHeader field="type">
                    <Group gap={4}>
                      Type
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" size="xs" color={columnFilters.type ? 'blue' : 'gray'} onClick={(e) => e.stopPropagation()}>
                            <IconFilter size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
                          <TextInput
                            placeholder="Filter type..."
                            value={columnFilters.type}
                            onChange={(e) => setColumnFilters(f => ({ ...f, type: e.target.value }))}
                            size="xs"
                          />
                          <Menu.Divider />
                          <Menu.Item onClick={() => setColumnFilters(f => ({ ...f, type: '' }))}>
                            Clear Filter
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </SortableHeader>
                  <SortableHeader field="total" align="right">Total</SortableHeader>
                  <SortableHeader field="received" align="right">Received</SortableHeader>
                  <SortableHeader field="balance" align="right">Balance</SortableHeader>
                  <Table.Th style={{ width: 80, textAlign: 'center' }}>Print / Share</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredTransactions.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={10}>
                      <Flex direction="column" align="center" justify="center" py={80}>
                        <Box
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            backgroundColor: '#f0f4f8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 20
                          }}
                        >
                          <ThemeIcon size={60} variant="light" color="gray" radius="xl">
                            <IconFileDescription size={36} />
                          </ThemeIcon>
                        </Box>
                        <Text c="dimmed" size="lg" fw={500} ta="center">
                          No transactions found for the selected period
                        </Text>
                        <Text c="dimmed" size="sm" ta="center" mt={8}>
                          Try selecting a different date range or check if transactions exist
                        </Text>
                      </Flex>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredTransactions.map((txn, idx) => (
                    <Table.Tr
                      key={txn._id || idx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(txn)}
                    >
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" c="dimmed">{idx + 1}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(txn.date)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500} c="blue" style={{ fontFamily: 'monospace' }}>
                          {txn.refNo || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{txn.partyName || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light" color={getCategoryColor(txn.categoryName)} radius="sm">
                          {txn.categoryName || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="filled" color={getTypeBadgeColor(txn.type)} radius="sm">
                          {txn.type || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={600}>
                          {formatCurrency(txn.total)}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={500} c="green.7">
                          {txn.received > 0 ? formatCurrency(txn.received) : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={500} c={txn.balance > 0 ? 'red.7' : 'dimmed'}>
                          {txn.balance > 0 ? formatCurrency(txn.balance) : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <Group gap={4} justify="center">
                          <Tooltip label="Print">
                            <ActionIcon variant="subtle" size="sm" color="blue">
                              <IconPrinter size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Share">
                            <ActionIcon variant="subtle" size="sm" color="teal">
                              <IconShare size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
              {filteredTransactions.length > 0 && (
                <Table.Tfoot style={{ backgroundColor: '#f8f9fa' }}>
                  <Table.Tr>
                    <Table.Td colSpan={6} style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={600}>Totals:</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700}>{formatCurrency(totals.total)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700} c="green.7">{formatCurrency(totals.received)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={700} c="red.7">{formatCurrency(totals.balance)}</Text>
                    </Table.Td>
                    <Table.Td></Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          </Box>
        </ScrollArea>

        {/* Footer Summary */}
        {filteredTransactions.length > 0 && (
          <Box p="md" style={{ borderTop: '1px solid #e9ecef', backgroundColor: '#f8f9fa' }}>
            <Flex justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Showing {filteredTransactions.length} of {reportData?.transactions?.length || 0} transactions
              </Text>
              <Group gap="xl">
                <Box ta="center">
                  <Text size="xs" c="dimmed" fw={500}>Total Amount</Text>
                  <Text size="lg" fw={700}>{formatCurrency(totals.total)}</Text>
                </Box>
                <Box ta="center">
                  <Text size="xs" c="dimmed" fw={500}>Total Received</Text>
                  <Text size="lg" fw={700} c="green.7">{formatCurrency(totals.received)}</Text>
                </Box>
                <Box ta="center">
                  <Text size="xs" c="dimmed" fw={500}>Total Balance</Text>
                  <Text size="lg" fw={700} c="red.7">{formatCurrency(totals.balance)}</Text>
                </Box>
              </Group>
            </Flex>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default VyaparAllTransactions;
