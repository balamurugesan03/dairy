import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { ledgerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import {
  Box,
  Button,
  Group,
  TextInput,
  Select,
  Table,
  Paper,
  Text,
  LoadingOverlay,
  Modal,
  Badge,
  Pagination,
  Grid,
  Stack,
  Divider,
  Title,
  Container
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSearch, IconPlus, IconEye, IconEdit, IconTrash, IconFilter } from '@tabler/icons-react';

const ACCOUNT_GROUPS = [
  { group: '🟢 ASSET', items: [
    'Cash in Hand',
    'Bank Accounts',
    'Share in Other Institutions',
    'Investment in Govt. Securities',
    'Other Investments',
    'Loans & Advances to Members',
    'Interest Receivable',
    'Other Assets',
    'Fixed Assets - Movables',
    'Fixed Assets - Immovables',
    'Advance due to Society',
    'Loss',
  ]},
  { group: '🔴 LIABILITY', items: [
    'Share Capital',
    'Deposits',
    'Borrowings (Loans, Cash Credits)',
    'Statutory Funds and Reserves',
    'Other Funds, Reserves and Provisions',
    'Interest Payable',
    'Grants and Subsidies',
    'Education Fund',
    'Other Liabilities',
    'Advance due by Society',
    'Profit',
  ]},
  { group: '🟡 INCOME', items: [
    'Miscellaneous Income',
    'Sales',
    'Trade Income',
  ]},
  { group: '🔵 EXPENSE', items: [
    'Establishment Charges',
    'Contingencies',
    'Purchases',
    'Trade Expenses',
  ]},
  { group: '🟣 STOCK', items: [
    'Closing Stock',
    'Opening Stock',
    'Closing Stock (Trading)',
  ]},
  { group: '⚫ P&L', items: [
    'Net Loss Brought From P&L A/c',
    'Net Profit Brought From P&L A/c',
  ]},
];

const ACCOUNT_GROUP_SELECT_DATA = ACCOUNT_GROUPS.map(g => ({
  group: g.group,
  items: g.items.map(v => ({ value: v, label: v })),
}));

const LedgerList = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLedger, setEditingLedger] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    ledgerType: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const form = useForm({
    initialValues: {
      ledgerName: '',
      ledgerType: '',
      openingBalance: '',
      openingBalanceType: 'Dr',
      parentGroup: ''
    },
    validate: {
      ledgerName: (value) => value.trim().length === 0 ? 'Ledger name is required' : null,
      ledgerType: (value) => value.trim().length === 0 ? 'Account group is required' : null,
    }
  });

  useEffect(() => {
    fetchLedgers();
  }, []);

  const fetchLedgers = async () => {
    setLoading(true);
    try {
      const response = await ledgerAPI.getAll();
      setLedgers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledgers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingLedger(null);
    form.reset();
    setModalVisible(true);
  };

  const handleEdit = (ledger) => {
    setEditingLedger(ledger);
    form.setValues({
      ledgerName: ledger.ledgerName || '',
      ledgerType: ledger.ledgerType || '',
      openingBalance: ledger.openingBalance?.toString() || '',
      openingBalanceType: ledger.openingBalanceType || 'Dr',
      parentGroup: ledger.parentGroup || ''
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        openingBalance: values.openingBalance ? parseFloat(values.openingBalance) : 0
      };

      if (editingLedger) {
        await ledgerAPI.update(editingLedger._id, payload);
        message.success('Ledger updated successfully');
      } else {
        await ledgerAPI.create(payload);
        message.success('Ledger created successfully');
      }
      setModalVisible(false);
      fetchLedgers();
    } catch (error) {
      message.error(error.message || 'Failed to save ledger');
    }
  };

  const handleDelete = async (ledger) => {
    if (window.confirm(`Are you sure you want to delete ledger "${ledger.ledgerName}"? This will deactivate the ledger.`)) {
      try {
        await ledgerAPI.delete(ledger._id);
        message.success('Ledger deleted successfully');
        fetchLedgers();
      } catch (error) {
        message.error(error.message || 'Failed to delete ledger');
      }
    }
  };

  const getLedgerTypeColor = (type) => {
    // ASSET → green shades
    if (['Cash in Hand','Bank Accounts','Share in Other Institutions','Investment in Govt. Securities',
         'Other Investments','Loans & Advances to Members','Interest Receivable','Other Assets',
         'Fixed Assets - Movables','Fixed Assets - Immovables','Advance due to Society','Loss',
         'Fixed Assets','Movable Assets','Immovable Assets','Other Receivable',
         'Investment A/c','Other Investment','Government Securities','Asset'].includes(type)) return 'green';
    // LIABILITY → red shades
    if (['Share Capital','Deposits','Borrowings (Loans, Cash Credits)','Statutory Funds and Reserves',
         'Other Funds, Reserves and Provisions','Interest Payable','Grants and Subsidies','Education Fund',
         'Other Liabilities','Advance due by Society','Profit',
         'Other Payable','Deposit A/c','Contingency Fund','Liability','Capital'].includes(type)) return 'red';
    // INCOME → teal
    if (['Miscellaneous Income','Sales','Trade Income','Sales A/c','Other Revenue',
         'Grants & Aid','Subsidies','Income'].includes(type)) return 'teal';
    // EXPENSE → orange
    if (['Establishment Charges','Contingencies','Purchases','Trade Expenses',
         'Purchases A/c','Miscellaneous Expenses','Expense'].includes(type)) return 'orange';
    // STOCK → violet
    if (['Closing Stock','Opening Stock','Closing Stock (Trading)'].includes(type)) return 'violet';
    // P&L → yellow
    if (['Net Loss Brought From P&L A/c','Net Profit Brought From P&L A/c','Profit & Loss A/c'].includes(type)) return 'yellow';
    // Party / legacy
    if (['Party','Accounts Due To (Sundry Creditors)'].includes(type)) return 'blue';
    if (['Bank','Cash'].includes(type)) return 'cyan';
    return 'gray';
  };


  const filteredLedgers = ledgers.filter(ledger => {
    if (filters.search && !ledger.ledgerName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.ledgerType && ledger.ledgerType !== filters.ledgerType) {
      return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLedgers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLedgers = filteredLedgers.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.ledgerType]);

  const rows = currentLedgers.map((ledger) => (
    <tr key={ledger._id}>
      <td>{ledger.ledgerName}</td>
      <td>
        <Badge color={getLedgerTypeColor(ledger.ledgerType)} variant="light">
          {ledger.ledgerType}
        </Badge>
      </td>
      <td>
        ₹{ledger.openingBalance?.toFixed(2) || 0} {ledger.openingBalanceType || ''}
      </td>
      <td>
        <Badge color={ledger.balanceType === 'Dr' ? 'red' : 'green'} variant="light">
          ₹{ledger.currentBalance?.toFixed(2) || 0} {ledger.balanceType || ''}
        </Badge>
      </td>
      <td>{ledger.linkedEntity?.entityType || '-'}</td>
      <td>
        <Group gap="xs">
          <Button
            size="xs"
            variant="subtle"
            color="blue"
            leftSection={<IconEye size={14} />}
            onClick={() => navigate(`/accounting/ledgers/view/${ledger._id}`)}
          >
            View
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="yellow"
            leftSection={<IconEdit size={14} />}
            onClick={() => handleEdit(ledger)}
          >
            Edit
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={() => handleDelete(ledger)}
          >
            Delete
          </Button>
        </Group>
      </td>
    </tr>
  ));

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Ledger Management"
        subtitle="View and manage accounting ledgers"
      />

      <Paper p="md" mb="md" withBorder>
        <Group justify="space-between" mb="md">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
            color="blue"
          >
            Add Ledger
          </Button>
        </Group>

        <Grid gutter="md" mb="md">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              placeholder="Search by ledger name"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              leftSection={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Select
              placeholder="Filter by account group"
              data={ACCOUNT_GROUP_SELECT_DATA}
              value={filters.ledgerType}
              onChange={(value) => setFilters(prev => ({ ...prev, ledgerType: value }))}
              leftSection={<IconFilter size={16} />}
              clearable
            />
          </Grid.Col>
        </Grid>

        <Paper withBorder>
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
          
          {!loading && filteredLedgers.length === 0 ? (
            <Box p="xl" ta="center">
              <Text c="dimmed">No ledgers found</Text>
            </Box>
          ) : (
            <>
              <Table striped highlightOnHover>
                <thead>
                  <tr>
                    <th>Ledger Name</th>
                    <th>Account Group</th>
                    <th>Opening Balance</th>
                    <th>Current Balance</th>
                    <th>Linked Entity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>{rows}</tbody>
              </Table>

              {totalPages > 1 && (
                <Box p="md">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLedgers.length)} of {filteredLedgers.length} ledgers
                    </Text>
                    <Pagination
                      value={currentPage}
                      onChange={setCurrentPage}
                      total={totalPages}
                      size="sm"
                    />
                  </Group>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Paper>

      <Modal
        opened={modalVisible}
        onClose={() => setModalVisible(false)}
        title={<Title order={3}>{editingLedger ? 'Edit Ledger' : 'Add Ledger'}</Title>}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Ledger Name"
              placeholder="Enter ledger name"
              required
              {...form.getInputProps('ledgerName')}
            />

            <Select
              label="Account Group"
              placeholder="Select account group"
              required
              data={ACCOUNT_GROUP_SELECT_DATA}
              searchable
              {...form.getInputProps('ledgerType')}
            />

            <Grid>
              <Grid.Col span={8}>
                <TextInput
                  label="Opening Balance"
                  placeholder="Enter opening balance"
                  type="number"
                  step="0.01"
                  {...form.getInputProps('openingBalance')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Select
                  label="Type"
                  data={[
                    { value: 'Dr', label: 'Debit (Dr)' },
                    { value: 'Cr', label: 'Credit (Cr)' }
                  ]}
                  {...form.getInputProps('openingBalanceType')}
                />
              </Grid.Col>
            </Grid>

            <TextInput
              label="Parent Group"
              placeholder="Enter parent group (optional)"
              {...form.getInputProps('parentGroup')}
            />

            <Divider />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalVisible(false)}>
                Cancel
              </Button>
              <Button type="submit" color="blue">
                {editingLedger ? 'Update' : 'Save'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
};

export default LedgerList;