import { useState, useEffect } from 'react';
import {
  Card,
  Grid,
  Group,
  Text,
  Table,
  Button,
  TextInput,
  LoadingOverlay,
  Stack,
  Paper,
  Title,
  Box
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconCalendar, IconFileExport, IconRefresh } from '@tabler/icons-react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';

const SubsidyReport = () => {
  const [loading, setLoading] = useState(false);
  const [subsidyData, setSubsidyData] = useState([]);
  const [summary, setSummary] = useState({
    totalFarmers: 0,
    totalLitres: 0,
    totalSubsidy: 0,
    totalAmount: 0
  });
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().startOf('month').toDate(),
    endDate: dayjs().endOf('month').toDate()
  });

  useEffect(() => {
    fetchSubsidyReport();
  }, []);

  const fetchSubsidyReport = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(dateRange.startDate).toISOString(),
        endDate: dayjs(dateRange.endDate).toISOString()
      };
      const response = await reportAPI.subsidy(params);

      setSubsidyData(response.data.subsidies || []);

      // Calculate summary
      const totalFarmers = response.data.subsidies?.length || 0;
      const totalLitres = response.data.subsidies?.reduce((sum, item) => sum + (item.totalLitres || 0), 0) || 0;
      const totalSubsidy = response.data.subsidies?.reduce((sum, item) => sum + (item.subsidyAmount || 0), 0) || 0;
      const totalAmount = response.data.subsidies?.reduce((sum, item) => sum + (item.totalAmount || 0), 0) || 0;

      setSummary({
        totalFarmers,
        totalLitres,
        totalSubsidy,
        totalAmount
      });
    } catch (error) {
      message.error(error.message || 'Failed to fetch subsidy report');
    } finally {
      setLoading(false);
    }
  };

  const exportData = subsidyData.map(item => ({
    'Farmer No': item.farmerNumber,
    'Farmer Name': item.farmer?.name || item.farmerName || '-',
    'Village': item.farmer?.address?.village || item.village || '-',
    'Farmer Type': item.farmer?.farmerType || item.farmerType || '-',
    'Cow Type': item.farmer?.cowType || item.cowType || '-',
    'Total Litres': (item.totalLitres || 0).toFixed(2),
    'Rate per Litre': (item.ratePerLitre || 0).toFixed(2),
    'Subsidy per Litre': (item.subsidyPerLitre || 0).toFixed(2),
    'Subsidy Amount': (item.subsidyAmount || 0).toFixed(2),
    'Total Amount': (item.totalAmount || 0).toFixed(2)
  }));

  const stats = [
    { title: 'Total Farmers', value: `#${summary.totalFarmers}`, color: 'blue' },
    { title: 'Total Litres', value: `${summary.totalLitres.toFixed(2)} L`, color: 'green' },
    { title: 'Total Subsidy', value: `₹${summary.totalSubsidy.toFixed(2)}`, color: 'orange' },
    { title: 'Total Amount', value: `₹${summary.totalAmount.toFixed(2)}`, color: 'indigo' }
  ];

  return (
    <Box p="md">
      <PageHeader
        title="Subsidy Report"
        subtitle="Farmer subsidy details and calculations"
      />

      {/* Summary Cards */}
      <Grid mb="xl">
        {stats.map((stat, index) => (
          <Grid.Col key={index} span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder radius="md" padding="xl">
              <Text size="sm" c="dimmed" fw={500} mb="xs">
                {stat.title}
              </Text>
              <Text size="xl" fw={700}>
                {stat.value}
              </Text>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {/* Report Card */}
      <Card withBorder radius="md" p={0}>
        <LoadingOverlay visible={loading} zIndex={1000} />
        
        <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Group justify="space-between" mb="md">
            <Title order={2} size="h4">Subsidy Details</Title>
          </Group>

          <Group align="flex-end" wrap="wrap" gap="md" mb="md">
            <Group gap="xs">
              <DateInput
                leftSection={<IconCalendar size={16} />}
                label="Start Date"
                value={dateRange.startDate}
                onChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
                maxDate={dateRange.endDate}
              />
              <DateInput
                leftSection={<IconCalendar size={16} />}
                label="End Date"
                value={dateRange.endDate}
                onChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
                minDate={dateRange.startDate}
              />
            </Group>
            
            <Group gap="sm">
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={fetchSubsidyReport}
                loading={loading}
              >
                Generate Report
              </Button>
              
              <ExportButton
                data={exportData}
                filename="subsidy_report"
                buttonText="Export to Excel"
                leftSection={<IconFileExport size={16} />}
              />
            </Group>
          </Group>
        </Box>

        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Farmer No</Table.Th>
                <Table.Th>Farmer Name</Table.Th>
                <Table.Th>Village</Table.Th>
                <Table.Th>Farmer Type</Table.Th>
                <Table.Th>Cow Type</Table.Th>
                <Table.Th ta="right">Total Litres</Table.Th>
                <Table.Th ta="right">Rate per Litre</Table.Th>
                <Table.Th ta="right">Subsidy per Litre</Table.Th>
                <Table.Th ta="right">Subsidy Amount</Table.Th>
                <Table.Th ta="right">Total Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {subsidyData.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10} ta="center" py="xl">
                    <Stack align="center" gap="xs">
                      <Text c="dimmed" fw={500}>No transactions found for the selected period</Text>
                      <Text c="dimmed" size="sm">
                        {dayjs(dateRange.startDate).format('DD/MM/YYYY')} - {dayjs(dateRange.endDate).format('DD/MM/YYYY')}
                      </Text>
                      <Text c="dimmed" size="xs">
                        Try selecting a different date range or check if data exists
                      </Text>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : (
                subsidyData.map((item, index) => (
                  <Table.Tr key={item.farmerNumber || item._id || index}>
                    <Table.Td>{item.farmerNumber}</Table.Td>
                    <Table.Td>{item.farmer?.name || item.farmerName || '-'}</Table.Td>
                    <Table.Td>{item.farmer?.address?.village || item.village || '-'}</Table.Td>
                    <Table.Td>{item.farmer?.farmerType || item.farmerType || '-'}</Table.Td>
                    <Table.Td>{item.farmer?.cowType || item.cowType || '-'}</Table.Td>
                    <Table.Td ta="right">{(item.totalLitres || 0).toFixed(2)} L</Table.Td>
                    <Table.Td ta="right">₹{(item.ratePerLitre || 0).toFixed(2)}</Table.Td>
                    <Table.Td ta="right">₹{(item.subsidyPerLitre || 0).toFixed(2)}</Table.Td>
                    <Table.Td ta="right">₹{(item.subsidyAmount || 0).toFixed(2)}</Table.Td>
                    <Table.Td ta="right">₹{(item.totalAmount || 0).toFixed(2)}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
            
            {subsidyData.length > 0 && (
              <Table.Tfoot>
                <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                  <Table.Td colSpan={5} ta="right" fw={600}>Total:</Table.Td>
                  <Table.Td ta="right" fw={600}>{summary.totalLitres.toFixed(2)} L</Table.Td>
                  <Table.Td></Table.Td>
                  <Table.Td></Table.Td>
                  <Table.Td ta="right" fw={600}>₹{summary.totalSubsidy.toFixed(2)}</Table.Td>
                  <Table.Td ta="right" fw={600}>₹{summary.totalAmount.toFixed(2)}</Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Box>
      </Card>
    </Box>
  );
};

export default SubsidyReport;