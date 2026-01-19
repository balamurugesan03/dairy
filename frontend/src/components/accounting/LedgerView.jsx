import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { ledgerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import ExportButton from '../common/ExportButton';
import {
  Box,
  Button,
  Paper,
  Grid,
  Table,
  Text,
  Badge,
  Group,
  Stack,
  Divider,
  Container,
  SimpleGrid,
  Card,
  NumberInput,
  DatePicker,
  LoadingOverlay,
  Title,
  Alert
} from '@mantine/core';
import { IconArrowLeft, IconDownload, IconCalendar, IconReceipt, IconCash, IconExchange } from '@tabler/icons-react';

const LedgerView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null
  });

  useEffect(() => {
    fetchLedger();
  }, [id]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await ledgerAPI.getById(id);
      setLedger(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledger details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
      </Container>
    );
  }

  if (!ledger) {
    return (
      <Container size="xl" py="xl">
        <Alert color="red" title="Error">
          Failed to load ledger details
        </Alert>
      </Container>
    );
  }

  const transactions = ledger.transactions || [];

  const filteredTransactions = transactions.filter(txn => {
    if (dateRange.startDate && dateRange.endDate) {
      const txnDate = dayjs(txn.date);
      const start = dayjs(dateRange.startDate);
      const end = dayjs(dateRange.endDate);
      if (txnDate.isBefore(start, 'day') || txnDate.isAfter(end, 'day')) {
        return false;
      }
    }
    return true;
  });

  const totalDebit = filteredTransactions.reduce((sum, txn) => sum + (txn.debit || 0), 0);
  const totalCredit = filteredTransactions.reduce((sum, txn) => sum + (txn.credit || 0), 0);

  const exportData = filteredTransactions.map(txn => ({
    'Date': dayjs(txn.date).format('DD-MM-YYYY'),
    'Particulars': txn.particulars,
    'Voucher Type': txn.voucherType,
    'Debit': txn.debit || 0,
    'Credit': txn.credit || 0,
    'Balance': `${Math.abs(txn.balance)} ${txn.balanceType}`
  }));

  const getVoucherTypeIcon = (type) => {
    if (type === 'Receipt') return <IconCash size={14} />;
    if (type === 'Payment') return <IconReceipt size={14} />;
    if (type === 'Journal') return <IconExchange size={14} />;
    return null;
  };

  const getVoucherTypeColor = (type) => {
    if (type === 'Receipt') return 'green';
    if (type === 'Payment') return 'red';
    if (type === 'Journal') return 'blue';
    return 'gray';
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
    return colorMap[type] || 'blue';
  };

  const rows = filteredTransactions.map((txn, index) => (
    <tr key={index}>
      <td>
        <Text size="sm">
          {dayjs(txn.date).format('DD-MM-YYYY')}
        </Text>
      </td>
      <td>
        <Text size="sm" weight={500}>
          {txn.particulars}
        </Text>
      </td>
      <td>
        <Badge
          leftSection={getVoucherTypeIcon(txn.voucherType)}
          color={getVoucherTypeColor(txn.voucherType)}
          variant="light"
          size="sm"
        >
          {txn.voucherType}
        </Badge>
      </td>
      <td align="right">
        <Text size="sm" weight={500}>
          {txn.debit > 0 ? `₹${txn.debit.toFixed(2)}` : '-'}
        </Text>
      </td>
      <td align="right">
        <Text size="sm" weight={500}>
          {txn.credit > 0 ? `₹${txn.credit.toFixed(2)}` : '-'}
        </Text>
      </td>
      <td align="right">
        <Badge
          color={txn.balanceType === 'Dr' ? 'red' : 'green'}
          variant="light"
          size="sm"
        >
          ₹{Math.abs(txn.balance).toFixed(2)} {txn.balanceType}
        </Badge>
      </td>
    </tr>
  ));

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Ledger Details"
        subtitle={`View ledger transactions for ${ledger.ledgerName}`}
      />

      {/* Actions Bar */}
      <Paper p="md" mb="md" withBorder>
        <Group position="apart">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="default"
            onClick={() => navigate('/accounting/ledgers')}
          >
            Back to Ledgers
          </Button>
          <ExportButton
            data={exportData}
            filename={`ledger_${ledger.ledgerName}`}
            buttonText="Export"
          />
        </Group>
      </Paper>

      {/* Ledger Information Card */}
      <Paper p="md" mb="md" withBorder>
        <Title order={3} mb="md">Ledger Information</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          <div>
            <Text size="sm" color="dimmed">Ledger Name</Text>
            <Text weight={500} size="lg">{ledger.ledgerName}</Text>
          </div>
          <div>
            <Text size="sm" color="dimmed">Account Group</Text>
            <Badge 
              color={getLedgerTypeColor(ledger.ledgerType)} 
              variant="light"
              size="lg"
            >
              {ledger.ledgerType}
            </Badge>
          </div>
          <div>
            <Text size="sm" color="dimmed">Opening Balance</Text>
            <Text weight={500} size="lg">
              ₹{ledger.openingBalance?.toFixed(2) || 0} {ledger.openingBalanceType || ''}
            </Text>
          </div>
          <div>
            <Text size="sm" color="dimmed">Current Balance</Text>
            <Badge
              color={ledger.balanceType === 'Dr' ? 'red' : 'green'}
              variant="light"
              size="lg"
            >
              ₹{ledger.currentBalance?.toFixed(2) || 0} {ledger.balanceType || ''}
            </Badge>
          </div>
          <div>
            <Text size="sm" color="dimmed">Parent Group</Text>
            <Text weight={500} size="lg">{ledger.parentGroup || '-'}</Text>
          </div>
          <div>
            <Text size="sm" color="dimmed">Linked Entity</Text>
            <Text weight={500} size="lg">{ledger.linkedEntity?.entityType || '-'}</Text>
          </div>
        </SimpleGrid>
      </Paper>

      {/* Transactions Card */}
      <Paper p="md" withBorder>
        <Group position="apart" mb="md">
          <Title order={3}>Transaction History</Title>
          <Badge color="blue" variant="light">
            {filteredTransactions.length} Transactions
          </Badge>
        </Group>

        {/* Date Filter */}
        <Paper p="md" mb="md" withBorder bg="gray.0">
          <Group spacing="lg">
            <DatePicker
              placeholder="Start Date"
              value={dateRange.startDate}
              onChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
              icon={<IconCalendar size={16} />}
              clearable
            />
            <DatePicker
              placeholder="End Date"
              value={dateRange.endDate}
              onChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
              icon={<IconCalendar size={16} />}
              clearable
            />
            {(dateRange.startDate || dateRange.endDate) && (
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setDateRange({ startDate: null, endDate: null })}
              >
                Clear Filters
              </Button>
            )}
          </Group>
        </Paper>

        {/* Transactions Table */}
        {filteredTransactions.length === 0 ? (
          <Paper p="xl" ta="center" withBorder>
            <Text color="dimmed">No transactions found</Text>
          </Paper>
        ) : (
          <>
            <Table striped highlightOnHover>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Voucher Type</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
              <tfoot>
                <tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                  <td colSpan="3" align="right">
                    <Text weight={700}>Total:</Text>
                  </td>
                  <td align="right">
                    <Text weight={700}>₹{totalDebit.toFixed(2)}</Text>
                  </td>
                  <td align="right">
                    <Text weight={700}>₹{totalCredit.toFixed(2)}</Text>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </Table>

            {/* Summary */}
            <Paper p="md" mt="md" withBorder bg="gray.0">
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <div>
                  <Text size="sm" color="dimmed">Total Debit</Text>
                  <Text size="lg" weight={700} color="red">
                    ₹{totalDebit.toFixed(2)}
                  </Text>
                </div>
                <div>
                  <Text size="sm" color="dimmed">Total Credit</Text>
                  <Text size="lg" weight={700} color="green">
                    ₹{totalCredit.toFixed(2)}
                  </Text>
                </div>
                <div>
                  <Text size="sm" color="dimmed">Closing Balance</Text>
                  <Badge
                    color={ledger.balanceType === 'Dr' ? 'red' : 'green'}
                    variant="filled"
                    size="lg"
                  >
                    ₹{ledger.currentBalance?.toFixed(2) || 0} {ledger.balanceType || ''}
                  </Badge>
                </div>
              </SimpleGrid>
            </Paper>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default LedgerView;