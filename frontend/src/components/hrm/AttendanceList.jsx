import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge,
  Table, ActionIcon, SimpleGrid, Card, LoadingOverlay, Tooltip, ThemeIcon, TextInput
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconCalendarCheck, IconPlus, IconTrash, IconUsers, IconUserCheck,
  IconUserOff, IconClock, IconFilter, IconFilterOff
} from '@tabler/icons-react';
import { attendanceAPI, employeeAPI } from '../../services/api';

const getStatusColor = (s) => ({ Present: 'green', Absent: 'red', 'Half Day': 'yellow' }[s] || 'gray');

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

const AttendanceList = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [dateRange, setDateRange] = useState([new Date(), new Date()]);
  const [filters, setFilters] = useState({ employee: null, status: null });

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchAttendance(); }, [dateRange, filters]);

  const fetchEmployees = async () => {
    try {
      const res = await employeeAPI.getAll({ status: 'Active', limit: 500 });
      setEmployees(res.data || []);
    } catch {}
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange[0]) params.startDate = dateRange[0].toISOString().split('T')[0];
      if (dateRange[1]) params.endDate = dateRange[1].toISOString().split('T')[0];
      if (filters.employee) params.employeeId = filters.employee;
      if (filters.status) params.status = filters.status;
      const res = await attendanceAPI.getAll(params);
      setRecords(res.data || []);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load attendance', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (rec) => {
    modals.openConfirmModal({
      title: 'Delete Record',
      children: <Text size="sm">Delete attendance record for <b>{rec.employeeId?.name}</b> on {formatDate(rec.date)}?</Text>,
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

  const present = records.filter(r => r.status === 'Present').length;
  const absent = records.filter(r => r.status === 'Absent').length;
  const halfDay = records.filter(r => r.status === 'Half Day').length;
  const hasFilters = filters.employee || filters.status;

  const StatCard = ({ icon, label, value, color }) => (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group>
        <ThemeIcon size={44} radius="md" variant="light" color={color}>{icon}</ThemeIcon>
        <div>
          <Text fw={700} size="xl">{value}</Text>
          <Text size="sm" c="dimmed">{label}</Text>
        </div>
      </Group>
    </Card>
  );

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Attendance</Title>
          <Text c="dimmed" size="sm">View and manage daily attendance records</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/hrm/attendance/mark')}>
          Mark Attendance
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <StatCard icon={<IconUserCheck size={22} />} label="Present" value={present} color="green" />
        <StatCard icon={<IconUserOff size={22} />} label="Absent" value={absent} color="red" />
        <StatCard icon={<IconClock size={22} />} label="Half Day" value={halfDay} color="yellow" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconFilter size={16} />
            <Text fw={600} size="sm">Filters</Text>
          </Group>
          {hasFilters && (
            <Button variant="subtle" size="xs" leftSection={<IconFilterOff size={14} />}
              onClick={() => setFilters({ employee: null, status: null })}>
              Clear
            </Button>
          )}
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <DatePickerInput
            type="range" label="Date Range" placeholder="Select range"
            value={dateRange} onChange={setDateRange} clearable
          />
          <Select
            label="Employee" placeholder="All Employees"
            data={employees.map(e => ({ value: e._id, label: e.name }))}
            value={filters.employee} onChange={(v) => setFilters({ ...filters, employee: v })}
            clearable searchable
          />
          <Select
            label="Status" placeholder="All Status"
            data={['Present', 'Absent', 'Half Day']}
            value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
            clearable
          />
        </SimpleGrid>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {records.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconCalendarCheck size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No attendance records</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => navigate('/hrm/attendance/mark')}>
              Mark Attendance
            </Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={700}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((rec, i) => (
                  <Table.Tr key={rec._id}>
                    <Table.Td><Text size="sm" c="dimmed">{i + 1}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={600}>{rec.employeeId?.name || '-'}</Text></Table.Td>
                    <Table.Td>
                      {rec.employeeId?.department && (
                        <Badge variant="light" color="indigo" size="sm">{rec.employeeId.department}</Badge>
                      )}
                    </Table.Td>
                    <Table.Td><Text size="sm">{formatDate(rec.date)}</Text></Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={getStatusColor(rec.status)} size="sm">{rec.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        <Tooltip label="Delete">
                          <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(rec)}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
    </Container>
  );
};

export default AttendanceList;
