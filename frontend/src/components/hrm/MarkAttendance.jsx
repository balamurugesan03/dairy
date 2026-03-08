import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge,
  Table, LoadingOverlay, ThemeIcon, SimpleGrid, Card
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarCheck, IconArrowLeft, IconUsers, IconUserCheck, IconUserOff, IconClock
} from '@tabler/icons-react';
import { attendanceAPI, employeeAPI } from '../../services/api';

const STATUS_OPTIONS = ['Present', 'Absent', 'Half Day'];

const getStatusColor = (s) => ({ Present: 'green', Absent: 'red', 'Half Day': 'yellow' }[s] || 'gray');

const MarkAttendance = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAndInit(); }, [selectedDate]);

  const fetchAndInit = async () => {
    setLoading(true);
    try {
      const res = await employeeAPI.getAll({ status: 'Active', limit: 500 });
      const employees = res.data || [];

      // Fetch existing attendance for this date
      const dateStr = selectedDate.toISOString().split('T')[0];
      const existing = await attendanceAPI.getByDate(dateStr);
      const existingMap = {};
      (existing.data || []).forEach(r => { existingMap[r.employeeId?._id || r.employeeId] = r.status; });

      setAttendanceData(employees.map(emp => ({
        employeeId: emp._id,
        name: emp.name,
        department: emp.department || '',
        role: emp.role || '',
        status: existingMap[emp._id] || 'Present'
      })));
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load employees', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (index, status) => {
    setAttendanceData(prev => {
      const d = [...prev];
      d[index] = { ...d[index], status };
      return d;
    });
  };

  const handleBulkAction = (status) => {
    setAttendanceData(prev => prev.map(r => ({ ...r, status })));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const records = attendanceData.map(r => ({
        employeeId: r.employeeId,
        date: dateStr,
        status: r.status
      }));
      await attendanceAPI.bulkMark({ attendanceRecords: records });
      notifications.show({ title: 'Success', message: 'Attendance saved successfully', color: 'green' });
      navigate('/hrm/attendance');
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to save attendance', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const present = attendanceData.filter(r => r.status === 'Present').length;
  const absent = attendanceData.filter(r => r.status === 'Absent').length;
  const halfDay = attendanceData.filter(r => r.status === 'Half Day').length;

  const StatCard = ({ icon, label, value, color }) => (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group>
        <ThemeIcon size={40} radius="md" variant="light" color={color}>{icon}</ThemeIcon>
        <div>
          <Text fw={700} size="lg">{value}</Text>
          <Text size="xs" c="dimmed">{label}</Text>
        </div>
      </Group>
    </Card>
  );

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Mark Attendance</Title>
          <Text c="dimmed" size="sm">Record daily attendance for all employees</Text>
        </div>
        <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/hrm/attendance')}>
          Back
        </Button>
      </Group>

      {/* Date & Bulk Actions */}
      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <DatePickerInput
            label="Attendance Date"
            value={selectedDate}
            onChange={(val) => val && setSelectedDate(val)}
            maxDate={new Date()}
            w={200}
          />
          <Group gap="xs">
            <Text size="sm" fw={500}>Bulk:</Text>
            <Button size="xs" color="green" variant="light" onClick={() => handleBulkAction('Present')}>
              All Present
            </Button>
            <Button size="xs" color="red" variant="light" onClick={() => handleBulkAction('Absent')}>
              All Absent
            </Button>
            <Button size="xs" color="yellow" variant="light" onClick={() => handleBulkAction('Half Day')}>
              All Half Day
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 3 }} mb="lg">
        <StatCard icon={<IconUserCheck size={20} />} label="Present" value={present} color="green" />
        <StatCard icon={<IconUserOff size={20} />} label="Absent" value={absent} color="red" />
        <StatCard icon={<IconClock size={20} />} label="Half Day" value={halfDay} color="yellow" />
      </SimpleGrid>

      {/* Attendance Table */}
      <Paper shadow="xs" radius="md" withBorder pos="relative" mb="lg">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {attendanceData.length === 0 && !loading ? (
          <Stack align="center" py={60}>
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconUsers size={32} /></ThemeIcon>
            <Text c="dimmed">No active employees found</Text>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={600}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {attendanceData.map((rec, i) => (
                  <Table.Tr key={rec.employeeId}>
                    <Table.Td><Text size="sm" c="dimmed">{i + 1}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={600}>{rec.name}</Text></Table.Td>
                    <Table.Td>
                      {rec.department && <Badge variant="light" color="indigo" size="sm">{rec.department}</Badge>}
                    </Table.Td>
                    <Table.Td><Text size="sm">{rec.role || '-'}</Text></Table.Td>
                    <Table.Td>
                      <Select
                        data={STATUS_OPTIONS}
                        value={rec.status}
                        onChange={(val) => handleStatusChange(i, val)}
                        size="xs"
                        w={130}
                        styles={{
                          input: {
                            color: rec.status === 'Present' ? 'green' : rec.status === 'Absent' ? 'red' : 'orange',
                            fontWeight: 600
                          }
                        }}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Group justify="flex-end">
        <Button
          size="md"
          leftSection={<IconCalendarCheck size={18} />}
          onClick={handleSubmit}
          loading={saving}
          disabled={attendanceData.length === 0}
        >
          Save Attendance
        </Button>
      </Group>
    </Container>
  );
};

export default MarkAttendance;
