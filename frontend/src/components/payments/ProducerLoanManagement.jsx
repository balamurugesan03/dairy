import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from '../../utils/toast';
import { producerLoanAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Container,
  Card,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Select,
  TextInput,
  Button,
  Table,
  Badge,
  Loader,
  Box,
  ActionIcon,
  Grid,
  ScrollArea,
  Pagination,
  Menu,
  Modal,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconX,
  IconDotsVertical,
  IconCurrencyRupee,
  IconUsers,
  IconReceipt,
  IconTrendingUp,
  IconFilter,
  IconRefresh,
} from '@tabler/icons-react';
import ProducerLoanModal from './ProducerLoanModal';

const ProducerLoanManagement = () => {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState({
    totalDisbursed: 0,
    totalOutstanding: 0,
    totalRecovered: 0,
    count: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 10
  });

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    loanType: '',
    fromDate: null,
    toDate: null,
    search: ''
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchLoans();
  }, [pagination.page, filters]);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: 'loanDate',
        sortOrder: 'desc'
      };

      if (filters.status) params.status = filters.status;
      if (filters.loanType) params.loanType = filters.loanType;
      if (filters.fromDate) params.fromDate = filters.fromDate.toISOString();
      if (filters.toDate) params.toDate = filters.toDate.toISOString();

      const response = await producerLoanAPI.getAll(params);
      setLoans(response.data || []);
      setSummary(response.summary || {
        totalDisbursed: 0,
        totalOutstanding: 0,
        totalRecovered: 0,
        count: 0
      });
      setPagination(prev => ({
        ...prev,
        ...response.pagination
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch loans');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: '',
      loanType: '',
      fromDate: null,
      toDate: null,
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleCancelLoan = async () => {
    if (!selectedLoan || !cancelReason.trim()) {
      message.error('Please provide a cancellation reason');
      return;
    }

    try {
      await producerLoanAPI.cancel(selectedLoan._id, cancelReason);
      message.success('Loan cancelled successfully');
      setCancelModalOpen(false);
      setSelectedLoan(null);
      setCancelReason('');
      fetchLoans();
    } catch (error) {
      message.error(error.message || 'Failed to cancel loan');
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'blue';
      case 'Closed': return 'green';
      case 'Defaulted': return 'red';
      case 'Cancelled': return 'gray';
      default: return 'gray';
    }
  };

  const getLoanTypeColor = (type) => {
    switch (type) {
      case 'Loan Advance': return 'violet';
      case 'CF Advance': return 'orange';
      case 'Cash Advance': return 'cyan';
      default: return 'gray';
    }
  };

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'Active', label: 'Active' },
    { value: 'Closed', label: 'Closed' },
    { value: 'Defaulted', label: 'Defaulted' },
    { value: 'Cancelled', label: 'Cancelled' }
  ];

  const loanTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'Cash Advance', label: 'Cash Advance' },
    { value: 'CF Advance', label: 'CF Advance' },
    { value: 'Loan Advance', label: 'Loan Advance' }
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={2}>Producer Loan Management</Title>
            <Text c="dimmed" size="sm">Manage farmer loans, advances, and EMI schedules</Text>
          </Box>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => setModalOpen(true)}
            disabled={!canWrite('payments')}
          >
            New Loan
          </Button>
        </Group>

        {/* Summary Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Disbursed</Text>
                  <Text size="xl" fw={700} c="blue">{formatCurrency(summary.totalDisbursed)}</Text>
                </Box>
                <IconCurrencyRupee size={32} stroke={1.5} color="var(--mantine-color-blue-6)" />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Outstanding</Text>
                  <Text size="xl" fw={700} c="orange">{formatCurrency(summary.totalOutstanding)}</Text>
                </Box>
                <IconReceipt size={32} stroke={1.5} color="var(--mantine-color-orange-6)" />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Recovered</Text>
                  <Text size="xl" fw={700} c="green">{formatCurrency(summary.totalRecovered)}</Text>
                </Box>
                <IconTrendingUp size={32} stroke={1.5} color="var(--mantine-color-green-6)" />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Active Loans</Text>
                  <Text size="xl" fw={700}>{summary.count}</Text>
                </Box>
                <IconUsers size={32} stroke={1.5} color="var(--mantine-color-gray-6)" />
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <IconFilter size={18} />
              <Text fw={600}>Filters</Text>
            </Group>
            <Group gap="xs">
              <Button variant="subtle" size="xs" onClick={handleClearFilters}>
                Clear Filters
              </Button>
              <ActionIcon variant="subtle" onClick={fetchLoans}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Group>
          </Group>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                placeholder="Status"
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                data={statusOptions}
                clearable
                size="sm"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                placeholder="Loan Type"
                value={filters.loanType}
                onChange={(value) => handleFilterChange('loanType', value)}
                data={loanTypeOptions}
                clearable
                size="sm"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                placeholder="From Date"
                value={filters.fromDate}
                onChange={(value) => handleFilterChange('fromDate', value)}
                clearable
                size="sm"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                placeholder="To Date"
                value={filters.toDate}
                onChange={(value) => handleFilterChange('toDate', value)}
                clearable
                size="sm"
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Loans Table */}
        <Card withBorder shadow="sm" radius="md">
          {loading ? (
            <Box py="xl" style={{ textAlign: 'center' }}>
              <Loader size="md" />
            </Box>
          ) : loans.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">No loans found</Text>
          ) : (
            <>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Loan No</Table.Th>
                      <Table.Th>Farmer</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Principal</Table.Th>
                      <Table.Th>EMI</Table.Th>
                      <Table.Th>Outstanding</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {loans.map((loan) => (
                      <Table.Tr key={loan._id}>
                        <Table.Td>{formatDate(loan.loanDate)}</Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{loan.loanNumber}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {loan.farmerId?.farmerNumber || '-'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {loan.farmerId?.personalDetails?.name || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getLoanTypeColor(loan.loanType)} variant="light" size="sm">
                            {loan.loanType}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{formatCurrency(loan.principalAmount)}</Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatCurrency(loan.emiAmount)}</Text>
                          <Text size="xs" c="dimmed">{loan.totalEMI} EMIs</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={600} c={loan.outstandingAmount > 0 ? 'orange' : 'green'}>
                            {formatCurrency(loan.outstandingAmount)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getStatusColor(loan.status)} variant="light">
                            {loan.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon variant="subtle">
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconEye size={14} />}
                                onClick={() => navigate(`/payments/loans/${loan._id}`)}
                              >
                                View Details
                              </Menu.Item>
                              {loan.status === 'Active' && canWrite('payments') && (
                                <Menu.Item
                                  leftSection={<IconX size={14} />}
                                  color="red"
                                  onClick={() => {
                                    setSelectedLoan(loan);
                                    setCancelModalOpen(true);
                                  }}
                                >
                                  Cancel Loan
                                </Menu.Item>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={pagination.pages}
                    value={pagination.page}
                    onChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  />
                </Group>
              )}
            </>
          )}
        </Card>

        {/* New Loan Modal */}
        <ProducerLoanModal
          opened={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            fetchLoans();
          }}
        />

        {/* Cancel Confirmation Modal */}
        <Modal
          opened={cancelModalOpen}
          onClose={() => {
            setCancelModalOpen(false);
            setSelectedLoan(null);
            setCancelReason('');
          }}
          title="Cancel Loan"
          centered
        >
          <Stack>
            <Text size="sm">
              Are you sure you want to cancel loan <strong>{selectedLoan?.loanNumber}</strong>?
            </Text>
            <TextInput
              label="Cancellation Reason"
              placeholder="Enter reason for cancellation"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={() => setCancelModalOpen(false)}>
                No, Keep It
              </Button>
              <Button color="red" onClick={handleCancelLoan}>
                Yes, Cancel Loan
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
};

export default ProducerLoanManagement;
