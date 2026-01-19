import { useState, useEffect } from 'react';
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
  SegmentedControl
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconCalendar,
  IconCash,
  IconUser,
  IconCurrencyRupee,
  IconNotes,
  IconCheck,
  IconX,
  IconPlus,
  IconEye,
  IconTrash,
  IconCreditCard
} from '@tabler/icons-react';

const PaymentVoucher = () => {
  const [loading, setLoading] = useState(false);
  const [fetchingVouchers, setFetchingVouchers] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [entryMode, setEntryMode] = useState('single');
  const [multipleEntries, setMultipleEntries] = useState([
    { voucherDate: dayjs().format('YYYY-MM-DD'), debitLedgerId: '', creditLedgerId: '', amount: '', narration: '' }
  ]);
  const [savingMultiple, setSavingMultiple] = useState(false);

  const form = useForm({
    initialValues: {
      voucherDate: dayjs().format('YYYY-MM-DD'),
      debitLedgerId: '',
      creditLedgerId: '',
      amount: '',
      narration: ''
    },
    validate: {
      voucherDate: (value) => !value ? 'Voucher date is required' : null,
      debitLedgerId: (value) => !value ? 'Please select debit ledger' : null,
      creditLedgerId: (value) => !value ? 'Please select credit ledger' : null,
      amount: (value) => {
        if (!value) return 'Please enter amount';
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
      const response = await voucherAPI.getAll({ voucherType: 'Payment' });
      setVouchers(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch vouchers');
    } finally {
      setFetchingVouchers(false);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const debitLedger = ledgers.find(l => l._id === values.debitLedgerId);
      const creditLedger = ledgers.find(l => l._id === values.creditLedgerId);
      const amount = parseFloat(values.amount);

      const payload = {
        voucherType: 'Payment',
        voucherDate: new Date(values.voucherDate).toISOString(),
        entries: [
          {
            ledgerId: values.debitLedgerId,
            ledgerName: debitLedger.ledgerName,
            debitAmount: amount,
            creditAmount: 0,
            narration: values.narration
          },
          {
            ledgerId: values.creditLedgerId,
            ledgerName: creditLedger.ledgerName,
            debitAmount: 0,
            creditAmount: amount,
            narration: values.narration
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        referenceType: 'Manual',
        narration: values.narration
      };

      await voucherAPI.create(payload);
      message.success('Payment voucher created successfully');
      setModalOpened(false);
      form.reset();
      fetchVouchers();
    } catch (error) {
      message.error(error.message || 'Failed to create payment voucher');
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
      { voucherDate: dayjs().format('YYYY-MM-DD'), debitLedgerId: '', creditLedgerId: '', amount: '', narration: '' }
    ]);
    setModalOpened(true);
  };

  const addMultipleRow = () => {
    setMultipleEntries([
      ...multipleEntries,
      { voucherDate: dayjs().format('YYYY-MM-DD'), debitLedgerId: '', creditLedgerId: '', amount: '', narration: '' }
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
    const validEntries = multipleEntries.filter(entry =>
      entry.voucherDate && entry.debitLedgerId && entry.creditLedgerId && entry.amount && parseFloat(entry.amount) > 0
    );

    if (validEntries.length === 0) {
      message.error('Please fill at least one complete entry');
      return;
    }

    setSavingMultiple(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of validEntries) {
      try {
        const debitLedger = ledgers.find(l => l._id === entry.debitLedgerId);
        const creditLedger = ledgers.find(l => l._id === entry.creditLedgerId);
        const amount = parseFloat(entry.amount);

        const payload = {
          voucherType: 'Payment',
          voucherDate: new Date(entry.voucherDate).toISOString(),
          entries: [
            {
              ledgerId: entry.debitLedgerId,
              ledgerName: debitLedger?.ledgerName || '',
              debitAmount: amount,
              creditAmount: 0,
              narration: entry.narration || ''
            },
            {
              ledgerId: entry.creditLedgerId,
              ledgerName: creditLedger?.ledgerName || '',
              debitAmount: 0,
              creditAmount: amount,
              narration: entry.narration || ''
            }
          ],
          totalDebit: amount,
          totalCredit: amount,
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

  const getMultipleTotal = () => {
    return multipleEntries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
  };

  const ledgerOptions = ledgers.map(ledger => ({
    label: `${ledger.ledgerName} (${ledger.ledgerType})`,
    value: ledger._id,
    group: getLedgerGroup(ledger.ledgerType)
  }));

  function getLedgerGroup(ledgerType) {
    if (['Cash', 'Bank'].includes(ledgerType)) return 'Cash/Bank Accounts';
    if (ledgerType === 'Party') return 'Parties';
    if (['Purchase A/c', 'Trade Expense', 'Miscellaneous Expense'].includes(ledgerType)) return 'Expense Accounts';
    if (['Accounts Due From (Sundry Debtors)'].includes(ledgerType)) return 'Receivable Accounts';
    if (['Other Receivable', 'Other Assets'].includes(ledgerType)) return 'Asset Accounts';
    return 'Other Accounts';
  }

  const groupedOptions = ledgerOptions.reduce((groups, option) => {
    if (!groups[option.group]) {
      groups[option.group] = [];
    }
    groups[option.group].push(option);
    return groups;
  }, {});

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Payment Voucher"
        subtitle="Manage payment vouchers for money paid"
        rightSection={
          <Button
            leftSection={<IconPlus size={16} />}
            color="red"
            onClick={openAddModal}
          >
            Add Payment Voucher
          </Button>
        }
      />

      {/* Vouchers List */}
      <Paper p="lg" withBorder shadow="sm">
        <LoadingOverlay visible={fetchingVouchers} overlayProps={{ blur: 2 }} />

        <Group position="apart" mb="md">
          <Title order={4}>
            <Group spacing="xs">
              <IconCreditCard size={20} />
              Payment Vouchers List
            </Group>
          </Title>
          <Group spacing="sm">
            <Badge size="lg" variant="filled" color="red">
              {vouchers.length} Vouchers
            </Badge>
            <Button
              leftSection={<IconPlus size={16} />}
              color="red"
              onClick={openAddModal}
            >
              Add Payment Voucher
            </Button>
          </Group>
        </Group>

        {vouchers.length === 0 ? (
          <Card p="xl" withBorder bg="gray.0">
            <Stack align="center" spacing="md">
              <IconCreditCard size={48} color="gray" />
              <Text color="dimmed" size="lg">No payment vouchers found</Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={openAddModal}
              >
                Create First Payment Voucher
              </Button>
            </Stack>
          </Card>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withBorder verticalSpacing="sm">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>S.No</th>
                  <th style={{ width: '120px' }}>Date</th>
                  <th style={{ width: '150px' }}>Voucher No</th>
                  <th>Debit (Paid To)</th>
                  <th>Credit (Paid From)</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Amount</th>
                  <th>Narration</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher, index) => {
                  const debitEntry = voucher.entries?.find(e => e.debitAmount > 0);
                  const creditEntry = voucher.entries?.find(e => e.creditAmount > 0);

                  return (
                    <tr key={voucher._id}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td>{dayjs(voucher.voucherDate).format('DD-MM-YYYY')}</td>
                      <td>
                        <Badge variant="outline" color="blue" fullWidth>
                          {voucher.voucherNumber || '-'}
                        </Badge>
                      </td>
                      <td>
                        <Text size="sm" lineClamp={1}>
                          {debitEntry?.ledgerName || '-'}
                        </Text>
                      </td>
                      <td>
                        <Text size="sm" lineClamp={1}>
                          {creditEntry?.ledgerName || '-'}
                        </Text>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Text weight={600} color="red">
                          ₹{(voucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </td>
                      <td>
                        <Text size="sm" lineClamp={1}>
                          {voucher.narration || '-'}
                        </Text>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Group gap="xs" justify="center" wrap="nowrap">
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
          <Card mt="md" p="md" withBorder bg="red.0">
            <Group position="apart">
              <Text weight={500}>Total Payments</Text>
              <Text size="xl" weight={700} color="red">
                ₹{vouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Group>
          </Card>
        )}
      </Paper>

      {/* Add/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group spacing="xs">
            <IconCreditCard size={20} />
            <Text weight={600}>Add Payment Voucher</Text>
          </Group>
        }
        size={entryMode === 'multiple' ? 'xl' : 'lg'}
        centered
      >
        <LoadingOverlay visible={loading || savingMultiple} overlayProps={{ blur: 2 }} />

        <Stack spacing="md">
          <SegmentedControl
            value={entryMode}
            onChange={setEntryMode}
            fullWidth
            color="red"
            data={[
              { label: 'Single Entry', value: 'single' },
              { label: 'Multiple Entries', value: 'multiple' }
            ]}
          />

          {entryMode === 'single' ? (
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

                <Alert color="orange" variant="light" py="xs">
                  <Text size="xs">
                    Debit: Party/Expense (where money goes TO) | Credit: Cash/Bank (where money comes FROM)
                  </Text>
                </Alert>

                <Select
                  label="Debit (Party/Expense - Paid To)"
                  placeholder="Select ledger"
                  required
                  searchable
                  icon={<IconUser size={16} />}
                  data={Object.entries(groupedOptions).map(([group, items]) => ({
                    group,
                    items: items.map(item => ({ value: item.value, label: item.label }))
                  }))}
                  {...form.getInputProps('debitLedgerId')}
                />

                <Select
                  label="Credit (Cash/Bank - Paid From)"
                  placeholder="Select ledger"
                  required
                  searchable
                  icon={<IconCash size={16} />}
                  data={Object.entries(groupedOptions).map(([group, items]) => ({
                    group,
                    items: items.map(item => ({ value: item.value, label: item.label }))
                  }))}
                  {...form.getInputProps('creditLedgerId')}
                />

                <NumberInput
                  label="Amount"
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
                  {...form.getInputProps('amount')}
                />

                <Textarea
                  label="Narration"
                  placeholder="Enter narration/description"
                  required
                  icon={<IconNotes size={16} />}
                  minRows={2}
                  {...form.getInputProps('narration')}
                />

                {form.values.amount && (
                  <Card p="sm" withBorder bg="gray.0">
                    <Group position="apart">
                      <Text size="sm" color="dimmed">Amount to be recorded:</Text>
                      <Text weight={700} color="red" size="lg">
                        ₹{parseFloat(form.values.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </Group>
                  </Card>
                )}

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
                    color="red"
                  >
                    Save Payment Voucher
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            <Stack spacing="md">
              <Alert color="orange" variant="light" py="xs">
                <Text size="xs">
                  Add multiple payment vouchers at once. Fill in the details for each voucher and click Save All.
                </Text>
              </Alert>

              <Group position="right">
                <Button
                  leftSection={<IconPlus size={16} />}
                  variant="light"
                  color="red"
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
                      <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '130px' }}>Date</th>
                      <th>Debit (Party/Expense)</th>
                      <th>Credit (Cash/Bank)</th>
                      <th style={{ width: '120px' }}>Amount</th>
                      <th>Narration</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multipleEntries.map((entry, index) => (
                      <tr key={index}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
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
                            placeholder="Select ledger"
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
                          <Select
                            placeholder="Select ledger"
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
                            value={entry.amount}
                            onChange={(value) => updateMultipleEntry(index, 'amount', value)}
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
                    ))}
                  </tbody>
                </Table>
              </ScrollArea>

              <Card p="sm" withBorder bg="red.0">
                <Group position="apart">
                  <Group spacing="xs">
                    <Text weight={500}>Total ({multipleEntries.length} entries)</Text>
                  </Group>
                  <Text size="lg" weight={700} color="red">
                    ₹{getMultipleTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
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
                  color="red"
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
                <Badge color="red">{selectedVoucher.voucherType}</Badge>
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
                  <th style={{ width: '150px', textAlign: 'right' }}>Debit</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {selectedVoucher.entries?.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{entry.ledgerName}</td>
                    <td style={{ textAlign: 'right' }}>
                      {entry.debitAmount > 0 ? `₹${entry.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {entry.creditAmount > 0 ? `₹${entry.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>
                    ₹{(selectedVoucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
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

export default PaymentVoucher;