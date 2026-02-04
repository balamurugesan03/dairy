import { useState } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
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
  Button
} from '@mantine/core';
import {
  IconCash,
  IconCurrencyRupee,
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconPrinter
} from '@tabler/icons-react';

const CashBook = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.cashBook(filterData);
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cash book');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (date) => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  // Calculate closing balance: Opening + Receipts - Payments
  const openingBalance = reportData?.openingBalance || 0;
  const totalReceipts = reportData?.summary?.totalReceipts || 0;
  const totalPayments = reportData?.summary?.totalPayments || 0;
  const closingBalance = openingBalance + totalReceipts - totalPayments;

  const exportData = reportData?.transactions?.map(t => ({
    Date: formatDate(t.date),
    Description: t.particulars,
    'Receipt No': t.debit > 0 ? t.voucherNumber : '',
    'Receipt Amount': t.debit > 0 ? t.debit.toFixed(2) : '',
    'Voucher No': t.credit > 0 ? t.voucherNumber : '',
    'Payment Amount': t.credit > 0 ? t.credit.toFixed(2) : '',
    Narration: t.narration || ''
  })) || [];

  // Separate receipts and payments for display
  const receiptTransactions = reportData?.transactions?.filter(t => t.debit > 0) || [];
  const paymentTransactions = reportData?.transactions?.filter(t => t.credit > 0) || [];

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Cash Book"
        subtitle="Traditional double-sided cash book format"
        icon={<IconCash size={28} />}
      />

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      <Paper p="lg" withBorder shadow="sm" mt="md" pos="relative">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && (
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
                <Title order={3}>CASH BOOK</Title>
                <Text size="sm" c="dimmed">
                  For the period from {reportData.startDate && formatDate(reportData.startDate)} to {reportData.endDate && formatDate(reportData.endDate)}
                </Text>
              </Stack>
            </Paper>

            {/* Traditional Cash Book Table */}
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th rowSpan={2} style={{ textAlign: 'center', width: '100px', backgroundColor: 'var(--mantine-color-green-1)' }}>Date</Table.Th>
                    <Table.Th rowSpan={2} style={{ backgroundColor: 'var(--mantine-color-green-1)' }}>Description</Table.Th>
                    <Table.Th colSpan={2} style={{ textAlign: 'center', backgroundColor: 'var(--mantine-color-green-2)' }}>Receipt</Table.Th>
                    <Table.Th rowSpan={2} style={{ textAlign: 'center', width: '100px', backgroundColor: 'var(--mantine-color-red-1)' }}>Date</Table.Th>
                    <Table.Th rowSpan={2} style={{ backgroundColor: 'var(--mantine-color-red-1)' }}>Description</Table.Th>
                    <Table.Th colSpan={2} style={{ textAlign: 'center', backgroundColor: 'var(--mantine-color-red-2)' }}>Payment</Table.Th>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th style={{ textAlign: 'center', width: '100px', backgroundColor: 'var(--mantine-color-green-1)' }}>Rec. No</Table.Th>
                    <Table.Th style={{ textAlign: 'right', width: '120px', backgroundColor: 'var(--mantine-color-green-1)' }}>Cash</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: '100px', backgroundColor: 'var(--mantine-color-red-1)' }}>Vouch. No</Table.Th>
                    <Table.Th style={{ textAlign: 'right', width: '120px', backgroundColor: 'var(--mantine-color-red-1)' }}>Cash</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {/* Opening Balance Row */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                    <Table.Td></Table.Td>
                    <Table.Td><Text fw={700}>To Balance b/d (Opening)</Text></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={700} c="blue">₹{formatCurrency(openingBalance)}</Text>
                    </Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                  </Table.Tr>

                  {/* Transactions */}
                  {reportData.transactions?.map((transaction, idx) => {
                    const isReceipt = transaction.debit > 0;
                    const isPayment = transaction.credit > 0;

                    return (
                      <Table.Tr key={idx}>
                        {/* Receipt side */}
                        {isReceipt ? (
                          <>
                            <Table.Td>{formatDate(transaction.date)}</Table.Td>
                            <Table.Td>
                              <Text fw={500}>{transaction.particulars}</Text>
                              {transaction.narration && (
                                <Text size="xs" c="dimmed">{transaction.narration}</Text>
                              )}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Badge size="sm" variant="light" color="green">
                                {transaction.voucherNumber}
                              </Badge>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                              ₹{formatCurrency(transaction.debit)}
                            </Table.Td>
                          </>
                        ) : (
                          <>
                            <Table.Td></Table.Td>
                            <Table.Td></Table.Td>
                            <Table.Td></Table.Td>
                            <Table.Td></Table.Td>
                          </>
                        )}

                        {/* Payment side */}
                        {isPayment ? (
                          <>
                            <Table.Td>{formatDate(transaction.date)}</Table.Td>
                            <Table.Td>
                              <Text fw={500}>{transaction.particulars}</Text>
                              {transaction.narration && (
                                <Text size="xs" c="dimmed">{transaction.narration}</Text>
                              )}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Badge size="sm" variant="light" color="red">
                                {transaction.voucherNumber}
                              </Badge>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                              ₹{formatCurrency(transaction.credit)}
                            </Table.Td>
                          </>
                        ) : (
                          <>
                            <Table.Td></Table.Td>
                            <Table.Td></Table.Td>
                            <Table.Td></Table.Td>
                            <Table.Td></Table.Td>
                          </>
                        )}
                      </Table.Tr>
                    );
                  })}

                  {/* Closing Balance Row */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-teal-0)' }}>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td><Text fw={700}>By Balance c/d (Closing)</Text></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={700} c="teal">₹{formatCurrency(closingBalance)}</Text>
                    </Table.Td>
                  </Table.Tr>

                  {/* Grand Total Row */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-2)' }}>
                    <Table.Td></Table.Td>
                    <Table.Td><Text fw={700}>Total</Text></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={700}>₹{formatCurrency(openingBalance + totalReceipts)}</Text>
                    </Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td><Text fw={700}>Total</Text></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={700}>₹{formatCurrency(closingBalance + totalPayments)}</Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {/* Export Section */}
            <Divider my="lg" />
            <Group justify="flex-end" gap="md">
              <ExportButton
                data={exportData}
                filename={`cash_book_${reportData.startDate && formatDate(reportData.startDate)}_to_${reportData.endDate && formatDate(reportData.endDate)}`}
                buttonText="Export Cash Book"
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

        {!reportData && !loading && (
          <Stack align="center" py="xl">
            <IconCash size={64} color="gray" opacity={0.5} />
            <Text c="dimmed" size="lg">
              Please select a date range to view the cash book
            </Text>
          </Stack>
        )}
      </Paper>
    </Container>
  );
};

export default CashBook;
