import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Textarea, SimpleGrid, Alert,
  Checkbox, Table, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarPlus, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { leaveAPI, employeeAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import {
  LEAVE_TYPES, QUOTA_TYPES, leaveTypeColor
} from './hrmShared';

const defaultForm = { employeeId: null, fromDate: null, toDate: null, leaveType: 'Casual', reason: '', autoApprove: false };

const LeaveApply = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    employeeAPI.getAll({ status: 'Active', limit: 1000 }).then(res => setEmployees(res.data || []));
  }, []);

  const year = (form.fromDate ? new Date(form.fromDate) : new Date()).getFullYear();
  useEffect(() => {
    if (!form.employeeId) { setBalance(null); return; }
    leaveAPI.getBalance(form.employeeId, year).then(r => setBalance(r.data?.balance || null)).catch(() => setBalance(null));
  }, [form.employeeId, year]);

  const days = (() => {
    if (!form.fromDate || !form.toDate) return 0;
    const a = new Date(form.fromDate); const b = new Date(form.toDate);
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((b - a) / 86400000) + 1);
  })();

  const typeBal = balance?.[form.leaveType];
  const overQuota = QUOTA_TYPES.includes(form.leaveType) && typeBal && days > typeBal.balance;

  const handleSubmit = async () => {
    if (!form.employeeId || !form.fromDate || !form.toDate) {
      return notifications.show({ title: 'Validation', message: 'Employee, From Date and To Date are required', color: 'orange' });
    }
    if (new Date(form.toDate) < new Date(form.fromDate)) {
      return notifications.show({ title: 'Validation', message: 'To Date must be on or after From Date', color: 'orange' });
    }
    setLoading(true);
    try {
      await leaveAPI.create({
        employeeId: form.employeeId,
        fromDate: localDateStr(new Date(form.fromDate)),
        toDate: localDateStr(new Date(form.toDate)),
        leaveType: form.leaveType,
        reason: form.reason,
        autoApprove: form.autoApprove
      });
      notifications.show({
        title: 'Saved',
        message: form.autoApprove ? 'Leave approved and marked in attendance' : 'Leave application submitted for approval',
        color: 'green'
      });
      navigate('/hrm/leaves');
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to apply leave', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="md" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Apply Leave</Title>
          <Text c="dimmed" size="sm">On approval the days are marked “Leave” in attendance; Unpaid leave is deducted as LOP in payroll</Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 5 }}>
        <Paper shadow="sm" p="xl" radius="md" withBorder style={{ gridColumn: 'span 3' }}>
          <Stack gap="md">
            <Select label="Employee" placeholder="Select employee" required searchable
              data={employees.map(e => ({ value: e._id, label: `${e.employeeCode ? e.employeeCode + ' · ' : ''}${e.name}${e.department ? ` (${e.department})` : ''}` }))}
              value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })} />

            <Select label="Leave Type" required data={LEAVE_TYPES} value={form.leaveType}
              onChange={(v) => setForm({ ...form, leaveType: v })} />

            <SimpleGrid cols={2}>
              <DatePickerInput label="From Date" required value={form.fromDate} valueFormat="DD/MM/YYYY"
                onChange={(v) => setForm({ ...form, fromDate: v, toDate: form.toDate && v && new Date(form.toDate) < new Date(v) ? v : form.toDate })} />
              <DatePickerInput label="To Date" required value={form.toDate} valueFormat="DD/MM/YYYY"
                onChange={(v) => setForm({ ...form, toDate: v })} minDate={form.fromDate ? new Date(form.fromDate) : undefined} />
            </SimpleGrid>

            {days > 0 && (
              <Alert icon={overQuota ? <IconAlertTriangle size={16} /> : <IconInfoCircle size={16} />} color={overQuota ? 'red' : 'blue'} variant="light">
                Duration: <b>{days} day(s)</b>
                {typeBal && typeBal.balance != null && <> · {form.leaveType} balance: <b>{typeBal.balance}</b></>}
                {overQuota && <> — not enough balance. Choose Unpaid leave or raise the allotment on the employee.</>}
              </Alert>
            )}

            <Textarea label="Reason" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />

            <Checkbox label="Approve now (sanctioned by office) — mark attendance immediately"
              checked={form.autoApprove} onChange={(e) => setForm({ ...form, autoApprove: e.currentTarget.checked })} />

            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => navigate('/hrm/leaves')}>Cancel</Button>
              <Button leftSection={<IconCalendarPlus size={16} />} onClick={handleSubmit} loading={loading} disabled={overQuota}>
                {form.autoApprove ? 'Save & Approve' : 'Submit Application'}
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper shadow="sm" p="md" radius="md" withBorder style={{ gridColumn: 'span 2' }}>
          <Text fw={600} mb="xs">Leave Balance {year}</Text>
          {!balance ? (
            <Text size="sm" c="dimmed">Select an employee</Text>
          ) : (
            <Table fz="sm" verticalSpacing={4}>
              <Table.Thead><Table.Tr><Table.Th>Type</Table.Th><Table.Th ta="right">Allotted</Table.Th><Table.Th ta="right">Used</Table.Th><Table.Th ta="right">Pending</Table.Th><Table.Th ta="right">Balance</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {LEAVE_TYPES.map(t => {
                  const b = balance[t] || {};
                  if (!QUOTA_TYPES.includes(t) && !b.used && !b.pending) return null;
                  return (
                    <Table.Tr key={t} bg={t === form.leaveType ? 'var(--mantine-color-blue-0)' : undefined}>
                      <Table.Td><Badge size="xs" variant="light" color={leaveTypeColor(t)}>{t}</Badge></Table.Td>
                      <Table.Td ta="right">{b.allotted ?? '—'}</Table.Td>
                      <Table.Td ta="right">{b.used || 0}</Table.Td>
                      <Table.Td ta="right">{b.pending || 0}</Table.Td>
                      <Table.Td ta="right" fw={700} c={b.balance != null && b.balance <= 0 ? 'red' : undefined}>{b.balance ?? '—'}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </SimpleGrid>
    </Container>
  );
};

export default LeaveApply;
