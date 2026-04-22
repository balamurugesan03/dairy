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
  Loader,
  Center,
  Grid,
  Card,
  ThemeIcon,
  Tooltip,
  Divider,
  Table,
  Box
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconFileInvoice,
  IconEye,
  IconTrash,
  IconDotsVertical,
  IconDownload,
  IconCurrencyRupee,
  IconReceipt,
  IconCheck,
  IconClock,
  IconAlertCircle,
  IconRefresh,
  IconCalendar,
  IconUsers,
  IconTruck,
  IconX
} from '@tabler/icons-react';
import { salesAPI } from '../../services/api';
import dayjs from 'dayjs';

const PAGE_SIZE = 20;

const SalesList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Summary stats
  const [summary, setSummary] = useState({
    totalBills: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalBalance: 0
  });

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const response = await salesAPI.getAll({ limit: 10000 });
      const data = response?.data || response || [];
      const salesData = Array.isArray(data) ? data : [];
      setSales(salesData);
      computeSummary(salesData);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch sales',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const computeSummary = (data) => {
    const totalAmount = data.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const totalPaid = data.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const totalBalance = data.reduce((sum, s) => sum + (s.balanceAmount || 0), 0);
    setSummary({
      totalBills: data.length,
      totalAmount,
      totalPaid,
      totalBalance
    });
  };

  const handleDelete = async () => {
    if (!selectedSale) return;
    setDeleting(true);
    try {
      await salesAPI.delete(selectedSale._id);
      notifications.show({
        title: 'Deleted',
        message: `Bill ${selectedSale.billNumber} deleted successfully`,
        color: 'green'
      });
      setDeleteModalOpen(false);
      setSelectedSale(null);
      fetchSales();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete sale',
        color: 'red'
      });
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Bill No', 'Date', 'Customer', 'Type', 'Subtotal', 'GST', 'Discount', 'Grand Total', 'Paid', 'Balance', 'Status', 'Payment Mode'];
    const rows = filteredSales.map(s => [
      s.billNumber,
      dayjs(s.billDate).format('DD-MM-YYYY'),
      s.customerName || '',
      s.customerType || '',
      (s.subtotal || 0).toFixed(2),
      (s.totalGst || 0).toFixed(2),
      (s.discount || 0).toFixed(2),
      (s.grandTotal || 0).toFixed(2),
      (s.paidAmount || 0).toFixed(2),
      (s.balanceAmount || 0).toFixed(2),
      s.status || '',
      s.paymentMode || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Client-side filtering
  const filteredSales = sales.filter(s => {
    const matchesSearch = !search ||
      s.billNumber?.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      s.customerPhone?.includes(search);

    const matchesStatus = !statusFilter || s.status === statusFilter;
    const matchesType = !customerTypeFilter || s.customerType === customerTypeFilter;

    const saleDate = dayjs(s.billDate);
    const matchesDateFrom = !dateRange[0] || saleDate.isAfter(dayjs(dateRange[0]).subtract(1, 'day'));
    const matchesDateTo = !dateRange[1] || saleDate.isBefore(dayjs(dateRange[1]).add(1, 'day'));

    return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
  });

  const paginatedSales = filteredSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'green';
      case 'Partial': return 'yellow';
      case 'Pending': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Paid': return <IconCheck size={12} />;
      case 'Partial': return <IconClock size={12} />;
      default: return <IconAlertCircle size={12} />;
    }
  };

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="blue">
              <IconFileInvoice size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Dairy Sales</Title>
              <Text size="sm" c="dimmed">Inventory billing &amp; sales records</Text>
            </div>
          </Group>
          <Group>
            <Tooltip label="Export CSV">
              <ActionIcon variant="light" size="lg" onClick={exportCSV}>
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Refresh">
              <ActionIcon variant="light" size="lg" onClick={fetchSales} loading={loading}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate('/sales/new')}
            >
              New Bill
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
      <Grid mb="md" gutter="sm">
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={500}>Total Bills</Text>
              <ThemeIcon size="sm" variant="light" color="blue">
                <IconReceipt size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl">{summary.totalBills}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={500}>Total Amount</Text>
              <ThemeIcon size="sm" variant="light" color="teal">
                <IconCurrencyRupee size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="teal">₹{summary.totalAmount.toFixed(0)}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={500}>Total Paid</Text>
              <ThemeIcon size="sm" variant="light" color="green">
                <IconCheck size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="green">₹{summary.totalPaid.toFixed(0)}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <Card withBorder p="sm" radius="md">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" fw={500}>Balance Due</Text>
              <ThemeIcon size="sm" variant="light" color="red">
                <IconAlertCircle size={14} />
              </ThemeIcon>
            </Group>
            <Text fw={700} size="xl" c="red">₹{summary.totalBalance.toFixed(0)}</Text>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Paper withBorder p="sm" mb="md" radius="md">
        <Grid gutter="sm" align="flex-end">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              placeholder="Search bill no, customer..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 2 }}>
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
              data={[
                { value: 'Paid', label: 'Paid' },
                { value: 'Partial', label: 'Partial' },
                { value: 'Pending', label: 'Pending' }
              ]}
              clearable
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 2 }}>
            <Select
              placeholder="Customer Type"
              value={customerTypeFilter}
              onChange={(v) => { setCustomerTypeFilter(v || ''); setPage(1); }}
              data={[
                { value: 'Farmer', label: 'Farmer' },
                { value: 'Customer', label: 'Customer' },
                { value: 'Other', label: 'Other' }
              ]}
              clearable
              size="sm"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <DatePickerInput
              type="range"
              placeholder="Date range"
              value={dateRange}
              onChange={(v) => { setDateRange(v); setPage(1); }}
              leftSection={<IconCalendar size={16} />}
              clearable
              size="sm"
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper withBorder radius="md">
        {loading ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Loader size="md" />
              <Text c="dimmed" size="sm">Loading sales...</Text>
            </Stack>
          </Center>
        ) : (
          <DataTable
            rowExpansion={{
              content: ({ record }) => (
                <Box px="md" py="sm" bg="gray.0">
                  <Text size="xs" c="dimmed" fw={600} mb={6}>
                    Items — Bill Date: {dayjs(record.billDate).format('DD-MM-YYYY')}
                  </Text>
                  {record.items && record.items.length > 0 ? (
                    <Table
                      size="xs"
                      withTableBorder
                      withColumnBorders
                      striped
                      style={{ fontSize: 12 }}
                    >
                      <Table.Thead bg="gray.1">
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          <Table.Th>Item Name</Table.Th>
                          <Table.Th ta="right">Qty</Table.Th>
                          <Table.Th ta="right">Rate (₹)</Table.Th>
                          <Table.Th ta="right">GST Amt (₹)</Table.Th>
                          <Table.Th ta="right">Amount (₹)</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {record.items.map((item, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>{idx + 1}</Table.Td>
                            <Table.Td fw={500}>{item.itemName || '-'}</Table.Td>
                            <Table.Td ta="right">{item.quantity ?? 0}</Table.Td>
                            <Table.Td ta="right">{(item.rate || 0).toFixed(2)}</Table.Td>
                            <Table.Td ta="right">{(item.gstAmount || 0).toFixed(2)}</Table.Td>
                            <Table.Td ta="right" fw={500}>{(item.amount || 0).toFixed(2)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text size="xs" c="dimmed" ta="center" py="xs">No item details available</Text>
                  )}
                </Box>
              )
            }}
            columns={[
              {
                accessor: 'billNumber',
                title: 'Bill No',
                render: (row) => (
                  <Text size="sm" fw={600} c="blue" style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/sales/view/${row._id}`)}
                  >
                    {row.billNumber}
                  </Text>
                )
              },
              {
                accessor: 'billDate',
                title: 'Date',
                render: (row) => (
                  <Text size="sm">{dayjs(row.billDate).format('DD-MM-YYYY')}</Text>
                )
              },
              {
                accessor: 'customerName',
                title: 'Customer',
                render: (row) => (
                  <Stack gap={2}>
                    <Text size="sm" fw={500}>{row.customerName || 'Walk-in'}</Text>
                    {row.customerPhone && (
                      <Text size="xs" c="dimmed">{row.customerPhone}</Text>
                    )}
                  </Stack>
                )
              },
              {
                accessor: 'customerType',
                title: 'Type',
                render: (row) => (
                  <Badge
                    size="sm"
                    variant="light"
                    color={row.customerType === 'Farmer' ? 'blue' : row.customerType === 'Customer' ? 'teal' : 'gray'}
                    leftSection={row.customerType === 'Farmer' ? <IconTruck size={10} /> : <IconUsers size={10} />}
                  >
                    {row.customerType || 'Other'}
                  </Badge>
                )
              },
              {
                accessor: 'grandTotal',
                title: 'Grand Total',
                textAlign: 'right',
                render: (row) => (
                  <Text size="sm" fw={600}>₹{(row.grandTotal || 0).toFixed(2)}</Text>
                )
              },
              {
                accessor: 'paidAmount',
                title: 'Paid',
                textAlign: 'right',
                render: (row) => (
                  <Text size="sm" c="green">₹{(row.paidAmount || 0).toFixed(2)}</Text>
                )
              },
              {
                accessor: 'balanceAmount',
                title: 'Balance',
                textAlign: 'right',
                render: (row) => (
                  <Text size="sm" c={(row.balanceAmount || 0) > 0 ? 'red' : 'dimmed'}>
                    ₹{(row.balanceAmount || 0).toFixed(2)}
                  </Text>
                )
              },
              {
                accessor: 'status',
                title: 'Status',
                render: (row) => (
                  <Badge
                    size="sm"
                    color={getStatusColor(row.status)}
                    leftSection={getStatusIcon(row.status)}
                  >
                    {row.status || 'Pending'}
                  </Badge>
                )
              },
              {
                accessor: 'paymentMode',
                title: 'Payment',
                render: (row) => (
                  <Badge size="sm" variant="outline" color="gray">{row.paymentMode || '-'}</Badge>
                )
              },
              {
                accessor: 'actions',
                title: '',
                width: 60,
                render: (row) => (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="sm">
                        <IconDotsVertical size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEye size={14} />}
                        onClick={() => navigate(`/sales/view/${row._id}`)}
                      >
                        View Details
                      </Menu.Item>
                      <Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => { setSelectedSale(row); setDeleteModalOpen(true); }}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )
              }
            ]}
            records={paginatedSales}
            totalRecords={filteredSales.length}
            recordsPerPage={PAGE_SIZE}
            page={page}
            onPageChange={setPage}
            noRecordsText="No sales found"
            minHeight={200}
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
          />
        )}
      </Paper>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setSelectedSale(null); }}
        title={<Text fw={600} c="red">Delete Sale</Text>}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete bill <Text span fw={700}>{selectedSale?.billNumber}</Text>?
            This will reverse all stock transactions.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="light" color="gray" onClick={() => { setDeleteModalOpen(false); setSelectedSale(null); }}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default SalesList;
