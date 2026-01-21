import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Title,
  Group,
  Button,
  TextInput,
  Select,
  Grid,
  Badge,
  ActionIcon,
  Menu,
  Checkbox,
  Collapse,
  NumberInput,
  Modal,
  Stack,
  Text,
  Box,
  Card,
  SimpleGrid
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconFileExport,
  IconEdit,
  IconEye,
  IconTrash,
  IconUsers,
  IconCircleCheck,
  IconCircle,
  IconCurrencyRupee,
  IconColumns,
  IconClearAll
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { customerAPI } from '../../services/api';
import CustomerModal from './CustomerModal';
import { useAuth } from '../../context/AuthContext';

const CustomerManagement = () => {
  const navigate = useNavigate();
  const { canWrite, canEdit, canDelete } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalBalance: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    active: 'true',
    state: '',
    district: '',
    minBalance: '',
    maxBalance: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState({
    customerId: true,
    name: true,
    phone: true,
    email: true,
    state: true,
    district: true,
    openingBalance: true,
    status: true
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchCustomers();
  }, [filters]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        active: filters.active,
        search: filters.search,
        state: filters.state,
        district: filters.district,
        minBalance: filters.minBalance,
        maxBalance: filters.maxBalance
      };
      const response = await customerAPI.getAll(params);
      setCustomers(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || response.data.length
      }));

      calculateStatistics(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch customers',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data) => {
    const stats = {
      total: data.length,
      active: data.filter(c => c.active).length,
      inactive: data.filter(c => !c.active).length,
      totalBalance: data.reduce((sum, c) => sum + (c.openingBalance || 0), 0)
    };
    setStatistics(stats);
  };

  const handleDelete = async (id) => {
    modals.openConfirmModal({
      title: 'Delete Customer',
      children: <Text size="sm">Are you sure you want to deactivate this customer?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await customerAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Customer deactivated successfully',
            color: 'green'
          });
          fetchCustomers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to deactivate customer',
            color: 'red'
          });
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCustomers.length === 0) {
      notifications.show({
        title: 'Warning',
        message: 'Please select customers to delete',
        color: 'yellow'
      });
      return;
    }

    modals.openConfirmModal({
      title: 'Bulk Delete Customers',
      children: <Text size="sm">Are you sure you want to deactivate {selectedCustomers.length} customer(s)?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await Promise.all(selectedCustomers.map(id => customerAPI.delete(id)));
          notifications.show({
            title: 'Success',
            message: `${selectedCustomers.length} customer(s) deactivated successfully`,
            color: 'green'
          });
          setSelectedCustomers([]);
          fetchCustomers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to deactivate customers',
            color: 'red'
          });
        }
      }
    });
  };

  const handleExport = (format) => {
    try {
      const exportData = customers.map(c => ({
        'Customer ID': c.customerId,
        'Name': c.name,
        'Phone': c.phone,
        'Email': c.email || '-',
        'State': c.state || '-',
        'District': c.district || '-',
        'Opening Balance': c.openingBalance?.toFixed(2) || '0.00',
        'Status': c.active ? 'Active' : 'Inactive'
      }));

      if (format === 'csv') {
        const headers = Object.keys(exportData[0]).join(',');
        const rows = exportData.map(row => Object.values(row).join(','));
        const csv = [headers, ...rows].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        notifications.show({
          title: 'Success',
          message: 'Exported to CSV successfully',
          color: 'green'
        });
      } else if (format === 'json') {
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        notifications.show({
          title: 'Success',
          message: 'Exported to JSON successfully',
          color: 'green'
        });
      }

      setShowExportModal(false);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to export data',
        color: 'red'
      });
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      active: 'true',
      state: '',
      district: '',
      minBalance: '',
      maxBalance: ''
    });
  };

  const handleOpenAddModal = () => {
    setSelectedCustomerId(null);
    setShowCustomerModal(true);
  };

  const handleOpenEditModal = (id) => {
    setSelectedCustomerId(id);
    setShowCustomerModal(true);
  };

  const handleCloseModal = () => {
    setShowCustomerModal(false);
    setSelectedCustomerId(null);
  };

  const handleModalSuccess = () => {
    fetchCustomers();
  };

  const columns = [
    visibleColumns.customerId && {
      accessor: 'customerId',
      title: 'Customer ID',
      sortable: true
    },
    visibleColumns.name && {
      accessor: 'name',
      title: 'Name',
      sortable: true
    },
    visibleColumns.phone && {
      accessor: 'phone',
      title: 'Phone'
    },
    visibleColumns.email && {
      accessor: 'email',
      title: 'Email',
      render: (customer) => customer.email || '-'
    },
    visibleColumns.state && {
      accessor: 'state',
      title: 'State',
      render: (customer) => customer.state || '-'
    },
    visibleColumns.district && {
      accessor: 'district',
      title: 'District',
      render: (customer) => customer.district || '-'
    },
    visibleColumns.openingBalance && {
      accessor: 'openingBalance',
      title: 'Opening Balance',
      sortable: true,
      render: (customer) => `₹${customer.openingBalance?.toFixed(2) || '0.00'}`
    },
    visibleColumns.status && {
      accessor: 'status',
      title: 'Status',
      render: (customer) => (
        <Badge color={customer.active ? 'green' : 'red'} variant="light">
          {customer.active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      accessor: 'actions',
      title: 'Actions',
      textAlign: 'right',
      render: (customer) => (
        <Group gap="xs" justify="flex-end">
          <ActionIcon
            variant="subtle"
            color="green"
            onClick={() => handleOpenEditModal(customer._id)}
            disabled={!canEdit('customers')}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDelete(customer._id)}
            disabled={!canDelete('customers')}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      )
    }
  ].filter(Boolean);

  return (
    <Box p="md">
      <Paper p="md" mb="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>Customer Management</Title>
            <Text c="dimmed" size="sm">Manage customer information</Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleOpenAddModal}
            disabled={!canWrite('customers')}
          >
            Add Customer
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="blue">
                <IconUsers size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Customers</Text>
                <Text size="xl" fw={700}>{statistics.total}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="green">
                <IconCircleCheck size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Active</Text>
                <Text size="xl" fw={700}>{statistics.active}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="red">
                <IconCircle size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Inactive</Text>
                <Text size="xl" fw={700}>{statistics.inactive}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="teal">
                <IconCurrencyRupee size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Balance</Text>
                <Text size="xl" fw={700}>₹{statistics.totalBalance.toFixed(2)}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        <Paper p="md" withBorder>
          <Group mb="md">
            <TextInput
              placeholder="Search by customer ID, name, phone, or email"
              leftSection={<IconSearch size={16} />}
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="All Status"
              value={filters.active}
              onChange={(value) => setFilters(prev => ({ ...prev, active: value }))}
              data={[
                { value: '', label: 'All Status' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' }
              ]}
              style={{ width: 150 }}
            />
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="default" leftSection={<IconColumns size={16} />}>
                  Columns
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {Object.keys(visibleColumns).map(col => (
                  <Menu.Item
                    key={col}
                    onClick={(e) => {
                      e.preventDefault();
                      setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
                    }}
                  >
                    <Checkbox
                      label={col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      checked={visibleColumns[col]}
                      onChange={() => {}}
                      readOnly
                    />
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="default"
              leftSection={<IconFilter size={16} />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              Advanced Filters
            </Button>
            <Button
              variant="default"
              leftSection={<IconFileExport size={16} />}
              color="green"
              onClick={() => setShowExportModal(true)}
            >
              Export
            </Button>
            {(filters.search || filters.state || filters.district || filters.minBalance || filters.maxBalance) && (
              <Button
                variant="subtle"
                leftSection={<IconClearAll size={16} />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </Group>

          <Collapse in={showAdvancedFilters}>
            <Paper p="md" withBorder mb="md">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <TextInput
                    label="State"
                    placeholder="Enter state"
                    value={filters.state}
                    onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <TextInput
                    label="District"
                    placeholder="Enter district"
                    value={filters.district}
                    onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <NumberInput
                    label="Min Balance"
                    placeholder="0"
                    value={filters.minBalance}
                    onChange={(value) => setFilters(prev => ({ ...prev, minBalance: value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <NumberInput
                    label="Max Balance"
                    placeholder="10000"
                    value={filters.maxBalance}
                    onChange={(value) => setFilters(prev => ({ ...prev, maxBalance: value }))}
                  />
                </Grid.Col>
              </Grid>
            </Paper>
          </Collapse>

          {selectedCustomers.length > 0 && (
            <Paper p="md" withBorder mb="md" bg="blue.0">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{selectedCustomers.length} customer(s) selected</Text>
                <Group gap="xs">
                  <Button size="xs" color="red" onClick={handleBulkDelete} disabled={!canDelete('customers')}>
                    Deactivate Selected
                  </Button>
                  <Button size="xs" variant="default" onClick={() => setSelectedCustomers([])}>
                    Clear Selection
                  </Button>
                </Group>
              </Group>
            </Paper>
          )}

          <DataTable
            columns={columns}
            records={customers}
            fetching={loading}
            totalRecords={pagination.total}
            recordsPerPage={pagination.pageSize}
            page={pagination.current}
            onPageChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
            recordsPerPageOptions={[10, 25, 50, 100]}
            onRecordsPerPageChange={(pageSize) => setPagination(prev => ({ ...prev, pageSize, current: 1 }))}
            selectedRecords={customers.filter(c => selectedCustomers.includes(c._id))}
            onSelectedRecordsChange={(records) => setSelectedCustomers(records.map(r => r._id))}
            highlightOnHover
            minHeight={customers.length === 0 ? 200 : undefined}
            noRecordsText="No customers found"
          />
        </Paper>
      </Paper>

      <Modal
        opened={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Customers"
      >
        <Stack>
          <Text size="sm">Choose export format:</Text>
          <Button
            variant="default"
            leftSection={<IconFileExport size={16} />}
            onClick={() => handleExport('csv')}
          >
            Export as CSV
          </Button>
          <Button
            variant="default"
            leftSection={<IconFileExport size={16} />}
            onClick={() => handleExport('json')}
          >
            Export as JSON
          </Button>
        </Stack>
      </Modal>

      <CustomerModal
        isOpen={showCustomerModal}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        customerId={selectedCustomerId}
      />
    </Box>
  );
};

export default CustomerManagement;
