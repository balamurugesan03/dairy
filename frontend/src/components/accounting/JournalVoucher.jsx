import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { ledgerAPI, voucherAPI } from '../../services/api';
import {
  Box,
  Button,
  Paper,
  Grid,
  Text,
  TextInput,
  Select,
  NumberInput,
  Group,
  Stack,
  Container,
  Title,
  Divider,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  ScrollArea,
  Checkbox,
  Modal,
  LoadingOverlay,
  Card,
  Flex
} from '@mantine/core';
import {
  IconCalendar,
  IconCurrencyRupee,
  IconCheck,
  IconPlus,
  IconEye,
  IconTrash,
  IconArrowsExchange,
  IconMilk,
  IconDeviceFloppy,
  IconRotate,
  IconReceipt,
  IconCreditCard,
  IconHash,
  IconFileText,
  IconX
} from '@tabler/icons-react';

// ─ Module-level styles (prevent remount on every parent re-render) ──────────
const sectionBorder = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: '6px',
  overflow: 'hidden'
};

const panelHeaderStyle = (color) => ({
  background: color === 'green'
    ? 'linear-gradient(135deg, #e6f9e8 0%, #f0fdf0 100%)'
    : 'linear-gradient(135deg, #fff3e0 0%, #fffde7 100%)',
  borderBottom: `2px solid ${color === 'green' ? '#4caf50' : '#ff9800'}`,
  padding: '10px 16px'
});

const totalBarStyle = (color) => ({
  background: color === 'green'
    ? 'linear-gradient(135deg, #c8e6c9 0%, #e8f5e9 100%)'
    : 'linear-gradient(135deg, #ffe0b2 0%, #fff8e1 100%)',
  borderTop: `2px solid ${color === 'green' ? '#4caf50' : '#ff9800'}`,
  padding: '10px 16px'
});

const compactInput  = { input: { fontSize: '13px', height: '32px', minHeight: '32px' } };
const compactSelect = { input: { fontSize: '13px', height: '32px', minHeight: '32px' } };
const compactNumber = { input: { fontSize: '13px', height: '32px', minHeight: '32px', textAlign: 'right', fontWeight: 600 } };

// ─ EntryPanel OUTSIDE component — prevents unmount/remount on every keystroke ─
const EntryPanel = ({ title, icon, color, entries, onAdd, onRemove, onUpdate, total, ledgerOptions }) => (
  <Box style={sectionBorder}>
    <Flex justify="space-between" align="center" style={panelHeaderStyle(color)}>
      <Group gap={8}>
        {icon}
        <Text fw={700} size="sm" tt="uppercase" c={color === 'green' ? 'green.8' : 'orange.8'}>
          {title}
        </Text>
      </Group>
      <Button
        size="compact-xs"
        variant="light"
        color={color === 'green' ? 'green' : 'orange'}
        leftSection={<IconPlus size={13} />}
        onClick={onAdd}
        styles={{ root: { fontSize: '12px', height: '26px' } }}
      >
        Add Row
      </Button>
    </Flex>

    <Box px={0}>
      <Table withRowBorders={false} style={{ tableLayout: 'fixed' }}>
        <Table.Thead>
          <Table.Tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
            <Table.Th style={{ width: '38%', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Head of Account
            </Table.Th>
            <Table.Th style={{ width: '22%', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>
              Amount
            </Table.Th>
            <Table.Th style={{ width: '32%', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Narration
            </Table.Th>
            <Table.Th style={{ width: '8%', padding: '6px 6px', textAlign: 'center' }}></Table.Th>
          </Table.Tr>
        </Table.Thead>
      </Table>
    </Box>

    <ScrollArea style={{ maxHeight: '260px' }} offsetScrollbars>
      <Box px={0}>
        <Table withRowBorders={false} style={{ tableLayout: 'fixed' }}>
          <Table.Tbody>
            {entries.map((entry, index) => (
              <Table.Tr key={index} style={{ borderBottom: '1px solid #f1f3f5' }}>
                <Table.Td style={{ width: '38%', padding: '4px 10px' }}>
                  <Select
                    placeholder="Select account"
                    data={ledgerOptions}
                    searchable
                    clearable
                    size="xs"
                    value={entry.ledgerId}
                    onChange={(val) => onUpdate(index, 'ledgerId', val)}
                    styles={compactSelect}
                    nothingFoundMessage="No accounts found"
                  />
                </Table.Td>
                <Table.Td style={{ width: '22%', padding: '4px 6px' }}>
                  <NumberInput
                    placeholder="0.00"
                    min={0}
                    decimalScale={2}
                    size="xs"
                    hideControls
                    value={entry.amount}
                    onChange={(val) => onUpdate(index, 'amount', val)}
                    styles={compactNumber}
                    leftSection={<IconCurrencyRupee size={13} color="#868e96" />}
                    leftSectionWidth={24}
                  />
                </Table.Td>
                <Table.Td style={{ width: '32%', padding: '4px 6px' }}>
                  <TextInput
                    placeholder="Narration"
                    size="xs"
                    value={entry.narration}
                    onChange={(e) => onUpdate(index, 'narration', e.target.value)}
                    styles={compactInput}
                  />
                </Table.Td>
                <Table.Td style={{ width: '8%', padding: '4px 4px', textAlign: 'center' }}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => onRemove(index)}
                    disabled={entries.length <= 1}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </ScrollArea>

    <Flex justify="space-between" align="center" style={totalBarStyle(color)}>
      <Text fw={700} size="sm" c={color === 'green' ? 'green.9' : 'orange.9'}>
        TOTAL
      </Text>
      <Text fw={800} size="md" c={color === 'green' ? 'green.9' : 'orange.9'} ff="monospace">
        {'\u20B9'} {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
    </Flex>
  </Box>
);

const JournalVoucher = () => {
  const [loading, setLoading] = useState(false);
  const [fetchingVouchers, setFetchingVouchers] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [isMilkBill, setIsMilkBill] = useState(false);
  const [voucherDate, setVoucherDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  // Receipt (Debit) entries
  const [receiptEntries, setReceiptEntries] = useState([
    { ledgerId: '', amount: '', narration: '' }
  ]);

  // Payment (Credit) entries
  const [paymentEntries, setPaymentEntries] = useState([
    { ledgerId: '', amount: '', narration: '' }
  ]);

  useEffect(() => {
    fetchLedgers();
    fetchVouchers();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll();
      setLedgers(response.data || []);
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

  // Milk Bill handler
  const handleMilkBillChange = (event) => {
    const checked = event.currentTarget.checked;
    setIsMilkBill(checked);
  };

  // Ledger options with grouping
  const getLedgerGroup = (ledgerType) => {
    if (['Cash', 'Bank'].includes(ledgerType)) return 'Cash/Bank';
    if (['Party', 'Accounts Due From (Sundry Debtors)', 'Accounts Due To (Sundry Creditors)'].includes(ledgerType)) return 'Party';
    if (['Sales A/c', 'Trade Income', 'Miscellaneous Income'].includes(ledgerType)) return 'Income';
    if (['Purchase A/c', 'Trade Expense', 'Miscellaneous Expense'].includes(ledgerType)) return 'Expense';
    if (['Asset', 'Other Assets', 'Other Receivable'].includes(ledgerType)) return 'Assets';
    if (['Liability', 'Other Liabilities', 'Other Payable'].includes(ledgerType)) return 'Liabilities';
    if (['Capital'].includes(ledgerType)) return 'Capital';
    return 'Other';
  };

  const ledgerOptions = useMemo(() => {
    const groups = {};
    ledgers.forEach(l => {
      const group = getLedgerGroup(l.ledgerType);
      if (!groups[group]) groups[group] = [];
      groups[group].push({ value: l._id, label: `${l.ledgerName} (${l.ledgerType})` });
    });
    return Object.entries(groups).map(([group, items]) => ({ group, items }));
  }, [ledgers]);

  // Receipt (Debit) handlers
  const addReceiptRow = () => {
    setReceiptEntries([...receiptEntries, { ledgerId: '', amount: '', narration: '' }]);
  };

  const removeReceiptRow = (index) => {
    if (receiptEntries.length > 1) {
      setReceiptEntries(receiptEntries.filter((_, i) => i !== index));
    }
  };

  const updateReceiptEntry = (index, field, value) => {
    const updated = [...receiptEntries];
    updated[index] = { ...updated[index], [field]: value };
    setReceiptEntries(updated);
  };

  // Payment (Credit) handlers
  const addPaymentRow = () => {
    setPaymentEntries([...paymentEntries, { ledgerId: '', amount: '', narration: '' }]);
  };

  const removePaymentRow = (index) => {
    if (paymentEntries.length > 1) {
      setPaymentEntries(paymentEntries.filter((_, i) => i !== index));
    }
  };

  const updatePaymentEntry = (index, field, value) => {
    const updated = [...paymentEntries];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentEntries(updated);
  };

  // Calculate totals
  const receiptTotal = receiptEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const paymentTotal = paymentEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const difference = Math.abs(receiptTotal - paymentTotal);
  const isBalanced = receiptTotal > 0 && paymentTotal > 0 && difference < 0.01;

  // Next voucher number
  const nextVoucherNo = vouchers.length > 0
    ? `JV-${String(vouchers.length + 1).padStart(4, '0')}`
    : 'JV-0001';

  // Reset form
  const handleReset = () => {
    setReceiptEntries([{ ledgerId: '', amount: '', narration: '' }]);
    setPaymentEntries([{ ledgerId: '', amount: '', narration: '' }]);
    setVoucherDate(dayjs().format('YYYY-MM-DD'));
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!voucherDate) {
      message.error('Please select a voucher date');
      return;
    }

    const validReceipts = receiptEntries.filter(e => e.ledgerId && parseFloat(e.amount) > 0);
    const validPayments = paymentEntries.filter(e => e.ledgerId && parseFloat(e.amount) > 0);

    if (validReceipts.length === 0) {
      message.error('Please add at least one receipt entry');
      return;
    }
    if (validPayments.length === 0) {
      message.error('Please add at least one payment entry');
      return;
    }

    const totalDebit = validReceipts.reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalCredit = validPayments.reduce((s, e) => s + parseFloat(e.amount), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      message.error('Receipt and Payment totals must be equal');
      return;
    }

    setLoading(true);
    try {
      const entries = [
        ...validReceipts.map(e => {
          const ledger = ledgers.find(l => l._id === e.ledgerId);
          return {
            ledgerId: e.ledgerId,
            ledgerName: ledger?.ledgerName || '',
            debitAmount: parseFloat(e.amount),
            creditAmount: 0,
            narration: e.narration || ''
          };
        }),
        ...validPayments.map(e => {
          const ledger = ledgers.find(l => l._id === e.ledgerId);
          return {
            ledgerId: e.ledgerId,
            ledgerName: ledger?.ledgerName || '',
            debitAmount: 0,
            creditAmount: parseFloat(e.amount),
            narration: e.narration || ''
          };
        })
      ];

      const payload = {
        voucherType: 'Journal',
        voucherDate: new Date(voucherDate).toISOString(),
        entries,
        totalDebit,
        totalCredit,
        referenceType: 'Manual',
        narration: entries.map(e => e.narration).filter(Boolean).join('; ') || 'Journal Entry'
      };

      await voucherAPI.create(payload);
      message.success('Journal voucher saved successfully');
      handleReset();
      fetchVouchers();
    } catch (error) {
      message.error(error.message || 'Failed to save journal voucher');
    } finally {
      setLoading(false);
    }
  };

  // Delete handler
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

  // View handler
  const handleView = (voucher) => {
    setSelectedVoucher(voucher);
    setViewModalOpened(true);
  };

  return (
    <Container size="xl" py="sm" px="md">
      <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

      {/* =============== HEADER AREA =============== */}
      <Paper
        withBorder
        p="sm"
        mb="sm"
        radius="sm"
        style={{ borderColor: '#dee2e6', background: 'linear-gradient(to right, #fafbfc, #ffffff)' }}
      >
        <Flex justify="space-between" align="center" wrap="wrap" gap="sm">
          {/* Left: Date Picker */}
          <Group gap="sm">
            <TextInput
              type="date"
              value={voucherDate}
              onChange={(e) => setVoucherDate(e.target.value)}
              size="xs"
              leftSection={<IconCalendar size={14} />}
              styles={{
                input: { fontWeight: 600, fontSize: '13px', width: '150px' },
                root: { width: 'auto' }
              }}
            />
          </Group>

          {/* Center: Title */}
          <Group gap={8}>
            <IconArrowsExchange size={22} color="var(--mantine-color-blue-6)" />
            <Title order={4} c="dark.7" style={{ letterSpacing: '-0.3px' }}>
              Adjustment Entry / Journal Entry
            </Title>
          </Group>

          {/* Right: Milk Bill + Voucher No */}
          <Group gap="md">
            <Checkbox
              label={
                <Group gap={4}>
                  <IconMilk size={15} color="var(--mantine-color-cyan-6)" />
                  <Text size="xs" fw={500}>Milk Bill</Text>
                </Group>
              }
              checked={isMilkBill}
              onChange={handleMilkBillChange}
              color="cyan"
              size="xs"
              styles={{ input: { cursor: 'pointer' }, label: { cursor: 'pointer' } }}
            />
            <Divider orientation="vertical" />
            <Group gap={4}>
              <IconHash size={14} color="#868e96" />
              <Text size="xs" c="dimmed" fw={500}>Voucher No:</Text>
              <Badge variant="light" color="blue" size="sm" radius="sm">
                {nextVoucherNo}
              </Badge>
            </Group>
          </Group>
        </Flex>
      </Paper>

      {/* =============== MAIN ENTRY AREA - SPLIT PANELS =============== */}
      <Grid gutter="sm" mb="sm">
        {/* LEFT PANEL - RECEIPT (Debit) */}
        <Grid.Col span={6}>
          <EntryPanel
            title="Receipt (Dr)"
            icon={<IconReceipt size={16} color="#2e7d32" />}
            color="green"
            entries={receiptEntries}
            onAdd={addReceiptRow}
            onRemove={removeReceiptRow}
            onUpdate={updateReceiptEntry}
            total={receiptTotal}
            ledgerOptions={ledgerOptions}
          />
        </Grid.Col>

        {/* RIGHT PANEL - PAYMENT (Credit) */}
        <Grid.Col span={6}>
          <EntryPanel
            title="Payment (Cr)"
            icon={<IconCreditCard size={16} color="#e65100" />}
            color="orange"
            entries={paymentEntries}
            onAdd={addPaymentRow}
            onRemove={removePaymentRow}
            onUpdate={updatePaymentEntry}
            total={paymentTotal}
            ledgerOptions={ledgerOptions}
          />
        </Grid.Col>
      </Grid>

      {/* =============== BALANCE STATUS + ACTIONS =============== */}
      <Paper
        withBorder
        p="xs"
        mb="sm"
        radius="sm"
        style={{
          borderColor: isBalanced ? '#4caf50' : (receiptTotal > 0 || paymentTotal > 0) ? '#f44336' : '#dee2e6',
          background: isBalanced
            ? 'linear-gradient(to right, #e8f5e9, #f1f8f1)'
            : (receiptTotal > 0 || paymentTotal > 0)
              ? 'linear-gradient(to right, #ffebee, #fff5f5)'
              : '#fafbfc'
        }}
      >
        <Flex justify="space-between" align="center">
          <Group gap="lg">
            <Group gap={6}>
              <Text size="xs" c="dimmed" fw={500}>Receipt Total:</Text>
              <Text size="sm" fw={700} c="green.7" ff="monospace">
                {'\u20B9'} {receiptTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Group>
            <Text c="dimmed" size="lg">=</Text>
            <Group gap={6}>
              <Text size="xs" c="dimmed" fw={500}>Payment Total:</Text>
              <Text size="sm" fw={700} c="orange.7" ff="monospace">
                {'\u20B9'} {paymentTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Group>
            {(receiptTotal > 0 || paymentTotal > 0) && (
              <>
                <Divider orientation="vertical" />
                <Badge
                  color={isBalanced ? 'green' : 'red'}
                  variant="light"
                  size="md"
                  radius="sm"
                  leftSection={isBalanced ? <IconCheck size={12} /> : <IconX size={12} />}
                >
                  {isBalanced ? 'Balanced' : `Diff: \u20B9${difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                </Badge>
              </>
            )}
          </Group>

          <Group gap="sm">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconRotate size={14} />}
              onClick={handleReset}
            >
              Clear
            </Button>
            <Button
              size="xs"
              color="blue"
              leftSection={<IconDeviceFloppy size={14} />}
              onClick={handleSubmit}
              loading={loading}
              disabled={!isBalanced}
            >
              Save Voucher
            </Button>
          </Group>
        </Flex>
      </Paper>

      {/* =============== BOTTOM SECTION - TRANSACTION DETAILS =============== */}
      <Paper withBorder radius="sm" style={{ borderColor: '#dee2e6', overflow: 'hidden' }}>
        {/* Section Header */}
        <Box
          px="md"
          py={8}
          style={{
            background: 'linear-gradient(to right, #e3f2fd, #f5f9ff)',
            borderBottom: '2px solid #1976d2'
          }}
        >
          <Group gap={8}>
            <IconFileText size={16} color="#1976d2" />
            <Text fw={700} size="sm" c="blue.8" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
              Adjustment Entry Transaction Details
            </Text>
            <Badge variant="filled" color="blue" size="sm" radius="sm" ml="auto">
              {vouchers.length} Entries
            </Badge>
          </Group>
        </Box>

        <LoadingOverlay visible={fetchingVouchers} overlayProps={{ blur: 2 }} />

        {vouchers.length === 0 ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <IconArrowsExchange size={40} color="#adb5bd" style={{ marginBottom: '8px' }} />
            <Text c="dimmed" size="sm">No journal entries found. Create your first entry above.</Text>
          </Box>
        ) : (
          <ScrollArea style={{ maxHeight: '320px' }}>
            <Table striped highlightOnHover withColumnBorders style={{ fontSize: '13px' }}>
              <Table.Thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                <Table.Tr>
                  <Table.Th style={{ width: '40px', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
                    #
                  </Table.Th>
                  <Table.Th style={{ width: '100px', padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>
                    Date
                  </Table.Th>
                  <Table.Th style={{ width: '90px', padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>
                    Voucher No
                  </Table.Th>
                  <Table.Th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>
                    Debit Account
                  </Table.Th>
                  <Table.Th style={{ width: '120px', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textAlign: 'right' }}>
                    Debit Amt
                  </Table.Th>
                  <Table.Th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>
                    Credit Account
                  </Table.Th>
                  <Table.Th style={{ width: '120px', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textAlign: 'right' }}>
                    Credit Amt
                  </Table.Th>
                  <Table.Th style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>
                    Narration
                  </Table.Th>
                  <Table.Th style={{ width: '70px', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
                    Action
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vouchers.map((voucher, index) => {
                  const debitEntry = voucher.entries?.find(e => e.debitAmount > 0);
                  const creditEntry = voucher.entries?.find(e => e.creditAmount > 0);

                  return (
                    <Table.Tr key={voucher._id}>
                      <Table.Td style={{ textAlign: 'center', padding: '6px 10px', color: '#868e96', fontSize: '12px' }}>
                        {index + 1}
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 500 }}>
                        {dayjs(voucher.voucherDate).format('DD-MM-YYYY')}
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>
                        <Badge variant="outline" color="blue" size="xs" radius="sm">
                          {voucher.voucherNumber || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 10px', fontSize: '12px' }}>
                        {debitEntry?.ledgerName || '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', padding: '6px 10px' }}>
                        <Text size="xs" fw={600} c="red.7" ff="monospace">
                          {'\u20B9'} {(debitEntry?.debitAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 10px', fontSize: '12px' }}>
                        {creditEntry?.ledgerName || '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right', padding: '6px 10px' }}>
                        <Text size="xs" fw={600} c="green.7" ff="monospace">
                          {'\u20B9'} {(creditEntry?.creditAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>
                        <Text size="xs" lineClamp={1} c="dimmed">
                          {voucher.narration || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center', padding: '6px 6px' }}>
                        <Group gap={4} justify="center">
                          <Tooltip label="View" withArrow>
                            <ActionIcon size="sm" variant="subtle" color="blue" onClick={() => handleView(voucher)}>
                              <IconEye size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete" withArrow>
                            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(voucher._id)}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
              {/* Table Footer with Totals */}
              <Table.Tfoot>
                <Table.Tr style={{ background: '#e3f2fd', fontWeight: 700 }}>
                  <Table.Td colSpan={4} style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="xs" fw={700} c="dark.6">GRAND TOTAL</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="sm" fw={700} c="red.7" ff="monospace">
                      {'\u20B9'} {vouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ padding: '8px 10px' }}></Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="sm" fw={700} c="green.7" ff="monospace">
                      {'\u20B9'} {vouchers.reduce((sum, v) => sum + (v.totalCredit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                  <Table.Td colSpan={2} style={{ textAlign: 'center', padding: '8px 10px' }}>
                    <Text size="xs" c="dimmed">{vouchers.length} voucher(s)</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* =============== VIEW DETAILS MODAL =============== */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title={
          <Group gap="xs">
            <IconEye size={18} />
            <Text fw={600} size="sm">Voucher Details</Text>
          </Group>
        }
        size="md"
        centered
      >
        {selectedVoucher && (
          <Stack gap="md">
            <Grid gutter="sm">
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">Voucher Number</Text>
                <Text fw={500} size="sm">{selectedVoucher.voucherNumber || '-'}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">Voucher Date</Text>
                <Text fw={500} size="sm">{dayjs(selectedVoucher.voucherDate).format('DD-MM-YYYY')}</Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">Voucher Type</Text>
                <Badge color="blue" size="sm">{selectedVoucher.voucherType}</Badge>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" c="dimmed">Reference</Text>
                <Text fw={500} size="sm">{selectedVoucher.referenceType || '-'}</Text>
              </Grid.Col>
            </Grid>

            <Divider label="Entries" labelPosition="center" />

            <Table withColumnBorders withRowBorders style={{ fontSize: '13px' }}>
              <Table.Thead>
                <Table.Tr style={{ background: '#f8f9fa' }}>
                  <Table.Th style={{ fontSize: '11px' }}>Ledger</Table.Th>
                  <Table.Th style={{ textAlign: 'right', fontSize: '11px' }}>Debit</Table.Th>
                  <Table.Th style={{ textAlign: 'right', fontSize: '11px' }}>Credit</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedVoucher.entries?.map((entry, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td style={{ fontSize: '12px' }}>{entry.ledgerName}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {entry.debitAmount > 0 ? (
                        <Text c="red.7" fw={600} size="xs" ff="monospace">
                          {'\u20B9'} {entry.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      ) : '-'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {entry.creditAmount > 0 ? (
                        <Text c="green.7" fw={600} size="xs" ff="monospace">
                          {'\u20B9'} {entry.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      ) : '-'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr style={{ background: '#f0f4f8' }}>
                  <Table.Td><Text fw={700} size="xs">Total</Text></Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text c="red.7" fw={700} size="xs" ff="monospace">
                      {'\u20B9'} {(selectedVoucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text c="green.7" fw={700} size="xs" ff="monospace">
                      {'\u20B9'} {(selectedVoucher.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>

            <Card p="sm" withBorder bg="gray.0" radius="sm">
              <Text size="xs" c="dimmed" mb={2}>Narration</Text>
              <Text size="sm">{selectedVoucher.narration || '-'}</Text>
            </Card>

            <Group justify="flex-end">
              <Button size="xs" variant="default" onClick={() => setViewModalOpened(false)}>
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
