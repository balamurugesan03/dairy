import { useState, useEffect, useCallback } from 'react';
import {
  Container, Group, Title, Button, TextInput, Select,
  Modal, Stack, Text, Badge, NumberInput, ActionIcon,
  Pagination, Paper, Table, Tooltip, Box, Divider,
  Grid, ThemeIcon, Checkbox, SegmentedControl,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm }         from '@mantine/form';
import { notifications }   from '@mantine/notifications';
import { modals }          from '@mantine/modals';
import {
  IconPlus, IconEdit, IconTrash, IconSearch,
  IconRefresh, IconToggleLeft, IconMilk, IconCalendarEvent,
} from '@tabler/icons-react';
import { shiftIncentiveAPI, collectionCenterAPI } from '../../services/api';

const PAGE_SIZE = 15;

const EMPTY_FORM = {
  shiftAm:        true,
  shiftPm:        false,
  center:         '',
  applicableType: 'ALL',
  listText:       '',
  startDate:      null,
  endDate:        null,
  noEndDate:      true,
  rateBased:       { enabled: false, qty: false, amount: false, rate: 0 },
  percentageBased: { enabled: false, qty: false, amount: false, rate: 0 },
  parameterBased: {
    enabled:     false,
    belowFat:    0,
    belowSnf:    0,
    belowAmount: 0,
    aboveFat:    0,
    aboveSnf:    0,
    aboveAmount: 0,
  },
  status: true,
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

// ── Reusable section card with enable checkbox ───────────────
function SectionCard({ enabled, onToggle, title, children, blocked }) {
  return (
    <Paper
      withBorder
      radius="xs"
      style={{
        borderColor:  enabled ? '#228be6' : blocked ? '#f1f3f5' : '#dee2e6',
        background:   blocked && !enabled ? '#f8f9fa' : 'white',
        overflow:     'hidden',
        transition:   'border-color 0.15s',
        opacity:      blocked && !enabled ? 0.5 : 1,
      }}
    >
      {/* Card header with enable checkbox */}
      <Box
        px="sm"
        py={7}
        style={{
          background:   enabled ? '#e8f0fe' : '#f8f9fa',
          borderBottom: enabled ? '1px solid #c5d8fd' : '1px solid #e9ecef',
        }}
      >
        <Checkbox
          checked={enabled}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          color="blue"
          size="sm"
          disabled={blocked && !enabled}
          label={
            <Text fw={600} size="sm" c={enabled ? 'blue.8' : blocked ? '#adb5bd' : 'dimmed'}>
              {title}{blocked && !enabled ? ' (locked)' : ''}
            </Text>
          }
        />
      </Box>

      {/* Card body — always rendered, dims when disabled */}
      <Box
        px="sm"
        py="xs"
        style={{ opacity: enabled ? 1 : 0.4, pointerEvents: enabled ? 'auto' : 'none' }}
      >
        {children}
      </Box>
    </Paper>
  );
}

// ── Compact number input helper ───────────────────────────────
function NumBox({ value, onChange }) {
  return (
    <NumberInput
      size="xs"
      value={value}
      onChange={(v) => onChange(v ?? 0)}
      decimalScale={2}
      min={0}
      hideControls
      styles={{
        input: {
          width:      68,
          textAlign:  'center',
          fontFamily: 'monospace',
          padding:    '0 6px',
        },
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════════
//  Main Component
// ════════════════════════════════════════════════════════════════
export default function ShiftIncentiveList() {
  // ── List state ───────────────────────────────────────────────
  const [records, setRecords]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [filterShift, setFilterShift]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [listLoading, setListLoading]   = useState(false);
  const [centerOptions, setCenterOptions] = useState([]);

  // ── Modal state ──────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving]         = useState(false);

  const form = useForm({ initialValues: EMPTY_FORM });
  const v    = form.values;

  // ── Load collection centers ──────────────────────────────────
  useEffect(() => {
    collectionCenterAPI.getAll({ limit: 500, status: 'Active' })
      .then(res => {
        const list = res.data || [];
        setCenterOptions(list.map(c => ({ value: c.centerName, label: c.centerName })));
      })
      .catch(() => {});
  }, []);

  // Auto-fill center when modal opens and options are available
  useEffect(() => {
    if (modalOpen && !editRecord && centerOptions.length > 0 && !form.values.center) {
      form.setFieldValue('center', centerOptions[0].value);
    }
  }, [modalOpen, centerOptions]); // eslint-disable-line

  // ── Fetch records ────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (search)         params.search = search;
      if (filterShift)    params.shift  = filterShift;
      if (filterStatus !== '') params.status = filterStatus;

      const res = await shiftIncentiveAPI.getAll(params);
      setRecords(res.data        || []);
      setTotal(res.total         || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Error', message: e.message || 'Failed to load' });
    } finally {
      setListLoading(false);
    }
  }, [page, search, filterShift, filterStatus]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── Open Add ─────────────────────────────────────────────────
  const openAdd = () => {
    setEditRecord(null);
    // Auto-fill center: pick the first (or only) center available
    const defaultCenter = centerOptions.length > 0 ? centerOptions[0].value : '';
    form.setValues({ ...EMPTY_FORM, center: defaultCenter });
    setModalOpen(true);
  };

  // ── Open Edit ────────────────────────────────────────────────
  const openEdit = (rec) => {
    setEditRecord(rec);
    const s = rec.shift || 'AM';
    form.setValues({
      shiftAm:        s === 'AM' || s === 'BOTH',
      shiftPm:        s === 'PM' || s === 'BOTH',
      center:         rec.center         || '',
      applicableType: rec.applicableType || 'ALL',
      listText:       rec.listText       || '',
      startDate:      rec.startDate ? new Date(rec.startDate) : null,
      endDate:        rec.endDate   ? new Date(rec.endDate)   : null,
      noEndDate:      !rec.endDate,
      rateBased: {
        enabled: rec.rateBased?.enabled ?? false,
        qty:     rec.rateBased?.qty     ?? false,
        amount:  rec.rateBased?.amount  ?? false,
        rate:    rec.rateBased?.rate    ?? 0,
      },
      percentageBased: {
        enabled: rec.percentageBased?.enabled ?? false,
        qty:     rec.percentageBased?.qty     ?? false,
        amount:  rec.percentageBased?.amount  ?? false,
        rate:    rec.percentageBased?.rate    ?? 0,
      },
      parameterBased: {
        enabled:     rec.parameterBased?.enabled     ?? false,
        belowFat:    rec.parameterBased?.belowFat    ?? 0,
        belowSnf:    rec.parameterBased?.belowSnf    ?? 0,
        belowAmount: rec.parameterBased?.belowAmount ?? 0,
        aboveFat:    rec.parameterBased?.aboveFat    ?? 0,
        aboveSnf:    rec.parameterBased?.aboveSnf    ?? 0,
        aboveAmount: rec.parameterBased?.aboveAmount ?? 0,
      },
      status: rec.status ?? true,
    });
    setModalOpen(true);
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (values) => {
    if (!values.center) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Center is required' });
      return;
    }
    if (!values.startDate) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Start date is required' });
      return;
    }
    if (!values.noEndDate && !values.endDate) {
      notifications.show({ color: 'red', title: 'Validation', message: 'End date is required (or check No End Date)' });
      return;
    }
    const shiftVal = values.shiftAm && values.shiftPm ? 'BOTH' : values.shiftAm ? 'AM' : values.shiftPm ? 'PM' : null;
    if (!shiftVal) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Select at least AM or PM shift' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        shift:          shiftVal,
        center:         values.center,
        applicableType: values.applicableType,
        listText:       values.listText,
        startDate:      values.startDate instanceof Date ? values.startDate.toISOString() : values.startDate,
        endDate:        values.noEndDate ? null : (values.endDate instanceof Date ? values.endDate.toISOString() : values.endDate),
        rateBased:       values.rateBased,
        percentageBased: values.percentageBased,
        parameterBased:  values.parameterBased,
        status:          values.status,
      };

      if (editRecord) {
        await shiftIncentiveAPI.update(editRecord._id, payload);
        notifications.show({ color: 'green', title: 'Updated', message: 'Shift incentive updated' });
      } else {
        await shiftIncentiveAPI.create(payload);
        notifications.show({ color: 'green', title: 'Created', message: 'Shift incentive created' });
      }
      setModalOpen(false);
      setPage(1);
      fetchRecords();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Save Failed', message: e.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle status ────────────────────────────────────────────
  const handleToggleStatus = async (rec) => {
    try {
      await shiftIncentiveAPI.toggleStatus(rec._id);
      notifications.show({
        color:   rec.status ? 'orange' : 'green',
        title:   rec.status ? 'Deactivated' : 'Activated',
        message: `Shift incentive is now ${rec.status ? 'Inactive' : 'Active'}`,
      });
      fetchRecords();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Error', message: e.message });
    }
  };

  // ── Soft delete ──────────────────────────────────────────────
  const handleDelete = (rec) => {
    modals.openConfirmModal({
      title:    'Deactivate Shift Incentive',
      centered: true,
      children: (
        <Text size="sm">
          Deactivate incentive for <strong>{rec.center}</strong> ({rec.shift || 'AM/PM'})?
        </Text>
      ),
      labels:       { confirm: 'Deactivate', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await shiftIncentiveAPI.delete(rec._id);
          notifications.show({ color: 'orange', title: 'Deactivated', message: 'Record set to Inactive' });
          fetchRecords();
        } catch (e) {
          notifications.show({ color: 'red', title: 'Error', message: e.message });
        }
      },
    });
  };

  // ── Table rows ────────────────────────────────────────────────
  const shiftColor = (s) => s === 'AM' ? 'yellow' : s === 'PM' ? 'indigo' : 'teal';

  const activeSections = (rec) =>
    [
      rec.rateBased?.enabled       && 'Rate',
      rec.percentageBased?.enabled && '%',
      rec.parameterBased?.enabled  && 'Param',
    ].filter(Boolean).join(', ') || '—';

  const rows = records.map((rec, i) => (
    <Table.Tr key={rec._id}>
      <Table.Td c="dimmed" fz="sm">{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
      <Table.Td>
        <Badge color={shiftColor(rec.shift)} variant="filled" size="sm" radius="sm">
          {rec.shift}
        </Badge>
      </Table.Td>
      <Table.Td fw={600}>{rec.center}</Table.Td>
      <Table.Td>
        <Badge color={rec.applicableType === 'ALL' ? 'teal' : 'grape'} variant="light" size="sm">
          {rec.applicableType}
        </Badge>
      </Table.Td>
      <Table.Td fz="xs">{activeSections(rec)}</Table.Td>
      <Table.Td fz="sm" c="dimmed">{fmtDate(rec.startDate)}</Table.Td>
      <Table.Td fz="sm" c="dimmed">{fmtDate(rec.endDate)}</Table.Td>
      <Table.Td>
        <Badge color={rec.status ? 'green' : 'gray'} variant="dot" size="sm">
          {rec.status ? 'Active' : 'Inactive'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon variant="light" color="blue" size="sm" onClick={() => openEdit(rec)}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={rec.status ? 'Deactivate' : 'Activate'}>
            <ActionIcon
              variant="light"
              color={rec.status ? 'orange' : 'green'}
              size="sm"
              onClick={() => handleToggleStatus(rec)}
            >
              <IconToggleLeft size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(rec)}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  // ── Render ────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      <Paper shadow="sm" radius="md" p="lg" withBorder>

        {/* Header */}
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" color="blue" variant="light">
              <IconMilk size={22} />
            </ThemeIcon>
            <Box>
              <Title order={3} lh={1}>Shift Incentive</Title>
              <Text size="xs" c="dimmed">Manage AM / PM milk collection shift incentives</Text>
            </Box>
          </Group>
          <Group gap="sm">
            <Text size="sm" c="dimmed" fw={500}>{total} records</Text>
            <Button leftSection={<IconPlus size={16} />} color="blue" radius="md" onClick={openAdd}>
              Add Incentive
            </Button>
          </Group>
        </Group>

        <Divider mb="md" />

        {/* Filters */}
        <Grid mb="md" gutter="sm">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              placeholder="Search by center..."
              leftSection={<IconSearch size={15} />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 2 }}>
            <Select
              placeholder="Shift"
              data={[
                { value: '', label: 'All Shifts' },
                { value: 'AM', label: 'AM' },
                { value: 'PM', label: 'PM' },
                { value: 'BOTH', label: 'BOTH' },
              ]}
              value={filterShift}
              onChange={(v) => { setFilterShift(v || ''); setPage(1); }}
              radius="md"
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 2 }}>
            <Select
              placeholder="Status"
              data={[
                { value: '', label: 'All' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={filterStatus}
              onChange={(v) => { setFilterStatus(v ?? ''); setPage(1); }}
              radius="md"
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 1 }}>
            <Tooltip label="Refresh">
              <ActionIcon
                variant="light" color="blue" size="lg"
                onClick={fetchRecords} loading={listLoading}
                radius="md" style={{ width: '100%', height: 36 }}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Grid.Col>
        </Grid>

        {/* Table */}
        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={50}>Sl.No</Table.Th>
                <Table.Th w={70}>Shift</Table.Th>
                <Table.Th>Center</Table.Th>
                <Table.Th w={90}>Applicable</Table.Th>
                <Table.Th>Sections</Table.Th>
                <Table.Th>Start Date</Table.Th>
                <Table.Th>End Date</Table.Th>
                <Table.Th w={90}>Status</Table.Th>
                <Table.Th w={100}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {listLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">Loading...</Table.Td>
                </Table.Tr>
              ) : rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">
                    No shift incentives found.{' '}
                    <Text span c="blue" style={{ cursor: 'pointer' }} onClick={openAdd}>
                      Add the first one.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : rows}
            </Table.Tbody>
          </Table>
        </Box>

        {totalPages > 1 && (
          <Group justify="center" mt="lg">
            <Pagination total={totalPages} value={page} onChange={setPage} color="blue" radius="md" size="sm" />
          </Group>
        )}
      </Paper>

      {/* ══════════════════════════════════════════════════════════
           ADD / EDIT MODAL — ERP form layout
        ══════════════════════════════════════════════════════════ */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <Text fw={700} size="sm" c="blue.9">
            {editRecord ? 'Edit Shift Incentive' : 'Shift Incentive'}
          </Text>
        }
        size="lg"
        centered
        radius="sm"
        scrollAreaComponent="div"
        styles={{
          header: {
            background:   '#e8f0fe',
            borderBottom: '1px solid #c5d8fd',
            padding:      '10px 16px',
            minHeight:    'unset',
          },
          body: {
            background: '#f2f4f7',
            padding:    '10px',
          },
        }}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap={8}>

            {/* ── Top section: Shift + Center + Applicable ── */}
            <Paper withBorder radius="xs" bg="white" p="sm">
              <Grid gutter="sm" align="flex-end">
                {/* Shift AM / PM checkboxes */}
                <Grid.Col span="content">
                  <Text size="xs" fw={500} c="dimmed" mb={6}>Shift</Text>
                  <Group gap="md" align="center">
                    <Checkbox
                      label={<Text size="sm" fw={600} c="yellow.7">AM</Text>}
                      checked={v.shiftAm}
                      onChange={() => { form.setFieldValue('shiftAm', true); form.setFieldValue('shiftPm', false); }}
                      color="yellow"
                      size="sm"
                    />
                    <Checkbox
                      label={<Text size="sm" fw={600} c="indigo.7">PM</Text>}
                      checked={v.shiftPm}
                      onChange={() => { form.setFieldValue('shiftPm', true); form.setFieldValue('shiftAm', false); }}
                      color="indigo"
                      size="sm"
                    />
                  </Group>
                </Grid.Col>

                {/* Center dropdown */}
                <Grid.Col span="auto">
                  <Select
                    label="Center"
                    placeholder="Select center"
                    data={centerOptions}
                    value={v.center}
                    onChange={(val) => form.setFieldValue('center', val || '')}
                    size="xs"
                    radius="sm"
                    searchable
                    required
                    nothingFoundMessage="No centers found"
                  />
                </Grid.Col>

                {/* Applicable type */}
                <Grid.Col span="content">
                  <Select
                    label="Applicable"
                    data={[{ value: 'ALL', label: 'ALL' }, { value: 'LIST', label: 'LIST' }]}
                    value={v.applicableType}
                    onChange={(val) => form.setFieldValue('applicableType', val)}
                    size="xs"
                    radius="sm"
                    style={{ width: 86 }}
                  />
                </Grid.Col>
              </Grid>

              {/* List text — shown when LIST selected */}
              {v.applicableType === 'LIST' && (
                <TextInput
                  mt="xs"
                  label="List"
                  placeholder="Enter farmer IDs or names..."
                  value={v.listText}
                  onChange={(e) => form.setFieldValue('listText', e.target.value)}
                  size="xs"
                  radius="sm"
                />
              )}
            </Paper>

            {/* ── Date range ── */}
            <Paper withBorder radius="xs" bg="white" p="sm">
              <Grid gutter="sm">
                <Grid.Col span={6}>
                  <DatePickerInput
                    label="Start Date"
                    placeholder="DD/MM/YYYY"
                    value={v.startDate}
                    onChange={(val) => form.setFieldValue('startDate', val)}
                    valueFormat="DD/MM/YYYY"
                    leftSection={<IconCalendarEvent size={13} />}
                    size="xs"
                    radius="sm"
                    clearable
                    required
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group gap={6} align="center" mb={4}>
                    <Checkbox
                      label={<Text size="xs" fw={500}>Set End Date</Text>}
                      checked={!v.noEndDate}
                      onChange={(e) => {
                        const hasEnd = e.currentTarget.checked;
                        form.setFieldValue('noEndDate', !hasEnd);
                        if (!hasEnd) form.setFieldValue('endDate', null);
                      }}
                      color="blue"
                      size="xs"
                    />
                  </Group>
                  <DatePickerInput
                    placeholder="DD/MM/YYYY"
                    value={v.noEndDate ? null : v.endDate}
                    onChange={(val) => form.setFieldValue('endDate', val)}
                    valueFormat="DD/MM/YYYY"
                    leftSection={<IconCalendarEvent size={13} />}
                    size="xs"
                    radius="sm"
                    clearable
                    disabled={v.noEndDate}
                    minDate={v.startDate || undefined}
                  />
                </Grid.Col>
              </Grid>
            </Paper>

            {/* ── Section 1: Based on Rate ── */}
            <SectionCard
              enabled={v.rateBased.enabled}
              onToggle={(val) => {
                form.setFieldValue('rateBased.enabled', val);
                if (val) {
                  form.setFieldValue('percentageBased.enabled', false);
                  form.setFieldValue('parameterBased.enabled', false);
                }
              }}
              blocked={v.percentageBased.enabled || v.parameterBased.enabled}
              title="Based on Rate"
            >
              <Group gap="xl" align="center" wrap="nowrap">
                <Checkbox
                  label="Qty"
                  checked={v.rateBased.qty}
                  disabled={v.rateBased.amount}
                  onChange={(e) => form.setFieldValue('rateBased.qty', e.currentTarget.checked)}
                  color="blue"
                  size="sm"
                />
                <Checkbox
                  label="Amount"
                  checked={v.rateBased.amount}
                  disabled={v.rateBased.qty}
                  onChange={(e) => form.setFieldValue('rateBased.amount', e.currentTarget.checked)}
                  color="blue"
                  size="sm"
                />
                <Group gap="xs" align="center" ml="auto">
                  <Text size="sm" fw={500} c="dimmed">Rate</Text>
                  <NumBox
                    value={v.rateBased.rate}
                    onChange={(val) => form.setFieldValue('rateBased.rate', val)}
                  />
                </Group>
              </Group>
            </SectionCard>

            {/* ── Section 2: Based on Percentage ── */}
            <SectionCard
              enabled={v.percentageBased.enabled}
              onToggle={(val) => {
                form.setFieldValue('percentageBased.enabled', val);
                if (val) {
                  form.setFieldValue('rateBased.enabled', false);
                  form.setFieldValue('parameterBased.enabled', false);
                }
              }}
              blocked={v.rateBased.enabled || v.parameterBased.enabled}
              title="Based on Percentage (%)"
            >
              <Group gap="xl" align="center" wrap="nowrap">
                <Checkbox
                  label="Qty"
                  checked={v.percentageBased.qty}
                  disabled={v.percentageBased.amount}
                  onChange={(e) => form.setFieldValue('percentageBased.qty', e.currentTarget.checked)}
                  color="blue"
                  size="sm"
                />
                <Checkbox
                  label="Amount"
                  checked={v.percentageBased.amount}
                  disabled={v.percentageBased.qty}
                  onChange={(e) => form.setFieldValue('percentageBased.amount', e.currentTarget.checked)}
                  color="blue"
                  size="sm"
                />
                <Group gap="xs" align="center" ml="auto">
                  <Text size="sm" fw={500} c="dimmed">% Rate</Text>
                  <NumBox
                    value={v.percentageBased.rate}
                    onChange={(val) => form.setFieldValue('percentageBased.rate', val)}
                  />
                </Group>
              </Group>
            </SectionCard>

            {/* ── Section 3: Based on Parameter ── */}
            <SectionCard
              enabled={v.parameterBased.enabled}
              onToggle={(val) => {
                form.setFieldValue('parameterBased.enabled', val);
                if (val) {
                  form.setFieldValue('rateBased.enabled', false);
                  form.setFieldValue('percentageBased.enabled', false);
                }
              }}
              blocked={v.rateBased.enabled || v.percentageBased.enabled}
              title="Based on Parameter"
            >
              {/* Two-column parameter grid */}
              <Box
                style={{
                  display:       'grid',
                  gridTemplateColumns: '1fr 1fr',
                  border:        '1px solid #dee2e6',
                  borderRadius:  4,
                  overflow:      'hidden',
                }}
              >
                {/* LEFT — Below */}
                <Box style={{ borderRight: '1px solid #dee2e6' }}>
                  <Box
                    px="sm" py={5}
                    style={{ background: '#edf2ff', borderBottom: '1px solid #dee2e6' }}
                  >
                    <Text size="xs" fw={700} c="blue.7" ta="center">Below</Text>
                  </Box>
                  <Stack gap={6} p="xs">
                    <Group justify="space-between" align="center" gap="xs">
                      <Text size="xs" c="dimmed">Fat %</Text>
                      <NumBox
                        value={v.parameterBased.belowFat}
                        onChange={(val) => form.setFieldValue('parameterBased.belowFat', val)}
                      />
                    </Group>
                    <Group justify="space-between" align="center" gap="xs">
                      <Text size="xs" c="dimmed">SNF %</Text>
                      <NumBox
                        value={v.parameterBased.belowSnf}
                        onChange={(val) => form.setFieldValue('parameterBased.belowSnf', val)}
                      />
                    </Group>
                    <Divider
                      label={<Text size="xs" fw={600} c="dimmed">Rate</Text>}
                      labelPosition="left"
                      my={2}
                    />
                    <Group justify="space-between" align="center" gap="xs">
                      <Text size="xs" c="dimmed">Amount</Text>
                      <NumBox
                        value={v.parameterBased.belowAmount}
                        onChange={(val) => form.setFieldValue('parameterBased.belowAmount', val)}
                      />
                    </Group>
                  </Stack>
                </Box>

                {/* RIGHT — Above */}
                <Box>
                  <Box
                    px="sm" py={5}
                    style={{ background: '#ebfbee', borderBottom: '1px solid #dee2e6' }}
                  >
                    <Text size="xs" fw={700} c="green.7" ta="center">Above</Text>
                  </Box>
                  <Stack gap={6} p="xs">
                    <Group justify="space-between" align="center" gap="xs">
                      <Text size="xs" c="dimmed">Fat %</Text>
                      <NumBox
                        value={v.parameterBased.aboveFat}
                        onChange={(val) => form.setFieldValue('parameterBased.aboveFat', val)}
                      />
                    </Group>
                    <Group justify="space-between" align="center" gap="xs">
                      <Text size="xs" c="dimmed">SNF %</Text>
                      <NumBox
                        value={v.parameterBased.aboveSnf}
                        onChange={(val) => form.setFieldValue('parameterBased.aboveSnf', val)}
                      />
                    </Group>
                    <Divider
                      label={<Text size="xs" fw={600} c="dimmed">Rate</Text>}
                      labelPosition="left"
                      my={2}
                    />
                    <Group justify="space-between" align="center" gap="xs">
                      <Text size="xs" c="dimmed">Amount</Text>
                      <NumBox
                        value={v.parameterBased.aboveAmount}
                        onChange={(val) => form.setFieldValue('parameterBased.aboveAmount', val)}
                      />
                    </Group>
                  </Stack>
                </Box>
              </Box>
            </SectionCard>

            {/* ── Bottom: Status + Actions ── */}
            <Paper withBorder radius="xs" bg="white" px="sm" py={8}>
              <Group justify="space-between" align="center">
                <Checkbox
                  label={<Text size="sm" fw={600}>Act</Text>}
                  checked={v.status}
                  onChange={(e) => form.setFieldValue('status', e.currentTarget.checked)}
                  color="blue"
                  size="sm"
                />
                <Group gap="sm">
                  <Button
                    variant="default"
                    size="xs"
                    radius="sm"
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="xs"
                    color="blue"
                    radius="sm"
                    loading={saving}
                    leftSection={editRecord ? <IconEdit size={13} /> : <IconPlus size={13} />}
                  >
                    {editRecord ? 'Update' : 'Save'}
                  </Button>
                </Group>
              </Group>
            </Paper>

          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
