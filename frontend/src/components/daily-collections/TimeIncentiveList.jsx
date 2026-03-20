import { useState, useEffect, useCallback } from 'react';
import {
  Container, Group, Title, Button, Select, MultiSelect,
  Modal, Stack, Text, Badge, NumberInput, ActionIcon, Pagination,
  Paper, Table, Tooltip, Box, Divider, Grid, ThemeIcon, Checkbox,
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { useForm }       from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals }        from '@mantine/modals';
import {
  IconPlus, IconEdit, IconTrash, IconRefresh,
  IconClock, IconToggleLeft, IconCalendarEvent, IconLock, IconLockOpen,
} from '@tabler/icons-react';
import { timeIncentiveAPI, collectionCenterAPI } from '../../services/api';

// ────────────────────────────────────────────────────────────────
//  Constants
// ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const EMPTY_FORM = {
  shiftAm:        true,
  shiftPm:        false,
  centerType:     'ALL',
  centers:        [],
  startDate:      null,
  endDateEnabled: false,
  endDate:        null,
  timeFrom:       '',
  timeTo:         '',
  rateLocked:     false,
  rate:           '',
  locked:         false,
  paramsEnabled:  false,
  parameters: {
    belowFat:  '',
    belowSnf:  '',
    belowRate: '',
    aboveFat:  '',
    aboveSnf:  '',
    aboveRate: '',
  },
  status: true,
};

// ────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const numOrNull = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

// ── Reusable section card with enable/disable checkbox ───────────
function SectionCard({ enabled, onToggle, title, children, disabled }) {
  return (
    <Paper
      withBorder
      radius="xs"
      style={{
        borderColor: disabled ? '#fde68a' : enabled ? '#228be6' : '#dee2e6',
        background:  'white',
        overflow:    'hidden',
        transition:  'border-color 0.15s',
        opacity:     disabled ? 0.6 : 1,
      }}
    >
      <Box
        px="sm"
        py={7}
        style={{
          background:   disabled ? '#fefce8' : enabled ? '#e8f0fe' : '#f8f9fa',
          borderBottom: disabled ? '1px solid #fde68a' : enabled ? '1px solid #c5d8fd' : '1px solid #e9ecef',
          cursor:       disabled ? 'not-allowed' : 'default',
        }}
      >
        <Checkbox
          checked={enabled}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          color="blue"
          size="sm"
          disabled={disabled}
          label={
            <Text fw={600} size="sm" c={disabled ? 'yellow.8' : enabled ? 'blue.8' : 'dimmed'}>
              {title}
            </Text>
          }
        />
      </Box>
      <Box
        px="sm"
        py="xs"
        style={{ opacity: enabled && !disabled ? 1 : 0.4, pointerEvents: enabled && !disabled ? 'auto' : 'none' }}
      >
        {children}
      </Box>
    </Paper>
  );
}

// ── Compact number input ─────────────────────────────────────────
function NumBox({ value, onChange }) {
  return (
    <NumberInput
      size="xs"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      decimalScale={2}
      min={0}
      hideControls
      styles={{
        input: {
          width:      72,
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
export default function TimeIncentiveList() {

  // ── List state ───────────────────────────────────────────────
  const [records, setRecords]                   = useState([]);
  const [total, setTotal]                       = useState(0);
  const [totalPages, setTotalPages]             = useState(1);
  const [page, setPage]                         = useState(1);
  const [filterShift, setFilterShift]           = useState('');
  const [filterCenterType, setFilterCenterType] = useState('');
  const [filterStatus, setFilterStatus]         = useState('');
  const [listLoading, setListLoading]           = useState(false);
  const [centerOptions, setCenterOptions]       = useState([]);

  // ── Modal state ──────────────────────────────────────────────
  const [modalOpen, setModalOpen]   = useState(false);
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

  // Auto-fill center when modal opens and options become available
  useEffect(() => {
    if (modalOpen && !editRecord && centerOptions.length > 0 && form.values.centers.length === 0) {
      form.setFieldValue('centerType', 'LIST');
      form.setFieldValue('centers', [centerOptions[0].value]);
    }
  }, [modalOpen, centerOptions]); // eslint-disable-line

  // ── Fetch records ────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setListLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (filterShift)        params.shift      = filterShift;
      if (filterCenterType)   params.centerType  = filterCenterType;
      if (filterStatus !== '') params.status     = filterStatus;

      const res = await timeIncentiveAPI.getAll(params);
      setRecords(res.data        || []);
      setTotal(res.total         || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      notifications.show({ color: 'red', title: 'Error', message: e.message || 'Failed to load' });
    } finally {
      setListLoading(false);
    }
  }, [page, filterShift, filterCenterType, filterStatus]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ── Open Add ─────────────────────────────────────────────────
  const openAdd = () => {
    setEditRecord(null);
    const defaultCenter = centerOptions.length > 0 ? centerOptions[0].value : null;
    form.setValues({
      ...EMPTY_FORM,
      centerType: defaultCenter ? 'LIST' : 'ALL',
      centers:    defaultCenter ? [defaultCenter] : [],
    });
    setModalOpen(true);
  };

  // ── Open Edit ────────────────────────────────────────────────
  const openEdit = (rec) => {
    setEditRecord(rec);
    const shifts = rec.shift || [];
    form.setValues({
      shiftAm:        shifts.includes('AM'),
      shiftPm:        shifts.includes('PM'),
      centerType:     rec.centerType || 'ALL',
      centers:        rec.centers    || [],
      startDate:      rec.startDate  ? new Date(rec.startDate) : null,
      endDateEnabled: !!rec.endDate,
      endDate:        rec.endDate    ? new Date(rec.endDate)   : null,
      timeFrom:       rec.timeFrom   || '',
      timeTo:         rec.timeTo     || '',
      rateLocked:     rec.rateLocked ?? false,
      rate:           rec.rate       ?? '',
      locked:         rec.locked     ?? false,
      paramsEnabled:  !!(
        rec.parameters?.belowFat  != null ||
        rec.parameters?.aboveFat  != null ||
        rec.parameters?.belowSnf  != null ||
        rec.parameters?.aboveSnf  != null ||
        rec.parameters?.belowRate != null ||
        rec.parameters?.aboveRate != null
      ),
      parameters: {
        belowFat:  rec.parameters?.belowFat  ?? '',
        belowSnf:  rec.parameters?.belowSnf  ?? '',
        belowRate: rec.parameters?.belowRate ?? '',
        aboveFat:  rec.parameters?.aboveFat  ?? '',
        aboveSnf:  rec.parameters?.aboveSnf  ?? '',
        aboveRate: rec.parameters?.aboveRate ?? '',
      },
      status: rec.status ?? true,
    });
    setModalOpen(true);
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    const shiftArr = [v.shiftAm && 'AM', v.shiftPm && 'PM'].filter(Boolean);
    if (shiftArr.length === 0) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Select at least AM or PM shift' });
      return;
    }
    if (!v.startDate) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Start date is required' });
      return;
    }
    if (v.endDateEnabled && !v.endDate) {
      notifications.show({ color: 'red', title: 'Validation', message: 'End date is required when enabled' });
      return;
    }
    if (!v.timeFrom) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Time From is required' });
      return;
    }
    if (!v.timeTo) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Time To is required' });
      return;
    }
    if (v.rate === '' || v.rate === null || Number(v.rate) < 0) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Rate is required' });
      return;
    }
    if (v.centerType === 'LIST' && v.centers.length === 0) {
      notifications.show({ color: 'red', title: 'Validation', message: 'Select at least one center' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        shift:      shiftArr,
        centerType: v.centerType,
        centers:    v.centerType === 'LIST' ? v.centers : [],
        startDate:  v.startDate instanceof Date ? v.startDate.toISOString() : v.startDate,
        endDate:    v.endDateEnabled && v.endDate
          ? (v.endDate instanceof Date ? v.endDate.toISOString() : v.endDate)
          : null,
        timeFrom:   v.timeFrom,
        timeTo:     v.timeTo,
        rate:       Number(v.rate),
        rateLocked: v.rateLocked,
        locked:     v.locked,
        parameters: v.paramsEnabled
          ? {
              belowFat:  numOrNull(v.parameters.belowFat),
              belowSnf:  numOrNull(v.parameters.belowSnf),
              belowRate: numOrNull(v.parameters.belowRate),
              aboveFat:  numOrNull(v.parameters.aboveFat),
              aboveSnf:  numOrNull(v.parameters.aboveSnf),
              aboveRate: numOrNull(v.parameters.aboveRate),
            }
          : { belowFat: null, belowSnf: null, belowRate: null, aboveFat: null, aboveSnf: null, aboveRate: null },
        status: v.status,
      };

      if (editRecord) {
        await timeIncentiveAPI.update(editRecord._id, payload);
        notifications.show({ color: 'green', title: 'Updated', message: 'Time incentive updated' });
      } else {
        await timeIncentiveAPI.create(payload);
        notifications.show({ color: 'green', title: 'Created', message: 'Time incentive created' });
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
  const handleToggle = async (rec) => {
    try {
      await timeIncentiveAPI.toggleStatus(rec._id);
      notifications.show({
        color:   rec.status ? 'orange' : 'green',
        title:   rec.status ? 'Deactivated' : 'Activated',
        message: `Time incentive is now ${rec.status ? 'Inactive' : 'Active'}`,
      });
      fetchRecords();
    } catch (e) {
      notifications.show({ color: 'red', title: 'Error', message: e.message });
    }
  };

  // ── Soft delete ──────────────────────────────────────────────
  const handleDelete = (rec) => {
    modals.openConfirmModal({
      title:    'Deactivate Time Incentive',
      centered: true,
      children: (
        <Text size="sm">
          Deactivate incentive ({rec.timeFrom} – {rec.timeTo})?
        </Text>
      ),
      labels:       { confirm: 'Deactivate', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await timeIncentiveAPI.delete(rec._id);
          notifications.show({ color: 'orange', title: 'Deactivated', message: 'Record set to Inactive' });
          fetchRecords();
        } catch (e) {
          notifications.show({ color: 'red', title: 'Error', message: e.message });
        }
      },
    });
  };

  // ── Table rows ────────────────────────────────────────────────
  const rows = records.map((rec, i) => (
    <Table.Tr key={rec._id}>
      <Table.Td c="dimmed" fz="sm">{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          {(rec.shift || []).map((s) => (
            <Badge key={s} color={s === 'AM' ? 'yellow' : 'indigo'} variant="filled" size="sm" radius="sm">
              {s}
            </Badge>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>
        <Badge color={rec.centerType === 'ALL' ? 'teal' : 'grape'} variant="light" size="sm">
          {rec.centerType}
        </Badge>
      </Table.Td>
      <Table.Td fz="xs" c="dimmed">
        {rec.centerType === 'LIST' && rec.centers?.length > 0 ? rec.centers.join(', ') : '—'}
      </Table.Td>
      <Table.Td fz="sm">{fmtDate(rec.startDate)}</Table.Td>
      <Table.Td fz="sm">{fmtDate(rec.endDate)}</Table.Td>
      <Table.Td fw={600} fz="sm" c="blue">{rec.timeFrom} – {rec.timeTo}</Table.Td>
      <Table.Td fw={600} fz="sm" c="green">₹ {rec.rate ?? '—'}</Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Badge color={rec.status ? 'green' : 'gray'} variant="dot" size="sm">
            {rec.status ? 'Active' : 'Inactive'}
          </Badge>
          {rec.locked && (
            <Tooltip label="Locked">
              <IconLock size={13} color="#dc2626" />
            </Tooltip>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon variant="light" color="blue" size="sm" onClick={() => openEdit(rec)}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={rec.status ? 'Deactivate' : 'Activate'}>
            <ActionIcon variant="light" color={rec.status ? 'orange' : 'green'} size="sm" onClick={() => handleToggle(rec)}>
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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      <Paper shadow="sm" radius="md" p="lg" withBorder>

        {/* Header */}
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" color="cyan" variant="light">
              <IconClock size={22} />
            </ThemeIcon>
            <Box>
              <Title order={3} lh={1}>Time Incentive</Title>
              <Text size="xs" c="dimmed">Manage time-based milk collection incentives</Text>
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
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Select
              placeholder="Shift"
              data={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]}
              value={filterShift}
              onChange={(val) => { setFilterShift(val || ''); setPage(1); }}
              radius="md"
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Select
              placeholder="Center Type"
              data={[{ value: 'ALL', label: 'ALL' }, { value: 'LIST', label: 'LIST' }]}
              value={filterCenterType}
              onChange={(val) => { setFilterCenterType(val || ''); setPage(1); }}
              radius="md"
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Select
              placeholder="Status"
              data={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
              value={filterStatus}
              onChange={(val) => { setFilterStatus(val ?? ''); setPage(1); }}
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
                <Table.Th w={100}>Shift</Table.Th>
                <Table.Th w={90}>Center Type</Table.Th>
                <Table.Th>Centers</Table.Th>
                <Table.Th>Start Date</Table.Th>
                <Table.Th>End Date</Table.Th>
                <Table.Th>Time Range</Table.Th>
                <Table.Th w={90}>Rate</Table.Th>
                <Table.Th w={90}>Status</Table.Th>
                <Table.Th w={110}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {listLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={10} ta="center" py="xl" c="dimmed">Loading...</Table.Td>
                </Table.Tr>
              ) : rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10} ta="center" py="xl" c="dimmed">
                    No time incentives found.{' '}
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
           ADD / EDIT MODAL — compact ERP form layout
        ══════════════════════════════════════════════════════════ */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          <Text fw={700} size="sm" c="blue.9">
            {editRecord ? 'Edit Time Incentive' : 'TIME INCENTIVE'}
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
        <Stack gap={8}>

          {/* ── LOCK OVERLAY ── */}
          {v.locked && (
            <Box style={{
              background: 'rgba(239,68,68,0.07)', border: '2px solid #fca5a5',
              borderRadius: 6, padding: '6px 12px',
            }}>
              <Group gap={8} align="center">
                <IconLock size={14} color="#dc2626" />
                <Text size="xs" fw={700} c="red.7">This record is locked. No changes can be made.</Text>
              </Group>
            </Box>
          )}

          {/* ── FORM BODY (blocked when locked) ── */}
          <Box style={v.locked ? { pointerEvents: 'none', opacity: 0.5, userSelect: 'none' } : {}}>
          <Stack gap={8}>

          {/* ── ROW 1 : Shift + Center + ALL ── */}
          <Paper withBorder radius="xs" bg="white" p="sm">
            <Grid gutter="xs" align="flex-end">

              {/* Shift checkboxes */}
              <Grid.Col span="content">
                <Text size="xs" fw={500} c="dimmed" mb={6}>Shift</Text>
                <Group gap="md" align="center" h={30}>
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

              {/* Vertical separator */}
              <Grid.Col span="content">
                <Box style={{ borderLeft: '1px solid #dee2e6', height: 30, marginBottom: 2 }} />
              </Grid.Col>

              {/* Center dropdown */}
              <Grid.Col span="auto">
                <Select
                  label="Center"
                  placeholder="Center Names List"
                  data={centerOptions}
                  value={v.centerType === 'LIST' && v.centers.length === 1 ? v.centers[0] : null}
                  onChange={(val) => {
                    if (val) {
                      form.setFieldValue('centerType', 'LIST');
                      form.setFieldValue('centers', [val]);
                    } else {
                      form.setFieldValue('centerType', 'ALL');
                      form.setFieldValue('centers', []);
                    }
                  }}
                  size="xs"
                  radius="sm"
                  searchable
                  clearable
                  nothingFoundMessage="No centers found"
                />
              </Grid.Col>

              {/* ALL button */}
              <Grid.Col span="content">
                <Button
                  size="xs"
                  radius="sm"
                  variant={v.centerType === 'ALL' ? 'filled' : 'light'}
                  color="blue"
                  onClick={() => {
                    form.setFieldValue('centerType', 'ALL');
                    form.setFieldValue('centers', []);
                  }}
                  style={{ height: 30, marginBottom: 2 }}
                >
                  ALL
                </Button>
              </Grid.Col>
            </Grid>

            {/* Multi-select when LIST mode is manually triggered */}
            {v.centerType === 'LIST' && (
              <MultiSelect
                mt="xs"
                placeholder="Select centers..."
                data={centerOptions}
                value={v.centers}
                onChange={(val) => form.setFieldValue('centers', val)}
                size="xs"
                radius="sm"
                searchable
                nothingFoundMessage="No centers found"
              />
            )}
          </Paper>

          {/* ── ROW 2 : Start Date + End Date (with enable checkbox) ── */}
          <Paper withBorder radius="xs" bg="white" p="sm">
            <Grid gutter="xs" align="flex-end">

              {/* Start Date */}
              <Grid.Col span={5}>
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
                />
              </Grid.Col>

              {/* End Date enable checkbox */}
              <Grid.Col span="content">
                <Box mb={4}>
                  <Checkbox
                    label={<Text size="xs" fw={500}>End Date</Text>}
                    checked={v.endDateEnabled}
                    onChange={(e) => {
                      form.setFieldValue('endDateEnabled', e.currentTarget.checked);
                      if (!e.currentTarget.checked) form.setFieldValue('endDate', null);
                    }}
                    color="blue"
                    size="xs"
                  />
                </Box>
              </Grid.Col>

              {/* End Date input */}
              <Grid.Col span="auto">
                <DatePickerInput
                  placeholder="DD/MM/YYYY"
                  value={v.endDate}
                  onChange={(val) => form.setFieldValue('endDate', val)}
                  valueFormat="DD/MM/YYYY"
                  leftSection={<IconCalendarEvent size={13} />}
                  size="xs"
                  radius="sm"
                  clearable
                  disabled={!v.endDateEnabled}
                  minDate={v.startDate || undefined}
                />
              </Grid.Col>
            </Grid>
          </Paper>

          {/* ── ROW 3 : Time From + Time To + Rate ── */}
          <Paper withBorder radius="xs" bg="white" p="sm">
            <Grid gutter="sm" align="flex-end">
              <Grid.Col span={4}>
                <TimeInput
                  label={<Text size="xs" fw={500}>Time From</Text>}
                  placeholder="e.g. 06:00"
                  value={v.timeFrom}
                  onChange={(e) => form.setFieldValue('timeFrom', e.currentTarget.value)}
                  leftSection={<IconClock size={13} />}
                  size="xs"
                  radius="sm"
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TimeInput
                  label={<Text size="xs" fw={500}>Time To</Text>}
                  placeholder="e.g. 19:00"
                  value={v.timeTo}
                  onChange={(e) => form.setFieldValue('timeTo', e.currentTarget.value)}
                  leftSection={<IconClock size={13} />}
                  size="xs"
                  radius="sm"
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="xs" fw={500} mb={4}>
                  Rate
                  {v.paramsEnabled && (
                    <Text span size="xs" c="orange.7" fw={700} ml={6}>(Based on Performance)</Text>
                  )}
                </Text>
                <Group gap={6} align="center">
                  <NumberInput
                    placeholder={v.paramsEnabled ? 'Blocked' : '0.00'}
                    value={v.paramsEnabled ? '' : v.rate}
                    onChange={(val) => { if (!v.paramsEnabled) form.setFieldValue('rate', val); }}
                    min={0}
                    decimalScale={4}
                    hideControls
                    readOnly={v.rateLocked || v.paramsEnabled}
                    disabled={v.paramsEnabled}
                    size="xs"
                    radius="sm"
                    style={{ flex: 1 }}
                    styles={{
                      input: (v.paramsEnabled)
                        ? { background: '#fff3e0', color: '#e65100', cursor: 'not-allowed', borderColor: '#ffb74d', fontWeight: 700 }
                        : v.rateLocked
                          ? { background: '#f1f3f5', color: '#868e96', cursor: 'not-allowed', borderColor: '#ced4da' }
                          : {},
                    }}
                  />
                  <Tooltip label={v.paramsEnabled ? 'Rate blocked — disable Based on Parameter to set rate' : v.rateLocked ? 'Rate locked — click to unlock' : 'Click to lock rate'}>
                    <Checkbox
                      checked={v.rateLocked}
                      onChange={(e) => { if (!v.paramsEnabled) form.setFieldValue('rateLocked', e.currentTarget.checked); }}
                      disabled={v.paramsEnabled}
                      color="orange"
                      size="sm"
                    />
                  </Tooltip>
                </Group>
              </Grid.Col>
            </Grid>
          </Paper>

          {/* ── PARAMETER SECTION : Based on Parameter (with enable checkbox) ── */}
          <SectionCard
            enabled={v.paramsEnabled}
            onToggle={(val) => { if (!v.rateLocked) form.setFieldValue('paramsEnabled', val); }}
            title={v.rateLocked ? 'Based on Parameter (Rate locked — untick Rate lock to enable)' : 'Based on Parameter'}
            disabled={v.rateLocked}
          >
            <Box
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 1fr',
                border:              '1px solid #dee2e6',
                borderRadius:        4,
                overflow:            'hidden',
              }}
            >
              {/* ── LEFT column: Below ── */}
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
                      value={v.parameters.belowFat}
                      onChange={(val) => form.setFieldValue('parameters.belowFat', val)}
                    />
                  </Group>
                  <Group justify="space-between" align="center" gap="xs">
                    <Text size="xs" c="dimmed">SNF %</Text>
                    <NumBox
                      value={v.parameters.belowSnf}
                      onChange={(val) => form.setFieldValue('parameters.belowSnf', val)}
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
                      value={v.parameters.belowRate}
                      onChange={(val) => form.setFieldValue('parameters.belowRate', val)}
                    />
                  </Group>
                </Stack>
              </Box>

              {/* ── RIGHT column: Above ── */}
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
                      value={v.parameters.aboveFat}
                      onChange={(val) => form.setFieldValue('parameters.aboveFat', val)}
                    />
                  </Group>
                  <Group justify="space-between" align="center" gap="xs">
                    <Text size="xs" c="dimmed">SNF %</Text>
                    <NumBox
                      value={v.parameters.aboveSnf}
                      onChange={(val) => form.setFieldValue('parameters.aboveSnf', val)}
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
                      value={v.parameters.aboveRate}
                      onChange={(val) => form.setFieldValue('parameters.aboveRate', val)}
                    />
                  </Group>
                </Stack>
              </Box>
            </Box>
          </SectionCard>

          {/* ── BOTTOM : Status ── */}
          <Paper withBorder radius="xs" bg="white" px="sm" py={8}>
            <Checkbox
              label={<Text size="sm" fw={600}>Active</Text>}
              checked={v.status}
              onChange={(e) => form.setFieldValue('status', e.currentTarget.checked)}
              color="blue"
              size="sm"
            />
          </Paper>

          </Stack>
          </Box>{/* end form body */}

          {/* ── BOTTOM : Lock + Actions ── */}
          <Paper withBorder radius="xs" px="sm" py={8}
            style={{ background: v.locked ? '#fff5f5' : 'white', borderColor: v.locked ? '#fca5a5' : '#dee2e6' }}>
            <Group justify="space-between" align="center">
              <Tooltip label={v.locked ? 'Record is locked — cannot unlock here' : 'Lock this record to prevent edits'}>
                <Checkbox
                  label={
                    <Group gap={5} align="center">
                      {v.locked ? <IconLock size={13} color="#dc2626" /> : <IconLockOpen size={13} color="#6b7280" />}
                      <Text size="sm" fw={700} c={v.locked ? 'red.7' : 'dimmed'}>
                        {v.locked ? 'Locked' : 'Lock'}
                      </Text>
                    </Group>
                  }
                  checked={v.locked}
                  onChange={(e) => form.setFieldValue('locked', e.currentTarget.checked)}
                  disabled={v.locked}
                  color="red"
                  size="sm"
                />
              </Tooltip>
              <Group gap="sm">
                <Button variant="default" size="xs" radius="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="xs" color="blue" radius="sm"
                  loading={saving}
                  disabled={v.locked}
                  onClick={handleSubmit}
                  leftSection={editRecord ? <IconEdit size={13} /> : <IconPlus size={13} />}
                >
                  {editRecord ? 'Update' : 'Save'}
                </Button>
              </Group>
            </Group>
          </Paper>

        </Stack>
      </Modal>
    </Container>
  );
}
