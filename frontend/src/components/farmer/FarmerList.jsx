import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  TextInput,
  Select,
  Group,
  Stack,
  Paper,
  Badge,
  ActionIcon,
  Menu,
  Grid,
  Box,
  Pagination
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconDots,
  IconEdit,
  IconTrash,
  IconEye,
  IconUsers,
  IconUserMinus
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { farmerAPI } from '../../services/api';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';

const FarmerList = () => {
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: 'Active',
    farmerType: '',
    isMembership: ''
  });

  const [sortStatus, setSortStatus] = useState({
    columnAccessor: 'farmerNumber',
    direction: 'asc'
  });

  useEffect(() => {
    fetchFarmers();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        farmerType: filters.farmerType,
        isMembership: filters.isMembership,
        search: filters.search
      };

      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const response = await farmerAPI.getAll(params);
      setFarmers(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || response.data?.length || 0
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch farmers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Farmer',
      content: 'Are you sure you want to deactivate this farmer?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await farmerAPI.delete(id);
          message.success('Farmer deactivated successfully');
          fetchFarmers();
        } catch (error) {
          message.error(error.message || 'Failed to deactivate farmer');
        }
      }
    });
  };

  const handleMembershipToggle = async (id, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    showConfirmDialog({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Membership`,
      content: `Are you sure you want to ${action} membership for this farmer?`,
      type: currentStatus ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          await farmerAPI.toggleMembership(id);
          message.success(`Membership ${action}d successfully`);
          fetchFarmers();
        } catch (error) {
          message.error(error.message || `Failed to ${action} membership`);
        }
      }
    });
  };

  const columns = [
    {
      accessor: 'farmerNumber',
      title: 'Farmer No.',
      width: 120,
      sortable: true
    },
    {
      accessor: 'memberId',
      title: 'Member ID',
      width: 120,
      render: (farmer) => farmer.memberId || '-'
    },
    {
      accessor: 'name',
      title: 'Name',
      sortable: true,
      render: (farmer) => farmer.personalDetails?.name || '-'
    },
    {
      accessor: 'phone',
      title: 'Phone',
      width: 130,
      render: (farmer) => farmer.personalDetails?.phone || '-'
    },
    {
      accessor: 'village',
      title: 'Village',
      sortable: true,
      render: (farmer) => farmer.address?.village || '-'
    },
    {
      accessor: 'farmerType',
      title: 'Type',
      width: 100,
      render: (farmer) => (
        <Badge color={farmer.farmerType === 'A' ? 'blue' : farmer.farmerType === 'B' ? 'green' : 'orange'}>
          {farmer.farmerType || '-'}
        </Badge>
      )
    },
    {
      accessor: 'isMembership',
      title: 'Membership',
      width: 120,
      render: (farmer) => (
        <Badge color={farmer.isMembership ? 'green' : 'gray'}>
          {farmer.isMembership ? 'Member' : 'Non-Member'}
        </Badge>
      )
    },
    {
      accessor: 'status',
      title: 'Status',
      width: 100,
      render: (farmer) => (
        <Badge color={farmer.status === 'Active' ? 'green' : 'red'}>
          {farmer.status}
        </Badge>
      )
    },
    {
      accessor: 'actions',
      title: 'Actions',
      width: 80,
      textAlign: 'center',
      render: (farmer) => (
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconEye size={14} />}
              onClick={() => navigate(`/farmers/view/${farmer._id}`)}
            >
              View Details
            </Menu.Item>
            <Menu.Item
              leftSection={<IconEdit size={14} />}
              onClick={() => navigate(`/farmers/edit/${farmer._id}`)}
            >
              Edit
            </Menu.Item>
            <Menu.Item
              leftSection={farmer.isMembership ? <IconUserMinus size={14} /> : <IconUsers size={14} />}
              onClick={() => handleMembershipToggle(farmer._id, farmer.isMembership)}
            >
              {farmer.isMembership ? 'Remove' : 'Add'} Membership
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => handleDelete(farmer._id)}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )
    }
  ];

  return (
    <Container fluid>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={2}>Farmer Management</Title>
            <Text c="dimmed" size="sm">Manage dairy cooperative farmers</Text>
          </Box>
          <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/farmers/add')}>
            Add Farmer
          </Button>
        </Group>

        <Paper p="md" withBorder>
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                placeholder="Search farmers..."
                leftSection={<IconSearch size={16} />}
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
              <Select
                placeholder="Status"
                data={[
                  { value: '', label: 'All Status' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
              <Select
                placeholder="Farmer Type"
                data={[
                  { value: '', label: 'All Types' },
                  { value: 'A', label: 'Type A' },
                  { value: 'B', label: 'Type B' },
                  { value: 'C', label: 'Type C' }
                ]}
                value={filters.farmerType}
                onChange={(value) => setFilters(prev => ({ ...prev, farmerType: value }))}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
              <Select
                placeholder="Membership"
                data={[
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Members' },
                  { value: 'false', label: 'Non-Members' }
                ]}
                value={filters.isMembership}
                onChange={(value) => setFilters(prev => ({ ...prev, isMembership: value }))}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 2 }}>
              <Text size="sm" c="dimmed" style={{ lineHeight: '36px' }}>
                {pagination.total} Total
              </Text>
            </Grid.Col>
          </Grid>
        </Paper>

        <Paper withBorder>
          <DataTable
            columns={columns}
            records={farmers}
            fetching={loading}
            minHeight={400}
            noRecordsText="No farmers found"
            striped
            highlightOnHover
            verticalSpacing="sm"
            sortStatus={sortStatus}
            onSortStatusChange={setSortStatus}
          />
        </Paper>

        {pagination.total > 0 && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {(pagination.current - 1) * pagination.pageSize + 1}-
              {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total}
            </Text>
            <Group>
              <Select
                value={String(pagination.pageSize)}
                onChange={(value) => setPagination(prev => ({
                  ...prev,
                  pageSize: parseInt(value),
                  current: 1
                }))}
                data={[
                  { value: '10', label: '10/page' },
                  { value: '20', label: '20/page' },
                  { value: '50', label: '50/page' },
                  { value: '100', label: '100/page' }
                ]}
                w={120}
              />
              <Pagination
                value={pagination.current}
                onChange={(value) => setPagination(prev => ({ ...prev, current: value }))}
                total={Math.ceil(pagination.total / pagination.pageSize)}
              />
            </Group>
          </Group>
        )}
      </Stack>
    </Container>
  );
};

export default FarmerList;
