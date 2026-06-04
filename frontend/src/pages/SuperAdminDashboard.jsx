import { useState, useEffect, useRef } from 'react';
import {
  Box, Button, Badge, Divider, Group, Loader,
  Modal, PasswordInput, Stack, Table, Text, TextInput, Textarea,
  Title, Tooltip, ActionIcon, Avatar, Paper, Checkbox, SimpleGrid,
  Center, ThemeIcon, CopyButton, Stepper, Card, Alert
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconBuilding, IconUsers, IconPlus, IconLock, IconTrash,
  IconToggleLeft, IconToggleRight, IconLogout, IconShieldCheck,
  IconBuildingStore, IconRefresh, IconChartBar, IconCopy, IconCheck,
  IconRefreshAlert, IconEye, IconEyeOff, IconPhone, IconMail,
  IconMapPin, IconKey, IconArrowRight, IconArrowLeft, IconAlertCircle
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { companyAPI, adminMilmaChartAPI } from '../services/api';

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }) => (
  <Paper withBorder p="lg" radius="md">
    <Group>
      <ThemeIcon size={48} radius="md" color={color} variant="light">
        <Icon size={26} />
      </ThemeIcon>
      <Box>
        <Text size="xl" fw={700} lh={1}>{value}</Text>
        <Text size="sm" c="dimmed" mt={4}>{label}</Text>
      </Box>
    </Group>
  </Paper>
);

// ─── Business type badge ──────────────────────────────────────────────────────
const TypeBadge = ({ type }) => (
  <Badge
    size="xs"
    variant="light"
    color={type === 'Dairy Cooperative Society' ? 'blue' : 'grape'}
  >
    {type === 'Dairy Cooperative Society' ? 'Dairy' : 'Private'}
  </Badge>
);

const BUSINESS_TYPES = ['Dairy Cooperative Society', 'Private Firm'];

// ─── Credential Generators ───────────────────────────────────────────────────
const genPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};
const genUsername = (companyName) =>
  (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'company';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [companies, setCompanies]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [addOpen, setAddOpen]       = useState(false);
  const [pwdOpen, setPwdOpen]       = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [credsOpen, setCredsOpen]   = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [showPwd, setShowPwd]       = useState(false);
  const [resetPwdShow, setResetPwdShow] = useState(false);
  const [step, setStep]             = useState(0);

  // ── Add company form ────────────────────────────────────────────────────────
  const form = useForm({
    initialValues: {
      username: '', password: '', companyName: '', businessTypes: [],
      societyName: '', societyCode: '', state: '', district: '', address: '',
      phone: '', email: '', gstNumber: '', panNumber: '', milmaCode: '',
      dateOfRegistration: '', startDate: '', ssiRegistration: '',
      ssiRegistrationDate: '', yearOfAudit: '', auditClassification: ''
    },
    validate: {
      companyName:   (v) => (!v.trim() ? 'Company name is required' : null),
      username:      (v) => (!v.trim() ? 'Username is required' : null),
      password:      (v) => (v.length < 6 ? 'Password must be at least 6 characters' : null),
      businessTypes: (v) => (v.length === 0 ? 'Select at least one business type' : null),
    }
  });

  // Auto-fill username when company name changes (only if username not yet edited)
  const handleCompanyNameChange = (e) => {
    const name = e.target.value;
    form.setFieldValue('companyName', name);
    if (!form.isTouched('username') || !form.values.username) {
      form.setFieldValue('username', genUsername(name));
    }
  };

  const openAddModal = () => {
    form.reset();
    form.setFieldValue('password', genPassword());
    setShowPwd(false);
    setStep(0);
    setAddOpen(true);
  };

  // Per-step field validation before advancing
  const STEP_FIELDS = [
    ['companyName', 'businessTypes'],
    ['username', 'password'],
  ];
  const nextStep = () => {
    const fields = STEP_FIELDS[step];
    if (fields) {
      fields.forEach(f => form.validateField(f));
      const hasErr = fields.some(f => form.validateField(f).hasError);
      if (hasErr) return;
    }
    setStep(s => s + 1);
  };

  // ── Fetch companies ─────────────────────────────────────────────────────────
  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await companyAPI.getAll({ all: true });
      if (res.success) setCompanies(res.data || []);
    } catch {
      notifications.show({ color: 'red', message: 'Failed to load companies' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  // ── Create company ──────────────────────────────────────────────────────────
  const handleCreate = async (values) => {
    setSaving(true);
    const plainPassword = values.password;
    try {
      const payload = {
        ...values,
        username: values.username.trim().toLowerCase(),
        dateOfRegistration:  values.dateOfRegistration  || undefined,
        startDate:           values.startDate           || undefined,
        ssiRegistrationDate: values.ssiRegistrationDate || undefined,
      };
      const res = await companyAPI.create(payload);
      if (!res.success) throw new Error(res.message);
      setAddOpen(false);
      form.reset();
      fetchCompanies();
      // Show credentials modal
      setCreatedCreds({ username: payload.username, password: plainPassword, companyName: values.companyName });
      setShowPwd(true);
      setCredsOpen(true);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to create company' });
    } finally {
      setSaving(false);
    }
  };

  // ── Reset password ──────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      notifications.show({ color: 'red', message: 'Password must be at least 6 characters' });
      return;
    }
    setSaving(true);
    try {
      const res = await companyAPI.update(selectedCompany._id, { password: newPassword });
      if (!res.success) throw new Error(res.message);
      notifications.show({ color: 'green', message: 'Password reset successfully' });
      setPwdOpen(false);
      setNewPassword('');
      setSelectedCompany(null);
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Failed to reset password' });
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle status ───────────────────────────────────────────────────────────
  const handleToggleStatus = (company) => {
    const newStatus = company.status === 'Active' ? 'Inactive' : 'Active';
    modals.openConfirmModal({
      title: `${newStatus === 'Inactive' ? 'Deactivate' : 'Activate'} Company`,
      children: (
        <Text size="sm">
          Are you sure you want to <b>{newStatus === 'Inactive' ? 'deactivate' : 'activate'}</b>{' '}
          <b>{company.companyName}</b>?
        </Text>
      ),
      labels: { confirm: newStatus === 'Inactive' ? 'Deactivate' : 'Activate', cancel: 'Cancel' },
      confirmProps: { color: newStatus === 'Inactive' ? 'orange' : 'green' },
      onConfirm: async () => {
        try {
          const res = await companyAPI.update(company._id, { status: newStatus });
          if (!res.success) throw new Error(res.message);
          notifications.show({ color: 'green', message: `Company ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully` });
          fetchCompanies();
        } catch (err) {
          notifications.show({ color: 'red', message: err.message || 'Failed to update status' });
        }
      }
    });
  };

  // ── Delete company ──────────────────────────────────────────────────────────
  const handleDelete = (company) => {
    modals.openConfirmModal({
      title: 'Delete Company',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Are you sure you want to permanently delete <b>{company.companyName}</b>?
          </Text>
          <Text size="xs" c="red" fw={600}>
            This action cannot be undone. All associated data will be lost.
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Delete Permanently', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const res = await companyAPI.delete(company._id);
          if (!res.success) throw new Error(res.message);
          notifications.show({ color: 'green', message: `Company "${company.companyName}" deleted` });
          fetchCompanies();
        } catch (err) {
          notifications.show({ color: 'red', message: err.message || 'Failed to delete company' });
        }
      }
    });
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalCompanies  = companies.length;
  const activeCompanies = companies.filter(c => c.status === 'Active').length;
  const dairyCompanies  = companies.filter(c => c.businessTypes?.includes('Dairy Cooperative Society')).length;
  const privateCompanies = companies.filter(c => c.businessTypes?.includes('Private Firm')).length;

  // ── Rows ────────────────────────────────────────────────────────────────────
  const rows = companies.map((company) => (
    <Table.Tr key={company._id}>
      <Table.Td>
        <Group gap="sm">
          <Avatar size={34} radius="xl" color="blue" variant="light">
            {company.companyName?.charAt(0)?.toUpperCase()}
          </Avatar>
          <Box>
            <Text size="sm" fw={600}>{company.companyName}</Text>
            {company.societyCode && <Text size="xs" c="dimmed">{company.societyCode}</Text>}
          </Box>
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          {company.businessTypes?.map((t, i) => <TypeBadge key={i} type={t} />)}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">{company.username || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{company.phone || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">{company.state || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Badge
          size="sm"
          variant="dot"
          color={company.status === 'Active' ? 'green' : 'red'}
        >
          {company.status}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end">
          <Tooltip label="Reset Password" withArrow>
            <ActionIcon
              variant="light" color="blue" size="sm" radius="sm"
              onClick={() => { setSelectedCompany(company); setNewPassword(''); setResetPwdShow(false); setPwdOpen(true); }}
            >
              <IconLock size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={company.status === 'Active' ? 'Deactivate' : 'Activate'} withArrow>
            <ActionIcon
              variant="light"
              color={company.status === 'Active' ? 'orange' : 'green'}
              size="sm" radius="sm"
              onClick={() => handleToggleStatus(company)}
            >
              {company.status === 'Active'
                ? <IconToggleLeft size={14} />
                : <IconToggleRight size={14} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete" withArrow>
            <ActionIcon
              variant="light" color="red" size="sm" radius="sm"
              onClick={() => handleDelete(company)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Box style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Paper
        shadow="xs"
        style={{ borderRadius: 0, borderBottom: '1px solid #e2e8f0', background: '#fff' }}
        px="xl" py="sm"
      >
        <Group justify="space-between">
          <Group gap="sm">
            <ThemeIcon size={38} radius="md" color="blue" variant="filled">
              <IconShieldCheck size={22} />
            </ThemeIcon>
            <Box>
              <Title order={5} lh={1}>Super Admin Panel</Title>
              <Text size="xs" c="dimmed">Dairy ERP Management System</Text>
            </Box>
          </Group>
          <Group gap="sm">
            <Badge variant="light" color="blue" size="sm" leftSection={<IconShieldCheck size={11} />}>
              {user?.username}
            </Badge>
            <Button
              leftSection={<IconLogout size={14} />}
              variant="subtle" color="red" size="xs"
              onClick={logout}
            >
              Logout
            </Button>
          </Group>
        </Group>
      </Paper>

      <Box p="xl">
        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl">
          <StatCard icon={IconBuilding}      label="Total Companies"   value={totalCompanies}   color="blue" />
          <StatCard icon={IconChartBar}      label="Active Companies"  value={activeCompanies}  color="green" />
          <StatCard icon={IconUsers}         label="Dairy Societies"   value={dairyCompanies}   color="cyan" />
          <StatCard icon={IconBuildingStore} label="Private Firms"     value={privateCompanies} color="grape" />
        </SimpleGrid>

        {/* ── Companies Table ────────────────────────────────────────────────── */}
        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
          <Group justify="space-between" p="md" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <Title order={5}>Companies</Title>
            <Group gap="xs">
              <ActionIcon variant="subtle" color="gray" onClick={fetchCompanies} title="Refresh">
                <IconRefresh size={16} />
              </ActionIcon>
              <Button
                leftSection={<IconPlus size={14} />}
                size="xs" radius="sm"
                onClick={openAddModal}
              >
                Add Company
              </Button>
            </Group>
          </Group>

          {loading ? (
            <Center py={60}>
              <Stack align="center" gap="sm">
                <Loader size="md" />
                <Text size="sm" c="dimmed">Loading companies...</Text>
              </Stack>
            </Center>
          ) : companies.length === 0 ? (
            <Center py={60}>
              <Stack align="center" gap="xs">
                <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                  <IconBuilding size={24} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">No companies yet. Click "Add Company" to get started.</Text>
              </Stack>
            </Center>
          ) : (
            <Table striped highlightOnHover withRowBorders={false} verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead style={{ background: '#f8fafc' }}>
                <Table.Tr>
                  <Table.Th><Text size="xs" fw={600} tt="uppercase" c="dimmed">Company</Text></Table.Th>
                  <Table.Th><Text size="xs" fw={600} tt="uppercase" c="dimmed">Type</Text></Table.Th>
                  <Table.Th><Text size="xs" fw={600} tt="uppercase" c="dimmed">Username</Text></Table.Th>
                  <Table.Th><Text size="xs" fw={600} tt="uppercase" c="dimmed">Phone</Text></Table.Th>
                  <Table.Th><Text size="xs" fw={600} tt="uppercase" c="dimmed">State</Text></Table.Th>
                  <Table.Th><Text size="xs" fw={600} tt="uppercase" c="dimmed">Status</Text></Table.Th>
                  <Table.Th ta="right"><Text size="xs" fw={600} tt="uppercase" c="dimmed">Actions</Text></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          )}
        </Paper>
      </Box>

      {/* ── Add Company Modal ─────────────────────────────────────────────────── */}
      <Modal
        opened={addOpen}
        onClose={() => { setAddOpen(false); setStep(0); }}
        title={
          <Group gap="xs">
            <ThemeIcon size={32} radius="md" color="blue" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              <IconBuilding size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md" lh={1}>Add New Company</Text>
              <Text size="xs" c="dimmed">Fill in the details to create a company account</Text>
            </Box>
          </Group>
        }
        size="lg"
        radius="lg"
        padding="xl"
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stepper active={step} color="blue" size="sm" mb="xl">
            <Stepper.Step
              label="Company Info"
              description="Name & type"
              icon={<IconBuilding size={16} />}
            />
            <Stepper.Step
              label="Credentials"
              description="Login details"
              icon={<IconKey size={16} />}
            />
            <Stepper.Step
              label="Contact"
              description="Address & registration"
              icon={<IconMapPin size={16} />}
            />
          </Stepper>

          {/* ── Step 0: Company Info ─────────────────────────── */}
          {step === 0 && (
            <Stack gap="md">
              <TextInput
                label="Company Name"
                placeholder="e.g. Kerala Dairy Society"
                required
                size="md"
                leftSection={<IconBuilding size={16} />}
                {...form.getInputProps('companyName')}
                onChange={handleCompanyNameChange}
              />

              <Box>
                <Text size="sm" fw={600} mb={8}>
                  Business Type <Text span c="red">*</Text>
                </Text>
                <SimpleGrid cols={2} spacing="sm">
                  {BUSINESS_TYPES.map(type => {
                    const selected = form.values.businessTypes.includes(type);
                    return (
                      <Card
                        key={type}
                        withBorder
                        radius="md"
                        p="sm"
                        style={{
                          cursor: 'pointer',
                          borderColor: selected ? 'var(--mantine-color-blue-5)' : undefined,
                          background: selected ? 'var(--mantine-color-blue-0)' : undefined,
                          transition: 'all 0.15s',
                        }}
                        onClick={() => {
                          const cur = form.values.businessTypes;
                          form.setFieldValue('businessTypes',
                            cur.includes(type) ? cur.filter(t => t !== type) : [...cur, type]
                          );
                        }}
                      >
                        <Group gap="xs">
                          <Checkbox
                            checked={selected}
                            readOnly
                            size="sm"
                            color="blue"
                          />
                          <Text size="sm" fw={selected ? 600 : 400}>
                            {type}
                          </Text>
                        </Group>
                      </Card>
                    );
                  })}
                </SimpleGrid>
                {form.errors.businessTypes && (
                  <Text size="xs" c="red" mt={4}>{form.errors.businessTypes}</Text>
                )}
              </Box>

              <SimpleGrid cols={2} spacing="sm">
                <TextInput
                  label="Society Name"
                  placeholder="Society name"
                  {...form.getInputProps('societyName')}
                />
                <TextInput
                  label="Society Code"
                  placeholder="Society code"
                  {...form.getInputProps('societyCode')}
                />
              </SimpleGrid>
            </Stack>
          )}

          {/* ── Step 1: Credentials ──────────────────────────── */}
          {step === 1 && (
            <Stack gap="md">
              <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" radius="md">
                <Text size="xs">
                  Auto-generated credentials for <strong>{form.values.companyName}</strong>.
                  You can edit them before saving. <strong>Save the password</strong> — it won't be shown again after creation.
                </Text>
              </Alert>

              <Paper withBorder radius="md" p="md" bg="blue.0" style={{ borderColor: 'var(--mantine-color-blue-3)' }}>
                <Stack gap="sm">
                  <TextInput
                    label="Username"
                    placeholder="Login username"
                    required
                    size="md"
                    leftSection={<IconUsers size={16} />}
                    {...form.getInputProps('username')}
                  />

                  <Box>
                    <Text size="sm" fw={500} mb={4}>Password <Text span c="red">*</Text></Text>
                    <Group gap="xs" align="flex-start">
                      <TextInput
                        placeholder="Min 6 characters"
                        required
                        size="md"
                        style={{ flex: 1 }}
                        type={showPwd ? 'text' : 'password'}
                        ff="monospace"
                        rightSection={
                          <ActionIcon variant="subtle" color="gray" onClick={() => setShowPwd(p => !p)}>
                            {showPwd ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </ActionIcon>
                        }
                        {...form.getInputProps('password')}
                      />
                      <Tooltip label="Generate new password" withArrow>
                        <ActionIcon
                          size={42}
                          variant="light"
                          color="blue"
                          radius="md"
                          onClick={() => { form.setFieldValue('password', genPassword()); setShowPwd(true); }}
                        >
                          <IconRefreshAlert size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    {form.errors.password && <Text size="xs" c="red" mt={4}>{form.errors.password}</Text>}
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          )}

          {/* ── Step 2: Contact & Registration ───────────────── */}
          {step === 2 && (
            <Stack gap="md">
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">Contact Details</Text>
              <SimpleGrid cols={2} spacing="sm">
                <TextInput
                  label="Phone"
                  placeholder="Phone number"
                  leftSection={<IconPhone size={15} />}
                  {...form.getInputProps('phone')}
                />
                <TextInput
                  label="Email"
                  placeholder="Email address"
                  type="email"
                  leftSection={<IconMail size={15} />}
                  {...form.getInputProps('email')}
                />
              </SimpleGrid>
              <SimpleGrid cols={2} spacing="sm">
                <TextInput label="State" placeholder="State" leftSection={<IconMapPin size={15} />} {...form.getInputProps('state')} />
                <TextInput label="District" placeholder="District" {...form.getInputProps('district')} />
              </SimpleGrid>
              <Textarea label="Address" placeholder="Full address" rows={2} {...form.getInputProps('address')} />

              <Divider label={<Text size="xs" fw={600} c="dimmed" tt="uppercase">Registration Details</Text>} labelPosition="left" />

              <SimpleGrid cols={2} spacing="sm">
                <TextInput label="GST Number" placeholder="GST Number" {...form.getInputProps('gstNumber')} />
                <TextInput label="PAN Number" placeholder="PAN Number" {...form.getInputProps('panNumber')} />
              </SimpleGrid>
              <SimpleGrid cols={2} spacing="sm">
                <TextInput label="Milma Code" placeholder="Milma Code" {...form.getInputProps('milmaCode')} />
                <TextInput label="SSI Registration" placeholder="SSI Reg. No" {...form.getInputProps('ssiRegistration')} />
              </SimpleGrid>
              <SimpleGrid cols={2} spacing="sm">
                <TextInput label="Date of Registration" type="date" {...form.getInputProps('dateOfRegistration')} />
                <TextInput label="Start Date" type="date" {...form.getInputProps('startDate')} />
              </SimpleGrid>
              <SimpleGrid cols={2} spacing="sm">
                <TextInput label="SSI Registration Date" type="date" {...form.getInputProps('ssiRegistrationDate')} />
                <TextInput label="Year of Audit" placeholder="e.g. 2023-24" {...form.getInputProps('yearOfAudit')} />
              </SimpleGrid>
              <TextInput label="Audit Classification" placeholder="Audit classification" {...form.getInputProps('auditClassification')} />
            </Stack>
          )}

          {/* ── Navigation ───────────────────────────────────── */}
          <Group justify="space-between" mt="xl">
            <Button
              variant="subtle" color="gray"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => step === 0 ? setAddOpen(false) : setStep(s => s - 1)}
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>

            {step < 2 ? (
              <Button
                rightSection={<IconArrowRight size={14} />}
                onClick={nextStep}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                loading={saving}
                color="blue"
                leftSection={<IconBuilding size={14} />}
              >
                Create Company
              </Button>
            )}
          </Group>
        </form>
      </Modal>

      {/* ── Reset Password Modal ───────────────────────────────────────────────── */}
      <Modal
        opened={pwdOpen}
        onClose={() => { setPwdOpen(false); setNewPassword(''); setSelectedCompany(null); setResetPwdShow(false); }}
        title={
          <Group gap="xs">
            <ThemeIcon size={32} radius="md" color="orange" variant="gradient" gradient={{ from: 'orange', to: 'red' }}>
              <IconLock size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md" lh={1}>Reset Password</Text>
              <Text size="xs" c="dimmed">Set a new login password for the company</Text>
            </Box>
          </Group>
        }
        size="sm"
        radius="lg"
        padding="xl"
      >
        {selectedCompany && (
          <Stack gap="lg">
            {/* Company Info Card */}
            <Paper withBorder radius="md" p="md" bg="gray.0">
              <Group gap="sm">
                <Avatar size={42} radius="xl" color="blue" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                  {selectedCompany.companyName?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box>
                  <Text size="sm" fw={700}>{selectedCompany.companyName}</Text>
                  <Group gap={6} mt={2}>
                    <IconUsers size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    <Text size="xs" c="dimmed" ff="monospace">{selectedCompany.username}</Text>
                  </Group>
                </Box>
                <Badge
                  ml="auto"
                  size="sm"
                  variant="dot"
                  color={selectedCompany.status === 'Active' ? 'green' : 'red'}
                >
                  {selectedCompany.status}
                </Badge>
              </Group>
            </Paper>

            {/* New Password */}
            <Box>
              <Text size="sm" fw={600} mb={6}>New Password</Text>
              <Group gap="xs" align="flex-start">
                <TextInput
                  placeholder="Enter new password (min 6 chars)"
                  size="md"
                  style={{ flex: 1 }}
                  type={resetPwdShow ? 'text' : 'password'}
                  ff="monospace"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  rightSection={
                    <ActionIcon variant="subtle" color="gray" onClick={() => setResetPwdShow(p => !p)}>
                      {resetPwdShow ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </ActionIcon>
                  }
                />
                <Tooltip label="Auto-generate password" withArrow>
                  <ActionIcon
                    size={42}
                    variant="light"
                    color="orange"
                    radius="md"
                    onClick={() => { setNewPassword(genPassword()); setResetPwdShow(true); }}
                  >
                    <IconRefreshAlert size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              {newPassword.length > 0 && newPassword.length < 6 && (
                <Text size="xs" c="red" mt={4}>Password must be at least 6 characters</Text>
              )}
            </Box>

            {/* Actions */}
            <Group justify="space-between">
              <Button
                variant="subtle" color="gray"
                onClick={() => { setPwdOpen(false); setNewPassword(''); setSelectedCompany(null); setResetPwdShow(false); }}
              >
                Cancel
              </Button>
              <Button
                loading={saving}
                color="orange"
                onClick={handleResetPassword}
                leftSection={<IconLock size={14} />}
                disabled={newPassword.length < 6}
              >
                Reset Password
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* ── Created Credentials Modal ─────────────────────────────────────────── */}
      <Modal
        opened={credsOpen}
        onClose={() => setCredsOpen(false)}
        title={
          <Group gap="xs">
            <ThemeIcon size={24} radius="sm" color="green"><IconCheck size={14} /></ThemeIcon>
            <Text fw={600}>Company Created — Login Credentials</Text>
          </Group>
        }
        size="sm"
        radius="md"
        padding="xl"
        closeOnClickOutside={false}
      >
        {createdCreds && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Company <b>{createdCreds.companyName}</b> created successfully.
              Save these credentials — the password cannot be retrieved later.
            </Text>

            <Paper withBorder p="md" radius="sm" bg="blue.0">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" fw={600}>USERNAME</Text>
                    <Text size="sm" fw={700} ff="monospace">{createdCreds.username}</Text>
                  </Box>
                  <CopyButton value={createdCreds.username}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                        <ActionIcon variant="light" color={copied ? 'teal' : 'blue'} size="sm" onClick={copy}>
                          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>

                <Divider />

                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" fw={600}>PASSWORD</Text>
                    <Text size="sm" fw={700} ff="monospace">
                      {showPwd ? createdCreds.password : '••••••••••'}
                    </Text>
                  </Box>
                  <Group gap={4}>
                    <Tooltip label={showPwd ? 'Hide' : 'Show'} withArrow>
                      <ActionIcon variant="light" color="gray" size="sm" onClick={() => setShowPwd(p => !p)}>
                        {showPwd ? <IconEyeOff size={13} /> : <IconEye size={13} />}
                      </ActionIcon>
                    </Tooltip>
                    <CopyButton value={createdCreds.password}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                          <ActionIcon variant="light" color={copied ? 'teal' : 'blue'} size="sm" onClick={copy}>
                            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </Group>
              </Stack>
            </Paper>

            <Text size="xs" c="orange.7" fw={500}>
              ⚠ Note this password down now. It will not be shown again.
            </Text>

            <Group justify="flex-end">
              <Button color="green" onClick={() => setCredsOpen(false)} leftSection={<IconCheck size={14} />}>
                Done — I have saved the credentials
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
