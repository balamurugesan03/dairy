import { useState, useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import {
  Container,
  Paper,
  Group,
  Text,
  Title,
  Select,
  TextInput,
  Table,
  ScrollArea,
  ActionIcon,
  Badge,
  Stack,
  Flex,
  Tooltip,
  Divider,
  LoadingOverlay,
  Center,
  ThemeIcon,
  Card,
  Button,
  rem
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFileSpreadsheet,
  IconPrinter,
  IconSearch,
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconReceipt,
  IconCalendar,
  IconShoppingCart,
  IconCash,
  IconRefresh
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { reportAPI } from '../../../services/api';
import { printVyaparReport } from '../../../utils/printReport';
import { notifications } from '@mantine/notifications';
import { useCompany } from '../../../context/CompanyContext';

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

const CATEGORY_COLORS = {
  Sales: 'green',
  Purchase: 'red',
  'Customer Receipt': 'teal',
  'Supplier Payment': 'orange',
  'Bank Transfer': 'blue',
  Expense: 'red',
  Income: 'green',
  Capital: 'violet',
  General: 'gray'
};

const SOURCE_LABELS = {
  sale: { label: 'Sale', color: 'green' },
  purchase: { label: 'Purchase', color: 'red' },
  voucher: { label: 'Voucher', color: 'blue' }
};

const VyaparCashInHand = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('thisMonth');
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(dayjs().endOf('month').toDate());
  const [categoryFilter, setCategoryFilter] = useState(null);
  const printRef = useRef(null);
  const [typeFilter, setTypeFilter] = useState(null);

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
      case 'financialYear': {
        const fyStart = now.month() >= 3
          ? now.startOf('year').add(3, 'month')
          : now.subtract(1, 'year').startOf('year').add(3, 'month');
        setFromDate(fyStart.toDate());
        setToDate(fyStart.add(1, 'year').subtract(1, 'day').toDate());
        break;
      }
      default:
        break;
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {
        filterType: 'custom',
        customStart: dayjs(fromDate).format('YYYY-MM-DD'),
        customEnd: dayjs(toDate).format('YYYY-MM-DD')
      };
      const response = await reportAPI.vyaparCashInHand(params);
      setReportData(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch cash-in-hand report',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [fromDate, toDate]);

  const fmt = (amount) =>
    parseFloat(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const fmtDate = (date) => dayjs(date).format('DD/MM/YYYY');

  // Unique categories and types for filters
  const { categories, types } = useMemo(() => {
    if (!reportData?.transactions) return { categories: [], types: [] };
    const cats = [...new Set(reportData.transactions.map(t => t.category).filter(Boolean))];
    const typs = [...new Set(reportData.transactions.map(t => t.type).filter(Boolean))];
    return {
      categories: cats.map(c => ({ value: c, label: c })),
      types: typs.map(t => ({ value: t, label: t }))
    };
  }, [reportData]);

  // Filtered transactions
  const filtered = useMemo(() => {
    if (!reportData?.transactions) return [];
    let rows = [...reportData.transactions];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(t =>
        t.partyName?.toLowerCase().includes(q) ||
        t.refNo?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.narration?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) rows = rows.filter(t => t.category === categoryFilter);
    if (typeFilter) rows = rows.filter(t => t.type === typeFilter);

    return rows;
  }, [reportData, searchQuery, categoryFilter, typeFilter]);

  const summary = reportData?.summary || {};
  const openingCash = summary.openingCash || 0;

  // Recalculate totals from filtered rows
  const filteredTotals = useMemo(() => {
    return filtered.reduce((acc, t) => ({
      cashIn: acc.cashIn + (t.cashIn || 0),
      cashOut: acc.cashOut + (t.cashOut || 0)
    }), { cashIn: 0, cashOut: 0 });
  }, [filtered]);

  const closingBalance = openingCash + filteredTotals.cashIn - filteredTotals.cashOut;

  const handleExportExcel = () => {
    if (!filtered.length) return;
    const rows = filtered.map(t => ({
      'Date': fmtDate(t.date),
      'Ref No.': t.refNo || '-',
      'Party Name': t.partyName || '-',
      'Category': t.category || '-',
      'Type': t.type || '-',
      'Source': SOURCE_LABELS[t.source]?.label || t.source || '-',
      'Cash In (₹)': t.cashIn > 0 ? t.cashIn.toFixed(2) : '',
      'Cash Out (₹)': t.cashOut > 0 ? t.cashOut.toFixed(2) : '',
      'Running Balance (₹)': (t.runningBalance || 0).toFixed(2),
      'Narration': t.narration || ''
    }));

    rows.push({});
    rows.push({
      'Date': 'TOTALS',
      'Cash In (₹)': filteredTotals.cashIn.toFixed(2),
      'Cash Out (₹)': filteredTotals.cashOut.toFixed(2),
      'Running Balance (₹)': closingBalance.toFixed(2)
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash In Hand');
    XLSX.writeFile(wb, `cash_in_hand_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  return (
    <Container size="xl" py="md" ref={printRef}>
      {/* Title */}
      <Group justify="space-between" mb="md" data-no-print>
        <Group gap="xs">
          <ThemeIcon size="lg" variant="light" color="green">
            <IconCash size={20} />
          </ThemeIcon>
          <div>
            <Title order={3}>Cash In Hand</Title>
            <Text size="sm" c="dimmed">All business cash receipts and payments</Text>
          </div>
        </Group>
        <Group gap="xs">
          <Tooltip label="Refresh">
            <ActionIcon size="lg" variant="light" color="gray" onClick={fetchReport} loading={loading}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Export Excel">
            <ActionIcon size="lg" variant="light" color="green" onClick={handleExportExcel}>
              <IconFileSpreadsheet size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Print">
            <ActionIcon size="lg" variant="light" color="blue" onClick={() => printVyaparReport(printRef, { title: 'Cash In Hand Report', companyName: selectedCompany?.companyName || '', orientation: 'landscape' })}>
              <IconPrinter size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Filters */}
      <Paper p="md" withBorder shadow="sm" mb="md" data-no-print>
        <Flex gap="md" align="flex-end" wrap="wrap">
          <Select
            label="Period"
            leftSection={<IconCalendar size={16} />}
            data={periodOptions}
            value={periodFilter}
            onChange={handlePeriodChange}
            style={{ width: 160 }}
            size="sm"
          />
          <Group gap="xs" align="flex-end">
            <DatePickerInput
              label="From"
              value={fromDate}
              onChange={(d) => { setFromDate(d); setPeriodFilter('custom'); }}
              valueFormat="DD/MM/YYYY"
              size="sm"
              style={{ width: 130 }}
            />
            <Text size="sm" c="dimmed" pb={8}>to</Text>
            <DatePickerInput
              value={toDate}
              onChange={(d) => { setToDate(d); setPeriodFilter('custom'); }}
              valueFormat="DD/MM/YYYY"
              size="sm"
              style={{ width: 130 }}
            />
          </Group>
          <Select
            label="Category"
            data={categories}
            value={categoryFilter}
            onChange={setCategoryFilter}
            clearable
            placeholder="All Categories"
            size="sm"
            style={{ width: 160 }}
          />
          <Select
            label="Type"
            data={types}
            value={typeFilter}
            onChange={setTypeFilter}
            clearable
            placeholder="All Types"
            size="sm"
            style={{ width: 140 }}
          />
        </Flex>
      </Paper>

      {/* Summary Cards */}
      <Flex gap="md" mb="md" wrap="wrap">
        <Card p="sm" withBorder style={{ flex: 1, minWidth: 160 }}>
          <Text size="xs" c="dimmed">Opening Balance</Text>
          <Text size="lg" fw={700} c="dark">₹ {fmt(openingCash)}</Text>
        </Card>
        <Card p="sm" withBorder bg="green.0" style={{ flex: 1, minWidth: 160 }}>
          <Group gap="xs">
            <IconArrowUpRight size={18} color="green" />
            <div>
              <Text size="xs" c="dimmed">Cash In</Text>
              <Text size="lg" fw={700} c="green">₹ {fmt(summary.totalCashIn || 0)}</Text>
              <Text size="xs" c="dimmed">{summary.salesCount || 0} sales</Text>
            </div>
          </Group>
        </Card>
        <Card p="sm" withBorder bg="red.0" style={{ flex: 1, minWidth: 160 }}>
          <Group gap="xs">
            <IconArrowDownRight size={18} color="red" />
            <div>
              <Text size="xs" c="dimmed">Cash Out</Text>
              <Text size="lg" fw={700} c="red">₹ {fmt(summary.totalCashOut || 0)}</Text>
              <Text size="xs" c="dimmed">{summary.purchaseCount || 0} purchases</Text>
            </div>
          </Group>
        </Card>
        <Card p="sm" withBorder bg="blue.0" style={{ flex: 1, minWidth: 160 }}>
          <Group gap="xs">
            <IconWallet size={18} color="blue" />
            <div>
              <Text size="xs" c="dimmed">Closing Balance</Text>
              <Text size="lg" fw={700} c={closingBalance >= 0 ? 'blue' : 'red'}>
                ₹ {fmt(Math.abs(summary.closingBalance || 0))}
                {(summary.closingBalance || 0) < 0 && ' (Dr)'}
              </Text>
            </div>
          </Group>
        </Card>
      </Flex>

      {/* Transaction Table */}
      <Paper p="md" withBorder shadow="sm" pos="relative">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Search party, ref no, category..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 300 }}
            size="sm"
          />
          <Text size="sm" c="dimmed">{filtered.length} transaction(s)</Text>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 900 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}>
                <Table.Th style={{ width: 100 }}>Date</Table.Th>
                <Table.Th style={{ width: 120 }}>Ref No.</Table.Th>
                <Table.Th>Party Name</Table.Th>
                <Table.Th style={{ width: 120 }}>Category</Table.Th>
                <Table.Th style={{ width: 90 }}>Source</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>
                  <Text fw={600} size="sm" c="green">Cash In (₹)</Text>
                </Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>
                  <Text fw={600} size="sm" c="red">Cash Out (₹)</Text>
                </Table.Th>
                <Table.Th style={{ width: 140, textAlign: 'right' }}>Balance (₹)</Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {/* Opening Balance Row */}
              {reportData && (
                <Table.Tr style={{ backgroundColor: 'var(--mantine-color-yellow-0)' }}>
                  <Table.Td colSpan={5}>
                    <Text size="sm" fw={600} c="dimmed">Opening Balance</Text>
                  </Table.Td>
                  <Table.Td />
                  <Table.Td />
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={700}>₹ {fmt(openingCash)}</Text>
                  </Table.Td>
                </Table.Tr>
              )}

              {filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Center py={60}>
                      <Stack align="center" gap="md">
                        <ThemeIcon size={64} variant="light" color="gray" radius="xl">
                          <IconReceipt size={32} />
                        </ThemeIcon>
                        <Text size="lg" c="dimmed" fw={500}>No cash transactions found</Text>
                        <Text size="sm" c="dimmed">
                          Try adjusting your filters or date range
                        </Text>
                      </Stack>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filtered.map((txn, idx) => {
                  const src = SOURCE_LABELS[txn.source] || { label: txn.source, color: 'gray' };
                  const catColor = CATEGORY_COLORS[txn.category] || 'gray';
                  return (
                    <Table.Tr key={idx}>
                      <Table.Td>
                        <Text size="sm">{fmtDate(txn.date)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">{txn.refNo || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{txn.partyName || '-'}</Text>
                        {txn.narration && (
                          <Text size="xs" c="dimmed" lineClamp={1}>{txn.narration}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={catColor} variant="light">
                          {txn.category || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={src.color} variant="dot">
                          {src.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {txn.cashIn > 0 ? (
                          <Text size="sm" c="green" fw={600}>
                            {fmt(txn.cashIn)}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {txn.cashOut > 0 ? (
                          <Text size="sm" c="red" fw={600}>
                            {fmt(txn.cashOut)}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text
                          size="sm"
                          fw={600}
                          c={(txn.runningBalance || 0) >= 0 ? 'dark' : 'red'}
                        >
                          {fmt(Math.abs(txn.runningBalance || 0))}
                          {(txn.runningBalance || 0) < 0 && ' Dr'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {/* Footer Totals */}
        {filtered.length > 0 && (
          <>
            <Divider my="md" />
            <Flex justify="flex-end" gap="xl" wrap="wrap">
              <Group gap="xs">
                <Text size="sm" fw={600} c="dimmed">Total Cash In:</Text>
                <Text size="sm" fw={700} c="green">₹ {fmt(filteredTotals.cashIn)}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" fw={600} c="dimmed">Total Cash Out:</Text>
                <Text size="sm" fw={700} c="red">₹ {fmt(filteredTotals.cashOut)}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" fw={600} c="dimmed">Closing Balance:</Text>
                <Text size="sm" fw={700} c={closingBalance >= 0 ? 'blue' : 'red'}>
                  ₹ {fmt(Math.abs(closingBalance))}
                  {closingBalance < 0 && ' (Dr)'}
                </Text>
              </Group>
            </Flex>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default VyaparCashInHand;
