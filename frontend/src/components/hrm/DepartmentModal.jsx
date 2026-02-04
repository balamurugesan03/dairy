import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Table,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Badge,
  Text,
  Title,
  Card,
  SimpleGrid,
  Loader,
  Center,
  ActionIcon,
  Menu,
  Tooltip,
  ThemeIcon,
  Box,
  Divider,
  ScrollArea,
  Pagination,
  Modal,
  Grid,
  NumberInput,
  Textarea,
  Avatar,
  Anchor,
  Alert,
  LoadingOverlay
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { DatePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconBuilding,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconFilter,
  IconX,
  IconUsers,
  IconCurrencyRupee,
  IconRefresh,
  IconChevronRight,
  IconUser,
  IconChartBar,
  IconAlertCircle,
  IconEye,
  IconDotsVertical,
  IconCheck,
  IconBan,
  IconBuildingCommunity,
  IconHierarchy,
  IconBriefcase,
  IconMail,
  IconPhone,
  IconInfoCircle,
  IconFileDescription,
  IconClipboardCheck
} from '@tabler/icons-react';
import { departmentAPI, employeeAPI } from '../../services/api';

// Department Modal Component
const DepartmentModal = ({ department, employees, opened, onClose, onSuccess }) => {
  const isEditMode = Boolean(department);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      code: '',
      description: '',
      headOfDepartment: '',
      budget: 0,
      status: 'Active',
      remarks: ''
    },

    validate: {
      name: (value) => (!value.trim() ? 'Department name is required' : null),
      code: (value) => (!value.trim() ? 'Department code is required' : null),
      budget: (value) => (value < 0 ? 'Budget cannot be negative' : null)
    }
  });

  useEffect(() => {
    if (department) {
      form.setValues({
        name: department.name || '',
        code: department.code || '',
        description: department.description || '',
        headOfDepartment: department.headOfDepartment?._id || '',
        budget: department.budget || 0,
        status: department.status || 'Active',
        remarks: department.remarks || ''
      });
    }
  }, [department]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      if (isEditMode) {
        await departmentAPI.update(department._id, values);
        notifications.show({
          title: 'Success',
          message: 'Department updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        await departmentAPI.create(values);
        notifications.show({
          title: 'Success',
          message: 'Department created successfully',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }
      form.reset();
      onSuccess();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || `Failed to ${isEditMode ? 'update' : 'create'} department`,
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const employeeOptions = [
    { value: '', label: 'Select Head of Department' },
    ...employees.map(emp => ({
      value: emp._id,
      label: `${emp.personalDetails?.name} (${emp.employeeNumber})`,
      group: 'Employees'
    }))
  ];

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group spacing="sm">
          <ThemeIcon color="blue" variant="light" radius="md">
            <IconBuilding size={20} />
          </ThemeIcon>
          <Title order={3}>
            {isEditMode ? 'Edit Department' : 'Create New Department'}
          </Title>
          {isEditMode && department?.code && (
            <Badge variant="light" color="blue">
              {department.code}
            </Badge>
          )}
        </Group>
      }
      size="lg"
      radius="md"
      overlayProps={{ blur: 3 }}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
    >
      <LoadingOverlay visible={loading} zIndex={1000} />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack spacing="lg">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md">
            <Text size="sm">
              Fields marked with <Text span fw={600} color="red">*</Text> are required
            </Text>
          </Alert>

          <SimpleGrid cols={2} spacing="md">
            <TextInput
              label="Department Name"
              placeholder="e.g., Production Department"
              withAsterisk
              leftSection={<IconBuilding size={16} />}
              {...form.getInputProps('name')}
              disabled={loading}
            />

            <TextInput
              label="Department Code"
              placeholder="e.g., PROD"
              withAsterisk
              {...form.getInputProps('code')}
              disabled={loading || isEditMode}
              onChange={(e) => form.setFieldValue('code', e.target.value.toUpperCase())}
            />
          </SimpleGrid>

          <Textarea
            label="Description"
            placeholder="Brief description of the department..."
            leftSection={<IconFileDescription size={16} />}
            {...form.getInputProps('description')}
            minRows={3}
            disabled={loading}
          />

          <Divider label="Department Details" labelPosition="center" />

          <SimpleGrid cols={2} spacing="md">
            <Select
              label="Head of Department"
              placeholder="Select department head"
              data={employeeOptions}
              searchable
              clearable
              leftSection={<IconUser size={16} />}
              {...form.getInputProps('headOfDepartment')}
              disabled={loading}
            />

            <NumberInput
              label="Annual Budget (₹)"
              placeholder="0.00"
              thousandSeparator=","
              decimalScale={2}
              min={0}
              leftSection={<IconCurrencyRupee size={16} />}
              {...form.getInputProps('budget')}
              disabled={loading}
            />
          </SimpleGrid>

          <SimpleGrid cols={2} spacing="md">
            <Select
              label="Status"
              data={[
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              leftSection={<IconHierarchy size={16} />}
              {...form.getInputProps('status')}
              disabled={loading}
            />
          </SimpleGrid>

          <Textarea
            label="Remarks"
            placeholder="Any additional notes, comments, or special instructions..."
            leftSection={<IconClipboardCheck size={16} />}
            {...form.getInputProps('remarks')}
            minRows={2}
            disabled={loading}
          />

          {/* Summary Section */}
          {form.values.name && (
            <Alert color="gray" radius="md">
              <Text size="sm" fw={600} mb="xs">Summary</Text>
              <SimpleGrid cols={2} spacing="xs">
                <Text size="sm">
                  <Text span fw={500}>Name:</Text> {form.values.name}
                </Text>
                <Text size="sm">
                  <Text span fw={500}>Code:</Text> {form.values.code || 'Not set'}
                </Text>
                {form.values.headOfDepartment && (
                  <Text size="sm">
                    <Text span fw={500}>Head:</Text>{' '}
                    {employees.find(e => e._id === form.values.headOfDepartment)?.personalDetails?.name}
                  </Text>
                )}
                <Text size="sm">
                  <Text span fw={500}>Budget:</Text> ₹{form.values.budget.toLocaleString('en-IN')}
                </Text>
              </SimpleGrid>
            </Alert>
          )}

          <Group justify="flex-end" mt="lg">
            <Button
              variant="light"
              color="gray"
              onClick={handleClose}
              disabled={loading}
              leftSection={<IconX size={16} />}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              loading={loading}
              leftSection={!loading && <IconCheck size={16} />}
            >
              {isEditMode ? 'Update Department' : 'Create Department'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

// Main DepartmentList Component
const DepartmentList = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [viewModalOpened, setViewModalOpened] = useState(false);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: ''
  });

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await departmentAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      });

      setDepartments(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0
      }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch departments',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 100 });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, current: newPage });
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setModalOpened(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setModalOpened(true);
  };

  const handleView = (department) => {
    setSelectedDepartment(department);
    setViewModalOpened(true);
  };

  const handleDelete = async (id, name) => {
    modals.openConfirmModal({
      title: 'Delete Department',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete department <Text span fw={600}>"{name}"</Text>? 
          This action cannot be undone and will change its status to Inactive.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await departmentAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Department deleted successfully',
            color: 'green',
            icon: <IconCheck size={16} />
          });
          fetchDepartments();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to delete department',
            color: 'red',
            icon: <IconAlertCircle size={16} />
          });
        }
      }
    });
  };

  const handleModalClose = () => {
    setModalOpened(false);
    setEditingDepartment(null);
  };

  const handleModalSuccess = () => {
    setModalOpened(false);
    setEditingDepartment(null);
    fetchDepartments();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: ''
    });
    setPagination({ ...pagination, current: 1 });
  };

  const getStatusColor = (status) => {
    return status === 'Active' ? 'green' : 'red';
  };

  const getStatusIcon = (status) => {
    return status === 'Active' ? <IconCheck size={12} /> : <IconBan size={12} />;
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const hasActiveFilters = filters.search || filters.status;

  // Calculate statistics
  const calculateStats = () => {
    const activeCount = departments.filter(d => d.status === 'Active').length;
    const inactiveCount = departments.filter(d => d.status === 'Inactive').length;
    const totalEmployees = departments.reduce((sum, d) => sum + (d.employeeCount || 0), 0);
    const totalBudget = departments.reduce((sum, d) => sum + (d.budget || 0), 0);

    return {
      activeCount,
      inactiveCount,
      totalEmployees,
      totalBudget
    };
  };

  const stats = calculateStats();

  return (
    <Container fluid py="md">
      {/* Header Section */}
      <Paper radius="md" p="md" mb="md" bg="blue.0">
        <Group position="apart" align="flex-start">
          <Group spacing="sm">
            <ThemeIcon size="xl" radius="md" color="blue" variant="light">
              <IconBuildingCommunity size={24} />
            </ThemeIcon>
            <div>
              <Title order={2} size="h2">Department Management</Title>
              <Text color="dimmed" size="sm">
                Manage organizational departments and teams
              </Text>
            </div>
          </Group>
          <Button
            color="blue"
            size="md"
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
          >
            Add Department
          </Button>
        </Group>
      </Paper>

      {/* Statistics Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Total Departments</Text>
              <Text size="xl" fw={700}>
                {departments.length}
              </Text>
            </div>
            <ThemeIcon size="md" color="blue" variant="light" radius="md">
              <IconBuilding size={20} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Active</Text>
              <Text size="xl" fw={700} color="green">
                {stats.activeCount}
              </Text>
            </div>
            <ThemeIcon size="md" color="green" variant="light" radius="md">
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Total Employees</Text>
              <Text size="xl" fw={700}>
                {stats.totalEmployees}
              </Text>
            </div>
            <ThemeIcon size="md" color="violet" variant="light" radius="md">
              <IconUsers size={20} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Total Budget</Text>
              <Text size="xl" fw={700} color="green">
                ₹{stats.totalBudget?.toLocaleString('en-IN')}
              </Text>
            </div>
            <ThemeIcon size="md" color="green" variant="light" radius="md">
              <IconCurrencyRupee size={20} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters Section */}
      <Paper withBorder radius="md" p="md" mb="md">
        <Stack spacing="md">
          <Group position="apart">
            <Group spacing="xs">
              <ThemeIcon color="blue" variant="light">
                <IconFilter size={18} />
              </ThemeIcon>
              <Text fw={600}>Filters</Text>
            </Group>
            <Group spacing="xs">
              <Tooltip label="Refresh">
                <ActionIcon
                  variant="light"
                  color="blue"
                  onClick={fetchDepartments}
                  loading={loading}
                >
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              {hasActiveFilters && (
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  onClick={clearFilters}
                  leftSection={<IconX size={14} />}
                >
                  Clear Filters
                </Button>
              )}
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              placeholder="Search by name or code..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
              rightSection={filters.search && (
                <ActionIcon size="xs" onClick={() => handleSearch('')}>
                  <IconX size={14} />
                </ActionIcon>
              )}
            />

            <Select
              placeholder="Status"
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              data={[
                { value: '', label: 'All Status' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              clearable
            />
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Department Table */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <ScrollArea>
          {loading ? (
            <Center py="xl">
              <Stack align="center" spacing="md">
                <Loader size="lg" />
                <Text color="dimmed">Loading departments...</Text>
              </Stack>
            </Center>
          ) : departments.length === 0 ? (
            <Center py="xl">
              <Stack align="center" spacing="md">
                <ThemeIcon size={60} color="gray" variant="light" radius="xl">
                  <IconBuilding size={32} />
                </ThemeIcon>
                <div>
                  <Text size="lg" fw={500} ta="center" mb="xs">
                    No departments found
                  </Text>
                  <Text color="dimmed" ta="center" size="sm">
                    {hasActiveFilters 
                      ? 'No departments match your filters'
                      : 'Get started by adding your first department'}
                  </Text>
                </div>
                <Button
                  color="blue"
                  onClick={handleAdd}
                  leftSection={<IconPlus size={16} />}
                >
                  Add Department
                </Button>
              </Stack>
            </Center>
          ) : (
            <>
              <Table verticalSpacing="md" fontSize="md">
                <thead style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Head of Department</th>
                    <th>Employees</th>
                    <th>Budget</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept._id}>
                      <td>
                        <Badge variant="light" color="blue" size="lg">
                          {dept.code}
                        </Badge>
                      </td>
                      <td>
                        <Stack spacing={2}>
                          <Text fw={600} size="sm">
                            {dept.name}
                          </Text>
                          {dept.description && (
                            <Text size="xs" color="dimmed" lineClamp={1}>
                              {dept.description}
                            </Text>
                          )}
                        </Stack>
                      </td>
                      <td>
                        {dept.headOfDepartment ? (
                          <Group spacing="xs">
                            <Avatar size="sm" radius="xl" color="blue">
                              {dept.headOfDepartment.personalDetails?.name?.charAt(0)}
                            </Avatar>
                            <Text size="sm">
                              {dept.headOfDepartment.personalDetails?.name}
                            </Text>
                          </Group>
                        ) : (
                          <Text size="sm" color="dimmed">Not assigned</Text>
                        )}
                      </td>
                      <td>
                        <Group spacing="xs">
                          <IconUsers size={14} />
                          <Text fw={600}>{dept.employeeCount || 0}</Text>
                        </Group>
                      </td>
                      <td>
                        <Group spacing="xs">
                          <IconCurrencyRupee size={14} />
                          <Text fw={600} color="green">
                            ₹{(dept.budget || 0).toLocaleString('en-IN')}
                          </Text>
                        </Group>
                      </td>
                      <td>
                        <Badge
                          color={getStatusColor(dept.status)}
                          variant="light"
                          leftSection={getStatusIcon(dept.status)}
                          size="md"
                        >
                          {dept.status}
                        </Badge>
                      </td>
                      <td>
                        <Group spacing="xs" wrap="nowrap">
                          <Tooltip label="View Details">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => handleView(dept)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="light"
                              color="orange"
                              size="sm"
                              onClick={() => handleEdit(dept)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={() => handleDelete(dept._id, dept.name)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box p="md">
                  <Group position="apart">
                    <Text size="sm" color="dimmed">
                      Showing {(pagination.current - 1) * pagination.pageSize + 1} to{' '}
                      {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
                      {pagination.total} departments
                    </Text>
                    <Pagination
                      value={pagination.current}
                      onChange={handlePageChange}
                      total={totalPages}
                      size="sm"
                    />
                  </Group>
                </Box>
              )}
            </>
          )}
        </ScrollArea>
      </Paper>

      {/* Department Modal */}
      <DepartmentModal
        department={editingDepartment}
        employees={employees}
        opened={modalOpened}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />

      {/* View Details Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title={
          <Group spacing="xs">
            <IconBuilding size={20} />
            <Text fw={600}>Department Details</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        {selectedDepartment && (
          <Stack spacing="md">
            <Group position="apart" align="flex-start">
              <Stack spacing={2}>
                <Badge size="lg" color="blue" variant="light">
                  {selectedDepartment.code}
                </Badge>
                <Title order={3}>{selectedDepartment.name}</Title>
                {selectedDepartment.description && (
                  <Text color="dimmed">{selectedDepartment.description}</Text>
                )}
              </Stack>
              <Badge
                color={getStatusColor(selectedDepartment.status)}
                variant="filled"
                size="lg"
              >
                {selectedDepartment.status}
              </Badge>
            </Group>

            <Divider />

            <SimpleGrid cols={2} spacing="md">
              <Stack spacing={3}>
                <Text size="sm" color="dimmed">Total Employees</Text>
                <Group spacing="xs">
                  <IconUsers size={16} />
                  <Text fw={600} size="lg">
                    {selectedDepartment.employeeCount || 0}
                  </Text>
                </Group>
              </Stack>

              <Stack spacing={3}>
                <Text size="sm" color="dimmed">Annual Budget</Text>
                <Group spacing="xs">
                  <IconCurrencyRupee size={16} />
                  <Text fw={600} size="lg" color="green">
                    ₹{(selectedDepartment.budget || 0).toLocaleString('en-IN')}
                  </Text>
                </Group>
              </Stack>
            </SimpleGrid>

            {selectedDepartment.headOfDepartment && (
              <Paper withBorder p="md" radius="sm">
                <Text size="sm" fw={600} mb="sm">Head of Department</Text>
                <Group spacing="md">
                  <Avatar size="lg" radius="xl" color="blue">
                    {selectedDepartment.headOfDepartment.personalDetails?.name?.charAt(0)}
                  </Avatar>
                  <div>
                    <Text fw={600}>{selectedDepartment.headOfDepartment.personalDetails?.name}</Text>
                    <Text size="sm" color="dimmed">
                      {selectedDepartment.headOfDepartment.employeeNumber}
                    </Text>
                    <Text size="sm" color="dimmed">
                      {selectedDepartment.headOfDepartment.personalDetails?.email}
                    </Text>
                  </div>
                </Group>
              </Paper>
            )}

            <Group grow>
              <Button
                variant="light"
                color="blue"
                leftSection={<IconEdit size={16} />}
                onClick={() => {
                  setViewModalOpened(false);
                  handleEdit(selectedDepartment);
                }}
              >
                Edit Department
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default DepartmentList;