import { useState, useEffect } from 'react';
import {
  AppShell, Box, Button, Badge, Card, Divider, Grid, Group, Loader,
  Modal, PasswordInput, Stack, Table, Text, TextInput, Textarea,
  Title, Tooltip, ActionIcon, Avatar, Paper, Checkbox, SimpleGrid,
  Center, ThemeIcon, Anchor
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconBuilding, IconUsers, IconPlus, IconLock, IconTrash,
  IconToggleLeft, IconToggleRight, IconLogout, IconShieldCheck,
  IconBuildingStore, IconRefresh, IconChartBar
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { companyAPI } from '../services/api';

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
      notifications.show({ color: 'green', title: 'Success', message: 'Company created successfully' });
      setAddOpen(false);
      form.reset();
      fetchCompanies();
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
              onClick={() => { setSelectedCompany(company); setPwdOpen(true); }}
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
                onClick={() => { form.reset(); setAddOpen(true); }}
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
        onClose={() => setAddOpen(false)}
        title={<Group gap="xs"><ThemeIcon size={24} radius="sm" color="blue"><IconBuilding size={14} /></ThemeIcon><Text fw={600}>Add New Company</Text></Group>}
        size="xl"
        radius="md"
        padding="xl"
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          {/* Login Credentials */}
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Login Credentials</Text>
          <SimpleGrid cols={2} mb="md">
            <TextInput label="Username" placeholder="Login username" required {...form.getInputProps('username')} />
            <PasswordInput label="Password" placeholder="Min 6 characters" required {...form.getInputProps('password')} />
          </SimpleGrid>
          <Divider mb="md" />

          {/* Basic Info */}
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Basic Information</Text>
          <TextInput label="Company Name" placeholder="Enter company name" required mb="sm" {...form.getInputProps('companyName')} />
          <Box mb="sm">
            <Text size="sm" fw={500} mb={6}>Business Type <Text span c="red">*</Text></Text>
            <Group gap="lg">
              {BUSINESS_TYPES.map(type => (
                <Checkbox
                  key={type}
                  label={type}
                  checked={form.values.businessTypes.includes(type)}
                  onChange={() => {
                    const cur = form.values.businessTypes;
                    form.setFieldValue('businessTypes',
                      cur.includes(type) ? cur.filter(t => t !== type) : [...cur, type]
                    );
                  }}
                />
              ))}
            </Group>
            {form.errors.businessTypes && <Text size="xs" c="red" mt={4}>{form.errors.businessTypes}</Text>}
          </Box>
          <SimpleGrid cols={2} mb="md">
            <TextInput label="Society Name" placeholder="Society name" {...form.getInputProps('societyName')} />
            <TextInput label="Society Code" placeholder="Society code" {...form.getInputProps('societyCode')} />
          </SimpleGrid>
          <Divider mb="md" />

          {/* Contact */}
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Contact & Address</Text>
          <SimpleGrid cols={2} mb="sm">
            <TextInput label="Phone" placeholder="Phone number" {...form.getInputProps('phone')} />
            <TextInput label="Email" placeholder="Email address" type="email" {...form.getInputProps('email')} />
          </SimpleGrid>
          <SimpleGrid cols={2} mb="sm">
            <TextInput label="State" placeholder="State" {...form.getInputProps('state')} />
            <TextInput label="District" placeholder="District" {...form.getInputProps('district')} />
          </SimpleGrid>
          <Textarea label="Address" placeholder="Full address" rows={2} mb="md" {...form.getInputProps('address')} />
          <Divider mb="md" />

          {/* Registration */}
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Registration Details</Text>
          <SimpleGrid cols={2} mb="sm">
            <TextInput label="GST Number" placeholder="GST Number" {...form.getInputProps('gstNumber')} />
            <TextInput label="PAN Number" placeholder="PAN Number" {...form.getInputProps('panNumber')} />
          </SimpleGrid>
          <SimpleGrid cols={2} mb="sm">
            <TextInput label="Milma Code" placeholder="Milma Code" {...form.getInputProps('milmaCode')} />
            <TextInput label="SSI Registration" placeholder="SSI Registration No" {...form.getInputProps('ssiRegistration')} />
          </SimpleGrid>
          <SimpleGrid cols={2} mb="sm">
            <TextInput label="Date of Registration" type="date" {...form.getInputProps('dateOfRegistration')} />
            <TextInput label="Start Date" type="date" {...form.getInputProps('startDate')} />
          </SimpleGrid>
          <SimpleGrid cols={2} mb="sm">
            <TextInput label="SSI Registration Date" type="date" {...form.getInputProps('ssiRegistrationDate')} />
            <TextInput label="Year of Audit" placeholder="e.g., 2023-24" {...form.getInputProps('yearOfAudit')} />
          </SimpleGrid>
          <TextInput label="Audit Classification" placeholder="Audit classification" mb="xl" {...form.getInputProps('auditClassification')} />

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} leftSection={<IconBuilding size={14} />}>Create Company</Button>
          </Group>
        </form>
      </Modal>

      {/* ── Reset Password Modal ───────────────────────────────────────────────── */}
      <Modal
        opened={pwdOpen}
        onClose={() => { setPwdOpen(false); setNewPassword(''); setSelectedCompany(null); }}
        title={<Group gap="xs"><ThemeIcon size={24} radius="sm" color="blue"><IconLock size={14} /></ThemeIcon><Text fw={600}>Reset Password</Text></Group>}
        size="sm"
        radius="md"
        padding="xl"
      >
        {selectedCompany && (
          <Stack>
            <Paper withBorder p="sm" radius="sm" bg="gray.0">
              <Text size="sm" fw={600}>{selectedCompany.companyName}</Text>
              <Text size="xs" c="dimmed">Username: {selectedCompany.username}</Text>
            </Paper>
            <PasswordInput
              label="New Password"
              placeholder="Enter new password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
            />
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => setPwdOpen(false)}>Cancel</Button>
              <Button loading={saving} color="blue" onClick={handleResetPassword} leftSection={<IconLock size={14} />}>
                Reset Password
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
