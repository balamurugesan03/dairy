import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Container,
  Paper,
  Group,
  Text,
  Title,
  Select,
  Checkbox,
  TextInput,
  Table,
  ScrollArea,
  ActionIcon,
  Badge,
  Stack,
  Box,
  Flex,
  Tooltip,
  Menu,
  Divider,
  LoadingOverlay,
  Center,
  ThemeIcon,
  Card,
  SimpleGrid,
  UnstyledButton,
  Popover,
  Button,
  rem
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet,
  IconPrinter,
  IconSearch,
  IconFilter,
  IconChevronDown,
  IconSortAscending,
  IconSortDescending,
  IconShare,
  IconCash,
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconReceipt,
  IconCalendar,
  IconBuilding,
  IconX,
  IconCheck
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';

const VyaparCashInHand = () => {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showZeroTransactions, setShowZeroTransactions] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Date filter state
  const [periodFilter, setPeriodFilter] = useState('thisMonth');
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(dayjs().endOf('month').toDate());
  const [firmFilter, setFirmFilter] = useState('all');

  // Column filters
  const [columnFilters, setColumnFilters] = useState({
    category: null,
    type: null
  });

  // Period options
  const periodOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisQuarter', label: 'This Quarter' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'financialYear', label: 'Financial Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Handle period change
  const handlePeriodChange = (value) => {
    setPeriodFilter(value);
    const now = dayjs();

    switch (value) {
      case 'today':
        setFromDate(now.startOf('day').toDate());
        setToDate(now.endOf('day').toDate());
        break;
      case 'yesterday':
        setFromDate(now.subtract(1, 'day').startOf('day').toDate());
        setToDate(now.subtract(1, 'day').endOf('day').toDate());
        break;
      case 'thisWeek':
        setFromDate(now.startOf('week').toDate());
        setToDate(now.endOf('week').toDate());
        break;
      case 'lastWeek':
        setFromDate(now.subtract(1, 'week').startOf('week').toDate());
        setToDate(now.subtract(1, 'week').endOf('week').toDate());
        break;
      case 'thisMonth':
        setFromDate(now.startOf('month').toDate());
        setToDate(now.endOf('month').toDate());
        break;
      case 'lastMonth':
        setFromDate(now.subtract(1, 'month').startOf('month').toDate());
        setToDate(now.subtract(1, 'month').endOf('month').toDate());
        break;
      case 'thisQuarter':
        setFromDate(now.startOf('quarter').toDate());
        setToDate(now.endOf('quarter').toDate());
        break;
      case 'thisYear':
        setFromDate(now.startOf('year').toDate());
        setToDate(now.endOf('year').toDate());
        break;
      case 'financialYear':
        const fyStart = now.month() >= 3
          ? now.startOf('year').add(3, 'month')
          : now.subtract(1, 'year').startOf('year').add(3, 'month');
        setFromDate(fyStart.toDate());
        setToDate(fyStart.add(1, 'year').subtract(1, 'day').toDate());
        break;
      default:
        break;
    }
  };

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        filterType: 'custom',
        customStart: dayjs(fromDate).format('YYYY-MM-DD'),
        customEnd: dayjs(toDate).format('YYYY-MM-DD'),
        includeZero: showZeroTransactions
      };

      const response = await reportAPI.vyaparCashInHand(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cash book report');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchReport();
  }, [fromDate, toDate, showZeroTransactions]);

  // Format helpers
  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  // Get unique categories and types for filters
  const { categories, types } = useMemo(() => {
    if (!reportData?.transactions) return { categories: [], types: [] };

    const cats = [...new Set(reportData.transactions.map(r => r.category).filter(Boolean))];
    const typs = [...new Set(reportData.transactions.map(r => r.type).filter(Boolean))];

    return {
      categories: cats.map(c => ({ value: c, label: c })),
      types: typs.map(t => ({ value: t, label: t }))
    };
  }, [reportData]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    if (!reportData?.transactions) return [];

    let filtered = [...reportData.transactions];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.voucherNumber?.toLowerCase().includes(query) ||
        t.name?.toLowerCase().includes(query) ||
        t.particulars?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query) ||
        t.narration?.toLowerCase().includes(query)
      );
    }

    // Apply column filters
    if (columnFilters.category) {
      filtered = filtered.filter(t => t.category === columnFilters.category);
    }
    if (columnFilters.type) {
      filtered = filtered.filter(t => t.type === columnFilters.type);
    }

    // Apply zero amount filter
    if (!showZeroTransactions) {
      filtered = filtered.filter(t => (t.cashIn || 0) !== 0 || (t.cashOut || 0) !== 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [reportData, searchQuery, columnFilters, showZeroTransactions, sortConfig]);

  // Calculate running balance for filtered transactions
  const transactionsWithBalance = useMemo(() => {
    let balance = reportData?.summary?.openingCash || 0;

    return filteredTransactions.map(t => {
      balance = balance + (t.cashIn || 0) - (t.cashOut || 0);

      return {
        ...t,
        runningBalance: balance
      };
    });
  }, [filteredTransactions, reportData?.summary?.openingCash]);

  // Calculate totals
  const totals = useMemo(() => {
    return transactionsWithBalance.reduce((acc, t) => ({
      cashIn: acc.cashIn + (t.cashIn || 0),
      cashOut: acc.cashOut + (t.cashOut || 0)
    }), { cashIn: 0, cashOut: 0 });
  }, [transactionsWithBalance]);

  const closingBalance = (reportData?.summary?.openingCash || 0) + totals.cashIn - totals.cashOut;

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!transactionsWithBalance.length) return;

    const exportData = transactionsWithBalance.map(t => ({
      'Date': formatDate(t.date),
      'Ref No.': t.voucherNumber || '-',
      'Name': t.particulars || '-',
      'Category': t.category || '-',
      'Type': t.type || '-',
      'Cash In': t.cashIn > 0 ? t.cashIn.toFixed(2) : '',
      'Cash Out': t.cashOut > 0 ? t.cashOut.toFixed(2) : '',
      'Running Balance': t.runningBalance.toFixed(2)
    }));

    // Add summary rows
    exportData.push({});
    exportData.push({
      'Date': 'TOTAL',
      'Cash In': totals.cashIn.toFixed(2),
      'Cash Out': totals.cashOut.toFixed(2),
      'Running Balance': closingBalance.toFixed(2)
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cash Book');

    const timestamp = dayjs().format('YYYY-MM-DD');
    XLSX.writeFile(workbook, `cash_in_hand_${timestamp}.xlsx`);
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Column header with filter
  const ColumnHeader = ({ label, sortKey, filterKey, filterOptions }) => {
    const [filterOpen, setFilterOpen] = useState(false);

    return (
      <Group gap={4} wrap="nowrap">
        <UnstyledButton onClick={() => handleSort(sortKey)}>
          <Group gap={4} wrap="nowrap">
            <Text fw={600} size="sm">{label}</Text>
            {sortConfig.key === sortKey && (
              sortConfig.direction === 'asc'
                ? <IconSortAscending size={14} />
                : <IconSortDescending size={14} />
            )}
          </Group>
        </UnstyledButton>

        {filterKey && filterOptions && (
          <Popover opened={filterOpen} onChange={setFilterOpen} position="bottom-start">
            <Popover.Target>
              <ActionIcon
                size="xs"
                variant={columnFilters[filterKey] ? 'filled' : 'subtle'}
                color={columnFilters[filterKey] ? 'blue' : 'gray'}
                onClick={() => setFilterOpen(o => !o)}
              >
                <IconFilter size={12} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown p="xs">
              <Stack gap="xs">
                <Select
                  size="xs"
                  placeholder={`Filter by ${label}`}
                  data={filterOptions}
                  value={columnFilters[filterKey]}
                  onChange={(val) => {
                    setColumnFilters(prev => ({ ...prev, [filterKey]: val }));
                    setFilterOpen(false);
                  }}
                  clearable
                  style={{ width: 150 }}
                />
                {columnFilters[filterKey] && (
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    leftSection={<IconX size={12} />}
                    onClick={() => {
                      setColumnFilters(prev => ({ ...prev, [filterKey]: null }));
                      setFilterOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </Stack>
            </Popover.Dropdown>
          </Popover>
        )}
      </Group>
    );
  };

  return (
    <Container size="xl" py="md">
      {/* Page Title */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon size="lg" variant="light" color="green">
            <IconCash size={20} />
          </ThemeIcon>
          <div>
            <Title order={3}>Cash Book / Cash-in-Hand</Title>
            <Text size="sm" c="dimmed">Track all cash transactions with running balance</Text>
          </div>
        </Group>
      </Group>

      {/* Header Section - Filters */}
      <Paper p="md" withBorder shadow="sm" mb="md">
        <Flex
          gap="md"
          justify="space-between"
          align="flex-end"
          wrap="wrap"
        >
          {/* Left side - Date filters */}
          <Group gap="md" wrap="wrap">
            {/* Period Dropdown */}
            <Select
              label="Period"
              leftSection={<IconCalendar size={16} />}
              data={periodOptions}
              value={periodFilter}
              onChange={handlePeriodChange}
              style={{ width: 160 }}
              size="sm"
            />

            {/* Date Range */}
            <Group gap="xs" align="flex-end">
              <DatePickerInput
                label="Between"
                placeholder="From"
                value={fromDate}
                onChange={(date) => {
                  setFromDate(date);
                  setPeriodFilter('custom');
                }}
                valueFormat="DD/MM/YYYY"
                size="sm"
                style={{ width: 130 }}
              />
              <Text size="sm" c="dimmed" pb={8}>to</Text>
              <DatePickerInput
                placeholder="To"
                value={toDate}
                onChange={(date) => {
                  setToDate(date);
                  setPeriodFilter('custom');
                }}
                valueFormat="DD/MM/YYYY"
                size="sm"
                style={{ width: 130 }}
              />
            </Group>

            {/* Firm Selector */}
            <Select
              label="Firm"
              leftSection={<IconBuilding size={16} />}
              data={[
                { value: 'all', label: 'ALL FIRMS' }
              ]}
              value={firmFilter}
              onChange={setFirmFilter}
              style={{ width: 150 }}
              size="sm"
            />
          </Group>

          {/* Right side - Action buttons */}
          <Group gap="xs">
            <Tooltip label="Export to Excel">
              <ActionIcon
                size="lg"
                variant="light"
                color="green"
                onClick={handleExportExcel}
              >
                <IconFileSpreadsheet size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print Report">
              <ActionIcon
                size="lg"
                variant="light"
                color="blue"
                onClick={handlePrint}
              >
                <IconPrinter size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Flex>
      </Paper>

      {/* Sub-header - Opening Balance & Options */}
      <Paper p="sm" withBorder shadow="sm" mb="md">
        <Flex justify="space-between" align="center" wrap="wrap" gap="md">
          <Group gap="lg">
            <Group gap="xs">
              <Text size="sm" fw={500}>Opening Cash-in-Hand:</Text>
              <Badge
                size="lg"
                variant="light"
                color="green"
                leftSection={<IconWallet size={14} />}
              >
                {'\u20B9'} {formatCurrency(reportData?.summary?.openingCash || 0)}
              </Badge>
            </Group>
          </Group>

          <Checkbox
            label="Show zero amount transactions"
            checked={showZeroTransactions}
            onChange={(e) => setShowZeroTransactions(e.currentTarget.checked)}
            size="sm"
          />
        </Flex>
      </Paper>

      {/* Main Content */}
      <Paper p="md" withBorder shadow="sm" pos="relative">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {/* Search Bar */}
        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Search by Ref No, Name, Category..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
            size="sm"
          />
          <Text size="sm" c="dimmed">
            {transactionsWithBalance.length} transaction(s)
          </Text>
        </Group>

        {/* Data Table */}
        <ScrollArea>
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            style={{ minWidth: 900 }}
          >
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}>
                <Table.Th style={{ width: 100 }}>
                  <ColumnHeader label="Date" sortKey="date" />
                </Table.Th>
                <Table.Th style={{ width: 120 }}>
                  <ColumnHeader label="Ref No." sortKey="voucherNumber" />
                </Table.Th>
                <Table.Th>
                  <ColumnHeader label="Name" sortKey="particulars" />
                </Table.Th>
                <Table.Th style={{ width: 120 }}>
                  <ColumnHeader
                    label="Category"
                    sortKey="category"
                    filterKey="category"
                    filterOptions={categories}
                  />
                </Table.Th>
                <Table.Th style={{ width: 100 }}>
                  <ColumnHeader
                    label="Type"
                    sortKey="type"
                    filterKey="type"
                    filterOptions={types}
                  />
                </Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>
                  <Text fw={600} size="sm" c="green">Cash In</Text>
                </Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'right' }}>
                  <Text fw={600} size="sm" c="red">Cash Out</Text>
                </Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>
                  <Text fw={600} size="sm">Running Balance</Text>
                </Table.Th>
                <Table.Th style={{ width: 80, textAlign: 'center' }}>
                  <Text fw={600} size="sm">Actions</Text>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {transactionsWithBalance.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Center py={60}>
                      <Stack align="center" gap="md">
                        <ThemeIcon size={64} variant="light" color="gray" radius="xl">
                          <IconReceipt size={32} />
                        </ThemeIcon>
                        <Text size="lg" c="dimmed" fw={500}>
                          No transactions to show
                        </Text>
                        <Text size="sm" c="dimmed">
                          Try adjusting your filters or date range
                        </Text>
                      </Stack>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : (
                transactionsWithBalance.map((transaction, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <Text size="sm">{formatDate(transaction.date)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color="gray">
                        {transaction.voucherNumber || '-'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{transaction.name || transaction.particulars || '-'}</Text>
                      {transaction.narration && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {transaction.narration}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="outline">
                        {transaction.category || '-'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        color={transaction.type === 'Receipt' ? 'green' : 'red'}
                        variant="light"
                      >
                        {transaction.type || '-'}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {transaction.cashIn > 0 ? (
                        <Text size="sm" c="green" fw={500}>
                          {'\u20B9'} {formatCurrency(transaction.cashIn)}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {transaction.cashOut > 0 ? (
                        <Text size="sm" c="red" fw={500}>
                          {'\u20B9'} {formatCurrency(transaction.cashOut)}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text
                        size="sm"
                        fw={600}
                        c={transaction.runningBalance >= 0 ? 'dark' : 'red'}
                      >
                        {'\u20B9'} {formatCurrency(Math.abs(transaction.runningBalance))}
                        {transaction.runningBalance < 0 && ' (Dr)'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        <Tooltip label="Print">
                          <ActionIcon size="sm" variant="subtle" color="blue">
                            <IconPrinter size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Share">
                          <ActionIcon size="sm" variant="subtle" color="gray">
                            <IconShare size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {/* Footer Summary */}
        {transactionsWithBalance.length > 0 && (
          <>
            <Divider my="md" />
            <Flex justify="space-between" align="center" wrap="wrap" gap="md">
              {/* Total Cash In */}
              <Card p="sm" withBorder bg="green.0" style={{ flex: 1, minWidth: 200 }}>
                <Group gap="xs">
                  <ThemeIcon size="md" variant="light" color="green">
                    <IconArrowUpRight size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Total Cash-in</Text>
                    <Text size="lg" fw={700} c="green">
                      {'\u20B9'} {formatCurrency(totals.cashIn)}
                    </Text>
                  </div>
                </Group>
              </Card>

              {/* Total Cash Out */}
              <Card p="sm" withBorder bg="red.0" style={{ flex: 1, minWidth: 200 }}>
                <Group gap="xs">
                  <ThemeIcon size="md" variant="light" color="red">
                    <IconArrowDownRight size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Total Cash-out</Text>
                    <Text size="lg" fw={700} c="red">
                      {'\u20B9'} {formatCurrency(totals.cashOut)}
                    </Text>
                  </div>
                </Group>
              </Card>

              {/* Closing Balance */}
              <Card p="sm" withBorder bg="blue.0" style={{ flex: 1, minWidth: 200 }}>
                <Group gap="xs">
                  <ThemeIcon size="md" variant="light" color="blue">
                    <IconWallet size={16} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">Closing Cash-in-Hand</Text>
                    <Text size="lg" fw={700} c="blue">
                      {'\u20B9'} {formatCurrency(closingBalance)}
                    </Text>
                  </div>
                </Group>
              </Card>
            </Flex>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default VyaparCashInHand;
