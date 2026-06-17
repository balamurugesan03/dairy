import { useEffect, useState } from 'react';
import {
  Modal, Stack, Group, Text, Title, Box, Grid, Select, NumberInput, TextInput,
  Textarea, Button, ActionIcon, Divider, SegmentedControl, Badge,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconX, IconCheck, IconUser, IconCalendar, IconCurrencyRupee,
  IconCreditCard, IconRepeat, IconFileText, IconHash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { advanceAPI, farmerAPI } from '../../services/api';

/* ─── Style tokens (matches the spec's clean enterprise look) ─────────── */
const BORDER     = '1px solid #E5E7EB';
const TEXT_MUTED = '#6B7280';
const TEXT_DARK  = '#111827';
const PRIMARY    = '#1D4ED8';

const inputStyles = {
  input: {
    border:       BORDER,
    borderRadius: 8,
    fontSize:     14,
    color:        TEXT_DARK,
    background:   '#FFFFFF',
  },
  label: {
    fontSize:   13,
    fontWeight: 600,
    color:      TEXT_DARK,
    marginBottom: 6,
  },
};

const ADVANCE_TYPES = [
  { value: 'Cash',            label: 'Cash' },
  { value: 'Regular',         label: 'Regular' },
  { value: 'Emergency',       label: 'Emergency' },
  { value: 'Festival',        label: 'Festival' },
  { value: 'Medical',         label: 'Medical' },
  { value: 'Agriculture',     label: 'Agriculture' },
  { value: 'Cattle Purchase', label: 'Cattle Purchase' },
  { value: 'Feed',            label: 'Feed' },
  { value: 'Other',           label: 'Other' },
];

const PAYMENT_MODES = [
  { value: 'Cash',   label: 'Cash' },
  { value: 'Bank',   label: 'Bank' },
  { value: 'UPI',    label: 'UPI' },
  { value: 'Cheque', label: 'Cheque' },
];

const REPAYMENT_TYPES = [
  { value: 'Per Payment Deduction', label: 'Per Payment Deduction' },
  { value: 'Monthly Deduction',     label: 'Monthly Deduction' },
  { value: 'EMI',                   label: 'EMI' },
  { value: 'Lump Sum',              label: 'Lump Sum' },
  { value: 'Custom',                label: 'Custom' },
];

const emptyForm = {
  farmerId:       null,
  advanceDate:    new Date(),
  advanceType:    'Cash',
  advanceAmount:  '',
  paymentMode:    'Cash',
  repaymentType:  'Per Payment Deduction',
  emiCount:       '',
  emiAmount:      '',
  emiFrequency:   'Monthly',
  purpose:        '',
  remarks:        '',
};

const CashAdvanceFormModal = ({ opened, onClose, onSaved }) => {
  const [farmers,     setFarmers]    = useState([]);
  const [form,        setForm]       = useState(emptyForm);
  const [errors,      setErrors]     = useState({});
  const [submitting,  setSubmitting] = useState(false);

  /* Reset form whenever the modal opens */
  useEffect(() => {
    if (opened) { setForm(emptyForm); setErrors({}); }
  }, [opened]);

  /* Load farmer list once */
  useEffect(() => {
    farmerAPI.getAll({ status: 'Active', limit: 500 })
      .then(res => {
        const list = res?.data || [];
        setFarmers(list.map(f => ({
          value: f._id,
          label: `${f.farmerNumber} — ${f.personalDetails?.name || ''}`,
        })));
      })
      .catch(() => {});
  }, []);

  const setField = (k, v) => {
    setForm(prev => {
      const next = { ...prev, [k]: v };
      // Auto-calculate EMI amount when count or advance amount changes
      if (k === 'emiCount' || k === 'advanceAmount') {
        const amt   = k === 'advanceAmount' ? Number(v) : Number(next.advanceAmount);
        const count = k === 'emiCount'       ? Number(v) : Number(next.emiCount);
        if (amt > 0 && count > 0) {
          next.emiAmount = parseFloat((amt / count).toFixed(2));
        } else {
          next.emiAmount = '';
        }
      }
      return next;
    });
    setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.farmerId)     e.farmerId     = 'Select a producer';
    if (!form.advanceDate)  e.advanceDate  = 'Date is required';
    if (!form.advanceAmount || Number(form.advanceAmount) <= 0)
                            e.advanceAmount = 'Enter a valid amount';
    if (form.repaymentType === 'EMI') {
      if (!form.emiCount || Number(form.emiCount) < 1) e.emiCount  = 'Enter number of EMIs';
      if (!form.emiAmount || Number(form.emiAmount) <= 0) e.emiAmount = 'Enter EMI amount';
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      const payload = {
        farmerId:        form.farmerId,
        advanceDate:     dayjs(form.advanceDate).format('YYYY-MM-DD'),
        advanceType:     form.advanceType,
        advanceCategory: 'Cash Advance',
        advanceAmount:   Number(form.advanceAmount),
        paymentMode:     form.paymentMode,
        repaymentType:   form.repaymentType,
        purpose:         form.purpose,
        remarks:         form.remarks,
      };
      if (form.repaymentType === 'EMI') {
        payload.emiCount     = Number(form.emiCount);
        payload.emiAmount    = Number(form.emiAmount);
        payload.emiFrequency = form.emiFrequency;
      }
      const res = await advanceAPI.create(payload);
      if (res?.success === false) throw new Error(res.message || 'Save failed');
      notifications.show({
        title:   'Cash Advance Added',
        message: 'New advance recorded successfully',
        color:   'teal',
        icon:    <IconCheck size={14} />,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      notifications.show({
        title:   'Save Failed',
        message: err.message || 'Could not save advance',
        color:   'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isEMI = form.repaymentType === 'EMI';
  const emiSummaryValid = isEMI && Number(form.emiCount) > 0 && Number(form.emiAmount) > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      centered
      size="lg"
      padding={0}
      radius="md"
      overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
      styles={{
        content: {
          background: '#FFFFFF',
          boxShadow:  '0 20px 50px -12px rgba(0, 0, 0, 0.18)',
          border:     '1px solid #E5E7EB',
        },
      }}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <Box style={{ padding: '20px 24px 12px 24px', borderBottom: BORDER }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Box>
            <Title order={4} fw={700} c={TEXT_DARK} style={{ letterSpacing: -0.2 }}>
              New Cash Advance
            </Title>
            <Text size="sm" c={TEXT_MUTED} mt={4}>Record advance given to producer</Text>
          </Box>
          <ActionIcon
            variant="subtle" color="gray" radius="xl" size="lg"
            onClick={onClose} aria-label="Close"
          >
            <IconX size={18} />
          </ActionIcon>
        </Group>
      </Box>

      {/* ─── Body ──────────────────────────────────────────────── */}
      <Box style={{ padding: '20px 24px' }}>
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label={<span>Producer <span style={{ color: '#DC2626' }}>*</span></span>}
              placeholder="Search and select producer"
              data={farmers}
              value={form.farmerId}
              onChange={v => setField('farmerId', v)}
              searchable clearable
              nothingFoundMessage="No producers found"
              leftSection={<IconUser size={15} color={TEXT_MUTED} />}
              error={errors.farmerId}
              styles={inputStyles}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label={<span>Advance Date <span style={{ color: '#DC2626' }}>*</span></span>}
              value={form.advanceDate}
              onChange={v => setField('advanceDate', v)}
              valueFormat="DD/MM/YYYY"
              leftSection={<IconCalendar size={15} color={TEXT_MUTED} />}
              error={errors.advanceDate}
              styles={inputStyles}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Advance Type"
              data={ADVANCE_TYPES}
              value={form.advanceType}
              onChange={v => setField('advanceType', v || 'Cash')}
              styles={inputStyles}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <NumberInput
              label={<span>Advance Amount (₹) <span style={{ color: '#DC2626' }}>*</span></span>}
              placeholder="0.00"
              value={form.advanceAmount}
              onChange={v => setField('advanceAmount', v)}
              min={0}
              decimalScale={2}
              thousandSeparator=","
              leftSection={<IconCurrencyRupee size={15} color={TEXT_MUTED} />}
              error={errors.advanceAmount}
              styles={inputStyles}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Payment Mode"
              data={PAYMENT_MODES}
              value={form.paymentMode}
              onChange={v => setField('paymentMode', v || 'Cash')}
              leftSection={<IconCreditCard size={15} color={TEXT_MUTED} />}
              styles={inputStyles}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Select
              label="Repayment Type"
              data={REPAYMENT_TYPES}
              value={form.repaymentType}
              onChange={v => setField('repaymentType', v || 'Per Payment Deduction')}
              leftSection={<IconRepeat size={15} color={TEXT_MUTED} />}
              styles={inputStyles}
            />
          </Grid.Col>

          {/* ─── EMI Fields (conditional) ─────────────────────── */}
          {isEMI && (
            <>
              <Grid.Col span={12}>
                <Box
                  style={{
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 10,
                    padding: '14px 16px',
                  }}
                >
                  <Text size="xs" fw={700} c="#1D4ED8" mb={10} tt="uppercase" style={{ letterSpacing: '0.5px' }}>
                    EMI Configuration
                  </Text>
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<span>Number of EMIs <span style={{ color: '#DC2626' }}>*</span></span>}
                        placeholder="e.g. 6"
                        value={form.emiCount}
                        onChange={v => setField('emiCount', v)}
                        min={1}
                        step={1}
                        allowDecimal={false}
                        leftSection={<IconHash size={15} color={TEXT_MUTED} />}
                        error={errors.emiCount}
                        styles={inputStyles}
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label={<span>EMI Amount (₹) <span style={{ color: '#DC2626' }}>*</span></span>}
                        placeholder="Auto-calculated"
                        value={form.emiAmount}
                        onChange={v => setField('emiAmount', v)}
                        min={0.01}
                        decimalScale={2}
                        thousandSeparator=","
                        leftSection={<IconCurrencyRupee size={15} color={TEXT_MUTED} />}
                        description="Auto-calculated from Amount ÷ EMIs. You can override."
                        error={errors.emiAmount}
                        styles={inputStyles}
                      />
                    </Grid.Col>

                    <Grid.Col span={12}>
                      <Text size="13px" fw={600} c={TEXT_DARK} mb={8}>Repayment Frequency</Text>
                      <SegmentedControl
                        fullWidth
                        value={form.emiFrequency}
                        onChange={v => setField('emiFrequency', v)}
                        data={[
                          { value: 'Monthly',           label: 'Monthly' },
                          { value: 'Per Payment Cycle', label: 'Per Payment Cycle' },
                        ]}
                        styles={{
                          root:     { background: '#E0E7FF', borderRadius: 8 },
                          label:    { fontSize: 13, fontWeight: 600 },
                          indicator:{ borderRadius: 6 },
                        }}
                      />
                    </Grid.Col>

                    {emiSummaryValid && (
                      <Grid.Col span={12}>
                        <Box
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #C7D2FE',
                            borderRadius: 8,
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <IconRepeat size={16} color="#4F46E5" />
                          <Text size="sm" c="#1E40AF">
                            <strong>₹{Number(form.emiAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                            {' × '}<strong>{form.emiCount}</strong> installments
                            {' — '}<strong>{form.emiFrequency}</strong>
                          </Text>
                          <Badge ml="auto" color="indigo" variant="light" size="sm">
                            Total: ₹{(Number(form.emiAmount) * Number(form.emiCount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </Badge>
                        </Box>
                      </Grid.Col>
                    )}
                  </Grid>
                </Box>
              </Grid.Col>
            </>
          )}

          <Grid.Col span={12}>
            <TextInput
              label="Purpose"
              placeholder="e.g. Festival expense, medical emergency..."
              value={form.purpose}
              onChange={e => setField('purpose', e.currentTarget.value)}
              leftSection={<IconFileText size={15} color={TEXT_MUTED} />}
              styles={inputStyles}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label="Remarks"
              placeholder="Additional notes (optional)"
              value={form.remarks}
              onChange={e => setField('remarks', e.currentTarget.value)}
              minRows={3}
              autosize maxRows={5}
              styles={inputStyles}
            />
          </Grid.Col>
        </Grid>
      </Box>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <Divider color="#E5E7EB" />
      <Group justify="flex-end" gap="sm" style={{ padding: '14px 24px 20px 24px' }}>
        <Button
          variant="outline"
          color="gray"
          radius="md"
          onClick={onClose}
          disabled={submitting}
          styles={{
            root: { borderColor: '#D1D5DB', color: TEXT_DARK, fontWeight: 600 },
          }}
        >
          Cancel
        </Button>
        <Button
          leftSection={<IconCheck size={16} />}
          radius="md"
          onClick={handleSubmit}
          loading={submitting}
          styles={{
            root: {
              background: PRIMARY,
              fontWeight: 600,
              boxShadow:  '0 1px 2px rgba(29, 78, 216, 0.18)',
              '&:hover':  { background: '#1E40AF' },
            },
          }}
        >
          Save Advance
        </Button>
      </Group>
    </Modal>
  );
};

export default CashAdvanceFormModal;
