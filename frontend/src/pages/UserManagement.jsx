import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  Button,
  Table,
  TextInput,
  PasswordInput,
  Select,
  Checkbox,
  Modal,
  ActionIcon,
  Menu,
  Paper,
  SimpleGrid,
  ThemeIcon,
  LoadingOverlay,
  Alert,
  Tabs,
  ScrollArea
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconUsers,
  IconUserPlus,
  IconEdit,
  IconTrash,
  IconKey,
  IconSearch,
  IconDots,
  IconUserCheck,
  IconUserX,
  IconShieldCheck,
  IconAlertCircle
} from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { userManagementAPI, agentAPI, collectionCenterAPI } from '../services/api';
import { message } from '../utils/toast';
import PageHeader from '../components/common/PageHeader';

import { MODULE_GROUPS, BUSINESS_ONLY_GROUPS, MODULES } from '../utils/modulePermissions';

const UserManagement = () => {
  const { canManageUsers, isSuperAdminLogin, companyInfo } = useAuth();
  // Only Super Admin and Admin may open User Management, create users and assign permissions
  const isAdmin = canManageUsers;
  const isDairy = companyInfo?.businessTypes?.includes('Dairy Cooperative Society');
  const visibleGroups = isDairy ? MODULE_GROUPS.filter(g => !BUSINESS_ONLY_GROUPS.has(g.key)) : MODULE_GROUPS;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [designations, setDesignations] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [centers, setCenters] = useState([]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedCenterId, setSelectedCenterId] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    password: '',
    userType: 'ordinary',
    designation: 'Other',
    phone: '',
    email: '',
    joiningDate: null,
    expireDate: null,
    permissions: []
  });
  const [newPassword, setNewPassword] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      message.warning('Admin access required');
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // Fetch users, designations, user types and agents on mount
  useEffect(() => {
    fetchUsers();
    fetchDesignations();
    fetchUserTypes();
    fetchAgents();
    fetchCenters();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userManagementAPI.getAll({ search: searchQuery });
      setUsers(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDesignations = async () => {
    try {
      const response = await userManagementAPI.getDesignations();
      setDesignations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch designations:', error);
    }
  };

  const fetchUserTypes = async () => {
    try {
      const response = await userManagementAPI.getUserTypes();
      setUserTypes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch user types:', error);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await agentAPI.getAllActive();
      setAgents(response.data || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const fetchCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll({ limit: 200 });
      setCenters(response.data || []);
    } catch (error) {
      console.error('Failed to fetch centers:', error);
    }
  };

  // Initialize permissions for new user
  const initializePermissions = () => {
    return MODULES.map(module => ({
      module,
      read: false,
      write: false,
      edit: false,
      delete: false
    }));
  };

  // When userType is 'agent', auto-fill fields from selected agent
  const handleAgentSelect = (agentId) => {
    setSelectedAgentId(agentId);
    const agent = agents.find(a => a._id === agentId);
    if (!agent || formData.userType !== 'agent') return;
    setFormData(prev => ({
      ...prev,
      displayName: agent.agentName || prev.displayName,
      phone: agent.phone || prev.phone,
      email: agent.email || prev.email,
      joiningDate: agent.dateOfJoining ? new Date(agent.dateOfJoining) : prev.joiningDate
    }));
  };

  // Open modal for new user
  const handleAddUser = () => {
    setEditingUser(null);
    setSelectedAgentId(null);
    setSelectedCenterId(null);
    setFormData({
      displayName: '',
      username: '',
      password: '',
      userType: 'ordinary',
      designation: 'Other',
      phone: '',
      email: '',
      joiningDate: null,
      expireDate: null,
      permissions: initializePermissions()
    });
    setModalOpen(true);
  };

  // Open modal for editing user
  const handleEditUser = (user) => {
    setEditingUser(user);
    setSelectedAgentId(user.agentId?._id || user.agentId || null);
    setSelectedCenterId(user.collectionCenter?._id || user.collectionCenter || null);

    // Merge existing permissions with all modules
    const existingPerms = user.permissions || [];
    const mergedPermissions = MODULES.map(module => {
      const existing = existingPerms.find(p => p.module === module);
      return existing || {
        module,
        read: false,
        write: false,
        edit: false,
        delete: false
      };
    });

    setFormData({
      displayName: user.displayName || '',
      username: user.username || '',
      password: '',
      userType: user.userType || 'ordinary',
      designation: user.designation || 'Other',
      phone: user.phone || '',
      email: user.email || '',
      joiningDate: user.joiningDate ? new Date(user.joiningDate) : null,
      expireDate: user.expireDate ? new Date(user.expireDate) : null,
      permissions: mergedPermissions
    });
    setModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.displayName || !formData.username) {
      message.error('Name and Username are required');
      return;
    }

    if (!editingUser && !formData.password) {
      message.error('Password is required for new users');
      return;
    }

    if (!editingUser && formData.password.length < 6) {
      message.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        displayName: formData.displayName,
        username: formData.username,
        userType: formData.userType,
        designation: formData.designation,
        phone: formData.phone,
        email: formData.email,
        joiningDate: formData.joiningDate,
        expireDate: formData.expireDate,
        permissions: formData.permissions,
        collectionCenter: selectedCenterId || null,
        // Any user may have a default agent (Admin: preselected; ordinary user: fixed to it)
        agentId: selectedAgentId || null
      };

      if (!editingUser) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await userManagementAPI.update(editingUser._id, payload);
        message.success('User updated successfully');
      } else {
        await userManagementAPI.create(payload);
        message.success('User created successfully');
      }

      setModalOpen(false);
      fetchUsers();
    } catch (error) {
      message.error(error.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  // Handle permission change by module key
  const handlePermissionChange = (moduleKey, action, checked) => {
    const newPermissions = formData.permissions.map(p =>
      p.module === moduleKey ? { ...p, [action]: checked } : p
    );
    setFormData({ ...formData, permissions: newPermissions });
  };

  // Toggle all CRUD for a single module row
  const handleSelectAllModule = (moduleKey, checked) => {
    const newPermissions = formData.permissions.map(p =>
      p.module === moduleKey
        ? { ...p, read: checked, write: checked, edit: checked, delete: checked }
        : p
    );
    setFormData({ ...formData, permissions: newPermissions });
  };

  // Toggle all CRUD for all modules in a group (main + sub-modules)
  const handleSelectAllGroup = (group, checked) => {
    const keys = new Set([group.key, ...group.subModules.map(s => s.key)]);
    const newPermissions = formData.permissions.map(p =>
      keys.has(p.module)
        ? { ...p, read: checked, write: checked, edit: checked, delete: checked }
        : p
    );
    setFormData({ ...formData, permissions: newPermissions });
  };

  // Select all permissions for all modules
  const handleSelectAll = (checked) => {
    const newPermissions = formData.permissions.map(p => ({
      ...p, read: checked, write: checked, edit: checked, delete: checked
    }));
    setFormData({ ...formData, permissions: newPermissions });
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      message.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await userManagementAPI.resetPassword(selectedUserId, newPassword);
      message.success('Password reset successfully');
      setPasswordModalOpen(false);
      setNewPassword('');
    } catch (error) {
      message.error(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Handle user deactivation
  const handleDeactivate = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;

    setLoading(true);
    try {
      await userManagementAPI.delete(userId);
      message.success('User deactivated successfully');
      fetchUsers();
    } catch (error) {
      message.error(error.message || 'Failed to deactivate user');
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.designation?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeUsers = filteredUsers.filter(u => u.status === 'active');
  const inactiveUsers = filteredUsers.filter(u => u.status === 'inactive');

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 2 }} />

      <PageHeader
        title="User Management"
        subtitle={`Manage users for ${companyInfo?.companyName || 'your company'}`}
      />

      <Stack gap="md">
        {/* Summary Cards */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <ThemeIcon size="lg" variant="light" color="blue">
                <IconUsers size={20} />
              </ThemeIcon>
            </Group>
            <Text size="sm" c="dimmed" mt="sm">Total Users</Text>
            <Text size="xl" fw={700}>{users.length}</Text>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <ThemeIcon size="lg" variant="light" color="green">
                <IconUserCheck size={20} />
              </ThemeIcon>
            </Group>
            <Text size="sm" c="dimmed" mt="sm">Active Users</Text>
            <Text size="xl" fw={700}>{activeUsers.length}</Text>
          </Card>

          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
              <ThemeIcon size="lg" variant="light" color="red">
                <IconUserX size={20} />
              </ThemeIcon>
            </Group>
            <Text size="sm" c="dimmed" mt="sm">Inactive Users</Text>
            <Text size="xl" fw={700}>{inactiveUsers.length}</Text>
          </Card>
        </SimpleGrid>

        {/* Actions Bar */}
        <Paper p="md" withBorder>
          <Group justify="space-between">
            <TextInput
              placeholder="Search users..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
            <Button leftSection={<IconUserPlus size={16} />} onClick={handleAddUser}>
              Add User
            </Button>
          </Group>
        </Paper>

        {/* Users Table */}
        <Paper p="md" withBorder>
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>User Type</Table.Th>
                  <Table.Th>Designation</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Joining Date</Table.Th>
                  <Table.Th>Expire Date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredUsers.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9} style={{ textAlign: 'center' }}>
                      <Text c="dimmed" py="xl">No users found</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredUsers.map((user) => (
                    <Table.Tr key={user._id}>
                      <Table.Td fw={500}>{user.displayName}</Table.Td>
                      <Table.Td>{user.username}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="grape">
                          {userTypes.find(t => t.value === user.userType)?.label || (user.userType === 'superuser' ? 'Super Admin' : user.userType) || '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">{user.designation}</Badge>
                      </Table.Td>
                      <Table.Td>{user.phone || '-'}</Table.Td>
                      <Table.Td>
                        {user.joiningDate
                          ? new Date(user.joiningDate).toLocaleDateString()
                          : '-'
                        }
                      </Table.Td>
                      <Table.Td>
                        {user.expireDate
                          ? new Date(user.expireDate).toLocaleDateString()
                          : '-'
                        }
                      </Table.Td>
                      <Table.Td>
                        <Badge color={user.status === 'active' ? 'green' : 'red'} variant="filled">
                          {user.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="center">
                          {/* A Super Admin account can only be changed by a Super Admin */}
                          {(isSuperAdminLogin || user.userType !== 'superuser') && <Menu shadow="md" width={160}>
                            <Menu.Target>
                              <ActionIcon variant="subtle">
                                <IconDots size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                leftSection={<IconEdit size={14} />}
                                onClick={() => handleEditUser(user)}
                              >
                                Edit User
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconShieldCheck size={14} />}
                                onClick={() => handleEditUser(user)}
                              >
                                Permissions
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconKey size={14} />}
                                onClick={() => {
                                  setSelectedUserId(user._id);
                                  setPasswordModalOpen(true);
                                }}
                              >
                                Reset Password
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => handleDeactivate(user._id)}
                              >
                                Deactivate
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Box>
        </Paper>
      </Stack>

      {/* Add/Edit User Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Edit User' : 'Add New User'}
        size="xl"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Name"
              placeholder="Enter full name"
              required
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
            <TextInput
              label="Username"
              placeholder="Enter username for login"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={!!editingUser}
            />
            {!editingUser && (
              <PasswordInput
                label="Password"
                placeholder="Enter password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            )}
            <Select
              label="User Type"
              placeholder="Select user type"
              data={['Main', 'Other Users'].map(group => ({ group, items: userTypes.filter(t => (t.group || 'Other Users') === group).map(({ value, label }) => ({ value, label })) })).filter(g => g.items.length)}
              value={formData.userType}
              onChange={(value) => {
                setFormData({ ...formData, userType: value });
              }}
            />
            <Select
              label="Center"
              placeholder="Select collection center"
              description={['admin', 'superuser'].includes(formData.userType)
                ? 'Default Center on Milk Purchase / Sales — Admin can still choose others'
                : 'This user works only in this Center'}
              clearable
              searchable
              data={centers.map(c => ({ value: c._id, label: c.centerCode ? `${c.centerCode} - ${c.centerName}` : c.centerName }))}
              value={selectedCenterId}
              onChange={(v) => {
                setSelectedCenterId(v);
                const a = agents.find(x => x._id === selectedAgentId);
                const aCentre = a && String(a.collectionCenterId?._id || a.collectionCenterId || '');
                if (v && aCentre && aCentre !== v) setSelectedAgentId(null);
              }}
            />
            <Select
              label={formData.userType === 'agent' ? 'Select Agent' : 'Agent'}
              placeholder={formData.userType === 'agent' ? 'Choose from Agent Management' : 'Optional'}
              required={formData.userType === 'agent'}
              clearable={formData.userType !== 'agent'}
              searchable
              data={agents
                .filter(a => !selectedCenterId || !a.collectionCenterId || String(a.collectionCenterId?._id || a.collectionCenterId) === selectedCenterId)
                .map(a => ({
                  value: a._id,
                  label: `${a.agentName} (${a.agentCode})`
                }))}
              value={selectedAgentId}
              onChange={handleAgentSelect}
              description={formData.userType === 'agent'
                ? 'Agent data will be auto-filled below'
                : ['admin', 'superuser'].includes(formData.userType)
                  ? 'Default Agent — Admin can still choose others'
                  : 'This user works only as this Agent'}
            />
            <Select
              label="Designation"
              placeholder="Select designation"
              data={designations}
              value={formData.designation}
              onChange={(value) => setFormData({ ...formData, designation: value })}
            />
            <TextInput
              label="Phone"
              placeholder="Enter phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <TextInput
              label="Email"
              placeholder="Enter email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <DateInput
              label="Joining Date"
              placeholder="Select joining date"
              value={formData.joiningDate}
              onChange={(value) => setFormData({ ...formData, joiningDate: value })}
              clearable
            />
            <DateInput
              label="Expire Date"
              placeholder="Select expire date"
              value={formData.expireDate}
              onChange={(value) => setFormData({ ...formData, expireDate: value })}
              clearable
            />
          </SimpleGrid>

          {formData.userType === 'superuser' && (
            <Alert icon={<IconShieldCheck size={16} />} color="grape">
              Super Admin has every module and the Super Admin-only options (Import / Export in Milk Purchase, Milk Sales and Union Sales, Rate Chart Settings, OpenLyssa Merge Tool, Day Book / Cash Book delete). No module permissions are needed.
            </Alert>
          )}
          {/* Permissions Section — only the modules assigned here appear in this user's menu */}
          {formData.userType !== 'superuser' && <Paper p="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={5}>Module Permissions</Title>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => handleSelectAll(true)}
                >
                  Select All
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  onClick={() => handleSelectAll(false)}
                >
                  Clear All
                </Button>
              </Group>
            </Group>

            <Alert icon={<IconAlertCircle size={16} />} color="blue" mb="md">
              Only the modules ticked here appear in this user's menu and can be opened.
              {formData.userType === 'admin' ? ' Admin also gets User Management and Collection Centre.' : ''}
            </Alert>

            <ScrollArea h={500}>
              <Table withTableBorder withColumnBorders style={{ fontSize: 12 }}>
                <Table.Thead>
                  <Table.Tr style={{ background: '#f1f3f5' }}>
                    <Table.Th style={{ minWidth: 220 }}>Module / Sub-Module</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 52 }}>Read</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 52 }}>Write</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 52 }}>Edit</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 52 }}>Delete</Table.Th>
                    <Table.Th style={{ textAlign: 'center', width: 52 }}>All</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visibleGroups.map(group => {
                    const allKeys = [group.key, ...group.subModules.map(s => s.key)];
                    const allPerms = allKeys.map(k => formData.permissions.find(p => p.module === k) || { module: k, read: false, write: false, edit: false, delete: false });
                    const groupAllChecked = allPerms.every(p => p.read && p.write && p.edit && p.delete);
                    const mainPerm = formData.permissions.find(p => p.module === group.key) || { read: false, write: false, edit: false, delete: false };
                    const mainAllChecked = mainPerm.read && mainPerm.write && mainPerm.edit && mainPerm.delete;

                    return [
                      /* ── Group header row ── */
                      <Table.Tr key={`hdr-${group.key}`} style={{ background: group.color + '33' }}>
                        <Table.Td colSpan={5} style={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#1a1a2e', paddingLeft: 8 }}>
                          {group.label}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center', background: group.color + '55' }}>
                          <Checkbox
                            size="xs"
                            checked={groupAllChecked}
                            title="Toggle all in this group"
                            onChange={e => handleSelectAllGroup(group, e.currentTarget.checked)}
                          />
                        </Table.Td>
                      </Table.Tr>,

                      /* ── Main module row ── */
                      <Table.Tr key={group.key} style={{ background: group.color + '18' }}>
                        <Table.Td style={{ fontWeight: 600, paddingLeft: 14, color: '#222' }}>
                          {group.label}
                        </Table.Td>
                        {['read', 'write', 'edit', 'delete'].map(action => (
                          <Table.Td key={action} style={{ textAlign: 'center' }}>
                            <Checkbox size="xs" checked={!!mainPerm[action]}
                              onChange={e => handlePermissionChange(group.key, action, e.currentTarget.checked)} />
                          </Table.Td>
                        ))}
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Checkbox size="xs" checked={mainAllChecked}
                            onChange={e => handleSelectAllModule(group.key, e.currentTarget.checked)} />
                        </Table.Td>
                      </Table.Tr>,

                      /* ── Sub-module rows ── */
                      ...group.subModules.map(sub => {
                        const perm = formData.permissions.find(p => p.module === sub.key) || { read: false, write: false, edit: false, delete: false };
                        const subAllChecked = perm.read && perm.write && perm.edit && perm.delete;
                        return (
                          <Table.Tr key={sub.key}>
                            <Table.Td style={{ paddingLeft: 28, color: '#444', fontSize: 11 }}>
                              ↳ {sub.label}
                            </Table.Td>
                            {['read', 'write', 'edit', 'delete'].map(action => (
                              <Table.Td key={action} style={{ textAlign: 'center' }}>
                                <Checkbox size="xs" checked={!!perm[action]}
                                  onChange={e => handlePermissionChange(sub.key, action, e.currentTarget.checked)} />
                              </Table.Td>
                            ))}
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Checkbox size="xs" checked={subAllChecked}
                                onChange={e => handleSelectAllModule(sub.key, e.currentTarget.checked)} />
                            </Table.Td>
                          </Table.Tr>
                        );
                      })
                    ];
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>}

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        opened={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setNewPassword('');
        }}
        title="Reset User Password"
        size="sm"
      >
        <Stack gap="md">
          <PasswordInput
            label="New Password"
            placeholder="Enter new password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => {
              setPasswordModalOpen(false);
              setNewPassword('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} loading={loading}>
              Reset Password
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};

export default UserManagement;
