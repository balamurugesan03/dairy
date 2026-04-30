import { useState, useEffect, useRef } from 'react';
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
  SimpleGrid,
  ScrollArea,
  Table,
  Progress,
  Alert
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconFileExport,
  IconFileImport,
  IconEdit,
  IconEye,
  IconTrash,
  IconUsers,
  IconCircleCheck,
  IconCircle,
  IconCurrencyRupee,
  IconColumns,
  IconClearAll,
  IconUpload,
  IconAlertCircle,
  IconX
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import { customerAPI } from '../../services/api';
import CustomerModal from './CustomerModal';
import { useAuth } from '../../context/AuthContext';

// Flexible column name → customer field mapping
const COLUMN_MAP = {
  'name': 'name', 'customer name': 'name', 'customername': 'name',
  'party name': 'name', 'partyname': 'name', 'customer': 'name',
  'phone': 'phone', 'mobile': 'phone', 'mobile no': 'phone',
  'phone no': 'phone', 'contact': 'phone', 'contact no': 'phone',
  'mobile number': 'phone', 'phone number': 'phone',
  'email': 'email', 'email address': 'email', 'emailid': 'email',
  'state': 'state',
  'district': 'district', 'city': 'district',
  'opening balance': 'openingBalance', 'balance': 'openingBalance',
  'ob': 'openingBalance', 'opening bal': 'openingBalance',
  'gstin': 'gstin', 'gst': 'gstin', 'gstin/uin': 'gstin', 'gst no': 'gstin',
  'address': 'address', 'full address': 'address'
};

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
    category: '',
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
    category: true,
    state: true,
    district: true,
    openingBalance: true,
    status: true
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importMapping, setImportMapping] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isOpenLyssaImport, setIsOpenLyssaImport] = useState(false);
  const fileInputRef = useRef(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [sortStatus, setSortStatus] = useState({ columnAccessor: '', direction: 'asc' });

  useEffect(() => {
    fetchCustomers();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [filters]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        active: filters.active,
        search: filters.search,
        category: filters.category,
        state: filters.state,
        district: filters.district,
        minBalance: filters.minBalance,
        maxBalance: filters.maxBalance
      };
      const [pageRes, allRes] = await Promise.all([
        customerAPI.getAll(params),
        customerAPI.getAll({ limit: 1000 })
      ]);
      setCustomers(pageRes.data);
      setPagination(prev => ({
        ...prev,
        total: pageRes.pagination?.total || pageRes.data.length
      }));
      calculateStatistics(allRes.data);
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
      children: (
        <Text size="sm">
          Are you sure you want to <strong>permanently delete</strong> {selectedCustomers.length} customer(s)?
          This will also remove their ledger accounts. This action cannot be undone.
        </Text>
      ),
      labels: { confirm: `Delete ${selectedCustomers.length} Customer(s)`, cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await customerAPI.bulkDelete(selectedCustomers);
          notifications.show({
            title: 'Deleted',
            message: `${selectedCustomers.length} customer(s) permanently deleted`,
            color: 'green'
          });
          setSelectedCustomers([]);
          fetchCustomers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to delete customers',
            color: 'red'
          });
        }
      }
    });
  };

  const handleExport = (format) => {
    if (customers.length === 0) {
      notifications.show({ title: 'Warning', message: 'No data to export', color: 'yellow' });
      return;
    }
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

  const parseDateTime = (val) => {
    if (!val) return undefined;
    if (typeof val === 'number') {
      if (val <= 0) return undefined;
      return new Date(Math.round((val - 25569) * 86400 * 1000));
    }
    const str = String(val).trim();
    if (!str || str === '0000-00-00' || str.startsWith('#')) return undefined;
    const m = str.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}:\d{2}))?/);
    if (m) {
      const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] || '00:00'}:00`);
      return isNaN(d.getTime()) ? undefined : d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? undefined : d;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rawRows.length < 2) {
          notifications.show({ title: 'Error', message: 'Excel file has no data rows', color: 'red' });
          return;
        }
        const headers = rawRows[0].map(h => String(h).trim().toLowerCase());

        // ── OpenLyssa format detection ──────────────────────────────────────
        if (headers.includes('cust_id')) {
          setIsOpenLyssaImport(true);
          const dataRows = rawRows.slice(1).filter(row => row.some(c => c !== ''));
          const getIdx = (col) => headers.indexOf(col);
          const parsed = dataRows
            .map(row => ({
              customerId:    String(row[getIdx('cust_id')] ?? '').trim(),
              name:          String(row[getIdx('name')] ?? '').trim(),
              address:       String(row[getIdx('address')] ?? '').trim() || undefined,
              catId:         String(row[getIdx('cat_id')] ?? '').trim(),
              active:        String(row[getIdx('active')] ?? '').trim().toUpperCase() !== 'N',
              dateOfJoining: parseDateTime(row[getIdx('date_entry')]),
            }))
            .filter(r => r.customerId && r.name);
          setImportHeaders(['customerId', 'name', 'address', 'catId', 'active']);
          setImportMapping({});
          setImportRows(parsed);
          notifications.show({
            title: 'OpenLyssa Format Detected',
            message: `${parsed.length} customers ready to import`,
            color: 'blue'
          });
          e.target.value = '';
          return;
        }

        // ── Standard column mapping ─────────────────────────────────────────
        setIsOpenLyssaImport(false);
        const mapping = {};
        headers.forEach((h, i) => {
          const key = h.replace(/\s+/g, ' ').trim();
          if (COLUMN_MAP[key]) mapping[i] = COLUMN_MAP[key];
        });
        if (Object.keys(mapping).length === 0) {
          notifications.show({
            title: 'No matching columns',
            message: `Headers found: ${headers.join(', ')}`,
            color: 'orange'
          });
          return;
        }
        const dataRows = rawRows.slice(1).filter(row => row.some(cell => cell !== ''));
        const parsed = dataRows.map(row => {
          const obj = {};
          Object.entries(mapping).forEach(([colIdx, field]) => {
            obj[field] = row[colIdx] !== undefined && row[colIdx] !== '' ? String(row[colIdx]).trim() : '';
          });
          return obj;
        }).filter(obj => obj.name);
        setImportHeaders(Object.values(mapping).filter((v, i, arr) => arr.indexOf(v) === i));
        setImportMapping(mapping);
        setImportRows(parsed);
        if (parsed.length === 0) {
          notifications.show({ title: 'Warning', message: 'No valid rows found (name column required)', color: 'yellow' });
        }
      } catch (err) {
        notifications.show({ title: 'Parse Error', message: 'Could not read Excel file', color: 'red' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) return;
    setImportLoading(true);
    setImportProgress(0);

    // ── OpenLyssa: single bulk API call ────────────────────────────────────
    if (isOpenLyssaImport) {
      try {
        const response = await customerAPI.bulkImport(importRows);
        const { created, updated, errors } = response.data;
        notifications.show({
          title: 'Import Complete',
          message: `${created} created, ${updated} updated, ${errors.length} failed`,
          color: errors.length === 0 ? 'green' : 'orange'
        });
      } catch (err) {
        notifications.show({ title: 'Import Failed', message: err.message || 'Import failed', color: 'red' });
      }
      setImportLoading(false);
      setImportProgress(100);
      setShowImportModal(false);
      setImportRows([]);
      setIsOpenLyssaImport(false);
      fetchCustomers();
      return;
    }

    // ── Standard: one by one ───────────────────────────────────────────────
    let success = 0, failed = 0;
    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      try {
        const payload = {
          name: row.name,
          phone: row.phone || '',
          email: row.email || '',
          state: row.state || '',
          district: row.district || '',
          address: row.address || '',
          gstin: row.gstin || '',
          openingBalance: row.openingBalance ? parseFloat(row.openingBalance) || 0 : 0
        };
        await customerAPI.create(payload);
        success++;
      } catch { failed++; }
      setImportProgress(Math.round(((i + 1) / importRows.length) * 100));
    }
    setImportLoading(false);
    notifications.show({
      title: 'Import Complete',
      message: `${success} imported, ${failed} failed`,
      color: failed === 0 ? 'green' : 'orange'
    });
    setShowImportModal(false);
    setImportRows([]);
    setImportHeaders([]);
    fetchCustomers();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      active: 'true',
      category: '',
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

  const getSortedCustomers = () => {
    const { columnAccessor: col, direction: dir } = sortStatus;
    if (!col) return customers;
    const d = dir === 'asc' ? 1 : -1;
    return [...customers].sort((a, b) => {
      let av, bv;
      if (col === 'customerId')      { av = a.customerId;      bv = b.customerId; }
      else if (col === 'name')       { av = a.name;            bv = b.name; }
      else if (col === 'phone')      { av = a.phone;           bv = b.phone; }
      else if (col === 'category')   { av = a.category;        bv = b.category; }
      else if (col === 'district')   { av = a.district;        bv = b.district; }
      else if (col === 'openingBalance') { av = a.openingBalance ?? 0; bv = b.openingBalance ?? 0; }
      else if (col === 'status')     { av = a.active ? 'Active' : 'Inactive'; bv = b.active ? 'Active' : 'Inactive'; }
      else return 0;
      if (av == null) return d; if (bv == null) return -d;
      if (typeof av === 'string') return av.localeCompare(bv) * d;
      return (av > bv ? 1 : av < bv ? -1 : 0) * d;
    });
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
      title: 'Phone',
      sortable: true,
    },
    visibleColumns.email && {
      accessor: 'email',
      title: 'Email',
      render: (customer) => customer.email || '-'
    },
    visibleColumns.category && {
      accessor: 'category',
      title: 'Category',
      sortable: true,
      render: (customer) => customer.category ? (
        <Badge color="grape" variant="light">{customer.category}</Badge>
      ) : '-'
    },
    visibleColumns.state && {
      accessor: 'state',
      title: 'State',
      render: (customer) => customer.state || '-'
    },
    visibleColumns.district && {
      accessor: 'district',
      title: 'District',
      sortable: true,
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
      sortable: true,
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
          <Group gap="xs">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenAddModal}
              disabled={!canWrite('customers')}
            >
              Add Customer
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
            <Select
              placeholder="All Categories"
              value={filters.category}
              onChange={(value) => setFilters(prev => ({ ...prev, category: value || '' }))}
              data={[
                { value: '',            label: 'All Categories' },
                { value: 'Local Sale',  label: 'Local Sale' },
                { value: 'Hospital',    label: 'Hospital' },
                { value: 'Anganwadi',   label: 'Anganwadi' },
                { value: 'Public',      label: 'Public' },
                { value: 'Hotel',       label: 'Hotel' },
                { value: 'Booth',       label: 'Booth' },
                { value: 'Hostel',      label: 'Hostel' },
                { value: 'School',      label: 'School' },
                { value: 'Vendor Sales',label: 'Vendor Sales' },
                { value: 'Others',      label: 'Others' },
              ]}
              style={{ width: 160 }}
              clearable
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
              leftSection={<IconFileImport size={16} />}
              color="violet"
              onClick={() => { setImportRows([]); setImportHeaders([]); setShowImportModal(true); }}
            >
              Import
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
                    Delete Selected
                  </Button>
                  <Button size="xs" variant="default" onClick={() => setSelectedCustomers([])}>
                    Clear Selection
                  </Button>
                </Group>
              </Group>
            </Paper>
          )}

          <Box style={{ overflowX: 'auto' }}>
            <DataTable
              idAccessor="_id"
              columns={columns}
              records={getSortedCustomers()}
              fetching={loading}
              sortStatus={sortStatus}
              onSortStatusChange={setSortStatus}
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
          </Box>
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

      {/* Import Modal */}
      <Modal
        opened={showImportModal}
        onClose={() => { if (!importLoading) { setShowImportModal(false); setImportRows([]); setImportHeaders([]); } }}
        title="Import Customers from Excel"
        size="xl"
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
            Upload an Excel (.xlsx / .xls) file. Even if only one column header matches a known field, the import will proceed.
            The <strong>Name</strong> column is required. Known fields: Name, Phone, Email, State, District, Opening Balance, GSTIN, Address.
          </Alert>

          <Group>
            <input
              type="file"
              accept=".xlsx,.xls"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <Button
              leftSection={<IconUpload size={16} />}
              variant="default"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
            >
              Choose Excel File
            </Button>
            {importRows.length > 0 && (
              <Text size="sm" c="green" fw={600}>
                {importRows.length} valid rows parsed ({importHeaders.length} matched columns)
              </Text>
            )}
          </Group>

          {importRows.length > 0 && (
            <>
              <Text size="sm" fw={600} c="dimmed">Preview (first 5 rows):</Text>
              <ScrollArea>
                <Table striped withColumnBorders style={{ fontSize: 12 }}>
                  <Table.Thead>
                    <Table.Tr>
                      {importHeaders.map(h => (
                        <Table.Th key={h} style={{ textTransform: 'capitalize', fontSize: 11 }}>
                          {h.replace(/([A-Z])/g, ' $1')}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {importRows.slice(0, 5).map((row, i) => (
                      <Table.Tr key={i}>
                        {importHeaders.map(h => (
                          <Table.Td key={h}>{row[h] || '—'}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              {importRows.length > 5 && (
                <Text size="xs" c="dimmed">...and {importRows.length - 5} more rows</Text>
              )}
            </>
          )}

          {importLoading && (
            <Stack gap="xs">
              <Text size="sm">Importing... {importProgress}%</Text>
              <Progress value={importProgress} animated />
            </Stack>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setShowImportModal(false); setImportRows([]); setImportHeaders([]); setIsOpenLyssaImport(false); }} disabled={importLoading}>
              Cancel
            </Button>
            <Button
              leftSection={<IconFileImport size={16} />}
              color="violet"
              onClick={handleImportSubmit}
              disabled={importRows.length === 0 || importLoading}
              loading={importLoading}
            >
              Import {importRows.length > 0 ? `${importRows.length} Customers` : ''}
            </Button>
          </Group>
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
