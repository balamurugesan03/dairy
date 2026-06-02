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
import { userManagementAPI } from '../services/api';
import { message } from '../utils/toast';
import PageHeader from '../components/common/PageHeader';

// Full grouped module structure — main modules + sub-modules
const MODULE_GROUPS = [
  {
    key: 'dashboard', label: 'Dashboard', color: '#4dabf7',
    subModules: []
  },
  {
    key: 'farmers', label: 'Farmers Management', color: '#51cf66',
    subModules: [
      { key: 'farmers.producers',          label: 'Producer Management'   },
      { key: 'farmers.collectionCenters',  label: 'Collection Centre'     },
      { key: 'farmers.agents',             label: 'Agent Management'      },
      { key: 'farmers.milkSalesCustomers', label: 'Customer (Milk Sales)' },
    ]
  },
  {
    key: 'milkCollection', label: 'Milk Purchase & Sales', color: '#74c0fc',
    subModules: [
      { key: 'milkCollection.purchase',        label: 'Milk Purchase'         },
      { key: 'milkCollection.dailyList',        label: 'Daily Collection List' },
      { key: 'milkCollection.sales',            label: 'Milk Sales'            },
      { key: 'milkCollection.unionSales',       label: 'Union Sales'           },
      { key: 'milkCollection.farmerSummary',    label: 'Farmer-Wise Summary'   },
      { key: 'milkCollection.rateChart',        label: 'Rate Chart Settings'   },
      { key: 'milkCollection.machineConfig',    label: 'Machine Configuration' },
      { key: 'milkCollection.milkSalesRate',    label: 'Milk Sales Rate'       },
      { key: 'milkCollection.shiftIncentive',   label: 'Shift Incentive'       },
      { key: 'milkCollection.timeIncentive',    label: 'Time Incentive'        },
      { key: 'milkCollection.producerOpenings', label: 'Producer Openings'     },
    ]
  },
  {
    key: 'inventory', label: 'Dairy Inventory', color: '#ffa94d',
    subModules: [
      { key: 'inventory.suppliers',        label: 'Supplier'                        },
      { key: 'inventory.items',            label: 'Items'                           },
      { key: 'inventory.stockIn',          label: 'Inventory Purchase'              },
      { key: 'inventory.sales',            label: 'Inventory Sales'                 },
      { key: 'inventory.stockOut',         label: 'Stock Returns'                   },
      { key: 'inventory.purchaseReturns',  label: 'Purchase Return (Debit Note)'    },
      { key: 'inventory.salesReturns',     label: 'Sales Return'                    },
      { key: 'inventory.subsidies',        label: 'Subsidy'                         },
    ]
  },
  {
    key: 'payments', label: 'Producers Dues', color: '#69db7c',
    subModules: [
      { key: 'payments.receipts',           label: 'Producer Receipts'      },
      { key: 'payments.register',           label: 'Payment Register'       },
      { key: 'payments.bankTransfer',       label: 'Bank Transfer'          },
      { key: 'payments.paymentToProducer',  label: 'Payment to Producer'    },
      { key: 'payments.loans',              label: 'Loans'                  },
      { key: 'payments.cashAdvance',        label: 'Cash Advance'           },
      { key: 'payments.cattleFeed',         label: 'Cattle Feed Advance'    },
      { key: 'payments.earningDeduction',   label: 'Earnings / Deductions'  },
      { key: 'payments.producerRegister',   label: 'Producer Register'      },
      { key: 'payments.farmerLedger',       label: 'Producer Ledger'        },
    ]
  },
  {
    key: 'accounting', label: 'Accounts', color: '#a9e34b',
    subModules: [
      { key: 'accounting.ledgers',   label: 'Ledgers'                  },
      { key: 'accounting.receipt',   label: 'Receipt Voucher'          },
      { key: 'accounting.payment',   label: 'Payment Voucher'          },
      { key: 'accounting.journal',   label: 'Adjustment / Journal'     },
      { key: 'accounting.vouchers',  label: 'Vouchers Management'      },
      { key: 'accounting.cashBook',  label: 'Cash Book'                },
      { key: 'accounting.dayBook',   label: 'Day Book'                 },
      { key: 'accounting.generalLedger', label: 'General Ledger'       },
      { key: 'accounting.balanceSheet',  label: 'Balance Sheet'        },
      { key: 'accounting.finalAccounts', label: 'Final Accounts'       },
      { key: 'accounting.outstanding',   label: 'Outstanding Report'   },
    ]
  },
  {
    key: 'reports', label: 'Dairy Reports', color: '#f783ac',
    subModules: [
      { key: 'reports.dairyAbstract',   label: 'Dairy Abstract'           },
      { key: 'reports.dairyRegister',   label: 'Dairy Register'           },
      { key: 'reports.misReport',       label: 'MIS Report'               },
      { key: 'reports.monthlyMIS',      label: 'Monthly MIS Report'       },
      { key: 'reports.milkPurchase',    label: 'Milk Purchase Report'     },
      { key: 'reports.milkStatement',   label: 'Milk Statement'           },
      { key: 'reports.milkBillAbstract',label: 'Milk Bill Abstract'       },
      { key: 'reports.rdStatement',     label: 'R&D Statement'            },
      { key: 'reports.inspectionReport',label: 'Inspection Report'        },
      { key: 'reports.cropStatements',  label: 'Crop Damage Statements'   },
      { key: 'reports.agriStats',       label: 'Monthly Agri Statistics'  },
    ]
  },
  {
    key: 'businessInventory', label: 'Business Inventory', color: '#da77f2',
    subModules: [
      { key: 'businessInventory.suppliers',       label: 'Supplier'            },
      { key: 'businessInventory.items',           label: 'Item Master'         },
      { key: 'businessInventory.stockIn',         label: 'Purchase / Stock In' },
      { key: 'businessInventory.sales',           label: 'Sales Invoices'      },
      { key: 'businessInventory.stockOut',        label: 'Stock Out / Returns' },
      { key: 'businessInventory.purchaseReturns', label: 'Purchase Return'     },
      { key: 'businessInventory.salesReturns',    label: 'Sales Return'        },
    ]
  },
  {
    key: 'businessReports', label: 'Business Reports', color: '#4cc9f0',
    subModules: [
      { key: 'businessReports.saleReport',     label: 'Sale Report'       },
      { key: 'businessReports.purchaseReport', label: 'Purchase Report'   },
      { key: 'businessReports.partyStatement', label: 'Party Statement'   },
      { key: 'businessReports.allParties',     label: 'All Parties'       },
      { key: 'businessReports.gstr1',          label: 'GSTR-1'            },
      { key: 'businessReports.gstr2',          label: 'GSTR-2'            },
      { key: 'businessReports.profitLoss',     label: 'Profit & Loss'     },
      { key: 'businessReports.tradingAccount', label: 'Trading Account'   },
      { key: 'businessReports.balanceSheet',   label: 'Balance Sheet'     },
      { key: 'businessReports.trialBalance',   label: 'Trial Balance'     },
    ]
  },
  {
    key: 'quotations', label: 'Quotations', color: '#63e6be',
    subModules: [
      { key: 'quotations.add',  label: 'Add Quotation'   },
      { key: 'quotations.list', label: 'Quotation List'  },
    ]
  },
  {
    key: 'machines', label: 'Machines', color: '#ffd43b',
    subModules: [
      { key: 'machines.add',  label: 'Add Machine'  },
      { key: 'machines.list', label: 'Machine List' },
    ]
  },
  {
    key: 'warranty', label: 'Warranty', color: '#ff8787',
    subModules: [
      { key: 'warranty.add',  label: 'Add Warranty'   },
      { key: 'warranty.list', label: 'Warranty List'  },
    ]
  },
  {
    key: 'promotions', label: 'Promotions', color: '#f08c00',
    subModules: [
      { key: 'promotions.dashboard', label: 'Dashboard'        },
      { key: 'promotions.coupons',   label: 'Discount Coupons' },
      { key: 'promotions.offers',    label: 'Offers & Schemes' },
      { key: 'promotions.campaigns', label: 'Campaigns'        },
    ]
  },
  {
    key: 'hrm', label: 'Human Resources', color: '#748ffc',
    subModules: [
      { key: 'hrm.employees',   label: 'Employees'         },
      { key: 'hrm.attendance',  label: 'Attendance'        },
      { key: 'hrm.leaves',      label: 'Leave Management'  },
      { key: 'hrm.salary',      label: 'Payroll'           },
      { key: 'hrm.loans',       label: 'Loans / Advance'   },
    ]
  },
  {
    key: 'settings', label: 'Settings', color: '#94d82d',
    subModules: [
      { key: 'settings.societyInfo',      label: 'Society Info'        },
      { key: 'settings.financialYear',    label: 'Financial Year'      },
      { key: 'settings.paymentSettings',  label: 'Payment Settings'    },
      { key: 'settings.userManagement',   label: 'User Management'     },
      { key: 'settings.openLyssaMerge',   label: 'OpenLyssa Merge Tool'},
    ]
  },
];

// Flat list of ALL module keys (main + sub) for permission initialisation
const MODULES = MODULE_GROUPS.flatMap(g => [g.key, ...g.subModules.map(s => s.key)]);

const UserManagement = () => {
  const { isAdmin, companyInfo } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [designations, setDesignations] = useState([]);
  const [userTypes, setUserTypes] = useState([]);

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

  // Fetch users, designations and user types on mount
  useEffect(() => {
    fetchUsers();
    fetchDesignations();
    fetchUserTypes();
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
                          {userTypes.find(t => t.value === user.userType)?.label || user.userType || '-'}
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
              label="User Type"
              placeholder="Select user type"
              data={userTypes}
              value={formData.userType}
              onChange={(value) => setFormData({ ...formData, userType: value })}
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
                  {MODULE_GROUPS.map(group => {
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
