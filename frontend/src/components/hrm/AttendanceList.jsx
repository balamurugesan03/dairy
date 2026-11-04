import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge, Table, ActionIcon,
  SimpleGrid, LoadingOverlay, Tooltip, ThemeIcon, Tabs, ScrollArea
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconCalendarCheck, IconPlus, IconTrash, IconUserCheck, IconUserOff, IconClock,
  IconPrinter, IconTable, IconList, IconPlane
} from '@tabler/icons-react';
import { attendanceAPI, employeeAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import { useCompany } from '../../context/CompanyContext';
import {
  MONTHS, yearOptions, ATTENDANCE, ATTENDANCE_STATUSES, printAttendanceRegister
} from './hrmShared';
import StatCard from './HrmStatCard';

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

const AttendanceList = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const orgName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const [tab, setTab] = useState('register');

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Attendance</Title>
          <Text c="dimmed" size="sm">Monthly register and day-wise records — approved leaves appear automatically</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/hrm/attendance/mark')}>Mark Attendance</Button>
      </Group>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="register" leftSection={<IconTable size={14} />}>Monthly Register</Tabs.Tab>
          <Tabs.Tab value="records" leftSection={<IconList size={14} />}>Day-wise Records</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="register"><MonthlyRegister orgName={orgName} onMark={(d) => navigate(`/hrm/attendance/mark?date=${d}`)} /></Tabs.Panel>
        <Tabs.Panel value="records">{tab === 'records' && <DayRecords />}</Tabs.Panel>
      </Tabs>
    </Container>
  );
};

const MonthlyRegister = ({ orgName, onMark }) => {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [dept, setDept] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [month, year]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await attendanceAPI.getRegister({ month, year });
      setData(res.data);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load register', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => (data?.rows || []).filter(r => !dept || r.employee.department === dept), [data, dept]);
  const departments = useMemo(() => [...new Set((data?.rows || []).map(r => r.employee.department).filter(Boolean))], [data]);
  const days = Array.from({ length: data?.daysInMonth || 0 }, (_, i) => i + 1);
  const m = Number(month); const y = Number(year);
  const isSunday = (d) => new Date(y, m - 1, d).getDay() === 0;
  const today = new Date();
  const isFuture = (d) => new Date(y, m - 1, d) > today;
  const tot = (k) => rows.reduce((s, r) => s + (r.summary[k] || 0), 0);
  const dayMarked = (d) => rows.filter(r => r.days[d]).length;

  return (
    <>
      <Paper shadow="xs" p="md" radius="md" withBorder mb="md">
        <Group justify="space-between" align="flex-end">
          <Group align="flex-end">
            <Select label="Month" data={MONTHS} value={month} onChange={(v) => v && setMonth(v)} w={150} />
            <Select label="Year" data={yearOptions()} value={year} onChange={(v) => v && setYear(v)} w={110} />
            {departments.length > 1 && <Select label="Department" placeholder="All" data={departments} value={dept} onChange={setDept} clearable w={180} />}
          </Group>
          <Button variant="light" leftSection={<IconPrinter size={16} />} disabled={!rows.length}
            onClick={() => printAttendanceRegister({ ...data, rows }, orgName)}>Print Register</Button>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 2, sm: 5 }} mb="md">
        <StatCard icon={<IconUserCheck size={20} />} label="Present days" value={tot('present')} color="green" />
        <StatCard icon={<IconUserOff size={20} />} label="Absent days" value={tot('absent')} color="red" />
        <StatCard icon={<IconClock size={20} />} label="Half days" value={tot('halfDay')} color="yellow" />
        <StatCard icon={<IconPlane size={20} />} label="Leave days" value={tot('leave')} color="blue" />
        <StatCard icon={<IconClock size={20} />} label="Overtime hours" value={tot('overtimeHours')} color="orange" />
      </SimpleGrid>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {!rows.length && !loading ? (
          <Stack align="center" py={60}><Text c="dimmed">No employees for this month</Text></Stack>
        ) : (
          <ScrollArea type="auto">
            <Table withColumnBorders verticalSpacing={4} horizontalSpacing={4} fz="xs" style={{ minWidth: 300 + days.length * 30 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 1, minWidth: 170 }}>Employee</Table.Th>
                  {days.map(d => (
                    <Table.Th key={d} ta="center" p={2}
                      style={{ background: isSunday(d) ? 'var(--mantine-color-gray-1)' : undefined, cursor: isFuture(d) ? 'default' : 'pointer', minWidth: 28 }}
                      onClick={() => !isFuture(d) && onMark(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)}>
                      <Tooltip label={`${dayMarked(d)}/${rows.length} marked — click to mark`} disabled={isFuture(d)}>
                        <div>
                          <div>{d}</div>
                          <div style={{ fontWeight: 400, color: dayMarked(d) === rows.length ? 'var(--mantine-color-green-7)' : dayMarked(d) ? 'var(--mantine-color-orange-7)' : 'var(--mantine-color-dimmed)' }}>
                            {new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'narrow' })}
                          </div>
                        </div>
                      </Tooltip>
                    </Table.Th>
                  ))}
                  <Table.Th ta="center" c="green">P</Table.Th>
                  <Table.Th ta="center" c="red">A</Table.Th>
                  <Table.Th ta="center" c="yellow.7">H</Table.Th>
                  <Table.Th ta="center" c="blue">L</Table.Th>
                  <Table.Th ta="center">OT</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map(r => (
                  <Table.Tr key={r.employee._id}>
                    <Table.Td style={{ position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 1 }}>
                      <Text size="xs" fw={600}>{r.employee.name}</Text>
                      <Text size="xs" c="dimmed">{r.employee.employeeCode}</Text>
                    </Table.Td>
                    {days.map(d => {
                      const cell = r.days[d];
                      const meta = cell ? ATTENDANCE[cell.status] : null;
                      return (
                        <Table.Td key={d} ta="center" p={1} style={{ background: isSunday(d) && !cell ? 'var(--mantine-color-gray-0)' : undefined }}>
                          {meta && (
                            <Tooltip label={`${cell.status}${cell.leaveType ? ` (${cell.leaveType})` : ''}${cell.overtimeHours ? ` · OT ${cell.overtimeHours}h` : ''}`}>
                              <Badge size="xs" radius="sm" variant={cell.status === 'Present' ? 'light' : 'filled'} color={meta.color} px={3}>
                                {meta.code}
                              </Badge>
                            </Tooltip>
                          )}
                        </Table.Td>
                      );
                    })}
                    <Table.Td ta="center" fw={700}>{r.summary.present}</Table.Td>
                    <Table.Td ta="center">{r.summary.absent}</Table.Td>
                    <Table.Td ta="center">{r.summary.halfDay}</Table.Td>
                    <Table.Td ta="center">{r.summary.leave}</Table.Td>
                    <Table.Td ta="center">{r.summary.overtimeHours || ''}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>
      <Group gap="xs" mt="xs">
        {ATTENDANCE_STATUSES.map(s => <Badge key={s} size="xs" variant="light" color={ATTENDANCE[s].color}>{ATTENDANCE[s].code} {s}</Badge>)}
        <Text size="xs" c="dimmed">· Blank = not marked (counted as paid unless payroll is run with “unmarked = absent”) · Click a date to mark it</Text>
      </Group>
    </>
  );
};

const DayRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [dateRange, setDateRange] = useState([new Date(), new Date()]);
  const [filters, setFilters] = useState({ employee: null, status: null });

  useEffect(() => { employeeAPI.getAll({ limit: 1000 }).then(r => setEmployees(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { fetchAttendance(); }, [dateRange, filters]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange[0]) params.startDate = localDateStr(dateRange[0]);
      if (dateRange[1]) params.endDate = localDateStr(dateRange[1]);
      if (filters.employee) params.employeeId = filters.employee;
      if (filters.status) params.status = filters.status;
      const res = await attendanceAPI.getAll(params);
      setRecords(res.data || []);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load attendance', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (rec) => {
    modals.openConfirmModal({
      title: 'Delete Record',
      children: <Text size="sm">Delete attendance for <b>{rec.employeeId?.name}</b> on {formatDate(rec.date)}?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await attendanceAPI.delete(rec._id);
          notifications.show({ title: 'Deleted', color: 'green', message: 'Record removed' });
          fetchAttendance();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  return (
    <>
      <Paper shadow="xs" p="md" radius="md" withBorder mb="md">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <DatePickerInput type="range" label="Date Range" value={dateRange} onChange={setDateRange} clearable valueFormat="DD/MM/YYYY" />
          <Select label="Employee" placeholder="All Employees" data={employees.map(e => ({ value: e._id, label: `${e.employeeCode ? e.employeeCode + ' · ' : ''}${e.name}` }))}
            value={filters.employee} onChange={(v) => setFilters({ ...filters, employee: v })} clearable searchable />
          <Select label="Status" placeholder="All Status" data={ATTENDANCE_STATUSES}
            value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} clearable />
        </SimpleGrid>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {records.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconCalendarCheck size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No attendance records</Title>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">OT Hrs</Table.Th>
                  <Table.Th>Remarks</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((rec, i) => (
                  <Table.Tr key={rec._id}>
                    <Table.Td><Text size="sm" c="dimmed">{i + 1}</Text></Table.Td>
                    <Table.Td><Text size="sm">{formatDate(rec.date)}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>{rec.employeeId?.name || '-'}</Text>
                      <Text size="xs" c="dimmed">{[rec.employeeId?.employeeCode, rec.employeeId?.department].filter(Boolean).join(' · ')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={ATTENDANCE[rec.status]?.color || 'gray'} size="sm">
                        {rec.status}{rec.leaveType ? ` · ${rec.leaveType}` : ''}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right"><Text size="sm">{rec.overtimeHours || ''}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{rec.remarks || ''}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        {!rec.leaveId && (
                          <Tooltip label="Delete">
                            <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(rec)}><IconTrash size={16} /></ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
    </>
  );
};

export default AttendanceList;
