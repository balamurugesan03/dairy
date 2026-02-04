import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { farmerAPI, farmerLedgerAPI } from '../../services/api';
import {
  Container,
  Card,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Select,
  Button,
  Table,
  Badge,
  Loader,
  Box,
  Grid,
  Divider,
  ScrollArea,
  ActionIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconSearch,
  IconCalendar,
  IconPrinter,
  IconDownload,
  IconRefresh,
  IconCurrencyRupee,
  IconArrowUp,
  IconArrowDown,
  IconScale,
} from '@tabler/icons-react';

const FarmerLedgerView = () => {
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [farmerSummary, setFarmerSummary] = useState(null);

  const [filters, setFilters] = useState({
    farmerId: '',
    fromDate: null,
    toDate: null,
    transactionType: 'all'
  });

  useEffect(() => {
    searchFarmers('');
  }, []);

  const searchFarmers = async (query) => {
    try {
      setSearchLoading(true);
      let response;
      if (query && query.trim().length > 0) {
        response = await farmerAPI.search(query.trim());
      } else {
        response = await farmerAPI.getAll({ status: 'Active', limit: 50 });
      }
      setFarmers(response.data || []);
    } catch (error) {
      console.error('Failed to search farmers:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFarmerSelect = async (farmerId) => {
    const farmer = farmers.find(f => f._id === farmerId);
    setSelectedFarmer(farmer);
    setFilters(prev => ({ ...prev, farmerId }));

    if (farmer) {
      await fetchLedger(farmerId);
      await fetchSummary(farmerId);
    }
  };

  const fetchLedger = async (farmerId) => {
    if (!farmerId) return;

    setLoading(true);
    try {
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate.toISOString();
      if (filters.toDate) params.toDate = filters.toDate.toISOString();
      if (filters.transactionType !== 'all') params.transactionType = filters.transactionType;

      const response = await farmerLedgerAPI.getLedger(farmerId, params);
      setLedgerData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledger');
      setLedgerData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async (farmerId) => {
    if (!farmerId) return;

    try {
      const response = await farmerLedgerAPI.getSummary(farmerId);
      setFarmerSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      setFarmerSummary(null);
    }
  };

  const handleRefresh = () => {
    if (filters.farmerId) {
      fetchLedger(filters.farmerId);
      fetchSummary(filters.farmerId);
    }
  };

  const handleDateChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (filters.farmerId) {
      fetchLedger(filters.farmerId);
    }
  }, [filters.fromDate, filters.toDate, filters.transactionType]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');

    const entriesHtml = ledgerData?.entries?.map((entry, index) => `
      <tr>
        <td>${formatDate(entry.date)}</td>
        <td>${entry.particulars}</td>
        <td style="text-align: right;">${entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
        <td style="text-align: right;">${entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
        <td style="text-align: right; ${entry.balance >= 0 ? 'color: green;' : 'color: red;'}">${formatCurrency(Math.abs(entry.balance))} ${entry.balance >= 0 ? 'Dr' : 'Cr'}</td>
      </tr>
    `).join('') || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Farmer Ledger - ${selectedFarmer?.farmerNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .farmer-info { margin-bottom: 15px; padding: 10px; background: #f5f5f5; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
            th { background: #f0f0f0; }
            .summary { margin-top: 15px; padding: 10px; background: #f5f5f5; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Farmer Ledger Statement</h2>
            <p>${selectedFarmer?.farmerNumber} - ${selectedFarmer?.personalDetails?.name}</p>
            ${filters.fromDate || filters.toDate ? `<p>Period: ${filters.fromDate ? formatDate(filters.fromDate) : 'Start'} to ${filters.toDate ? formatDate(filters.toDate) : 'Today'}</p>` : ''}
          </div>

          <div class="farmer-info">
            <strong>Farmer:</strong> ${selectedFarmer?.personalDetails?.name}<br>
            <strong>ID:</strong> ${selectedFarmer?.farmerNumber}<br>
            <strong>Village:</strong> ${selectedFarmer?.address?.village || '-'}
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Particulars</th>
                <th style="text-align: right;">Debit</th>
                <th style="text-align: right;">Credit</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4"><strong>Opening Balance</strong></td>
                <td style="text-align: right;"><strong>${formatCurrency(ledgerData?.summary?.openingBalance || 0)}</strong></td>
              </tr>
              ${entriesHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f0f0f0;">
                <td colspan="2"><strong>Total</strong></td>
                <td style="text-align: right;"><strong>${formatCurrency(ledgerData?.summary?.totalDebit || 0)}</strong></td>
                <td style="text-align: right;"><strong>${formatCurrency(ledgerData?.summary?.totalCredit || 0)}</strong></td>
                <td style="text-align: right;"><strong>${formatCurrency(Math.abs(ledgerData?.summary?.closingBalance || 0))} ${(ledgerData?.summary?.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</strong></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(Math.abs(amount || 0));
  };

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'Milk Payment': return 'green';
      case 'Advance Given': return 'red';
      case 'Loan Disbursed': return 'red';
      case 'Receipt': return 'blue';
      default: return 'gray';
    }
  };

  const farmerOptions = farmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber} - ${farmer.personalDetails?.name}`
  }));

  const transactionTypeOptions = [
    { value: 'all', label: 'All Transactions' },
    { value: 'payment', label: 'Milk Payments' },
    { value: 'advance', label: 'Advances' },
    { value: 'loan', label: 'Loans' },
    { value: 'receipt', label: 'Receipts' }
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Box>
            <Title order={2}>Farmer Ledger</Title>
            <Text c="dimmed" size="sm">View farmer's complete financial history with running balance</Text>
          </Box>
          {selectedFarmer && (
            <Group>
              <ActionIcon variant="subtle" onClick={handleRefresh}>
                <IconRefresh size={18} />
              </ActionIcon>
              <Button leftSection={<IconPrinter size={16} />} variant="light" onClick={handlePrint}>
                Print
              </Button>
            </Group>
          )}
        </Group>

        {/* Farmer Selection and Filters */}
        <Card withBorder p="md" radius="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Select
                label="Select Farmer"
                placeholder="Search farmer"
                value={filters.farmerId}
                onChange={handleFarmerSelect}
                data={farmerOptions}
                searchable
                clearable
                onSearchChange={searchFarmers}
                nothingFoundMessage={searchLoading ? "Searching..." : "No farmers found"}
                leftSection={<IconSearch size={16} />}
                rightSection={searchLoading ? <Loader size="xs" /> : null}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
              <DatePickerInput
                label="From Date"
                placeholder="Start date"
                value={filters.fromDate}
                onChange={(value) => handleDateChange('fromDate', value)}
                clearable
                leftSection={<IconCalendar size={16} />}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
              <DatePickerInput
                label="To Date"
                placeholder="End date"
                value={filters.toDate}
                onChange={(value) => handleDateChange('toDate', value)}
                clearable
                leftSection={<IconCalendar size={16} />}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Select
                label="Transaction Type"
                value={filters.transactionType}
                onChange={(value) => setFilters(prev => ({ ...prev, transactionType: value }))}
                data={transactionTypeOptions}
              />
            </Grid.Col>
          </Grid>
        </Card>

        {selectedFarmer && (
          <>
            {/* Farmer Info & Summary Cards */}
            <Grid>
              {/* Farmer Details */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card withBorder p="md" radius="md" h="100%">
                  <Title order={5} mb="sm">Farmer Details</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Farmer ID</Text>
                      <Text size="sm" fw={500}>{selectedFarmer.farmerNumber}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Name</Text>
                      <Text size="sm" fw={500}>{selectedFarmer.personalDetails?.name}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Village</Text>
                      <Text size="sm">{selectedFarmer.address?.village || '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Phone</Text>
                      <Text size="sm">{selectedFarmer.personalDetails?.phone || '-'}</Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>

              {/* Outstanding Summary */}
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Grid>
                  <Grid.Col span={4}>
                    <Card withBorder p="md" radius="md" bg="blue.0">
                      <Group justify="space-between">
                        <Box>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Debit</Text>
                          <Text size="xl" fw={700} c="blue">
                            {formatCurrency(ledgerData?.summary?.totalDebit || 0)}
                          </Text>
                        </Box>
                        <IconArrowUp size={28} stroke={1.5} color="var(--mantine-color-blue-6)" />
                      </Group>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder p="md" radius="md" bg="green.0">
                      <Group justify="space-between">
                        <Box>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Credit</Text>
                          <Text size="xl" fw={700} c="green">
                            {formatCurrency(ledgerData?.summary?.totalCredit || 0)}
                          </Text>
                        </Box>
                        <IconArrowDown size={28} stroke={1.5} color="var(--mantine-color-green-6)" />
                      </Group>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Card withBorder p="md" radius="md" bg={(ledgerData?.summary?.closingBalance || 0) > 0 ? 'orange.0' : 'green.0'}>
                      <Group justify="space-between">
                        <Box>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Net Balance</Text>
                          <Text size="xl" fw={700} c={(ledgerData?.summary?.closingBalance || 0) > 0 ? 'orange' : 'green'}>
                            {formatCurrency(ledgerData?.summary?.closingBalance || 0)}
                            <Text span size="sm" ml={4}>{(ledgerData?.summary?.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</Text>
                          </Text>
                        </Box>
                        <IconScale size={28} stroke={1.5} color={(ledgerData?.summary?.closingBalance || 0) > 0 ? 'var(--mantine-color-orange-6)' : 'var(--mantine-color-green-6)'} />
                      </Group>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Grid.Col>
            </Grid>

            {/* Ledger Table */}
            <Card withBorder shadow="sm" radius="md">
              <Title order={4} mb="md">Transaction History</Title>

              {loading ? (
                <Box py="xl" style={{ textAlign: 'center' }}>
                  <Loader size="md" />
                </Box>
              ) : !ledgerData || ledgerData.entries?.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">No transactions found</Text>
              ) : (
                <ScrollArea>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Particulars</Table.Th>
                        <Table.Th>Reference</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Debit</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Credit</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {/* Opening Balance Row */}
                      <Table.Tr bg="gray.0">
                        <Table.Td></Table.Td>
                        <Table.Td colSpan={4}><Text fw={600}>Opening Balance</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={600}>
                            {formatCurrency(ledgerData.summary?.openingBalance || 0)}
                            <Text span size="xs" ml={4}>{(ledgerData.summary?.openingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</Text>
                          </Text>
                        </Table.Td>
                      </Table.Tr>

                      {/* Transactions */}
                      {ledgerData.entries?.map((entry, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>{formatDate(entry.date)}</Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Badge color={getTransactionTypeColor(entry.type)} variant="light" size="xs">
                                {entry.type}
                              </Badge>
                              <Text size="sm">{entry.particulars}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">{entry.referenceNo}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            {entry.debit > 0 ? (
                              <Text c="red" fw={500}>{formatCurrency(entry.debit)}</Text>
                            ) : '-'}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            {entry.credit > 0 ? (
                              <Text c="green" fw={500}>{formatCurrency(entry.credit)}</Text>
                            ) : '-'}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text fw={500} c={entry.balance >= 0 ? 'orange' : 'green'}>
                              {formatCurrency(entry.balance)}
                              <Text span size="xs" ml={4}>{entry.balance >= 0 ? 'Dr' : 'Cr'}</Text>
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}

                      {/* Closing Balance Row */}
                      <Table.Tr bg="gray.1">
                        <Table.Td></Table.Td>
                        <Table.Td colSpan={2}><Text fw={700}>Closing Balance</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={700}>{formatCurrency(ledgerData.summary?.totalDebit || 0)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={700}>{formatCurrency(ledgerData.summary?.totalCredit || 0)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={700} c={(ledgerData.summary?.closingBalance || 0) >= 0 ? 'orange' : 'green'}>
                            {formatCurrency(ledgerData.summary?.closingBalance || 0)}
                            <Text span size="xs" ml={4}>{(ledgerData.summary?.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</Text>
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Card>

            {/* Outstanding Breakdown */}
            {farmerSummary && (
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Card withBorder p="md" radius="md">
                    <Title order={5} mb="sm">Advance Outstanding</Title>
                    <Stack gap="xs">
                      {farmerSummary.advances?.byCategory?.map((adv, index) => (
                        <Group justify="space-between" key={index}>
                          <Text size="sm">{adv._id || 'Other'}</Text>
                          <Text size="sm" fw={500} c="orange">{formatCurrency(adv.outstanding)}</Text>
                        </Group>
                      ))}
                      <Divider />
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>Total</Text>
                        <Text size="sm" fw={700} c="orange">{formatCurrency(farmerSummary.advances?.total || 0)}</Text>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Card withBorder p="md" radius="md">
                    <Title order={5} mb="sm">Loan Outstanding</Title>
                    <Stack gap="xs">
                      {Object.entries(farmerSummary.loans?.byType || {}).map(([type, amount], index) => (
                        <Group justify="space-between" key={index}>
                          <Text size="sm">{type}</Text>
                          <Text size="sm" fw={500} c="orange">{formatCurrency(amount)}</Text>
                        </Group>
                      ))}
                      <Divider />
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>Total</Text>
                        <Text size="sm" fw={700} c="orange">{formatCurrency(farmerSummary.loans?.summary?.totalOutstanding || 0)}</Text>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>
            )}
          </>
        )}

        {/* No Farmer Selected */}
        {!selectedFarmer && (
          <Card withBorder p="xl" radius="md" bg="gray.0">
            <Stack align="center" gap="md">
              <IconSearch size={48} stroke={1} color="gray" />
              <Text c="dimmed" ta="center">
                Select a farmer to view their ledger statement
              </Text>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  );
};

export default FarmerLedgerView;
