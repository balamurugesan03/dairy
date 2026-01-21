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
import { userManagementAPI } from '../services/api';
import { message } from '../utils/toast';
import PageHeader from '../components/common/PageHeader';

// Module labels for display
const MODULE_LABELS = {
  dashboard: 'Dashboard',
  farmers: 'Farmers',
  customers: 'Customers',
  suppliers: 'Suppliers',
  sales: 'Sales',
  purchases: 'Purchases',
  milkCollection: 'Milk Collection',
  payments: 'Payments',
  inventory: 'Inventory',
  accounting: 'Accounting',
  reports: 'Reports',
  hrm: 'HRM',
  settings: 'Settings',
  collectionCenters: 'Collection Centers',
  subsidies: 'Subsidies'
};

const MODULES = Object.keys(MODULE_LABELS);

const UserManagement = () => {
  const { isAdmin, companyInfo } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [designations, setDesignations] = useState([]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    password: '',
    designation: 'Other',
    phone: '',
    email: '',
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

  // Fetch users and designations on mount
  useEffect(() => {
    fetchUsers();
    fetchDesignations();
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

  // Open modal for new user
  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      displayName: '',
      username: '',
      password: '',
      designation: 'Other',
      phone: '',
      email: '',
      permissions: initializePermissions()
    });
    setModalOpen(true);
  };

  // Open modal for editing user
  const handleEditUser = (user) => {
    setEditingUser(user);

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
      designation: user.designation || 'Other',
      phone: user.phone || '',
      email: user.email || '',
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
        designation: formData.designation,
        phone: formData.phone,
        email: formData.email,
        permissions: formData.permissions
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

  // Handle permission change
  const handlePermissionChange = (moduleIndex, action, checked) => {
    const newPermissions = [...formData.permissions];
    newPermissions[moduleIndex] = {
      ...newPermissions[moduleIndex],
      [action]: checked
    };
    setFormData({ ...formData, permissions: newPermissions });
  };

  // Toggle all permissions for a module
  const handleSelectAllModule = (moduleIndex, checked) => {
    const newPermissions = [...formData.permissions];
    newPermissions[moduleIndex] = {
      ...newPermissions[moduleIndex],
      read: checked,
      write: checked,
      edit: checked,
      delete: checked
    };
    setFormData({ ...formData, permissions: newPermissions });
  };

  // Select all permissions for all modules
  const handleSelectAll = (checked) => {
    const newPermissions = formData.permissions.map(p => ({
      ...p,
      read: checked,
      write: checked,
      edit: checked,
      delete: checked
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
                  <Table.Th>Designation</Table.Th>
                  <Table.Th>Phone</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Login</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredUsers.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                      <Text c="dimmed" py="xl">No users found</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredUsers.map((user) => (
                    <Table.Tr key={user._id}>
                      <Table.Td fw={500}>{user.displayName}</Table.Td>
                      <Table.Td>{user.username}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">{user.designation}</Badge>
                      </Table.Td>
                      <Table.Td>{user.phone || '-'}</Table.Td>
                      <Table.Td>{user.email || '-'}</Table.Td>
                      <Table.Td>
                        <Badge color={user.status === 'active' ? 'green' : 'red'} variant="filled">
                          {user.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : 'Never'
                        }
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="center">
                          <Menu shadow="md" width={160}>
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
                          </Menu>
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
          </SimpleGrid>

          {/* Permissions Section */}
          <Paper p="md" withBorder>
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
              Select which operations each user can perform in each module
            </Alert>

            <ScrollArea h={300}>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Module</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Read</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Write</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Edit</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Delete</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>All</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {formData.permissions.map((perm, index) => {
                    const allChecked = perm.read && perm.write && perm.edit && perm.delete;
                    return (
                      <Table.Tr key={perm.module}>
                        <Table.Td fw={500}>{MODULE_LABELS[perm.module]}</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Checkbox
                            checked={perm.read}
                            onChange={(e) => handlePermissionChange(index, 'read', e.currentTarget.checked)}
                          />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Checkbox
                            checked={perm.write}
                            onChange={(e) => handlePermissionChange(index, 'write', e.currentTarget.checked)}
                          />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Checkbox
                            checked={perm.edit}
                            onChange={(e) => handlePermissionChange(index, 'edit', e.currentTarget.checked)}
                          />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Checkbox
                            checked={perm.delete}
                            onChange={(e) => handlePermissionChange(index, 'delete', e.currentTarget.checked)}
                          />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Checkbox
                            checked={allChecked}
                            onChange={(e) => handleSelectAllModule(index, e.currentTarget.checked)}
                          />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>

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
