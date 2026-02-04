import { useState, useEffect, useRef } from 'react';
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
  Alert
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
  IconReceipt,
  IconPrinter
} from '@tabler/icons-react';

const ReceiptVoucher = () => {
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
      const response = await ledgerAPI.getAll();
      setLedgers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledgers');
    }
  };

  const fetchVouchers = async () => {
    setFetchingVouchers(true);
    try {
      const response = await voucherAPI.getAll({ voucherType: 'Receipt' });
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
      const selectedLedger = ledgers.find(l => l._id === values.ledgerId);
      const cashLedger = ledgers.find(l => l.ledgerType === 'Cash');
      const amount = parseFloat(values.amount);

      if (!cashLedger) {
        message.error('Cash ledger not found. Please create a Cash ledger first.');
        setLoading(false);
        return;
      }

      const payload = {
        voucherType: 'Receipt',
        voucherDate: new Date(values.voucherDate).toISOString(),
        entries: [
          {
            ledgerId: cashLedger._id,
            ledgerName: cashLedger.ledgerName,
            debitAmount: amount,
            creditAmount: 0,
            narration: values.narration
          },
          {
            ledgerId: values.ledgerId,
            ledgerName: selectedLedger.ledgerName,
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
      message.success('Receipt voucher created successfully');
      setModalOpened(false);
      form.reset();
      fetchVouchers();
    } catch (error) {
      message.error(error.message || 'Failed to create receipt voucher');
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

  const handlePrint = (voucher) => {
    setSelectedVoucher(voucher);
    setTimeout(() => {
      const printContent = document.getElementById('print-receipt');
      if (printContent) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Receipt Voucher - ${voucher.voucherNumber || 'N/A'}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; padding: 20px; }
              .receipt-container { max-width: 800px; margin: 0 auto; border: 2px solid #333; padding: 20px; }
              .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
              .header h1 { font-size: 24px; margin-bottom: 5px; }
              .header h2 { font-size: 18px; color: #28a745; }
              .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; }
              .info-row.bordered { border-bottom: 1px dashed #ccc; }
              .label { font-weight: bold; color: #555; }
              .value { font-weight: 500; }
              .amount-section { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center; }
              .amount-section .amount { font-size: 28px; font-weight: bold; color: #28a745; }
              .narration-section { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
              .narration-section .label { display: block; margin-bottom: 5px; }
              .footer { margin-top: 40px; display: flex; justify-content: space-between; }
              .signature { text-align: center; padding-top: 40px; border-top: 1px solid #333; width: 150px; }
              @media print {
                body { padding: 0; }
                .receipt-container { border: 2px solid #000; }
              }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header">
                <h1>RECEIPT VOUCHER</h1>
                <h2>Money Received</h2>
              </div>

              <div class="info-row bordered">
                <span class="label">Bill No:</span>
                <span class="value">${voucher.voucherNumber || 'Auto-Generated'}</span>
              </div>

              <div class="info-row bordered">
                <span class="label">Date:</span>
                <span class="value">${dayjs(voucher.voucherDate).format('DD-MM-YYYY')}</span>
              </div>

              <div class="info-row bordered">
                <span class="label">Received From (Head of Account):</span>
                <span class="value">${voucher.entries?.find(e => e.creditAmount > 0)?.ledgerName || '-'}</span>
              </div>

              <div class="amount-section">
                <div class="label">Amount Received</div>
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
      }
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
    const cashLedger = ledgers.find(l => l.ledgerType === 'Cash');
    if (!cashLedger) {
      message.error('Cash ledger not found. Please create a Cash ledger first.');
      return;
    }

    // Validate all entries
    const validEntries = multipleEntries.filter(entry => {
      const amount = parseFloat(entry.amount) || 0;
      return entry.voucherDate && entry.ledgerId && amount > 0;
    });

    if (validEntries.length === 0) {
      message.error('Please fill at least one complete entry with ledger and amount');
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
          voucherType: 'Receipt',
          voucherDate: new Date(entry.voucherDate).toISOString(),
          entries: [
            {
              ledgerId: cashLedger._id,
              ledgerName: cashLedger.ledgerName,
              debitAmount: amount,
              creditAmount: 0,
              narration: entry.narration || ''
            },
            {
              ledgerId: entry.ledgerId,
              ledgerName: selectedLedger?.ledgerName || '',
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
      message.success(`${successCount} receipt voucher(s) created successfully`);
      setModalOpened(false);
      fetchVouchers();
    }
    if (errorCount > 0) {
      message.error(`${errorCount} voucher(s) failed to create`);
    }
  };

  const getMultipleTotals = () => {
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
    if (['Sales A/c', 'Trade Income', 'Miscellaneous Income'].includes(ledgerType)) return 'Income Accounts';
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
        title="Receipt Voucher"
        subtitle="Manage receipt vouchers for money received"
        rightSection={
          <Button
            leftSection={<IconPlus size={16} />}
            color="green"
            onClick={openAddModal}
          >
            Add Receipt Voucher
          </Button>
        }
      />

      {/* Vouchers List */}
      <Paper p="lg" withBorder shadow="sm">
        <LoadingOverlay visible={fetchingVouchers} overlayProps={{ blur: 2 }} />

        <Group position="apart" mb="md">
          <Title order={4}>
            <Group spacing="xs">
              <IconReceipt size={20} />
              Receipt Vouchers List
            </Group>
          </Title>
          <Group spacing="sm">
            <Badge size="lg" variant="filled" color="green">
              {vouchers.length} Vouchers
            </Badge>
            <Button
              leftSection={<IconPlus size={16} />}
              color="green"
              onClick={openAddModal}
            >
              Add Receipt Voucher
            </Button>
          </Group>
        </Group>

        {vouchers.length === 0 ? (
          <Card p="xl" withBorder bg="gray.0">
            <Stack align="center" spacing="md">
              <IconReceipt size={48} color="gray" />
              <Text color="dimmed" size="lg">No receipt vouchers found</Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={openAddModal}
              >
                Create First Receipt Voucher
              </Button>
            </Stack>
          </Card>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withBorder>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Head of Account</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Narration</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher, index) => {
                  const creditEntry = voucher.entries?.find(e => e.creditAmount > 0);

                  return (
                    <tr key={voucher._id}>
                      <td>{index + 1}</td>
                      <td>
                        <Badge variant="outline" color="green">
                          {voucher.voucherNumber || 'Auto'}
                        </Badge>
                      </td>
                      <td>{dayjs(voucher.voucherDate).format('DD-MM-YYYY')}</td>
                      <td>{creditEntry?.ledgerName || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Text weight={600} color="green">
                          ₹{(voucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                          <Tooltip label="Print">
                            <ActionIcon
                              color="green"
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
          <Card mt="md" p="md" withBorder bg="green.0">
            <Group position="apart">
              <Text weight={500}>Total Receipts</Text>
              <Text size="xl" weight={700} color="green">
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
          <Group spacing="xs">
            <IconReceipt size={20} />
            <Text weight={600}>Add Receipt Voucher</Text>
          </Group>
        }
        size={entryMode === 'multiple' ? 'xl' : 'md'}
        centered
      >
        <LoadingOverlay visible={loading || savingMultiple} overlayProps={{ blur: 2 }} />

        <Stack spacing="md">
          {/* Entry Mode Selector */}
          <SegmentedControl
            value={entryMode}
            onChange={setEntryMode}
            fullWidth
            color="green"
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
                  <Group spacing="xs">
                    <IconReceipt size={16} />
                    <Text size="sm" color="dimmed">
                      Bill No will be auto-generated upon saving
                    </Text>
                  </Group>
                </Card>

                {/* Amount Preview */}
                {form.values.amount && (
                  <Card p="sm" withBorder bg="green.0">
                    <Group position="apart">
                      <Text size="sm" color="dimmed">Amount to be recorded:</Text>
                      <Text weight={700} color="green" size="lg">
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
                    color="green"
                  >
                    Save Receipt Voucher
                  </Button>
                </Group>
              </Stack>
            </form>
          ) : (
            /* Multiple Entries Form */
            <Stack spacing="md">
              <Alert color="green" variant="light" py="xs">
                <Text size="xs">
                  Add multiple receipt vouchers at once. Cash account will be debited automatically for each entry.
                </Text>
              </Alert>

              <Group position="right">
                <Button
                  leftSection={<IconPlus size={16} />}
                  variant="light"
                  color="green"
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
                      <th style={{ width: '120px' }}>Date</th>
                      <th>Head of Account</th>
                      <th style={{ width: '120px' }}>Amount</th>
                      <th style={{ width: '150px' }}>Narration</th>
                      <th style={{ width: '50px' }}>✓</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {multipleEntries.map((entry, index) => {
                      const amount = parseFloat(entry.amount) || 0;
                      const isValid = entry.voucherDate && entry.ledgerId && amount > 0;

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
                          </td>
                          <td>
                            <NumberInput
                              size="xs"
                              placeholder="Amount"
                              min={0}
                              decimalScale={2}
                              value={entry.amount}
                              onChange={(value) => updateMultipleEntry(index, 'amount', value)}
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
                            {isValid ? (
                              <Badge color="green" size="xs">✓</Badge>
                            ) : (entry.ledgerId || amount > 0) ? (
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
              <Card p="sm" withBorder bg="green.0">
                <Group position="apart">
                  <Group spacing="lg">
                    <div>
                      <Text size="xs" color="dimmed">Total Amount</Text>
                      <Text weight={700} color="green" size="lg">
                        ₹{getMultipleTotals().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </div>
                  </Group>
                  <Text weight={500}>({multipleEntries.filter(e => e.ledgerId && parseFloat(e.amount) > 0).length} valid entries)</Text>
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
                  color="green"
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
            <Text weight={600}>Receipt Voucher Details</Text>
          </Group>
        }
        size="md"
        centered
      >
        {selectedVoucher && (
          <Stack spacing="md">
            <Grid>
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Bill No</Text>
                <Badge size="lg" color="green">{selectedVoucher.voucherNumber || 'Auto'}</Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Voucher Date</Text>
                <Text weight={500}>{dayjs(selectedVoucher.voucherDate).format('DD-MM-YYYY')}</Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Text size="sm" color="dimmed">Head of Account</Text>
                <Text weight={500}>{selectedVoucher.entries?.find(e => e.creditAmount > 0)?.ledgerName || '-'}</Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Card p="md" withBorder bg="green.0">
                  <Text size="sm" color="dimmed" mb="xs">Amount Received</Text>
                  <Text size="xl" weight={700} color="green">
                    ₹{(selectedVoucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Card>
              </Grid.Col>
            </Grid>

            <Card p="sm" withBorder bg="gray.0">
              <Text size="sm" color="dimmed">Narration</Text>
              <Text>{selectedVoucher.narration || '-'}</Text>
            </Card>

            <Divider />

            <Group position="right" spacing="md">
              <Button
                variant="light"
                color="green"
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
      <div id="print-receipt" style={{ display: 'none' }} ref={printRef}></div>
    </Container>
  );
};

export default ReceiptVoucher;
