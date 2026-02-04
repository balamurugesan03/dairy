import { useState, useEffect, useRef } from 'react';
import {
  Container,
  Card,
  Group,
  Stack,
  Select,
  TextInput,
  Button,
  Loader,
  Title,
  Text,
  Table,
  Box,
  Paper,
  Grid,
  Divider,
  Center,
  ActionIcon
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPrinter, IconDownload, IconRefresh, IconCalendar, IconBuilding } from '@tabler/icons-react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';

const GeneralLedger = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [societyName, setSocietyName] = useState('Dairy Cooperative Society');
  const printRef = useRef(null);

  useEffect(() => {
    fetchLedgers();
    // Set default date range (current financial year)
    const today = dayjs();
    const financialYearStart = today.month() >= 3
      ? dayjs().month(3).date(1)
      : dayjs().subtract(1, 'year').month(3).date(1);
    setDateRange({
      startDate: financialYearStart.toDate(),
      endDate: today.toDate()
    });
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await reportAPI.ledgersDropdown();
      setLedgers(response.data);
    } catch (error) {
      message.error('Failed to fetch ledgers');
    }
  };

  const fetchReport = async () => {
    if (!selectedLedger) {
      message.error('Please select a ledger');
      return;
    }
    if (!dateRange.startDate || !dateRange.endDate) {
      message.error('Please select date range');
      return;
    }

    setLoading(true);
    try {
      const response = await reportAPI.generalLedger({
        startDate: dayjs(dateRange.startDate).format('YYYY-MM-DD'),
        endDate: dayjs(dateRange.endDate).format('YYYY-MM-DD'),
        ledgerId: selectedLedger
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch general ledger');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  const formatDay = (date) => {
    return dayjs(date).format('DD');
  };

  const getFinancialYear = (startDate, endDate) => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const startYear = start.month() >= 3 ? start.year() : start.year() - 1;
    const endYear = startYear + 1;
    return `${startYear}-${endYear.toString().slice(2)}`;
  };

  const groupTransactionsByMonth = (transactions) => {
    const grouped = {};
    transactions.forEach(transaction => {
      const monthYear = dayjs(transaction.date).format('MMM-YYYY');
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(transaction);
    });
    return grouped;
  };

  const calculateProgressiveData = (transactions) => {
    let progressiveReceipt = 0;
    let progressivePayment = 0;
    let runningBalance = reportData?.openingBalance || 0;

    return transactions.map(transaction => {
      const isReceipt = transaction.credit > 0;
      const receipt = isReceipt ? transaction.credit : 0;
      const payment = !isReceipt ? transaction.debit : 0;

      progressiveReceipt += receipt;
      progressivePayment += payment;
      runningBalance = runningBalance + receipt - payment;

      return {
        ...transaction,
        receipt,
        payment,
        progressiveReceipt,
        progressivePayment,
        runningBalance
      };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!reportData) return;

    const csvData = [];
    csvData.push(['Day', 'Receipt', 'Progressive Receipt', 'Payment', 'Progressive Payment', 'Balance', 'Description']);

    const processedTransactions = calculateProgressiveData(reportData.transactions);
    processedTransactions.forEach(t => {
      csvData.push([
        formatDay(t.date),
        formatNumber(t.receipt),
        formatNumber(t.progressiveReceipt),
        formatNumber(t.payment),
        formatNumber(t.progressivePayment),
        formatNumber(t.runningBalance),
        `${t.particulars} ${t.narration || ''}`
      ]);
    });

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `general_ledger_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
  };

  const renderLedgerReport = () => {
    if (!reportData) return null;

    const processedTransactions = calculateProgressiveData(reportData.transactions);
    const groupedByMonth = groupTransactionsByMonth(processedTransactions);

    return (
      <Paper ref={printRef} shadow="md" radius="md" p="xl" mt="xl">
        {/* Report Header */}
        <Stack align="center" mb="xl">
          <Title order={1} size="h2" ta="center">{societyName}</Title>
          <Title order={2} size="h3" ta="center" c="blue">GENERAL LEDGER</Title>
          <Stack gap="xs" align="center">
            <Text fw={500}>
              <Text span fw={600}>Financial Year:</Text> {getFinancialYear(dateRange.startDate, dateRange.endDate)}
            </Text>
            <Text fw={500}>
              <Text span fw={600}>Head of Account:</Text> {reportData.ledger.name}
            </Text>
            <Text fw={500}>
              <Text span fw={600}>Period:</Text> {formatDate(reportData.startDate)} to {formatDate(reportData.endDate)}
            </Text>
          </Stack>
        </Stack>

        {/* Ledger Table */}
        <Box style={{ overflowX: 'auto' }} mb="xl">
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th ta="center">Day</Table.Th>
                <Table.Th ta="right">Receipt</Table.Th>
                <Table.Th ta="right">Progressive Receipt</Table.Th>
                <Table.Th ta="right">Payment</Table.Th>
                <Table.Th ta="right">Progressive Payment</Table.Th>
                <Table.Th ta="right">Balance</Table.Th>
                <Table.Th>Description</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {/* Opening Balance */}
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                <Table.Td colSpan={5} fw={600}>Opening Balance</Table.Td>
                <Table.Td ta="right" fw={600}>{formatNumber(reportData.openingBalance)}</Table.Td>
                <Table.Td>Brought Forward</Table.Td>
              </Table.Tr>

              {/* Month-wise transactions */}
              {Object.keys(groupedByMonth).map((monthYear, idx) => {
                const monthTransactions = groupedByMonth[monthYear];

                return (
                  <Table.Tbody key={idx}>
                    {/* Month Header */}
                    <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                      <Table.Td colSpan={7} fw={600} ta="center">{monthYear}</Table.Td>
                    </Table.Tr>

                    {/* Transactions for this month */}
                    {monthTransactions.map((transaction, tIdx) => (
                      <Table.Tr key={tIdx}>
                        <Table.Td ta="center">{formatDay(transaction.date)}</Table.Td>
                        <Table.Td ta="right">
                          {transaction.receipt > 0 ? formatNumber(transaction.receipt) : ''}
                        </Table.Td>
                        <Table.Td ta="right">
                          {transaction.receipt > 0 ? formatNumber(transaction.progressiveReceipt) : ''}
                        </Table.Td>
                        <Table.Td ta="right">
                          {transaction.payment > 0 ? formatNumber(transaction.payment) : ''}
                        </Table.Td>
                        <Table.Td ta="right">
                          {transaction.payment > 0 ? formatNumber(transaction.progressivePayment) : ''}
                        </Table.Td>
                        <Table.Td ta="right" fw={500}>{formatNumber(transaction.runningBalance)}</Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {transaction.particulars}
                            {transaction.narration && ` - ${transaction.narration}`}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                );
              })}

              {/* Closing Balance */}
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                <Table.Td colSpan={5} fw={600}>Closing Balance</Table.Td>
                <Table.Td ta="right" fw={600}>
                  {formatNumber(processedTransactions[processedTransactions.length - 1]?.runningBalance || reportData.closingBalance)}
                </Table.Td>
                <Table.Td>Carried Forward</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Box>

        {/* Report Footer */}
        <Divider my="md" />
        <Stack gap="md">
          <Text size="sm" c="dimmed" ta="center">
            Created on {dayjs().format('DD/MM/YYYY HH:mm:ss')} | By ADM
          </Text>
          <Group justify="space-between" mt="md">
            <Box style={{ flex: 1 }}>
              <Text size="sm" fw={500} ta="center">Secretary</Text>
              <Divider mt="xs" />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text size="sm" fw={500} ta="center">Cashier</Text>
              <Divider mt="xs" />
            </Box>
          </Group>
        </Stack>
      </Paper>
    );
  };

  return (
    <Container size="xl" py="md">
      {/* Control Panel */}
      <Card shadow="sm" padding="lg" radius="md" mb="xl">
        <Stack gap="lg">
          <Group justify="space-between">
            <Title order={2}>General Ledger Report</Title>
            <ActionIcon variant="light" onClick={fetchLedgers} title="Refresh ledgers">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          <Grid gutter="md">
            {/* Society Name */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Society Name"
                value={societyName}
                onChange={(e) => setSocietyName(e.target.value)}
                placeholder="Enter society name"
                leftSection={<IconBuilding size={16} />}
              />
            </Grid.Col>

            {/* Ledger Selection */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Select Ledger Account"
                value={selectedLedger}
                onChange={setSelectedLedger}
                placeholder="-- Select Ledger --"
                data={ledgers.map(ledger => ({
                  value: ledger._id,
                  label: `${ledger.ledgerName} (${ledger.ledgerType})`
                }))}
                searchable
                clearable
              />
            </Grid.Col>

            {/* Date Range */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <DateInput
                label="From Date"
                value={dateRange.startDate}
                onChange={(date) => setDateRange({ ...dateRange, startDate: date })}
                maxDate={dateRange.endDate}
                leftSection={<IconCalendar size={16} />}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <DateInput
                label="To Date"
                value={dateRange.endDate}
                onChange={(date) => setDateRange({ ...dateRange, endDate: date })}
                minDate={dateRange.startDate}
                leftSection={<IconCalendar size={16} />}
              />
            </Grid.Col>
          </Grid>

          {/* Action Buttons */}
          <Group justify="flex-start" mt="md">
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={fetchReport}
              loading={loading}
              disabled={!selectedLedger || !dateRange.startDate || !dateRange.endDate}
            >
              Generate Report
            </Button>
            
            {reportData && (
              <>
                <Button
                  leftSection={<IconPrinter size={16} />}
                  onClick={handlePrint}
                  variant="light"
                  color="blue"
                >
                  Print Report
                </Button>
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExport}
                  variant="light"
                  color="green"
                >
                  Export CSV
                </Button>
              </>
            )}
          </Group>
        </Stack>
      </Card>

      {/* Report Display */}
      {loading && (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg" fw={500}>Loading general ledger...</Text>
          </Stack>
        </Center>
      )}

      {!loading && reportData && renderLedgerReport()}

      {!loading && !reportData && (
        <Card withBorder>
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconCalendar size={48} color="var(--mantine-color-gray-4)" />
              <Text size="lg" c="dimmed">
                Select ledger account and date range to generate report
              </Text>
            </Stack>
          </Center>
        </Card>
      )}
    </Container>
  );
};

export default GeneralLedger;