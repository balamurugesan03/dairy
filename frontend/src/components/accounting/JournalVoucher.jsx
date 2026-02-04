import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { ledgerAPI, voucherAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import {
  Box,
  Button,
  Paper,
  Grid,
  Text,
  TextInput,
  Textarea,
  Select,
  LoadingOverlay,
  Group,
  Stack,
  Alert,
  Container,
  Title,
  Divider,
  NumberInput,
  Modal,
  Table,
  Badge,
  ActionIcon,
  Card,
  Tooltip,
  ScrollArea,
  SegmentedControl,
  Checkbox
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconCalendar,
  IconCurrencyRupee,
  IconNotes,
  IconCheck,
  IconX,
  IconPlus,
  IconEye,
  IconTrash,
  IconExchange,
  IconArrowRight,
  IconArrowLeft,
  IconMilk
} from '@tabler/icons-react';

const JournalVoucher = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchingVouchers, setFetchingVouchers] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [entryMode, setEntryMode] = useState('single');
  const [multipleEntries, setMultipleEntries] = useState([
    { voucherDate: dayjs().format('YYYY-MM-DD'), debitLedgerId: '', debitAmount: '', creditLedgerId: '', creditAmount: '', narration: '' }
  ]);
  const [savingMultiple, setSavingMultiple] = useState(false);
  const [isMilkBill, setIsMilkBill] = useState(false);

  // Handle Milk Bill checkbox change - navigate to report when checked
  const handleMilkBillChange = (event) => {
    const checked = event.currentTarget.checked;
    setIsMilkBill(checked);
    if (checked) {
      // Navigate to Milk Bill Abstract report with current date
      const currentDate = form.values.voucherDate || dayjs().format('YYYY-MM-DD');
      navigate(`/reports/milk-bill-abstract?from=journal&date=${currentDate}`);
    }
  };

  const form = useForm({
    initialValues: {
      voucherDate: dayjs().format('YYYY-MM-DD'),
      debitLedgerId: '',
      debitAmount: '',
      creditLedgerId: '',
      creditAmount: '',
      narration: ''
    },
    validate: {
      voucherDate: (value) => !value ? 'Voucher date is required' : null,
      debitLedgerId: (value) => !value ? 'Please select debit ledger' : null,
      debitAmount: (value) => {
        if (!value) return 'Please enter debit amount';
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return 'Please enter valid amount';
        return null;
      },
      creditLedgerId: (value) => !value ? 'Please select credit ledger' : null,
      creditAmount: (value) => {
        if (!value) return 'Please enter credit amount';
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return 'Please enter valid amount';
        return null;
      },
      narration: (value) => !value ? 'Narration is required' : null
    }
  });

  useEffect(() => {
    fetchLedgers();
    fetchVouchers();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll();
      setLedgers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledgers');
    }
  };

  const fetchVouchers = async () => {
    setFetchingVouchers(true);
    try {
      const response = await voucherAPI.getAll({ voucherType: 'Journal' });
      setVouchers(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch vouchers');
    } finally {
      setFetchingVouchers(false);
    }
  };

  const handleSubmit = async (values) => {
    const debitAmt = parseFloat(values.debitAmount);
    const creditAmt = parseFloat(values.creditAmount);

    if (debitAmt !== creditAmt) {
      message.error('Debit and Credit amounts must be equal');
      return;
    }

    if (values.debitLedgerId === values.creditLedgerId) {
      message.error('Debit and Credit ledgers cannot be the same');
      return;
    }

    setLoading(true);
    try {
      const debitLedger = ledgers.find(l => l._id === values.debitLedgerId);
      const creditLedger = ledgers.find(l => l._id === values.creditLedgerId);

      const payload = {
        voucherType: 'Journal',
        voucherDate: new Date(values.voucherDate).toISOString(),
        entries: [
          {
            ledgerId: values.debitLedgerId,
            ledgerName: debitLedger.ledgerName,
            debitAmount: debitAmt,
            creditAmount: 0,
            narration: values.narration
          },
          {
            ledgerId: values.creditLedgerId,
            ledgerName: creditLedger.ledgerName,
            debitAmount: 0,
            creditAmount: creditAmt,
            narration: values.narration
          }
        ],
        totalDebit: debitAmt,
        totalCredit: creditAmt,
        referenceType: 'Manual',
        narration: values.narration
      };

      await voucherAPI.create(payload);
      message.success('Journal voucher created successfully');
      setModalOpened(false);
      form.reset();
      fetchVouchers();
    } catch (error) {
      message.error(error.message || 'Failed to create journal voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this voucher?')) return;
    try {
      await voucherAPI.delete(id);
      message.success('Voucher deleted successfully');
      fetchVouchers();
    } catch (error) {
      message.error(error.message || 'Failed to delete voucher');
    }
  };

  const handleView = (voucher) => {
    setSelectedVoucher(voucher);
    setViewModalOpened(true);
  };

  const openAddModal = () => {
    form.reset();
    form.setFieldValue('voucherDate', dayjs().format('YYYY-MM-DD'));
    setEntryMode('single');
    setMultipleEntries([
      { voucherDate: dayjs().format('YYYY-MM-DD'), debitLedgerId: '', debitAmount: '', creditLedgerId: '', creditAmount: '', narration: '' }
    ]);
    setModalOpened(true);
  };

  const addMultipleRow = () => {
    setMultipleEntries([
      ...multipleEntries,
      { voucherDate: dayjs().format('YYYY-MM-DD'), debitLedgerId: '', debitAmount: '', creditLedgerId: '', creditAmount: '', narration: '' }
    ]);
  };

  const removeMultipleRow = (index) => {
    if (multipleEntries.length > 1) {
      setMultipleEntries(multipleEntries.filter((_, i) => i !== index));
    }
  };

  const updateMultipleEntry = (index, field, value) => {
    const updated = [...multipleEntries];
    updated[index][field] = value;
    setMultipleEntries(updated);
  };

  const handleSaveMultiple = async () => {
    // Validate all entries
    const validEntries = multipleEntries.filter(entry => {
      const debitAmt = parseFloat(entry.debitAmount) || 0;
      const creditAmt = parseFloat(entry.creditAmount) || 0;
      return entry.voucherDate &&
             entry.debitLedgerId &&
             entry.creditLedgerId &&
             debitAmt > 0 &&
             creditAmt > 0 &&
             debitAmt === creditAmt &&
             entry.debitLedgerId !== entry.creditLedgerId;
    });

    if (validEntries.length === 0) {
      message.error('Please fill at least one complete entry with matching debit and credit amounts');
      return;
    }

    setSavingMultiple(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of validEntries) {
      try {
        const debitLedger = ledgers.find(l => l._id === entry.debitLedgerId);
        const creditLedger = ledgers.find(l => l._id === entry.creditLedgerId);
        const debitAmt = parseFloat(entry.debitAmount);
        const creditAmt = parseFloat(entry.creditAmount);

        const payload = {
          voucherType: 'Journal',
          voucherDate: new Date(entry.voucherDate).toISOString(),
          entries: [
            {
              ledgerId: entry.debitLedgerId,
              ledgerName: debitLedger?.ledgerName || '',
              debitAmount: debitAmt,
              creditAmount: 0,
              narration: entry.narration || ''
            },
            {
              ledgerId: entry.creditLedgerId,
              ledgerName: creditLedger?.ledgerName || '',
              debitAmount: 0,
              creditAmount: creditAmt,
              narration: entry.narration || ''
            }
          ],
          totalDebit: debitAmt,
          totalCredit: creditAmt,
          referenceType: 'Manual',
          narration: entry.narration || ''
        };

        await voucherAPI.create(payload);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setSavingMultiple(false);

    if (successCount > 0) {
      message.success(`${successCount} voucher(s) created successfully`);
      setModalOpened(false);
      fetchVouchers();
    }
    if (errorCount > 0) {
      message.error(`${errorCount} voucher(s) failed to create`);
    }
  };

  const getMultipleTotals = () => {
    const debitTotal = multipleEntries.reduce((sum, entry) => sum + (parseFloat(entry.debitAmount) || 0), 0);
    const creditTotal = multipleEntries.reduce((sum, entry) => sum + (parseFloat(entry.creditAmount) || 0), 0);
    return { debitTotal, creditTotal };
  };

  const ledgerOptions = ledgers.map(ledger => ({
    label: `${ledger.ledgerName} (${ledger.ledgerType})`,
    value: ledger._id,
    group: getLedgerGroup(ledger.ledgerType)
  }));

  function getLedgerGroup(ledgerType) {
    if (['Cash', 'Bank'].includes(ledgerType)) return 'Cash/Bank Accounts';
    if (['Party', 'Accounts Due From (Sundry Debtors)', 'Accounts Due To (Sundry Creditors)'].includes(ledgerType)) return 'Party Accounts';
    if (['Sales A/c', 'Trade Income', 'Miscellaneous Income'].includes(ledgerType)) return 'Income Accounts';
    if (['Purchase A/c', 'Trade Expense', 'Miscellaneous Expense'].includes(ledgerType)) return 'Expense Accounts';
    if (['Asset', 'Other Assets', 'Other Receivable'].includes(ledgerType)) return 'Asset Accounts';
    if (['Liability', 'Other Liabilities', 'Other Payable'].includes(ledgerType)) return 'Liability Accounts';
    if (['Capital'].includes(ledgerType)) return 'Capital Accounts';
    return 'Other Accounts';
  }

  const groupedOptions = ledgerOptions.reduce((groups, option) => {
    if (!groups[option.group]) {
      groups[option.group] = [];
    }
    groups[option.group].push(option);
    return groups;
  }, {});

  const isFormBalanced = () => {
    const debitAmt = parseFloat(form.values.debitAmount) || 0;
    const creditAmt = parseFloat(form.values.creditAmount) || 0;
    return debitAmt > 0 && creditAmt > 0 && debitAmt === creditAmt;
  };

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Journal Voucher"
        subtitle="Manage journal vouchers for adjustments and transfers"
        rightSection={
          <Group spacing="md">
            {/* Milk Bill Checkbox */}
            <Card p="xs" withBorder style={{ cursor: 'pointer' }}>
              <Checkbox
                label={
                  <Group spacing="xs">
                    <IconMilk size={18} color="var(--mantine-color-cyan-6)" />
                    <Text size="sm" weight={500}>Milk Bill</Text>
                  </Group>
                }
                checked={isMilkBill}
                onChange={handleMilkBillChange}
                color="cyan"
                styles={{
                  input: { cursor: 'pointer' },
                  label: { cursor: 'pointer' }
                }}
              />
            </Card>
            <Button
              leftSection={<IconPlus size={16} />}
              color="blue"
              onClick={openAddModal}
            >
              Add Journal Voucher
            </Button>
          </Group>
        }
      />

      {/* Vouchers List */}
      <Paper p="lg" withBorder shadow="sm">
        <LoadingOverlay visible={fetchingVouchers} overlayProps={{ blur: 2 }} />

        <Group position="apart" mb="md">
          <Title order={4}>
            <Group spacing="xs">
              <IconExchange size={20} />
              Journal Vouchers List
            </Group>
          </Title>
          <Group spacing="sm">
            <Badge size="lg" variant="filled" color="blue">
              {vouchers.length} Vouchers
            </Badge>
            <Button
              leftSection={<IconPlus size={16} />}
              color="blue"
              onClick={openAddModal}
            >
              Add Journal Voucher
            </Button>
          </Group>
        </Group>

        {vouchers.length === 0 ? (
          <Card p="xl" withBorder bg="gray.0">
            <Stack align="center" spacing="md">
              <IconExchange size={48} color="gray" />
              <Text color="dimmed" size="lg">No journal vouchers found</Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={openAddModal}
              >
                Create First Journal Voucher
              </Button>
            </Stack>
          </Card>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withBorder>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date</th>
                  <th>Voucher No</th>
                  <th>Debit Ledger</th>
                  <th style={{ textAlign: 'right' }}>Debit Amt</th>
                  <th>Credit Ledger</th>
                  <th style={{ textAlign: 'right' }}>Credit Amt</th>
                  <th>Narration</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher, index) => {
                  const debitEntry = voucher.entries?.find(e => e.debitAmount > 0);
                  const creditEntry = voucher.entries?.find(e => e.creditAmount > 0);

                  return (
                    <tr key={voucher._id}>
                      <td>{index + 1}</td>
                      <td>{dayjs(voucher.voucherDate).format('DD-MM-YYYY')}</td>
                      <td>
                        <Badge variant="outline" color="blue">
                          {voucher.voucherNumber || '-'}
                        </Badge>
                      </td>
                      <td>{debitEntry?.ledgerName || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Text weight={600} color="red">
                          ₹{(debitEntry?.debitAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </td>
                      <td>{creditEntry?.ledgerName || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Text weight={600} color="green">
                          ₹{(creditEntry?.creditAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </td>
                      <td>
                        <Text size="sm" lineClamp={1}>
                          {voucher.narration || '-'}
                        </Text>
                      </td>
                      <td>
                        <Group spacing="xs" position="center">
                          <Tooltip label="View Details">
                            <ActionIcon
                              color="blue"
                              variant="light"
                              onClick={() => handleView(voucher)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              color="red"
                              variant="light"
                              onClick={() => handleDelete(voucher._id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </ScrollArea>
        )}

        {/* Summary Card */}
        {vouchers.length > 0 && (
          <Card mt="md" p="md" withBorder bg="blue.0">
            <Group position="apart">
              <div>
                <Text size="sm" color="dimmed">Total Debit</Text>
                <Text size="xl" weight={700} color="red">
                  ₹{vouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </div>
              <div>
                <Text size="sm" color="dimmed">Total Credit</Text>
                <Text size="xl" weight={700} color="green">
                  ₹{vouchers.reduce((sum, v) => sum + (v.totalCredit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </div>
              <div>
                <Text size="sm" color="dimmed">Total Vouchers</Text>
                <Text size="xl" weight={700} color="blue">
                  {vouchers.length}
                </Text>
              </div>
            </Group>
          </Card>
        )}
      </Paper>

      {/* Add Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group spacing="xs">
            <IconExchange size={20} />
            <Text weight={600}>Add Journal Voucher</Text>
          </Group>
        }
        size={entryMode === 'multiple' ? 'xl' : 'lg'}
        centered
      >
        <LoadingOverlay visible={loading || savingMultiple} overlayProps={{ blur: 2 }} />

        <Stack spacing="md">
          {/* Entry Mode Selector */}
          <SegmentedControl
            value={entryMode}
            onChange={setEntryMode}
            fullWidth
            color="blue"
            data={[
              { label: 'Single Entry', value: 'single' },
              { label: 'Multiple Entries', value: 'multiple' }
            ]}
          />

          {entryMode === 'single' ? (
            /* Single Entry Form */
            <form onSubmit={form.onSubmit(handleSubmit)}>
              <Stack spacing="md">
                <TextInput
                  label="Voucher Date"
                  placeholder="Select date"
                  required
                  type="date"
                  icon={<IconCalendar size={16} />}
                  {...form.getInputProps('voucherDate')}
                />

                <Alert color="blue" variant="light" py="xs">
                  <Text size="xs">
                    Journal entries transfer amounts between ledgers. Enter separate amounts for debit and credit.
                  </Text>
                </Alert>

                {/* Debit Section */}
                <Paper p="md" withBorder style={{ borderLeft: '4px solid var(--mantine-color-red-6)' }}>
                  <Group position="apart" mb="sm">
                    <Group spacing="xs">
                      <IconArrowLeft size={16} color="red" />
                      <Text weight={600} color="red">Receipt (Dr)</Text>
                    </Group>
                    <Badge color="red" variant="light">To be debited</Badge>
                  </Group>
                  <Grid>
                    <Grid.Col span={7}>
                      <Select
                        label="Debit Ledger"
                        placeholder="Select ledger to debit"
                        required
                        searchable
                        data={Object.entries(groupedOptions).map(([group, items]) => ({
                          group,
                          items: items.map(item => ({ value: item.value, label: item.label }))
                        }))}
                        {...form.getInputProps('debitLedgerId')}
                      />
                    </Grid.Col>
                    <Grid.Col span={5}>
                      <NumberInput
                        label="Debit Amount"
                        placeholder="Enter amount"
                        required
                        icon={<IconCurrencyRupee size={16} />}
                        min={0.01}
                        step={0.01}
                        precision={2}
                        parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                        formatter={(value) =>
                          !Number.isNaN(parseFloat(value))
                            ? `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                            : '₹ '
                        }
                        {...form.getInputProps('debitAmount')}
                      />
                    </Grid.Col>
                  </Grid>
                </Paper>

                {/* Credit Section */}
                <Paper p="md" withBorder style={{ borderLeft: '4px solid var(--mantine-color-green-6)' }}>
                  <Group position="apart" mb="sm">
                    <Group spacing="xs">
                      <IconArrowRight size={16} color="green" />
                      <Text weight={600} color="green">Payment (Cr)</Text>
                    </Group>
                    <Badge color="green" variant="light">To be credited</Badge>
                  </Group>
                  <Grid>
                    <Grid.Col span={7}>
                      <Select
                        label="Credit Ledger"
                        placeholder="Select ledger to credit"
                        required
                        searchable
                        data={Object.entries(groupedOptions).map(([group, items]) => ({
                          group,
                          items: items.map(item => ({ value: item.value, label: item.label }))
                        }))}
                        {...form.getInputProps('creditLedgerId')}
                      />
                    </Grid.Col>
                    <Grid.Col span={5}>
                      <NumberInput
                        label="Credit Amount"
                        placeholder="Enter amount"
                        required
                        icon={<IconCurrencyRupee size={16} />}
                        min={0.01}
                        step={0.01}
                        precision={2}
                        parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                        formatter={(value) =>
                          !Number.isNaN(parseFloat(value))
                            ? `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                            : '₹ '
                        }
                        {...form.getInputProps('creditAmount')}
                      />
                    </Grid.Col>
                  </Grid>
                </Paper>

                {/* Balance Status */}
                {(form.values.debitAmount || form.values.creditAmount) && (
                  <Card p="sm" withBorder bg={isFormBalanced() ? 'green.0' : 'red.0'}>
                    <Group position="apart">
                      <Group spacing="md">
                        <div>
                          <Text size="xs" color="dimmed">Debit</Text>
                          <Text weight={600} color="red">
                            ₹{(parseFloat(form.values.debitAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Text>
                        </div>
                        <Text color="dimmed">=</Text>
                        <div>
                          <Text size="xs" color="dimmed">Credit</Text>
                          <Text weight={600} color="green">
                            ₹{(parseFloat(form.values.creditAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Text>
                        </div>
                      </Group>
                      <Badge color={isFormBalanced() ? 'green' : 'red'} size="lg">
                        {isFormBalanced() ? '✓ Balanced' : '✗ Not Balanced'}
                      </Badge>
                    </Group>
                    {!isFormBalanced() && (
                      <Text size="xs" color="red" mt="xs">
                        Difference: ₹{Math.abs((parseFloat(form.values.debitAmount) || 0) - (parseFloat(form.values.creditAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    )}
                  </Card>
                )}

                <Textarea
                  label="Narration"
                  placeholder="Enter narration/description"
                  required
                  icon={<IconNotes size={16} />}
                  minRows={2}
                  {...form.getInputProps('narration')}
                />

                <Divider />

                <Group position="right" spacing="md">
                  <Button
                    variant="default"
                    leftSection={<IconX size={16} />}
                    onClick={() => setModalOpened(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    leftSection={<IconCheck size={16} />}
                    loading={loading}
                    color="blue"
                    disabled={!isFormBalanced()}
                  >
                    Save Journal Voucher
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            /* Multiple Entries Form */
            <Stack spacing="md">
              <Alert color="blue" variant="light" py="xs">
                <Text size="xs">
                  Add multiple journal vouchers at once. Debit and Credit amounts must match for each entry.
                </Text>
              </Alert>

              <Group position="right">
                <Button
                  leftSection={<IconPlus size={16} />}
                  variant="light"
                  color="blue"
                  size="sm"
                  onClick={addMultipleRow}
                >
                  Add Row
                </Button>
              </Group>

              <ScrollArea style={{ maxHeight: '350px' }}>
                <Table striped withBorder>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '110px' }}>Date</th>
                      <th>Debit Ledger</th>
                      <th style={{ width: '100px' }}>Dr Amt</th>
                      <th>Credit Ledger</th>
                      <th style={{ width: '100px' }}>Cr Amt</th>
                      <th style={{ width: '120px' }}>Narration</th>
                      <th style={{ width: '50px' }}>✓</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {multipleEntries.map((entry, index) => {
                      const debitAmt = parseFloat(entry.debitAmount) || 0;
                      const creditAmt = parseFloat(entry.creditAmount) || 0;
                      const isBalanced = debitAmt > 0 && creditAmt > 0 && debitAmt === creditAmt;
                      const isDifferentLedger = entry.debitLedgerId !== entry.creditLedgerId || (!entry.debitLedgerId && !entry.creditLedgerId);

                      return (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>
                            <TextInput
                              type="date"
                              size="xs"
                              value={entry.voucherDate}
                              onChange={(e) => updateMultipleEntry(index, 'voucherDate', e.target.value)}
                            />
                          </td>
                          <td>
                            <Select
                              placeholder="Debit ledger"
                              searchable
                              size="xs"
                              data={Object.entries(groupedOptions).map(([group, items]) => ({
                                group,
                                items: items.map(item => ({ value: item.value, label: item.label }))
                              }))}
                              value={entry.debitLedgerId}
                              onChange={(value) => updateMultipleEntry(index, 'debitLedgerId', value)}
                            />
                          </td>
                          <td>
                            <NumberInput
                              size="xs"
                              placeholder="Amount"
                              min={0}
                              precision={2}
                              value={entry.debitAmount}
                              onChange={(value) => updateMultipleEntry(index, 'debitAmount', value)}
                              styles={{ input: { color: 'red', fontWeight: 600 } }}
                            />
                          </td>
                          <td>
                            <Select
                              placeholder="Credit ledger"
                              searchable
                              size="xs"
                              data={Object.entries(groupedOptions).map(([group, items]) => ({
                                group,
                                items: items.map(item => ({ value: item.value, label: item.label }))
                              }))}
                              value={entry.creditLedgerId}
                              onChange={(value) => updateMultipleEntry(index, 'creditLedgerId', value)}
                            />
                          </td>
                          <td>
                            <NumberInput
                              size="xs"
                              placeholder="Amount"
                              min={0}
                              precision={2}
                              value={entry.creditAmount}
                              onChange={(value) => updateMultipleEntry(index, 'creditAmount', value)}
                              styles={{ input: { color: 'green', fontWeight: 600 } }}
                            />
                          </td>
                          <td>
                            <TextInput
                              size="xs"
                              placeholder="Narration"
                              value={entry.narration}
                              onChange={(e) => updateMultipleEntry(index, 'narration', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isBalanced && isDifferentLedger ? (
                              <Badge color="green" size="xs">✓</Badge>
                            ) : (debitAmt > 0 || creditAmt > 0) ? (
                              <Badge color="red" size="xs">✗</Badge>
                            ) : null}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Tooltip label="Remove">
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() => removeMultipleRow(index)}
                                disabled={multipleEntries.length === 1}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </ScrollArea>

              {/* Total Summary */}
              <Card p="sm" withBorder bg="blue.0">
                <Group position="apart">
                  <Group spacing="lg">
                    <div>
                      <Text size="xs" color="dimmed">Total Debit</Text>
                      <Text weight={700} color="red">
                        ₹{getMultipleTotals().debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" color="dimmed">Total Credit</Text>
                      <Text weight={700} color="green">
                        ₹{getMultipleTotals().creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </div>
                  </Group>
                  <Text weight={500}>({multipleEntries.length} entries)</Text>
                </Group>
              </Card>

              <Divider />

              <Group position="right" spacing="md">
                <Button
                  variant="default"
                  leftSection={<IconX size={16} />}
                  onClick={() => setModalOpened(false)}
                  disabled={savingMultiple}
                >
                  Cancel
                </Button>
                <Button
                  leftSection={<IconCheck size={16} />}
                  loading={savingMultiple}
                  color="blue"
                  onClick={handleSaveMultiple}
                >
                  Save All Vouchers
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>

      {/* View Details Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title={
          <Group spacing="xs">
            <IconEye size={20} />
            <Text weight={600}>Voucher Details</Text>
          </Group>
        }
        size="md"
        centered
      >
        {selectedVoucher && (
          <Stack spacing="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Voucher Number</Text>
                <Text weight={500}>{selectedVoucher.voucherNumber || '-'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Voucher Date</Text>
                <Text weight={500}>{dayjs(selectedVoucher.voucherDate).format('DD-MM-YYYY')}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Voucher Type</Text>
                <Badge color="blue">{selectedVoucher.voucherType}</Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Reference Type</Text>
                <Text weight={500}>{selectedVoucher.referenceType || '-'}</Text>
              </Grid.Col>
            </Grid>

            <Divider label="Entries" labelPosition="center" />

            <Table withBorder>
              <thead>
                <tr>
                  <th>Ledger</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {selectedVoucher.entries?.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{entry.ledgerName}</td>
                    <td style={{ textAlign: 'right' }}>
                      {entry.debitAmount > 0 ? (
                        <Text color="red" weight={600}>
                          ₹{entry.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      ) : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {entry.creditAmount > 0 ? (
                        <Text color="green" weight={600}>
                          ₹{entry.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right', color: 'red' }}>
                    ₹{(selectedVoucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', color: 'green' }}>
                    ₹{(selectedVoucher.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </Table>

            <Card p="sm" withBorder bg="gray.0">
              <Text size="sm" color="dimmed">Narration</Text>
              <Text>{selectedVoucher.narration || '-'}</Text>
            </Card>

            <Group position="right">
              <Button variant="default" onClick={() => setViewModalOpened(false)}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default JournalVoucher;
