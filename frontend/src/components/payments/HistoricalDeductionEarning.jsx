import { useState, useEffect } from 'react';
import {
  Container, SimpleGrid, Card, Title, Text, Group, Stack,
  Radio, NumberInput, Button, Select, Divider, Box,
  Table, ActionIcon, ScrollArea, Loader, Center, Badge,
  ThemeIcon, Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconRefresh, IconTrash, IconHistory,
  IconCurrencyRupee, IconCalendar, IconCheck,
} from '@tabler/icons-react';
import { historicalRuleAPI, earningDeductionAPI } from '../../services/api';

// ── Label maps ─────────────────────────────────────────────────
const COMPONENT_COLOR   = { EARNINGS: 'teal', DEDUCTIONS: 'red', BONUS: 'yellow' };
const APPLICABLE_LABEL  = { ALL_PRODUCER: 'All Producer', NON_MEMBERS: 'Non Members', MEMBERS: 'Members' };
const BASED_ON_LABEL    = { MILK_QUANTITY: 'Milk Qty', MILK_VALUE: 'Milk Value', POURING_DAYS: 'Pour Days', FIXED_AMOUNT: 'Fixed Amt' };
const POUR_TIME_LABEL   = { BOTH_SHIFTS: 'Both', MORNING_AM: 'AM', EVENING_PM: 'PM' };

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── Colored section card ────────────────────────────────────────
const SectionCard = ({ title, color, children }) => (
  <Card withBorder shadow="sm" radius="md" p={0} h="100%">
    <Box
      px="md" py="xs"
      style={{
        background:   `var(--mantine-color-${color}-6)`,
        borderRadius: '8px 8px 0 0',
      }}
    >
      <Text fw={700} size="sm" c="white">{title}</Text>
    </Box>
    <Stack px="md" py="sm" gap="xs">
      {children}
    </Stack>
  </Card>
);

// ── Main Component ─────────────────────────────────────────────
const HistoricalDeductionEarning = () => {
  // ── Filter state (top cards) ─────────────────────────────────
  const [component,    setComponent]    = useState('EARNINGS');
  const [applicableTo, setApplicableTo] = useState('ALL_PRODUCER');
  const [basedOn,      setBasedOn]      = useState('MILK_QUANTITY');
  const [pouringTime,  setPouringTime]  = useState('BOTH_SHIFTS');

  // ── Rates panel ──────────────────────────────────────────────
  const [amRate,    setAmRate]    = useState('');
  const [pmRate,    setPmRate]    = useState('');
  const [fixedRate, setFixedRate] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate,   setEndDate]   = useState(null);

  // ── Item & Apply panel ───────────────────────────────────────
  const [itemId,    setItemId]    = useState('');
  const [applyDate, setApplyDate] = useState(new Date());
  const [itemsList, setItemsList] = useState([]);

  // ── Table state ──────────────────────────────────────────────
  const [rules,   setRules]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { loadItems(); fetchRules(); }, []);

  const loadItems = async () => {
    try {
      const res = await earningDeductionAPI.getActive();
      setItemsList(
        (res.data || []).map(i => ({ value: i._id, label: i.name }))
      );
    } catch { /* silent */ }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await historicalRuleAPI.getAll({ limit: 100 });
      setRules(res.data || []);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAmRate(''); setPmRate(''); setFixedRate('');
    setStartDate(null); setEndDate(null);
    setItemId(''); setApplyDate(new Date());
  };

  const handleAdd = async () => {
    if (!itemId) {
      notifications.show({ title: 'Validation', message: 'Please select an item', color: 'orange' });
      return;
    }
    if (!startDate) {
      notifications.show({ title: 'Validation', message: 'Please enter start date', color: 'orange' });
      return;
    }

    setSaving(true);
    try {
      await historicalRuleAPI.create({
        component, applicableTo, basedOn, pouringTime,
        amRate:             amRate    || 0,
        pmRate:             pmRate    || 0,
        fixedRate:          fixedRate || 0,
        startDate,
        endDate,
        earningDeductionId: itemId,
        applyDate,
      });
      notifications.show({ title: 'Added', message: 'Historical rule saved', color: 'green' });
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
      children: <Text size="sm">Delete this historical rule? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await historicalRuleAPI.delete(id);
          notifications.show({ title: 'Deleted', message: 'Rule removed', color: 'red' });
          fetchRules();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      },
    });
  };

  return (
    <Container size="xl" py="xl">

      {/* ── Page Title ──────────────────────────────────────── */}
      <Group gap="sm" mb="lg">
        <ThemeIcon size={38} radius="md" color="blue">
          <IconHistory size={22} />
        </ThemeIcon>
        <div>
          <Title order={4} fw={700}>Common Deductions / Earnings — Historical</Title>
          <Text size="xs" c="dimmed">Configure historical earning and deduction rules for producers</Text>
        </div>
      </Group>

      {/* ── Top 4 Cards ─────────────────────────────────────── */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="lg">

        {/* 1 — Component */}
        <SectionCard title="Component" color="blue">
          <Radio.Group value={component} onChange={setComponent}>
            <Stack gap={6}>
              <Radio value="EARNINGS"   label="Earnings"   color="teal" />
              <Radio value="DEDUCTIONS" label="Deductions" color="red"  />
              <Radio value="BONUS"      label="Bonus"      color="yellow" />
            </Stack>
          </Radio.Group>
        </SectionCard>

        {/* 2 — Applicable To */}
        <SectionCard title="Applicable To" color="grape">
          <Radio.Group value={applicableTo} onChange={setApplicableTo}>
            <Stack gap={6}>
              <Radio value="ALL_PRODUCER" label="All Producer"  color="grape" />
              <Radio value="NON_MEMBERS"  label="Non Members"   color="grape" />
              <Radio value="MEMBERS"      label="Members"       color="grape" />
            </Stack>
          </Radio.Group>
        </SectionCard>

        {/* 3 — Based On */}
        <SectionCard title="Based On" color="orange">
          <Radio.Group value={basedOn} onChange={setBasedOn}>
            <Stack gap={6}>
              <Radio value="MILK_QUANTITY" label="Milk Quantity"  color="orange" />
              <Radio value="MILK_VALUE"    label="Milk Value"     color="orange" />
              <Radio value="POURING_DAYS"  label="Pouring Days"   color="orange" />
              <Radio value="FIXED_AMOUNT"  label="Fixed Amount"   color="orange" />
            </Stack>
          </Radio.Group>
        </SectionCard>

        {/* 4 — Pouring Time */}
        <SectionCard title="Pouring Time" color="teal">
          <Radio.Group value={pouringTime} onChange={setPouringTime}>
            <Stack gap={6}>
              <Radio value="BOTH_SHIFTS" label="Both Shifts"   color="teal" />
              <Radio value="MORNING_AM"  label="Morning (AM)"  color="teal" />
              <Radio value="EVENING_PM"  label="Evening (PM)"  color="teal" />
            </Stack>
          </Radio.Group>
        </SectionCard>

      </SimpleGrid>

      {/* ── Middle Two Panels ───────────────────────────────── */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="lg">

        {/* LEFT — Rates */}
        <Card withBorder shadow="sm" radius="md" p={0}>
          <Box px="md" py="xs" style={{ background: 'var(--mantine-color-green-6)', borderRadius: '8px 8px 0 0' }}>
            <Group gap="xs">
              <IconCurrencyRupee size={16} color="white" />
              <Text fw={700} size="sm" c="white">Rates</Text>
            </Group>
          </Box>
          <Stack px="md" py="md" gap="sm">
            <SimpleGrid cols={3} spacing="sm">
              <NumberInput
                label="AM Rate"
                placeholder="0.00"
                value={amRate}
                onChange={setAmRate}
                min={0}
                decimalScale={2}
                prefix="₹"
                size="sm"
              />
              <NumberInput
                label="PM Rate"
                placeholder="0.00"
                value={pmRate}
                onChange={setPmRate}
                min={0}
                decimalScale={2}
                prefix="₹"
                size="sm"
              />
              <NumberInput
                label="Fixed Rate"
                placeholder="0.00"
                value={fixedRate}
                onChange={setFixedRate}
                min={0}
                decimalScale={2}
                prefix="₹"
                size="sm"
              />
            </SimpleGrid>

            <SimpleGrid cols={2} spacing="sm">
              <DateInput
                label="Start Date"
                placeholder="dd/mm/yyyy"
                value={startDate}
                onChange={setStartDate}
                valueFormat="DD/MM/YYYY"
                leftSection={<IconCalendar size={15} />}
                size="sm"
                required
              />
              <DateInput
                label="End Date"
                placeholder="dd/mm/yyyy"
                value={endDate}
                onChange={setEndDate}
                valueFormat="DD/MM/YYYY"
                leftSection={<IconCalendar size={15} />}
                size="sm"
                clearable
              />
            </SimpleGrid>

            <Group gap="sm" mt="xs">
              <Button
                color="green"
                leftSection={<IconPlus size={15} />}
                onClick={handleAdd}
                loading={saving}
              >
                Add
              </Button>
              <Button
                color="blue"
                variant="light"
                leftSection={<IconRefresh size={15} />}
                onClick={handleReset}
              >
                Reset
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* RIGHT — Item & Apply Date */}
        <Card withBorder shadow="sm" radius="md" p={0}>
          <Box px="md" py="xs" style={{ background: 'var(--mantine-color-violet-6)', borderRadius: '8px 8px 0 0' }}>
            <Group gap="xs">
              <IconCalendar size={16} color="white" />
              <Text fw={700} size="sm" c="white">Item &amp; Apply Date</Text>
            </Group>
          </Box>
          <Stack px="md" py="md" gap="sm">
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
            <DateInput
              label="Apply Date"
              placeholder="dd/mm/yyyy"
              value={applyDate}
              onChange={setApplyDate}
              valueFormat="DD/MM/YYYY"
              leftSection={<IconCalendar size={15} />}
              size="sm"
            />
            <Group mt="xs">
              <Button
                color="blue"
                leftSection={<IconCheck size={15} />}
                onClick={handleAdd}
                loading={saving}
              >
                Apply
              </Button>
            </Group>
          </Stack>
        </Card>

      </SimpleGrid>

      {/* ── Historical Rules Table ───────────────────────────── */}
      <Card withBorder shadow="sm" radius="md" p={0}>
        <Group px="lg" py="sm" justify="space-between">
          <Group gap="xs">
            <ThemeIcon size={28} radius="sm" color="blue" variant="light">
              <IconHistory size={16} />
            </ThemeIcon>
            <Text fw={700} size="sm">Historical Rules</Text>
            <Badge color="blue" variant="light">{rules.length} rules</Badge>
          </Group>
          <ActionIcon variant="light" color="blue" onClick={fetchRules} size="md">
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>

        <Divider />

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="sm" /></Center>
          ) : rules.length === 0 ? (
            <Center py="xl"><Text c="dimmed" size="sm">No historical rules added yet</Text></Center>
          ) : (
            <Table
              striped
              highlightOnHover
              withColumnBorders
              style={{ fontSize: 12 }}
            >
              <Table.Thead>
                <Table.Tr style={{ background: 'var(--mantine-color-gray-1)' }}>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>#</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Item</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>From</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>To</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Applicable To</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Based On</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Pour Time</Table.Th>
                  <Table.Th ta="right" style={{ whiteSpace: 'nowrap' }}>AM (₹)</Table.Th>
                  <Table.Th ta="right" style={{ whiteSpace: 'nowrap' }}>PM (₹)</Table.Th>
                  <Table.Th ta="right" style={{ whiteSpace: 'nowrap' }}>Fixed (₹)</Table.Th>
                  <Table.Th style={{ whiteSpace: 'nowrap' }}>Apply Date</Table.Th>
                  <Table.Th ta="center" w={60}>Del</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rules.map((r, i) => (
                  <Table.Tr key={r._id}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Badge
                          size="xs"
                          color={COMPONENT_COLOR[r.component] || 'gray'}
                          variant="light"
                        >
                          {r.component}
                        </Badge>
                        <Text size="xs" fw={500} lineClamp={1} style={{ maxWidth: 140 }}>
                          {r.itemName || '—'}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.startDate)}</Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.endDate)}</Table.Td>
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
                    <Table.Td ta="right" fw={500} c="blue">
                      {Number(r.amRate || 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td ta="right" fw={500} c="blue">
                      {Number(r.pmRate || 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td ta="right" fw={500} c="blue">
                      {Number(r.fixedRate || 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(r.applyDate)}</Table.Td>
                    <Table.Td ta="center">
                      <Tooltip label="Delete" withArrow>
                        <ActionIcon
                          color="red"
                          variant="light"
                          size="sm"
                          onClick={() => handleDelete(r._id)}
                        >
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

export default HistoricalDeductionEarning;
