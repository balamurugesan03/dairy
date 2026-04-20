/**
 * Dairy Purchase Return List - Debit Note Management
 * ====================================================
 * View, search, filter and manage all dairy purchase returns
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  TextInput,
  Select,
  Badge,
  ActionIcon,
  Menu,
  Modal,
  Alert,
  Box,
  Grid,
  Card,
  ThemeIcon,
  Tooltip,
  Pagination
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconEye,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCurrencyRupee,
  IconReceipt,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconRefresh,
  IconCalendar,
  IconArrowBack,
  IconX
} from '@tabler/icons-react';
import { dairyPurchaseReturnAPI } from '../../services/api';
import dayjs from 'dayjs';

const DairyPurchaseReturnList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Filters
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Summary stats
  const [summary, setSummary] = useState({
    totalReturns: 0,
    totalAmount: 0,
    totalReceived: 0,
    totalPending: 0
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [search, paymentStatus, dateRange]);

  useEffect(() => {
    fetchReturns();
    fetchSummary();
  }, [pagination.page, search, paymentStatus, dateRange]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (search) params.search = search;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (dateRange[0]) params.startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');

      const response = await dairyPurchaseReturnAPI.getAll(params);
      const returnsData = response?.data?.data || response?.data || response || [];
      const paginationData = response?.data?.pagination || response?.pagination || {};

      setReturns(Array.isArray(returnsData) ? returnsData : []);
      setPagination(prev => ({
        ...prev,
        total: paginationData.total || 0,
        pages: paginationData.pages || 0
      }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch dairy purchase returns',
        color: 'red'
      });
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = {};
      if (dateRange[0]) params.startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');

      const response = await dairyPurchaseReturnAPI.getSummary(params);
      const summaryData = response?.data || response || {};
      setSummary({
        totalReturns: summaryData.totalReturns || 0,
        totalAmount: summaryData.totalAmount || 0,
        totalReceived: summaryData.totalReceived || 0,
        totalPending: summaryData.totalPending || 0
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary({
        totalReturns: 0,
        totalAmount: 0,
        totalReceived: 0,
        totalPending: 0
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedReturn) return;

    try {
      setDeleting(true);
      await dairyPurchaseReturnAPI.delete(selectedReturn._id);
      notifications.show({
        title: 'Success',
        message: 'Dairy purchase return deleted successfully',
        color: 'green'
      });
      setDeleteModalOpen(false);
      setSelectedReturn(null);
      fetchReturns();
      fetchSummary();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete dairy purchase return',
        color: 'red'
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Received': return 'green';
      case 'Partial': return 'orange';
      case 'Pending': return 'red';
      default: return 'gray';
    }
  };

  const columns = [
    {
      accessor: 'returnNumber',
      title: 'Debit Note #',
      width: 140,
      render: (record) => (
        <Group gap={6}>
          <ThemeIcon size="sm" variant="light" color="red">
            <IconArrowBack size={14} />
          </ThemeIcon>
          <Text size="sm" fw={500}>{record.returnNumber}</Text>
        </Group>
      )
    },
    {
      accessor: 'returnDate',
      title: 'Date',
      width: 100,
      render: (record) => (
        <Text size="sm">{dayjs(record.returnDate).format('DD-MM-YYYY')}</Text>
      )
    },
    {
      accessor: 'supplierName',
      title: 'Supplier',
      render: (record) => (
        <Box>
          <Text size="sm" fw={500}>{record.supplierName || '-'}</Text>
          {record.supplierPhone && (
            <Text size="xs" c="dimmed">{record.supplierPhone}</Text>
          )}
        </Box>
      )
    },
    {
      accessor: 'originalInvoiceRef',
      title: 'Orig. Invoice',
      width: 120,
      render: (record) => (
        <Text size="sm" c="dimmed">{record.originalInvoiceRef || '-'}</Text>
      )
    },
    {
      accessor: 'totalQty',
      title: 'Items',
      width: 70,
      textAlign: 'center',
      render: (record) => (
        <Text size="sm">{record.totalQty || record.items?.length || 0}</Text>
      )
    },
    {
      accessor: 'grandTotal',
      title: 'Amount',
      width: 110,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm" fw={600}>{(record.grandTotal || 0).toFixed(2)}</Text>
      )
    },
    {
      accessor: 'receivedAmount',
      title: 'Received',
      width: 100,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm" c="green">{(record.receivedAmount || 0).toFixed(2)}</Text>
      )
    },
    {
      accessor: 'balanceAmount',
      title: 'Balance',
      width: 100,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm" c={record.balanceAmount > 0 ? 'red' : 'dimmed'}>
          {(record.balanceAmount || 0).toFixed(2)}
        </Text>
      )
    },
    {
      accessor: 'paymentStatus',
      title: 'Status',
      width: 90,
      render: (record) => (
        <Badge color={getStatusColor(record.paymentStatus)} size="sm">
          {record.paymentStatus}
        </Badge>
      )
    },
    {
      accessor: 'actions',
      title: '',
      width: 80,
      render: (record) => (
        <Group gap={4} justify="flex-end">
          <Tooltip label="View">
            <ActionIcon
              variant="light"
              size="sm"
              onClick={() => navigate(`/inventory/purchase-returns/${record._id}`)}
            >
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm">
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                onClick={() => navigate(`/inventory/purchase-returns/edit/${record._id}`)}
              >
                Edit
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                onClick={() => {
                  setSelectedReturn(record);
                  setDeleteModalOpen(true);
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      )
    }
  ];

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="red">
              <IconArrowBack size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Dairy Purchase Returns</Title>
              <Text size="sm" c="dimmed">Manage debit notes and purchase returns (Dairy)</Text>
            </div>
          </Group>
          <Group gap="xs">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate('/inventory/purchase-returns/new')}
              color="red"
            >
              New Purchase Return
            </Button>
            <Button
              variant="default"
              leftSection={<IconX size={16} />}
              onClick={() => navigate('/')}
            >
              Close
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Summary Cards */}
      <Grid gutter="md" mb="md">
        <Grid.Col span={3}>
          <Card withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Total Returns</Text>
                <Text size="xl" fw={700}>{summary.totalReturns}</Text>
              </div>
              <ThemeIcon size={40} variant="light" color="violet" radius="md">
                <IconReceipt size={24} />
              </ThemeIcon>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={3}>
          <Card withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Return Amount</Text>
                <Text size="xl" fw={700} c="blue">{(summary.totalAmount || 0).toFixed(2)}</Text>
              </div>
              <ThemeIcon size={40} variant="light" color="blue" radius="md">
                <IconCurrencyRupee size={24} />
              </ThemeIcon>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={3}>
          <Card withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Received</Text>
                <Text size="xl" fw={700} c="green">{(summary.totalReceived || 0).toFixed(2)}</Text>
              </div>
              <ThemeIcon size={40} variant="light" color="green" radius="md">
                <IconCheck size={24} />
              </ThemeIcon>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={3}>
          <Card withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Pending</Text>
                <Text size="xl" fw={700} c="red">{(summary.totalPending || 0).toFixed(2)}</Text>
              </div>
              <ThemeIcon size={40} variant="light" color="red" radius="md">
                <IconClock size={24} />
              </ThemeIcon>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Grid gutter="sm" align="flex-end">
          <Grid.Col span={4}>
            <TextInput
              placeholder="Search debit note, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              placeholder="Payment Status"
              value={paymentStatus}
              onChange={setPaymentStatus}
              clearable
              data={[
                { value: 'Received', label: 'Received' },
                { value: 'Partial', label: 'Partial' },
                { value: 'Pending', label: 'Pending' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <DatePickerInput
              type="range"
              placeholder="Date Range"
              value={dateRange}
              onChange={setDateRange}
              clearable
              leftSection={<IconCalendar size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                setSearch('');
                setPaymentStatus('');
                setDateRange([null, null]);
              }}
              fullWidth
            >
              Reset
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Data Table */}
      <Paper withBorder radius="md">
        <DataTable
          columns={columns}
          records={returns}
          fetching={loading}
          minHeight={400}
          noRecordsText="No dairy purchase returns found"
          highlightOnHover
          verticalSpacing="sm"
          horizontalSpacing="md"
        />

        {/* Pagination */}
        {pagination.pages > 1 && (
          <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
              </Text>
              <Pagination
                value={pagination.page}
                onChange={(page) => setPagination(prev => ({ ...prev, page }))}
                total={pagination.pages}
                size="sm"
              />
            </Group>
          </Box>
        )}
      </Paper>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedReturn(null);
        }}
        title="Delete Dairy Purchase Return"
        centered
      >
        <Stack>
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            <Text size="sm">
              Are you sure you want to delete debit note <strong>{selectedReturn?.returnNumber}</strong>?
              This action cannot be undone and will reverse all stock transactions.
            </Text>
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setDeleteModalOpen(false);
                setSelectedReturn(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default DairyPurchaseReturnList;
