import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  Table,
  SegmentedControl,
  LoadingOverlay,
  Box,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Flex
} from '@mantine/core';
import {
  IconUsers,
  IconCash,
  IconReceipt,
  IconScale
} from '@tabler/icons-react';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import PageHeader from '../../common/PageHeader';
import ExportButton from '../../common/ExportButton';
import DateFilterToolbar from '../../common/DateFilterToolbar';

const VyaparAllParties = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filter, setFilter] = useState('all'); // all, customers, suppliers
  const [dateFilter, setDateFilter] = useState({
    filterType: 'thisMonth',
    customStart: null,
    customEnd: null
  });

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount and when filters change
  useEffect(() => {
    fetchReport();
  }, [filter, dateFilter]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await reportAPI.vyaparAllParties({
        type: filter,
        ...dateFilter
      });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch parties report');
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (filterData) => {
    setDateFilter(filterData);
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

  const getBalanceStatus = (balance) => {
    if (balance > 0) return { color: 'green', label: 'To Receive' };
    if (balance < 0) return { color: 'red', label: 'To Pay' };
    return { color: 'gray', label: 'Balanced' };
  };

  const exportData = reportData?.parties?.map(party => ({
    'Party Name': party.name,
    'Type': party.type,
    'Phone': party.phone,
    'Email': party.email,
    'Opening Balance': party.openingBalance.toFixed(2),
    'Total Sales': party.totalSales.toFixed(2),
    'Total Purchases': party.totalPurchases.toFixed(2),
    'Total Payments': party.totalPayments.toFixed(2),
    'Total Receipts': party.totalReceipts.toFixed(2),
    'Closing Balance': party.closingBalance.toFixed(2),
    'Status': party.closingBalance > 0 ? 'To Receive' : party.closingBalance < 0 ? 'To Pay' : 'Balanced'
  })) || [];

  const summaryCards = [
    {
      label: 'Total Parties',
      value: reportData?.summary?.totalParties || 0,
      subtext: `${reportData?.summary?.customers || 0} customers, ${reportData?.summary?.suppliers || 0} suppliers`,
      icon: IconUsers,
      color: 'blue'
    },
    {
      label: 'To Receive',
      value: formatCurrency(reportData?.summary?.totalReceivable),
      subtext: `From ${reportData?.summary?.partiesWithCredit || 0} parties`,
      icon: IconCash,
      color: 'green'
    },
    {
      label: 'To Pay',
      value: formatCurrency(reportData?.summary?.totalPayable),
      subtext: `To ${reportData?.summary?.partiesWithDebit || 0} parties`,
      icon: IconReceipt,
      color: 'red'
    },
    {
      label: 'Net Balance',
      value: formatCurrency(reportData?.summary?.netBalance),
      subtext: reportData?.summary?.netBalance >= 0 ? 'Net Receivable' : 'Net Payable',
      icon: IconScale,
      color: 'violet'
    }
  ];

  const totals = {
    sales: reportData?.parties?.reduce((sum, p) => sum + p.totalSales, 0) || 0,
    purchases: reportData?.parties?.reduce((sum, p) => sum + p.totalPurchases, 0) || 0,
    payments: reportData?.parties?.reduce((sum, p) => sum + p.totalPayments, 0) || 0,
    receipts: reportData?.parties?.reduce((sum, p) => sum + p.totalReceipts, 0) || 0
  };

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 2 }} />

      <PageHeader
        title="All Parties Report"
        subtitle="Complete list of customers and suppliers with balances"
      />

      <Stack gap="md">
        {/* Date Filter */}
        <Paper p="md" withBorder>
          <DateFilterToolbar onFilterChange={handleDateFilterChange} />
        </Paper>

        {/* Party Type Filter */}
        <Paper p="md" withBorder>
          <Group justify="space-between" align="center">
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              data={[
                { label: 'All Parties', value: 'all' },
                { label: 'Customers', value: 'customers' },
                { label: 'Suppliers', value: 'suppliers' }
              ]}
            />
          </Group>
        </Paper>

        {/* Summary Cards */}
        {reportData && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {summaryCards.map((card, index) => (
              <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" align="flex-start" mb="xs">
                  <ThemeIcon size="lg" variant="light" color={card.color}>
                    <card.icon size={20} />
                  </ThemeIcon>
                </Group>
                <Text size="sm" c="dimmed" fw={500}>{card.label}</Text>
                <Text size="xl" fw={700} mt={4}>{card.value}</Text>
                <Text size="xs" c="dimmed" mt={4}>{card.subtext}</Text>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Report Table */}
        {reportData?.parties && (
          <Paper p="md" withBorder>
            <Flex justify="space-between" align="center" mb="md">
              <Text size="sm" c="dimmed">
                Showing {reportData.parties.length} parties
              </Text>
              <ExportButton data={exportData} filename="all_parties_report" />
            </Flex>

            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Party Name</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Phone</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Opening Bal.</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Sales</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Purchases</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Payments</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Receipts</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Closing Bal.</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reportData.parties.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={11} style={{ textAlign: 'center' }}>
                        <Text c="dimmed" py="xl">No parties found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    reportData.parties.map((party, idx) => {
                      const status = getBalanceStatus(party.closingBalance);
                      return (
                        <Table.Tr
                          key={idx}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/reports/vyapar/party-statement?party=${party._id}`)}
                        >
                          <Table.Td fw={500}>{party.name}</Table.Td>
                          <Table.Td>
                            <Badge variant="light" color={party.type === 'Customer' ? 'blue' : 'orange'}>
                              {party.type}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{party.phone}</Table.Td>
                          <Table.Td>{party.email}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(party.openingBalance)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text c="green">{formatCurrency(party.totalSales)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text c="red">{formatCurrency(party.totalPurchases)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(party.totalPayments)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(party.totalReceipts)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text fw={600}>{formatCurrency(Math.abs(party.closingBalance))}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            <Badge color={status.color} variant="filled" size="sm">
                              {status.label}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
                {reportData.parties.length > 0 && (
                  <Table.Tfoot>
                    <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}>
                      <Table.Td colSpan={5} style={{ textAlign: 'right' }}>
                        <Text fw={700}>Totals:</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700} c="green">{formatCurrency(totals.sales)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700} c="red">{formatCurrency(totals.purchases)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700}>{formatCurrency(totals.payments)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700}>{formatCurrency(totals.receipts)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700}>{formatCurrency(Math.abs(reportData.summary.netBalance))}</Text>
                      </Table.Td>
                      <Table.Td></Table.Td>
                    </Table.Tr>
                  </Table.Tfoot>
                )}
              </Table>
            </Box>
          </Paper>
        )}
      </Stack>
    </Box>
  );
};

export default VyaparAllParties;
