/**
 * Business Sales List - Invoice Management
 * =========================================
 * View, search, filter and manage all business invoices
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
  Loader,
  Center,
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
  IconFilter,
  IconFileInvoice,
  IconEye,
  IconEdit,
  IconTrash,
  IconPrinter,
  IconDotsVertical,
  IconDownload,
  IconCurrencyRupee,
  IconReceipt,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconRefresh,
  IconCalendar
} from '@tabler/icons-react';
import { businessSalesAPI } from '../../services/api';
import dayjs from 'dayjs';

const BusinessSalesList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Filters
  const [search, setSearch] = useState('');
  const [invoiceType, setInvoiceType] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Summary stats
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalPaid: 0,
    totalBalance: 0,
    totalInvoices: 0
  });

  useEffect(() => {
    fetchSales();
    fetchSummary();
  }, [pagination.page, search, invoiceType, paymentStatus, dateRange]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (search) params.search = search;
      if (invoiceType) params.invoiceType = invoiceType;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (dateRange[0]) params.startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');

      const response = await businessSalesAPI.getAll(params);
      // Handle different response structures
      const salesData = response?.data?.data || response?.data || response || [];
      const paginationData = response?.data?.pagination || response?.pagination || {};

      setSales(Array.isArray(salesData) ? salesData : []);
      setPagination(prev => ({
        ...prev,
        total: paginationData.total || 0,
        pages: paginationData.pages || 0
      }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch sales',
        color: 'red'
      });
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = {};
      if (dateRange[0]) params.startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');

      const response = await businessSalesAPI.getSummary(params);
      const summaryData = response?.summary || response?.data?.summary || response || {};
      setSummary({
        totalSales: summaryData.totalSales || 0,
        totalPaid: summaryData.totalPaid || 0,
        totalBalance: summaryData.totalBalance || 0,
        totalInvoices: summaryData.totalInvoices || 0
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary({
        totalSales: 0,
        totalPaid: 0,
        totalBalance: 0,
        totalInvoices: 0
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedSale) return;

    try {
      setDeleting(true);
      await businessSalesAPI.delete(selectedSale._id);
      notifications.show({
        title: 'Success',
        message: 'Invoice deleted successfully',
        color: 'green'
      });
      setDeleteModalOpen(false);
      setSelectedSale(null);
      fetchSales();
      fetchSummary();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete invoice',
        color: 'red'
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'green';
      case 'Partial': return 'orange';
      case 'Unpaid': return 'red';
      default: return 'gray';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Sale': return 'blue';
      case 'Sale Return': return 'red';
      case 'Estimate': return 'yellow';
      case 'Delivery Challan': return 'cyan';
      case 'Proforma': return 'violet';
      default: return 'gray';
    }
  };

  const columns = [
    {
      accessor: 'invoiceNumber',
      title: 'Invoice #',
      width: 130,
      render: (record) => (
        <Group gap={6}>
          <ThemeIcon size="sm" variant="light" color={getTypeColor(record.invoiceType)}>
            <IconFileInvoice size={14} />
          </ThemeIcon>
          <Text size="sm" fw={500}>{record.invoiceNumber}</Text>
        </Group>
      )
    },
    {
      accessor: 'invoiceDate',
      title: 'Date',
      width: 100,
      render: (record) => (
        <Text size="sm">{dayjs(record.invoiceDate).format('DD-MM-YYYY')}</Text>
      )
    },
    {
      accessor: 'invoiceType',
      title: 'Type',
      width: 120,
      render: (record) => (
        <Badge color={getTypeColor(record.invoiceType)} size="sm" variant="light">
          {record.invoiceType}
        </Badge>
      )
    },
    {
      accessor: 'partyName',
      title: 'Party',
      render: (record) => (
        <Box>
          <Text size="sm" fw={500}>{record.partyName || 'Walk-in'}</Text>
          {record.partyPhone && (
            <Text size="xs" c="dimmed">{record.partyPhone}</Text>
          )}
        </Box>
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
      accessor: 'paidAmount',
      title: 'Paid',
      width: 100,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm" c="green">{(record.paidAmount || 0).toFixed(2)}</Text>
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
              onClick={() => navigate(`/business-inventory/sales/${record._id}`)}
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
                onClick={() => navigate(`/business-inventory/sales/edit/${record._id}`)}
              >
                Edit
              </Menu.Item>
              <Menu.Item
                leftSection={<IconPrinter size={14} />}
                onClick={() => {
                  // Handle print
                }}
              >
                Print
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                onClick={() => {
                  setSelectedSale(record);
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
            <ThemeIcon size={40} radius="md" variant="light" color="violet">
              <IconReceipt size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Sales Invoices</Title>
              <Text size="sm" c="dimmed">Manage your business sales and invoices</Text>
            </div>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/business-inventory/sales/new')}
            color="green"
          >
            New Invoice
          </Button>
        </Group>
      </Paper>

      {/* Summary Cards */}
      <Grid gutter="md" mb="md">
        <Grid.Col span={3}>
          <Card withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Total Sales</Text>
                <Text size="xl" fw={700} c="blue">{summary.totalSales?.toFixed(2) || '0.00'}</Text>
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
                <Text size="xl" fw={700} c="green">{summary.totalPaid?.toFixed(2) || '0.00'}</Text>
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
                <Text size="xs" c="dimmed" tt="uppercase">Outstanding</Text>
                <Text size="xl" fw={700} c="red">{summary.totalBalance?.toFixed(2) || '0.00'}</Text>
              </div>
              <ThemeIcon size={40} variant="light" color="red" radius="md">
                <IconClock size={24} />
              </ThemeIcon>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={3}>
          <Card withBorder p="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase">Invoices</Text>
                <Text size="xl" fw={700}>{summary.totalInvoices || 0}</Text>
              </div>
              <ThemeIcon size={40} variant="light" color="violet" radius="md">
                <IconFileInvoice size={24} />
              </ThemeIcon>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Grid gutter="sm" align="flex-end">
          <Grid.Col span={3}>
            <TextInput
              placeholder="Search invoice, party..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              placeholder="Invoice Type"
              value={invoiceType}
              onChange={setInvoiceType}
              clearable
              data={[
                { value: 'Sale', label: 'Sale' },
                { value: 'Sale Return', label: 'Sale Return' },
                { value: 'Estimate', label: 'Estimate' },
                { value: 'Delivery Challan', label: 'Delivery Challan' },
                { value: 'Proforma', label: 'Proforma' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={2}>
            <Select
              placeholder="Payment Status"
              value={paymentStatus}
              onChange={setPaymentStatus}
              clearable
              data={[
                { value: 'Paid', label: 'Paid' },
                { value: 'Partial', label: 'Partial' },
                { value: 'Unpaid', label: 'Unpaid' }
              ]}
            />
          </Grid.Col>
          <Grid.Col span={3}>
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
            <Group gap="xs">
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => {
                  setSearch('');
                  setInvoiceType('');
                  setPaymentStatus('');
                  setDateRange([null, null]);
                }}
              >
                Reset
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Data Table */}
      <Paper withBorder radius="md">
        <DataTable
          columns={columns}
          records={sales}
          fetching={loading}
          minHeight={400}
          noRecordsText="No invoices found"
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
          setSelectedSale(null);
        }}
        title="Delete Invoice"
        centered
      >
        <Stack>
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            <Text size="sm">
              Are you sure you want to delete invoice <strong>{selectedSale?.invoiceNumber}</strong>?
              This action cannot be undone and will reverse all stock transactions.
            </Text>
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setDeleteModalOpen(false);
                setSelectedSale(null);
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

export default BusinessSalesList;
