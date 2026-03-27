import { useState, useEffect } from 'react';
import {
  Container, SimpleGrid, Card, Title, Text, Group, Stack,
  Radio, NumberInput, Button, Select, Divider, Box,
  Table, ActionIcon, ScrollArea, Loader, Center, Badge,
  ThemeIcon, Checkbox, Switch, SegmentedControl, Tooltip,
  Grid, Paper,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconRefresh, IconTrash, IconRepeat,
  IconCalendar, IconCheck, IconSettings,
} from '@tabler/icons-react';
import { periodicalRuleAPI, earningDeductionAPI, collectionCenterAPI } from '../../services/api';

// ─────────────────────────────────────────────────────────────────
const OPERATOR_OPTIONS = [
  { value: '>', label: '>'  },
  { value: '<', label: '<'  },
  { value: '=', label: '='  },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
];

const BASED_ON_LABEL   = { MILK_QUANTITY: 'Milk Qty', MILK_VALUE: 'Milk Value', POURING_DAYS: 'Pour Days', FIXED_AMOUNT: 'Fixed Amt' };
const POUR_TIME_LABEL  = { BOTH_SHIFTS: 'Both', MORNING_AM: 'AM', EVENING_PM: 'PM' };
const APPLICABLE_LABEL = { ALL_PRODUCER: 'All Producer', NON_MEMBERS: 'Non Members', MEMBERS: 'Members' };
const COMPONENT_COLOR  = { EARNINGS: 'teal', DEDUCTIONS: 'red' };

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── Small card with colored header ───────────────────────────────
const TopCard = ({ title, color, children }) => (
  <Card withBorder shadow="xs" radius="md" p={0} h="100%">
    <Box
      px="md" py={6}
      style={{ background: `var(--mantine-color-${color}-6)`, borderRadius: '8px 8px 0 0' }}
    >
      <Text fw={700} size="xs" c="white" tt="uppercase" style={{ letterSpacing: '0.5px' }}>{title}</Text>
    </Box>
    <Stack px="md" py="sm" gap={6}>
      {children}
    </Stack>
  </Card>
);

// ── Criteria row ─────────────────────────────────────────────────
const CriteriaRow = ({ label, value, onChange, showLogic = true }) => (
  <Paper withBorder radius="sm" p="xs">
    <Text size="xs" fw={600} c="dimmed" mb={4}>{label}</Text>
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <Checkbox
        size="xs"
        checked={value.enabled}
        onChange={e => onChange({ ...value, enabled: e.currentTarget.checked })}
      />
      <Select
        size="xs"
        data={OPERATOR_OPTIONS}
        value={value.operator}
        onChange={v => onChange({ ...value, operator: v })}
        disabled={!value.enabled}
        style={{ width: 60 }}
        styles={{ input: { textAlign: 'center' } }}
      />
      <NumberInput
        size="xs"
        value={value.value}
        onChange={v => onChange({ ...value, value: v || 0 })}
        disabled={!value.enabled}
        min={0}
        style={{ flex: 1 }}
        placeholder="0"
      />
      {showLogic && (
        <SegmentedControl
          size="xs"
          data={['AND', 'OR']}
          value={value.logic}
          onChange={v => onChange({ ...value, logic: v })}
          disabled={!value.enabled}
          styles={{ root: { minWidth: 80 } }}
        />
      )}
    </Group>
  </Paper>
);

// ═══════════════════════════════════════════════════════════════
const PeriodicalDeductionEarning = () => {

  // ── Top card state ──────────────────────────────────────────
  const [component,    setComponent]    = useState('DEDUCTIONS');
  const [applicableTo, setApplicableTo] = useState('ALL_PRODUCER');
  const [basedOn,      setBasedOn]      = useState('MILK_QUANTITY');
  const [pouringTime,  setPouringTime]  = useState('BOTH_SHIFTS');
  const [amRate,       setAmRate]       = useState('');
  const [pmRate,       setPmRate]       = useState('');
  const [fixedRate,    setFixedRate]    = useState('');

  // ── Item & Criteria ─────────────────────────────────────────
  const [itemId,    setItemId]    = useState('');
  const [itemsList, setItemsList] = useState([]);

  const [milkQty,    setMilkQty]    = useState({ enabled: false, operator: '>', value: '', logic: 'AND' });
  const [milkValue,  setMilkValue]  = useState({ enabled: false, operator: '>', value: '', logic: 'OR'  });
  const [pouringDays, setPouringDays] = useState({ enabled: false, operator: '>', value: '' });

  // ── Collection Center ───────────────────────────────────────
  const [centerType,    setCenterType]    = useState('PRODUCER_CENTER');
  const [centers,       setCenters]       = useState([]);
  const [selectedCenters, setSelectedCenters] = useState([]);
  const [allCenters,    setAllCenters]    = useState(false);

  // ── Amount Limit ────────────────────────────────────────────
  const [amtLimitEnabled, setAmtLimitEnabled] = useState(false);
  const [amtLimitValue,   setAmtLimitValue]   = useState('');
  const [amtLimitPeriod,  setAmtLimitPeriod]  = useState('APPLYING_PERIOD');

  // ── Confirmation ────────────────────────────────────────────
  const [wefDate,     setWefDate]     = useState(new Date());
  const [applyPeriod, setApplyPeriod] = useState('EACH_PERIOD');

  // ── Table ───────────────────────────────────────────────────
  const [rules,   setRules]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    loadItems();
    loadCenters();
    fetchRules();
  }, []);

  const loadItems = async () => {
    try {
      const res = await earningDeductionAPI.getActive();
      setItemsList((res.data || []).filter(i => i && i._id).map(i => ({ value: String(i._id), label: i.name || '(Unnamed)' })));
    } catch { /* silent */ }
  };

  const loadCenters = async () => {
    try {
      const res = await collectionCenterAPI.getAll({ limit: 200 });
      setCenters(res.data || []);
    } catch { /* silent */ }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await periodicalRuleAPI.getAll({ limit: 100 });
      setRules(res.data || []);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAll = (checked) => {
    setAllCenters(checked);
    setSelectedCenters(checked ? centers.map(c => c._id) : []);
  };

  const toggleCenter = (id) => {
    setSelectedCenters(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    setAmRate(''); setPmRate(''); setFixedRate('');
    setItemId('');
    setMilkQty({ enabled: false, operator: '>', value: '', logic: 'AND' });
    setMilkValue({ enabled: false, operator: '>', value: '', logic: 'OR' });
    setPouringDays({ enabled: false, operator: '>', value: '' });
    setSelectedCenters([]); setAllCenters(false);
    setAmtLimitEnabled(false); setAmtLimitValue('');
    setWefDate(new Date());
  };

  const handleApply = async () => {
    if (!itemId) {
      notifications.show({ title: 'Validation', message: 'Please select an item', color: 'orange' });
      return;
    }

    setSaving(true);
    try {
      await periodicalRuleAPI.create({
        component, applicableTo, basedOn, pouringTime,
        amRate: amRate || 0, pmRate: pmRate || 0, fixedRate: fixedRate || 0,
        earningDeductionId: itemId,
        criteria: {
          milkQty:    { ...milkQty,    value: milkQty.value    || 0 },
          milkValue:  { ...milkValue,  value: milkValue.value  || 0 },
          pouringDays: { ...pouringDays, value: pouringDays.value || 0 },
        },
        collectionCenterType: centerType,
        collectionCenterIds:  selectedCenters,
        allCenters,
        amountLimit: {
          enabled: amtLimitEnabled,
          amount:  amtLimitValue || 0,
          period:  amtLimitPeriod,
        },
        wefDate,
        applyPeriod,
      });
      notifications.show({ title: 'Applied', message: 'Periodical rule saved successfully', color: 'green' });
      handleReset();
      fetchRules();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    modals.openConfirmModal({
      title: 'Delete Rule',
      children: <Text size="sm">Delete this periodical rule?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await periodicalRuleAPI.delete(id);
          notifications.show({ title: 'Deleted', message: 'Rule removed', color: 'red' });
          fetchRules();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      },
    });
  };

  const handleToggleStatus = async (id) => {
    try {
      await periodicalRuleAPI.toggleStatus(id);
      fetchRules();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  return (
    <Container size="xl" py="xl">

      {/* ── Page Title ──────────────────────────────────────── */}
      <Group gap="sm" mb="lg">
        <ThemeIcon size={38} radius="md" color="indigo">
          <IconRepeat size={22} />
        </ThemeIcon>
        <div>
          <Title order={4} fw={700}>Common Deductions / Earnings — Periodical</Title>
          <Text size="xs" c="dimmed">Configure recurring earning and deduction rules for producers</Text>
        </div>
      </Group>

      {/* ══════════════ TOP ROW — 5 Cards ══════════════════════ */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm" mb="lg">

        <TopCard title="Select Component" color="blue">
          <Radio.Group value={component} onChange={setComponent}>
            <Stack gap={5}>
              <Radio value="DEDUCTIONS" label={<Text size="sm">Deductions</Text>} color="red"  />
              <Radio value="EARNINGS"   label={<Text size="sm">Earnings</Text>}   color="teal" />
            </Stack>
          </Radio.Group>
        </TopCard>

        <TopCard title="Applicable To" color="grape">
          <Radio.Group value={applicableTo} onChange={setApplicableTo}>
            <Stack gap={5}>
              <Radio value="ALL_PRODUCER" label={<Text size="sm">All Producer</Text>}  color="grape" />
              <Radio value="NON_MEMBERS"  label={<Text size="sm">Non Members</Text>}   color="grape" />
              <Radio value="MEMBERS"      label={<Text size="sm">Members</Text>}        color="grape" />
            </Stack>
          </Radio.Group>
        </TopCard>

        <TopCard title="Based On" color="orange">
          <Radio.Group value={basedOn} onChange={setBasedOn}>
            <Stack gap={5}>
              <Radio value="MILK_QUANTITY" label={<Text size="sm">Milk Quantity</Text>}  color="orange" />
              <Radio value="MILK_VALUE"    label={<Text size="sm">Milk Value</Text>}     color="orange" />
              <Radio value="POURING_DAYS"  label={<Text size="sm">Pouring Days</Text>}   color="orange" />
              <Radio value="FIXED_AMOUNT"  label={<Text size="sm">Fixed Amount</Text>}   color="orange" />
            </Stack>
          </Radio.Group>
        </TopCard>

        <TopCard title="Pouring Time" color="teal">
          <Radio.Group value={pouringTime} onChange={setPouringTime}>
            <Stack gap={5}>
              <Radio value="BOTH_SHIFTS" label={<Text size="sm">Both Shifts</Text>}   color="teal" />
              <Radio value="MORNING_AM"  label={<Text size="sm">Morning (AM)</Text>}  color="teal" />
              <Radio value="EVENING_PM"  label={<Text size="sm">Evening (PM)</Text>}  color="teal" />
            </Stack>
          </Radio.Group>
        </TopCard>

        <TopCard title="Entry Rate" color="green">
          <Stack gap={5}>
            <NumberInput
              label={<Text size="xs" fw={600}>AM Rate</Text>}
              placeholder="0.00"
              value={amRate}
              onChange={setAmRate}
              min={0} decimalScale={2} prefix="₹"
              size="xs"
            />
            <NumberInput
              label={<Text size="xs" fw={600}>PM Rate</Text>}
              placeholder="0.00"
              value={pmRate}
              onChange={setPmRate}
              min={0} decimalScale={2} prefix="₹"
              size="xs"
            />
            <NumberInput
              label={<Text size="xs" fw={600}>Fixed Rate</Text>}
              placeholder="0.00"
              value={fixedRate}
              onChange={setFixedRate}
              min={0} decimalScale={2} prefix="₹"
              size="xs"
            />
          </Stack>
        </TopCard>

      </SimpleGrid>

      {/* ══════════════ SECOND ROW — 3 panels ══════════════════ */}
      <Grid gutter="md" mb="lg">

        {/* ── LEFT: Item + Criteria ───────────────────────────── */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder shadow="sm" radius="md" p={0} h="100%">
            <Box px="md" py={6} style={{ background: 'var(--mantine-color-blue-6)', borderRadius: '8px 8px 0 0' }}>
              <Text fw={700} size="xs" c="white" tt="uppercase">Select Item &amp; Criteria</Text>
            </Box>
            <Stack px="md" py="md" gap="md">
              <Select
                label="Item"
                placeholder="Select earning / deduction item"
                data={itemsList}
                value={itemId}
                onChange={v => setItemId(v || '')}
                searchable
                size="sm"
                required
              />

              <Divider label="Criteria" labelPosition="center" />

              <CriteriaRow
                label="Milk Quantity"
                value={milkQty}
                onChange={setMilkQty}
                showLogic
              />
              <CriteriaRow
                label="Milk Value"
                value={milkValue}
                onChange={setMilkValue}
                showLogic
              />
              <CriteriaRow
                label="Pouring Days"
                value={pouringDays}
                onChange={setPouringDays}
                showLogic={false}
              />
            </Stack>
          </Card>
        </Grid.Col>

        {/* ── CENTER: Collection Center ────────────────────────── */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder shadow="sm" radius="md" p={0} h="100%">
            <Box px="md" py={6} style={{ background: 'var(--mantine-color-cyan-6)', borderRadius: '8px 8px 0 0' }}>
              <Text fw={700} size="xs" c="white" tt="uppercase">Select Collection Center</Text>
            </Box>
            <Stack px="md" py="md" gap="sm">
              <Radio.Group value={centerType} onChange={setCenterType}>
                <Group gap="md">
                  <Radio value="PRODUCER_CENTER" label={<Text size="sm">Producer's Center</Text>} color="cyan" />
                  <Radio value="POURING_CENTER"  label={<Text size="sm">Pouring Center</Text>}    color="cyan" />
                </Group>
              </Radio.Group>

              <Divider />

              {/* Check All */}
              <Checkbox
                size="sm"
                label={<Text size="sm" fw={600}>Check All</Text>}
                checked={allCenters}
                onChange={e => handleCheckAll(e.currentTarget.checked)}
                color="cyan"
              />

              {/* Scrollable center list */}
              <ScrollArea h={180} type="auto">
                <Stack gap={4}>
                  {centers.length === 0 ? (
                    <Text size="xs" c="dimmed">No collection centers found</Text>
                  ) : (
                    centers.map(c => (
                      <Checkbox
                        key={c._id}
                        size="xs"
                        label={<Text size="xs">{c.centerName || c.name || c._id}</Text>}
                        checked={selectedCenters.includes(c._id)}
                        onChange={() => toggleCenter(c._id)}
                        color="cyan"
                      />
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Card>
        </Grid.Col>

        {/* ── RIGHT: Amount Limit + Confirmation ──────────────── */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md" h="100%">

            {/* Amount Limit */}
            <Card withBorder shadow="sm" radius="md" p={0}>
              <Box px="md" py={6} style={{ background: 'var(--mantine-color-yellow-6)', borderRadius: '8px 8px 0 0' }}>
                <Text fw={700} size="xs" c="white" tt="uppercase">Amount Limit</Text>
              </Box>
              <Stack px="md" py="md" gap="sm">
                <Checkbox
                  size="sm"
                  label={<Text size="sm">Amount do not exceed over</Text>}
                  checked={amtLimitEnabled}
                  onChange={e => setAmtLimitEnabled(e.currentTarget.checked)}
                  color="yellow"
                />
                <NumberInput
                  placeholder="Enter limit amount"
                  value={amtLimitValue}
                  onChange={setAmtLimitValue}
                  disabled={!amtLimitEnabled}
                  min={0}
                  decimalScale={2}
                  prefix="₹"
                  size="sm"
                />
                <Radio.Group value={amtLimitPeriod} onChange={setAmtLimitPeriod}>
                  <Stack gap={5}>
                    <Radio
                      value="APPLYING_PERIOD"
                      label={<Text size="xs">For Applying Period</Text>}
                      disabled={!amtLimitEnabled}
                      color="yellow"
                    />
                    <Radio
                      value="WHOLE_PERIOD"
                      label={<Text size="xs">For Whole Period (Including Previous)</Text>}
                      disabled={!amtLimitEnabled}
                      color="yellow"
                    />
                  </Stack>
                </Radio.Group>
              </Stack>
            </Card>

            {/* Confirmation */}
            <Card withBorder shadow="sm" radius="md" p={0} style={{ flex: 1 }}>
              <Box px="md" py={6} style={{ background: 'var(--mantine-color-indigo-6)', borderRadius: '8px 8px 0 0' }}>
                <Group gap="xs">
                  <IconSettings size={14} color="white" />
                  <Text fw={700} size="xs" c="white" tt="uppercase">Confirmation</Text>
                </Group>
              </Box>
              <Stack px="md" py="md" gap="sm">
                <DateInput
                  label="With Effect From"
                  placeholder="dd/mm/yyyy"
                  value={wefDate}
                  onChange={setWefDate}
                  valueFormat="DD/MM/YYYY"
                  leftSection={<IconCalendar size={15} />}
                  size="sm"
                  required
                />
                <Radio.Group value={applyPeriod} onChange={setApplyPeriod}>
                  <Stack gap={5}>
                    <Radio value="EACH_PERIOD"   label={<Text size="xs">Apply on Each Processing Period</Text>} color="indigo" />
                    <Radio value="ONCE_IN_MONTH" label={<Text size="xs">Apply Once in Month</Text>}             color="indigo" />
                  </Stack>
                </Radio.Group>
                <Group gap="sm" mt="xs">
                  <Button
                    color="blue"
                    leftSection={<IconCheck size={15} />}
                    onClick={handleApply}
                    loading={saving}
                  >
                    Apply
                  </Button>
                  <Button variant="light" color="gray" leftSection={<IconRefresh size={15} />} onClick={handleReset}>
                    Reset
                  </Button>
                </Group>
              </Stack>
            </Card>

          </Stack>
        </Grid.Col>
      </Grid>

      {/* ══════════════ BOTTOM — Details Table ══════════════════ */}
      <Card withBorder shadow="sm" radius="md" p={0}>
        <Group px="lg" py="sm" justify="space-between">
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="indigo" variant="light">
              <IconRepeat size={16} />
            </ThemeIcon>
            <Text fw={700} size="sm">Periodical Rules</Text>
            <Badge color="indigo" variant="light">{rules.length} rules</Badge>
          </Group>
          <ActionIcon variant="light" color="indigo" onClick={fetchRules} size="md">
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>

        <Divider />

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="sm" /></Center>
          ) : rules.length === 0 ? (
            <Center py="xl"><Text c="dimmed" size="sm">No periodical rules configured yet</Text></Center>
          ) : (
            <Table striped highlightOnHover withColumnBorders style={{ fontSize: 12 }}>
              <Table.Thead>
                <Table.Tr style={{ background: 'var(--mantine-color-gray-1)' }}>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Item</Table.Th>
                  <Table.Th>Applicable</Table.Th>
                  <Table.Th>Based On</Table.Th>
                  <Table.Th>Pour Time</Table.Th>
                  <Table.Th ta="right">AM (₹)</Table.Th>
                  <Table.Th ta="right">PM (₹)</Table.Th>
                  <Table.Th ta="right">Fixed (₹)</Table.Th>
                  <Table.Th>WEF</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th ta="center">Status</Table.Th>
                  <Table.Th ta="center" w={50}>Del</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rules.map((r, i) => (
                  <Table.Tr key={r._id}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={COMPONENT_COLOR[r.component] || 'gray'} variant="light">
                        {r.component}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={500} lineClamp={1} style={{ maxWidth: 130 }}>
                        {r.itemName || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="grape" variant="light">
                        {APPLICABLE_LABEL[r.applicableTo] || r.applicableTo}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="orange" variant="light">
                        {BASED_ON_LABEL[r.basedOn] || r.basedOn}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="teal" variant="light">
                        {POUR_TIME_LABEL[r.pouringTime] || r.pouringTime}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right" fw={500}>{Number(r.amRate || 0).toFixed(2)}</Table.Td>
                    <Table.Td ta="right" fw={500}>{Number(r.pmRate || 0).toFixed(2)}</Table.Td>
                    <Table.Td ta="right" fw={500}>{Number(r.fixedRate || 0).toFixed(2)}</Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.wefDate)}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" color="indigo" variant="light">
                        {r.applyPeriod === 'EACH_PERIOD' ? 'Each Period' : 'Once/Month'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge
                        size="xs"
                        color={r.active ? 'green' : 'gray'}
                        variant="light"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleStatus(r._id)}
                      >
                        {r.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Tooltip label="Delete" withArrow>
                        <ActionIcon color="red" variant="light" size="sm" onClick={() => handleDelete(r._id)}>
                          <IconTrash size={13} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea>
      </Card>
    </Container>
  );
};

export default PeriodicalDeductionEarning;
