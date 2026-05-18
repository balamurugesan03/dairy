import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, Stack, Group, Text, Box, Grid, Select, NumberInput, TextInput,
  Textarea, Button, ActionIcon, Divider, Badge, Loader,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconX, IconCheck, IconUser, IconSearch, IconCalculator,
  IconCurrencyRupee, IconHandStop,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { farmerAPI, producerLoanAPI } from '../../services/api';

const BORDER     = '1px solid #E5E7EB';
const TEXT_DARK  = '#111827';
const TEXT_MUTED = '#6B7280';

const iStyles = {
  input:  { border: BORDER, borderRadius: 8, fontSize: 13, color: TEXT_DARK, background: '#fff' },
  label:  { fontSize: 12, fontWeight: 600, color: TEXT_DARK, marginBottom: 4 },
};

const LOAN_TYPES   = ['Cash Advance', 'CF Advance', 'Loan Advance'];
const LOAN_SCHEMES = ['Monthly', 'Weekly', 'Custom'];
const PAY_MODES    = ['Cash', 'Bank', 'UPI', 'Cheque', 'NEFT', 'RTGS'];
const typeColor    = { 'Cash Advance': 'cyan', 'CF Advance': 'orange', 'Loan Advance': 'violet' };

const BLANK = {
  loanDate:        new Date(),
  farmerId:        null,
  loanType:        'Cash Advance',
  loanScheme:      'Monthly',
  principalAmount: '',
  interestType:    'Percentage',
  interestRate:    0,
  interestAmount:  0,
  totalEMI:        '',
  paymentMode:     'Cash',
  chequeNumber:    '',
  guarantorName:   '',
  guarantorPhone:  '',
  purpose:         '',
  remarks:         '',
};

const fmt = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v || 0);

export default function ProducerLoanFormModal({ opened, onClose, onSaved }) {
  const [form,       setForm]       = useState(BLANK);
  const [farmer,     setFarmer]     = useState(null);
  const [farmers,    setFarmers]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [calc,       setCalc]       = useState({ interest: 0, total: 0, emi: 0 });
  const searchTimer = useRef(null);

  useEffect(() => {
    if (opened) { setForm(BLANK); setFarmer(null); setCalc({ interest: 0, total: 0, emi: 0 }); }
  }, [opened]);

  useEffect(() => {
    farmerAPI.getAll({ status: 'Active', limit: 100 })
      .then(r => setFarmers(r?.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const p = parseFloat(form.principalAmount) || 0;
    const interest = form.interestType === 'Percentage'
      ? (p * (parseFloat(form.interestRate) || 0)) / 100
      : parseFloat(form.interestAmount) || 0;
    const total   = p + interest;
    const cnt     = parseInt(form.totalEMI) || 1;
    setCalc({ interest, total, emi: cnt > 0 ? Math.ceil(total / cnt) : 0 });
  }, [form.principalAmount, form.interestType, form.interestRate, form.interestAmount, form.totalEMI]);

  const set = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const handleSearch = (q) => {
    clearTimeout(searchTimer.current);
    if (!q?.trim()) {
      farmerAPI.getAll({ status: 'Active', limit: 100 }).then(r => setFarmers(r?.data || [])).catch(() => {});
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { const r = await farmerAPI.search(q.trim()); setFarmers(r?.data || []); }
      catch { /**/ } finally { setSearching(false); }
    }, 350);
  };

  const handleFarmerChange = (id) => {
    const f = farmers.find(x => x._id === id);
    setFarmer(f || null);
    setForm(p => ({ ...p, farmerId: id || null }));
  };

  const handleSave = async () => {
    if (!form.farmerId)        { notifications.show({ color: 'orange', message: 'Select a farmer' }); return; }
    if (!form.principalAmount) { notifications.show({ color: 'orange', message: 'Enter principal amount' }); return; }
    if (!form.totalEMI)        { notifications.show({ color: 'orange', message: 'Enter number of EMIs' }); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        principalAmount: parseFloat(form.principalAmount),
        interestRate:    parseFloat(form.interestRate) || 0,
        interestAmount:  form.interestType === 'Flat' ? parseFloat(form.interestAmount) || 0 : 0,
        totalEMI:        parseInt(form.totalEMI),
        loanDate:        dayjs(form.loanDate).format('YYYY-MM-DD'),
      };
      const res  = await producerLoanAPI.create(payload);
      const loan = res?.data;
      notifications.show({
        color: 'teal', icon: <IconCheck size={14} />,
        title: 'Loan Created',
        message: `${loan?.loanNumber || 'Loan'} — ${fmt(loan?.principalAmount || form.principalAmount)}`,
        autoClose: 3500,
      });
      onSaved?.();
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to create loan' });
    } finally {
      setSaving(false);
    }
  };

  const farmerOptions = farmers.map(f => ({
    value: f._id,
    label: `${f.farmerNumber} — ${f.personalDetails?.name || '?'}`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      centered
      size="900px"
      padding={0}
      radius="md"
      overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
      styles={{
        content: { background: '#fff', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.18)', border: BORDER },
      }}
    >
      {/* ─── Header ─── */}
      <Box style={{ padding: '16px 20px 12px', borderBottom: BORDER }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap={10} align="center">
            <Box style={{ background: '#dcfce7', borderRadius: 8, padding: '5px 7px', display: 'flex', alignItems: 'center' }}>
              <IconHandStop size={18} color="#16a34a" />
            </Box>
            <Box>
              <Group gap={8}>
                <Text fw={800} size="15px" c="#14532d">New Loan / Advance</Text>
                <Badge color={typeColor[form.loanType] || 'gray'} size="sm" variant="filled">{form.loanType}</Badge>
              </Group>
              <Text size="10px" c={TEXT_MUTED}>Producer Loan — EMI-based</Text>
            </Box>
          </Group>
          <ActionIcon variant="subtle" color="gray" radius="xl" size="lg" onClick={onClose}>
            <IconX size={18} />
          </ActionIcon>
        </Group>
      </Box>

      {/* ─── Body ─── */}
      <Box style={{ padding: '16px 20px' }}>
        <Grid gutter="sm">

          {/* Row 1: Date | Loan Type | Scheme | Payment Mode */}
          <Grid.Col span={3}>
            <DateInput label="Loan Date" value={form.loanDate} onChange={set('loanDate')}
              valueFormat="DD/MM/YYYY" size="sm" styles={iStyles} />
          </Grid.Col>
          <Grid.Col span={3}>
            <Select label="Loan Type" data={LOAN_TYPES} value={form.loanType}
              onChange={v => set('loanType')(v || 'Cash Advance')} size="sm" styles={iStyles} />
          </Grid.Col>
          <Grid.Col span={3}>
            <Select label="Scheme" data={LOAN_SCHEMES} value={form.loanScheme}
              onChange={v => set('loanScheme')(v || 'Monthly')} size="sm" styles={iStyles} />
          </Grid.Col>
          <Grid.Col span={3}>
            <Select label="Payment Mode" data={PAY_MODES} value={form.paymentMode}
              onChange={v => set('paymentMode')(v || 'Cash')} size="sm" styles={iStyles} />
          </Grid.Col>

          {/* Row 2: Farmer (left 5 cols) + Calc box (right 7 cols) */}
          <Grid.Col span={5}>
            <Select
              label={<span>Producer <span style={{ color: '#DC2626' }}>*</span></span>}
              placeholder="No., name…"
              data={farmerOptions}
              value={form.farmerId}
              onChange={handleFarmerChange}
              onSearchChange={handleSearch}
              searchable clearable
              nothingFoundMessage={searching ? 'Searching…' : 'No farmers found'}
              rightSection={searching ? <Loader size={12} /> : <IconSearch size={12} color="#94a3b8" />}
              size="sm" styles={iStyles}
            />
            {farmer && (
              <Box mt={6} style={{ background: '#f0f9ff', borderRadius: 6, padding: '6px 10px', border: '1px solid #bae6fd' }}>
                <Text size="13px" fw={800} c="#0369a1">{farmer.personalDetails?.name}</Text>
                <Group gap={14} mt={2}>
                  <Box><Text size="9px" c={TEXT_MUTED}>No.</Text><Text size="11px" fw={700}>{farmer.farmerNumber}</Text></Box>
                  <Box><Text size="9px" c={TEXT_MUTED}>Phone</Text><Text size="11px" fw={700}>{farmer.personalDetails?.phone || '—'}</Text></Box>
                  <Box><Text size="9px" c={TEXT_MUTED}>Village</Text><Text size="11px">{farmer.address?.village || '—'}</Text></Box>
                </Group>
              </Box>
            )}
          </Grid.Col>

          <Grid.Col span={7}>
            <Grid gutter="sm">
              <Grid.Col span={4}>
                <Text size="11px" fw={700} c={TEXT_DARK} mb={4}>Principal (₹) <span style={{ color: '#DC2626' }}>*</span></Text>
                <NumberInput
                  value={form.principalAmount === '' ? '' : parseFloat(form.principalAmount)}
                  onChange={v => setForm(p => ({ ...p, principalAmount: v ?? '' }))}
                  min={1} decimalScale={2} placeholder="0.00" hideControls thousandSeparator=","
                  size="sm"
                  styles={{ input: { ...iStyles.input, fontWeight: 800, fontSize: 14, textAlign: 'right', background: '#fffbeb', border: '2px solid #fde68a', color: '#92400e' } }}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Select label="Interest" data={['Percentage', 'Flat Amount'].map(v => ({ value: v === 'Percentage' ? 'Percentage' : 'Flat', label: v }))}
                  value={form.interestType} onChange={v => set('interestType')(v || 'Percentage')} size="sm" styles={iStyles} />
              </Grid.Col>
              <Grid.Col span={2}>
                {form.interestType === 'Percentage' ? (
                  <NumberInput label="Rate (%)" value={form.interestRate} onChange={set('interestRate')}
                    min={0} max={100} decimalScale={2} suffix="%" hideControls size="sm"
                    styles={{ input: { ...iStyles.input, textAlign: 'right' } }} />
                ) : (
                  <NumberInput label="Amount (₹)" value={form.interestAmount} onChange={set('interestAmount')}
                    min={0} decimalScale={2} hideControls size="sm"
                    styles={{ input: { ...iStyles.input, textAlign: 'right' } }} />
                )}
              </Grid.Col>
              <Grid.Col span={3}>
                <Text size="11px" fw={700} c={TEXT_DARK} mb={4}>No. of EMIs <span style={{ color: '#DC2626' }}>*</span></Text>
                <NumberInput
                  value={form.totalEMI === '' ? '' : parseInt(form.totalEMI)}
                  onChange={v => setForm(p => ({ ...p, totalEMI: v ?? '' }))}
                  min={1} max={360} step={1} hideControls size="sm"
                  styles={{ input: { ...iStyles.input, textAlign: 'center', fontWeight: 800, fontSize: 14, color: '#4338ca', border: '2px solid #a5b4fc' } }}
                />
              </Grid.Col>
            </Grid>

            {/* Live Calc Row */}
            <Group gap={6} mt={8} wrap="nowrap">
              {[
                { label: 'Principal',    val: parseFloat(form.principalAmount) || 0, c: '#1e293b', bg: '#f8fafc' },
                { label: 'Interest',     val: calc.interest,                         c: '#c2410c', bg: '#fff7ed' },
                { label: 'Total',        val: calc.total,                            c: '#1d4ed8', bg: '#eff6ff' },
                { label: `EMI ×${form.totalEMI || '?'}`, val: calc.emi,             c: '#166534', bg: '#f0fdf4' },
              ].map(({ label, val, c, bg }) => (
                <Box key={label} style={{ flex: 1, background: bg, borderRadius: 6, padding: '5px 8px', border: `1px solid ${c}22`, minWidth: 0 }}>
                  <Text size="8px" c={TEXT_MUTED} tt="uppercase" fw={600} truncate>{label}</Text>
                  <Text size="12px" fw={800} c={c} truncate>{fmt(val)}</Text>
                </Box>
              ))}
            </Group>
          </Grid.Col>

          {/* Cheque number if Cheque mode */}
          {form.paymentMode === 'Cheque' && (
            <Grid.Col span={4}>
              <TextInput label="Cheque Number" value={form.chequeNumber}
                onChange={e => set('chequeNumber')(e.target.value)}
                placeholder="Enter cheque number" size="sm" styles={iStyles} />
            </Grid.Col>
          )}

          {/* Row 3: Additional */}
          <Grid.Col span={3}>
            <TextInput label="Guarantor Name" value={form.guarantorName}
              onChange={e => set('guarantorName')(e.target.value)}
              placeholder="Optional" size="sm" styles={iStyles} />
          </Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="Guarantor Phone" value={form.guarantorPhone}
              onChange={e => set('guarantorPhone')(e.target.value)}
              placeholder="Optional" size="sm" styles={iStyles} />
          </Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="Purpose" value={form.purpose}
              onChange={e => set('purpose')(e.target.value)}
              placeholder="e.g. Agriculture, Medical…" size="sm" styles={iStyles} />
          </Grid.Col>
          <Grid.Col span={3}>
            <TextInput label="Remarks" value={form.remarks}
              onChange={e => set('remarks')(e.target.value)}
              placeholder="Optional" size="sm" styles={iStyles} />
          </Grid.Col>

        </Grid>
      </Box>

      {/* ─── Footer ─── */}
      <Divider color="#E5E7EB" />
      <Group justify="flex-end" gap="sm" style={{ padding: '12px 20px 16px' }}>
        <Button variant="outline" color="gray" radius="md" onClick={onClose} disabled={saving}
          styles={{ root: { borderColor: '#D1D5DB', color: TEXT_DARK, fontWeight: 600 } }}>
          Cancel
        </Button>
        <Button
          leftSection={saving ? <Loader size={12} color="white" /> : <IconCheck size={15} />}
          radius="md" onClick={handleSave} loading={saving}
          disabled={!form.farmerId || !form.principalAmount || !form.totalEMI}
          styles={{ root: { background: '#059669', fontWeight: 700, boxShadow: '0 1px 2px rgba(5,150,105,0.2)' } }}>
          Save Loan
        </Button>
      </Group>
    </Modal>
  );
}
