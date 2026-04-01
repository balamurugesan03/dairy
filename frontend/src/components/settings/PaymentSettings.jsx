import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Title, Text, Group, Stack, Badge, Button, Divider,
  Grid, Card, ThemeIcon, NumberInput, SegmentedControl, Alert,
  Loader, Center, Tooltip
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarClock, IconCurrencyRupee, IconCheck, IconCalendarEvent,
  IconRefresh, IconDeviceFloppy, IconInfoCircle, IconClock, IconWallet,
  IconBuildingBank
} from '@tabler/icons-react';
import { dairySettingsAPI } from '../../services/api';

// ── Payment Day option card ───────────────────────────────────────────────────
const DayCard = ({ days, label, sublabel, periods, selected, onClick }) => (
  <Card
    withBorder
    radius="md"
    p="md"
    style={{
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      borderWidth: selected ? 2 : 1,
      borderColor: selected ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-default-border)',
      background: selected ? 'var(--mantine-color-indigo-0)' : undefined,
    }}
    onClick={onClick}
  >
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <ThemeIcon
        size={40}
        radius="md"
        color={selected ? 'indigo' : 'gray'}
        variant={selected ? 'filled' : 'light'}
        style={{ flexShrink: 0 }}
      >
        <IconClock size={20} />
      </ThemeIcon>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700} size="md" c={selected ? 'indigo' : undefined}>{label}</Text>
          {selected && (
            <ThemeIcon size="sm" color="indigo" radius="xl" variant="filled" style={{ flexShrink: 0 }}>
              <IconCheck size={12} />
            </ThemeIcon>
          )}
        </Group>
        <Text size="xs" c="dimmed" mb={4}>{sublabel}</Text>
        <Text size="xs" fw={600} c={selected ? 'indigo.7' : 'gray.6'}
          style={{ fontFamily: 'monospace', letterSpacing: 0.2 }}>
          {periods}
        </Text>
      </div>
    </Group>
  </Card>
);

const PAYMENT_OPTIONS = [
  { days: 7,  label: '7 Days',  sublabel: 'Weekly payment cycle',       periods: '1–7,  8–14,  15–21,  22 – Month End' },
  { days: 10, label: '10 Days', sublabel: '10-day payment cycle',       periods: '1–10,  11–20,  21 – Month End' },
  { days: 15, label: '15 Days', sublabel: 'Fortnightly payment cycle',  periods: '1–15,  16 – Month End' },
  { days: 30, label: '1 Month', sublabel: 'Monthly payment cycle',      periods: '1 – Month End' },
];

export default function PaymentSettings() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [settings, setSettings] = useState(null);

  // local form state
  const [paymentDays, setPaymentDays]     = useState(15);
  const [paymentFromDate, setPaymentFromDate]           = useState(null);
  const [accountStartDate, setAccountStartDate]         = useState(null);
  const [acStartBalance, setAcStartBalance]             = useState(0);
  const [acStartBalanceType, setAcStartBalanceType]     = useState('Dr');
  const [fyOpeningBalance, setFyOpeningBalance]         = useState(0);
  const [fyOpeningBalanceType, setFyOpeningBalanceType] = useState('Dr');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await dairySettingsAPI.get();
    if (res?.success && res.data) {
      const d = res.data;
      setSettings(d);
      setPaymentDays(d.paymentDays ?? 15);
      setPaymentFromDate(d.paymentFromDate ? new Date(d.paymentFromDate) : null);
      setAccountStartDate(d.accountStartDate ? new Date(d.accountStartDate) : null);
      setAcStartBalance(d.accountStartDateOpeningBalance ?? 0);
      setAcStartBalanceType(d.accountStartDateOpeningBalanceType ?? 'Dr');
      setFyOpeningBalance(d.financialYearOpeningBalance ?? 0);
      setFyOpeningBalanceType(d.financialYearOpeningBalanceType ?? 'Dr');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    const res = await dairySettingsAPI.update({
      paymentDays,
      paymentFromDate: paymentFromDate ? new Date(paymentFromDate).toISOString() : null,
      accountStartDate:                    accountStartDate ? new Date(accountStartDate).toISOString() : null,
      accountStartDateOpeningBalance:      acStartBalance,
      accountStartDateOpeningBalanceType:  acStartBalanceType,
      financialYearOpeningBalance:         fyOpeningBalance,
      financialYearOpeningBalanceType:     fyOpeningBalanceType,
    });
    setSaving(false);

    if (res?.success) {
      setSettings(res.data);
      notifications.show({
        color: 'green',
        icon: <IconCheck size={16} />,
        title: 'Settings Saved',
        message: 'Payment and account settings updated successfully.',
      });
    } else {
      notifications.show({ color: 'red', message: res?.message || 'Failed to save settings.' });
    }
  };

  // ── What dates would a payment period produce? ─────────────────────────────
  const previewDates = () => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to   = new Date(from);
    to.setDate(from.getDate() + paymentDays - 1);
    const fmt = d => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `e.g.  ${fmt(from)}  →  ${fmt(to)}`;
  };

  if (loading) return <Center p="xl"><Loader size="sm" /></Center>;

  return (
    <Box p="md">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon color="cyan" variant="light" size="xl" radius="md">
            <IconCalendarClock size={22} />
          </ThemeIcon>
          <div>
            <Title order={3}>Payment &amp; Account Settings</Title>
            <Text size="xs" c="dimmed">Configure payment cycles and accounting opening balances</Text>
          </div>
        </Group>
        <Group gap="xs">
          <Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={load} size="sm">
            Refresh
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            loading={saving}
            size="sm"
          >
            Save Settings
          </Button>
        </Group>
      </Group>

      {/* ── SECTION 1: Payment Settings ──────────────────────────────────── */}
      <Paper withBorder radius="md" mb="md">
        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Group gap="xs">
            <ThemeIcon size="sm" color="cyan" variant="light" radius="sm">
              <IconClock size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">Payment Settings</Text>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Set the default payment cycle. This auto-fills the period dates on the Milk Payment Register.
          </Text>
        </Box>

        <Box p="md">
          <Text size="sm" fw={500} mb="sm">Payment Days</Text>
          <Grid gutter="sm" mb="xs">
            {PAYMENT_OPTIONS.map(opt => (
              <Grid.Col key={opt.days} span={{ base: 6, sm: 3 }}>
                <DayCard
                  {...opt}
                  selected={paymentDays === opt.days}
                  onClick={() => setPaymentDays(opt.days)}
                />
              </Grid.Col>
            ))}
          </Grid>

          <Divider my="sm" label="Payment From Date" labelPosition="left" />
          <Grid gutter="sm" mb="sm">
            <Grid.Col span={{ base: 12, sm: 5 }}>
              <Stack gap={4}>
                <Group gap={4}>
                  <Text size="xs" fw={500}>Payment From Date</Text>
                  <Tooltip label="The start date of the payment cycle. Payment Register will auto-fill From Date from this." withArrow>
                    <IconInfoCircle size={13} color="var(--mantine-color-dimmed)" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
                <DateInput
                  placeholder="Select payment from date"
                  value={paymentFromDate}
                  onChange={setPaymentFromDate}
                  valueFormat="DD MMM YYYY"
                  clearable
                  leftSection={<IconCalendarEvent size={16} />}
                />
                <Text size="xs" c="dimmed">
                  Payment Register will use this as From Date and add {paymentDays === 30 ? '1 month' : `${paymentDays} days`} for the To Date.
                </Text>
              </Stack>
            </Grid.Col>
            {paymentFromDate && (
              <Grid.Col span={{ base: 12, sm: 7 }}>
                {(() => {
                  const fd  = new Date(paymentFromDate);
                  const eom = new Date(fd.getFullYear(), fd.getMonth() + 1, 0);
                  const nextStart = new Date(fd);
                  nextStart.setDate(nextStart.getDate() + paymentDays);
                  const td  = nextStart >= eom ? eom : new Date(fd.getFullYear(), fd.getMonth(), fd.getDate() + paymentDays - 1);
                  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                  return (
                    <Card withBorder radius="sm" p="sm" bg="cyan.0" mt={20}>
                      <Text size="xs" c="dimmed" fw={500}>Period Preview</Text>
                      <Text size="sm" fw={600} mt={4} c="cyan.8">
                        {fmt(fd)} → {fmt(td)}
                      </Text>
                    </Card>
                  );
                })()}
              </Grid.Col>
            )}
          </Grid>

          <Alert color="cyan" radius="md" icon={<IconInfoCircle size={16} />} mt="xs">
            <Text size="xs">
              <strong>Active cycle: {paymentDays === 30 ? '1 Month' : `${paymentDays} Days`}</strong>
              &nbsp;— {previewDates()}
            </Text>
          </Alert>

          <Divider my="md" label="How it works" labelPosition="left" />
          <Grid gutter="xs">
            {[
              { icon: '1', text: 'Open Milk Payment Register' },
              { icon: '2', text: 'Pick a From Date' },
              { icon: '3', text: `To Date auto-fills as From + ${paymentDays === 30 ? '30' : paymentDays} days` },
              { icon: '4', text: 'Generate and process payments' },
            ].map(s => (
              <Grid.Col key={s.icon} span={{ base: 12, sm: 6 }}>
                <Group gap="xs">
                  <Badge size="xs" circle color="cyan" variant="filled">{s.icon}</Badge>
                  <Text size="xs" c="dimmed">{s.text}</Text>
                </Group>
              </Grid.Col>
            ))}
          </Grid>
        </Box>
      </Paper>

      {/* ── SECTION 2: Account Settings ──────────────────────────────────── */}
      <Paper withBorder radius="md">
        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Group gap="xs">
            <ThemeIcon size="sm" color="indigo" variant="light" radius="sm">
              <IconBuildingBank size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">Account Settings</Text>
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            Define the accounting start date and opening balances for accurate financial reporting.
          </Text>
        </Box>

        <Box p="md">
          <Grid gutter="md">

            {/* ── Financial Year Opening Balance ──── */}
            <Grid.Col span={12}>
              <Paper withBorder radius="sm" p="md" bg="var(--mantine-color-indigo-0)">
                <Group gap="xs" mb="sm">
                  <ThemeIcon size="sm" color="indigo" variant="light" radius="sm">
                    <IconCalendarEvent size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">Financial Year Opening Balance</Text>
                  <Tooltip label="Balance carried forward at the start of the current financial year (e.g., 1 Apr 2025)" withArrow>
                    <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
                <Grid gutter="sm">
                  <Grid.Col span={{ base: 12, sm: 7 }}>
                    <NumberInput
                      label="Opening Balance Amount (₹)"
                      placeholder="0.00"
                      value={fyOpeningBalance}
                      onChange={v => setFyOpeningBalance(Number(v) || 0)}
                      leftSection={<IconCurrencyRupee size={16} />}
                      decimalScale={2}
                      fixedDecimalScale
                      thousandSeparator=","
                      min={0}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 5 }}>
                    <Text size="xs" fw={500} mb={6} c="dimmed">Balance Type</Text>
                    <SegmentedControl
                      fullWidth
                      data={[
                        { value: 'Dr', label: 'Dr  (Debit)' },
                        { value: 'Cr', label: 'Cr  (Credit)' },
                      ]}
                      value={fyOpeningBalanceType}
                      onChange={setFyOpeningBalanceType}
                      color="indigo"
                    />
                  </Grid.Col>
                </Grid>
                <Text size="xs" c="dimmed" mt="xs">
                  This is the total balance at the beginning of the financial year. Used in Balance Sheet and Trial Balance reports.
                </Text>
              </Paper>
            </Grid.Col>

            <Grid.Col span={12}><Divider /></Grid.Col>

            {/* ── Account Start Date ──── */}
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Stack gap={4}>
                <Group gap={4}>
                  <Text size="xs" fw={500}>Account Start Date</Text>
                  <Tooltip label="The date this society's accounts were first entered in this software" withArrow>
                    <IconInfoCircle size={13} color="var(--mantine-color-dimmed)" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
                <DateInput
                  placeholder="Select start date"
                  value={accountStartDate}
                  onChange={setAccountStartDate}
                  valueFormat="DD MMM YYYY"
                  clearable
                  leftSection={<IconCalendarEvent size={16} />}
                />
                <Text size="xs" c="dimmed">
                  Reports and ledgers will start from this date.
                </Text>
              </Stack>
            </Grid.Col>

            {/* ── Account Start Date Opening Balance ──── */}
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <Paper withBorder radius="sm" p="md">
                <Group gap="xs" mb="sm">
                  <ThemeIcon size="sm" color="teal" variant="light" radius="sm">
                    <IconWallet size={14} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">Account Start Date Opening Balance</Text>
                  <Tooltip label="Cash / Bank balance on the account start date (Day-1 balance)" withArrow>
                    <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" style={{ cursor: 'help' }} />
                  </Tooltip>
                </Group>
                <Grid gutter="sm">
                  <Grid.Col span={{ base: 12, sm: 7 }}>
                    <NumberInput
                      label="Opening Balance Amount (₹)"
                      placeholder="0.00"
                      value={acStartBalance}
                      onChange={v => setAcStartBalance(Number(v) || 0)}
                      leftSection={<IconCurrencyRupee size={16} />}
                      decimalScale={2}
                      fixedDecimalScale
                      thousandSeparator=","
                      min={0}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 5 }}>
                    <Text size="xs" fw={500} mb={6} c="dimmed">Balance Type</Text>
                    <SegmentedControl
                      fullWidth
                      data={[
                        { value: 'Dr', label: 'Dr  (Debit)' },
                        { value: 'Cr', label: 'Cr  (Credit)' },
                      ]}
                      value={acStartBalanceType}
                      onChange={setAcStartBalanceType}
                      color="teal"
                    />
                  </Grid.Col>
                </Grid>
                <Text size="xs" c="dimmed" mt="xs">
                  This is the actual cash-in-hand / bank balance when accounts were first set up.
                </Text>
              </Paper>
            </Grid.Col>
          </Grid>

          {/* Summary card */}
          {(acStartBalance > 0 || fyOpeningBalance > 0) && (
            <>
              <Divider my="md" label="Summary" labelPosition="left" />
              <Grid gutter="sm">
                {fyOpeningBalance > 0 && (
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Card withBorder radius="sm" p="sm" style={{ borderLeft: '3px solid var(--mantine-color-indigo-6)' }}>
                      <Text size="xs" c="dimmed" fw={500}>Financial Year Opening Balance</Text>
                      <Group gap={4} mt={2}>
                        <Text size="lg" fw={700}>
                          ₹{fyOpeningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                        <Badge size="xs" color={fyOpeningBalanceType === 'Dr' ? 'red' : 'green'} variant="light">
                          {fyOpeningBalanceType}
                        </Badge>
                      </Group>
                    </Card>
                  </Grid.Col>
                )}
                {acStartBalance > 0 && (
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Card withBorder radius="sm" p="sm" style={{ borderLeft: '3px solid var(--mantine-color-teal-6)' }}>
                      <Text size="xs" c="dimmed" fw={500}>
                        Account Start Balance
                        {accountStartDate && <span> ({new Date(accountStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})</span>}
                      </Text>
                      <Group gap={4} mt={2}>
                        <Text size="lg" fw={700}>
                          ₹{acStartBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                        <Badge size="xs" color={acStartBalanceType === 'Dr' ? 'red' : 'green'} variant="light">
                          {acStartBalanceType}
                        </Badge>
                      </Group>
                    </Card>
                  </Grid.Col>
                )}
              </Grid>
            </>
          )}
        </Box>

        {/* Save footer */}
        <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Group justify="flex-end">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              Save Settings
            </Button>
          </Group>
        </Box>
      </Paper>
    </Box>
  );
}
