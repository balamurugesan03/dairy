import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { paymentAPI, farmerAPI } from '../../services/api';
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
  Grid
} from '@mantine/core';
import { IconMilk, IconCurrencyRupee, IconUsers, IconCalendar } from '@tabler/icons-react';

const MilkBillAbstract = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [farmers, setFarmers] = useState([]);

  // Check if coming from journal voucher
  const fromJournal = searchParams.get('from') === 'journal';
  const journalDate = searchParams.get('date');

  useEffect(() => {
    fetchFarmers();
    // If coming from journal with a date, auto-fetch
    if (fromJournal && journalDate) {
      const startDate = dayjs(journalDate).startOf('month').format('YYYY-MM-DD');
      const endDate = dayjs(journalDate).endOf('month').format('YYYY-MM-DD');
      fetchReport({ startDate, endDate });
    }
  }, [fromJournal, journalDate]);

  const fetchFarmers = async () => {
    try {
      const response = await farmerAPI.getAll();
      setFarmers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch farmers:', error);
    }
  };

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const response = await paymentAPI.getAll({
        startDate: filterData.startDate,
        endDate: filterData.endDate
      });

      // Process data for abstract report
      const payments = response.data || [];
      const abstractData = processPaymentsForAbstract(payments, filterData);
      setReportData(abstractData);
    } catch (error) {
      message.error(error.message || 'Failed to fetch milk bill abstract');
    } finally {
      setLoading(false);
    }
  };

  const processPaymentsForAbstract = (payments, filterData) => {
    // Group payments by farmer
    const farmerMap = new Map();

    payments.forEach(payment => {
      if (payment.status === 'Cancelled') return;

      const farmerId = payment.farmerId?._id || payment.farmerId;
      const farmerName = payment.farmerId?.name || payment.farmerName || 'Unknown';
      const farmerNumber = payment.farmerId?.farmerNumber || payment.farmerNumber || '-';

      if (!farmerMap.has(farmerId)) {
        farmerMap.set(farmerId, {
          farmerId,
          farmerNumber,
          farmerName,
          totalMilkQty: 0,
          totalAmount: 0,
          totalDeductions: 0,
          netAmount: 0,
          paymentCount: 0,
          avgRate: 0
        });
      }

      const farmerData = farmerMap.get(farmerId);
      farmerData.totalMilkQty += parseFloat(payment.totalMilkQuantity || 0);
      farmerData.totalAmount += parseFloat(payment.grossAmount || payment.totalAmount || 0);
      farmerData.totalDeductions += parseFloat(payment.totalDeductions || 0);
      farmerData.netAmount += parseFloat(payment.netPayable || payment.netAmount || 0);
      farmerData.paymentCount += 1;
    });

    // Calculate average rate and convert to array
    const abstract = Array.from(farmerMap.values()).map(farmer => {
      farmer.avgRate = farmer.totalMilkQty > 0
        ? farmer.totalAmount / farmer.totalMilkQty
        : 0;
      return farmer;
    });

    // Sort by farmer number
    abstract.sort((a, b) => {
      const numA = parseInt(a.farmerNumber) || 0;
      const numB = parseInt(b.farmerNumber) || 0;
      return numA - numB;
    });

    // Calculate totals
    const summary = {
      totalFarmers: abstract.length,
      totalMilkQty: abstract.reduce((sum, f) => sum + f.totalMilkQty, 0),
      totalGrossAmount: abstract.reduce((sum, f) => sum + f.totalAmount, 0),
      totalDeductions: abstract.reduce((sum, f) => sum + f.totalDeductions, 0),
      totalNetAmount: abstract.reduce((sum, f) => sum + f.netAmount, 0),
      totalPayments: abstract.reduce((sum, f) => sum + f.paymentCount, 0)
    };

    return {
      abstract,
      summary,
      startDate: filterData.startDate,
      endDate: filterData.endDate
    };
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

  const exportData = reportData?.abstract.map((item, index) => ({
    'S.No': index + 1,
    'Farmer No': item.farmerNumber,
    'Farmer Name': item.farmerName,
    'Total Milk (Ltr)': item.totalMilkQty.toFixed(2),
    'Avg Rate': item.avgRate.toFixed(2),
    'Gross Amount': item.totalAmount.toFixed(2),
    'Deductions': item.totalDeductions.toFixed(2),
    'Net Amount': item.netAmount.toFixed(2),
    'No. of Payments': item.paymentCount
  })) || [];

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Milk Bill Abstract"
        subtitle={reportData
          ? `Period: ${formatDate(reportData.startDate)} to ${formatDate(reportData.endDate)}`
          : 'Summary of milk payments by farmer'
        }
        icon={<IconMilk size={28} />}
      />

      {fromJournal && (
        <Paper p="sm" mb="md" withBorder bg="blue.0">
          <Group spacing="xs">
            <Badge color="blue" variant="filled">From Journal Voucher</Badge>
            <Text size="sm">Showing milk bill abstract for the selected period</Text>
          </Group>
        </Paper>
      )}

      <DateFilterToolbar onFilterChange={handleFilterChange} />

      <Paper p="lg" withBorder shadow="sm" mt="md" pos="relative">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && (
          <>
            {/* Summary Cards */}
            <Grid mb="lg">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="blue.0">
                  <Group spacing="xs">
                    <IconUsers size={24} color="var(--mantine-color-blue-6)" />
                    <div>
                      <Text size="xs" color="dimmed">Total Farmers</Text>
                      <Text size="xl" weight={700} color="blue">
                        {reportData.summary.totalFarmers}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="cyan.0">
                  <Group spacing="xs">
                    <IconMilk size={24} color="var(--mantine-color-cyan-6)" />
                    <div>
                      <Text size="xs" color="dimmed">Total Milk (Ltr)</Text>
                      <Text size="xl" weight={700} color="cyan">
                        {formatCurrency(reportData.summary.totalMilkQty)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="green.0">
                  <Group spacing="xs">
                    <IconCurrencyRupee size={24} color="var(--mantine-color-green-6)" />
                    <div>
                      <Text size="xs" color="dimmed">Gross Amount</Text>
                      <Text size="xl" weight={700} color="green">
                        {formatCurrency(reportData.summary.totalGrossAmount)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card p="md" withBorder bg="teal.0">
                  <Group spacing="xs">
                    <IconCurrencyRupee size={24} color="var(--mantine-color-teal-6)" />
                    <div>
                      <Text size="xs" color="dimmed">Net Payable</Text>
                      <Text size="xl" weight={700} color="teal">
                        {formatCurrency(reportData.summary.totalNetAmount)}
                      </Text>
                    </div>
                  </Group>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Report Header */}
            <Paper p="md" mb="md" withBorder bg="gray.0">
              <Stack spacing="xs" align="center">
                <Title order={3}>MILK BILL ABSTRACT</Title>
                <Text size="sm" color="dimmed">
                  For the period from {formatDate(reportData.startDate)} to {formatDate(reportData.endDate)}
                </Text>
              </Stack>
            </Paper>

            {/* Abstract Table */}
            <ScrollArea>
              <Table striped highlightOnHover withBorder withColumnBorders>
                <thead>
                  <tr style={{ backgroundColor: 'var(--mantine-color-blue-1)' }}>
                    <th style={{ textAlign: 'center', width: '60px' }}>S.No</th>
                    <th style={{ textAlign: 'center', width: '100px' }}>Farmer No</th>
                    <th>Farmer Name</th>
                    <th style={{ textAlign: 'right' }}>Milk Qty (Ltr)</th>
                    <th style={{ textAlign: 'right' }}>Avg Rate</th>
                    <th style={{ textAlign: 'right' }}>Gross Amount</th>
                    <th style={{ textAlign: 'right' }}>Deductions</th>
                    <th style={{ textAlign: 'right' }}>Net Amount</th>
                    <th style={{ textAlign: 'center' }}>Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.abstract.map((item, index) => (
                    <tr key={item.farmerId}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge variant="outline" color="blue">{item.farmerNumber}</Badge>
                      </td>
                      <td>{item.farmerName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatCurrency(item.totalMilkQty)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {formatCurrency(item.avgRate)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                        {formatCurrency(item.totalAmount)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                        {formatCurrency(item.totalDeductions)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--mantine-color-teal-7)' }}>
                        {formatCurrency(item.netAmount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge size="sm" color="gray">{item.paymentCount}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--mantine-color-blue-1)', fontWeight: 700 }}>
                    <td colSpan={3} style={{ textAlign: 'right', paddingRight: '16px' }}>
                      TOTAL ({reportData.summary.totalFarmers} Farmers)
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatCurrency(reportData.summary.totalMilkQty)}
                    </td>
                    <td style={{ textAlign: 'right' }}>-</td>
                    <td style={{ textAlign: 'right', color: 'var(--mantine-color-green-7)' }}>
                      {formatCurrency(reportData.summary.totalGrossAmount)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--mantine-color-red-6)' }}>
                      {formatCurrency(reportData.summary.totalDeductions)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--mantine-color-teal-7)' }}>
                      {formatCurrency(reportData.summary.totalNetAmount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {reportData.summary.totalPayments}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </ScrollArea>

            {/* Export Section */}
            <Divider my="lg" />
            <Group position="right" spacing="md">
              <ExportButton
                data={exportData}
                filename={`milk_bill_abstract_${formatDate(reportData.startDate)}_to_${formatDate(reportData.endDate)}`}
                buttonText="Export to Excel"
              />
              <button
                className="print-button"
                onClick={() => window.print()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--mantine-color-gray-1)',
                  border: '1px solid var(--mantine-color-gray-4)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Print Report
              </button>
            </Group>
          </>
        )}

        {!reportData && !loading && (
          <Stack align="center" py="xl">
            <IconMilk size={64} color="gray" opacity={0.5} />
            <Text color="dimmed" size="lg">
              Please select a date range to view the milk bill abstract
            </Text>
          </Stack>
        )}
      </Paper>
    </Container>
  );
};

export default MilkBillAbstract;
