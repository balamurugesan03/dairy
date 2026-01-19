import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Group,
  TextInput,
  Select,
  Table,
  Badge,
  ActionIcon,
  Pagination,
  Loader,
  Center,
  Stack,
  Box,
  SimpleGrid,
  Menu,
  Card,
  Divider
} from '@mantine/core';
import {
  IconArrowLeft,
  IconSearch,
  IconEye,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUser,
  IconPhone,
  IconBuilding,
  IconCalendar,
  IconMapPin,
  IconCoin,
  IconDotsVertical
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { farmerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import AddShareModal from './AddShareModal';
import TerminateModal from './TerminateModal';

const MemberList = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  const searchForm = useForm({
    initialValues: {
      search: '',
      farmerType: ''
    }
  });

  useEffect(() => {
    fetchMembers();
  }, [pagination.current, pagination.pageSize, searchForm.values]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: 'Active',
        farmerType: searchForm.values.farmerType,
        search: searchForm.values.search
      };
      const response = await farmerAPI.getAll(params);
      // Filter only members (farmers with isMembership = true)
      const memberFarmers = (response.data.farmers || response.data).filter(
        farmer => farmer.isMembership === true
      );
      setMembers(memberFarmers);
      setPagination(prev => ({
        ...prev,
        total: memberFarmers.length
      }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch member farmers',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMembership = async (id) => {
    modals.openConfirmModal({
      title: 'Remove Membership',
      children: (
        <Text size="sm">
          Are you sure you want to remove membership for this farmer?
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'orange' },
      onConfirm: async () => {
        try {
          await farmerAPI.toggleMembership(id);
          notifications.show({
            title: 'Success',
            message: 'Membership removed successfully',
            color: 'green'
          });
          fetchMembers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to remove membership',
            color: 'red'
          });
        }
      }
    });
  };

  const handleAddShare = (farmer) => {
    setSelectedFarmer(farmer);
    setShowShareModal(true);
  };

  const handleShareSuccess = () => {
    fetchMembers();
    setShowShareModal(false);
    setSelectedFarmer(null);
  };

  const handleTerminate = (farmer) => {
    setSelectedFarmer(farmer);
    setShowTerminateModal(true);
  };

  const handleTerminateSuccess = () => {
    fetchMembers();
    setShowTerminateModal(false);
    setSelectedFarmer(null);
  };

  const getFarmerTypeColor = (type) => {
    switch (type) {
      case 'A': return 'blue';
      case 'B': return 'green';
      case 'C': return 'yellow';
      default: return 'gray';
    }
  };

  const rows = members.map((farmer) => (
    <tr key={farmer._id}>
      <td>{farmer.farmerNumber}</td>
      <td>
        <Badge
          color="blue"
          variant="light"
          radius="sm"
          size="sm"
        >
          {farmer.memberId || '-'}
        </Badge>
      </td>
      <td>{farmer.personalDetails?.name || '-'}</td>
      <td>{farmer.personalDetails?.phone || '-'}</td>
      <td>
        {farmer.collectionCenter ? (
          <Badge
            color="blue"
            variant="outline"
            radius="sm"
            size="sm"
          >
            {farmer.collectionCenter.centerName}
          </Badge>
        ) : '-'}
      </td>
      <td>
        {farmer.admissionDate ? (
          <Text size="sm">
            {new Date(farmer.admissionDate).toLocaleDateString('en-IN')}
          </Text>
        ) : '-'}
      </td>
      <td>{farmer.address?.village || '-'}</td>
      <td>
        <Badge
          color={getFarmerTypeColor(farmer.farmerType)}
          variant="light"
          radius="sm"
          size="sm"
        >
          {farmer.farmerType}
        </Badge>
      </td>
      <td>
        <Badge
          color="blue"
          variant="filled"
          radius="sm"
          size="md"
        >
          {farmer.financialDetails?.totalShares || 0}
        </Badge>
      </td>
      <td>
        <Group spacing="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={() => navigate(`/farmers/view/${farmer._id}`)}
            title="View"
          >
            <IconEye size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="green"
            onClick={() => navigate(`/farmers/edit/${farmer._id}`)}
            title="Edit"
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={() => handleAddShare(farmer)}
            title="Add Share"
          >
            <IconPlus size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleTerminate(farmer)}
            title="Terminate"
          >
            <IconTrash size={16} />
          </ActionIcon>
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="orange"
                icon={<IconUser size={14} />}
                onClick={() => handleRemoveMembership(farmer._id)}
              >
                Remove Membership
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </td>
    </tr>
  ));

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Member Farmers"
        subtitle="View and manage all member farmers"
        extra={
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/farmers')}
          >
            Back to Farmers
          </Button>
        }
      />

      {/* Search and Filter */}
      <Paper p="md" withBorder mb="md">
        <form onSubmit={searchForm.onSubmit(fetchMembers)}>
          <Group position="apart" align="flex-end">
            <TextInput
              placeholder="Search by member ID, name, or phone"
              icon={<IconSearch size={16} />}
              style={{ flex: 1, minWidth: 300 }}
              size="sm"
              {...searchForm.getInputProps('search')}
            />
            
            <Group spacing="xs">
              <Select
                placeholder="All Types"
                data={[
                  { value: '', label: 'All Types' },
                  { value: 'A', label: 'Type A' },
                  { value: 'B', label: 'Type B' },
                  { value: 'C', label: 'Type C' }
                ]}
                style={{ width: 120 }}
                size="sm"
                {...searchForm.getInputProps('farmerType')}
              />
              <Button type="submit" size="sm">
                Search
              </Button>
            </Group>
          </Group>
        </form>
      </Paper>

      {/* Table */}
      <Paper withBorder radius="md">
        <div style={{ overflowX: 'auto' }}>
          <Table verticalSpacing="sm" fontSize="sm" highlightOnHover>
            <thead>
              <tr>
                <th>Farmer No.</th>
                <th>Member ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Collection Center</th>
                <th>Admission Date</th>
                <th>Village</th>
                <th>Farmer Type</th>
                <th>Total Shares</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <Center py="xl">
                      <Stack align="center">
                        <Loader />
                        <Text mt="sm">Loading member farmers...</Text>
                      </Stack>
                    </Center>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <Center py="xl">
                      <Text color="dimmed">No member farmers found</Text>
                    </Center>
                  </td>
                </tr>
              ) : (
                rows
              )}
            </tbody>
          </Table>
        </div>
      </Paper>

      {/* Pagination */}
      {pagination.total > pagination.pageSize && (
        <Group position="apart" mt="md">
          <Text size="sm" color="dimmed">
            Showing {(pagination.current - 1) * pagination.pageSize + 1} to{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} entries
          </Text>
          
          <Group>
            <Pagination
              value={pagination.current}
              onChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
              total={Math.ceil(pagination.total / pagination.pageSize)}
              size="sm"
              withEdges
            />
          </Group>
        </Group>
      )}

      {/* Modals */}
      <AddShareModal
        opened={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedFarmer(null);
        }}
        onSuccess={handleShareSuccess}
        farmer={selectedFarmer}
      />

      <TerminateModal
        opened={showTerminateModal}
        onClose={() => {
          setShowTerminateModal(false);
          setSelectedFarmer(null);
        }}
        onSuccess={handleTerminateSuccess}
        farmer={selectedFarmer}
      />
    </Container>
  );
};

export default MemberList;