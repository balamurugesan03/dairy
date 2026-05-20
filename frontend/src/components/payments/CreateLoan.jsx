/**
 * Create New Loan — Full-page card-based form
 * Reuses existing ProducerLoan backend (POST /producer-loans).
 * Layout: Header | [Farmer Card] [Loan Card] [Calc Card] | Additional | Recent Loans
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Group, Text, Card, Stack, Select, NumberInput, TextInput,
  Textarea, Button, Badge, Loader, Table, ScrollArea, Center,
  Divider, ActionIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconHandStop, IconUser, IconReceipt, IconCalculator,
  IconDeviceFloppy, IconX, IconArrowLeft, IconRefresh,
  IconEye, IconPlus, IconSearch,
} from '@tabler/icons-react';
import { farmerAPI, producerLoanAPI, ledgerAPI } from '../../services/api';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v || 0);
const fmtD = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const LOAN_SCHEMES = ['Monthly', 'Weekly', 'Custom'];
const PAY_MODES    = ['Cash', 'Bank', 'UPI', 'Cheque', 'NEFT', 'RTGS'];

const BLANK = {
  loanDate:       new Date(),
  farmerId:       '',
  loanType:       '',
  loanScheme:     'Monthly',
  principalAmount:'',
  interestType:   'Percentage',
  interestRate:   0,
  interestAmount: 0,
  totalEMI:       '',
  paymentMode:    'Cash',
  bankLedgerId:   '',
  chequeNumber:   '',
  guarantorName:  '',
  guarantorPhone: '',
  purpose:        '',
  remarks:        '',
};

// ── status badge ──────────────────────────────────────────────────────────────
const statusColor = { Active: 'blue', Closed: 'green', Defaulted: 'red', Cancelled: 'gray' };

export default function CreateLoan() {
  const navigate = useNavigate();

  // ── form state ───────────────────────────────────────────────────────────
  const [form,        setForm]        = useState(BLANK);
  const [farmer,      setFarmer]      = useState(null);
  const [farmers,     setFarmers]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [loanTypes,         setLoanTypes]         = useState([]);
  const [bankLedgers,       setBankLedgers]       = useState([]);
  const [farmerOutstanding, setFarmerOutstanding] = useState(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);

  // ── derived calculations ─────────────────────────────────────────────────
  const [calc, setCalc] = useState({ interest: 0, total: 0, emi: 0 });

  // ── recent loans table ───────────────────────────────────────────────────
  const [loans,       setLoans]       = useState([]);
  const [loansLoading,setLoansLoading]= useState(false);

  const searchTimer = useRef(null);

  // ── calc effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    const principal = parseFloat(form.principalAmount) || 0;
    const interest  =
      form.interestType === 'Percentage'
        ? (principal * (parseFloat(form.interestRate) || 0)) / 100
        : parseFloat(form.interestAmount) || 0;
    const total     = principal + interest;
    const emiCount  = parseInt(form.totalEMI) || 1;
    const emi       = emiCount > 0 ? Math.ceil(total / emiCount) : 0;
    setCalc({ interest, total, emi });
  }, [form.principalAmount, form.interestType, form.interestRate, form.interestAmount, form.totalEMI]);

  // ── load recent loans ─────────────────────────────────────────────────────
  const loadLoans = useCallback(async () => {
    setLoansLoading(true);
    try {
      const res = await producerLoanAPI.getAll({ limit: 10, sortBy: 'loanDate', sortOrder: 'desc' });
      setLoans(res?.data || []);
    } catch { setLoans([]); }
    finally { setLoansLoading(false); }
  }, []);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  // ── initial farmer list + loan types + bank ledgers ──────────────────────
  useEffect(() => {
    farmerAPI.getAll({ status: 'Active', limit: 50 })
      .then(r => setFarmers(r?.data || []))
      .catch(() => {});

    producerLoanAPI.getLoanTypes()
      .then(r => {
        const types = r?.data || [];
        setLoanTypes(types);
        if (types.length > 0) setForm(p => ({ ...p, loanType: types[0].value }));
      })
      .catch(() => {});

    ledgerAPI.getAll({ ledgerType: 'Bank', status: 'Active', limit: 100 })
      .then(r => setBankLedgers((r?.data || []).map(l => ({ value: l._id, label: l.ledgerName }))))
      .catch(() => {});
  }, []);

  // ── farmer search (debounced) ─────────────────────────────────────────────
  const handleSearch = (q) => {
    clearTimeout(searchTimer.current);
    if (!q || q.trim().length === 0) {
      farmerAPI.getAll({ status: 'Active', limit: 50 })
        .then(r => setFarmers(r?.data || []))
        .catch(() => {});
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await farmerAPI.search(q.trim());
        setFarmers(r?.data || []);
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 350);
  };

  const handleFarmerChange = (id) => {
    const f = farmers.find(x => x._id === id);
    setFarmer(f || null);
    setForm(p => ({ ...p, farmerId: id || '' }));
    setFarmerOutstanding(null);
    if (id) {
      setOutstandingLoading(true);
      producerLoanAPI.getFarmerLoans(id, { includeCompleted: 'false' })
        .then(r => setFarmerOutstanding(r?.outstanding || null))
        .catch(() => setFarmerOutstanding(null))
        .finally(() => setOutstandingLoading(false));
    }
  };

  const set = (field) => (value) => setForm(p => ({ ...p, [field]: value }));

  // ── reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setForm(BLANK);
    setFarmer(null);
    setCalc({ interest: 0, total: 0, emi: 0 });
    setFarmerOutstanding(null);
  };

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.farmerId)                                         { notifications.show({ color: 'orange', message: 'Select a farmer' }); return; }
    if (!form.loanType)                                         { notifications.show({ color: 'orange', message: 'Select a loan type' }); return; }
    if (!form.principalAmount)                                  { notifications.show({ color: 'orange', message: 'Enter principal amount' }); return; }
    if (!form.totalEMI)                                         { notifications.show({ color: 'orange', message: 'Enter EMI count' }); return; }
    if (form.paymentMode !== 'Cash' && !form.bankLedgerId)      { notifications.show({ color: 'orange', message: 'Select a bank ledger for non-cash payment' }); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        principalAmount: parseFloat(form.principalAmount),
        interestRate:    parseFloat(form.interestRate)    || 0,
        interestAmount:  form.interestType === 'Flat' ? parseFloat(form.interestAmount) || 0 : 0,
        totalEMI:        parseInt(form.totalEMI),
        loanDate:        form.loanDate instanceof Date ? form.loanDate.toISOString() : form.loanDate,
        bankLedgerId:    form.paymentMode !== 'Cash' ? (form.bankLedgerId || undefined) : undefined,
      };
      const res = await producerLoanAPI.create(payload);
      const loan = res?.data;
      notifications.show({
        color: 'teal',
        title: 'Loan Created',
        message: `${loan?.loanNumber || 'Loan'} — ${fmt(loan?.principalAmount || form.principalAmount)}`,
        autoClose: 3500,
      });
      handleReset();
      loadLoans();
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to create loan' });
    } finally {
      setSaving(false);
    }
  };

  const farmerOptions = farmers.map(f => ({
    value: f._id,
    label: `${f.farmerNumber} — ${f.personalDetails?.name || '?'} (${f.personalDetails?.phone || 'no phone'})`,
  }));

  const cardBorder = '#2563eb';

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <Box style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <Box style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '8px 20px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap={12} align="center">
            <Box style={{ background: '#dcfce7', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center' }}>
              <IconHandStop size={22} color="#16a34a" />
            </Box>
            <Box>
              <Group gap={8}>
                <Text size="16px" fw={800} c="#14532d">Create New Loan</Text>
                {form.loanType && (
                  <Badge color={'violet'} size="sm" variant="filled">{form.loanType}</Badge>
                )}
              </Group>
              <Text size="10px" c="#64748b">Producer Loan / Advance</Text>
            </Box>

            <Box style={{ width: 1, height: 36, background: '#dbeafe' }} />

            {/* Loan Date */}
            <Box>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Date</Text>
              <DatePickerInput
                value={form.loanDate} onChange={set('loanDate')} valueFormat="DD MMM YYYY"
                size="xs" radius="md" style={{ width: 130 }}
                styles={{ input: { fontWeight: 700, fontSize: 12, border: '1.5px solid #bfdbfe', height: 28 } }}
              />
            </Box>

            {/* Loan Type */}
            <Box>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Loan Type</Text>
              <Select
                data={loanTypes.length ? loanTypes : [{ value: '', label: 'No loan types — add in Earnings/Deductions' }]}
                value={form.loanType} onChange={set('loanType')}
                placeholder="Select loan type"
                size="xs" radius="md" style={{ width: 200 }}
                styles={{ input: { fontWeight: 700, border: `1.5px solid ${cardBorder}`, height: 28, fontSize: 12, color: cardBorder } }}
              />
            </Box>

            {/* EMI Scheme */}
            <Box>
              <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Scheme</Text>
              <Select
                data={LOAN_SCHEMES} value={form.loanScheme} onChange={set('loanScheme')}
                size="xs" radius="md" style={{ width: 110 }}
                styles={{ input: { fontWeight: 600, border: '1.5px solid #bfdbfe', height: 28 } }}
              />
            </Box>
          </Group>

          <Group gap={8}>
            <Button leftSection={saving ? <Loader size={12} color="white" /> : <IconDeviceFloppy size={14} />}
              onClick={handleSave} disabled={saving || !form.farmerId || !form.loanType || !form.principalAmount || !form.totalEMI || (form.paymentMode !== 'Cash' && !form.bankLedgerId)}
              size="sm" radius="md" style={{ background: '#059669', fontWeight: 700 }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button leftSection={<IconX size={14} />} onClick={handleReset} size="sm" radius="md" variant="default" style={{ fontWeight: 700 }}>
              Reset
            </Button>
            <Button leftSection={<IconArrowLeft size={14} />} onClick={() => navigate(-1)} size="sm" radius="md" variant="default" style={{ fontWeight: 700 }}>
              Back
            </Button>
          </Group>
        </Group>
      </Box>

      {/* ══ SCROLLABLE CONTENT ══════════════════════════════════════════════ */}
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Box style={{ padding: '12px 20px 20px' }}>

          {/* ── CARD ROW ──────────────────────────────────────────────────── */}
          <Group gap={10} align="stretch" wrap="nowrap" mb={10}>

            {/* ── Farmer Card ── */}
            <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 300px', borderColor: '#bfdbfe', borderTop: '3px solid #2563eb', padding: '10px 14px' }}>
              <Group gap={5} mb={8}>
                <Box style={{ background: '#dbeafe', borderRadius: 6, padding: '3px 5px' }}><IconUser size={13} color="#2563eb" /></Box>
                <Text size="11px" fw={800} c="#1e3a8a" tt="uppercase">Farmer</Text>
              </Group>
              <Select
                label={<Text size="9px" fw={700} c="#64748b" tt="uppercase">Search farmer</Text>}
                data={farmerOptions}
                value={form.farmerId || null}
                onChange={handleFarmerChange}
                onSearchChange={handleSearch}
                searchable clearable
                placeholder="No., name or phone…"
                nothingFoundMessage={searching ? 'Searching…' : 'No farmers found'}
                rightSection={searching ? <Loader size={12} /> : <IconSearch size={12} color="#94a3b8" />}
                size="xs" radius="sm" mb={8}
                styles={{ input: { fontWeight: 600, border: '1.5px solid #bfdbfe', height: 28 } }}
              />
              {farmer ? (
                <Box style={{ background: '#f0f9ff', borderRadius: 6, padding: '8px 10px', border: '1px solid #bae6fd' }}>
                  <Text size="13px" fw={800} c="#0369a1">{farmer.personalDetails?.name || '—'}</Text>
                  <Group gap={12} mt={4}>
                    <Box><Text size="9px" c="#64748b">No.</Text><Text size="11px" fw={700}>{farmer.farmerNumber}</Text></Box>
                    <Box><Text size="9px" c="#64748b">Phone</Text><Text size="11px" fw={700}>{farmer.personalDetails?.phone || '—'}</Text></Box>
                    <Box><Text size="9px" c="#64748b">Village</Text><Text size="11px">{farmer.address?.village || '—'}</Text></Box>
                  </Group>
                  {/* Outstanding loan balance */}
                  <Box mt={8} style={{ background: outstandingLoading ? '#fef3c7' : farmerOutstanding?.totalOutstanding > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 5, padding: '5px 8px', border: `1px solid ${outstandingLoading ? '#fde68a' : farmerOutstanding?.totalOutstanding > 0 ? '#fca5a5' : '#86efac'}` }}>
                    {outstandingLoading ? (
                      <Group gap={6}><Loader size={10} color="orange" /><Text size="10px" c="#92400e">Loading outstanding…</Text></Group>
                    ) : (
                      <Group justify="space-between">
                        <Text size="9px" fw={700} c="#64748b" tt="uppercase">Outstanding Loans</Text>
                        <Text size="12px" fw={900} c={farmerOutstanding?.totalOutstanding > 0 ? '#dc2626' : '#16a34a'}>
                          {fmt(farmerOutstanding?.totalOutstanding || 0)}
                        </Text>
                      </Group>
                    )}
                    {!outstandingLoading && farmerOutstanding?.count > 0 && (
                      <Text size="9px" c="#64748b" mt={2}>{farmerOutstanding.count} active loan{farmerOutstanding.count > 1 ? 's' : ''}</Text>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box style={{ textAlign: 'center', padding: '10px 0', color: '#94a3b8' }}>
                  <Text size="11px">No farmer selected</Text>
                </Box>
              )}
            </Card>

            {/* ── Loan Details Card ── */}
            <Card shadow="xs" radius="md" withBorder style={{ flex: 1, borderColor: `${cardBorder}44`, borderTop: `3px solid ${cardBorder}`, padding: '10px 14px' }}>
              <Group gap={5} mb={8}>
                <Box style={{ background: '#fef9c3', borderRadius: 6, padding: '3px 5px' }}><IconReceipt size={13} color="#d97706" /></Box>
                <Text size="11px" fw={800} c="#78350f" tt="uppercase">Loan Details</Text>
              </Group>

              <Group gap={10} wrap="nowrap" align="flex-start">
                {/* Principal */}
                <Box style={{ flex: 1 }}>
                  <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Principal (₹)</Text>
                  <NumberInput
                    value={form.principalAmount === '' ? '' : parseFloat(form.principalAmount)}
                    onChange={v => setForm(p => ({ ...p, principalAmount: v ?? '' }))}
                    min={1} decimalScale={2} placeholder="0.00" hideControls
                    size="xs" radius="sm" thousandSeparator=","
                    styles={{ input: { height: 34, fontSize: 15, fontWeight: 900, background: '#fffbeb', border: '2px solid #fde68a', textAlign: 'right', color: '#92400e' } }}
                  />
                </Box>

                {/* Interest Type */}
                <Box style={{ flexShrink: 0 }}>
                  <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Interest Type</Text>
                  <Select
                    data={[{ value: 'Percentage', label: 'Percentage (%)' }, { value: 'Flat', label: 'Flat Amount' }]}
                    value={form.interestType} onChange={set('interestType')}
                    size="xs" radius="sm" style={{ width: 140 }}
                    styles={{ input: { fontWeight: 600, border: '1.5px solid #e2e8f0', height: 34 } }}
                  />
                </Box>

                {/* Interest Value */}
                <Box style={{ flexShrink: 0, width: 110 }}>
                  {form.interestType === 'Percentage' ? (
                    <>
                      <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Rate (%)</Text>
                      <NumberInput
                        value={form.interestRate} onChange={set('interestRate')}
                        min={0} max={100} decimalScale={2} suffix="%" hideControls
                        size="xs" radius="sm"
                        styles={{ input: { height: 34, fontWeight: 700, border: '1.5px solid #e2e8f0', textAlign: 'right' } }}
                      />
                    </>
                  ) : (
                    <>
                      <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Interest (₹)</Text>
                      <NumberInput
                        value={form.interestAmount} onChange={set('interestAmount')}
                        min={0} decimalScale={2} hideControls
                        size="xs" radius="sm" thousandSeparator=","
                        styles={{ input: { height: 34, fontWeight: 700, border: '1.5px solid #e2e8f0', textAlign: 'right' } }}
                      />
                    </>
                  )}
                </Box>

                {/* Total EMI */}
                <Box style={{ flexShrink: 0, width: 100 }}>
                  <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Total EMIs</Text>
                  <NumberInput
                    value={form.totalEMI === '' ? '' : parseInt(form.totalEMI)}
                    onChange={v => setForm(p => ({ ...p, totalEMI: v ?? '' }))}
                    min={1} max={360} step={1} hideControls
                    size="xs" radius="sm"
                    styles={{ input: { height: 34, fontWeight: 800, border: '2px solid #a5b4fc', textAlign: 'center', color: '#4338ca', fontSize: 16 } }}
                  />
                </Box>

                {/* Payment Mode */}
                <Box style={{ flexShrink: 0, width: 130 }}>
                  <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Payment Mode</Text>
                  <Select
                    data={PAY_MODES} value={form.paymentMode}
                    onChange={v => setForm(p => ({ ...p, paymentMode: v, bankLedgerId: '' }))}
                    size="xs" radius="sm"
                    styles={{ input: { height: 34, fontWeight: 600, border: '1.5px solid #e2e8f0' } }}
                  />
                </Box>

                {/* Bank Ledger — shown when payment mode is non-cash */}
                {form.paymentMode !== 'Cash' && (
                  <Box style={{ flexShrink: 0, minWidth: 180 }}>
                    <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Bank Ledger</Text>
                    <Select
                      data={bankLedgers.length ? bankLedgers : [{ value: '', label: 'No bank ledgers found' }]}
                      value={form.bankLedgerId || null}
                      onChange={v => setForm(p => ({ ...p, bankLedgerId: v || '' }))}
                      placeholder="Select bank…"
                      searchable
                      size="xs" radius="sm"
                      styles={{ input: { height: 34, fontWeight: 600, border: '2px solid #60a5fa' } }}
                    />
                  </Box>
                )}
              </Group>

              {form.paymentMode === 'Cheque' && (
                <Box mt={8} style={{ maxWidth: 220 }}>
                  <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Cheque Number</Text>
                  <TextInput
                    value={form.chequeNumber} onChange={e => set('chequeNumber')(e.target.value)}
                    placeholder="Enter cheque number" size="xs" radius="sm"
                    styles={{ input: { height: 28, fontWeight: 600 } }}
                  />
                </Box>
              )}
            </Card>

            {/* ── Calculation Card ── */}
            <Card shadow="xs" radius="md" withBorder style={{ flex: '0 0 230px', borderColor: '#bbf7d0', borderTop: '3px solid #16a34a', padding: '10px 14px' }}>
              <Group gap={5} mb={8}>
                <Box style={{ background: '#dcfce7', borderRadius: 6, padding: '3px 5px' }}><IconCalculator size={13} color="#16a34a" /></Box>
                <Text size="11px" fw={800} c="#14532d" tt="uppercase">Live Calculation</Text>
              </Group>

              <Stack gap={6}>
                {[
                  { label: 'Principal',      val: parseFloat(form.principalAmount) || 0, c: '#1e293b', bg: '#f8fafc' },
                  { label: 'Interest',       val: calc.interest,                         c: '#c2410c', bg: '#fff7ed' },
                  { label: 'Total Amount',   val: calc.total,                            c: '#1d4ed8', bg: '#eff6ff' },
                  { label: `EMI (×${form.totalEMI || '?'})`, val: calc.emi,             c: '#166534', bg: '#f0fdf4', bold: true },
                ].map(({ label, val, c, bg, bold }) => (
                  <Box key={label} style={{ background: bg, borderRadius: 6, padding: '6px 10px', border: `1px solid ${c}22` }}>
                    <Text size="9px" c="#64748b" tt="uppercase" fw={600}>{label}</Text>
                    <Text size={bold ? '18px' : '15px'} fw={bold ? 900 : 700} c={c}>
                      {fmt(val)}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Card>
          </Group>

          {/* ── ADDITIONAL DETAILS ──────────────────────────────────────── */}
          <Card shadow="xs" radius="md" withBorder style={{ borderColor: '#e2e8f0', padding: '10px 14px', marginBottom: 12 }}>
            <Divider label={<Text size="11px" fw={700} c="#475569" tt="uppercase">Additional Details (Optional)</Text>} labelPosition="left" mb={10} />
            <Group gap={10} align="flex-start" wrap="nowrap">
              <Box style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Guarantor Name</Text>
                <TextInput value={form.guarantorName} onChange={e => set('guarantorName')(e.target.value)}
                  placeholder="Optional" size="xs" radius="sm"
                  styles={{ input: { border: '1.5px solid #e2e8f0', height: 28 } }}
                />
              </Box>
              <Box style={{ flex: 1 }}>
                <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Guarantor Phone</Text>
                <TextInput value={form.guarantorPhone} onChange={e => set('guarantorPhone')(e.target.value)}
                  placeholder="Optional" size="xs" radius="sm"
                  styles={{ input: { border: '1.5px solid #e2e8f0', height: 28 } }}
                />
              </Box>
              <Box style={{ flex: 2 }}>
                <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Purpose</Text>
                <Textarea value={form.purpose} onChange={e => set('purpose')(e.target.value)}
                  placeholder="Purpose of the loan" autosize minRows={1} maxRows={3} size="xs" radius="sm"
                  styles={{ input: { border: '1.5px solid #e2e8f0' } }}
                />
              </Box>
              <Box style={{ flex: 2 }}>
                <Text size="9px" fw={700} c="#64748b" tt="uppercase" mb={3}>Remarks</Text>
                <Textarea value={form.remarks} onChange={e => set('remarks')(e.target.value)}
                  placeholder="Additional notes" autosize minRows={1} maxRows={3} size="xs" radius="sm"
                  styles={{ input: { border: '1.5px solid #e2e8f0' } }}
                />
              </Box>
            </Group>
          </Card>

          {/* ── RECENT LOANS TABLE ──────────────────────────────────────── */}
          <Card shadow="xs" radius="md" withBorder style={{ padding: 0 }}>
            {/* table header bar */}
            <Box style={{ background: '#14532d', borderRadius: '8px 8px 0 0', padding: '7px 14px' }}>
              <Group justify="space-between">
                <Group gap={8}>
                  <Text fw={700} size="12px" c="white">Recent Loans</Text>
                  <Badge size="sm" style={{ background: 'rgba(255,255,255,0.12)', color: '#86efac' }}>
                    {loansLoading ? <Loader size={10} color="white" /> : `${loans.length} records`}
                  </Badge>
                </Group>
                <Group gap={6}>
                  <Button leftSection={<IconPlus size={11} />} size="compact-xs" radius="sm"
                    onClick={() => navigate('/payments/loans/manage')}
                    style={{ background: '#4f46e5', border: '1px solid #818cf8', fontWeight: 700, fontSize: 10, height: 24, color: 'white' }}>
                    Manage All
                  </Button>
                  <ActionIcon size="sm" variant="subtle" onClick={loadLoans}
                    style={{ color: '#86efac', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>
                    <IconRefresh size={13} />
                  </ActionIcon>
                </Group>
              </Group>
            </Box>

            <Box style={{ background: 'white', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
              {loansLoading ? (
                <Center py="xl"><Loader size="sm" color="green" /></Center>
              ) : loans.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap={4}>
                    <IconHandStop size={40} color="#bbf7d0" />
                    <Text c="dimmed" size="sm">No loans yet — create the first one above</Text>
                  </Stack>
                </Center>
              ) : (
                <Table striped highlightOnHover withColumnBorders style={{ fontSize: 12 }}>
                  <Table.Thead style={{ background: '#f0fdf4' }}>
                    <Table.Tr>
                      {['#', 'Loan No', 'Date', 'Farmer', 'Type', 'Principal', 'Interest', 'Total', 'EMI (×count)', 'Outstanding', 'Status', ''].map(h => (
                        <Table.Th key={h} style={{ fontSize: 10, fontWeight: 800, color: '#14532d', padding: '8px 10px', whiteSpace: 'nowrap' }}>{h}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {loans.map((loan, i) => (
                      <Table.Tr key={loan._id}>
                        <Table.Td style={{ padding: '6px 10px', color: '#94a3b8', fontWeight: 700 }}>{i + 1}</Table.Td>
                        <Table.Td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#166534' }}>{loan.loanNumber}</Table.Td>
                        <Table.Td style={{ padding: '6px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtD(loan.loanDate)}</Table.Td>
                        <Table.Td style={{ padding: '6px 10px' }}>
                          <Text size="12px" fw={700}>{loan.farmerId?.farmerNumber || '—'}</Text>
                          <Text size="10px" c="dimmed">{loan.farmerId?.personalDetails?.name || '—'}</Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 10px' }}>
                          <Badge size="xs" color={'violet'} variant="light">{loan.loanType}</Badge>
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{fmt(loan.principalAmount)}</Table.Td>
                        <Table.Td style={{ padding: '6px 10px', textAlign: 'right', color: '#c2410c' }}>{fmt(loan.interestAmount)}</Table.Td>
                        <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>{fmt(loan.totalLoanAmount)}</Table.Td>
                        <Table.Td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          <Text size="12px" fw={700} c="#16a34a">{fmt(loan.emiAmount)}</Text>
                          <Text size="10px" c="dimmed">×{loan.totalEMI}</Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          <Text size="12px" fw={700} c={loan.outstandingAmount > 0 ? '#c2410c' : '#16a34a'}>
                            {fmt(loan.outstandingAmount)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 10px' }}>
                          <Badge size="xs" color={statusColor[loan.status] || 'gray'} variant="light">{loan.status}</Badge>
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 8px' }}>
                          <ActionIcon size="xs" color="blue" variant="subtle" radius="sm"
                            onClick={() => navigate(`/payments/loans/${loan._id}`)}>
                            <IconEye size={13} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Box>
          </Card>

        </Box>
      </ScrollArea>
    </Box>
  );
}
