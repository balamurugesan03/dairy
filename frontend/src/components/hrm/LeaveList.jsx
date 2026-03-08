import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge,
  Table, ActionIcon, SimpleGrid, Card, LoadingOverlay, Tooltip, ThemeIcon, Modal
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent, IconPlus, IconCheck, IconX, IconTrash,
  IconClockHour4, IconCalendarOff, IconCalendarCheck, IconFilter,
  IconFilterOff, IconEye, IconCalendarPlus
} from '@tabler/icons-react';
import { leaveAPI, employeeAPI } from '../../services/api';

const getStatusColor = (s) => ({ Pending: 'yellow', Approved: 'green', Rejected: 'red' }[s] || 'gray');
const getLeaveTypeColor = (t) => ({
  Casual: 'blue', Sick: 'red', Earned: 'green', Maternity: 'grape',
  Paternity: 'indigo', Unpaid: 'gray', Compensatory: 'orange'
}[t] || 'gray');
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const daysDiff = (from, to) => {
  const diff = new Date(to) - new Date(from);
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
};

const LeaveList = () => {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [viewLeave, setViewLeave] = useState(null);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [dateRange, setDateRange] = useState([
    new Date(new Date().setMonth(new Date().getMonth() - 1)), new Date()
  ]);
  const [filters, setFilters] = useState({ employee: null, status: null, leaveType: null });

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { fetchLeaves(); }, [dateRange, filters]);

  const fetchEmployees = async () => {
    try {
      const res = await employeeAPI.getAll({ status: 'Active', limit: 500 });
      setEmployees(res.data || []);
    } catch {}
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange[0]) params.startDate = dateRange[0].toISOString().split('T')[0];
      if (dateRange[1]) params.endDate = dateRange[1].toISOString().split('T')[0];
      if (filters.employee) params.employee = filters.employee;
      if (filters.status) params.status = filters.status;
      if (filters.leaveType) params.leaveType = filters.leaveType;
      const res = await leaveAPI.getAll(params);
      setLeaves(res.data || []);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load leaves', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (leave) => {
    modals.openConfirmModal({
      title: 'Approve Leave',
      children: <Text size="sm">Approve leave for <b>{leave.employeeId?.name}</b>?</Text>,
      labels: { confirm: 'Approve', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        try {
          await leaveAPI.approve(leave._id, { remarks: 'Approved' });
          notifications.show({ title: 'Approved', message: 'Leave approved', color: 'green' });
          fetchLeaves();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const handleReject = (leave) => {
    modals.openConfirmModal({
      title: 'Reject Leave',
      children: <Text size="sm">Reject leave for <b>{leave.employeeId?.name}</b>?</Text>,
      labels: { confirm: 'Reject', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await leaveAPI.reject(leave._id, { rejectionReason: 'Rejected by admin' });
          notifications.show({ title: 'Rejected', message: 'Leave rejected', color: 'orange' });
          fetchLeaves();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const handleDelete = (leave) => {
    modals.openConfirmModal({
      title: 'Delete Leave',
      children: <Text size="sm">Delete leave for <b>{leave.employeeId?.name}</b>?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await leaveAPI.delete(leave._id);
          notifications.show({ title: 'Deleted', color: 'green', message: 'Leave removed' });
          fetchLeaves();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const pending = leaves.filter(l => l.status === 'Pending').length;
  const approved = leaves.filter(l => l.status === 'Approved').length;
  const rejected = leaves.filter(l => l.status === 'Rejected').length;
  const totalDays = leaves.filter(l => l.status === 'Approved').reduce((s, l) => s + daysDiff(l.fromDate, l.toDate), 0);
  const hasFilters = filters.employee || filters.status || filters.leaveType;

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
          <Title order={2}>Leave Management</Title>
          <Text c="dimmed" size="sm">Manage employee leave requests and approvals</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/hrm/leaves/apply')}>
          Apply Leave
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconClockHour4 size={22} />} label="Pending" value={pending} color="yellow" />
        <StatCard icon={<IconCalendarCheck size={22} />} label="Approved" value={approved} color="green" />
        <StatCard icon={<IconCalendarOff size={22} />} label="Rejected" value={rejected} color="red" />
        <StatCard icon={<IconCalendarEvent size={22} />} label="Total Leave Days" value={totalDays} color="blue" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group justify="space-between" mb="sm">
          <Group gap="xs"><IconFilter size={16} /><Text fw={600} size="sm">Filters</Text></Group>
          {hasFilters && (
            <Button variant="subtle" size="xs" leftSection={<IconFilterOff size={14} />}
              onClick={() => setFilters({ employee: null, status: null, leaveType: null })}>
              Clear
            </Button>
          )}
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 4 }}>
          <DatePickerInput type="range" label="Date Range" placeholder="Select range"
            value={dateRange} onChange={setDateRange} clearable />
          <Select label="Employee" placeholder="All Employees"
            data={employees.map(e => ({ value: e._id, label: e.name }))}
            value={filters.employee} onChange={(v) => setFilters({ ...filters, employee: v })}
            clearable searchable />
          <Select label="Leave Type" placeholder="All Types"
            data={['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Unpaid', 'Compensatory']}
            value={filters.leaveType} onChange={(v) => setFilters({ ...filters, leaveType: v })}
            clearable />
          <Select label="Status" placeholder="All Status"
            data={['Pending', 'Approved', 'Rejected']}
            value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
            clearable />
        </SimpleGrid>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {leaves.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconCalendarOff size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No leave records found</Title>
            <Button variant="light" leftSection={<IconCalendarPlus size={16} />}
              onClick={() => navigate('/hrm/leaves/apply')}>Apply Leave</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={900}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>From</Table.Th>
                  <Table.Th>To</Table.Th>
                  <Table.Th ta="center">Days</Table.Th>
                  <Table.Th>Reason</Table.Th>
                  <Table.Th>Applied</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {leaves.map((leave) => (
                  <Table.Tr key={leave._id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{leave.employeeId?.name || '-'}</Text>
                      <Text size="xs" c="dimmed">{leave.employeeId?.department || ''}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={getLeaveTypeColor(leave.leaveType)} size="sm">
                        {leave.leaveType}
                      </Badge>
                    </Table.Td>
                    <Table.Td><Text size="sm">{formatDate(leave.fromDate)}</Text></Table.Td>
                    <Table.Td><Text size="sm">{formatDate(leave.toDate)}</Text></Table.Td>
                    <Table.Td ta="center">
                      <Badge variant="filled" color="gray" size="sm" radius="sm">
                        {daysDiff(leave.fromDate, leave.toDate)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1} maw={150}>{leave.reason || '-'}</Text>
                    </Table.Td>
                    <Table.Td><Text size="sm">{formatDate(leave.createdAt)}</Text></Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={getStatusColor(leave.status)} size="sm">
                        {leave.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        {leave.status === 'Pending' && (
                          <>
                            <Tooltip label="Approve">
                              <ActionIcon variant="light" color="green" size="sm" onClick={() => handleApprove(leave)}>
                                <IconCheck size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Reject">
                              <ActionIcon variant="light" color="red" size="sm" onClick={() => handleReject(leave)}>
                                <IconX size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip label="View">
                          <ActionIcon variant="light" color="blue" size="sm"
                            onClick={() => { setViewLeave(leave); openView(); }}>
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(leave)}>
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

      {/* View Modal */}
      <Modal opened={viewOpened} onClose={closeView} title={<Text fw={600}>Leave Details</Text>} size="md">
        {viewLeave && (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Employee</Text>
              <Text size="sm" fw={600}>{viewLeave.employeeId?.name}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Department</Text>
              <Text size="sm">{viewLeave.employeeId?.department || '-'}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Leave Type</Text>
              <Badge variant="light" color={getLeaveTypeColor(viewLeave.leaveType)}>{viewLeave.leaveType}</Badge>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">From</Text>
              <Text size="sm">{formatDate(viewLeave.fromDate)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">To</Text>
              <Text size="sm">{formatDate(viewLeave.toDate)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Days</Text>
              <Badge variant="filled" color="gray">{daysDiff(viewLeave.fromDate, viewLeave.toDate)}</Badge>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Status</Text>
              <Badge variant="light" color={getStatusColor(viewLeave.status)}>{viewLeave.status}</Badge>
            </Group>
            <div>
              <Text size="sm" c="dimmed" mb={4}>Reason</Text>
              <Paper p="sm" bg="gray.0" radius="sm">
                <Text size="sm">{viewLeave.reason || '-'}</Text>
              </Paper>
            </div>
            {viewLeave.rejectionReason && (
              <div>
                <Text size="sm" c="dimmed" mb={4}>Rejection Reason</Text>
                <Paper p="sm" bg="red.0" radius="sm">
                  <Text size="sm" c="red">{viewLeave.rejectionReason}</Text>
                </Paper>
              </div>
            )}
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default LeaveList;
