import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge, Table, ActionIcon,
  SimpleGrid, LoadingOverlay, Tooltip, ThemeIcon, Modal, Textarea, SegmentedControl
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent, IconPlus, IconCheck, IconX, IconTrash, IconClockHour4, IconCalendarOff,
  IconCalendarCheck, IconEye, IconCalendarPlus, IconBan
} from '@tabler/icons-react';
import { leaveAPI, employeeAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import {
  LEAVE_TYPES, fmtDate, leaveStatusColor, leaveTypeColor
} from './hrmShared';
import StatCard from './HrmStatCard';

const LeaveList = () => {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [viewLeave, setViewLeave] = useState(null);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [dateRange, setDateRange] = useState([new Date(new Date().getFullYear(), 0, 1), new Date(new Date().getFullYear(), 11, 31)]);
  const [statusTab, setStatusTab] = useState('Pending');
  const [filters, setFilters] = useState({ employee: null, leaveType: null });
  const noteRef = useRef('');

  useEffect(() => { employeeAPI.getAll({ limit: 1000 }).then(r => setEmployees(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { fetchLeaves(); }, [dateRange, filters]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange[0]) params.startDate = localDateStr(dateRange[0]);
      if (dateRange[1]) params.endDate = localDateStr(dateRange[1]);
      if (filters.employee) params.employee = filters.employee;
      if (filters.leaveType) params.leaveType = filters.leaveType;
      const res = await leaveAPI.getAll(params);
      setLeaves(res.data || []);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load leaves', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  /** Confirm dialog with an optional note; runs action(note). */
  const confirmWithNote = ({ title, text, label, color, notePlaceholder, required, action, success }) => {
    noteRef.current = '';
    modals.openConfirmModal({
      title,
      children: (
        <Stack gap="xs">
          <Text size="sm">{text}</Text>
          <Textarea placeholder={notePlaceholder} autosize minRows={2} onChange={(e) => { noteRef.current = e.target.value; }} data-autofocus />
        </Stack>
      ),
      labels: { confirm: label, cancel: 'Close' },
      confirmProps: { color },
      onConfirm: async () => {
        if (required && !noteRef.current.trim()) {
          notifications.show({ title: 'Reason required', message: 'Please enter a reason', color: 'orange' });
          return;
        }
        try {
          await action(noteRef.current.trim());
          notifications.show({ title: success, message: '', color: 'green' });
          closeView();
          fetchLeaves();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const name = (l) => l.employeeId?.name || 'employee';
  const handleApprove = (l) => confirmWithNote({
    title: 'Approve Leave', color: 'green', label: 'Approve', success: 'Leave approved — attendance marked',
    text: <>Approve {l.days} day(s) {l.leaveType} leave for <b>{name(l)}</b> ({fmtDate(l.fromDate)} – {fmtDate(l.toDate)})?</>,
    notePlaceholder: 'Remarks (optional)', action: (n) => leaveAPI.approve(l._id, { remarks: n })
  });
  const handleReject = (l) => confirmWithNote({
    title: 'Reject Leave', color: 'red', label: 'Reject', success: 'Leave rejected', required: true,
    text: <>Reject leave for <b>{name(l)}</b>?</>,
    notePlaceholder: 'Reason for rejection', action: (n) => leaveAPI.reject(l._id, { rejectionReason: n })
  });
  const handleCancel = (l) => confirmWithNote({
    title: 'Cancel Leave', color: 'orange', label: 'Cancel Leave', success: 'Leave cancelled',
    text: <>Cancel this {l.status.toLowerCase()} leave for <b>{name(l)}</b>?{l.status === 'Approved' && ' The Leave marks are removed from attendance.'}</>,
    notePlaceholder: 'Remarks (optional)', action: (n) => leaveAPI.cancel(l._id, { remarks: n })
  });
  const handleDelete = (l) => {
    modals.openConfirmModal({
      title: 'Delete Leave',
      children: <Text size="sm">Delete leave record for <b>{name(l)}</b>?{l.status === 'Approved' && ' Its attendance marks are removed too.'}</Text>,
      labels: { confirm: 'Delete', cancel: 'Close' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await leaveAPI.delete(l._id);
          notifications.show({ title: 'Deleted', color: 'green', message: 'Leave removed' });
          fetchLeaves();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const count = (s) => leaves.filter(l => l.status === s).length;
  const approvedDays = leaves.filter(l => l.status === 'Approved').reduce((s, l) => s + (l.days || 0), 0);
  const shown = statusTab === 'All' ? leaves : leaves.filter(l => l.status === statusTab);

  const renderActions = (l, withView = true) => (
    <Group gap={4} justify="center" wrap="nowrap">
      {l.status === 'Pending' && <>
        <Tooltip label="Approve"><ActionIcon variant="light" color="green" size="sm" onClick={() => handleApprove(l)}><IconCheck size={16} /></ActionIcon></Tooltip>
        <Tooltip label="Reject"><ActionIcon variant="light" color="red" size="sm" onClick={() => handleReject(l)}><IconX size={16} /></ActionIcon></Tooltip>
      </>}
      {['Pending', 'Approved'].includes(l.status) && (
        <Tooltip label="Cancel leave"><ActionIcon variant="light" color="orange" size="sm" onClick={() => handleCancel(l)}><IconBan size={16} /></ActionIcon></Tooltip>
      )}
      {withView && <Tooltip label="View"><ActionIcon variant="light" color="blue" size="sm" onClick={() => { setViewLeave(l); openView(); }}><IconEye size={16} /></ActionIcon></Tooltip>}
      <Tooltip label="Delete"><ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(l)}><IconTrash size={16} /></ActionIcon></Tooltip>
    </Group>
  );

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Leave Management</Title>
          <Text c="dimmed" size="sm">Approve requests — approved days flow into attendance and payroll</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/hrm/leaves/apply')}>Apply Leave</Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconClockHour4 size={22} />} label="Pending Approval" value={count('Pending')} color="yellow" />
        <StatCard icon={<IconCalendarCheck size={22} />} label="Approved" value={count('Approved')} color="green" />
        <StatCard icon={<IconCalendarOff size={22} />} label="Rejected / Cancelled" value={count('Rejected') + count('Cancelled')} color="red" />
        <StatCard icon={<IconCalendarEvent size={22} />} label="Approved Leave Days" value={approvedDays} color="blue" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="md">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <DatePickerInput type="range" label="Period" value={dateRange} onChange={setDateRange} clearable valueFormat="DD/MM/YYYY" />
          <Select label="Employee" placeholder="All Employees" searchable clearable
            data={employees.map(e => ({ value: e._id, label: `${e.employeeCode ? e.employeeCode + ' · ' : ''}${e.name}` }))}
            value={filters.employee} onChange={(v) => setFilters({ ...filters, employee: v })} />
          <Select label="Leave Type" placeholder="All Types" data={LEAVE_TYPES} clearable
            value={filters.leaveType} onChange={(v) => setFilters({ ...filters, leaveType: v })} />
        </SimpleGrid>
      </Paper>

      <SegmentedControl mb="sm" value={statusTab} onChange={setStatusTab}
        data={['Pending', 'Approved', 'Rejected', 'Cancelled', 'All'].map(s => ({ value: s, label: s === 'All' ? `All (${leaves.length})` : `${s} (${count(s)})` }))} />

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {shown.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconCalendarOff size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No {statusTab === 'All' ? '' : statusTab.toLowerCase()} leaves</Title>
            <Button variant="light" leftSection={<IconCalendarPlus size={16} />} onClick={() => navigate('/hrm/leaves/apply')}>Apply Leave</Button>
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
                {shown.map((l) => (
                  <Table.Tr key={l._id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>{l.employeeId?.name || '-'}</Text>
                      <Text size="xs" c="dimmed">{[l.employeeId?.employeeCode, l.employeeId?.department].filter(Boolean).join(' · ')}</Text>
                    </Table.Td>
                    <Table.Td><Badge variant="light" color={leaveTypeColor(l.leaveType)} size="sm">{l.leaveType}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{fmtDate(l.fromDate)}</Text></Table.Td>
                    <Table.Td><Text size="sm">{fmtDate(l.toDate)}</Text></Table.Td>
                    <Table.Td ta="center"><Badge variant="filled" color="gray" size="sm" radius="sm">{l.days}</Badge></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed" lineClamp={1} maw={180}>{l.reason || '-'}</Text></Table.Td>
                    <Table.Td><Text size="sm">{fmtDate(l.createdAt)}</Text></Table.Td>
                    <Table.Td><Badge variant="light" color={leaveStatusColor(l.status)} size="sm">{l.status}</Badge></Table.Td>
                    <Table.Td>{renderActions(l)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal opened={viewOpened} onClose={closeView} title={<Text fw={600}>Leave Details</Text>} size="md">
        {viewLeave && (
          <Stack gap="sm">
            {[
              ['Employee', `${viewLeave.employeeId?.name || ''} ${viewLeave.employeeId?.employeeCode ? `(${viewLeave.employeeId.employeeCode})` : ''}`],
              ['Department', viewLeave.employeeId?.department || '-'],
              ['Period', `${fmtDate(viewLeave.fromDate)} – ${fmtDate(viewLeave.toDate)} · ${viewLeave.days} day(s)`],
              ['Applied on', fmtDate(viewLeave.createdAt)],
              ['Actioned on', viewLeave.actionedAt ? fmtDate(viewLeave.actionedAt) : '-']
            ].map(([k, v]) => (
              <Group key={k} justify="space-between"><Text size="sm" c="dimmed">{k}</Text><Text size="sm" fw={500}>{v}</Text></Group>
            ))}
            <Group justify="space-between">
              <Badge variant="light" color={leaveTypeColor(viewLeave.leaveType)}>{viewLeave.leaveType}</Badge>
              <Badge variant="light" color={leaveStatusColor(viewLeave.status)}>{viewLeave.status}</Badge>
            </Group>
            <Paper p="sm" bg="gray.0" radius="sm"><Text size="xs" c="dimmed">Reason</Text><Text size="sm">{viewLeave.reason || '-'}</Text></Paper>
            {viewLeave.remarks && <Paper p="sm" bg="blue.0" radius="sm"><Text size="xs" c="dimmed">Remarks</Text><Text size="sm">{viewLeave.remarks}</Text></Paper>}
            {viewLeave.rejectionReason && <Paper p="sm" bg="red.0" radius="sm"><Text size="xs" c="dimmed">Rejection Reason</Text><Text size="sm" c="red">{viewLeave.rejectionReason}</Text></Paper>}
            {renderActions(viewLeave, false)}
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default LeaveList;
