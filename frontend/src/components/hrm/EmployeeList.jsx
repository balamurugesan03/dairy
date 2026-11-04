import { useState, useEffect, useMemo } from 'react';
import {
  Container, Title, Text, Paper, Group, Stack, Button, Select, Badge, Table, ActionIcon,
  SimpleGrid, LoadingOverlay, Tooltip, ThemeIcon, TextInput, Modal, NumberInput, Textarea,
  Tabs, Switch, Drawer, Divider, Progress, ScrollArea, SegmentedControl
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconEdit, IconTrash, IconUsers, IconUserCheck, IconUserOff, IconSearch,
  IconUser, IconEye, IconCurrencyRupee, IconBriefcase, IconBuildingBank, IconCalendarEvent,
  IconPower
} from '@tabler/icons-react';
import { employeeAPI } from '../../services/api';
import {
  DEPARTMENTS, ROLES, EMPLOYMENT_TYPES, QUOTA_TYPES, fmt, fmtDate, periodLabel, payrollStatusColor, leaveStatusColor, leaveTypeColor, ATTENDANCE
} from './hrmShared';
import StatCard from './HrmStatCard';

const emptyForm = () => ({
  employeeCode: '', name: '', fatherName: '', gender: '', dob: null, mobile: '', email: '', address: '',
  emergencyContact: '', aadhaar: '', pan: '',
  department: '', role: '', employmentType: 'Permanent', joiningDate: new Date(), status: 'Active',
  salaryType: 'Monthly', salary: 0,
  salaryStructure: { basic: 0, da: 0, hra: 0, ta: 0, otherAllowance: 0 },
  otRatePerHour: 0,
  pfApplicable: false, pfPercent: 12, pfNumber: '', esiApplicable: false, esiPercent: 0.75, esiNumber: '',
  professionalTax: 0,
  paymentMode: 'Cash', bankName: '', accountNo: '', ifsc: '',
  leaveQuota: { Casual: 12, Sick: 12, Earned: 15 }
});

const toForm = (emp) => {
  const f = emptyForm();
  for (const k of Object.keys(f)) if (emp[k] !== undefined && emp[k] !== null) f[k] = emp[k];
  f.salaryStructure = { ...f.salaryStructure, ...(emp.salaryStructure || {}) };
  f.leaveQuota = { ...f.leaveQuota, ...(emp.leaveQuota || {}) };
  f.joiningDate = emp.joiningDate ? new Date(emp.joiningDate) : null;
  f.dob = emp.dob ? new Date(emp.dob) : null;
  // Older employees: no structure yet → put the salary in Basic
  const s = f.salaryStructure;
  if (f.salaryType === 'Monthly' && !(s.basic + s.da + s.hra + s.ta + s.otherAllowance)) s.basic = emp.salary || 0;
  return f;
};

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const [statusFilter, setStatusFilter] = useState('Active');
  const [deptFilter, setDeptFilter] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, monthlySalaryCost: 0 });
  const [profile, setProfile] = useState(null);
  const [profileOpened, { open: openProfile, close: closeProfile }] = useDisclosure(false);

  useEffect(() => { fetchEmployees(); }, [debounced, statusFilter, deptFilter]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = { limit: 1000 };
      if (debounced) params.search = debounced;
      if (statusFilter && statusFilter !== 'All') params.status = statusFilter;
      if (deptFilter) params.department = deptFilter;
      const res = await employeeAPI.getAll(params);
      setEmployees(res.data || []);
      if (res.statistics) setStats(res.statistics);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load employees', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setStruct = (k, v) => setForm(f => ({ ...f, salaryStructure: { ...f.salaryStructure, [k]: Number(v) || 0 } }));
  const setQuota = (k, v) => setForm(f => ({ ...f, leaveQuota: { ...f.leaveQuota, [k]: Number(v) || 0 } }));

  const structTotal = useMemo(() => {
    const s = form.salaryStructure;
    return (s.basic || 0) + (s.da || 0) + (s.hra || 0) + (s.ta || 0) + (s.otherAllowance || 0);
  }, [form.salaryStructure]);

  const pfPreview = form.pfApplicable ? Math.round(((form.salaryStructure.basic || 0) + (form.salaryStructure.da || 0)) * (form.pfPercent || 0) / 100) : 0;
  const esiPreview = form.esiApplicable ? Math.ceil(structTotal * (form.esiPercent || 0) / 100) : 0;

  const departmentOptions = useMemo(() => {
    const set_ = new Set([...DEPARTMENTS, ...employees.map(e => e.department).filter(Boolean), ...Object.keys(stats.departments || {})]);
    set_.delete('Unassigned');
    return [...set_];
  }, [employees, stats]);
  const roleOptions = useMemo(() => [...new Set([...ROLES, ...employees.map(e => e.role).filter(Boolean)])], [employees]);

  const openAdd = async () => {
    const f = emptyForm();
    try { const r = await employeeAPI.getNextCode(); f.employeeCode = r.data?.employeeCode || ''; } catch { /* optional */ }
    setForm(f);
    setEditId(null);
    setTab('personal');
    openModal();
  };

  const handleEdit = (emp) => {
    setForm(toForm(emp));
    setEditId(emp._id);
    setTab('personal');
    openModal();
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.mobile.trim()) {
      setTab('personal');
      return notifications.show({ title: 'Validation', message: 'Name and mobile are required', color: 'orange' });
    }
    const monthlyFromStructure = form.salaryType === 'Monthly' && structTotal > 0;
    if (!monthlyFromStructure && !(form.salary > 0)) {
      setTab('salary');
      return notifications.show({ title: 'Validation', message: form.salaryType === 'Daily' ? 'Enter the daily wage' : 'Enter the salary structure', color: 'orange' });
    }
    if (form.paymentMode === 'Bank' && !form.accountNo) {
      setTab('bank');
      return notifications.show({ title: 'Validation', message: 'Bank account number is required for bank payment', color: 'orange' });
    }
    setSaving(true);
    try {
      const payload = { ...form, salary: monthlyFromStructure ? structTotal : form.salary };
      if (editId) {
        await employeeAPI.update(editId, payload);
        notifications.show({ title: 'Saved', message: `${form.name} updated`, color: 'green' });
      } else {
        await employeeAPI.create(payload);
        notifications.show({ title: 'Saved', message: `${form.name} added`, color: 'green' });
      }
      closeModal();
      fetchEmployees();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to save', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (emp) => {
    const toInactive = emp.status === 'Active';
    modals.openConfirmModal({
      title: toInactive ? 'Mark Inactive (Exit)' : 'Re-activate Employee',
      children: <Text size="sm">{toInactive
        ? <>Mark <b>{emp.name}</b> inactive? Exit date is set to today; salary for this month is paid only up to today.</>
        : <>Re-activate <b>{emp.name}</b>? The exit date will be cleared.</>}</Text>,
      labels: { confirm: toInactive ? 'Mark Inactive' : 'Activate', cancel: 'Cancel' },
      confirmProps: { color: toInactive ? 'orange' : 'green' },
      onConfirm: async () => {
        try {
          await employeeAPI.updateStatus(emp._id, toInactive ? 'Inactive' : 'Active');
          fetchEmployees();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const handleDelete = (emp) => {
    modals.openConfirmModal({
      title: 'Delete Employee',
      children: <Text size="sm">Delete <b>{emp.name}</b>? Their attendance and leave records are removed too. Employees with payroll or loans can only be marked Inactive.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await employeeAPI.delete(emp._id);
          notifications.show({ title: 'Deleted', message: 'Employee removed', color: 'green' });
          fetchEmployees();
        } catch (err) {
          notifications.show({ title: 'Cannot delete', message: err.message, color: 'red' });
        }
      }
    });
  };

  const showProfile = async (emp) => {
    setProfile({ loading: true, employee: emp });
    openProfile();
    try {
      const res = await employeeAPI.getProfile(emp._id);
      setProfile(res.data);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      closeProfile();
    }
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Employee Management</Title>
          <Text c="dimmed" size="sm">Staff master — salary structure, statutory, bank and leave allotment drive Attendance, Leave and Payroll</Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={openAdd}>Add Employee</Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        <StatCard icon={<IconUsers size={22} />} label="Total Employees" value={stats.total} color="blue" />
        <StatCard icon={<IconUserCheck size={22} />} label="Active" value={stats.active} color="green" />
        <StatCard icon={<IconUserOff size={22} />} label="Inactive" value={stats.inactive} color="gray" />
        <StatCard icon={<IconCurrencyRupee size={22} />} label="Monthly Salary Cost" value={fmt(stats.monthlySalaryCost)} color="teal" sub="Active staff, gross" />
      </SimpleGrid>

      <Paper shadow="xs" p="md" radius="md" withBorder mb="lg">
        <Group>
          <TextInput placeholder="Search name, code, mobile, role..." leftSection={<IconSearch size={16} />}
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
          <Select placeholder="All Departments" data={departmentOptions} value={deptFilter} onChange={setDeptFilter} clearable searchable w={200} />
          <SegmentedControl value={statusFilter} onChange={setStatusFilter} data={['Active', 'Inactive', 'All']} />
        </Group>
      </Paper>

      <Paper shadow="xs" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ blur: 2 }} />
        {employees.length === 0 && !loading ? (
          <Stack align="center" py={60} gap="md">
            <ThemeIcon size={64} radius="xl" variant="light" color="gray"><IconUsers size={32} /></ThemeIcon>
            <Title order={4} c="dimmed">No employees found</Title>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openAdd}>Add Employee</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={1000}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Mobile</Table.Th>
                  <Table.Th>Department / Role</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th ta="right">Salary</Table.Th>
                  <Table.Th>Statutory</Table.Th>
                  <Table.Th>Pay Mode</Table.Th>
                  <Table.Th>Joined</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {employees.map((emp) => (
                  <Table.Tr key={emp._id}>
                    <Table.Td><Text size="sm" ff="monospace">{emp.employeeCode || '-'}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap" style={{ cursor: 'pointer' }} onClick={() => showProfile(emp)}>
                        <ThemeIcon size={28} radius="xl" variant="light" color="blue"><IconUser size={14} /></ThemeIcon>
                        <Text size="sm" fw={600} c="blue">{emp.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td><Text size="sm">{emp.mobile}</Text></Table.Td>
                    <Table.Td>
                      {emp.department && <Badge variant="light" color="indigo" size="sm">{emp.department}</Badge>}
                      <Text size="xs" c="dimmed">{emp.role || ''}</Text>
                    </Table.Td>
                    <Table.Td><Text size="xs">{emp.employmentType || 'Permanent'}</Text></Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600} c="teal">{fmt(emp.salary)}</Text>
                      <Text size="xs" c="dimmed">{emp.salaryType === 'Daily' ? 'per day' : 'per month'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {emp.pfApplicable && <Badge size="xs" variant="outline">PF</Badge>}
                        {emp.esiApplicable && <Badge size="xs" variant="outline" color="grape">ESI</Badge>}
                        {emp.professionalTax > 0 && <Badge size="xs" variant="outline" color="orange">PT</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td><Badge size="sm" variant="light" color={emp.paymentMode === 'Bank' ? 'cyan' : 'gray'}>{emp.paymentMode || 'Cash'}</Badge></Table.Td>
                    <Table.Td><Text size="sm">{fmtDate(emp.joiningDate)}</Text></Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={emp.status === 'Active' ? 'green' : 'gray'} size="sm">{emp.status}</Badge>
                      {emp.exitDate && <Text size="xs" c="dimmed">Exit {fmtDate(emp.exitDate)}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center" wrap="nowrap">
                        <Tooltip label="Profile"><ActionIcon variant="light" size="sm" onClick={() => showProfile(emp)}><IconEye size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Edit"><ActionIcon variant="light" color="blue" size="sm" onClick={() => handleEdit(emp)}><IconEdit size={16} /></ActionIcon></Tooltip>
                        <Tooltip label={emp.status === 'Active' ? 'Mark Inactive' : 'Activate'}>
                          <ActionIcon variant="light" color={emp.status === 'Active' ? 'orange' : 'green'} size="sm" onClick={() => toggleStatus(emp)}><IconPower size={16} /></ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete"><ActionIcon variant="light" color="red" size="sm" onClick={() => handleDelete(emp)}><IconTrash size={16} /></ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      {/* ── Add / Edit ─────────────────────────────────────────────── */}
      <Modal opened={modalOpened} onClose={closeModal} size="xl"
        title={<Text fw={600}>{editId ? `Edit Employee — ${form.employeeCode}` : 'Add Employee'}</Text>}>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="personal" leftSection={<IconUser size={14} />}>Personal</Tabs.Tab>
            <Tabs.Tab value="job" leftSection={<IconBriefcase size={14} />}>Job</Tabs.Tab>
            <Tabs.Tab value="salary" leftSection={<IconCurrencyRupee size={14} />}>Salary & Statutory</Tabs.Tab>
            <Tabs.Tab value="bank" leftSection={<IconBuildingBank size={14} />}>Bank & Leave</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="personal">
            <Stack gap="sm">
              <SimpleGrid cols={3}>
                <TextInput label="Employee Code" value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} description="Auto-generated; editable" />
                <TextInput label="Full Name" required value={form.name} onChange={(e) => set('name', e.target.value)} data-autofocus />
                <TextInput label="Father / Spouse Name" value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} />
              </SimpleGrid>
              <SimpleGrid cols={3}>
                <Select label="Gender" data={['Male', 'Female', 'Other']} value={form.gender || null} onChange={(v) => set('gender', v || '')} clearable />
                <DatePickerInput label="Date of Birth" value={form.dob} onChange={(v) => set('dob', v)} clearable maxDate={new Date()} valueFormat="DD/MM/YYYY" />
                <TextInput label="Mobile" required value={form.mobile} onChange={(e) => set('mobile', e.target.value.replace(/[^\d+ ]/g, ''))} />
              </SimpleGrid>
              <SimpleGrid cols={3}>
                <TextInput label="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                <TextInput label="Emergency Contact" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} />
                <TextInput label="Aadhaar No" value={form.aadhaar} onChange={(e) => set('aadhaar', e.target.value.replace(/\D/g, '').slice(0, 12))} />
              </SimpleGrid>
              <SimpleGrid cols={3}>
                <TextInput label="PAN" value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase().slice(0, 10))} />
              </SimpleGrid>
              <Textarea label="Address" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="job">
            <Stack gap="sm">
              <SimpleGrid cols={3}>
                <Select label="Department" data={departmentOptions} value={form.department || null} onChange={(v) => set('department', v || '')} searchable clearable />
                <Select label="Designation / Role" data={roleOptions} value={form.role || null} onChange={(v) => set('role', v || '')} searchable clearable />
                <Select label="Employment Type" data={EMPLOYMENT_TYPES} value={form.employmentType}
                  onChange={(v) => setForm(f => ({ ...f, employmentType: v, salaryType: v === 'Daily Wage' ? 'Daily' : f.salaryType }))} />
              </SimpleGrid>
              <SimpleGrid cols={3}>
                <DatePickerInput label="Joining Date" value={form.joiningDate} onChange={(v) => set('joiningDate', v)} valueFormat="DD/MM/YYYY" />
                <Select label="Status" data={['Active', 'Inactive']} value={form.status} onChange={(v) => set('status', v)} />
                {form.status === 'Inactive' && (
                  <DatePickerInput label="Exit Date" value={form.exitDate ? new Date(form.exitDate) : null} onChange={(v) => set('exitDate', v)} valueFormat="DD/MM/YYYY" clearable />
                )}
              </SimpleGrid>
              {form.status === 'Inactive' && (
                <TextInput label="Exit Reason" value={form.exitReason || ''} onChange={(e) => set('exitReason', e.target.value)} />
              )}
              <Text size="xs" c="dimmed">Days before joining and after exit are not paid in payroll.</Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="salary">
            <Stack gap="sm">
              <SegmentedControl value={form.salaryType} onChange={(v) => set('salaryType', v)}
                data={[{ value: 'Monthly', label: 'Monthly Salary' }, { value: 'Daily', label: 'Daily Wage' }]} />
              {form.salaryType === 'Monthly' ? (
                <>
                  <SimpleGrid cols={5}>
                    <NumberInput label="Basic" min={0} value={form.salaryStructure.basic} onChange={(v) => setStruct('basic', v)} thousandSeparator="," />
                    <NumberInput label="DA" min={0} value={form.salaryStructure.da} onChange={(v) => setStruct('da', v)} thousandSeparator="," />
                    <NumberInput label="HRA" min={0} value={form.salaryStructure.hra} onChange={(v) => setStruct('hra', v)} thousandSeparator="," />
                    <NumberInput label="TA / Conveyance" min={0} value={form.salaryStructure.ta} onChange={(v) => setStruct('ta', v)} thousandSeparator="," />
                    <NumberInput label="Other Allowance" min={0} value={form.salaryStructure.otherAllowance} onChange={(v) => setStruct('otherAllowance', v)} thousandSeparator="," />
                  </SimpleGrid>
                  <Paper p="sm" bg="teal.0" radius="sm">
                    <Group justify="space-between">
                      <Text fw={600}>Monthly Gross</Text>
                      <Text fw={700} size="lg" c="teal">{fmt(structTotal)}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">Paid in proportion to paid days: gross × (days in month − LOP days) ÷ days in month</Text>
                  </Paper>
                </>
              ) : (
                <NumberInput label="Daily Wage (₹)" min={0} value={form.salary} onChange={(v) => set('salary', Number(v) || 0)} w={240}
                  description="Paid for Present (+½ for Half Day), paid leave and holidays" />
              )}
              <NumberInput label="Overtime Rate per Hour (₹)" min={0} value={form.otRatePerHour} onChange={(v) => set('otRatePerHour', Number(v) || 0)} w={240}
                description="0 = gross ÷ days ÷ 8 hours" />

              <Divider label="Statutory Deductions" labelPosition="left" />
              <SimpleGrid cols={3}>
                <Stack gap={6}>
                  <Switch label="PF applicable" checked={form.pfApplicable} onChange={(e) => set('pfApplicable', e.currentTarget.checked)} />
                  {form.pfApplicable && <>
                    <NumberInput label="PF % (on Basic + DA)" size="xs" min={0} max={100} decimalScale={2} value={form.pfPercent} onChange={(v) => set('pfPercent', Number(v) || 0)} />
                    <TextInput label="PF / UAN No" size="xs" value={form.pfNumber} onChange={(e) => set('pfNumber', e.target.value)} />
                    {form.salaryType === 'Monthly' && <Text size="xs" c="dimmed">≈ {fmt(pfPreview)} / month</Text>}
                  </>}
                </Stack>
                <Stack gap={6}>
                  <Switch label="ESI applicable" checked={form.esiApplicable} onChange={(e) => set('esiApplicable', e.currentTarget.checked)} />
                  {form.esiApplicable && <>
                    <NumberInput label="ESI % (on gross)" size="xs" min={0} max={100} decimalScale={2} value={form.esiPercent} onChange={(v) => set('esiPercent', Number(v) || 0)} />
                    <TextInput label="ESI No" size="xs" value={form.esiNumber} onChange={(e) => set('esiNumber', e.target.value)} />
                    {form.salaryType === 'Monthly' && <Text size="xs" c="dimmed">≈ {fmt(esiPreview)} / month</Text>}
                  </>}
                </Stack>
                <NumberInput label="Professional Tax (₹ / month)" min={0} value={form.professionalTax} onChange={(v) => set('professionalTax', Number(v) || 0)} />
              </SimpleGrid>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="bank">
            <Stack gap="sm">
              <SegmentedControl value={form.paymentMode} onChange={(v) => set('paymentMode', v)}
                data={[{ value: 'Cash', label: 'Salary by Cash' }, { value: 'Bank', label: 'Salary by Bank' }]} w={320} />
              <SimpleGrid cols={3}>
                <TextInput label="Bank Name" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
                <TextInput label="Account No" required={form.paymentMode === 'Bank'} value={form.accountNo} onChange={(e) => set('accountNo', e.target.value.replace(/\s/g, ''))} />
                <TextInput label="IFSC" value={form.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase().slice(0, 11))} />
              </SimpleGrid>
              <Divider label="Leave allotment per year (days)" labelPosition="left" />
              <SimpleGrid cols={3}>
                {QUOTA_TYPES.map(t => (
                  <NumberInput key={t} label={`${t} Leave`} min={0} value={form.leaveQuota[t]} onChange={(v) => setQuota(t, v)} />
                ))}
              </SimpleGrid>
              <Text size="xs" c="dimmed">Casual / Sick / Earned leave is blocked beyond this balance. Unpaid leave is unlimited but deducted as LOP.</Text>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group justify="space-between" mt="lg">
          <Group gap="xs">
            {tab !== 'bank' && <Button variant="light" onClick={() => setTab({ personal: 'job', job: 'salary', salary: 'bank' }[tab])}>Next</Button>}
          </Group>
          <Group gap="xs">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editId ? 'Update' : 'Save Employee'}</Button>
          </Group>
        </Group>
      </Modal>

      {/* ── Profile drawer ─────────────────────────────────────────── */}
      <Drawer opened={profileOpened} onClose={closeProfile} position="right" size="lg"
        title={<Text fw={700}>{profile?.employee?.name} <Text span c="dimmed" size="sm">{profile?.employee?.employeeCode}</Text></Text>}>
        {profile && <EmployeeProfile profile={profile} onEdit={() => { closeProfile(); handleEdit(profile.employee); }} />}
      </Drawer>
    </Container>
  );
};

const Row = ({ label, value }) => (
  <Group justify="space-between" gap="xs" wrap="nowrap">
    <Text size="sm" c="dimmed">{label}</Text>
    <Text size="sm" fw={500} ta="right">{value || '-'}</Text>
  </Group>
);

const EmployeeProfile = ({ profile, onEdit }) => {
  if (profile.loading) return <LoadingOverlay visible />;
  const { employee: e, attendance, leaveBalance, loans, loanOutstanding, payrolls, leaves } = profile;
  const s = e.salaryStructure || {};
  const a = attendance?.summary || {};
  return (
    <ScrollArea h="calc(100vh - 90px)" offsetScrollbars>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Badge color={e.status === 'Active' ? 'green' : 'gray'}>{e.status}</Badge>
            {e.department && <Badge variant="light" color="indigo">{e.department}</Badge>}
            <Badge variant="outline">{e.employmentType || 'Permanent'}</Badge>
          </Group>
          <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={onEdit}>Edit</Button>
        </Group>

        <Paper withBorder p="sm" radius="sm">
          <Text fw={600} size="sm" mb={6}>Details</Text>
          <SimpleGrid cols={2} spacing={4}>
            <Row label="Designation" value={e.role} />
            <Row label="Mobile" value={e.mobile} />
            <Row label="Joined" value={fmtDate(e.joiningDate)} />
            <Row label="Date of Birth" value={e.dob ? fmtDate(e.dob) : ''} />
            <Row label="Pay Mode" value={e.paymentMode === 'Bank' ? `Bank · ${e.accountNo || ''}` : 'Cash'} />
            <Row label="PF / ESI" value={[e.pfApplicable && 'PF', e.esiApplicable && 'ESI'].filter(Boolean).join(' + ') || 'None'} />
          </SimpleGrid>
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Group justify="space-between" mb={6}>
            <Text fw={600} size="sm">Salary</Text>
            <Text fw={700} c="teal">{fmt(e.salary)} {e.salaryType === 'Daily' ? '/ day' : '/ month'}</Text>
          </Group>
          {e.salaryType !== 'Daily' && (
            <SimpleGrid cols={5} spacing={4}>
              {[['Basic', s.basic], ['DA', s.da], ['HRA', s.hra], ['TA', s.ta], ['Other', s.otherAllowance]].map(([l, v]) => (
                <div key={l}><Text size="xs" c="dimmed">{l}</Text><Text size="sm">{fmt(v)}</Text></div>
              ))}
            </SimpleGrid>
          )}
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Group justify="space-between" mb={6}>
            <Text fw={600} size="sm">Attendance — {periodLabel(attendance.month, attendance.year)}</Text>
            <IconCalendarEvent size={16} />
          </Group>
          <Group gap="xs">
            {[['Present', a.present], ['Absent', a.absent], ['Half Day', a.halfDay], ['Leave', a.leave], ['Holiday', a.holiday], ['Week Off', a.weekOff]].map(([l, v]) => (
              <Badge key={l} variant="light" color={ATTENDANCE[l].color}>{l}: {v || 0}</Badge>
            ))}
            {a.overtimeHours > 0 && <Badge variant="outline">OT {a.overtimeHours} h</Badge>}
          </Group>
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Text fw={600} size="sm" mb={6}>Leave Balance {new Date().getFullYear()}</Text>
          <Stack gap={6}>
            {QUOTA_TYPES.map(t => {
              const b = leaveBalance?.[t] || {};
              const pct = b.allotted ? Math.min(100, ((b.used + b.pending) / b.allotted) * 100) : 0;
              return (
                <div key={t}>
                  <Group justify="space-between"><Text size="sm">{t}</Text>
                    <Text size="xs" c="dimmed">used {b.used || 0}{b.pending ? ` + ${b.pending} pending` : ''} of {b.allotted ?? 0} · <b>{b.balance ?? 0} left</b></Text></Group>
                  <Progress value={pct} size="sm" color={leaveTypeColor(t)} />
                </div>
              );
            })}
          </Stack>
          {leaves?.length > 0 && (
            <Stack gap={2} mt="sm">
              {leaves.slice(0, 5).map(l => (
                <Group key={l._id} justify="space-between" gap="xs">
                  <Text size="xs">{fmtDate(l.fromDate)} – {fmtDate(l.toDate)} · {l.leaveType} ({l.days}d)</Text>
                  <Badge size="xs" variant="light" color={leaveStatusColor(l.status)}>{l.status}</Badge>
                </Group>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Group justify="space-between" mb={6}>
            <Text fw={600} size="sm">Loans / Advances</Text>
            <Text size="sm" c="red" fw={600}>Outstanding {fmt(loanOutstanding)}</Text>
          </Group>
          {loans?.length ? loans.map(l => (
            <Group key={l._id} justify="space-between" gap="xs">
              <Text size="xs">{fmtDate(l.loanDate)} · {l.loanType} {fmt(l.totalAmount)}{l.emiAmount ? ` · EMI ${fmt(l.emiAmount)}` : ''}</Text>
              <Text size="xs" c={l.status === 'Active' ? 'red' : 'green'}>{l.status === 'Active' ? `${fmt(l.remainingAmount)} due` : 'Closed'}</Text>
            </Group>
          )) : <Text size="xs" c="dimmed">None</Text>}
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Text fw={600} size="sm" mb={6}>Recent Payroll</Text>
          {payrolls?.length ? (
            <Table fz="xs" verticalSpacing={4}>
              <Table.Thead><Table.Tr><Table.Th>Period</Table.Th><Table.Th ta="right">Paid Days</Table.Th><Table.Th ta="right">Gross</Table.Th><Table.Th ta="right">Net</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {payrolls.map(p => (
                  <Table.Tr key={p._id}>
                    <Table.Td>{periodLabel(p.month, p.year)}</Table.Td>
                    <Table.Td ta="right">{p.attendance?.paidDays ?? '-'}</Table.Td>
                    <Table.Td ta="right">{fmt(p.grossSalary || (p.basicSalary + p.overtime))}</Table.Td>
                    <Table.Td ta="right">{fmt(p.netSalary)}</Table.Td>
                    <Table.Td><Badge size="xs" variant="light" color={payrollStatusColor(p.status)}>{p.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text size="xs" c="dimmed">No payroll yet</Text>}
        </Paper>
      </Stack>
    </ScrollArea>
  );
};

export default EmployeeList;
