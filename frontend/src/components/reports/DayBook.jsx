import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { dayBookAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import ExportButton from '../common/ExportButton';
import {
  Container,
  Paper,
  Table,
  ScrollArea,
  Text,
  Group,
  Badge,
  Card,
  Stack,
  LoadingOverlay,
  Title,
  Divider,
  Grid,
  SimpleGrid,
  Button,
  Box
} from '@mantine/core';
import {
  IconBook,
  IconCurrencyRupee,
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconPrinter
} from '@tabler/icons-react';

const DayBook = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('month').format('YYYY-MM-DD')
  });
  const [dayBookData, setDayBookData] = useState(null);

  useEffect(() => {
    fetchDayBook();
  }, []);

  const fetchDayBook = async () => {
    setLoading(true);
    try {
      const response = await dayBookAPI.get(dateRange);
      setDayBookData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch day book');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    setDateRange({
      startDate: filterData.customStart || filterData.startDate || dateRange.startDate,
      endDate: filterData.customEnd || filterData.endDate || dateRange.endDate
    });
    fetchDayBook();
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  // Calculate closing balance: Opening + Receipts - Payments
  const openingBalance = dayBookData?.summary?.openingBalance || 0;
  const totalReceipts = dayBookData?.summary?.totalReceipts || 0;
  const totalPayments = dayBookData?.summary?.totalPayments || 0;
  const closingBalance = openingBalance + totalReceipts - totalPayments;

  const exportData = [
    ...(dayBookData?.receiptSide || []).map(entry => ({
      'Date': formatDate(entry.date),
      'Type': 'Receipt',
      'Voucher No': entry.voucherNumber,
      'Particulars': entry.ledgerName,
      'Narration': entry.narration || '',
      'Receipt': entry.amount.toFixed(2),
      'Payment': ''
    })),
    ...(dayBookData?.paymentSide || []).map(entry => ({
      'Date': formatDate(entry.date),
      'Type': 'Payment',
      'Voucher No': entry.voucherNumber,
      'Particulars': entry.ledgerName,
      'Narration': entry.narration || '',
      'Receipt': '',
      'Payment': entry.amount.toFixed(2)
    }))
  ];

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Day Book"
        subtitle="Complete transaction register with receipts and payments"
        icon={<IconBook size={28} />}
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      <Paper p="lg" withBorder shadow="sm" mt="md" pos="relative">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {dayBookData && !loading && (
          <>
            {/* Summary Cards - Opening Balance + Receipt - Payment = Closing Balance */}
            <Grid mb="lg">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="blue.0">
                  <Group gap="xs">
                    <IconWallet size={24} color="var(--mantine-color-blue-6)" />
                    <div>
                      <Text size="xs" c="dimmed">Opening Balance</Text>
                      <Text size="xl" fw={700} c="blue">
                        ₹{formatCurrency(openingBalance)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="green.0">
                  <Group gap="xs">
                    <IconArrowUpRight size={24} color="var(--mantine-color-green-6)" />
                    <div>
                      <Text size="xs" c="dimmed">Total Receipts (+)</Text>
                      <Text size="xl" fw={700} c="green">
                        ₹{formatCurrency(totalReceipts)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="red.0">
                  <Group gap="xs">
                    <IconArrowDownRight size={24} color="var(--mantine-color-red-6)" />
                    <div>
                      <Text size="xs" c="dimmed">Total Payments (-)</Text>
                      <Text size="xl" fw={700} c="red">
                        ₹{formatCurrency(totalPayments)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="teal.0">
                  <Group gap="xs">
                    <IconCurrencyRupee size={24} color="var(--mantine-color-teal-6)" />
                    <div>
                      <Text size="xs" c="dimmed">Closing Balance</Text>
                      <Text size="xl" fw={700} c="teal">
                        ₹{formatCurrency(closingBalance)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Formula Display */}
            <Paper p="sm" mb="lg" withBorder bg="gray.0">
              <Group justify="center" gap="xs">
                <Badge size="lg" variant="light" color="blue">Opening: ₹{formatCurrency(openingBalance)}</Badge>
                <Text fw={700}>+</Text>
                <Badge size="lg" variant="light" color="green">Receipts: ₹{formatCurrency(totalReceipts)}</Badge>
                <Text fw={700}>-</Text>
                <Badge size="lg" variant="light" color="red">Payments: ₹{formatCurrency(totalPayments)}</Badge>
                <Text fw={700}>=</Text>
                <Badge size="lg" variant="filled" color="teal">Closing: ₹{formatCurrency(closingBalance)}</Badge>
              </Group>
            </Paper>

            {/* Report Header */}
            <Paper p="md" mb="md" withBorder bg="gray.0">
              <Stack gap="xs" align="center">
                <Title order={3}>DAY BOOK</Title>
                <Text size="sm" c="dimmed">
                  For the period from {formatDate(dateRange.startDate)} to {formatDate(dateRange.endDate)}
                </Text>
              </Stack>
            </Paper>

            {/* Two Column Layout - Receipt and Payment Side */}
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {/* Receipt Side */}
              <Paper p="md" withBorder>
                <Title order={5} mb="md" c="green.7">
                  <Group gap="xs">
                    <IconArrowUpRight size={20} />
                    Receipt Side (Credits)
                  </Group>
                </Title>
                <ScrollArea>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr style={{ backgroundColor: 'var(--mantine-color-green-1)' }}>
                        <Table.Th style={{ width: '100px' }}>Date</Table.Th>
                        <Table.Th style={{ width: '120px' }}>Voucher No</Table.Th>
                        <Table.Th>Particulars</Table.Th>
                        <Table.Th style={{ textAlign: 'right', width: '120px' }}>Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dayBookData.receiptSide?.length > 0 ? (
                        dayBookData.receiptSide.map((entry, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{formatDate(entry.date)}</Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="light" color="green">
                                {entry.voucherNumber}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={500}>{entry.ledgerName}</Text>
                              {entry.narration && (
                                <Text size="xs" c="dimmed">{entry.narration}</Text>
                              )}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)', fontWeight: 500 }}>
                              ₹{formatCurrency(entry.amount)}
                            </Table.Td>
                          </Table.Tr>
                        ))
                      ) : (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <Text ta="center" c="dimmed" py="md">No receipt entries for the selected period</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr style={{ backgroundColor: 'var(--mantine-color-green-1)' }}>
                        <Table.Td colSpan={3}>
                          <Text fw={700}>Total Receipts</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                          <Text fw={700}>₹{formatCurrency(totalReceipts)}</Text>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </ScrollArea>
              </Paper>

              {/* Payment Side */}
              <Paper p="md" withBorder>
                <Title order={5} mb="md" c="red.7">
                  <Group gap="xs">
                    <IconArrowDownRight size={20} />
                    Payment Side (Debits)
                  </Group>
                </Title>
                <ScrollArea>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr style={{ backgroundColor: 'var(--mantine-color-red-1)' }}>
                        <Table.Th style={{ width: '100px' }}>Date</Table.Th>
                        <Table.Th style={{ width: '120px' }}>Voucher No</Table.Th>
                        <Table.Th>Particulars</Table.Th>
                        <Table.Th style={{ textAlign: 'right', width: '120px' }}>Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dayBookData.paymentSide?.length > 0 ? (
                        dayBookData.paymentSide.map((entry, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{formatDate(entry.date)}</Table.Td>
                            <Table.Td>
                              <Badge size="sm" variant="light" color="red">
                                {entry.voucherNumber}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={500}>{entry.ledgerName}</Text>
                              {entry.narration && (
                                <Text size="xs" c="dimmed">{entry.narration}</Text>
                              )}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)', fontWeight: 500 }}>
                              ₹{formatCurrency(entry.amount)}
                            </Table.Td>
                          </Table.Tr>
                        ))
                      ) : (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <Text ta="center" c="dimmed" py="md">No payment entries for the selected period</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr style={{ backgroundColor: 'var(--mantine-color-red-1)' }}>
                        <Table.Td colSpan={3}>
                          <Text fw={700}>Total Payments</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                          <Text fw={700}>₹{formatCurrency(totalPayments)}</Text>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </ScrollArea>
              </Paper>
            </SimpleGrid>

            {/* Export Section */}
            <Divider my="lg" />
            <Group justify="flex-end" gap="md">
              <ExportButton
                data={exportData}
                filename={`day_book_${formatDate(dateRange.startDate)}_to_${formatDate(dateRange.endDate)}`}
                buttonText="Export to Excel"
              />
              <Button
                variant="light"
                color="gray"
                leftSection={<IconPrinter size={16} />}
                onClick={() => window.print()}
              >
                Print Report
              </Button>
            </Group>
          </>
        )}

        {!dayBookData && !loading && (
          <Stack align="center" py="xl">
            <IconBook size={64} color="gray" opacity={0.5} />
            <Text c="dimmed" size="lg">
              Please select a date range to view the day book
            </Text>
          </Stack>
        )}
      </Paper>
    </Container>
  );
};

export default DayBook;
