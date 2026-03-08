import { useState, useEffect, useMemo } from 'react';
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
  Divider,
  ScrollArea,
  Card,
  Center
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBuildingBank,
  IconSearch,
  IconFileSpreadsheet,
  IconPrinter,
  IconRefresh,
  IconCalendar,
  IconArrowLeft,
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconX,
  IconReceipt
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI, ledgerAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import * as XLSX from 'xlsx';

const VyaparBankStatement = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [bankLedgers, setBankLedgers] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Date filter state
  const [periodFilter, setPeriodFilter] = useState('thisMonth');
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(dayjs().endOf('month').toDate());

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

  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch bank ledgers on mount
  useEffect(() => {
    fetchBankLedgers();
  }, []);

  const fetchBankLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll({ limit: 1000 });
      const allLedgers = Array.isArray(response.data)
        ? response.data
        : response.data?.ledgers || [];
      const banks = allLedgers.filter(l => l.ledgerType === 'Bank');
      setBankLedgers(banks);
      if (banks.length > 0 && !selectedBank) {
        setSelectedBank(banks[0]._id);
      }
    } catch (error) {
      console.error('Failed to fetch bank ledgers:', error);
    }
  };

  const handlePeriodChange = (value) => {
    setPeriodFilter(value);
    const now = dayjs();
    switch (value) {
      case 'today': setFromDate(now.startOf('day').toDate()); setToDate(now.endOf('day').toDate()); break;
      case 'yesterday': setFromDate(now.subtract(1, 'day').startOf('day').toDate()); setToDate(now.subtract(1, 'day').endOf('day').toDate()); break;
      case 'thisWeek': setFromDate(now.startOf('week').toDate()); setToDate(now.endOf('week').toDate()); break;
      case 'lastWeek': setFromDate(now.subtract(1, 'week').startOf('week').toDate()); setToDate(now.subtract(1, 'week').endOf('week').toDate()); break;
      case 'thisMonth': setFromDate(now.startOf('month').toDate()); setToDate(now.endOf('month').toDate()); break;
      case 'lastMonth': setFromDate(now.subtract(1, 'month').startOf('month').toDate()); setToDate(now.subtract(1, 'month').endOf('month').toDate()); break;
      case 'thisQuarter': setFromDate(now.startOf('quarter').toDate()); setToDate(now.endOf('quarter').toDate()); break;
      case 'thisYear': setFromDate(now.startOf('year').toDate()); setToDate(now.endOf('year').toDate()); break;
      case 'financialYear': {
        const fyStart = now.month() >= 3
          ? now.startOf('year').add(3, 'month')
          : now.subtract(1, 'year').startOf('year').add(3, 'month');
        setFromDate(fyStart.toDate());
        setToDate(fyStart.add(1, 'year').subtract(1, 'day').toDate());
        break;
      }
      default: break;
    }
  };

  const fetchReport = async () => {
    if (!selectedBank) {
      message.warning('Please select a bank ledger');
      return;
    }
    setLoading(true);
    try {
      const params = {
        ledgerId: selectedBank,
        filterType: 'custom',
        customStart: dayjs(fromDate).format('YYYY-MM-DD'),
        customEnd: dayjs(toDate).format('YYYY-MM-DD')
      };
      const response = await reportAPI.vyaparBankStatement(params);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch bank statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBank) {
      fetchReport();
    }
  }, [selectedBank, fromDate, toDate]);

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const filteredTransactions = useMemo(() => {
    let data = reportData?.transactions || [];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(t =>
        t.particulars?.toLowerCase().includes(query) ||
        t.voucherNumber?.toLowerCase().includes(query) ||
        t.voucherType?.toLowerCase().includes(query) ||
        t.mode?.toLowerCase().includes(query)
      );
    }
    return data;
  }, [reportData, searchQuery]);

  const handleExportExcel = () => {
    if (!filteredTransactions?.length) {
      message.warning('No data to export');
      return;
    }
    const exportData = filteredTransactions.map((txn, i) => ({
      '#': i + 1,
      'Date': formatDate(txn.date),
      'Voucher No.': txn.voucherNumber || '',
      'Type': txn.voucherType || '',
      'Particulars': txn.particulars || '',
      'Mode': txn.mode || '',
      'Deposit (Dr)': txn.deposit > 0 ? txn.deposit : '',
      'Withdrawal (Cr)': txn.withdrawal > 0 ? txn.withdrawal : '',
      'Balance': txn.balance || 0
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Statement');
    XLSX.writeFile(wb, `BankStatement_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const bankName = reportData?.ledger?.ledgerName || 'Bank';
    printWindow.document.write(`
      <html>
        <head>
          <title>Bank Statement - ${bankName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .text-right { text-align: right; }
            .header { text-align: center; margin-bottom: 15px; }
            .header h2 { margin: 0; }
            .header p { margin: 3px 0; color: #666; }
            .total-row { background-color: #f0f0f0; font-weight: 700; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>BANK STATEMENT</h2>
            <p>${bankName}</p>
            <p>Period: ${formatDate(fromDate)} to ${formatDate(toDate)}</p>
            <p>Opening Balance: \u20B9 ${formatCurrency(reportData?.summary?.openingBalance || 0)}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Ref No.</th>
                <th>Type</th>
                <th>Particulars</th>
                <th>Mode</th>
                <th class="text-right">Deposit (Dr)</th>
                <th class="text-right">Withdrawal (Cr)</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map((txn, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${formatDate(txn.date)}</td>
                  <td>${txn.voucherNumber || '-'}</td>
                  <td>${txn.voucherType || '-'}</td>
                  <td>${txn.particulars || '-'}</td>
                  <td>${txn.mode || '-'}</td>
                  <td class="text-right">${txn.deposit > 0 ? '\u20B9 ' + formatCurrency(txn.deposit) : '-'}</td>
                  <td class="text-right">${txn.withdrawal > 0 ? '\u20B9 ' + formatCurrency(txn.withdrawal) : '-'}</td>
                  <td class="text-right">\u20B9 ${formatCurrency(txn.balance)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="6" style="text-align:right">Total / Closing Balance</td>
                <td class="text-right">\u20B9 ${formatCurrency(reportData?.summary?.totalDeposits)}</td>
                <td class="text-right">\u20B9 ${formatCurrency(reportData?.summary?.totalWithdrawals)}</td>
                <td class="text-right">\u20B9 ${formatCurrency(reportData?.summary?.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const summary = reportData?.summary || {};

  const bankSelectData = bankLedgers.map(b => ({
    value: b._id,
    label: b.ledgerName
  }));

  return (
    <Box pos="relative" p="md" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 2 }} />

      {/* Header */}
      <Paper shadow="xs" p="md" mb="md" withBorder radius="md" style={{ backgroundColor: '#fff' }}>
        <Group justify="space-between" align="center" mb="lg">
          <Group gap="sm">
            <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/reports/vyapar')} size="lg">
              <IconArrowLeft size={20} />
            </ActionIcon>
            <ThemeIcon size="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} radius="md">
              <IconBuildingBank size={24} />
            </ThemeIcon>
            <Box>
              <Title order={3} fw={600} c="dark">Bank Statement</Title>
              <Text size="sm" c="dimmed">
                {reportData?.ledger?.ledgerName
                  ? `${reportData.ledger.ledgerName} — transactions and running balance`
                  : 'Bank ledger transactions and running balance'}
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Tooltip label="Refresh">
              <ActionIcon variant="light" size="lg" radius="md" onClick={fetchReport}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Excel Export">
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

        {/* Filters */}
        <Flex gap="md" wrap="wrap" align="flex-end">
          <Select
            label="Select Bank"
            placeholder="Choose a bank..."
            data={bankSelectData}
            value={selectedBank}
            onChange={setSelectedBank}
            style={{ width: 220 }}
            size="sm"
            leftSection={<IconBuildingBank size={16} />}
            searchable
          />
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
              label="Between"
              placeholder="From"
              value={fromDate}
              onChange={(date) => { setFromDate(date); setPeriodFilter('custom'); }}
              valueFormat="DD/MM/YYYY"
              size="sm"
              style={{ width: 130 }}
            />
            <Text size="sm" c="dimmed" pb={8}>to</Text>
            <DatePickerInput
              placeholder="To"
              value={toDate}
              onChange={(date) => { setToDate(date); setPeriodFilter('custom'); }}
              valueFormat="DD/MM/YYYY"
              size="sm"
              style={{ width: 130 }}
            />
          </Group>
        </Flex>
      </Paper>

      {/* Summary Cards */}
      {reportData && (
        <Flex gap="md" mb="md" wrap="wrap">
          <Card shadow="xs" withBorder p="md" bg="blue.0" style={{ flex: 1, minWidth: 180 }}>
            <Group gap="xs">
              <ThemeIcon size="md" variant="light" color="blue"><IconWallet size={16} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Opening Balance</Text>
                <Text size="lg" fw={700} c="blue">{'\u20B9'} {formatCurrency(summary.openingBalance)}</Text>
              </div>
            </Group>
          </Card>
          <Card shadow="xs" withBorder p="md" bg="green.0" style={{ flex: 1, minWidth: 180 }}>
            <Group gap="xs">
              <ThemeIcon size="md" variant="light" color="green"><IconArrowUpRight size={16} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Total Deposits</Text>
                <Text size="lg" fw={700} c="green">{'\u20B9'} {formatCurrency(summary.totalDeposits)}</Text>
              </div>
            </Group>
          </Card>
          <Card shadow="xs" withBorder p="md" bg="red.0" style={{ flex: 1, minWidth: 180 }}>
            <Group gap="xs">
              <ThemeIcon size="md" variant="light" color="red"><IconArrowDownRight size={16} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Total Withdrawals</Text>
                <Text size="lg" fw={700} c="red">{'\u20B9'} {formatCurrency(summary.totalWithdrawals)}</Text>
              </div>
            </Group>
          </Card>
          <Card shadow="xs" withBorder p="md" bg="violet.0" style={{ flex: 1, minWidth: 180 }}>
            <Group gap="xs">
              <ThemeIcon size="md" variant="light" color="violet"><IconWallet size={16} /></ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Closing Balance</Text>
                <Text size="lg" fw={700} c="violet">{'\u20B9'} {formatCurrency(summary.closingBalance)}</Text>
              </div>
            </Group>
          </Card>
        </Flex>
      )}

      {/* Main Table */}
      <Paper shadow="xs" withBorder radius="md" style={{ backgroundColor: '#fff' }}>
        <Box p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
          <TextInput
            placeholder="Search by particulars, voucher no, type..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            rightSection={searchQuery && (
              <ActionIcon variant="subtle" size="sm" onClick={() => setSearchQuery('')}>
                <IconX size={14} />
              </ActionIcon>
            )}
            style={{ maxWidth: 400 }}
            size="sm"
          />
        </Box>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 900 }}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}>
                <Table.Th style={{ width: 50 }}>#</Table.Th>
                <Table.Th style={{ width: 100 }}>Date</Table.Th>
                <Table.Th style={{ width: 130 }}>Ref No.</Table.Th>
                <Table.Th style={{ width: 90 }}>Type</Table.Th>
                <Table.Th>Particulars</Table.Th>
                <Table.Th style={{ width: 90 }}>Mode</Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>
                  <Text fw={600} size="sm" c="green">Deposit (Dr)</Text>
                </Table.Th>
                <Table.Th style={{ width: 130, textAlign: 'right' }}>
                  <Text fw={600} size="sm" c="red">Withdrawal (Cr)</Text>
                </Table.Th>
                <Table.Th style={{ width: 140, textAlign: 'right' }}>
                  <Text fw={600} size="sm">Balance</Text>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {!reportData ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Center py={60}>
                      <Stack align="center" gap="md">
                        <ThemeIcon size={64} variant="light" color="gray" radius="xl">
                          <IconBuildingBank size={32} />
                        </ThemeIcon>
                        <Text size="lg" c="dimmed" fw={500}>Select a bank to view statement</Text>
                        <Text size="sm" c="dimmed">Choose a bank ledger from the filter above</Text>
                      </Stack>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : filteredTransactions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Center py={60}>
                      <Stack align="center" gap="md">
                        <ThemeIcon size={64} variant="light" color="gray" radius="xl">
                          <IconReceipt size={32} />
                        </ThemeIcon>
                        <Text size="lg" c="dimmed" fw={500}>No bank transactions found</Text>
                        <Text size="sm" c="dimmed">No Bank/UPI/Card/Cheque payments in this period</Text>
                      </Stack>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredTransactions.map((txn, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td><Text size="sm" c="dimmed">{idx + 1}</Text></Table.Td>
                    <Table.Td><Text size="sm">{formatDate(txn.date)}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{txn.voucherNumber || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        color={txn.deposit > 0 ? 'green' : 'red'}
                        variant="light"
                      >
                        {txn.voucherType || '-'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{txn.particulars || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="outline" color="blue">{txn.mode || '-'}</Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {txn.deposit > 0 ? (
                        <Text size="sm" c="green" fw={500}>{'\u20B9'} {formatCurrency(txn.deposit)}</Text>
                      ) : <Text size="sm" c="dimmed">-</Text>}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {txn.withdrawal > 0 ? (
                        <Text size="sm" c="red" fw={500}>{'\u20B9'} {formatCurrency(txn.withdrawal)}</Text>
                      ) : <Text size="sm" c="dimmed">-</Text>}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={600} c={txn.balance >= 0 ? 'dark' : 'red'}>
                        {'\u20B9'} {formatCurrency(Math.abs(txn.balance))}
                        {txn.balance < 0 && ' (Cr)'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
            {reportData && filteredTransactions.length > 0 && (
              <Table.Tfoot style={{ backgroundColor: '#f0f0f0' }}>
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={700}>Total / Closing Balance:</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={700} c="green">{'\u20B9'} {formatCurrency(summary.totalDeposits)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={700} c="red">{'\u20B9'} {formatCurrency(summary.totalWithdrawals)}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text size="sm" fw={700}>{'\u20B9'} {formatCurrency(summary.closingBalance)}</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </ScrollArea>
      </Paper>
    </Box>
  );
};

export default VyaparBankStatement;
