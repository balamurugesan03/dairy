import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import {
  Card,
  Grid,
  Text,
  Title,
  Paper,
  Group,
  Badge,
  Table,
  ScrollArea,
  TextInput,
  Select,
  Button,
  Collapse,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  Divider,
  Box,
  Stack,
  ThemeIcon,
  Progress
} from '@mantine/core';
import {
  IconFileInvoice,
  IconUsers,
  IconCash,
  IconReceipt,
  IconShoppingCart,
  IconChevronDown,
  IconChevronRight,
  IconSearch,
  IconDownload,
  IconPrinter,
  IconFilter,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconCurrencyRupee,
  IconBuildingStore,
  IconTruck,
  IconCalendar,
  IconArrowUpRight,
  IconArrowDownRight
} from '@tabler/icons-react';
import PageHeader from '../../common/PageHeader';
import DateFilterToolbar from '../../common/DateFilterToolbar';

const VyaparBillWiseProfit = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [expandedParties, setExpandedParties] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [partyTypeFilter, setPartyTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount
  useEffect(() => {
    fetchReport({ filterType: 'thisMonth' });
  }, []);

  const fetchReport = async (filterData) => {
    setLoading(true);
    try {
      const params = {
        ...filterData,
        partyType: partyTypeFilter !== 'all' ? partyTypeFilter : undefined,
        search: searchQuery || undefined
      };
      const response = await reportAPI.vyaparBillWiseProfit(params);
      setReportData(response.data);
      // Expand first party by default
      if (response.data?.parties?.length > 0) {
        setExpandedParties({ [response.data.parties[0].partyId]: true });
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch bill-wise party report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterData) => {
    fetchReport(filterData);
  };

  const handleSearch = () => {
    fetchReport({ filterType: 'thisMonth' });
  };

  const togglePartyExpand = (partyId) => {
    setExpandedParties(prev => ({
      ...prev,
      [partyId]: !prev[partyId]
    }));
  };

  const expandAll = () => {
    if (reportData?.parties) {
      const allExpanded = {};
      reportData.parties.forEach(party => {
        allExpanded[party.partyId] = true;
      });
      setExpandedParties(allExpanded);
    }
  };

  const collapseAll = () => {
    setExpandedParties({});
  };

  // Format helpers
  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const getStatusBadge = (status) => {
    const colors = {
      Paid: 'green',
      Partial: 'yellow',
      Pending: 'red'
    };
    return <Badge color={colors[status] || 'gray'} size="sm">{status}</Badge>;
  };

  const getBillTypeBadge = (type) => {
    const colors = {
      Sales: 'blue',
      Purchase: 'orange'
    };
    const iconStyle = { width: 12, height: 12 };
    const icons = {
      Sales: <IconShoppingCart style={iconStyle} />,
      Purchase: <IconTruck style={iconStyle} />
    };
    return (
      <Badge color={colors[type] || 'gray'} size="sm" leftSection={icons[type]}>
        {type}
      </Badge>
    );
  };

  const getPartyTypeBadge = (type) => {
    const colors = {
      Customer: 'teal',
      Supplier: 'violet'
    };
    return <Badge color={colors[type] || 'gray'} variant="light" size="sm">{type}</Badge>;
  };

  // Filter parties based on local filters
  const filteredParties = useMemo(() => {
    if (!reportData?.parties) return [];

    return reportData.parties.filter(party => {
      // Party type filter
      if (partyTypeFilter !== 'all' && party.partyType !== partyTypeFilter) {
        return false;
      }

      // Search filter (already applied in API, but double-check locally)
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesParty = party.partyName.toLowerCase().includes(searchLower);
        const matchesBill = party.bills.some(bill =>
          bill.billNumber?.toLowerCase().includes(searchLower)
        );
        if (!matchesParty && !matchesBill) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const hasMatchingBill = party.bills.some(bill => bill.status === statusFilter);
        if (!hasMatchingBill) return false;
      }

      return true;
    }).map(party => {
      // Filter bills by status if needed
      if (statusFilter !== 'all') {
        return {
          ...party,
          bills: party.bills.filter(bill => bill.status === statusFilter)
        };
      }
      return party;
    });
  }, [reportData?.parties, partyTypeFilter, searchQuery, statusFilter]);

  // Export data
  const exportToCSV = () => {
    if (!filteredParties.length) return;

    const rows = [];
    rows.push(['Party Name', 'Party Type', 'Bill Number', 'Bill Date', 'Bill Type', 'Total Amount', 'Discount', 'GST', 'Paid Amount', 'Balance', 'Status'].join(','));

    filteredParties.forEach(party => {
      party.bills.forEach(bill => {
        rows.push([
          `"${party.partyName}"`,
          party.partyType,
          bill.billNumber,
          formatDate(bill.billDate),
          bill.billType,
          bill.totalAmount.toFixed(2),
          bill.discount.toFixed(2),
          bill.gstAmount.toFixed(2),
          bill.paidAmount.toFixed(2),
          bill.balanceAmount.toFixed(2),
          bill.status
        ].join(','));
      });
      // Add party totals row
      rows.push([
        `"${party.partyName} - TOTAL"`,
        '',
        '',
        '',
        '',
        party.totals.totalAmount.toFixed(2),
        party.totals.totalDiscount.toFixed(2),
        party.totals.totalGst.toFixed(2),
        party.totals.totalPaid.toFixed(2),
        party.totals.totalBalance.toFixed(2),
        ''
      ].join(','));
      rows.push(''); // Empty row between parties
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bill_wise_party_report_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = reportData?.summary || {};

  return (
    <Box pos="relative" style={{ minHeight: '100vh' }}>
      <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

      <PageHeader
        title="Bill-wise Party Report"
        subtitle="View all bills grouped by party with payment details"
        icon={<IconFileInvoice size={28} />}
      />

      {/* Date Filter */}
      <DateFilterToolbar onFilterChange={handleFilterChange} />

      {/* Additional Filters */}
      <Paper shadow="sm" p="md" mb="md" withBorder>
        <Grid align="end">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <TextInput
              label="Search"
              placeholder="Search party or bill number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Select
              label="Party Type"
              value={partyTypeFilter}
              onChange={setPartyTypeFilter}
              data={[
                { value: 'all', label: 'All Parties' },
                { value: 'Customer', label: 'Customers' },
                { value: 'Supplier', label: 'Suppliers' }
              ]}
              leftSection={<IconFilter size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
            <Select
              label="Payment Status"
              value={statusFilter}
              onChange={setStatusFilter}
              data={[
                { value: 'all', label: 'All Status' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Partial', label: 'Partial' },
                { value: 'Pending', label: 'Pending' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 5 }}>
            <Group justify="flex-end" gap="xs">
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => fetchReport({ filterType: 'thisMonth' })}
              >
                Refresh
              </Button>
              <Button
                variant="light"
                onClick={expandAll}
              >
                Expand All
              </Button>
              <Button
                variant="light"
                onClick={collapseAll}
              >
                Collapse All
              </Button>
              <Button
                variant="light"
                color="green"
                leftSection={<IconDownload size={16} />}
                onClick={exportToCSV}
              >
                Export CSV
              </Button>
              <Button
                variant="light"
                color="blue"
                leftSection={<IconPrinter size={16} />}
                onClick={handlePrint}
              >
                Print
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Paper>

      {reportData && (
        <>
          {/* Summary Cards */}
          <Grid mb="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" p="lg" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">Total Parties</Text>
                  <ThemeIcon color="blue" variant="light" size="lg">
                    <IconUsers size={20} />
                  </ThemeIcon>
                </Group>
                <Title order={2}>{summary.totalParties || 0}</Title>
                <Group gap="xs" mt="xs">
                  <Badge color="teal" variant="light" size="sm">
                    {summary.totalCustomers || 0} Customers
                  </Badge>
                  <Badge color="violet" variant="light" size="sm">
                    {summary.totalSuppliers || 0} Suppliers
                  </Badge>
                </Group>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" p="lg" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">Total Bills</Text>
                  <ThemeIcon color="grape" variant="light" size="lg">
                    <IconFileInvoice size={20} />
                  </ThemeIcon>
                </Group>
                <Title order={2}>{summary.totalBills || 0}</Title>
                <Group gap="xs" mt="xs">
                  <Badge color="blue" variant="light" size="sm">
                    {summary.totalSalesBills || 0} Sales
                  </Badge>
                  <Badge color="orange" variant="light" size="sm">
                    {summary.totalPurchaseBills || 0} Purchases
                  </Badge>
                </Group>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" p="lg" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">Total Billed Amount</Text>
                  <ThemeIcon color="cyan" variant="light" size="lg">
                    <IconCurrencyRupee size={20} />
                  </ThemeIcon>
                </Group>
                <Title order={3}>{formatCurrency(summary.totalAmount)}</Title>
                <Group gap="xs" mt="xs">
                  <Text size="xs" c="teal">
                    <IconArrowUpRight size={12} style={{ verticalAlign: 'middle' }} />
                    Sales: {formatCurrency(summary.totalSalesAmount)}
                  </Text>
                </Group>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" p="lg" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">Total Paid</Text>
                  <ThemeIcon color="green" variant="light" size="lg">
                    <IconCash size={20} />
                  </ThemeIcon>
                </Group>
                <Title order={3} c="green">{formatCurrency(summary.totalPaid)}</Title>
                <Progress
                  value={summary.totalAmount > 0 ? (summary.totalPaid / summary.totalAmount) * 100 : 0}
                  color="green"
                  size="sm"
                  mt="xs"
                />
              </Card>
            </Grid.Col>
          </Grid>

          {/* Outstanding Summary */}
          <Grid mb="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Card shadow="sm" p="md" withBorder style={{ borderLeft: '4px solid var(--mantine-color-red-6)' }}>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">Outstanding Balance</Text>
                    <Title order={3} c="red">{formatCurrency(summary.totalBalance)}</Title>
                  </div>
                  <ThemeIcon color="red" variant="light" size="xl">
                    <IconTrendingDown size={24} />
                  </ThemeIcon>
                </Group>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Card shadow="sm" p="md" withBorder style={{ borderLeft: '4px solid var(--mantine-color-teal-6)' }}>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">Receivable (from Customers)</Text>
                    <Title order={3} c="teal">{formatCurrency(summary.totalReceivable)}</Title>
                  </div>
                  <ThemeIcon color="teal" variant="light" size="xl">
                    <IconArrowDownRight size={24} />
                  </ThemeIcon>
                </Group>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Card shadow="sm" p="md" withBorder style={{ borderLeft: '4px solid var(--mantine-color-orange-6)' }}>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">Payable (to Suppliers)</Text>
                    <Title order={3} c="orange">{formatCurrency(summary.totalPayable)}</Title>
                  </div>
                  <ThemeIcon color="orange" variant="light" size="xl">
                    <IconArrowUpRight size={24} />
                  </ThemeIcon>
                </Group>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Payment Status Summary */}
          <Paper shadow="sm" p="md" mb="md" withBorder>
            <Group justify="space-between">
              <Text fw={500}>Payment Status Summary</Text>
              <Group gap="md">
                <Badge color="green" size="lg" variant="light">
                  {summary.paidBills || 0} Paid
                </Badge>
                <Badge color="yellow" size="lg" variant="light">
                  {summary.partialBills || 0} Partial
                </Badge>
                <Badge color="red" size="lg" variant="light">
                  {summary.pendingBills || 0} Pending
                </Badge>
              </Group>
            </Group>
          </Paper>

          {/* Party-wise Bills */}
          <Paper shadow="sm" p="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>
                Party-wise Bills ({filteredParties.length} parties)
              </Title>
            </Group>

            {filteredParties.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">
                No bills found for the selected filters
              </Text>
            ) : (
              <Stack gap="md">
                {filteredParties.map((party) => (
                  <Card key={party.partyId} shadow="xs" withBorder p={0}>
                    {/* Party Header - Clickable */}
                    <Paper
                      p="md"
                      style={{ cursor: 'pointer' }}
                      onClick={() => togglePartyExpand(party.partyId)}
                    >
                      <Grid align="center">
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <Group>
                            <ActionIcon variant="subtle" color="gray">
                              {expandedParties[party.partyId] ? (
                                <IconChevronDown size={20} />
                              ) : (
                                <IconChevronRight size={20} />
                              )}
                            </ActionIcon>
                            <ThemeIcon
                              color={party.partyType === 'Customer' ? 'teal' : 'violet'}
                              variant="light"
                              size="lg"
                            >
                              {party.partyType === 'Customer' ? (
                                <IconBuildingStore size={20} />
                              ) : (
                                <IconTruck size={20} />
                              )}
                            </ThemeIcon>
                            <div>
                              <Text fw={600}>{party.partyName}</Text>
                              <Group gap="xs">
                                {getPartyTypeBadge(party.partyType)}
                                <Badge color="gray" variant="light" size="sm">
                                  {party.totals.totalBills} bills
                                </Badge>
                              </Group>
                            </div>
                          </Group>
                        </Grid.Col>

                        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                          <Text size="xs" c="dimmed">Total Amount</Text>
                          <Text fw={600}>{formatCurrency(party.totals.totalAmount)}</Text>
                        </Grid.Col>

                        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                          <Text size="xs" c="dimmed">Paid</Text>
                          <Text fw={600} c="green">{formatCurrency(party.totals.totalPaid)}</Text>
                        </Grid.Col>

                        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                          <Text size="xs" c="dimmed">Balance</Text>
                          <Text fw={600} c={party.totals.totalBalance > 0 ? 'red' : 'green'}>
                            {formatCurrency(party.totals.totalBalance)}
                          </Text>
                        </Grid.Col>

                        <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                          <Text size="xs" c="dimmed">GST</Text>
                          <Text fw={500}>{formatCurrency(party.totals.totalGst)}</Text>
                        </Grid.Col>
                      </Grid>
                    </Paper>

                    {/* Bills Table - Collapsible */}
                    <Collapse in={expandedParties[party.partyId]}>
                      <Divider />
                      <ScrollArea>
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Bill No.</Table.Th>
                              <Table.Th>Date</Table.Th>
                              <Table.Th>Type</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>Discount</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>GST</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>Paid</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                              <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {party.bills.map((bill, idx) => (
                              <Table.Tr key={`${bill.billNumber}-${idx}`}>
                                <Table.Td>
                                  <Text fw={500} size="sm">{bill.billNumber}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Group gap={4}>
                                    <IconCalendar size={14} color="gray" />
                                    <Text size="sm">{formatDate(bill.billDate)}</Text>
                                  </Group>
                                </Table.Td>
                                <Table.Td>{getBillTypeBadge(bill.billType)}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text fw={500}>{formatCurrency(bill.totalAmount)}</Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text size="sm" c="dimmed">{formatCurrency(bill.discount)}</Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text size="sm">{formatCurrency(bill.gstAmount)}</Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text fw={500} c="green">{formatCurrency(bill.paidAmount)}</Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text
                                    fw={500}
                                    c={bill.balanceAmount > 0 ? 'red' : 'green'}
                                  >
                                    {formatCurrency(bill.balanceAmount)}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'center' }}>
                                  {getStatusBadge(bill.status)}
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                          <Table.Tfoot>
                            <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}>
                              <Table.Th colSpan={3}>
                                <Text fw={700}>Party Total</Text>
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                <Text fw={700}>{formatCurrency(party.totals.totalAmount)}</Text>
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                <Text fw={600}>{formatCurrency(party.totals.totalDiscount)}</Text>
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                <Text fw={600}>{formatCurrency(party.totals.totalGst)}</Text>
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                <Text fw={700} c="green">{formatCurrency(party.totals.totalPaid)}</Text>
                              </Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>
                                <Text
                                  fw={700}
                                  c={party.totals.totalBalance > 0 ? 'red' : 'green'}
                                >
                                  {formatCurrency(party.totals.totalBalance)}
                                </Text>
                              </Table.Th>
                              <Table.Th></Table.Th>
                            </Table.Tr>
                          </Table.Tfoot>
                        </Table>
                      </ScrollArea>
                    </Collapse>
                  </Card>
                ))}
              </Stack>
            )}
          </Paper>

          {/* Grand Total Footer */}
          {filteredParties.length > 0 && (
            <Paper shadow="sm" p="md" mt="md" withBorder style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
              <Grid align="center">
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <Text fw={700} size="lg">Grand Total</Text>
                  <Text size="sm" c="dimmed">{filteredParties.length} parties, {summary.totalBills} bills</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                  <Text size="xs" c="dimmed">Total Amount</Text>
                  <Text fw={700} size="lg">{formatCurrency(summary.totalAmount)}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                  <Text size="xs" c="dimmed">Total GST</Text>
                  <Text fw={600}>{formatCurrency(summary.totalGst)}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3, md: 2 }}>
                  <Text size="xs" c="dimmed">Total Paid</Text>
                  <Text fw={700} size="lg" c="green">{formatCurrency(summary.totalPaid)}</Text>
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3, md: 3 }}>
                  <Text size="xs" c="dimmed">Outstanding Balance</Text>
                  <Text fw={700} size="lg" c="red">{formatCurrency(summary.totalBalance)}</Text>
                </Grid.Col>
              </Grid>
            </Paper>
          )}
        </>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .mantine-Paper-root, .mantine-Paper-root * {
            visibility: visible;
          }
          .mantine-Button-root, .mantine-ActionIcon-root {
            display: none !important;
          }
        }
      `}</style>
    </Box>
  );
};

export default VyaparBillWiseProfit;
