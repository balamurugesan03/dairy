import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Badge, Table, LoadingOverlay, ThemeIcon,
  SimpleGrid, SegmentedControl, NumberInput, TextInput, Alert, Tooltip, Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarCheck, IconUsers, IconUserCheck, IconUserOff, IconClock, IconPlane,
  IconChevronLeft, IconChevronRight, IconInfoCircle, IconList
} from '@tabler/icons-react';
import { attendanceAPI, employeeAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import {
  ATTENDANCE
} from './hrmShared';
import StatCard from './HrmStatCard';

const QUICK = ['Present', 'Absent', 'Half Day', 'Holiday', 'Week Off'];

const MarkAttendance = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get('date') || '');
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
    return d > new Date() ? new Date() : d;
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [dept, setDept] = useState(null);

  useEffect(() => { load(); }, [selectedDate]);

  const load = async () => {
    setLoading(true);
    try {
      const day = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const [empRes, existing] = await Promise.all([
        employeeAPI.getAll({ limit: 1000 }),
        attendanceAPI.getByDate(localDateStr(selectedDate))
      ]);
      // On the rolls that day: joined on/before, and active or exited after
      const employees = (empRes.data || []).filter(e => {
        const join = e.joiningDate ? new Date(e.joiningDate) : null;
        const exit = e.exitDate ? new Date(e.exitDate) : null;
        if (join && new Date(join.getFullYear(), join.getMonth(), join.getDate()) > day) return false;
        if (e.status !== 'Active' && (!exit || exit < day)) return false;
        return true;
      });
      const map = {};
      (existing.data || []).forEach(r => { map[r.employeeId?._id || r.employeeId] = r; });
      const isSunday = day.getDay() === 0;
      setAlreadyMarked(Object.keys(map).length);
      setRows(employees.map(emp => {
        const ex = map[emp._id];
        return {
          employeeId: emp._id, name: emp.name, code: emp.employeeCode || '', department: emp.department || '', role: emp.role || '',
          status: ex?.status || (isSunday ? 'Week Off' : 'Present'),
          overtimeHours: ex?.overtimeHours || 0,
          remarks: ex?.remarks || '',
          leaveType: ex?.leaveType, fromLeave: !!ex?.leaveId, saved: !!ex
        };
      }));
      setDirty(false);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load employees', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const update = (id, patch) => { setRows(prev => prev.map(r => (r.employeeId === id ? { ...r, ...patch } : r))); setDirty(true); };
  const bulk = (status) => {
    // Approved-leave rows keep their leave
    setRows(prev => prev.map(r => (r.fromLeave || (dept && r.department !== dept) ? r : { ...r, status })));
    setDirty(true);
  };
  const shiftDay = (n) => {
    const d = new Date(selectedDate); d.setDate(d.getDate() + n);
    if (d <= new Date()) setSelectedDate(d);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const dateStr = localDateStr(selectedDate);
      await attendanceAPI.bulkMark({
        attendanceRecords: rows.map(r => ({
          employeeId: r.employeeId, date: dateStr, status: r.status,
          overtimeHours: r.status === 'Present' || r.status === 'Half Day' ? r.overtimeHours : 0,
          remarks: r.remarks
        }))
      });
      notifications.show({ title: 'Saved', message: `Attendance saved for ${selectedDate.toLocaleDateString('en-IN')}`, color: 'green' });
      load();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to save attendance', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(() => (dept ? rows.filter(r => r.department === dept) : rows), [rows, dept]);
  const departments = useMemo(() => [...new Set(rows.map(r => r.department).filter(Boolean))], [rows]);
  const count = (s) => rows.filter(r => r.status === s).length;
  const otTotal = rows.reduce((s, r) => s + (Number(r.overtimeHours) || 0), 0);
  const isFuture = selectedDate > new Date();

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Mark Attendance</Title>
          <Text c="dimmed" size="sm">Daily attendance drives payroll paid days, LOP and overtime</Text>
        </div>
        <Button variant="light" leftSection={<IconList size={16} />} onClick={() => navigate('/hrm/attendance')}>Attendance Register</Button>
      </Group>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="md">
        <Group justify="space-between" wrap="wrap" gap="sm" align="flex-end">
          <Group gap={4} align="flex-end">
            <Tooltip label="Previous day"><Button variant="default" px={8} onClick={() => shiftDay(-1)}><IconChevronLeft size={16} /></Button></Tooltip>
            <DatePickerInput label="Attendance Date" value={selectedDate} onChange={(v) => v && setSelectedDate(new Date(v))}
              maxDate={new Date()} w={190} valueFormat="ddd, DD MMM YYYY" />
            <Tooltip label="Next day"><Button variant="default" px={8} onClick={() => shiftDay(1)}><IconChevronRight size={16} /></Button></Tooltip>
          </Group>
          {departments.length > 1 && (
            <Select label="Department" placeholder="All" data={departments} value={dept} onChange={setDept} clearable w={180} />
          )}
          <Group gap="xs">
            <Text size="sm" fw={500}>Mark all{dept ? ` (${dept})` : ''}:</Text>
            {QUICK.map(s => (
              <Button key={s} size="xs" variant="light" color={ATTENDANCE[s].color} onClick={() => bulk(s)}>{s}</Button>
            ))}
          </Group>
        </Group>
      </Paper>

      {alreadyMarked > 0 && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
          Attendance already saved for {alreadyMarked} of {rows.length} employee(s) on this date — saving again updates it.
          Rows marked <b>Leave</b> come from approved leave applications; cancel the leave to change them.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, sm: 5 }} mb="md">
        <StatCard icon={<IconUserCheck size={20} />} label="Present" value={count('Present')} color="green" />
        <StatCard icon={<IconUserOff size={20} />} label="Absent" value={count('Absent')} color="red" />
        <StatCard icon={<IconClock size={20} />} label="Half Day" value={count('Half Day')} color="yellow" />
        <StatCard icon={<IconPlane size={20} />} label="Leave / Off" value={count('Leave') + count('Holiday') + count('Week Off')} color="blue" />
        <StatCard icon={<IconClock size={20} />} label="Overtime Hours" value={otTotal} color="orange" />
      </SimpleGrid>

      <Paper shadow="xs" radius="md" withBorder pos="relative" mb="lg">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {visible.length === 0 && !loading ? (
          <Stack align="center" py={60}>
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconUsers size={32} /></ThemeIcon>
            <Text c="dimmed">No employees on the rolls for this date</Text>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>#</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={110}>OT Hours</Table.Th>
                  <Table.Th>Remarks</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((r, i) => (
                  <Table.Tr key={r.employeeId}>
                    <Table.Td><Text size="sm" c="dimmed">{i + 1}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>{r.name} <Text span size="xs" c="dimmed" ff="monospace">{r.code}</Text></Text>
                      <Text size="xs" c="dimmed">{[r.department, r.role].filter(Boolean).join(' · ')}</Text>
                    </Table.Td>
                    <Table.Td>
                      {r.fromLeave ? (
                        <Badge color="blue" variant="light">Leave — {r.leaveType}</Badge>
                      ) : (
                        <SegmentedControl size="xs" value={r.status}
                          onChange={(v) => update(r.employeeId, { status: v })}
                          color={ATTENDANCE[r.status]?.color}
                          data={QUICK.map(s => ({ value: s, label: ATTENDANCE[s].code }))} />
                      )}
                      {!r.fromLeave && <Text size="xs" c={ATTENDANCE[r.status]?.color} fw={600} mt={2}>{r.status}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <NumberInput size="xs" min={0} max={16} step={0.5} decimalScale={1} hideControls
                        value={r.overtimeHours} onChange={(v) => update(r.employeeId, { overtimeHours: Number(v) || 0 })}
                        disabled={r.fromLeave || !['Present', 'Half Day'].includes(r.status)} />
                    </Table.Td>
                    <Table.Td>
                      <TextInput size="xs" value={r.remarks} placeholder="—" disabled={r.fromLeave}
                        onChange={(e) => update(r.employeeId, { remarks: e.target.value })} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Group justify="space-between">
        <Text size="xs" c="dimmed">P Present · A Absent · H Half Day · HD Holiday · WO Week Off. Sundays default to Week Off.</Text>
        <Button size="md" leftSection={<IconCalendarCheck size={18} />} onClick={handleSubmit} loading={saving}
          disabled={rows.length === 0 || isFuture} color={dirty ? 'blue' : 'gray'}>
          Save Attendance
        </Button>
      </Group>
    </Container>
  );
};

export default MarkAttendance;
