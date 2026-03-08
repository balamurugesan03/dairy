import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select,
  Textarea, ThemeIcon, SimpleGrid, Alert
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendarPlus, IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';
import { leaveAPI, employeeAPI } from '../../services/api';

const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Unpaid', 'Compensatory'];

const defaultForm = {
  employeeId: null,
  fromDate: null,
  toDate: null,
  leaveType: 'Casual',
  reason: ''
};

const LeaveApply = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    employeeAPI.getAll({ status: 'Active', limit: 500 }).then(res => setEmployees(res.data || []));
  }, []);

  const daysDiff = () => {
    if (!form.fromDate || !form.toDate) return 0;
    return Math.max(1, Math.ceil((new Date(form.toDate) - new Date(form.fromDate)) / (1000 * 60 * 60 * 24)) + 1);
  };

  const handleSubmit = async () => {
    if (!form.employeeId || !form.fromDate || !form.toDate) {
      return notifications.show({ title: 'Validation', message: 'Employee, From Date and To Date are required', color: 'orange' });
    }
    if (new Date(form.toDate) < new Date(form.fromDate)) {
      return notifications.show({ title: 'Validation', message: 'To Date must be after From Date', color: 'orange' });
    }
    setLoading(true);
    try {
      await leaveAPI.create({
        employeeId: form.employeeId,
        fromDate: form.fromDate,
        toDate: form.toDate,
        leaveType: form.leaveType,
        reason: form.reason
      });
      notifications.show({ title: 'Success', message: 'Leave application submitted', color: 'green' });
      navigate('/hrm/leaves');
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to apply leave', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Apply Leave</Title>
          <Text c="dimmed" size="sm">Submit a leave application</Text>
        </div>
        <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/hrm/leaves')}>
          Back
        </Button>
      </Group>

      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack gap="md">
          <Select
            label="Employee" placeholder="Select employee" required
            data={employees.map(e => ({ value: e._id, label: `${e.name}${e.department ? ` (${e.department})` : ''}` }))}
            value={form.employeeId}
            onChange={(v) => setForm({ ...form, employeeId: v })}
            searchable
          />

          <Select
            label="Leave Type" placeholder="Select type" required
            data={LEAVE_TYPES}
            value={form.leaveType}
            onChange={(v) => setForm({ ...form, leaveType: v })}
          />

          <SimpleGrid cols={2}>
            <DatePickerInput
              label="From Date" placeholder="Start date" required
              value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })}
              minDate={new Date()}
            />
            <DatePickerInput
              label="To Date" placeholder="End date" required
              value={form.toDate} onChange={(v) => setForm({ ...form, toDate: v })}
              minDate={form.fromDate || new Date()}
            />
          </SimpleGrid>

          {form.fromDate && form.toDate && (
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              Total leave duration: <b>{daysDiff()} day(s)</b>
            </Alert>
          )}

          <Textarea
            label="Reason" placeholder="Reason for leave..."
            rows={3}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => navigate('/hrm/leaves')}>Cancel</Button>
            <Button leftSection={<IconCalendarPlus size={16} />} onClick={handleSubmit} loading={loading}>
              Submit Application
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
};

export default LeaveApply;
