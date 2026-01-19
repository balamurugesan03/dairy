import { useState, useEffect } from 'react';
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
  Collapse,
  Grid,
  Box,
  Pagination,
  LoadingOverlay,
  useMantineTheme,
  Tooltip,
  Modal,
  Table,
  Center,
  Loader
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconDots,
  IconEdit,
  IconTrash,
  IconUserPlus,
  IconUserMinus,
  IconChevronDown,
  IconChevronUp,
  IconUpload,
  IconRefresh,
  IconUser,
  IconBuilding,
  IconBuildingCommunity,
  IconCalendar,
  IconCoin,
  IconPaw,
  IconUsers,
  IconCoinRupee
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { farmerAPI, collectionCenterAPI } from '../../services/api';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';
import FarmerModal from './FarmerModal';
import AddShareModal from './AddShareModal';
import TerminateModal from './TerminateModal';
import ImportModal from '../common/ImportModal';
import { generateFarmerImportTemplate } from '../../utils/excelTemplate';

const FarmerManagement = () => {
  const theme = useMantineTheme();
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
    cowType: '',
    village: '',
    panchayat: '',
    ward: '',
    isMembership: '',
    collectionCenter: '',
    admissionDateFrom: '',
    admissionDateTo: '',
    minShares: '',
    maxShares: ''
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFarmerForShare, setSelectedFarmerForShare] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPagination, setMemberPagination] = useState({
    current: 1,
    pageSize: 10
  });
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [selectedFarmerForTerminate, setSelectedFarmerForTerminate] = useState(null);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [villages, setVillages] = useState([]);
  const [panchayats, setPanchayats] = useState([]);
  const [sortStatus, setSortStatus] = useState({ columnAccessor: '', direction: 'asc' });

  useEffect(() => {
    fetchFarmers();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchCollectionCenters();
    fetchFilterOptions();
  }, []);

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll({ status: 'Active', limit: 100 });
      setCollectionCenters(response.data || []);
    } catch (error) {
      console.error('Failed to fetch collection centers:', error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await farmerAPI.getAll({ limit: 1000 });
      const allFarmers = response.data || [];

      const uniqueVillages = [...new Set(allFarmers.map(f => f.address?.village).filter(Boolean))];
      const uniquePanchayats = [...new Set(allFarmers.map(f => f.address?.panchayat).filter(Boolean))];

      setVillages(uniqueVillages.sort());
      setPanchayats(uniquePanchayats.sort());
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        farmerType: filters.farmerType,
        cowType: filters.cowType,
        village: filters.village,
        panchayat: filters.panchayat,
        ward: filters.ward,
        isMembership: filters.isMembership,
        collectionCenter: filters.collectionCenter,
        admissionDateFrom: filters.admissionDateFrom,
        admissionDateTo: filters.admissionDateTo,
        minShares: filters.minShares,
        maxShares: filters.maxShares,
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

  const handleEdit = (id) => {
    setSelectedFarmerId(id);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setSelectedFarmerId(null);
    setShowModal(true);
  };

  const handleModalSuccess = () => {
    fetchFarmers();
  };

  const handleImport = async (data) => {
    try {
      const farmers = data.map(row => ({
        farmerNumber: String(row['Farmer Number'] || '').trim(),
        memberId: String(row['Member ID'] || '').trim(),
        name: String(row['Name'] || '').trim(),
        phone: String(row['Phone Number'] || '').replace(/\D/g, '')
      }));

      const response = await farmerAPI.bulkImport(farmers);
      const { created, updated, errors } = response.data;

      if (errors.length === 0) {
        message.success(
          `Import successful! ${created} farmers created, ${updated} farmers updated.`
        );
      } else {
        message.warning(
          `Import completed with errors: ${created} created, ${updated} updated, ${errors.length} failed.`
        );
      }

      fetchFarmers();
      return response;
    } catch (error) {
      message.error(error.message || 'Import failed');
      throw error;
    }
  };

  const handleDownloadTemplate = () => {
    generateFarmerImportTemplate();
    message.info('Template downloaded successfully');
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      farmerType: '',
      cowType: '',
      village: '',
      panchayat: '',
      ward: '',
      isMembership: '',
      collectionCenter: '',
      admissionDateFrom: '',
      admissionDateTo: '',
      minShares: '',
      maxShares: ''
    });
  };

  const handleRefresh = () => {
    fetchFarmers();
    message.success('Farmers list refreshed');
  };

  const handleAddShare = (farmer) => {
    setSelectedFarmerForShare(farmer);
    setShowShareModal(true);
  };

  const handleShareSuccess = () => {
    setShowShareModal(false);
    setSelectedFarmerForShare(null);
    fetchFarmers();
  };

  const handleTerminate = (farmer) => {
    setSelectedFarmerForTerminate(farmer);
    setShowTerminateModal(true);
  };

  const handleTerminateSuccess = () => {
    setShowTerminateModal(false);
    setSelectedFarmerForTerminate(null);
    fetchMembers();
    fetchFarmers();
  };

  // Filter members by search (memberId or name)
  const getFilteredMembers = () => {
    if (!memberSearch.trim()) return members;
    const search = memberSearch.toLowerCase().trim();
    return members.filter(member =>
      (member.memberId && member.memberId.toLowerCase().includes(search)) ||
      (member.personalDetails?.name && member.personalDetails.name.toLowerCase().includes(search))
    );
  };

  // Get paginated members
  const getPaginatedMembers = () => {
    const filteredMembers = getFilteredMembers();
    const start = (memberPagination.current - 1) * memberPagination.pageSize;
    const end = start + memberPagination.pageSize;
    return filteredMembers.slice(start, end);
  };

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const response = await farmerAPI.getAll({
        status: 'Active',
        isMembership: 'true',
        limit: 500
      });
      const memberFarmers = (response.data || []).filter(
        farmer => farmer.isMembership === true
      );
      setMembers(memberFarmers);
    } catch (error) {
      message.error(error.message || 'Failed to fetch members');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleViewMembers = () => {
    setShowMembersModal(true);
    fetchMembers();
  };

  const getFarmerTypeIcon = (type) => {
    switch (type) {
      case 'A': return <IconUser size={14} />;
      case 'B': return <IconBuilding size={14} />;
      case 'C': return <IconBuildingCommunity size={14} />;
      default: return <IconUser size={14} />;
    }
  };

  const getFarmerTypeColor = (type) => {
    switch (type) {
      case 'A': return 'blue';
      case 'B': return 'teal';
      case 'C': return 'violet';
      default: return 'gray';
    }
  };

  const columns = [
    {
      accessor: 'farmerNumber',
      title: (
        <Group gap="xs">
          <IconUser size={14} />
          <span>Farmer No.</span>
        </Group>
      ),
      width: 120,
      sortable: true,
      render: (farmer) => (
        <Text fw={600} size="sm">
          {farmer.farmerNumber || '-'}
        </Text>
      )
    },
    {
      accessor: 'memberId',
      title: 'Member ID',
      width: 120,
      sortable: true,
      render: (farmer) => (
        <Badge variant="light" color="grape">
          {farmer.memberId || 'N/A'}
        </Badge>
      )
    },
    {
      accessor: 'personalDetails.name',
      title: 'Name',
      sortable: true,
      render: (farmer) => (
        <Box>
          <Text fw={500} size="sm">
            {farmer.personalDetails?.name || '-'}
          </Text>
          {farmer.personalDetails?.fatherName && (
            <Text size="xs" c="dimmed">
              {farmer.personalDetails.fatherName}
            </Text>
          )}
        </Box>
      )
    },
    {
      accessor: 'personalDetails.phone',
      title: 'Contact',
      width: 140,
      render: (farmer) => (
        <Box>
          <Text size="sm">{farmer.personalDetails?.phone || '-'}</Text>
          {farmer.personalDetails?.email && (
            <Text size="xs" c="dimmed" truncate>
              {farmer.personalDetails.email}
            </Text>
          )}
        </Box>
      )
    },
    {
      accessor: 'address.village',
      title: 'Location',
      sortable: true,
      render: (farmer) => (
        <Box>
          <Text size="sm">{farmer.address?.village || '-'}</Text>
          <Text size="xs" c="dimmed">
            {farmer.address?.panchayat || '-'}
          </Text>
        </Box>
      )
    },
    {
      accessor: 'farmerType',
      title: 'Type',
      width: 120,
      render: (farmer) => (
        <Badge
          leftSection={getFarmerTypeIcon(farmer.farmerType)}
          color={getFarmerTypeColor(farmer.farmerType)}
          variant="light"
        >
          {farmer.farmerType === 'A' ? 'Individual' : 
           farmer.farmerType === 'B' ? 'Farm' : 
           farmer.farmerType === 'C' ? 'Institution' : '-'}
        </Badge>
      )
    },
    {
      accessor: 'cowType',
      title: (
        <Group gap="xs">
          <IconPaw size={14} />
          <span>Cow Type</span>
        </Group>
      ),
      width: 120,
      render: (farmer) => (
        <Badge variant="outline" color="orange">
          {farmer.cowType || '-'}
        </Badge>
      )
    },
    {
      accessor: 'shares',
      title: (
        <Group gap="xs">
          <IconCoin size={14} />
          <span>Shares</span>
        </Group>
      ),
      width: 100,
      sortable: true,
      render: (farmer) => (
        <Text fw={600} size="sm" ta="center">
          {farmer.shares || 0}
        </Text>
      )
    },
    {
      accessor: 'isMembership',
      title: 'Membership',
      width: 130,
      render: (farmer) => (
        <Badge
          color={farmer.isMembership ? 'green' : 'gray'}
          variant={farmer.isMembership ? 'filled' : 'light'}
          radius="sm"
        >
          {farmer.isMembership ? 'Member' : 'Non-Member'}
        </Badge>
      )
    },
    {
      accessor: 'status',
      title: 'Status',
      width: 110,
      render: (farmer) => (
        <Badge
          color={farmer.status === 'Active' ? 'green' : 'red'}
          variant="light"
          radius="sm"
          fullWidth
        >
          {farmer.status}
        </Badge>
      )
    },
    {
      accessor: 'admissionDate',
      title: (
        <Group gap="xs">
          <IconCalendar size={14} />
          <span>Admission</span>
        </Group>
      ),
      width: 120,
      render: (farmer) => (
        <Text size="sm">
          {farmer.admissionDate ? new Date(farmer.admissionDate).toLocaleDateString() : '-'}
        </Text>
      )
    },
    {
      accessor: 'actions',
      title: 'Actions',
      width: 80,
      textAlign: 'center',
      render: (farmer) => (
        <Menu shadow="md" width={200} position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="light" color="gray" size="md">
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Farmer Actions</Menu.Label>
            <Menu.Item
              leftSection={<IconEdit size={16} />}
              onClick={() => handleEdit(farmer._id)}
            >
              Edit Details
            </Menu.Item>
            <Menu.Item
              leftSection={farmer.isMembership ? <IconUserMinus size={16} /> : <IconUserPlus size={16} />}
              onClick={() => handleMembershipToggle(farmer._id, farmer.isMembership)}
              color={farmer.isMembership ? 'orange' : 'blue'}
            >
              {farmer.isMembership ? 'Remove Membership' : 'Add Membership'}
            </Menu.Item>
            {farmer.isMembership && (
              <Menu.Item
                leftSection={<IconCoin size={16} />}
                onClick={() => handleAddShare(farmer)}
                color="green"
              >
                Add Share
              </Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Label>Danger Zone</Menu.Label>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => handleDelete(farmer._id)}
            >
              Deactivate Farmer
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )
    }
  ];

  return (
    <Container fluid p="md">
      <Stack gap="lg">
        {/* Header Section */}
        <Paper p="md" radius="md" withBorder bg={theme.colors.gray[0]}>
          <Group justify="space-between" align="center">
            <Box>
              <Title order={2} c={theme.colors.blue[7]}>
                Farmer Management
              </Title>
              <Text c="dimmed" size="sm" mt={2}>
                Manage dairy cooperative farmers and their details
              </Text>
            </Box>
            <Group>
              <Tooltip label="Refresh List">
                <ActionIcon
                  variant="light"
                  color="blue"
                  size="lg"
                  onClick={handleRefresh}
                  loading={loading}
                >
                  <IconRefresh size={20} />
                </ActionIcon>
              </Tooltip>
              <Button
                variant="light"
                color="green"
                leftSection={<IconUsers size={18} />}
                onClick={handleViewMembers}
              >
                View Members
              </Button>
              <Button
                variant="light"
                color="gray"
                leftSection={<IconUpload size={18} />}
                onClick={() => setShowImportModal(true)}
              >
                Import
              </Button>
              <Button
                leftSection={<IconPlus size={18} />}
                onClick={handleAddNew}
                color="blue"
              >
                Add Farmer
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* Filters Section */}
        <Paper p="md" radius="md" withBorder>
          <Stack gap="md">
            <Group>
              <TextInput
                placeholder="Search by name, number, or ID..."
                leftSection={<IconSearch size={18} />}
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                style={{ flex: 1 }}
                radius="md"
              />

              <Select
                placeholder="Status"
                data={[
                  { value: '', label: 'All Status' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
                value={filters.status}
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                style={{ width: 150 }}
                radius="md"
              />

              <Button
                variant="light"
                color="blue"
                leftSection={<IconFilter size={18} />}
                rightSection={showAdvancedFilters ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                radius="md"
              >
                Advanced Filters
              </Button>

              <Badge variant="light" color="blue" size="lg">
                {pagination.total} Total
              </Badge>
            </Group>

            <Collapse in={showAdvancedFilters}>
              <Paper p="md" radius="md" withBorder bg={theme.colors.gray[0]}>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="md">
                      Advanced Filters
                    </Text>
                    <Group gap="xs">
                      <Button variant="subtle" onClick={handleClearFilters} size="xs">
                        Clear All
                      </Button>
                    </Group>
                  </Group>

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Select
                        label="Farmer Type"
                        placeholder="All Types"
                        data={[
                          { value: '', label: 'All Types' },
                          { value: 'A', label: 'Individual Farmer' },
                          { value: 'B', label: 'Farm' },
                          { value: 'C', label: 'Institution' }
                        ]}
                        value={filters.farmerType}
                        onChange={(value) => setFilters(prev => ({ ...prev, farmerType: value }))}
                        radius="md"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Select
                        label="Cow Type"
                        placeholder="All"
                        data={[
                          { value: '', label: 'All' },
                          { value: 'Desi', label: 'Desi' },
                          { value: 'Crossbreed', label: 'Crossbreed' },
                          { value: 'Jersey', label: 'Jersey' },
                          { value: 'HF', label: 'HF' }
                        ]}
                        value={filters.cowType}
                        onChange={(value) => setFilters(prev => ({ ...prev, cowType: value }))}
                        radius="md"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Select
                        label="Membership"
                        placeholder="All"
                        data={[
                          { value: '', label: 'All' },
                          { value: 'true', label: 'Members Only' },
                          { value: 'false', label: 'Non-Members Only' }
                        ]}
                        value={filters.isMembership}
                        onChange={(value) => setFilters(prev => ({ ...prev, isMembership: value }))}
                        radius="md"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Select
                        label="Village"
                        placeholder="All Villages"
                        data={[
                          { value: '', label: 'All Villages' },
                          ...villages.map(v => ({ value: v, label: v }))
                        ]}
                        value={filters.village}
                        onChange={(value) => setFilters(prev => ({ ...prev, village: value }))}
                        searchable
                        radius="md"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Select
                        label="Panchayat"
                        placeholder="All Panchayats"
                        data={[
                          { value: '', label: 'All Panchayats' },
                          ...panchayats.map(p => ({ value: p, label: p }))
                        ]}
                        value={filters.panchayat}
                        onChange={(value) => setFilters(prev => ({ ...prev, panchayat: value }))}
                        searchable
                        radius="md"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <Select
                        label="Collection Center"
                        placeholder="All Centers"
                        data={[
                          { value: '', label: 'All Centers' },
                          ...collectionCenters.map(c => ({ value: c._id, label: c.centerName }))
                        ]}
                        value={filters.collectionCenter}
                        onChange={(value) => setFilters(prev => ({ ...prev, collectionCenter: value }))}
                        searchable
                        radius="md"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <TextInput
                        label="Min Shares"
                        type="number"
                        placeholder="Minimum shares"
                        value={filters.minShares}
                        onChange={(e) => setFilters(prev => ({ ...prev, minShares: e.target.value }))}
                        min={0}
                        radius="md"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                      <TextInput
                        label="Max Shares"
                        type="number"
                        placeholder="Maximum shares"
                        value={filters.maxShares}
                        onChange={(e) => setFilters(prev => ({ ...prev, maxShares: e.target.value }))}
                        min={0}
                        radius="md"
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>
            </Collapse>
          </Stack>
        </Paper>

        {/* Data Table Section */}
        <Paper withBorder radius="md" pos="relative" style={{ overflow: 'hidden' }}>
          <LoadingOverlay 
            visible={loading} 
            zIndex={1000} 
            overlayProps={{ radius: 'md', blur: 2 }}
          />
          <DataTable
            columns={columns}
            records={farmers}
            minHeight={500}
            noRecordsText="No farmers found"
            striped
            highlightOnHover
            verticalSpacing="sm"
            horizontalSpacing="md"
            fontSize="sm"
            borderColor={theme.colors.gray[3]}
            rowStyle={(record, index) => ({
              backgroundColor: record.status === 'Inactive' ? theme.colors.red[0] : 'transparent',
              opacity: record.status === 'Inactive' ? 0.8 : 1
            })}
          />
        </Paper>

        {/* Pagination Section */}
        {pagination.total > 0 && (
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Showing <Text span fw={600}>{(pagination.current - 1) * pagination.pageSize + 1}</Text>-
                <Text span fw={600}>{Math.min(pagination.current * pagination.pageSize, pagination.total)}</Text> of{' '}
                <Text span fw={600}>{pagination.total}</Text> farmers
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
                  radius="md"
                />
                <Pagination
                  value={pagination.current}
                  onChange={(value) => setPagination(prev => ({ ...prev, current: value }))}
                  total={Math.ceil(pagination.total / pagination.pageSize)}
                  radius="md"
                  withEdges
                />
              </Group>
            </Group>
          </Paper>
        )}
      </Stack>

      {/* Modals */}
      <FarmerModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedFarmerId(null);
        }}
        onSuccess={handleModalSuccess}
        farmerId={selectedFarmerId}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        entityType="Farmers"
        requiredFields={['Farmer Number', 'Member ID', 'Name', 'Phone Number']}
        validationSchema={{
          'Farmer Number': { required: true, type: 'string' },
          'Member ID': { required: true, type: 'string' },
          'Name': { required: true, type: 'string' },
          'Phone Number': { required: true, type: 'phone' }
        }}
      />

      {/* Add Share Modal */}
      <AddShareModal
        opened={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setSelectedFarmerForShare(null);
        }}
        onSuccess={handleShareSuccess}
        farmer={selectedFarmerForShare}
      />

      {/* Members List Modal */}
      <Modal
        opened={showMembersModal}
        onClose={() => {
          setShowMembersModal(false);
          setMemberSearch('');
          setMemberPagination({ current: 1, pageSize: 10 });
        }}
        title={
          <Group gap="xs">
            <IconUsers size={20} />
            <Title order={3}>Members List</Title>
          </Group>
        }
        size="xl"
        centered
        overlayProps={{
          blur: 3,
          opacity: 0.55,
        }}
      >
        <Stack gap="md">
          {/* Search and Stats */}
          <Paper p="md" withBorder bg={theme.colors.gray[0]}>
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Total Members: <Text span fw={600} c="blue">{members.length}</Text>
                  {memberSearch && (
                    <Text span c="dimmed"> | Filtered: <Text span fw={600} c="green">{getFilteredMembers().length}</Text></Text>
                  )}
                </Text>
                <Badge color="green" size="lg" variant="light">
                  Active Members
                </Badge>
              </Group>
              <TextInput
                placeholder="Search by Member ID or Name..."
                leftSection={<IconSearch size={16} />}
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value);
                  setMemberPagination(prev => ({ ...prev, current: 1 }));
                }}
                radius="md"
              />
            </Stack>
          </Paper>

          <div style={{ overflowX: 'auto', maxHeight: '50vh' }}>
            {membersLoading ? (
              <Center py="xl">
                <Stack align="center">
                  <Loader />
                  <Text c="dimmed">Loading members...</Text>
                </Stack>
              </Center>
            ) : getFilteredMembers().length === 0 ? (
              <Center py="xl">
                <Text c="dimmed">{memberSearch ? 'No members found matching your search' : 'No members found'}</Text>
              </Center>
            ) : (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Farmer No.</Table.Th>
                    <Table.Th>Member ID</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Phone</Table.Th>
                    <Table.Th>Village</Table.Th>
                    <Table.Th>Shares</Table.Th>
                    <Table.Th>Admission Date</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {getPaginatedMembers().map((member) => (
                    <Table.Tr key={member._id}>
                      <Table.Td>
                        <Text fw={600} size="sm">{member.farmerNumber || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="grape">{member.memberId || 'N/A'}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{member.personalDetails?.name || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{member.personalDetails?.phone || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{member.address?.village || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="blue" variant="filled">
                          {member.financialDetails?.totalShares || member.shares || 0}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {member.admissionDate
                            ? new Date(member.admissionDate).toLocaleDateString('en-IN')
                            : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Add Share">
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => {
                                setShowMembersModal(false);
                                handleAddShare(member);
                              }}
                            >
                              <IconCoin size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => {
                                setShowMembersModal(false);
                                handleEdit(member._id);
                              }}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Terminate">
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="sm"
                              onClick={() => {
                                setShowMembersModal(false);
                                handleTerminate(member);
                              }}
                            >
                              <IconUserMinus size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {getFilteredMembers().length > 0 && (
            <Paper p="md" withBorder>
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  Showing <Text span fw={600}>{(memberPagination.current - 1) * memberPagination.pageSize + 1}</Text>-
                  <Text span fw={600}>{Math.min(memberPagination.current * memberPagination.pageSize, getFilteredMembers().length)}</Text> of{' '}
                  <Text span fw={600}>{getFilteredMembers().length}</Text> members
                </Text>
                <Group>
                  <Select
                    value={String(memberPagination.pageSize)}
                    onChange={(value) => setMemberPagination(prev => ({
                      ...prev,
                      pageSize: parseInt(value),
                      current: 1
                    }))}
                    data={[
                      { value: '10', label: '10/page' },
                      { value: '20', label: '20/page' },
                      { value: '30', label: '30/page' }
                    ]}
                    w={110}
                    radius="md"
                    size="xs"
                  />
                  <Pagination
                    value={memberPagination.current}
                    onChange={(value) => setMemberPagination(prev => ({ ...prev, current: value }))}
                    total={Math.ceil(getFilteredMembers().length / memberPagination.pageSize)}
                    radius="md"
                    size="sm"
                    withEdges
                  />
                </Group>
              </Group>
            </Paper>
          )}
        </Stack>
      </Modal>

      {/* Terminate Modal */}
      <TerminateModal
        opened={showTerminateModal}
        onClose={() => {
          setShowTerminateModal(false);
          setSelectedFarmerForTerminate(null);
        }}
        onSuccess={handleTerminateSuccess}
        farmer={selectedFarmerForTerminate}
      />
    </Container>
  );
};

export default FarmerManagement;