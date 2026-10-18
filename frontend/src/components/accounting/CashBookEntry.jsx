import { useState, useEffect, useMemo, useRef } from 'react';
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
  Modal,
  LoadingOverlay,
  Card,
  Flex,
  SegmentedControl
} from '@mantine/core';
import {
  IconCalendar,
  IconCurrencyRupee,
  IconEye,
  IconEdit,
  IconTrash,
  IconCash,
  IconDeviceFloppy,
  IconRotate,
  IconReceipt,
  IconCreditCard,
  IconFileText,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconWallet,
  IconBuildingBank
} from '@tabler/icons-react';
import DateField from '../common/DateField';

// Cash Book Entry — Receipt Voucher + Payment Voucher in one day-wise grid.
// Rows come straight from the Voucher collection (every voucher with a Cash
// leg), so entries made on the Receipt / Payment Voucher screens show here
// and a manual entry made here is a normal Receipt / Payment voucher that
// shows there — one record, never a copy.

const fmtAmt = (n) => `₹ ${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtBal = (n) => `${n < 0 ? '- ' : ''}${fmtAmt(Math.abs(n || 0))}`;

const compactInput  = { input: { fontSize: '13px', height: '32px', minHeight: '32px' } };
const compactNumber = { input: { fontSize: '13px', height: '32px', minHeight: '32px', textAlign: 'right', fontWeight: 600 } };

const CASH_TYPES = ['Cash', 'Cash in Hand'];
const EMPTY_DRAFT = { ledgerId: '', amount: '', narration: '' };

const getLedgerGroup = (ledgerType) => {
  if (['Bank', 'Bank Accounts'].includes(ledgerType)) return 'Bank';
  if (['Party', 'Accounts Due From (Sundry Debtors)', 'Accounts Due To (Sundry Creditors)'].includes(ledgerType)) return 'Party';
  if (['Income', 'Sales', 'Sales A/c', 'Trade Income', 'Miscellaneous Income', 'Other Revenue', 'Grants & Aid', 'Subsidies'].includes(ledgerType)) return 'Income';
  if (['Expense', 'Purchases', 'Purchases A/c', 'Trade Expenses', 'Miscellaneous Expenses', 'Establishment Charges', 'Contingencies'].includes(ledgerType)) return 'Expense';
  if (['Asset', 'Other Assets', 'Other Receivable', 'Loans & Advances to Members', 'Advance due to Society', 'Fixed Assets', 'Movable Assets', 'Immovable Assets'].includes(ledgerType)) return 'Assets';
  if (['Liability', 'Other Liabilities', 'Other Payable', 'Deposits', 'Deposit A/c', 'Advance due by Society', 'Interest Payable'].includes(ledgerType)) return 'Liabilities';
  if (['Capital', 'Share Capital'].includes(ledgerType)) return 'Capital';
  return 'Other';
};

// One summary figure inside a side panel
const SummaryFigure = ({ label, value, sub, color, icon }) => (
  <Box style={{ flex: 1, padding: '10px 14px' }}>
    <Group gap={6} mb={2}>
      {icon}
      <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.4px' }}>{label}</Text>
    </Group>
    <Text fw={800} size="xl" ff="monospace" c={color}>{value}</Text>
    {sub && <Text size="xs" c="dimmed">{sub}</Text>}
  </Box>
);

const CashBookEntry = () => {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [book, setBook] = useState({ openingBalance: 0, totalReceipts: 0, totalPayments: 0, closingBalance: 0, rows: [], cashLedger: null });
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ledgers, setLedgers] = useState([]);

  // Manual entry line — side decides whether it becomes a Receipt or a Payment voucher
  const [side, setSide] = useState('Receipt');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  const ledgerRef = useRef(null);
  const amountRef = useRef(null);
  const narrationRef = useRef(null);
  const saveRef = useRef(null);

  useEffect(() => {
    ledgerAPI.getAll()
      .then(res => setLedgers(res.data || []))
      .catch(err => message.error(err.message || 'Failed to fetch ledgers'));
  }, []);

  useEffect(() => {
    fetchBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const fetchBook = async () => {
    setFetching(true);
    try {
      const res = await voucherAPI.cashBookEntry(date);
      setBook(res.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch cash book');
    } finally {
      setFetching(false);
    }
  };

  const shiftDate = (days) => setDate(d => dayjs(d).add(days, 'day').format('YYYY-MM-DD'));

  // Head of Account options — the same def_voucher_type rule as the
  // Receipt (no 'P' ledgers) and Payment (no 'R' ledgers) screens. Cash
  // itself is never a head: its leg is added automatically.
  const ledgerOptions = useMemo(() => {
    const groups = {};
    ledgers
      .filter(l => !CASH_TYPES.includes(l.ledgerType))
      .filter(l => l.voucherType !== (side === 'Receipt' ? 'P' : 'R'))
      .forEach(l => {
        const group = getLedgerGroup(l.ledgerType);
        if (!groups[group]) groups[group] = [];
        groups[group].push({ value: l._id, label: `${l.ledgerName} (${l.ledgerType})` });
      });
    return Object.entries(groups).map(([group, items]) => ({ group, items }));
  }, [ledgers, side]);

  const focus = (ref) => setTimeout(() => ref.current?.focus(), 30);

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    focus(ledgerRef);
  };

  // Cash ledger for the automatic leg — same one the voucher screens use,
  // auto-created exactly like they do when the company has none yet.
  const resolveCashLedger = async () => {
    const known = book.cashLedger || ledgers.find(l => l.ledgerType === 'Cash');
    if (known) return known;
    const res = await ledgerAPI.create({ ledgerName: 'Cash in Hand', ledgerType: 'Cash', openingBalance: 0, openingBalanceType: 'Dr', voucherType: 'B' });
    if (res?.data) setLedgers(prev => [...prev, res.data]);
    return res?.data || null;
  };

  const handleSave = async () => {
    const amount = parseFloat(draft.amount);
    if (!draft.ledgerId) { message.error('Select a Head of Account'); focus(ledgerRef); return; }
    if (!(amount > 0)) { message.error('Enter an amount'); focus(amountRef); return; }

    setSaving(true);
    try {
      const cashLedger = await resolveCashLedger();
      if (!cashLedger) { message.error('Could not create Cash ledger. Please try again.'); return; }
      const head = ledgers.find(l => l._id === draft.ledgerId);
      const narration = (draft.narration || '').trim();
      const cashLeg = { ledgerId: cashLedger._id, ledgerName: cashLedger.ledgerName, narration };
      const headLeg = { ledgerId: draft.ledgerId, ledgerName: head?.ledgerName || '', narration };

      // Identical shape to ReceiptVoucher / PaymentVoucher — Receipt: Cash Dr,
      // head Cr; Payment: head Dr, Cash Cr.
      const entries = side === 'Receipt'
        ? [{ ...cashLeg, debitAmount: amount, creditAmount: 0 }, { ...headLeg, debitAmount: 0, creditAmount: amount }]
        : [{ ...headLeg, debitAmount: amount, creditAmount: 0 }, { ...cashLeg, debitAmount: 0, creditAmount: amount }];

      const payload = {
        voucherType: side,
        voucherDate: localDateStr(new Date(date)),
        entries,
        totalDebit: amount,
        totalCredit: amount,
        referenceType: 'Manual',
        narration
      };

      if (editingId) {
        await voucherAPI.update(editingId, payload);
        message.success(`${side} voucher updated`);
      } else {
        await voucherAPI.create(payload);
        message.success(`${side} voucher saved — also listed in ${side} Voucher`);
      }
      resetDraft();
      fetchBook();
    } catch (error) {
      message.error(error.message || `Failed to save ${side.toLowerCase()} voucher`);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    const head = row.heads[0];
    setSide(row.voucher.voucherType);
    setDraft({ ledgerId: head?.ledgerId || '', amount: head?.amount || '', narration: head?.narration || row.voucher.narration || '' });
    setEditingId(row.voucher._id);
    setDetailRow(null);
    focus(amountRef);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.voucher.voucherType} voucher ${row.voucher.voucherNumber || ''}?`)) return;
    try {
      await voucherAPI.delete(row.voucher._id);
      message.success('Voucher deleted');
      if (editingId === row.voucher._id) resetDraft();
      setDetailRow(null);
      fetchBook();
    } catch (error) {
      message.error(error.message || 'Failed to delete voucher');
    }
  };

  // Running cash balance down the grid, starting from the opening balance
  const rowsWithBalance = useMemo(() => {
    let bal = book.openingBalance || 0;
    return (book.rows || []).map(r => {
      bal += r.cashIn - r.cashOut;
      return { ...r, balance: bal };
    });
  }, [book]);

  const receiptCount = rowsWithBalance.filter(r => r.side === 'receipt').length;
  const paymentCount = rowsWithBalance.length - receiptCount;

  const typeBadge = (row) => {
    const t = row.voucher.voucherType;
    if (t === 'Receipt') return { label: 'Receipt', color: 'teal' };
    if (t === 'Payment') return { label: 'Payment', color: 'red' };
    return { label: t || 'Voucher', color: 'gray' };
  };

  const particulars = (row) => {
    const fallback = row.voucher.narration || '';
    if (!row.heads.length) return fallback || '-';
    return row.heads.map(h => {
      const n = (h.narration || fallback).trim();
      return n ? `${h.ledgerName} (${n})` : h.ledgerName;
    }).join(', ');
  };

  const isToday = date === dayjs().format('YYYY-MM-DD');
  const onEnter = (next) => (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
  const thStyle = { padding: '8px 10px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' };

  return (
    <Container size={1500} py="sm" px="md">
      <LoadingOverlay visible={saving} overlayProps={{ blur: 2 }} />

      {/* =============== HEADER — DATE NAVIGATION =============== */}
      <Paper withBorder p="sm" mb="sm" radius="sm" style={{ borderColor: '#dee2e6', background: 'linear-gradient(to right, #fafbfc, #ffffff)' }}>
        <Flex justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Group gap={6} align="flex-end">
            <Button size="xs" variant="default" leftSection={<IconChevronLeft size={14} />} onClick={() => shiftDate(-1)}
              styles={{ root: { height: 30 } }}>
              Back
            </Button>
            <DateField
              label="Transaction Date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              size="xs"
              leftSection={<IconCalendar size={14} />}
              styles={{ input: { fontWeight: 600, fontSize: '13px', width: '150px' }, root: { width: 'auto' } }}
            />
            <Button size="xs" variant="default" rightSection={<IconChevronRight size={14} />} onClick={() => shiftDate(1)}
              styles={{ root: { height: 30 } }}>
              Next
            </Button>
            {!isToday && (
              <Button size="xs" variant="subtle" onClick={() => setDate(dayjs().format('YYYY-MM-DD'))} styles={{ root: { height: 30 } }}>
                Today
              </Button>
            )}
          </Group>

          <Group gap={8}>
            <IconCash size={22} color="var(--mantine-color-teal-6)" />
            <Title order={4} c="dark.7" style={{ letterSpacing: '-0.3px' }}>Cash Book Entry</Title>
            <Badge variant="light" color="gray" size="sm" radius="sm">{dayjs(date).format('dddd, DD-MM-YYYY')}</Badge>
          </Group>

          <Group gap={6}>
            <Badge variant="filled" color="teal" size="sm" radius="sm">{receiptCount} Receipt</Badge>
            <Badge variant="filled" color="red" size="sm" radius="sm">{paymentCount} Payment</Badge>
          </Group>
        </Flex>
      </Paper>

      {/* =============== BALANCE SUMMARY — CASH SIDE | PAYMENT SIDE =============== */}
      <Grid gutter="sm" mb="sm">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder radius="sm" style={{ borderColor: '#4caf50', overflow: 'hidden' }}>
            <Box px="md" py={6} style={{ background: 'linear-gradient(135deg, #e6f9e8 0%, #f0fdf0 100%)', borderBottom: '2px solid #4caf50' }}>
              <Group gap={6}><IconReceipt size={15} color="#2e7d32" /><Text fw={700} size="sm" c="green.8" tt="uppercase">Cash / Receipt Side</Text></Group>
            </Box>
            <Flex>
              <SummaryFigure label="Opening Balance" value={fmtBal(book.openingBalance)} color={book.openingBalance < 0 ? 'red.7' : 'dark.7'}
                sub={`Closing of ${dayjs(date).subtract(1, 'day').format('DD-MM-YYYY')}`} icon={<IconWallet size={14} color="#868e96" />} />
              <Divider orientation="vertical" />
              <SummaryFigure label="Cash Entry" value={fmtAmt(book.totalReceipts)} color="green.7"
                sub={`${receiptCount} receipt(s) on this date`} icon={<IconCurrencyRupee size={14} color="#2e7d32" />} />
            </Flex>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper withBorder radius="sm" style={{ borderColor: '#ef5350', overflow: 'hidden' }}>
            <Box px="md" py={6} style={{ background: 'linear-gradient(135deg, #ffebee 0%, #fff5f5 100%)', borderBottom: '2px solid #ef5350' }}>
              <Group gap={6}><IconCreditCard size={15} color="#c62828" /><Text fw={700} size="sm" c="red.8" tt="uppercase">Payment Side</Text></Group>
            </Box>
            <Flex>
              <SummaryFigure label="Payment" value={fmtAmt(book.totalPayments)} color="red.7"
                sub={`${paymentCount} payment(s) on this date`} icon={<IconCurrencyRupee size={14} color="#c62828" />} />
              <Divider orientation="vertical" />
              <SummaryFigure label="Closing Balance" value={fmtBal(book.closingBalance)} color={book.closingBalance < 0 ? 'red.7' : 'blue.8'}
                sub="Opening + Cash Entry − Payment" icon={<IconBuildingBank size={14} color="#1976d2" />} />
            </Flex>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* =============== MANUAL ENTRY =============== */}
      <Paper withBorder radius="sm" mb="sm" style={{ borderColor: editingId ? '#ff9800' : '#dee2e6', overflow: 'hidden' }}>
        <Flex gap={8} align="flex-end" wrap="wrap" px={12} py={10} style={{ background: '#f8f9fa' }}>
          <Box>
            <Text size="xs" fw={500} mb={3}>Entry Type</Text>
            <SegmentedControl
              size="xs"
              value={side}
              onChange={(v) => { if (!editingId) { setSide(v); setDraft(d => ({ ...d, ledgerId: '' })); } }}
              disabled={!!editingId}
              data={[{ value: 'Receipt', label: 'Receipt (Cash In)' }, { value: 'Payment', label: 'Payment (Cash Out)' }]}
              color={side === 'Receipt' ? 'teal' : 'red'}
            />
          </Box>
          <Select
            ref={ledgerRef}
            label="Head of Account"
            placeholder="Select account"
            data={ledgerOptions}
            searchable
            clearable
            size="xs"
            value={draft.ledgerId || null}
            onChange={(val) => { setDraft(d => ({ ...d, ledgerId: val || '' })); if (val) focus(amountRef); }}
            styles={compactInput}
            nothingFoundMessage="No accounts found"
            style={{ flex: '1 1 260px', minWidth: 200 }}
          />
          <NumberInput
            ref={amountRef}
            label="Amount"
            placeholder="0.00"
            min={0}
            decimalScale={2}
            size="xs"
            hideControls
            value={draft.amount}
            onChange={(val) => setDraft(d => ({ ...d, amount: val }))}
            onKeyDown={onEnter(() => focus(narrationRef))}
            styles={compactNumber}
            leftSection={<IconCurrencyRupee size={13} color="#868e96" />}
            leftSectionWidth={24}
            style={{ flex: '0 0 150px' }}
          />
          <TextInput
            ref={narrationRef}
            label="Narration"
            placeholder="Narration"
            size="xs"
            value={draft.narration}
            onChange={(e) => setDraft(d => ({ ...d, narration: e.target.value }))}
            onKeyDown={onEnter(() => focus(saveRef))}
            styles={compactInput}
            style={{ flex: '1 1 220px', minWidth: 160 }}
          />
          {editingId && (
            <Button size="xs" variant="subtle" color="gray" leftSection={<IconX size={14} />} onClick={resetDraft} styles={{ root: { height: 32 } }}>
              Cancel Edit
            </Button>
          )}
          <Button size="xs" variant="default" leftSection={<IconRotate size={14} />} onClick={resetDraft} styles={{ root: { height: 32 } }}>
            Clear
          </Button>
          <Button
            ref={saveRef}
            size="xs"
            color={side === 'Receipt' ? 'teal' : 'red'}
            leftSection={<IconDeviceFloppy size={14} />}
            onClick={handleSave}
            loading={saving}
            styles={{ root: { height: 32 } }}
          >
            {editingId ? `Update ${side}` : `Save ${side}`}
          </Button>
        </Flex>
        <Text size="xs" c="dimmed" px={12} py={4} style={{ borderTop: '1px solid #f1f3f5' }}>
          Saved as a {side} Voucher dated {dayjs(date).format('DD-MM-YYYY')} — Cash is {side === 'Receipt' ? 'debited' : 'credited'} automatically, and the entry also appears in the {side} Voucher screen.
        </Text>
      </Paper>

      {/* =============== COMBINED RECEIPT + PAYMENT GRID =============== */}
      <Paper withBorder radius="sm" style={{ borderColor: '#dee2e6', overflow: 'hidden', position: 'relative' }}>
        <Box px="md" py={8} style={{ background: 'linear-gradient(to right, #e3f2fd, #f5f9ff)', borderBottom: '2px solid #1976d2' }}>
          <Group gap={8}>
            <IconFileText size={16} color="#1976d2" />
            <Text fw={700} size="sm" c="blue.8" tt="uppercase" style={{ letterSpacing: '0.5px' }}>
              Receipt + Payment Details — {dayjs(date).format('DD-MM-YYYY')}
            </Text>
            <Text size="xs" c="dimmed" ml="auto">Double-click a row to view full details</Text>
          </Group>
        </Box>

        <LoadingOverlay visible={fetching} overlayProps={{ blur: 2 }} />

        <ScrollArea style={{ maxHeight: '460px' }}>
          <Table highlightOnHover withColumnBorders style={{ fontSize: '13px' }}>
            <Table.Thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1 }}>
              <Table.Tr>
                <Table.Th style={{ ...thStyle, width: 40, textAlign: 'center' }}>#</Table.Th>
                <Table.Th style={{ ...thStyle, width: 110 }}>Voucher No</Table.Th>
                <Table.Th style={{ ...thStyle, width: 90 }}>Type</Table.Th>
                <Table.Th style={thStyle}>Particulars</Table.Th>
                <Table.Th style={{ ...thStyle, width: 130, textAlign: 'right' }}>Receipt (₹)</Table.Th>
                <Table.Th style={{ ...thStyle, width: 130, textAlign: 'right' }}>Payment (₹)</Table.Th>
                <Table.Th style={{ ...thStyle, width: 140, textAlign: 'right' }}>Balance (₹)</Table.Th>
                <Table.Th style={{ ...thStyle, width: 80, textAlign: 'center' }}>Source</Table.Th>
                <Table.Th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr style={{ background: '#f1f8e9' }}>
                <Table.Td colSpan={3} />
                <Table.Td><Text size="xs" fw={700} c="green.9">OPENING BALANCE</Text></Table.Td>
                <Table.Td colSpan={2} />
                <Table.Td style={{ textAlign: 'right' }}><Text size="xs" fw={700} ff="monospace">{fmtBal(book.openingBalance)}</Text></Table.Td>
                <Table.Td colSpan={2} />
              </Table.Tr>

              {rowsWithBalance.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Box p="lg" style={{ textAlign: 'center' }}>
                      <IconCash size={36} color="#adb5bd" />
                      <Text c="dimmed" size="sm">No receipt or payment entries on {dayjs(date).format('DD-MM-YYYY')}. Add one above.</Text>
                    </Box>
                  </Table.Td>
                </Table.Tr>
              ) : rowsWithBalance.map((row, index) => {
                const v = row.voucher;
                const badge = typeBadge(row);
                const isManual = v.referenceType === 'Manual';
                const isSel = selectedId === v._id;
                const isEditing = editingId === v._id;
                return (
                  <Table.Tr
                    key={v._id}
                    onClick={() => setSelectedId(v._id)}
                    onDoubleClick={() => setDetailRow(row)}
                    style={{
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isEditing ? '#fff8e1' : isSel ? '#e7f5ff' : index % 2 ? '#f8f9fa' : '#ffffff',
                      borderLeft: `3px solid ${isEditing ? '#ff9800' : isSel ? '#1976d2' : 'transparent'}`
                    }}
                  >
                    <Table.Td style={{ textAlign: 'center', color: '#868e96', fontSize: '12px' }}>{index + 1}</Table.Td>
                    <Table.Td>
                      <Badge variant="outline" color={badge.color} size="xs" radius="sm">{v.voucherNumber || '-'}</Badge>
                    </Table.Td>
                    <Table.Td><Badge size="xs" variant="light" color={badge.color}>{badge.label}</Badge></Table.Td>
                    <Table.Td style={{ fontSize: '12px', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={particulars(row)}>
                      {particulars(row)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {row.cashIn > 0 && <Text size="xs" fw={600} c="green.7" ff="monospace">{fmtAmt(row.cashIn)}</Text>}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {row.cashOut > 0 && <Text size="xs" fw={600} c="red.7" ff="monospace">{fmtAmt(row.cashOut)}</Text>}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="xs" fw={600} ff="monospace" c={row.balance < 0 ? 'red.7' : 'dark.6'}>{fmtBal(row.balance)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge size="xs" variant="light" color={isManual ? 'grape' : 'gray'}>{isManual ? 'Manual' : (v.referenceType || 'Auto')}</Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center', padding: '4px 6px' }}>
                      <Group gap={2} justify="center" wrap="nowrap">
                        <Tooltip label="View details" withArrow>
                          <ActionIcon size="sm" variant="subtle" color="blue" onClick={(e) => { e.stopPropagation(); setDetailRow(row); }}>
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>
                        {row.editable && (
                          <>
                            <Tooltip label="Edit" withArrow>
                              <ActionIcon size="sm" variant="subtle" color="orange" onClick={(e) => { e.stopPropagation(); startEdit(row); }}>
                                <IconEdit size={14} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete" withArrow>
                              <ActionIcon size="sm" variant="subtle" color="red" onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr style={{ background: '#e3f2fd' }}>
                <Table.Td colSpan={4} style={{ textAlign: 'right', padding: '8px 10px' }}>
                  <Text size="xs" fw={700} c="dark.6">TOTAL</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                  <Text size="sm" fw={700} c="green.7" ff="monospace">{fmtAmt(book.totalReceipts)}</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                  <Text size="sm" fw={700} c="red.7" ff="monospace">{fmtAmt(book.totalPayments)}</Text>
                </Table.Td>
                <Table.Td colSpan={3} />
              </Table.Tr>
              <Table.Tr style={{ background: '#1e3a8a' }}>
                <Table.Td colSpan={6} style={{ textAlign: 'right', padding: '8px 10px' }}>
                  <Text size="xs" fw={700} c="white">CLOSING BALANCE</Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right', padding: '8px 10px' }}>
                  <Text size="sm" fw={800} c="white" ff="monospace">{fmtBal(book.closingBalance)}</Text>
                </Table.Td>
                <Table.Td colSpan={2} />
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </ScrollArea>
      </Paper>

      {/* =============== TRANSACTION DETAILS (double-click) =============== */}
      <Modal
        opened={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={<Group gap="xs"><IconEye size={18} /><Text fw={600} size="sm">Transaction Details</Text></Group>}
        size="lg"
        centered
      >
        {detailRow && (() => {
          const v = detailRow.voucher;
          const badge = typeBadge(detailRow);
          return (
            <Stack gap="md">
              <Grid gutter="sm">
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed">Voucher Number</Text>
                  <Text fw={600} size="sm">{v.voucherNumber || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed">Voucher Date</Text>
                  <Text fw={600} size="sm">{dayjs(v.voucherDate).format('DD-MM-YYYY')}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed">Voucher Type</Text>
                  <Badge color={badge.color} size="sm">{badge.label}</Badge>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed">Source</Text>
                  <Text fw={500} size="sm">{v.referenceType === 'Manual' ? 'Manual entry' : (v.referenceType || 'Auto')}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed">Cash Effect</Text>
                  <Text fw={700} size="sm" ff="monospace" c={detailRow.cashIn >= detailRow.cashOut ? 'green.7' : 'red.7'}>
                    {detailRow.cashIn >= detailRow.cashOut ? `+ ${fmtAmt(detailRow.cashIn - detailRow.cashOut)}` : `- ${fmtAmt(detailRow.cashOut - detailRow.cashIn)}`}
                  </Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed">Cash Balance After</Text>
                  <Text fw={600} size="sm" ff="monospace">{fmtBal(detailRow.balance)}</Text>
                </Grid.Col>
                <Grid.Col span={4}>
                  <Text size="xs" c="dimmed">Status</Text>
                  <Text fw={500} size="sm">{v.status || '-'}</Text>
                </Grid.Col>
                <Grid.Col span={8}>
                  <Text size="xs" c="dimmed">Entered On</Text>
                  <Text fw={500} size="sm">
                    {v.createdAt ? dayjs(v.createdAt).format('DD-MM-YYYY hh:mm A') : '-'}
                    {v.updatedAt && v.updatedAt !== v.createdAt ? ` · last changed ${dayjs(v.updatedAt).format('DD-MM-YYYY hh:mm A')}` : ''}
                  </Text>
                </Grid.Col>
              </Grid>

              <Divider label="Entries" labelPosition="center" />

              <Table withColumnBorders withRowBorders style={{ fontSize: '13px' }}>
                <Table.Thead>
                  <Table.Tr style={{ background: '#f8f9fa' }}>
                    <Table.Th style={{ fontSize: '11px' }}>Ledger</Table.Th>
                    <Table.Th style={{ fontSize: '11px' }}>Narration</Table.Th>
                    <Table.Th style={{ textAlign: 'right', fontSize: '11px' }}>Debit</Table.Th>
                    <Table.Th style={{ textAlign: 'right', fontSize: '11px' }}>Credit</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(v.entries || []).map((e, i) => (
                    <Table.Tr key={i}>
                      <Table.Td style={{ fontSize: '12px' }}>
                        {e.ledgerId?.ledgerName || e.ledgerName}
                        {e.ledgerId?.ledgerType && <Text span size="10px" c="dimmed"> ({e.ledgerId.ledgerType})</Text>}
                      </Table.Td>
                      <Table.Td style={{ fontSize: '12px' }}>{e.narration || '-'}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {e.debitAmount > 0 ? <Text c="red.7" fw={600} size="xs" ff="monospace">{fmtAmt(e.debitAmount)}</Text> : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {e.creditAmount > 0 ? <Text c="green.7" fw={600} size="xs" ff="monospace">{fmtAmt(e.creditAmount)}</Text> : '-'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                <Table.Tfoot>
                  <Table.Tr style={{ background: '#f0f4f8' }}>
                    <Table.Td colSpan={2}><Text fw={700} size="xs">Total</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text c="red.7" fw={700} size="xs" ff="monospace">{fmtAmt(v.totalDebit)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text c="green.7" fw={700} size="xs" ff="monospace">{fmtAmt(v.totalCredit)}</Text></Table.Td>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>

              <Card p="sm" withBorder bg="gray.0" radius="sm">
                <Text size="xs" c="dimmed" mb={2}>Narration</Text>
                <Text size="sm">{v.narration || '-'}</Text>
              </Card>

              <Group justify="space-between">
                <Text size="xs" c="dimmed" fs="italic">
                  {detailRow.editable ? 'Manual entry — editable here or in its voucher screen'
                    : 'Posted by another module — edit it from the module that created it'}
                </Text>
                <Group gap="xs">
                  {detailRow.editable && (
                    <>
                      <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDelete(detailRow)}>Delete</Button>
                      <Button size="xs" variant="light" color="orange" leftSection={<IconEdit size={14} />} onClick={() => startEdit(detailRow)}>Edit</Button>
                    </>
                  )}
                  <Button size="xs" variant="default" onClick={() => setDetailRow(null)}>Close</Button>
                </Group>
              </Group>
            </Stack>
          );
        })()}
      </Modal>
    </Container>
  );
};

export default CashBookEntry;
