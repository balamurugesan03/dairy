import { useState, useEffect, useRef, useMemo } from 'react';
import { message } from '../../utils/toast';
import { localDateStr } from '../../utils/dateUtils';
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
  Alert,
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
  IconEdit,
  IconReceipt,
  IconPrinter
} from '@tabler/icons-react';
import { useCompany } from '../../context/CompanyContext';
import { printVouchers } from '../../utils/voucherPrint';
import VoucherPrintPreview from './VoucherPrintPreview';

const PRINT_PREF_KEY = 'receiptVoucher.printOnSave';

// Focus after the current event finishes (Select closes its dropdown first).
const focusNext = (ref) => setTimeout(() => ref?.current?.focus(), 0);

const ReceiptVoucher = () => {
  const [loading, setLoading] = useState(false);
  const [fetchingVouchers, setFetchingVouchers] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD'));
  const formSectionRef = useRef(null);
  const [entryMode, setEntryMode] = useState('single');
  const [multipleEntries, setMultipleEntries] = useState([
    { voucherDate: dayjs().format('YYYY-MM-DD'), ledgerId: '', amount: '', narration: '' }
  ]);
  const [savingMultiple, setSavingMultiple] = useState(false);
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const [printOnSave, setPrintOnSave] = useState(() => {
    try { return localStorage.getItem(PRINT_PREF_KEY) === '1'; } catch { return false; }
  });
  const [previewVouchers, setPreviewVouchers] = useState(null);

  // Keyboard flow: Head of Account → Amount → Narration → Save.
  const ledgerRef = useRef(null);
  const amountRef = useRef(null);
  const narrationRef = useRef(null);
  const saveRef = useRef(null);
  const saveAllRef = useRef(null);
  const rowRefs = useRef({}); // multiple entries: `${index}-${field}` → input

  const togglePrintOnSave = (checked) => {
    setPrintOnSave(checked);
    try { localStorage.setItem(PRINT_PREF_KEY, checked ? '1' : '0'); } catch { /* ignore */ }
  };

  const focusRow = (index, field) =>
    setTimeout(() => rowRefs.current[`${index}-${field}`]?.focus(), 0);

  // Enter moves to the next field instead of submitting / adding a newline
  // (Shift+Enter still adds a newline in Narration).
  const onEnter = (next) => (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      next();
    }
  };

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
  }, []);

  // The grid follows the voucher date in the entry form (no separate
  // Transaction Date picker on the grid).
  useEffect(() => {
    const d = form.values.voucherDate;
    if (d && dayjs(d).isValid()) setFilterDate(dayjs(d).format('YYYY-MM-DD'));
  }, [form.values.voucherDate]);

  // Switching between Single / Multiple puts the cursor on Head of Account.
  useEffect(() => {
    if (entryMode === 'single') focusNext(ledgerRef);
    else focusRow(0, 'ledger');
  }, [entryMode]);

  // Re-fetch whenever the selected date changes — the grid always shows
  // only that date's transactions, never the full history.
  useEffect(() => {
    fetchVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate]);

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
      const response = await voucherAPI.getAll({
        voucherType: 'Receipt',
        startDate: filterDate,
        endDate: filterDate
      });
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
      const amount = parseFloat(values.amount);

      let cashLedger = ledgers.find(l => l.ledgerType === 'Cash');
      if (!cashLedger) {
        // Auto-create Cash ledger if missing.
        // voucherType: 'B' — matches the "Cash in Hand" Account Group's
        // def_voucher_type (B = Both), so Cash is never mistaken for a
        // Payment-only or Receipt-only ledger in the R/P reports.
        const res = await ledgerAPI.create({
          ledgerName: 'Cash in Hand',
          ledgerType: 'Cash',
          openingBalance: 0,
          openingBalanceType: 'Dr',
          voucherType: 'B'
        });
        cashLedger = res?.data;
        if (cashLedger) setLedgers(prev => [...prev, cashLedger]);
      }

      if (!cashLedger) {
        message.error('Could not create Cash ledger. Please try again.');
        setLoading(false);
        return;
      }

      const payload = {
        voucherType: 'Receipt',
        voucherDate: localDateStr(new Date(values.voucherDate)),
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

      let res;
      if (editingVoucherId) {
        res = await voucherAPI.update(editingVoucherId, payload);
        message.success('Receipt voucher updated successfully');
      } else {
        res = await voucherAPI.create(payload);
        message.success('Receipt voucher created successfully');
      }
      if (printOnSave) printVouchers([res?.data || payload], 'Receipt', companyName);
      // Form stays on the page — clear it for the next entry, keep the same
      // date, and make sure the grid below is showing that date.
      const savedDate = dayjs(values.voucherDate).format('YYYY-MM-DD');
      resetEntryForm(savedDate);
      if (savedDate !== filterDate) setFilterDate(savedDate);
      else fetchVouchers();
    } catch (error) {
      message.error(error.message || `Failed to ${editingVoucherId ? 'update' : 'create'} receipt voucher`);
    } finally {
      setLoading(false);
      focusNext(ledgerRef);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this voucher?')) return;
    try {
      await voucherAPI.delete(id);
      message.success('Voucher deleted successfully');
      if (id === editingVoucherId) resetEntryForm();
      fetchVouchers();
    } catch (error) {
      message.error(error.message || 'Failed to delete voucher');
    }
  };

  const handleView = (voucher) => {
    setSelectedVoucher(voucher);
    setViewModalOpened(true);
  };

  // Opens the A4 print preview; printing happens from the preview.
  const handlePrint = (voucher) => setPreviewVouchers([voucher]);

  // The entry form lives inline at the top of the page (no popup). Clearing
  // it also drops out of edit mode.
  const resetEntryForm = (date = dayjs().format('YYYY-MM-DD')) => {
    form.setValues({ voucherDate: date, ledgerId: '', amount: '', narration: '' });
    form.clearErrors();
    setEditingVoucherId(null);
  };

  // Edit — Manual entries only (enforced again server-side by updateVoucher).
  // Prefills the single-entry form from the voucher's credit leg (the "head
  // of account" the user originally picked — Cash is always the automatic
  // debit leg and isn't shown as an editable field here, same as Add).
  const startEdit = (voucher) => {
    const creditEntry = voucher.entries?.find(e => e.creditAmount > 0);
    form.setValues({
      voucherDate: dayjs(voucher.voucherDate).format('YYYY-MM-DD'),
      ledgerId: creditEntry?.ledgerId?._id || creditEntry?.ledgerId || '',
      amount: voucher.totalDebit || 0,
      narration: voucher.narration || ''
    });
    form.clearErrors();
    setEntryMode('single');
    setEditingVoucherId(voucher._id);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    let cashLedger = ledgers.find(l => l.ledgerType === 'Cash');
    if (!cashLedger) {
      // voucherType: 'B' — see handleSubmit's Cash auto-create for rationale.
      const res = await ledgerAPI.create({ ledgerName: 'Cash in Hand', ledgerType: 'Cash', openingBalance: 0, openingBalanceType: 'Dr', voucherType: 'B' });
      cashLedger = res?.data;
      if (cashLedger) setLedgers(prev => [...prev, cashLedger]);
    }
    if (!cashLedger) { message.error('Could not create Cash ledger. Please try again.'); return; }

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
    const saved = [];

    for (const entry of validEntries) {
      try {
        const selectedLedger = ledgers.find(l => l._id === entry.ledgerId);
        const amount = parseFloat(entry.amount);

        const payload = {
          voucherType: 'Receipt',
          voucherDate: localDateStr(new Date(entry.voucherDate)),
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

        const res = await voucherAPI.create(payload);
        saved.push(res?.data || payload);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setSavingMultiple(false);

    if (successCount > 0) {
      message.success(`${successCount} receipt voucher(s) created successfully`);
      if (printOnSave) printVouchers(saved, 'Receipt', companyName);
      setMultipleEntries([
        { voucherDate: dayjs().format('YYYY-MM-DD'), ledgerId: '', amount: '', narration: '' }
      ]);
      fetchVouchers();
    }
    if (errorCount > 0) {
      message.error(`${errorCount} voucher(s) failed to create`);
    }
    focusRow(0, 'ledger');
  };

  const getMultipleTotals = () => {
    return multipleEntries.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
  };

  function getLedgerGroup(ledgerType) {
    if (['Cash', 'Bank'].includes(ledgerType)) return 'Cash/Bank Accounts';
    if (ledgerType === 'Party') return 'Parties';
    if (['Sales A/c', 'Trade Income', 'Miscellaneous Income'].includes(ledgerType)) return 'Income Accounts';
    if (['Accounts Due From (Sundry Debtors)'].includes(ledgerType)) return 'Receivable Accounts';
    if (['Other Receivable', 'Other Assets'].includes(ledgerType)) return 'Asset Accounts';
    return 'Other Accounts';
  }

  const selectData = useMemo(() => {
    const groups = {};
    ledgers
      // def_voucher_type enforcement: a ledger whose Account Group marks it
      // 'P' (Payment Side Only) must never be selectable as the head of
      // account in a Receipt Voucher — only 'R' (Receipt Side Only) and 'B'
      // (Both) ledgers qualify. Ledgers with no voucherType recorded yet
      // (legacy data) are left visible rather than hidden. See ReceiptVoucher
      // fix notes: backend enforces the same rule in createVoucher.
      .filter(ledger => ledger.voucherType !== 'P')
      .forEach(ledger => {
        const group = getLedgerGroup(ledger.ledgerType);
        if (!groups[group]) groups[group] = [];
        groups[group].push({ value: ledger._id, label: `${ledger.ledgerName} (${ledger.ledgerType})` });
      });
    return Object.entries(groups).map(([group, items]) => ({ group, items }));
  }, [ledgers]);

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Receipt Voucher"
        subtitle="Manage receipt vouchers for money received"
      />

      {/* Add / Edit Form — inline on the page, the grid below shows saved vouchers */}
      <Paper ref={formSectionRef} p="lg" mb="md" withBorder shadow="sm" pos="relative">
        <LoadingOverlay visible={loading || savingMultiple} overlayProps={{ blur: 2 }} />

        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Title order={4}>
              <Group gap="xs">
                <IconReceipt size={20} />
                {editingVoucherId ? 'Edit Receipt Voucher' : 'Add Receipt Voucher'}
                {editingVoucherId && <Badge color="orange" variant="light">Editing</Badge>}
              </Group>
            </Title>
            <Group gap="md">
              {/* Entry Mode Selector — hidden while editing, an edit always targets one existing voucher */}
              {!editingVoucherId && (
                <SegmentedControl
                  value={entryMode}
                  onChange={setEntryMode}
                  color="green"
                  data={[
                    { label: 'Single Entry', value: 'single' },
                    { label: 'Multiple Entries', value: 'multiple' }
                  ]}
                />
              )}
              <Checkbox
                label="Voucher Print"
                color="green"
                checked={printOnSave}
                onChange={(e) => togglePrintOnSave(e.currentTarget.checked)}
                tabIndex={-1}
              />
            </Group>
          </Group>

          {entryMode === 'single' ? (
            /* Single Entry Form */
            <form onSubmit={form.onSubmit(handleSubmit)}>
              <Stack gap="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <TextInput
                      label="Voucher Date"
                      placeholder="Select date"
                      required
                      type="date"
                      leftSection={<IconCalendar size={16} />}
                      {...form.getInputProps('voucherDate')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <Select
                      ref={ledgerRef}
                      label="Head of Account (Ledger)"
                      placeholder="Select ledger"
                      required
                      searchable
                      data={selectData}
                      {...form.getInputProps('ledgerId')}
                      onChange={(value) => {
                        form.setFieldValue('ledgerId', value);
                        if (value) focusNext(amountRef);
                      }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                    <NumberInput
                      ref={amountRef}
                      label="Amount"
                      placeholder="Enter amount"
                      required
                      leftSection={<IconCurrencyRupee size={16} />}
                      min={0.01}
                      decimalScale={2}
                      hideControls
                      {...form.getInputProps('amount')}
                      onKeyDown={onEnter(() => narrationRef.current?.focus())}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <Textarea
                      ref={narrationRef}
                      label="Narration"
                      placeholder="Enter narration/description"
                      required
                      leftSection={<IconNotes size={16} />}
                      autosize
                      minRows={1}
                      {...form.getInputProps('narration')}
                      onKeyDown={onEnter(() => saveRef.current?.focus())}
                    />
                  </Grid.Col>
                </Grid>

                <Group justify="space-between" gap="md">
                  <Text size="sm" c="dimmed">
                    Bill No will be auto-generated upon saving · Cash account is debited automatically
                  </Text>
                  <Group gap="md">
                  <Button
                    variant="default"
                    leftSection={<IconX size={16} />}
                    onClick={() => resetEntryForm()}
                    disabled={loading}
                  >
                    {editingVoucherId ? 'Cancel Edit' : 'Clear'}
                  </Button>
                  <Button
                    ref={saveRef}
                    type="submit"
                    leftSection={<IconCheck size={16} />}
                    loading={loading}
                    color="green"
                  >
                    {editingVoucherId ? 'Update Receipt Voucher' : 'Save Receipt Voucher'}
                  </Button>
                  </Group>
                </Group>
              </Stack>
            </form>
          ) : (
            /* Multiple Entries Form */
            <Stack gap="md">
              <Alert color="green" variant="light" py="xs">
                <Text size="xs">
                  Add multiple receipt vouchers at once. Cash account will be debited automatically for each entry.
                </Text>
              </Alert>

              <Group justify="flex-end">
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
                      <th style={{ width: '280px' }}>Head of Account</th>
                      <th style={{ width: '120px' }}>Amount</th>
                      <th>Narration</th>
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
                              ref={(el) => { rowRefs.current[`${index}-ledger`] = el; }}
                              placeholder="Select ledger"
                              searchable
                              size="xs"
                              data={selectData}
                              value={entry.ledgerId}
                              onChange={(value) => {
                                updateMultipleEntry(index, 'ledgerId', value);
                                if (value) focusRow(index, 'amount');
                              }}
                            />
                          </td>
                          <td>
                            <NumberInput
                              ref={(el) => { rowRefs.current[`${index}-amount`] = el; }}
                              size="xs"
                              placeholder="Amount"
                              min={0}
                              decimalScale={2}
                              value={entry.amount}
                              onChange={(value) => updateMultipleEntry(index, 'amount', value)}
                              onKeyDown={onEnter(() => focusRow(index, 'narration'))}
                              styles={{ input: { color: 'green', fontWeight: 600 } }}
                            />
                          </td>
                          <td>
                            <TextInput
                              ref={(el) => { rowRefs.current[`${index}-narration`] = el; }}
                              size="xs"
                              placeholder="Narration"
                              value={entry.narration}
                              onChange={(e) => updateMultipleEntry(index, 'narration', e.target.value)}
                              onKeyDown={onEnter(() => saveAllRef.current?.focus())}
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
                <Group justify="space-between">
                  <Group gap="lg">
                    <div>
                      <Text size="xs" c="dimmed">Total Amount</Text>
                      <Text fw={700} c="green" size="lg">
                        {getMultipleTotals().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                  onClick={() => setMultipleEntries([
                    { voucherDate: dayjs().format('YYYY-MM-DD'), ledgerId: '', amount: '', narration: '' }
                  ])}
                  disabled={savingMultiple}
                >
                  Clear
                </Button>
                <Button
                  ref={saveAllRef}
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
      </Paper>

      {/* Vouchers List */}
      <Paper p="lg" withBorder shadow="sm" pos="relative">
        <LoadingOverlay visible={fetchingVouchers} overlayProps={{ blur: 2 }} />

        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <Title order={4}>
              <Group gap="xs">
                <IconReceipt size={20} />
                Receipt Vouchers List — {dayjs(filterDate).format('DD-MM-YYYY')}
              </Group>
            </Title>
          </Group>
          <Badge size="lg" variant="filled" color="green">
            {vouchers.length} Vouchers
          </Badge>
        </Group>

        {vouchers.length === 0 ? (
          <Card p="xl" withBorder bg="gray.0">
            <Stack align="center" gap="md">
              <IconReceipt size={48} color="gray" />
              <Text c="dimmed" size="lg">No receipt vouchers on {dayjs(filterDate).format('DD-MM-YYYY')}</Text>
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
                  <th style={{ textAlign: 'center' }}>Source</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher, index) => {
                  const creditEntry = voucher.entries?.find(e => e.creditAmount > 0);
                  const isManual = voucher.referenceType === 'Manual';

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
                        <Text fw={600} c="green">
                          {(voucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </td>
                      <td>
                        <Text size="sm" lineClamp={1}>
                          {voucher.narration || '-'}
                        </Text>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge size="sm" variant="light" color={isManual ? 'grape' : 'gray'}>
                          {isManual ? 'Manual' : (voucher.referenceType || 'Auto')}
                        </Badge>
                      </td>
                      <td>
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
                              color="green"
                              variant="light"
                              onClick={() => handlePrint(voucher)}
                            >
                              <IconPrinter size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {isManual ? (
                            <>
                              <Tooltip label="Edit">
                                <ActionIcon
                                  color="orange"
                                  variant="light"
                                  onClick={() => startEdit(voucher)}
                                >
                                  <IconEdit size={16} />
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
                            </>
                          ) : (
                            <Tooltip label="Auto-generated — edit/delete from its originating module">
                              <Text size="xs" c="dimmed" fs="italic">View only</Text>
                            </Tooltip>
                          )}
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
            <Group justify="space-between">
              <Text fw={500}>Total Receipts</Text>
              <Text size="xl" fw={700} c="green">
                {vouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Group>
          </Card>
        )}
      </Paper>

      {/* View Details Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title={
          <Group gap="xs">
            <IconEye size={20} />
            <Text fw={600}>Receipt Voucher Details</Text>
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
                <Badge size="lg" color="green">{selectedVoucher.voucherNumber || 'Auto'}</Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Voucher Date</Text>
                <Text fw={500}>{dayjs(selectedVoucher.voucherDate).format('DD-MM-YYYY')}</Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Text size="sm" c="dimmed">Head of Account</Text>
                <Text fw={500}>{selectedVoucher.entries?.find(e => e.creditAmount > 0)?.ledgerName || '-'}</Text>
              </Grid.Col>
              <Grid.Col span={12}>
                <Card p="md" withBorder bg="green.0">
                  <Text size="sm" c="dimmed" mb="xs">Amount Received</Text>
                  <Text size="xl" fw={700} c="green">
                    {(selectedVoucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

      <VoucherPrintPreview
        opened={!!previewVouchers}
        onClose={() => setPreviewVouchers(null)}
        vouchers={previewVouchers}
        kind="Receipt"
        orgName={companyName}
      />
    </Container>
  );
};

export default ReceiptVoucher;
