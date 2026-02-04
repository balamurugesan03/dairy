/**
 * Business Expense Voucher - For Private Firm
 * Exactly matches Dairy Payment Voucher functionality
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { businessLedgerAPI, businessVoucherAPI } from '../../services/api';
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
  Alert,
  ThemeIcon
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar,
  IconCurrencyRupee,
  IconNotes,
  IconCheck,
  IconX,
  IconPlus,
  IconEye,
  IconTrash,
  IconArrowUpCircle,
  IconPrinter
} from '@tabler/icons-react';

const BusinessExpenseVoucher = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchingVouchers, setFetchingVouchers] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [modalOpened, setModalOpened] = useState(false);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const printRef = useRef(null);
  const [entryMode, setEntryMode] = useState('single');
  const [multipleEntries, setMultipleEntries] = useState([
    { voucherDate: dayjs().format('YYYY-MM-DD'), ledgerId: '', amount: '', narration: '' }
  ]);
  const [savingMultiple, setSavingMultiple] = useState(false);

  const form = useForm({
    initialValues: {
      voucherDate: dayjs().format('YYYY-MM-DD'),
      ledgerId: '',
      amount: '',
      narration: ''
    },
    validate: {
      voucherDate: (value) => !value ? 'Voucher date is required' : null,
      ledgerId: (value) => !value ? 'Please select head of account' : null,
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
      const response = await businessLedgerAPI.getAll();
      const allLedgers = Array.isArray(response) ? response : response?.data || [];
      setLedgers(allLedgers.filter(l => l.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch ledgers',
        color: 'red'
      });
    }
  };

  const fetchVouchers = async () => {
    setFetchingVouchers(true);
    try {
      const response = await businessVoucherAPI.getAll({ voucherType: 'Expense' });
      const voucherData = response?.data || response || [];
      setVouchers(Array.isArray(voucherData) ? voucherData : []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch vouchers',
        color: 'red'
      });
    } finally {
      setFetchingVouchers(false);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const selectedLedger = ledgers.find(l => l._id === values.ledgerId);
      const cashLedger = ledgers.find(l => l.group === 'Cash-in-Hand');
      const amount = parseFloat(values.amount);

      if (!cashLedger) {
        notifications.show({
          title: 'Error',
          message: 'Cash ledger not found. Please create a Cash ledger first.',
          color: 'red'
        });
        setLoading(false);
        return;
      }

      const payload = {
        voucherType: 'Expense',
        date: new Date(values.voucherDate).toISOString(),
        entries: [
          {
            ledgerId: values.ledgerId,
            ledgerName: selectedLedger?.name || selectedLedger?.ledgerName,
            type: 'debit',
            amount: amount,
            description: values.narration
          },
          {
            ledgerId: cashLedger._id,
            ledgerName: cashLedger.name || cashLedger.ledgerName,
            type: 'credit',
            amount: amount,
            description: values.narration
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        narration: values.narration
      };

      await businessVoucherAPI.createExpense(payload);
      notifications.show({
        title: 'Success',
        message: 'Expense voucher created successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      setModalOpened(false);
      form.reset();
      fetchVouchers();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create expense voucher',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this voucher?')) return;
    try {
      await businessVoucherAPI.delete(id);
      notifications.show({
        title: 'Success',
        message: 'Voucher deleted successfully',
        color: 'green'
      });
      fetchVouchers();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete voucher',
        color: 'red'
      });
    }
  };

  const handleView = async (voucher) => {
    try {
      const response = await businessVoucherAPI.getById(voucher._id);
      setSelectedVoucher(response?.data || response);
      setViewModalOpened(true);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch voucher details',
        color: 'red'
      });
    }
  };

  const handlePrint = (voucher) => {
    setSelectedVoucher(voucher);
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      const debitEntry = voucher.entries?.find(e => e.type === 'debit' || e.debitAmount > 0);
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Expense Voucher - ${voucher.voucherNumber || 'N/A'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            .voucher-container { max-width: 800px; margin: 0 auto; border: 2px solid #333; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
            .header h1 { font-size: 24px; margin-bottom: 5px; }
            .header h2 { font-size: 18px; color: #dc3545; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; }
            .info-row.bordered { border-bottom: 1px dashed #ccc; }
            .label { font-weight: bold; color: #555; }
            .value { font-weight: 500; }
            .amount-section { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center; }
            .amount-section .amount { font-size: 28px; font-weight: bold; color: #dc3545; }
            .narration-section { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
            .narration-section .label { display: block; margin-bottom: 5px; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature { text-align: center; padding-top: 40px; border-top: 1px solid #333; width: 150px; }
            @media print {
              body { padding: 0; }
              .voucher-container { border: 2px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="voucher-container">
            <div class="header">
              <h1>EXPENSE VOUCHER</h1>
              <h2>Money Paid</h2>
            </div>

            <div class="info-row bordered">
              <span class="label">Bill No:</span>
              <span class="value">${voucher.voucherNumber || 'Auto-Generated'}</span>
            </div>

            <div class="info-row bordered">
              <span class="label">Date:</span>
              <span class="value">${dayjs(voucher.date || voucher.voucherDate).format('DD-MM-YYYY')}</span>
            </div>

            <div class="info-row bordered">
              <span class="label">Paid To (Head of Account):</span>
              <span class="value">${debitEntry?.ledgerName || debitEntry?.ledgerId?.name || '-'}</span>
            </div>

            <div class="amount-section">
              <div class="label">Amount Paid</div>
              <div class="amount">₹${(voucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>

            <div class="narration-section">
              <span class="label">Narration:</span>
              <span class="value">${voucher.narration || '-'}</span>
            </div>

            <div class="footer">
              <div class="signature">Receiver's Signature</div>
              <div class="signature">Authorized Signature</div>
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 100);
  };

  const openAddModal = () => {
    form.reset();
    form.setFieldValue('voucherDate', dayjs().format('YYYY-MM-DD'));
    setEntryMode('single');
    setMultipleEntries([
      { voucherDate: dayjs().format('YYYY-MM-DD'), ledgerId: '', amount: '', narration: '' }
    ]);
    setModalOpened(true);
  };

  const addMultipleRow = () => {
    setMultipleEntries([
      ...multipleEntries,
      { voucherDate: dayjs().format('YYYY-MM-DD'), ledgerId: '', amount: '', narration: '' }
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
    const cashLedger = ledgers.find(l => l.group === 'Cash-in-Hand');
    if (!cashLedger) {
      notifications.show({
        title: 'Error',
        message: 'Cash ledger not found. Please create a Cash ledger first.',
        color: 'red'
      });
      return;
    }

    const validEntries = multipleEntries.filter(entry => {
      const amount = parseFloat(entry.amount) || 0;
      return entry.voucherDate && entry.ledgerId && amount > 0;
    });

    if (validEntries.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please fill at least one complete entry with ledger and amount',
        color: 'red'
      });
      return;
    }

    setSavingMultiple(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of validEntries) {
      try {
        const selectedLedger = ledgers.find(l => l._id === entry.ledgerId);
        const amount = parseFloat(entry.amount);

        const payload = {
          voucherType: 'Expense',
          date: new Date(entry.voucherDate).toISOString(),
          entries: [
            {
              ledgerId: entry.ledgerId,
              ledgerName: selectedLedger?.name || selectedLedger?.ledgerName || '',
              type: 'debit',
              amount: amount,
              description: entry.narration || ''
            },
            {
              ledgerId: cashLedger._id,
              ledgerName: cashLedger.name || cashLedger.ledgerName,
              type: 'credit',
              amount: amount,
              description: entry.narration || ''
            }
          ],
          totalDebit: amount,
          totalCredit: amount,
          narration: entry.narration || ''
        };

        await businessVoucherAPI.createExpense(payload);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setSavingMultiple(false);

    if (successCount > 0) {
      notifications.show({
        title: 'Success',
        message: `${successCount} expense voucher(s) created successfully`,
        color: 'green'
      });
      setModalOpened(false);
      fetchVouchers();
    }
    if (errorCount > 0) {
      notifications.show({
        title: 'Error',
        message: `${errorCount} voucher(s) failed to create`,
        color: 'red'
      });
    }
  };

  const getMultipleTotals = () => {
    return multipleEntries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
  };

  // Group ledgers by type
  const getLedgerGroup = (group) => {
    if (['Cash-in-Hand', 'Bank Accounts'].includes(group)) return 'Cash/Bank Accounts';
    if (['Sundry Debtors', 'Sundry Creditors'].includes(group)) return 'Parties';
    if (['Direct Expenses', 'Indirect Expenses'].includes(group)) return 'Expense Accounts';
    if (['Current Liabilities', 'Loans (Liability)'].includes(group)) return 'Liability Accounts';
    return 'Other Accounts';
  };

  const ledgerOptions = ledgers.map(ledger => ({
    label: `${ledger.code || ''} - ${ledger.name}`,
    value: ledger._id,
    group: getLedgerGroup(ledger.group)
  }));

  const groupedOptions = ledgerOptions.reduce((groups, option) => {
    if (!groups[option.group]) {
      groups[option.group] = [];
    }
    groups[option.group].push(option);
    return groups;
  }, {});

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="red">
              <IconArrowUpCircle size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Expense Voucher</Title>
              <Text size="sm" c="dimmed">Manage expense vouchers for money paid</Text>
            </div>
          </Group>
          <Button
            leftSection={<IconPlus size={16} />}
            color="red"
            onClick={openAddModal}
          >
            Add Expense Voucher
          </Button>
        </Group>
      </Paper>

      {/* Vouchers List */}
      <Paper p="lg" withBorder shadow="sm">
        <LoadingOverlay visible={fetchingVouchers} overlayProps={{ blur: 2 }} />

        <Group justify="space-between" mb="md">
          <Title order={4}>
            <Group gap="xs">
              <IconArrowUpCircle size={20} />
              Expense Vouchers List
            </Group>
          </Title>
          <Group gap="sm">
            <Badge size="lg" variant="filled" color="red">
              {vouchers.length} Vouchers
            </Badge>
            <Button
              leftSection={<IconPlus size={16} />}
              color="red"
              onClick={openAddModal}
            >
              Add Expense Voucher
            </Button>
          </Group>
        </Group>

        {vouchers.length === 0 ? (
          <Card p="xl" withBorder bg="gray.0">
            <Stack align="center" gap="md">
              <IconArrowUpCircle size={48} color="gray" />
              <Text c="dimmed" size="lg">No expense vouchers found</Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={openAddModal}
              >
                Create First Expense Voucher
              </Button>
            </Stack>
          </Card>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>S.No</Table.Th>
                  <Table.Th>Bill No</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Head of Account</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                  <Table.Th>Narration</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vouchers.map((voucher, index) => {
                  const debitEntry = voucher.entries?.find(e => e.type === 'debit' || e.debitAmount > 0);

                  return (
                    <Table.Tr key={voucher._id}>
                      <Table.Td>{index + 1}</Table.Td>
                      <Table.Td>
                        <Badge variant="outline" color="red">
                          {voucher.voucherNumber || 'Auto'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{dayjs(voucher.date || voucher.voucherDate).format('DD-MM-YYYY')}</Table.Td>
                      <Table.Td>{debitEntry?.ledgerName || debitEntry?.ledgerId?.name || '-'}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={600} c="red">
                          ₹{(voucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {voucher.narration || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="center">
                          <Tooltip label="View Details">
                            <ActionIcon
                              color="blue"
                              variant="light"
                              onClick={() => handleView(voucher)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Print">
                            <ActionIcon
                              color="red"
                              variant="light"
                              onClick={() => handlePrint(voucher)}
                            >
                              <IconPrinter size={16} />
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
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {/* Summary Card */}
        {vouchers.length > 0 && (
          <Card mt="md" p="md" withBorder bg="red.0">
            <Group justify="space-between">
              <Text fw={500}>Total Expenses</Text>
              <Text size="xl" fw={700} c="red">
                ₹{vouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Group>
          </Card>
        )}
      </Paper>

      {/* Add Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          <Group gap="xs">
            <IconArrowUpCircle size={20} />
            <Text fw={600}>Add Expense Voucher</Text>
          </Group>
        }
        size={entryMode === 'multiple' ? 'xl' : 'md'}
        centered
      >
        <LoadingOverlay visible={loading || savingMultiple} overlayProps={{ blur: 2 }} />

        <Stack gap="md">
          {/* Entry Mode Selector */}
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
            /* Single Entry Form */
            <form onSubmit={form.onSubmit(handleSubmit)}>
              <Stack gap="md">
                <TextInput
                  label="Voucher Date"
                  placeholder="Select date"
                  required
                  type="date"
                  leftSection={<IconCalendar size={16} />}
                  {...form.getInputProps('voucherDate')}
                />

                <Select
                  label="Head of Account (Ledger)"
                  placeholder="Select ledger"
                  required
                  searchable
                  data={Object.entries(groupedOptions).map(([group, items]) => ({
                    group,
                    items: items.map(item => ({ value: item.value, label: item.label }))
                  }))}
                  {...form.getInputProps('ledgerId')}
                />

                <NumberInput
                  label="Amount"
                  placeholder="Enter amount"
                  required
                  leftSection={<IconCurrencyRupee size={16} />}
                  min={0.01}
                  step={0.01}
                  decimalScale={2}
                  thousandSeparator=","
                  {...form.getInputProps('amount')}
                />

                <Textarea
                  label="Narration"
                  placeholder="Enter narration/description"
                  required
                  leftSection={<IconNotes size={16} />}
                  minRows={2}
                  {...form.getInputProps('narration')}
                />

                {/* Bill No Info */}
                <Card p="sm" withBorder bg="blue.0">
                  <Group gap="xs">
                    <IconArrowUpCircle size={16} />
                    <Text size="sm" c="dimmed">
                      Bill No will be auto-generated upon saving
                    </Text>
                  </Group>
                </Card>

                {/* Amount Preview */}
                {form.values.amount && (
                  <Card p="sm" withBorder bg="red.0">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Amount to be recorded:</Text>
                      <Text fw={700} c="red" size="lg">
                        ₹{parseFloat(form.values.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </Group>
                  </Card>
                )}

                <Divider />

                <Group justify="flex-end" gap="md">
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
                    Save Expense Voucher
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            /* Multiple Entries Form */
            <Stack gap="md">
              <Alert color="red" variant="light" py="xs">
                <Text size="xs">
                  Add multiple expense vouchers at once. Cash account will be credited automatically for each entry.
                </Text>
              </Alert>

              <Group justify="flex-end">
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
                <Table striped withTableBorder>
                  <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                    <Table.Tr>
                      <Table.Th style={{ width: '40px' }}>#</Table.Th>
                      <Table.Th style={{ width: '120px' }}>Date</Table.Th>
                      <Table.Th>Head of Account</Table.Th>
                      <Table.Th style={{ width: '120px' }}>Amount</Table.Th>
                      <Table.Th style={{ width: '150px' }}>Narration</Table.Th>
                      <Table.Th style={{ width: '50px' }}>Status</Table.Th>
                      <Table.Th style={{ width: '50px' }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {multipleEntries.map((entry, index) => {
                      const amount = parseFloat(entry.amount) || 0;
                      const isValid = entry.voucherDate && entry.ledgerId && amount > 0;

                      return (
                        <Table.Tr key={index}>
                          <Table.Td>{index + 1}</Table.Td>
                          <Table.Td>
                            <TextInput
                              type="date"
                              size="xs"
                              value={entry.voucherDate}
                              onChange={(e) => updateMultipleEntry(index, 'voucherDate', e.target.value)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Select
                              placeholder="Select ledger"
                              searchable
                              size="xs"
                              data={Object.entries(groupedOptions).map(([group, items]) => ({
                                group,
                                items: items.map(item => ({ value: item.value, label: item.label }))
                              }))}
                              value={entry.ledgerId}
                              onChange={(value) => updateMultipleEntry(index, 'ledgerId', value)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              size="xs"
                              placeholder="Amount"
                              min={0}
                              decimalScale={2}
                              value={entry.amount}
                              onChange={(value) => updateMultipleEntry(index, 'amount', value)}
                              styles={{ input: { color: 'red', fontWeight: 600 } }}
                            />
                          </Table.Td>
                          <Table.Td>
                            <TextInput
                              size="xs"
                              placeholder="Narration"
                              value={entry.narration}
                              onChange={(e) => updateMultipleEntry(index, 'narration', e.target.value)}
                            />
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            {isValid ? (
                              <Badge color="green" size="xs">Valid</Badge>
                            ) : (entry.ledgerId || amount > 0) ? (
                              <Badge color="red" size="xs">Incomplete</Badge>
                            ) : null}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
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
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {/* Total Summary */}
              <Card p="sm" withBorder bg="red.0">
                <Group justify="space-between">
                  <Group gap="lg">
                    <div>
                      <Text size="xs" c="dimmed">Total Amount</Text>
                      <Text fw={700} c="red" size="lg">
                        ₹{getMultipleTotals().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </div>
                  </Group>
                  <Text fw={500}>({multipleEntries.filter(e => e.ledgerId && parseFloat(e.amount) > 0).length} valid entries)</Text>
                </Group>
              </Card>

              <Divider />

              <Group justify="flex-end" gap="md">
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
          <Group gap="xs">
            <IconEye size={20} />
            <Text fw={600}>Expense Voucher Details</Text>
          </Group>
        }
        size="md"
        centered
      >
        {selectedVoucher && (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Bill No</Text>
                <Badge size="lg" color="red">{selectedVoucher.voucherNumber || 'Auto'}</Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Voucher Date</Text>
                <Text fw={500}>{dayjs(selectedVoucher.date || selectedVoucher.voucherDate).format('DD-MM-YYYY')}</Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Text size="sm" c="dimmed">Head of Account (Paid To)</Text>
                <Text fw={500}>
                  {selectedVoucher.entries?.find(e => e.type === 'debit' || e.debitAmount > 0)?.ledgerName ||
                   selectedVoucher.entries?.find(e => e.type === 'debit' || e.debitAmount > 0)?.ledgerId?.name || '-'}
                </Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Card p="md" withBorder bg="red.0">
                  <Text size="sm" c="dimmed" mb="xs">Amount Paid</Text>
                  <Text size="xl" fw={700} c="red">
                    ₹{(selectedVoucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Card>
              </Grid.Col>
            </Grid>

            <Card p="sm" withBorder bg="gray.0">
              <Text size="sm" c="dimmed">Narration</Text>
              <Text>{selectedVoucher.narration || '-'}</Text>
            </Card>

            <Divider />

            <Group justify="flex-end" gap="md">
              <Button
                variant="light"
                color="red"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  setViewModalOpened(false);
                  handlePrint(selectedVoucher);
                }}
              >
                Print
              </Button>
              <Button variant="default" onClick={() => setViewModalOpened(false)}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Hidden print container */}
      <div id="print-expense" style={{ display: 'none' }} ref={printRef}></div>
    </Container>
  );
};

export default BusinessExpenseVoucher;
