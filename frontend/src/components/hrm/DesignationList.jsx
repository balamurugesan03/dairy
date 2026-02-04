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
  Tooltip,
  ThemeIcon,
  Box,
  Divider,
  ScrollArea,
  Pagination,
  Modal,
  NumberInput,
  Textarea,
  Avatar,
  Alert,
  LoadingOverlay
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconBriefcase,
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconFilter,
  IconX,
  IconUsers,
  IconCurrencyRupee,
  IconRefresh,
  IconUser,
  IconAlertCircle,
  IconEye,
  IconCheck,
  IconBan,
  IconBuilding,
  IconHierarchy,
  IconChartBar,
  IconInfoCircle,
  IconClipboardCheck,
  IconTrendingUp,
  IconLadder,
  IconBusinessplan,
  IconProgressCheck
} from '@tabler/icons-react';
import { designationAPI, departmentAPI } from '../../services/api';

// Designation Modal Component
const DesignationModal = ({ designation, departments, opened, onClose, onSuccess }) => {
  const isEditMode = Boolean(designation);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      code: '',
      description: '',
      level: 'Junior',
      department: '',
      minSalary: 0,
      maxSalary: 0,
      status: 'Active',
      remarks: ''
    },

    validate: {
      name: (value) => (!value.trim() ? 'Designation name is required' : null),
      code: (value) => (!value.trim() ? 'Designation code is required' : null),
      department: (value) => (!value.trim() ? 'Department is required' : null),
      minSalary: (value) => (value < 0 ? 'Salary cannot be negative' : null),
      maxSalary: (value, values) => 
        value <= values.minSalary ? 'Max salary must be greater than min salary' : null
    }
  });

  useEffect(() => {
    if (designation) {
      form.setValues({
        name: designation.name || '',
        code: designation.code || '',
        description: designation.description || '',
        level: designation.level || 'Junior',
        department: designation.department?._id || '',
        minSalary: designation.salaryRange?.min || 0,
        maxSalary: designation.salaryRange?.max || 0,
        status: designation.status || 'Active',
        remarks: designation.remarks || ''
      });
    }
  }, [designation]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        salaryRange: {
          min: values.minSalary,
          max: values.maxSalary
        }
      };
      delete payload.minSalary;
      delete payload.maxSalary;

      if (isEditMode) {
        await designationAPI.update(designation._id, payload);
        notifications.show({
          title: 'Success',
          message: 'Designation updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        await designationAPI.create(payload);
        notifications.show({
          title: 'Success',
          message: 'Designation created successfully',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }
      form.reset();
      onSuccess();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || `Failed to ${isEditMode ? 'update' : 'create'} designation`,
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

  const levelOptions = [
    { value: 'Entry', label: 'Entry Level', color: 'blue' },
    { value: 'Junior', label: 'Junior', color: 'cyan' },
    { value: 'Mid', label: 'Mid Level', color: 'yellow' },
    { value: 'Senior', label: 'Senior', color: 'orange' },
    { value: 'Manager', label: 'Manager', color: 'green' },
    { value: 'Executive', label: 'Executive', color: 'red' }
  ];

  const departmentOptions = [
    { value: '', label: 'Select Department' },
    ...departments.map(dept => ({
      value: dept._id,
      label: dept.name,
      group: 'Departments'
    }))
  ];

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group spacing="sm">
          <ThemeIcon color="blue" variant="light" radius="md">
            <IconBriefcase size={20} />
          </ThemeIcon>
          <Title order={3}>
            {isEditMode ? 'Edit Designation' : 'Create New Designation'}
          </Title>
          {isEditMode && designation?.code && (
            <Badge variant="light" color="blue">
              {designation.code}
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
              label="Designation Name"
              placeholder="e.g., Senior Software Engineer"
              withAsterisk
              leftSection={<IconBriefcase size={16} />}
              {...form.getInputProps('name')}
              disabled={loading}
            />

            <TextInput
              label="Designation Code"
              placeholder="e.g., SSE"
              withAsterisk
              {...form.getInputProps('code')}
              disabled={loading || isEditMode}
              onChange={(e) => form.setFieldValue('code', e.target.value.toUpperCase())}
            />
          </SimpleGrid>

          <Textarea
            label="Description"
            placeholder="Brief description of the designation..."
            leftSection={<IconClipboardCheck size={16} />}
            {...form.getInputProps('description')}
            minRows={3}
            disabled={loading}
          />

          <Divider label="Position Details" labelPosition="center" />

          <SimpleGrid cols={2} spacing="md">
            <Select
              label="Level"
              placeholder="Select level"
              withAsterisk
              data={levelOptions.map(opt => ({
                value: opt.value,
                label: opt.label,
                color: opt.color
              }))}
              leftSection={<IconLadder size={16} />}
              {...form.getInputProps('level')}
              disabled={loading}
            />

            <Select
              label="Department"
              placeholder="Select department"
              withAsterisk
              data={departmentOptions}
              searchable
              clearable
              leftSection={<IconBuilding size={16} />}
              {...form.getInputProps('department')}
              disabled={loading}
            />
          </SimpleGrid>

          <SimpleGrid cols={2} spacing="md">
            <NumberInput
              label="Min Salary (₹)"
              placeholder="0.00"
              thousandSeparator=","
              decimalScale={2}
              min={0}
              leftSection={<IconCurrencyRupee size={16} />}
              {...form.getInputProps('minSalary')}
              disabled={loading}
            />

            <NumberInput
              label="Max Salary (₹)"
              placeholder="0.00"
              thousandSeparator=","
              decimalScale={2}
              min={0}
              leftSection={<IconBusinessplan size={16} />}
              {...form.getInputProps('maxSalary')}
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
              leftSection={<IconProgressCheck size={16} />}
              {...form.getInputProps('status')}
              disabled={loading}
            />
          </SimpleGrid>

          <Textarea
            label="Remarks"
            placeholder="Any additional notes, requirements, or special instructions..."
            leftSection={<IconInfoCircle size={16} />}
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
                <Text size="sm">
                  <Text span fw={500}>Level:</Text> {form.values.level}
                </Text>
                {form.values.department && (
                  <Text size="sm">
                    <Text span fw={500}>Department:</Text>{' '}
                    {departments.find(d => d._id === form.values.department)?.name}
                  </Text>
                )}
                <Text size="sm">
                  <Text span fw={500}>Salary Range:</Text>{' '}
                  ₹{form.values.minSalary.toLocaleString('en-IN')} - ₹{form.values.maxSalary.toLocaleString('en-IN')}
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
              {isEditMode ? 'Update Designation' : 'Create Designation'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

// Main DesignationList Component
const DesignationList = () => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDesignation, setSelectedDesignation] = useState(null);
  const [viewModalOpened, setViewModalOpened] = useState(false);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    level: ''
  });

  useEffect(() => {
    fetchDesignations();
    fetchDepartments();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchDesignations = async () => {
    setLoading(true);
    try {
      const response = await designationAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      });

      setDesignations(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0
      }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch designations',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getActive();
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
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
    setEditingDesignation(null);
    setModalOpened(true);
  };

  const handleEdit = (designation) => {
    setEditingDesignation(designation);
    setModalOpened(true);
  };

  const handleView = (designation) => {
    setSelectedDesignation(designation);
    setViewModalOpened(true);
  };

  const handleDelete = async (id, name) => {
    modals.openConfirmModal({
      title: 'Delete Designation',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete designation <Text span fw={600}>"{name}"</Text>? 
          This action cannot be undone and will change its status to Inactive.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await designationAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Designation deleted successfully',
            color: 'green',
            icon: <IconCheck size={16} />
          });
          fetchDesignations();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to delete designation',
            color: 'red',
            icon: <IconAlertCircle size={16} />
          });
        }
      }
    });
  };

  const handleModalClose = () => {
    setModalOpened(false);
    setEditingDesignation(null);
  };

  const handleModalSuccess = () => {
    setModalOpened(false);
    setEditingDesignation(null);
    fetchDesignations();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      level: ''
    });
    setPagination({ ...pagination, current: 1 });
  };

  const getStatusColor = (status) => {
    return status === 'Active' ? 'green' : 'red';
  };

  const getStatusIcon = (status) => {
    return status === 'Active' ? <IconCheck size={12} /> : <IconBan size={12} />;
  };

  const getLevelColor = (level) => {
    const colors = {
      'Entry': 'blue',
      'Junior': 'cyan',
      'Mid': 'yellow',
      'Senior': 'orange',
      'Manager': 'green',
      'Executive': 'red'
    };
    return colors[level] || 'gray';
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const hasActiveFilters = filters.search || filters.status || filters.level;

  // Calculate statistics
  const calculateStats = () => {
    const activeCount = designations.filter(d => d.status === 'Active').length;
    const inactiveCount = designations.filter(d => d.status === 'Inactive').length;
    const totalEmployees = designations.reduce((sum, d) => sum + (d.employeeCount || 0), 0);
    const avgMinSalary = designations.length > 0 
      ? designations.reduce((sum, d) => sum + (d.salaryRange?.min || 0), 0) / designations.length
      : 0;
    const avgMaxSalary = designations.length > 0 
      ? designations.reduce((sum, d) => sum + (d.salaryRange?.max || 0), 0) / designations.length
      : 0;

    return {
      activeCount,
      inactiveCount,
      totalEmployees,
      avgMinSalary,
      avgMaxSalary
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
              <IconBriefcase size={24} />
            </ThemeIcon>
            <div>
              <Title order={2} size="h2">Designation Management</Title>
              <Text color="dimmed" size="sm">
                Manage job positions, roles, and hierarchies
              </Text>
            </div>
          </Group>
          <Button
            color="blue"
            size="md"
            leftSection={<IconPlus size={16} />}
            onClick={handleAdd}
          >
            Add Designation
          </Button>
        </Group>
      </Paper>

      {/* Statistics Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="md">
        <Card withBorder radius="md" p="sm">
          <Group position="apart">
            <div>
              <Text size="sm" color="dimmed">Total Designations</Text>
              <Text size="xl" fw={700}>
                {designations.length}
              </Text>
            </div>
            <ThemeIcon size="md" color="blue" variant="light" radius="md">
              <IconBriefcase size={20} />
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
              <Text size="sm" color="dimmed">Avg Salary Range</Text>
              <Text size="lg" fw={700} color="green">
                ₹{stats.avgMinSalary.toLocaleString('en-IN', { maximumFractionDigits: 0 })} - 
                ₹{stats.avgMaxSalary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
                  onClick={fetchDesignations}
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

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
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
              placeholder="Level"
              value={filters.level}
              onChange={(value) => handleFilterChange('level', value)}
              data={[
                { value: '', label: 'All Levels' },
                { value: 'Entry', label: 'Entry Level' },
                { value: 'Junior', label: 'Junior' },
                { value: 'Mid', label: 'Mid Level' },
                { value: 'Senior', label: 'Senior' },
                { value: 'Manager', label: 'Manager' },
                { value: 'Executive', label: 'Executive' }
              ]}
              clearable
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

      {/* Designation Table */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <ScrollArea>
          {loading ? (
            <Center py="xl">
              <Stack align="center" spacing="md">
                <Loader size="lg" />
                <Text color="dimmed">Loading designations...</Text>
              </Stack>
            </Center>
          ) : designations.length === 0 ? (
            <Center py="xl">
              <Stack align="center" spacing="md">
                <ThemeIcon size={60} color="gray" variant="light" radius="xl">
                  <IconBriefcase size={32} />
                </ThemeIcon>
                <div>
                  <Text size="lg" fw={500} ta="center" mb="xs">
                    No designations found
                  </Text>
                  <Text color="dimmed" ta="center" size="sm">
                    {hasActiveFilters 
                      ? 'No designations match your filters'
                      : 'Get started by adding your first designation'}
                  </Text>
                </div>
                <Button
                  color="blue"
                  onClick={handleAdd}
                  leftSection={<IconPlus size={16} />}
                >
                  Add Designation
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
                    <th>Level</th>
                    <th>Department</th>
                    <th>Salary Range</th>
                    <th>Employees</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.map((desig) => (
                    <tr key={desig._id}>
                      <td>
                        <Badge variant="light" color="blue" size="lg">
                          {desig.code}
                        </Badge>
                      </td>
                      <td>
                        <Stack spacing={2}>
                          <Text fw={600} size="sm">
                            {desig.name}
                          </Text>
                          {desig.description && (
                            <Text size="xs" color="dimmed" lineClamp={1}>
                              {desig.description}
                            </Text>
                          )}
                        </Stack>
                      </td>
                      <td>
                        <Badge
                          color={getLevelColor(desig.level)}
                          variant="light"
                          leftSection={<IconTrendingUp size={12} />}
                          size="md"
                        >
                          {desig.level}
                        </Badge>
                      </td>
                      <td>
                        {desig.department ? (
                          <Group spacing="xs">
                            <Avatar size="sm" radius="xl" color="blue">
                              <IconBuilding size={12} />
                            </Avatar>
                            <Text size="sm">
                              {desig.department.name}
                            </Text>
                          </Group>
                        ) : (
                          <Text size="sm" color="dimmed">Not assigned</Text>
                        )}
                      </td>
                      <td>
                        {desig.salaryRange?.min && desig.salaryRange?.max ? (
                          <Group spacing="xs">
                            <IconCurrencyRupee size={14} />
                            <Stack spacing={0}>
                              <Text fw={600} color="green" size="sm">
                                ₹{desig.salaryRange.min.toLocaleString('en-IN')} - 
                                ₹{desig.salaryRange.max.toLocaleString('en-IN')}
                              </Text>
                              <Text size="xs" color="dimmed">
                                Per month
                              </Text>
                            </Stack>
                          </Group>
                        ) : (
                          <Text size="sm" color="dimmed">Not set</Text>
                        )}
                      </td>
                      <td>
                        <Group spacing="xs">
                          <IconUsers size={14} />
                          <Text fw={600}>{desig.employeeCount || 0}</Text>
                        </Group>
                      </td>
                      <td>
                        <Badge
                          color={getStatusColor(desig.status)}
                          variant="light"
                          leftSection={getStatusIcon(desig.status)}
                          size="md"
                        >
                          {desig.status}
                        </Badge>
                      </td>
                      <td>
                        <Group spacing="xs" wrap="nowrap">
                          <Tooltip label="View Details">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => handleView(desig)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="light"
                              color="orange"
                              size="sm"
                              onClick={() => handleEdit(desig)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={() => handleDelete(desig._id, desig.name)}
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
                      {pagination.total} designations
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

      {/* Designation Modal */}
      <DesignationModal
        designation={editingDesignation}
        departments={departments}
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
            <IconBriefcase size={20} />
            <Text fw={600}>Designation Details</Text>
          </Group>
        }
        size="lg"
        radius="md"
      >
        {selectedDesignation && (
          <Stack spacing="md">
            <Group position="apart" align="flex-start">
              <Stack spacing={2}>
                <Badge size="lg" color="blue" variant="light">
                  {selectedDesignation.code}
                </Badge>
                <Title order={3}>{selectedDesignation.name}</Title>
                {selectedDesignation.description && (
                  <Text color="dimmed">{selectedDesignation.description}</Text>
                )}
              </Stack>
              <Badge
                color={getStatusColor(selectedDesignation.status)}
                variant="filled"
                size="lg"
              >
                {selectedDesignation.status}
              </Badge>
            </Group>

            <Divider />

            <SimpleGrid cols={2} spacing="md">
              <Stack spacing={3}>
                <Text size="sm" color="dimmed">Level</Text>
                <Badge
                  color={getLevelColor(selectedDesignation.level)}
                  variant="light"
                  size="lg"
                >
                  {selectedDesignation.level}
                </Badge>
              </Stack>

              <Stack spacing={3}>
                <Text size="sm" color="dimmed">Total Employees</Text>
                <Group spacing="xs">
                  <IconUsers size={16} />
                  <Text fw={600} size="lg">
                    {selectedDesignation.employeeCount || 0}
                  </Text>
                </Group>
              </Stack>

              {selectedDesignation.department && (
                <>
                  <Stack spacing={3}>
                    <Text size="sm" color="dimmed">Department</Text>
                    <Group spacing="xs">
                      <Avatar size="sm" radius="xl" color="blue">
                        <IconBuilding size={12} />
                      </Avatar>
                      <Text fw={600}>{selectedDesignation.department.name}</Text>
                    </Group>
                  </Stack>

                  <Stack spacing={3}>
                    <Text size="sm" color="dimmed">Department Code</Text>
                    <Text fw={600}>{selectedDesignation.department.code}</Text>
                  </Stack>
                </>
              )}

              {selectedDesignation.salaryRange?.min && selectedDesignation.salaryRange?.max && (
                <Stack spacing={3}>
                  <Text size="sm" color="dimmed">Salary Range</Text>
                  <Group spacing="xs">
                    <IconCurrencyRupee size={16} />
                    <Text fw={600} size="lg" color="green">
                      ₹{selectedDesignation.salaryRange.min.toLocaleString('en-IN')} - 
                      ₹{selectedDesignation.salaryRange.max.toLocaleString('en-IN')}
                    </Text>
                  </Group>
                  <Text size="xs" color="dimmed">Per month</Text>
                </Stack>
              )}
            </SimpleGrid>

            {selectedDesignation.remarks && (
              <Paper withBorder p="md" radius="sm">
                <Text size="sm" fw={600} mb="sm">Remarks</Text>
                <Text size="sm">{selectedDesignation.remarks}</Text>
              </Paper>
            )}

            <Group grow>
              <Button
                variant="light"
                color="blue"
                leftSection={<IconEdit size={16} />}
                onClick={() => {
                  setViewModalOpened(false);
                  handleEdit(selectedDesignation);
                }}
              >
                Edit Designation
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default DesignationList;