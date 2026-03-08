import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select,
  NumberInput, SimpleGrid, Alert, Divider, ThemeIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCurrencyRupee, IconInfoCircle, IconCalculator } from '@tabler/icons-react';
import { salaryAPI, employeeAPI } from '../../services/api';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' }
];

const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = new Date().getFullYear() - i;
  return { value: String(y), label: String(y) };
});

const ProcessSalary = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [empData, setEmpData] = useState(null);
  const [form, setForm] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    basicSalary: 0,
    overtime: 0,
    deduction: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    employeeAPI.getAll({ status: 'Active', limit: 500 }).then(res => setEmployees(res.data || []));
  }, []);

  const handleEmployeeChange = (id) => {
    setSelectedEmployee(id);
    const emp = employees.find(e => e._id === id);
    if (emp) {
      setEmpData(emp);
      setForm(f => ({ ...f, basicSalary: emp.salary || 0 }));
    }
  };

  const netSalary = (form.basicSalary || 0) + (form.overtime || 0) - (form.deduction || 0);

  const handleSubmit = async () => {
    if (!selectedEmployee) {
      return notifications.show({ title: 'Validation', message: 'Please select an employee', color: 'orange' });
    }
    setLoading(true);
    try {
      await salaryAPI.process({
        employeeId: selectedEmployee,
        basicSalary: form.basicSalary,
        overtime: form.overtime,
        deduction: form.deduction,
        month: parseInt(form.month),
        year: parseInt(form.year)
      });
      notifications.show({ title: 'Success', message: 'Salary processed successfully', color: 'green' });
      navigate('/hrm/salary');
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to process salary', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Process Salary</Title>
          <Text c="dimmed" size="sm">Generate payroll for an employee</Text>
        </div>
        <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/hrm/salary')}>
          Back
        </Button>
      </Group>

      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack gap="md">
          <SimpleGrid cols={2}>
            <Select
              label="Month" data={MONTHS}
              value={form.month} onChange={(v) => setForm({ ...form, month: v })}
            />
            <Select
              label="Year" data={yearOptions}
              value={form.year} onChange={(v) => setForm({ ...form, year: v })}
            />
          </SimpleGrid>

          <Select
            label="Employee" placeholder="Select employee" required
            data={employees.map(e => ({ value: e._id, label: `${e.name}${e.department ? ` — ${e.department}` : ''}` }))}
            value={selectedEmployee}
            onChange={handleEmployeeChange}
            searchable
          />

          {empData && (
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              Default salary from employee record: <b>₹{(empData.salary || 0).toLocaleString('en-IN')}</b>
            </Alert>
          )}

          <Divider label="Salary Breakdown" labelPosition="center" />

          <NumberInput
            label="Basic Salary (₹)" required min={0}
            value={form.basicSalary}
            onChange={(v) => setForm({ ...form, basicSalary: v })}
            leftSection={<IconCurrencyRupee size={16} />}
          />

          <SimpleGrid cols={2}>
            <NumberInput
              label="Overtime (₹)" min={0}
              value={form.overtime}
              onChange={(v) => setForm({ ...form, overtime: v })}
              description="Extra earnings"
            />
            <NumberInput
              label="Deduction (₹)" min={0}
              value={form.deduction}
              onChange={(v) => setForm({ ...form, deduction: v })}
              description="Loans, advances, etc."
            />
          </SimpleGrid>

          <Paper p="md" bg="teal.0" radius="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <ThemeIcon variant="light" color="teal" size={32}><IconCalculator size={18} /></ThemeIcon>
                <Text fw={600}>Net Salary</Text>
              </Group>
              <Text fw={700} size="xl" c="teal">₹{netSalary.toLocaleString('en-IN')}</Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>Basic ({form.basicSalary}) + Overtime ({form.overtime}) − Deduction ({form.deduction})</Text>
          </Paper>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => navigate('/hrm/salary')}>Cancel</Button>
            <Button leftSection={<IconCurrencyRupee size={16} />} onClick={handleSubmit} loading={loading}>
              Generate Payroll
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
};

export default ProcessSalary;
