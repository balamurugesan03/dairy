/**
 * Business Ledger List - For Private Firm
 * Separate from Dairy Ledgers
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
  Loader,
  Center,
  Box,
  Grid,
  Card,
  ThemeIcon,
  NumberInput,
  Textarea
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconBook2,
  IconEye,
  IconEdit,
  IconTrash,
  IconCurrencyRupee,
  IconAlertCircle,
  IconCheck
} from '@tabler/icons-react';
import { businessLedgerAPI } from '../../services/api';

const LEDGER_GROUPS = [
  'Cash-in-Hand',
  'Bank Accounts',
  'Sundry Debtors',
  'Sundry Creditors',
  'Sales Accounts',
  'Purchase Accounts',
  'Direct Expenses',
  'Indirect Expenses',
  'Direct Incomes',
  'Indirect Incomes',
  'Fixed Assets',
  'Current Assets',
  'Current Liabilities',
  'Capital Account',
  'Loans & Advances',
  'Investments',
  'Duties & Taxes',
  'Provisions',
  'Reserves & Surplus',
  'Suspense Account',
  'Stock-in-Hand'
];

const LEDGER_TYPES = ['Asset', 'Liability', 'Income', 'Expense', 'Equity'];

const BusinessLedgerList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ledgers, setLedgers] = useState([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      group: '',
      type: '',
      openingBalance: 0,
      openingBalanceType: 'Debit',
      description: '',
      partyDetails: {
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        gstNumber: ''
      },
      bankDetails: {
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        branch: '',
        accountType: 'Current'
      }
    },
    validate: {
      name: (value) => (!value ? 'Ledger name is required' : null),
      group: (value) => (!value ? 'Group is required' : null),
      type: (value) => (!value ? 'Type is required' : null)
    }
  });

  useEffect(() => {
    fetchLedgers();
  }, [search, groupFilter, typeFilter]);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (groupFilter) params.group = groupFilter;
      if (typeFilter) params.type = typeFilter;

      const response = await businessLedgerAPI.getAll(params);
      setLedgers(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch ledgers',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    form.reset();
    setAddModalOpen(true);
  };

  const handleEdit = (ledger) => {
    setSelectedLedger(ledger);
    form.setValues({
      name: ledger.name || '',
      group: ledger.group || '',
      type: ledger.type || '',
      openingBalance: ledger.openingBalance || 0,
      openingBalanceType: ledger.openingBalanceType || 'Debit',
      description: ledger.description || '',
      partyDetails: ledger.partyDetails || {},
      bankDetails: ledger.bankDetails || {}
    });
    setEditModalOpen(true);
  };

  const handleView = (ledger) => {
    setSelectedLedger(ledger);
    setViewModalOpen(true);
  };

  const handleDelete = (ledger) => {
    setSelectedLedger(ledger);
    setDeleteModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      setSaving(true);
      if (editModalOpen && selectedLedger) {
        await businessLedgerAPI.update(selectedLedger._id, values);
        notifications.show({
          title: 'Success',
          message: 'Ledger updated successfully',
          color: 'green'
        });
        setEditModalOpen(false);
      } else {
        await businessLedgerAPI.create(values);
        notifications.show({
          title: 'Success',
          message: 'Ledger created successfully',
          color: 'green'
        });
        setAddModalOpen(false);
      }
      form.reset();
      fetchLedgers();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save ledger',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setSaving(true);
      await businessLedgerAPI.delete(selectedLedger._id);
      notifications.show({
        title: 'Success',
        message: 'Ledger deleted successfully',
        color: 'green'
      });
      setDeleteModalOpen(false);
      setSelectedLedger(null);
      fetchLedgers();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete ledger',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Asset': return 'blue';
      case 'Liability': return 'red';
      case 'Income': return 'green';
      case 'Expense': return 'orange';
      case 'Equity': return 'violet';
      default: return 'gray';
    }
  };

  const columns = [
    {
      accessor: 'code',
      title: 'Code',
      width: 100,
      render: (record) => <Text size="sm" fw={500}>{record.code}</Text>
    },
    {
      accessor: 'name',
      title: 'Ledger Name',
      render: (record) => (
        <Box>
          <Text size="sm" fw={500}>{record.name}</Text>
          <Text size="xs" c="dimmed">{record.group}</Text>
        </Box>
      )
    },
    {
      accessor: 'type',
      title: 'Type',
      width: 100,
      render: (record) => (
        <Badge color={getTypeColor(record.type)} size="sm" variant="light">
          {record.type}
        </Badge>
      )
    },
    {
      accessor: 'openingBalance',
      title: 'Opening Bal',
      width: 120,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm">
          {(record.openingBalance || 0).toFixed(2)}
          <Text span size="xs" c="dimmed" ml={4}>
            {record.openingBalanceType === 'Credit' ? 'Cr' : 'Dr'}
          </Text>
        </Text>
      )
    },
    {
      accessor: 'currentBalance',
      title: 'Current Bal',
      width: 120,
      textAlign: 'right',
      render: (record) => (
        <Text size="sm" fw={600} c={record.currentBalance >= 0 ? 'green' : 'red'}>
          {Math.abs(record.currentBalance || 0).toFixed(2)}
          <Text span size="xs" c="dimmed" ml={4}>
            {record.currentBalance >= 0 ? 'Dr' : 'Cr'}
          </Text>
        </Text>
      )
    },
    {
      accessor: 'status',
      title: 'Status',
      width: 80,
      render: (record) => (
        <Badge color={record.status === 'Active' ? 'green' : 'gray'} size="sm">
          {record.status}
        </Badge>
      )
    },
    {
      accessor: 'actions',
      title: '',
      width: 100,
      render: (record) => (
        <Group gap={4} justify="flex-end">
          <ActionIcon variant="light" size="sm" onClick={() => handleView(record)}>
            <IconEye size={14} />
          </ActionIcon>
          <ActionIcon variant="light" size="sm" color="blue" onClick={() => handleEdit(record)}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon variant="light" size="sm" color="red" onClick={() => handleDelete(record)}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      )
    }
  ];

  const renderForm = () => (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          label="Ledger Name"
          placeholder="Enter ledger name"
          required
          {...form.getInputProps('name')}
        />

        <Grid>
          <Grid.Col span={6}>
            <Select
              label="Group"
              placeholder="Select group"
              required
              data={LEDGER_GROUPS}
              searchable
              {...form.getInputProps('group')}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Type"
              placeholder="Select type"
              required
              data={LEDGER_TYPES}
              {...form.getInputProps('type')}
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={6}>
            <NumberInput
              label="Opening Balance"
              placeholder="0.00"
              min={0}
              decimalScale={2}
              leftSection={<IconCurrencyRupee size={14} />}
              {...form.getInputProps('openingBalance')}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Balance Type"
              data={[
                { value: 'Debit', label: 'Debit (Dr)' },
                { value: 'Credit', label: 'Credit (Cr)' }
              ]}
              {...form.getInputProps('openingBalanceType')}
            />
          </Grid.Col>
        </Grid>

        <Textarea
          label="Description"
          placeholder="Enter description"
          rows={2}
          {...form.getInputProps('description')}
        />

        {/* Show party details for Debtors/Creditors */}
        {(form.values.group === 'Sundry Debtors' || form.values.group === 'Sundry Creditors') && (
          <Paper withBorder p="md" radius="md">
            <Text fw={500} mb="sm">Party Details</Text>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Contact Person"
                  placeholder="Name"
                  {...form.getInputProps('partyDetails.contactPerson')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Phone"
                  placeholder="Phone number"
                  {...form.getInputProps('partyDetails.phone')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="GST Number"
                  placeholder="GSTIN"
                  {...form.getInputProps('partyDetails.gstNumber')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Email"
                  placeholder="Email"
                  {...form.getInputProps('partyDetails.email')}
                />
              </Grid.Col>
            </Grid>
          </Paper>
        )}

        {/* Show bank details for Bank Accounts */}
        {form.values.group === 'Bank Accounts' && (
          <Paper withBorder p="md" radius="md">
            <Text fw={500} mb="sm">Bank Details</Text>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Bank Name"
                  placeholder="Bank name"
                  {...form.getInputProps('bankDetails.bankName')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Account Number"
                  placeholder="Account number"
                  {...form.getInputProps('bankDetails.accountNumber')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="IFSC Code"
                  placeholder="IFSC"
                  {...form.getInputProps('bankDetails.ifscCode')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Account Type"
                  data={['Savings', 'Current', 'OD', 'CC']}
                  {...form.getInputProps('bankDetails.accountType')}
                />
              </Grid.Col>
            </Grid>
          </Paper>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={() => { setAddModalOpen(false); setEditModalOpen(false); }}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {editModalOpen ? 'Update' : 'Create'} Ledger
          </Button>
        </Group>
      </Stack>
    </form>
  );

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="violet">
              <IconBook2 size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Business Ledgers</Title>
              <Text size="sm" c="dimmed">Manage your business account ledgers</Text>
            </div>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
            Add Ledger
          </Button>
        </Group>
      </Paper>

      {/* Filters */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Grid gutter="sm">
          <Grid.Col span={4}>
            <TextInput
              placeholder="Search ledger..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              placeholder="Filter by Group"
              value={groupFilter}
              onChange={setGroupFilter}
              clearable
              searchable
              data={LEDGER_GROUPS}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              placeholder="Filter by Type"
              value={typeFilter}
              onChange={setTypeFilter}
              clearable
              data={LEDGER_TYPES}
            />
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Data Table */}
      <Paper withBorder radius="md">
        <DataTable
          columns={columns}
          records={ledgers}
          fetching={loading}
          minHeight={400}
          noRecordsText="No ledgers found"
          highlightOnHover
          verticalSpacing="sm"
        />
      </Paper>

      {/* Add Modal */}
      <Modal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Ledger"
        size="lg"
      >
        {renderForm()}
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Ledger"
        size="lg"
      >
        {renderForm()}
      </Modal>

      {/* View Modal */}
      <Modal
        opened={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Ledger Details"
        size="md"
      >
        {selectedLedger && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>Code:</Text>
              <Text>{selectedLedger.code}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Name:</Text>
              <Text>{selectedLedger.name}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Group:</Text>
              <Text>{selectedLedger.group}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Type:</Text>
              <Badge color={getTypeColor(selectedLedger.type)}>{selectedLedger.type}</Badge>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Opening Balance:</Text>
              <Text>{selectedLedger.openingBalance?.toFixed(2)} {selectedLedger.openingBalanceType}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={500}>Current Balance:</Text>
              <Text fw={600} c={selectedLedger.currentBalance >= 0 ? 'green' : 'red'}>
                {Math.abs(selectedLedger.currentBalance || 0).toFixed(2)}
              </Text>
            </Group>
            <Button fullWidth onClick={() => navigate(`/business-accounting/ledgers/${selectedLedger._id}`)}>
              View Transactions
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Ledger"
        centered
      >
        <Stack>
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Are you sure you want to delete ledger "{selectedLedger?.name}"?
          </Alert>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button color="red" onClick={confirmDelete} loading={saving}>Delete</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default BusinessLedgerList;
