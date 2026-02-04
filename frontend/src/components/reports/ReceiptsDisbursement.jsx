import React, { useState } from 'react';
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
  Button,
  SegmentedControl
} from '@mantine/core';
import {
  IconReceipt,
  IconCurrencyRupee,
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconPrinter
} from '@tabler/icons-react';

const ReceiptsDisbursement = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [format, setFormat] = useState('singleColumnMonthly');
  const [currentFilter, setCurrentFilter] = useState(null);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await reportAPI.rdEnhanced({
        ...filterData,
        format
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch R&D report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    setCurrentFilter(filterData);
    fetchReport(filterData);
  };

  const handleFormatChange = (newFormat) => {
    setFormat(newFormat);
    if (reportData && currentFilter) {
      fetchReport(currentFilter);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  // Calculate closing balance: Opening + Receipts - Payments
  const openingBalance = reportData?.openingBalance || 0;
  const totalReceipts = reportData?.summary?.totalReceipts || 0;
  const totalPayments = reportData?.summary?.totalPayments || 0;
  const closingBalance = openingBalance + totalReceipts - totalPayments;

  const renderSingleColumnMonthly = () => {
    if (!reportData.formatted?.sections) return null;

    return (
      <Paper p="md" withBorder>
        <Stack gap="xs" align="center" mb="md">
          <Title order={4}>RECEIPT AND DISBURSEMENT ACCOUNT</Title>
          <Text size="sm" c="dimmed">
            For the month of {dayjs(reportData.startDate).format('MMMM YYYY')}
          </Text>
        </Stack>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}>
                <Table.Th>Ledger / Description</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '150px' }}>Receipt (₹)</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '150px' }}>Payment (₹)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {reportData.formatted.sections.map((section, sectionIdx) => (
                <React.Fragment key={`section-${sectionIdx}`}>
                  {/* Section Header */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                    <Table.Td colSpan={3}>
                      <Text fw={700}>{section.sectionName}</Text>
                    </Table.Td>
                  </Table.Tr>

                  {/* Ledger Rows */}
                  {section.ledgers.map((ledger, ledgerIdx) => (
                    <Table.Tr key={`ledger-${sectionIdx}-${ledgerIdx}`}>
                      <Table.Td style={{ paddingLeft: '2rem' }}>{ledger.ledgerName}</Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                        ₹{formatCurrency(ledger.receipt)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                        ₹{formatCurrency(ledger.payment)}
                      </Table.Td>
                    </Table.Tr>
                  ))}

                  {/* Group Total */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    <Table.Td><Text fw={600}>Account Group Total</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                      <Text fw={600}>₹{formatCurrency(section.groupTotal.receipt)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                      <Text fw={600}>₹{formatCurrency(section.groupTotal.payment)}</Text>
                    </Table.Td>
                  </Table.Tr>
                </React.Fragment>
              ))}

              {/* Grand Total */}
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-2)' }}>
                <Table.Td><Text fw={700}>GRAND TOTAL</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                  <Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.receipt)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                  <Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.payment)}</Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </ScrollArea>

        <Group justify="space-between" mt="md">
          <Text size="xs" c="dimmed">Created on {dayjs().format('DD/MM/YYYY hh:mm A')} by ERP System</Text>
          <Text size="xs" c="dimmed">This is a computer-generated report</Text>
        </Group>
      </Paper>
    );
  };

  const renderThreeColumnLedgerwise = () => {
    if (!reportData.formatted?.sections) return null;

    return (
      <Paper p="md" withBorder>
        <Stack gap="xs" align="center" mb="md">
          <Title order={4}>RECEIPTS & DISBURSEMENT ACCOUNT</Title>
          <Text size="sm" fw={500}>Three Column Ledger-wise Format</Text>
          <Text size="sm" c="dimmed">
            For the period: {formatDate(reportData.startDate)} to {formatDate(reportData.endDate)}
          </Text>
        </Stack>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th rowSpan={2}>Ledger / Particulars</Table.Th>
                <Table.Th colSpan={3} style={{ textAlign: 'center', backgroundColor: 'var(--mantine-color-green-1)' }}>Receipt (₹)</Table.Th>
                <Table.Th colSpan={3} style={{ textAlign: 'center', backgroundColor: 'var(--mantine-color-red-1)' }}>Payment (₹)</Table.Th>
              </Table.Tr>
              <Table.Tr>
                <Table.Th style={{ textAlign: 'right', width: '110px', backgroundColor: 'var(--mantine-color-green-0)' }}>Upto Month</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '110px', backgroundColor: 'var(--mantine-color-green-0)' }}>During Month</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '110px', backgroundColor: 'var(--mantine-color-green-0)' }}>End of Month</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '110px', backgroundColor: 'var(--mantine-color-red-0)' }}>Upto Month</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '110px', backgroundColor: 'var(--mantine-color-red-0)' }}>During Month</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '110px', backgroundColor: 'var(--mantine-color-red-0)' }}>End of Month</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {reportData.formatted.sections.map((section, sectionIdx) => (
                <React.Fragment key={`section-${sectionIdx}`}>
                  {/* Section Header */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                    <Table.Td colSpan={7}><Text fw={700}>{section.sectionName}</Text></Table.Td>
                  </Table.Tr>

                  {/* Ledger Rows */}
                  {section.ledgers.map((ledger, ledgerIdx) => (
                    <Table.Tr key={`ledger-${sectionIdx}-${ledgerIdx}`}>
                      <Table.Td style={{ paddingLeft: '2rem' }}>{ledger.ledgerName}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {ledger.receipt?.uptoMonth > 0 ? `₹${formatCurrency(ledger.receipt.uptoMonth)}` : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {ledger.receipt?.duringMonth > 0 ? `₹${formatCurrency(ledger.receipt.duringMonth)}` : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                        {ledger.receipt?.endOfMonth > 0 ? `₹${formatCurrency(ledger.receipt.endOfMonth)}` : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {ledger.payment?.uptoMonth > 0 ? `₹${formatCurrency(ledger.payment.uptoMonth)}` : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {ledger.payment?.duringMonth > 0 ? `₹${formatCurrency(ledger.payment.duringMonth)}` : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                        {ledger.payment?.endOfMonth > 0 ? `₹${formatCurrency(ledger.payment.endOfMonth)}` : '-'}
                      </Table.Td>
                    </Table.Tr>
                  ))}

                  {/* Group Total */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    <Table.Td><Text fw={600}>Group Total - {section.sectionName}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>₹{formatCurrency(section.groupTotal.receipt?.uptoMonth || 0)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>₹{formatCurrency(section.groupTotal.receipt?.duringMonth || 0)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>₹{formatCurrency(section.groupTotal.receipt?.endOfMonth || 0)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>₹{formatCurrency(section.groupTotal.payment?.uptoMonth || 0)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>₹{formatCurrency(section.groupTotal.payment?.duringMonth || 0)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>₹{formatCurrency(section.groupTotal.payment?.endOfMonth || 0)}</Text></Table.Td>
                  </Table.Tr>
                </React.Fragment>
              ))}

              {/* Grand Total */}
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-2)' }}>
                <Table.Td><Text fw={700}>GRAND TOTAL</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.receipt?.uptoMonth || 0)}</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.receipt?.duringMonth || 0)}</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.receipt?.endOfMonth || 0)}</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.payment?.uptoMonth || 0)}</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.payment?.duringMonth || 0)}</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>₹{formatCurrency(reportData.formatted.grandTotal.payment?.endOfMonth || 0)}</Text></Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </ScrollArea>

        <Group justify="space-between" mt="md">
          <Text size="xs" c="dimmed">Created on {dayjs().format('DD/MM/YYYY hh:mm A')} | By ADM</Text>
          <Text size="xs" c="dimmed">Page 1 of 1</Text>
        </Group>
      </Paper>
    );
  };

  const renderTwoColumnFormat = () => {
    if (!reportData.formatted?.sections) return null;

    const monthYear = dayjs(reportData.startDate).format('MMMM-YYYY').toUpperCase();

    return (
      <Paper p="md" withBorder>
        <Stack gap="xs" align="center" mb="md">
          <Title order={4}>RECEIPT AND DISBURSEMENT FOR THE MONTH {monthYear}</Title>
          <Text size="sm" c="dimmed">End of the Month</Text>
        </Stack>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th rowSpan={2}>Ledger</Table.Th>
                <Table.Th colSpan={3} style={{ textAlign: 'center', backgroundColor: 'var(--mantine-color-green-1)' }}>Receipt (₹)</Table.Th>
                <Table.Th colSpan={3} style={{ textAlign: 'center', backgroundColor: 'var(--mantine-color-red-1)' }}>Payment (₹)</Table.Th>
              </Table.Tr>
              <Table.Tr>
                <Table.Th style={{ textAlign: 'right', width: '100px', backgroundColor: 'var(--mantine-color-green-0)' }}>Adjustment</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '100px', backgroundColor: 'var(--mantine-color-green-0)' }}>Cash</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '100px', backgroundColor: 'var(--mantine-color-green-2)' }}>Total</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '100px', backgroundColor: 'var(--mantine-color-red-0)' }}>Adjustment</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '100px', backgroundColor: 'var(--mantine-color-red-0)' }}>Cash</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: '100px', backgroundColor: 'var(--mantine-color-red-2)' }}>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {reportData.formatted.sections.map((section, sectionIdx) => (
                <React.Fragment key={`section-${sectionIdx}`}>
                  {/* Section Header */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                    <Table.Td colSpan={7}><Text fw={700}>{section.sectionName}</Text></Table.Td>
                  </Table.Tr>

                  {/* Ledger Rows */}
                  {section.ledgers.map((ledger, ledgerIdx) => {
                    const receiptAdj = parseFloat(ledger.receipt?.adjustment || 0);
                    const receiptCash = parseFloat(ledger.receipt?.cash || ledger.receipt || 0);
                    const receiptTotal = parseFloat(ledger.receipt?.total || ledger.receipt || 0);
                    const paymentAdj = parseFloat(ledger.payment?.adjustment || 0);
                    const paymentCash = parseFloat(ledger.payment?.cash || ledger.payment || 0);
                    const paymentTotal = parseFloat(ledger.payment?.total || ledger.payment || 0);

                    return (
                      <Table.Tr key={`ledger-${sectionIdx}-${ledgerIdx}`}>
                        <Table.Td>{ledger.ledgerName}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(receiptAdj)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(receiptCash)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)', fontWeight: 500 }}>{formatCurrency(receiptTotal)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(paymentAdj)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(paymentCash)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)', fontWeight: 500 }}>{formatCurrency(paymentTotal)}</Table.Td>
                      </Table.Tr>
                    );
                  })}

                  {/* Account Group Total */}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    <Table.Td><Text fw={600}>Account Group Total</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600}>{formatCurrency(section.groupTotal.receipt?.adjustment || 0)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600}>{formatCurrency(section.groupTotal.receipt?.cash || section.groupTotal.receipt || 0)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600}>{formatCurrency(section.groupTotal.receipt?.total || section.groupTotal.receipt || 0)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600}>{formatCurrency(section.groupTotal.payment?.adjustment || 0)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600}>{formatCurrency(section.groupTotal.payment?.cash || section.groupTotal.payment || 0)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600}>{formatCurrency(section.groupTotal.payment?.total || section.groupTotal.payment || 0)}</Text>
                    </Table.Td>
                  </Table.Tr>
                </React.Fragment>
              ))}

              {/* Grand Total */}
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-2)' }}>
                <Table.Td><Text fw={700}>GRAND TOTAL</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700}>{formatCurrency(reportData.formatted.grandTotal.receipt?.adjustment || 0)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700}>{formatCurrency(reportData.formatted.grandTotal.receipt?.cash || reportData.formatted.grandTotal.receipt || 0)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700}>{formatCurrency(reportData.formatted.grandTotal.receipt?.total || reportData.formatted.grandTotal.receipt || 0)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700}>{formatCurrency(reportData.formatted.grandTotal.payment?.adjustment || 0)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700}>{formatCurrency(reportData.formatted.grandTotal.payment?.cash || reportData.formatted.grandTotal.payment || 0)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700}>{formatCurrency(reportData.formatted.grandTotal.payment?.total || reportData.formatted.grandTotal.payment || 0)}</Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </ScrollArea>

        <Group justify="space-between" mt="md">
          <Text size="xs" c="dimmed">Created on {dayjs().format('DD/MM/YYYY hh:mm A')} by ERP System</Text>
          <Text size="xs" c="dimmed">This is a computer-generated report</Text>
        </Group>
      </Paper>
    );
  };

  const exportData = reportData?.receipts?.concat(reportData.payments || []).map(t => ({
    Date: formatDate(t.date),
    'Voucher No': t.voucherNumber,
    Type: t.amount > 0 ? 'Receipt' : 'Payment',
    Particulars: t.particulars,
    Amount: formatCurrency(t.amount)
  })) || [];

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Receipts & Disbursement Report"
        subtitle="Single Column Monthly and Three Column Ledger-wise formats"
        icon={<IconReceipt size={28} />}
      />

      {/* Format Selector */}
      <Paper p="md" mb="md" withBorder>
        <Group justify="center">
          <SegmentedControl
            value={format}
            onChange={handleFormatChange}
            data={[
              { label: 'Single Column Monthly', value: 'singleColumnMonthly' },
              { label: 'Three Column Ledger-wise', value: 'threeColumnLedgerwise' },
              { label: 'Two Column', value: 'twoColumn' }
            ]}
          />
        </Group>
      </Paper>

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

            {/* Report Content */}
            {format === 'singleColumnMonthly' && renderSingleColumnMonthly()}
            {format === 'threeColumnLedgerwise' && renderThreeColumnLedgerwise()}
            {format === 'twoColumn' && renderTwoColumnFormat()}

            {/* Export Section */}
            <Divider my="lg" />
            <Group justify="flex-end" gap="md">
              <ExportButton
                data={exportData}
                filename={`receipts_disbursement_${reportData.startDate && formatDate(reportData.startDate)}_to_${reportData.endDate && formatDate(reportData.endDate)}`}
                buttonText="Export R&D Report"
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
            <IconReceipt size={64} color="gray" opacity={0.5} />
            <Text c="dimmed" size="lg">
              Please select a date range to view the receipts & disbursement report
            </Text>
          </Stack>
        )}
      </Paper>
    </Container>
  );
};

export default ReceiptsDisbursement;
