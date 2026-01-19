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
    const colorMap = {
      'Sales A/c': 'cyan',
      'Trade Income': 'teal',
      'Miscellaneous Income': 'green',
      'Other Revenue': 'lime',
      'Grants & Aid': 'teal',
      'Subsidies': 'green',
      'Purchases A/c': 'red',
      'Trade Expenses': 'orange',
      'Establishment Charges': 'pink',
      'Miscellaneous Expenses': 'red',
      'Accounts Due To (Sundry Creditors)': 'blue',
      'Other Payable': 'violet',
      'Other Liabilities': 'grape',
      'Deposit A/c': 'violet',
      'Contingency Fund': 'grape',
      'Education Fund': 'violet',
      'Fixed Assets': 'grape',
      'Movable Assets': 'violet',
      'Immovable Assets': 'grape',
      'Other Assets': 'violet',
      'Other Receivable': 'grape',
      'Investment A/c': 'indigo',
      'Other Investment': 'blue',
      'Government Securities': 'indigo',
      'Share Capital': 'blue',
      'Profit & Loss A/c': 'yellow',
      'Party': 'blue',
      'Bank': 'green',
      'Cash': 'yellow',
      'Income': 'teal',
      'Expense': 'red',
      'Asset': 'grape',
      'Liability': 'violet',
      'Capital': 'blue'
    };
    return colorMap[type] || 'gray';
  };

  const ledgerTypeOptions = [
    { value: '', label: 'All Account Groups' },
    { group: 'Income', items: [
      { value: 'Sales A/c', label: 'Sales A/c' },
      { value: 'Trade Income', label: 'Trade Income' },
      { value: 'Miscellaneous Income', label: 'Miscellaneous Income' },
      { value: 'Other Revenue', label: 'Other Revenue' },
      { value: 'Grants & Aid', label: 'Grants & Aid' },
      { value: 'Subsidies', label: 'Subsidies' }
    ]},
    { group: 'Expense', items: [
      { value: 'Purchases A/c', label: 'Purchases A/c' },
      { value: 'Trade Expenses', label: 'Trade Expenses' },
      { value: 'Establishment Charges', label: 'Establishment Charges' },
      { value: 'Miscellaneous Expenses', label: 'Miscellaneous Expenses' }
    ]},
    { group: 'Party', items: [
      { value: 'Accounts Due To (Sundry Creditors)', label: 'Accounts Due To (Sundry Creditors)' }
    ]},
    { group: 'Liability', items: [
      { value: 'Other Payable', label: 'Other Payable' },
      { value: 'Other Liabilities', label: 'Other Liabilities' },
      { value: 'Deposit A/c', label: 'Deposit A/c' },
      { value: 'Contingency Fund', label: 'Contingency Fund' },
      { value: 'Education Fund', label: 'Education Fund' }
    ]},
    { group: 'Asset', items: [
      { value: 'Fixed Assets', label: 'Fixed Assets' },
      { value: 'Movable Assets', label: 'Movable Assets' },
      { value: 'Immovable Assets', label: 'Immovable Assets' },
      { value: 'Other Assets', label: 'Other Assets' },
      { value: 'Other Receivable', label: 'Other Receivable' }
    ]},
    { group: 'Investment', items: [
      { value: 'Investment A/c', label: 'Investment A/c' },
      { value: 'Other Investment', label: 'Other Investment' },
      { value: 'Government Securities', label: 'Government Securities' }
    ]},
    { group: 'Capital', items: [
      { value: 'Share Capital', label: 'Share Capital' }
    ]},
    { group: 'Final Accounts', items: [
      { value: 'Profit & Loss A/c', label: 'Profit & Loss A/c' }
    ]},
    { group: 'Legacy/Basic Types', items: [
      { value: 'Party', label: 'Party' },
      { value: 'Bank', label: 'Bank' },
      { value: 'Cash', label: 'Cash' },
      { value: 'Income', label: 'Income' },
      { value: 'Expense', label: 'Expense' },
      { value: 'Asset', label: 'Asset' },
      { value: 'Liability', label: 'Liability' },
      { value: 'Capital', label: 'Capital' }
    ]}
  ];

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
        <Group spacing="xs">
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
        <Group position="apart" mb="md">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
            color="blue"
          >
            Add Ledger
          </Button>
        </Group>

        <Grid gutter="md" mb="md">
          <Grid.Col xs={12} md={6}>
            <TextInput
              placeholder="Search by ledger name"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              icon={<IconSearch size={16} />}
            />
          </Grid.Col>
          <Grid.Col xs={12} md={6}>
            <Select
              placeholder="Filter by account group"
              data={ledgerTypeOptions.flatMap(opt => 
                opt.group 
                  ? [{ group: opt.group, items: opt.items }]
                  : [{ value: opt.value, label: opt.label }]
              )}
              value={filters.ledgerType}
              onChange={(value) => setFilters(prev => ({ ...prev, ledgerType: value }))}
              icon={<IconFilter size={16} />}
              clearable
            />
          </Grid.Col>
        </Grid>

        <Paper withBorder>
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
          
          {!loading && filteredLedgers.length === 0 ? (
            <Box p="xl" ta="center">
              <Text color="dimmed">No ledgers found</Text>
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
                  <Group position="apart">
                    <Text size="sm" color="dimmed">
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
          <Stack spacing="md">
            <TextInput
              label="Ledger Name"
              placeholder="Enter ledger name"
              required
              {...form.getInputProps('ledgerName')}
            />

            <Select
              label="Account Group"
              placeholder="Select ledger type"
              required
              data={[
                { value: '', label: 'Select Ledger' },
                { group: 'Income', items: [
                  { value: 'Sales A/c', label: 'Sales A/c' },
                  { value: 'Trade Income', label: 'Trade Income' },
                  { value: 'Miscellaneous Income', label: 'Miscellaneous Income' },
                  { value: 'Other Revenue', label: 'Other Revenue' },
                  { value: 'Grants & Aid', label: 'Grants & Aid' },
                  { value: 'Subsidies', label: 'Subsidies' }
                ]},
                { group: 'Expense', items: [
                  { value: 'Purchases A/c', label: 'Purchases A/c' },
                  { value: 'Trade Expenses', label: 'Trade Expenses' },
                  { value: 'Establishment Charges', label: 'Establishment Charges' },
                  { value: 'Miscellaneous Expenses', label: 'Miscellaneous Expenses' }
                ]},
                { group: 'Party', items: [
                  { value: 'Accounts Due To (Sundry Creditors)', label: 'Accounts Due To (Sundry Creditors)' }
                ]},
                { group: 'Liability', items: [
                  { value: 'Other Payable', label: 'Other Payable' },
                  { value: 'Other Liabilities', label: 'Other Liabilities' },
                  { value: 'Deposit A/c', label: 'Deposit A/c' },
                  { value: 'Contingency Fund', label: 'Contingency Fund' },
                  { value: 'Education Fund', label: 'Education Fund' }
                ]},
                { group: 'Asset', items: [
                  { value: 'Fixed Assets', label: 'Fixed Assets' },
                  { value: 'Movable Assets', label: 'Movable Assets' },
                  { value: 'Immovable Assets', label: 'Immovable Assets' },
                  { value: 'Other Assets', label: 'Other Assets' },
                  { value: 'Other Receivable', label: 'Other Receivable' }
                ]},
                { group: 'Investment', items: [
                  { value: 'Investment A/c', label: 'Investment A/c' },
                  { value: 'Other Investment', label: 'Other Investment' },
                  { value: 'Government Securities', label: 'Government Securities' }
                ]},
                { group: 'Capital', items: [
                  { value: 'Share Capital', label: 'Share Capital' }
                ]},
                { group: 'Final Accounts', items: [
                  { value: 'Profit & Loss A/c', label: 'Profit & Loss A/c' }
                ]}
              ]}
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

            <Group position="right">
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