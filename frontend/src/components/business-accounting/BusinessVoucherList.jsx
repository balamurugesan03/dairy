/**
 * Business Voucher List - For Private Firm
 * View and manage all business vouchers
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
  Modal,
  Alert,
  ThemeIcon,
  Grid,
  Box,
  Pagination
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconFileText,
  IconEye,
  IconTrash,
  IconCalendar,
  IconAlertCircle,
  IconArrowDownCircle,
  IconArrowUpCircle,
  IconArrowsExchange,
  IconRefresh
} from '@tabler/icons-react';
import { businessVoucherAPI } from '../../services/api';
import dayjs from 'dayjs';

const BusinessVoucherList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Filters
  const [search, setSearch] = useState('');
  const [voucherType, setVoucherType] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // View modal
  const [viewModalOpen, setViewModalOpen] = useState(false);

  useEffect(() => {
    fetchVouchers();
  }, [pagination.page, search, voucherType, dateRange]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };

      if (search) params.search = search;
      if (voucherType) params.voucherType = voucherType;
      if (dateRange[0]) params.startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');

      const response = await businessVoucherAPI.getAll(params);
      const voucherData = response?.data || response || [];

      setVouchers(Array.isArray(voucherData) ? voucherData : []);
      setPagination(prev => ({
        ...prev,
        total: response?.pagination?.total || 0,
        pages: response?.pagination?.pages || 0
      }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch vouchers',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (voucher) => {
    try {
      const response = await businessVoucherAPI.getById(voucher._id);
      setSelectedVoucher(response?.data || response);
      setViewModalOpen(true);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch voucher details',
        color: 'red'
      });
    }
  };

  const handleDelete = (voucher) => {
    setSelectedVoucher(voucher);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await businessVoucherAPI.delete(selectedVoucher._id);
      notifications.show({
        title: 'Success',
        message: 'Voucher deleted successfully',
        color: 'green'
      });
      setDeleteModalOpen(false);
      setSelectedVoucher(null);
      fetchVouchers();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete voucher',
        color: 'red'
      });
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Income': return <IconArrowDownCircle size={16} />;
      case 'Expense': return <IconArrowUpCircle size={16} />;
      case 'Journal': return <IconArrowsExchange size={16} />;
      default: return <IconFileText size={16} />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Income': return 'green';
      case 'Expense': return 'red';
      case 'Journal': return 'violet';
      case 'Sales': return 'blue';
      case 'Purchase': return 'orange';
      default: return 'gray';
    }
  };

  const columns = [
    {
      accessor: 'voucherNumber',
      title: 'Voucher #',
      width: 130,
      render: (record) => (
        <Group gap={6}>
          <ThemeIcon size="sm" variant="light" color={getTypeColor(record.voucherType)}>
            {getTypeIcon(record.voucherType)}
          </ThemeIcon>
          <Text size="sm" fw={500}>{record.voucherNumber}</Text>
        </Group>
      )
    },
    {
      accessor: 'date',
      title: 'Date',
      width: 100,
      render: (record) => (
        <Text size="sm">{dayjs(record.date).format('DD-MM-YYYY')}</Text>
      )
    },
    {
      accessor: 'voucherType',
      title: 'Type',
      width: 100,
      render: (record) => (
        <Badge color={getTypeColor(record.voucherType)} size="sm" variant="light">
          {record.voucherType}
        </Badge>
      )
    },
    {
      accessor: 'narration',
      title: 'Narration',
      render: (record) => (
        <Text size="sm" lineClamp={1}>{record.narration || '-'}</Text>
      )
    },
    {
      accessor: 'totalDebit',
      title: 'Debit',
      width: 110,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm" c="blue">{(record.totalDebit || 0).toFixed(2)}</Text>
      )
    },
    {
      accessor: 'totalCredit',
      title: 'Credit',
      width: 110,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm" c="orange">{(record.totalCredit || 0).toFixed(2)}</Text>
      )
    },
    {
      accessor: 'actions',
      title: '',
      width: 80,
      render: (record) => (
        <Group gap={4} justify="flex-end">
          <ActionIcon variant="light" size="sm" onClick={() => handleView(record)}>
            <IconEye size={14} />
          </ActionIcon>
          <ActionIcon variant="light" size="sm" color="red" onClick={() => handleDelete(record)}>
            <IconTrash size={14} />
          </ActionIcon>
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
              <IconFileText size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Business Vouchers</Title>
              <Text size="sm" c="dimmed">View and manage all accounting vouchers</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="green"
              onClick={() => navigate('/business-accounting/income')}
            >
              Income Voucher
            </Button>
            <Button
              variant="light"
              color="red"
              onClick={() => navigate('/business-accounting/expense')}
            >
              Expense Voucher
            </Button>
            <Button
              variant="light"
              color="violet"
              onClick={() => navigate('/business-accounting/journal')}
            >
              Journal Voucher
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Filters */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Grid gutter="sm" align="flex-end">
          <Grid.Col span={3}>
            <TextInput
              placeholder="Search voucher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <Select
              placeholder="Voucher Type"
              value={voucherType}
              onChange={setVoucherType}
              clearable
              data={[
                { value: 'Income', label: 'Income' },
                { value: 'Expense', label: 'Expense' },
                { value: 'Journal', label: 'Journal' },
                { value: 'Sales', label: 'Sales' },
                { value: 'Purchase', label: 'Purchase' }
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
                setVoucherType('');
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
          records={vouchers}
          fetching={loading}
          minHeight={400}
          noRecordsText="No vouchers found"
          highlightOnHover
          verticalSpacing="sm"
        />

        {pagination.pages > 1 && (
          <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
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

      {/* View Modal */}
      <Modal
        opened={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Voucher: ${selectedVoucher?.voucherNumber}`}
        size="lg"
      >
        {selectedVoucher && (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Date</Text>
                <Text fw={500}>{dayjs(selectedVoucher.date).format('DD-MM-YYYY')}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Type</Text>
                <Badge color={getTypeColor(selectedVoucher.voucherType)}>
                  {selectedVoucher.voucherType}
                </Badge>
              </Grid.Col>
            </Grid>

            <Box>
              <Text size="sm" c="dimmed" mb="xs">Entries</Text>
              <Paper withBorder p="sm" radius="sm">
                <Stack gap="xs">
                  {selectedVoucher.entries?.map((entry, index) => (
                    <Group key={index} justify="space-between">
                      <Text size="sm">
                        {entry.ledgerName || entry.ledgerId?.name}
                      </Text>
                      <Group gap="md">
                        {entry.type === 'debit' ? (
                          <Text size="sm" c="blue" fw={500}>
                            Dr: {entry.amount.toFixed(2)}
                          </Text>
                        ) : (
                          <Text size="sm" c="orange" fw={500}>
                            Cr: {entry.amount.toFixed(2)}
                          </Text>
                        )}
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            </Box>

            <Grid>
              <Grid.Col span={6}>
                <Paper withBorder p="sm" radius="sm" bg="blue.0">
                  <Group justify="space-between">
                    <Text size="sm">Total Debit</Text>
                    <Text fw={600} c="blue">{selectedVoucher.totalDebit?.toFixed(2)}</Text>
                  </Group>
                </Paper>
              </Grid.Col>
              <Grid.Col span={6}>
                <Paper withBorder p="sm" radius="sm" bg="orange.0">
                  <Group justify="space-between">
                    <Text size="sm">Total Credit</Text>
                    <Text fw={600} c="orange">{selectedVoucher.totalCredit?.toFixed(2)}</Text>
                  </Group>
                </Paper>
              </Grid.Col>
            </Grid>

            {selectedVoucher.narration && (
              <Box>
                <Text size="sm" c="dimmed">Narration</Text>
                <Text>{selectedVoucher.narration}</Text>
              </Box>
            )}
          </Stack>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Voucher"
        centered
      >
        <Stack>
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Are you sure you want to delete voucher "{selectedVoucher?.voucherNumber}"?
            This will reverse all ledger entries.
          </Alert>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button color="red" onClick={confirmDelete} loading={deleting}>Delete</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default BusinessVoucherList;
