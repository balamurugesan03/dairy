import { useState, useEffect, useMemo } from 'react';
import { message } from '../../utils/toast';
import { localDateStr } from '../../utils/dateUtils';
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
  IconEdit,
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
import DateField from '../common/DateField';

// ─ Module-level styles (prevent remount on every parent re-render) ──────────
// Full column height + flex column: the Receipt and Payment panels always
// match heights, so both TOTAL bars sit on the same line whatever the row
// count on either side.
const sectionBorder = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: '6px',
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
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

// Every list row has this fixed height, and the shorter side is padded with
// blank rows to the longer side's count — so both TOTAL bars always sit on
// the same line, however many rows either side has.
const LIST_ROW_H = 34;

const EMPTY_ROW = { ledgerId: '', amount: '', narration: '' };

// ─ EntryPanel OUTSIDE component — prevents unmount/remount on every keystroke ─
// One input line (Head of Account, Amount, Narration) + Add Row; each added
// entry becomes its own list row: "Head (narration)" with its own amount.
const EntryPanel = ({
  title, icon, color, entries, draft, onDraftChange, onAdd, onRemove, onEditRow,
  total, ledgerOptions, ledgerName, rowCount
}) => {
  const tone = color === 'green' ? 'green' : 'orange';
  const blanks = Math.max(0, rowCount - entries.length);
  const addOnEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } };
  return (
    <Box style={sectionBorder}>
      <Flex justify="space-between" align="center" style={panelHeaderStyle(color)}>
        <Group gap={8}>
          {icon}
          <Text fw={700} size="sm" tt="uppercase" c={`${tone}.8`}>
            {title}
          </Text>
        </Group>
      </Flex>

      {/* Entry line */}
      <Flex gap={6} align="flex-end" px={10} py={8} style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
        <Select
          label="Head of Account"
          placeholder="Select account"
          data={ledgerOptions}
          searchable
          clearable
          size="xs"
          value={draft.ledgerId || null}
          onChange={(val) => onDraftChange('ledgerId', val)}
          styles={compactSelect}
          nothingFoundMessage="No accounts found"
          style={{ flex: '1 1 38%', minWidth: 0 }}
        />
        <NumberInput
          label="Amount"
          placeholder="0.00"
          min={0}
          decimalScale={2}
          size="xs"
          hideControls
          value={draft.amount}
          onChange={(val) => onDraftChange('amount', val)}
          onKeyDown={addOnEnter}
          styles={compactNumber}
          leftSection={<IconCurrencyRupee size={13} color="#868e96" />}
          leftSectionWidth={24}
          style={{ flex: '0 0 22%', minWidth: 0 }}
        />
        <TextInput
          label="Narration"
          placeholder="Narration"
          size="xs"
          value={draft.narration}
          onChange={(e) => onDraftChange('narration', e.target.value)}
          onKeyDown={addOnEnter}
          styles={compactInput}
          style={{ flex: '1 1 28%', minWidth: 0 }}
        />
        <Button
          size="xs"
          variant="light"
          color={tone}
          leftSection={<IconPlus size={13} />}
          onClick={onAdd}
          styles={{ root: { height: '32px', paddingInline: 8 } }}
        >
          Add Row
        </Button>
      </Flex>

      {/* flex: 1 takes up the spare height so the TOTAL bar stays at the bottom */}
      <ScrollArea.Autosize mah={LIST_ROW_H * 8} offsetScrollbars style={{ flex: 1 }}>
        <Table withRowBorders={false} style={{ tableLayout: 'fixed' }}>
          <Table.Tbody>
            {entries.map((entry, index) => {
              const name = ledgerName(entry.ledgerId);
              const narration = (entry.narration || '').trim();
              return (
                <Table.Tr key={index} style={{ height: LIST_ROW_H, borderBottom: '1px solid #f1f3f5' }}>
                  <Table.Td
                    title={narration ? `${name} (${narration})` : name}
                    style={{ padding: '0 10px', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {narration ? `${name} (${narration})` : name}
                  </Table.Td>
                  <Table.Td style={{ width: '28%', padding: '0 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>
                    {'₹'} {(parseFloat(entry.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Table.Td>
                  <Table.Td style={{ width: '64px', padding: '0 4px', textAlign: 'center' }}>
                    <Group gap={2} justify="center" wrap="nowrap">
                      <ActionIcon size="sm" variant="subtle" color="blue" onClick={() => onEditRow(index)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => onRemove(index)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {Array.from({ length: blanks }, (_, i) => (
              <Table.Tr key={`blank-${i}`} style={{ height: LIST_ROW_H }}>
                <Table.Td colSpan={3} />
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>

      <Flex justify="space-between" align="center" style={totalBarStyle(color)}>
        <Text fw={700} size="sm" c={`${tone}.9`}>
          TOTAL
        </Text>
        <Text fw={800} size="md" c={`${tone}.9`} ff="monospace">
          {'₹'} {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </Flex>
    </Box>
  );
};

const JournalVoucher = () => {
  const [loading, setLoading] = useState(false);
  const [fetchingVouchers, setFetchingVouchers] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [cashVouchers, setCashVouchers] = useState([]);
  const [isMilkBill, setIsMilkBill] = useState(false);
  const [voucherDate, setVoucherDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [editingVoucherId, setEditingVoucherId] = useState(null);

  // Receipt (Dr / Debit) entries — income / asset side. The *Draft is the
  // panel's entry line; Add Row moves it into the list.
  const [receiptEntries, setReceiptEntries] = useState([]);
  const [receiptDraft, setReceiptDraft] = useState(EMPTY_ROW);

  // Payment (Cr / Credit) entries — expense / liability side
  const [paymentEntries, setPaymentEntries] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState(EMPTY_ROW);

  useEffect(() => {
    fetchLedgers();
  }, []);

  // The transaction grid always reflects the currently selected date — the
  // same date field driving the entry form above it. Changing the date
  // refreshes the grid to that date's entries only.
  useEffect(() => {
    fetchVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherDate]);

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
      // Adjustment (Journal) entries drive the form; the same date's Cash
      // Receipt/Payment vouchers are listed alongside them (view only).
      const params = { startDate: voucherDate, endDate: voucherDate, limit: 1000 };
      const [journalRes, receiptRes, paymentRes] = await Promise.all([
        voucherAPI.getAll({ ...params, voucherType: 'Journal' }),
        voucherAPI.getAll({ ...params, voucherType: 'Receipt' }),
        voucherAPI.getAll({ ...params, voucherType: 'Payment' })
      ]);
      setVouchers(journalRes.data || []);
      setCashVouchers([...(receiptRes.data || []), ...(paymentRes.data || [])]
        .filter(v => v.status !== 'Cancelled'));
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
    ledgers
      // Journal Voucher is the non-cash adjustment instrument (accruals,
      // provisions, write-offs, inter-ledger transfers) — Cash/Bank ledgers
      // are excluded so it can never be used to simulate a Receipt or
      // Payment and bypass their def_voucher_type (R/P/B) checks. Use
      // Receipt, Payment, or Contra for anything that actually moves cash.
      // Backend enforces the same rule in createVoucher. Matches all four
      // Cash/Bank ledgerType spellings used across this codebase (legacy
      // 'Cash'/'Bank' from auto-created ledgers, formal 'Cash in Hand'/
      // 'Bank Accounts' from the seeded Account Groups).
      .filter(l => !['Cash', 'Bank', 'Cash in Hand', 'Bank Accounts'].includes(l.ledgerType))
      .forEach(l => {
        const group = getLedgerGroup(l.ledgerType);
        if (!groups[group]) groups[group] = [];
        groups[group].push({ value: l._id, label: `${l.ledgerName} (${l.ledgerType})` });
      });
    return Object.entries(groups).map(([group, items]) => ({ group, items }));
  }, [ledgers]);

  const ledgerName = (id) => ledgers.find(l => l._id === id)?.ledgerName || '-';

  // Per-side list handlers: Add Row moves the entry line into the list,
  // Edit moves a list row back into the entry line.
  const sideHandlers = (entries, setEntries, draft, setDraft) => ({
    onDraftChange: (field, value) => setDraft(d => ({ ...d, [field]: value })),
    onAdd: () => {
      if (!draft.ledgerId) { message.error('Select a Head of Account'); return; }
      if (!(parseFloat(draft.amount) > 0)) { message.error('Enter an amount'); return; }
      setEntries([...entries, { ...draft, narration: (draft.narration || '').trim() }]);
      setDraft(EMPTY_ROW);
    },
    onRemove: (index) => setEntries(entries.filter((_, i) => i !== index)),
    onEditRow: (index) => {
      setDraft(entries[index]);
      setEntries(entries.filter((_, i) => i !== index));
    }
  });
  const receiptHandlers = sideHandlers(receiptEntries, setReceiptEntries, receiptDraft, setReceiptDraft);
  const paymentHandlers = sideHandlers(paymentEntries, setPaymentEntries, paymentDraft, setPaymentDraft);
  const listRowCount = Math.max(receiptEntries.length, paymentEntries.length, 1);

  // Calculate totals
  const receiptTotal = receiptEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const paymentTotal = paymentEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const difference = Math.abs(receiptTotal - paymentTotal);
  const isBalanced = receiptTotal > 0 && paymentTotal > 0 && difference < 0.01;

  // Next voucher number
  const nextVoucherNo = vouchers.length > 0
    ? `JV-${String(vouchers.length + 1).padStart(4, '0')}`
    : 'JV-0001';

  // Clear just the entry rows — used after a successful save so the grid's
  // date filter (shared with the entry form) isn't yanked back to today.
  const resetEntries = () => {
    setReceiptEntries([]);
    setPaymentEntries([]);
    setReceiptDraft(EMPTY_ROW);
    setPaymentDraft(EMPTY_ROW);
    setIsMilkBill(false);
  };

  // Reset form — the "Clear" button, an explicit user action, also resets
  // the date back to today.
  const handleReset = () => {
    resetEntries();
    setVoucherDate(dayjs().format('YYYY-MM-DD'));
    setEditingVoucherId(null);
  };

  // Edit — Manual entries only (enforced again server-side by
  // updateVoucher). Loads the voucher's Dr entries into the Receipt panel
  // and Cr entries into the Payment panel, same shape the form already uses.
  const startEdit = (voucher) => {
    const toRow = (e) => ({
      ledgerId: e.ledgerId?._id || e.ledgerId || '',
      amount: e.debitAmount > 0 ? e.debitAmount : e.creditAmount,
      narration: e.narration || ''
    });
    const debits = (voucher.entries || []).filter(e => e.debitAmount > 0).map(toRow);
    const credits = (voucher.entries || []).filter(e => e.creditAmount > 0).map(toRow);
    setReceiptEntries(debits);
    setPaymentEntries(credits);
    setReceiptDraft(EMPTY_ROW);
    setPaymentDraft(EMPTY_ROW);
    setIsMilkBill(!!voucher.isMilkBill);
    setVoucherDate(dayjs(voucher.voucherDate).format('YYYY-MM-DD'));
    setEditingVoucherId(voucher._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingVoucherId(null);
    resetEntries();
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
      message.error('Please add at least one Receipt (Dr) entry');
      return;
    }
    if (validPayments.length === 0) {
      message.error('Please add at least one Payment (Cr) entry');
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
        voucherDate: localDateStr(new Date(voucherDate)),
        entries,
        totalDebit,
        totalCredit,
        referenceType: 'Manual',
        isMilkBill,
        narration: entries.map(e => e.narration).filter(Boolean).join('; ') || 'Journal Entry'
      };

      if (editingVoucherId) {
        await voucherAPI.update(editingVoucherId, payload);
        message.success('Journal voucher updated successfully');
      } else {
        await voucherAPI.create(payload);
        message.success('Journal voucher saved successfully');
      }
      setEditingVoucherId(null);
      resetEntries();
      fetchVouchers();
    } catch (error) {
      message.error(error.message || `Failed to ${editingVoucherId ? 'update' : 'save'} journal voucher`);
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

  // Grid rows — the date's Adjustment entries first, then its Cash
  // Receipt / Payment vouchers.
  const gridRows = useMemo(() => [
    ...vouchers.map(voucher => ({ voucher, kind: 'adjustment' })),
    ...cashVouchers.map(voucher => ({ voucher, kind: voucher.voucherType === 'Receipt' ? 'receipt' : 'payment' }))
  ], [vouchers, cashVouchers]);

  // Each ledger on one side of a voucher as its own line — "Head (narration)"
  // with that head's own amount, never a comma-joined list. Cash vouchers
  // keep their narration on the voucher, so their head-of-account side
  // (Receipt → credits, Payment → debits) falls back to it.
  const voucherLegs = (voucher, side, kind) => {
    const fallback = (kind === 'receipt' && side === 'credit') || (kind === 'payment' && side === 'debit')
      ? (voucher.narration || '') : '';
    return (voucher.entries || [])
      .filter(e => (side === 'debit' ? e.debitAmount : e.creditAmount) > 0)
      .map(e => {
        const narration = (e.narration || fallback).trim();
        return {
          label: narration ? `${e.ledgerName} (${narration})` : e.ledgerName,
          amount: side === 'debit' ? e.debitAmount : e.creditAmount
        };
      });
  };

  const fmtAmt = (n) => `₹ ${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const cashTotals = useMemo(() => cashVouchers.reduce((acc, v) => {
    if (v.voucherType === 'Receipt') acc.receipts += v.totalDebit || 0;
    else acc.payments += v.totalCredit || 0;
    return acc;
  }, { receipts: 0, payments: 0 }), [cashVouchers]);

  return (
    // 1500px (wider than "xl" 1320px) gives the Receipt / Payment panels more room
    <Container size={1500} py="sm" px="md">
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
          {/* Left: Date Picker — also drives which date's entries the grid below shows */}
          <Group gap="sm">
            <DateField
              label="Transaction Date"
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
            {editingVoucherId && (
              <Badge color="orange" variant="filled" size="sm" radius="sm">Editing</Badge>
            )}
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
            icon={<IconReceipt size={16} color="#e65100" />}
            color="orange"
            entries={receiptEntries}
            draft={receiptDraft}
            {...receiptHandlers}
            total={receiptTotal}
            ledgerOptions={ledgerOptions}
            ledgerName={ledgerName}
            rowCount={listRowCount}
          />
        </Grid.Col>

        {/* RIGHT PANEL - PAYMENT (Credit) */}
        <Grid.Col span={6}>
          <EntryPanel
            title="Payment (Cr)"
            icon={<IconCreditCard size={16} color="#2e7d32" />}
            color="green"
            entries={paymentEntries}
            draft={paymentDraft}
            {...paymentHandlers}
            total={paymentTotal}
            ledgerOptions={ledgerOptions}
            ledgerName={ledgerName}
            rowCount={listRowCount}
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
            {editingVoucherId && (
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconX size={14} />}
                onClick={cancelEdit}
              >
                Cancel Edit
              </Button>
            )}
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
              {editingVoucherId ? 'Update Voucher' : 'Save Voucher'}
            </Button>
          </Group>
        </Flex>
      </Paper>

      {/* =============== BOTTOM SECTION - ADJUSTMENT + CASH TRANSACTION DETAILS =============== */}
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
              Adjustment + Cash Transaction Details — {dayjs(voucherDate).format('DD-MM-YYYY')}
            </Text>
            <Group gap={6} ml="auto">
              <Badge variant="filled" color="blue" size="sm" radius="sm">
                {vouchers.length} Adjustment
              </Badge>
              <Badge variant="filled" color="teal" size="sm" radius="sm">
                {cashVouchers.length} Cash
              </Badge>
            </Group>
          </Group>
        </Box>

        <LoadingOverlay visible={fetchingVouchers} overlayProps={{ blur: 2 }} />

        {gridRows.length === 0 ? (
          <Box p="xl" style={{ textAlign: 'center' }}>
            <IconArrowsExchange size={40} color="#adb5bd" style={{ marginBottom: '8px' }} />
            <Text c="dimmed" size="sm">No adjustment or cash entries on {dayjs(voucherDate).format('DD-MM-YYYY')}. Create one above.</Text>
          </Box>
        ) : (
          <ScrollArea style={{ maxHeight: '360px' }}>
            <Table highlightOnHover withColumnBorders style={{ fontSize: '13px' }}>
              <Table.Thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
                <Table.Tr>
                  <Table.Th style={{ width: '40px', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
                    #
                  </Table.Th>
                  <Table.Th style={{ width: '120px', padding: '8px 10px', fontSize: '11px', fontWeight: 700 }}>
                    Type
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
                  <Table.Th style={{ width: '80px', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
                    Source
                  </Table.Th>
                  <Table.Th style={{ width: '70px', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
                    Action
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {gridRows.map(({ voucher, kind }, index) => {
                  const drLegs = voucherLegs(voucher, 'debit', kind);
                  const crLegs = voucherLegs(voucher, 'credit', kind);
                  const lineCount = Math.max(drLegs.length, crLegs.length, 1);
                  const isAdj = kind === 'adjustment';
                  const isManual = voucher.referenceType === 'Manual';
                  const typeBadge = isAdj
                    ? { label: 'Adjustment', color: 'blue' }
                    : kind === 'receipt'
                      ? { label: 'Cash Receipt', color: 'teal' }
                      : { label: 'Cash Payment', color: 'red' };
                  // One table row per account line; the voucher-level cells
                  // span all of them. Banded per voucher (not per line).
                  const rowBg = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
                  const lineBorder = { borderTop: '1px solid #f1f3f5' };

                  return Array.from({ length: lineCount }, (_, li) => {
                    const dr = drLegs[li];
                    const cr = crLegs[li];
                    return (
                      <Table.Tr key={`${voucher._id}-${li}`} style={{ background: rowBg, ...(li > 0 ? lineBorder : {}) }}>
                        {li === 0 && (
                          <>
                            <Table.Td rowSpan={lineCount} style={{ textAlign: 'center', padding: '6px 10px', color: '#868e96', fontSize: '12px' }}>
                              {index + 1}
                            </Table.Td>
                            <Table.Td rowSpan={lineCount} style={{ padding: '6px 10px' }}>
                              <Group gap={4} wrap="nowrap">
                                <Badge size="xs" variant="light" color={typeBadge.color}>{typeBadge.label}</Badge>
                                {voucher.isMilkBill && (
                                  <Tooltip label="Milk Bill — shown in Milk Bill Abstract" withArrow>
                                    <IconMilk size={14} color="var(--mantine-color-cyan-6)" />
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td rowSpan={lineCount} style={{ padding: '6px 10px' }}>
                              <Badge variant="outline" color={typeBadge.color} size="xs" radius="sm">
                                {voucher.voucherNumber || '-'}
                              </Badge>
                            </Table.Td>
                          </>
                        )}
                        <Table.Td style={{ padding: '5px 10px', fontSize: '12px' }}>
                          {dr ? dr.label : (li === 0 ? '-' : '')}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', padding: '5px 10px' }}>
                          {dr && (
                            <Text size="xs" fw={600} c="red.7" ff="monospace">{fmtAmt(dr.amount)}</Text>
                          )}
                        </Table.Td>
                        <Table.Td style={{ padding: '5px 10px', fontSize: '12px' }}>
                          {cr ? cr.label : (li === 0 ? '-' : '')}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', padding: '5px 10px' }}>
                          {cr && (
                            <Text size="xs" fw={600} c="green.7" ff="monospace">{fmtAmt(cr.amount)}</Text>
                          )}
                        </Table.Td>
                        {li === 0 && (
                          <>
                            <Table.Td rowSpan={lineCount} style={{ textAlign: 'center', padding: '6px 10px' }}>
                              <Badge size="xs" variant="light" color={isManual ? 'grape' : 'gray'}>
                                {isManual ? 'Manual' : (voucher.referenceType || 'Auto')}
                              </Badge>
                            </Table.Td>
                            <Table.Td rowSpan={lineCount} style={{ textAlign: 'center', padding: '6px 6px' }}>
                              <Group gap={4} justify="center">
                                <Tooltip label="View" withArrow>
                                  <ActionIcon size="sm" variant="subtle" color="blue" onClick={() => handleView(voucher)}>
                                    <IconEye size={14} />
                                  </ActionIcon>
                                </Tooltip>
                                {isAdj && isManual ? (
                                  <>
                                    <Tooltip label="Edit" withArrow>
                                      <ActionIcon size="sm" variant="subtle" color="orange" onClick={() => startEdit(voucher)}>
                                        <IconEdit size={14} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Delete" withArrow>
                                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(voucher._id)}>
                                        <IconTrash size={14} />
                                      </ActionIcon>
                                    </Tooltip>
                                  </>
                                ) : (
                                  <Tooltip
                                    label={isAdj
                                      ? 'Auto-generated — edit/delete from its originating module'
                                      : `Edit/delete from the ${kind === 'receipt' ? 'Receipt' : 'Payment'} Voucher screen`}
                                    withArrow
                                  >
                                    <Text size="9px" c="dimmed" fs="italic">View only</Text>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                          </>
                        )}
                      </Table.Tr>
                    );
                  });
                })}
              </Table.Tbody>
              {/* Table Footer — Adjustment and Cash totals kept apart */}
              <Table.Tfoot>
                <Table.Tr style={{ background: '#e3f2fd', fontWeight: 700 }}>
                  <Table.Td colSpan={4} style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="xs" fw={700} c="dark.6">ADJUSTMENT TOTAL</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="sm" fw={700} c="red.7" ff="monospace">
                      {'₹'} {vouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ padding: '8px 10px' }}></Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="sm" fw={700} c="green.7" ff="monospace">
                      {'₹'} {vouchers.reduce((sum, v) => sum + (v.totalCredit || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                  <Table.Td colSpan={2} style={{ textAlign: 'center', padding: '8px 10px' }}>
                    <Text size="xs" c="dimmed">{vouchers.length} voucher(s)</Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr style={{ background: '#e6fcf5', fontWeight: 700 }}>
                  <Table.Td colSpan={4} style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="xs" fw={700} c="dark.6">CASH RECEIPTS / CASH PAYMENTS</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="sm" fw={700} c="teal.7" ff="monospace">
                      {'₹'} {cashTotals.receipts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ padding: '8px 10px' }}></Table.Td>
                  <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                    <Text size="sm" fw={700} c="red.7" ff="monospace">
                      {'₹'} {cashTotals.payments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Td>
                  <Table.Td colSpan={2} style={{ textAlign: 'center', padding: '8px 10px' }}>
                    <Text size="xs" c="dimmed">{cashVouchers.length} voucher(s)</Text>
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
                    <Table.Td style={{ fontSize: '12px' }}>
                      {entry.narration?.trim() ? `${entry.ledgerName} (${entry.narration.trim()})` : entry.ledgerName}
                    </Table.Td>
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
