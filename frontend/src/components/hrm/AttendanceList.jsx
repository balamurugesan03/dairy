import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Table,
  Select,
  Button,
  Group,
  Stack,
  Badge,
  Text,
  Title,
  Card,
  SimpleGrid,
  Loader,
  Center,
  ActionIcon,
  Menu,
  Tooltip,
  ThemeIcon,
  Box,
  Divider,
  ScrollArea,
  Input,
  Pagination
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCalendar,
  IconCheck,
  IconChartBar,
  IconFilter,
  IconX,
  IconSearch,
  IconUser,
  IconClock,
  IconBuilding,
  IconUsers,
  IconReportAnalytics,
  IconEdit,
  IconEye,
  IconDownload,
  IconRefresh,
  IconChevronDown,
  IconChevronUp,
  IconCalendarEvent,
  IconClockHour3,
  IconDoorEnter,
  IconDoorExit,
  IconAdjustments
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { attendanceAPI, employeeAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';

const AttendanceList = () => {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(),
    endDate: new Date()
  });

  const [filters, setFilters] = useState({
    employee: '',
    status: '',
    shift: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter, filters]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 1000 });
      setEmployees(response.data || []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch employees',
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = {
        ...dateFilter,
        startDate: dateFilter.startDate?.toISOString().split('T')[0],
        endDate: dateFilter.endDate?.toISOString().split('T')[0],
        ...filters
      };

      const response = await attendanceAPI.getAll(params);
      setAttendance(response.data || []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch attendance',
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      employee: '',
      status: '',
      shift: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Present': 'green',
      'Absent': 'red',
      'Half Day': 'yellow',
      'Late': 'orange',
      'On Leave': 'blue',
      'Holiday': 'grape',
      'Week Off': 'gray'
    };
    return colors[status] || 'gray';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return new Date(time).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    const icons = {
      'Present': <IconCheck size={14} />,
      'Absent': <IconX size={14} />,
      'Late': <IconClock size={14} />,
      'On Leave': <IconCalendarEvent size={14} />,
      'Half Day': <IconClockHour3 size={14} />
    };
    return icons[status] || null;
  };

  // Calculate statistics
  const calculateStats = () => {
    const presentCount = attendance.filter(a => a.status === 'Present').length;
    const absentCount = attendance.filter(a => a.status === 'Absent').length;
    const lateCount = attendance.filter(a => a.status === 'Late').length;
    const onLeaveCount = attendance.filter(a => a.status === 'On Leave').length;
    const totalHours = attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0);
    const totalOvertime = attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);

    return {
      presentCount,
      absentCount,
      lateCount,
      onLeaveCount,
      totalHours: totalHours.toFixed(2),
      totalOvertime: totalOvertime.toFixed(2)
    };
  };

  const stats = calculateStats();

  // Paginated data
  const paginatedData = attendance.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <Container fluid py="md">
      {/* Header Section */}
      <Paper radius="md" p="md" mb="md" bg="blue.0">
        <Group position="apart" align="flex-start">
          <Group spacing="sm">
            <ThemeIcon size="xl" radius="md" color="blue" variant="light">
              <IconCalendar size={24} />
            </ThemeIcon>
            <div>
              <Title order={2} size="h2">Attendance Management</Title>
              <Text color="dimmed" size="sm">
                Track and manage employee attendance records
              </Text>
            </div>
          </Group>
          <Group spacing="sm">
            <Button
              variant="light"
              color="blue"
              leftSection={<IconReportAnalytics size={16} />}
              onClick={() => navigate('/hrm/attendance/report')}
            >
              Reports
            </Button>
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              onClick={() => navigate('/hrm/attendance/mark')}
            >
              Mark Attendance
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Statistics Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }} spacing="md" mb="md">
        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Present</Text>
              <Text size="xl" fw={700} color="green">
                {stats.presentCount}
              </Text>
            </div>
            <ThemeIcon size="md" color="green" variant="light" radius="md">
              <IconCheck size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Absent</Text>
              <Text size="xl" fw={700} color="red">
                {stats.absentCount}
              </Text>
            </div>
            <ThemeIcon size="md" color="red" variant="light" radius="md">
              <IconX size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Late</Text>
              <Text size="xl" fw={700} color="orange">
                {stats.lateCount}
              </Text>
            </div>
            <ThemeIcon size="md" color="orange" variant="light" radius="md">
              <IconClock size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">On Leave</Text>
              <Text size="xl" fw={700} color="blue">
                {stats.onLeaveCount}
              </Text>
            </div>
            <ThemeIcon size="md" color="blue" variant="light" radius="md">
              <IconCalendarEvent size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Total Hours</Text>
              <Text size="xl" fw={700}>
                {stats.totalHours}
              </Text>
            </div>
            <ThemeIcon size="md" color="violet" variant="light" radius="md">
              <IconClockHour3 size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Overtime</Text>
              <Text size="xl" fw={700} color="orange">
                {stats.totalOvertime}
              </Text>
            </div>
            <ThemeIcon size="md" color="orange" variant="light" radius="md">
              <IconClock size={18} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters Section */}
      <Paper withBorder radius="md" p="md" mb="md">
        <Stack spacing="md">
          <Group position="apart">
            <Group spacing="xs">
              <ThemeIcon color="blue" variant="light">
                <IconFilter size={18} />
              </ThemeIcon>
              <Text fw={600}>Filters</Text>
            </Group>
            <Group spacing="xs">
              <Tooltip label="Refresh">
                <ActionIcon
                  variant="light"
                  color="blue"
                  onClick={fetchAttendance}
                  loading={loading}
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              {hasActiveFilters && (
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  onClick={clearFilters}
                  leftSection={<IconX size={14} />}
                >
                  Clear Filters
                </Button>
              )}
            </Group>
          </Group>

          {/* Date Range Filter */}
          <DatePickerInput
            type="range"
            label="Date Range"
            placeholder="Select date range"
            value={[dateFilter.startDate, dateFilter.endDate]}
            onChange={([start, end]) => setDateFilter({ startDate: start, endDate: end })}
            maxDate={new Date()}
            clearable
            icon={<IconCalendar size={16} />}
          />

          {/* Other Filters */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Select
              label="Employee"
              placeholder="All Employees"
              value={filters.employee}
              onChange={(value) => handleFilterChange('employee', value)}
              data={[
                { value: '', label: 'All Employees' },
                ...employees.map(emp => ({
                  value: emp._id,
                  label: `${emp.personalDetails?.name} (${emp.employeeNumber})`
                }))
              ]}
              searchable
              clearable
              icon={<IconUser size={16} />}
            />

            <Select
              label="Status"
              placeholder="All Status"
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              data={[
                { value: '', label: 'All Status' },
                { value: 'Present', label: 'Present' },
                { value: 'Absent', label: 'Absent' },
                { value: 'Half Day', label: 'Half Day' },
                { value: 'Late', label: 'Late' },
                { value: 'On Leave', label: 'On Leave' },
                { value: 'Holiday', label: 'Holiday' },
                { value: 'Week Off', label: 'Week Off' }
              ]}
              clearable
            />

            <Select
              label="Shift"
              placeholder="All Shifts"
              value={filters.shift}
              onChange={(value) => handleFilterChange('shift', value)}
              data={[
                { value: '', label: 'All Shifts' },
                { value: 'Morning', label: 'Morning' },
                { value: 'Evening', label: 'Evening' },
                { value: 'Night', label: 'Night' },
                { value: 'General', label: 'General' }
              ]}
              clearable
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Attendance Table */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <ScrollArea>
          {loading ? (
            <Center py="xl">
              <Stack align="center" spacing="md">
                <Loader size="lg" />
                <Text color="dimmed">Loading attendance records...</Text>
              </Stack>
            </Center>
          ) : attendance.length === 0 ? (
            <Center py="xl">
              <Stack align="center" spacing="md">
                <ThemeIcon size={60} color="gray" variant="light" radius="xl">
                  <IconCalendar size={32} />
                </ThemeIcon>
                <div>
                  <Text size="lg" fw={500} ta="center" mb="xs">
                    No attendance records found
                  </Text>
                  <Text color="dimmed" ta="center" size="sm">
                    No attendance data for the selected period
                  </Text>
                </div>
                <Button
                  color="blue"
                  onClick={() => navigate('/hrm/attendance/mark')}
                  leftSection={<IconCheck size={16} />}
                >
                  Mark Attendance
                </Button>
              </Stack>
            </Center>
          ) : (
            <>
              <Table verticalSpacing="sm" fontSize="md">
                <thead style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Shift</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Working Hours</th>
                    <th>Overtime</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((record) => (
                    <tr key={record._id}>
                      <td>
                        <Text fw={500}>{formatDate(record.date)}</Text>
                      </td>
                      <td>
                        <Stack spacing={2}>
                          <Text fw={500}>
                            {record.employee?.personalDetails?.name}
                          </Text>
                          <Text size="xs" color="dimmed">
                            {record.employee?.employeeNumber}
                          </Text>
                        </Stack>
                      </td>
                      <td>
                        <Badge variant="light" color="blue">
                          {record.shift}
                        </Badge>
                      </td>
                      <td>
                        <Group spacing="xs">
                          <IconDoorEnter size={14} color="green" />
                          <Text fw={500}>{formatTime(record.checkIn)}</Text>
                        </Group>
                      </td>
                      <td>
                        <Group spacing="xs">
                          <IconDoorExit size={14} color="red" />
                          <Text fw={500}>{formatTime(record.checkOut)}</Text>
                        </Group>
                      </td>
                      <td>
                        <Text fw={600}>{record.workingHours?.toFixed(2) || '0.00'} hrs</Text>
                      </td>
                      <td>
                        <Text fw={600} color="orange">
                          {record.overtimeHours?.toFixed(2) || '0.00'} hrs
                        </Text>
                      </td>
                      <td>
                        <Badge
                          color={getStatusColor(record.status)}
                          variant="filled"
                          leftSection={getStatusIcon(record.status)}
                          size="md"
                        >
                          {record.status}
                        </Badge>
                      </td>
                      <td>
                        <Text size="sm" lineClamp={1}>
                          {record.remarks || '-'}
                        </Text>
                      </td>
                      <td>
                        <Group spacing="xs" wrap="nowrap">
                          <Tooltip label="View Details">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => navigate(`/hrm/attendance/${record._id}`)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="light"
                              color="orange"
                              size="sm"
                              onClick={() => navigate(`/hrm/attendance/${record._id}/edit`)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {attendance.length > itemsPerPage && (
                <Box p="md">
                  <Group position="apart">
                    <Text size="sm" color="dimmed">
                      Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, attendance.length)} of {attendance.length} records
                    </Text>
                    <Pagination
                      value={page}
                      onChange={setPage}
                      total={Math.ceil(attendance.length / itemsPerPage)}
                      size="sm"
                    />
                  </Group>
                </Box>
              )}
            </>
          )}
        </ScrollArea>
      </Paper>
    </Container>
  );
};

export default AttendanceList;