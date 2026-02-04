import { useState, useEffect } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  Group,
  Table,
  Badge,
  LoadingOverlay,
  Stack,
  TextInput,
  Select,
  Grid,
  ActionIcon,
  Menu,
  Tooltip,
  Paper,
  ThemeIcon,
  SimpleGrid
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPackageExport,
  IconPlus,
  IconSearch,
  IconFilter,
  IconRefresh,
  IconEye,
  IconDots,
  IconCalendar,
  IconCurrencyRupee,
  IconPackage,
  IconTrendingDown,
  IconReceipt
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { stockAPI } from '../../services/api';
import StockOutModal from './StockOutModal';
import { useAuth } from '../../context/AuthContext';

const StockOutManagement = () => {
  const { canWrite } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    referenceType: '',
    search: ''
  });
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalQuantity: 0,
    totalAmount: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        transactionType: 'out',
        ...(filters.startDate && { startDate: filters.startDate.toISOString() }),
        ...(filters.endDate && { endDate: filters.endDate.toISOString() }),
        ...(filters.referenceType && { referenceType: filters.referenceType })
      };

      const response = await stockAPI.getTransactions(params);
      let txnData = response.data || [];

      // Apply search filter on frontend
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        txnData = txnData.filter(txn =>
          txn.itemId?.itemName?.toLowerCase().includes(searchLower) ||
          txn.itemId?.itemCode?.toLowerCase().includes(searchLower) ||
          txn.notes?.toLowerCase().includes(searchLower)
        );
      }

      setTransactions(txnData);

      // Calculate stats
      const totalTransactions = txnData.length;
      const totalQuantity = txnData.reduce((sum, txn) => sum + (txn.quantity || 0), 0);
      const totalAmount = txnData.reduce((sum, txn) => sum + ((txn.quantity || 0) * (txn.rate || 0)), 0);

      setStats({ totalTransactions, totalQuantity, totalAmount });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch transactions',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      referenceType: '',
      search: ''
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
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
    }).format(amount || 0);
  };

  const getReferenceTypeBadge = (type) => {
    const colors = {
      'Sale': 'blue',
      'Return': 'green',
      'Adjustment': 'orange'
    };
    return <Badge color={colors[type] || 'gray'} variant="light">{type}</Badge>;
  };

  return (
    <Container fluid p="md">
      <LoadingOverlay visible={loading} />

      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Stock Return Management</Title>
          <Text size="sm" c="dimmed">Manage stock removals, sales, and adjustments</Text>
        </div>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={fetchTransactions}
            variant="light"
          >
            Refresh
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
            color="red"
            disabled={!canWrite('inventory')}
          >
            Stock Return
          </Button>
        </Group>
      </Group>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="xl">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="red">
              <IconReceipt size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Transactions
              </Text>
              <Text fw={700} size="xl">
                {stats.totalTransactions}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="orange">
              <IconTrendingDown size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Quantity Removed
              </Text>
              <Text fw={700} size="xl">
                {stats.totalQuantity.toFixed(2)}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="violet">
              <IconCurrencyRupee size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Stock Value
              </Text>
              <Text fw={700} size="xl">
                {formatCurrency(stats.totalAmount)}
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Stack gap="md">
          <Group justify="space-between">
            <Group>
              <IconFilter size={20} />
              <Text fw={600}>Filters</Text>
            </Group>
            <Button size="xs" variant="subtle" onClick={clearFilters}>
              Clear All
            </Button>
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                placeholder="Search by item, notes..."
                leftSection={<IconSearch size={16} />}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DateInput
                placeholder="Start date"
                leftSection={<IconCalendar size={16} />}
                value={filters.startDate}
                onChange={(value) => handleFilterChange('startDate', value)}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DateInput
                placeholder="End date"
                leftSection={<IconCalendar size={16} />}
                value={filters.endDate}
                onChange={(value) => handleFilterChange('endDate', value)}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                placeholder="Reference type"
                data={[
                  { value: '', label: 'All Types' },
                  { value: 'Sale', label: 'Sale' },
                  { value: 'Return', label: 'Return' },
                  { value: 'Adjustment', label: 'Adjustment' }
                ]}
                value={filters.referenceType}
                onChange={(value) => handleFilterChange('referenceType', value)}
                clearable
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Transactions Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Stock Out Transactions</Text>
          <Badge color="red" variant="light" size="lg">
            {transactions.length} Records
          </Badge>
        </Group>

        {transactions.length > 0 ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Item</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Rate</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Balance After</Table.Th>
                <Table.Th>Notes</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transactions.map((txn) => (
                <Table.Tr key={txn._id}>
                  <Table.Td>
                    <Text size="sm">{formatDate(txn.date)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>{txn.itemId?.itemName || 'N/A'}</Text>
                      <Text size="xs" c="dimmed">{txn.itemId?.itemCode || ''}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="red" variant="light">
                      {txn.quantity} {txn.itemId?.unit || ''}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">₹{txn.rate?.toFixed(2)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatCurrency(txn.quantity * txn.rate)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {getReferenceTypeBadge(txn.referenceType)}
                  </Table.Td>
                  <Table.Td>
                    <Badge color="orange" variant="filled">
                      {txn.balanceAfter}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {txn.notes || 'N/A'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconEye size={14} />}>
                          View Details
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Paper p="xl" ta="center">
            <IconPackageExport size={48} style={{ opacity: 0.3 }} />
            <Text c="dimmed" mt="md">
              No stock out transactions found
            </Text>
            <Button
              mt="md"
              leftSection={<IconPlus size={16} />}
              onClick={() => setModalOpen(true)}
              color="red"
            >
              Add First Transaction
            </Button>
          </Paper>
        )}
      </Card>

      {/* Stock Out Modal */}
      <StockOutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchTransactions}
      />
    </Container>
  );
};

export default StockOutManagement;
