import { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Group,
  Button,
  TextInput,
  Select,
  Grid,
  Badge,
  ActionIcon,
  Menu,
  Checkbox,
  Collapse,
  Modal,
  Stack,
  Text,
  Box,
  Card,
  SimpleGrid
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconFileExport,
  IconEdit,
  IconTrash,
  IconBuilding,
  IconCircleCheck,
  IconCircle,
  IconColumns,
  IconClearAll
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { collectionCenterAPI } from '../../services/api';
import CollectionCenterModal from './CollectionCenterModal';
import { useAuth } from '../../context/AuthContext';

const CollectionCenterManagement = () => {
  const { canWrite, canEdit, canDelete } = useAuth();
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    headOffice: 0,
    subCentre: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'Active',
    centerType: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCenters, setSelectedCenters] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState({
    centerName: true,
    centerType: true,
    village: true,
    district: true,
    incharge: true,
    phone: true,
    startDate: true,
    status: true
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState(null);

  useEffect(() => {
    fetchCenters();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchCenters();
  }, [filters]);

  const fetchCenters = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        search: filters.search,
        centerType: filters.centerType
      };
      const response = await collectionCenterAPI.getAll(params);
      setCenters(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.totalItems || response.data.length
      }));

      calculateStatistics(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch collection centers',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data) => {
    const stats = {
      total: data.length,
      active: data.filter(c => c.status === 'Active').length,
      inactive: data.filter(c => c.status === 'Inactive').length,
      headOffice: data.filter(c => c.centerType === 'Head Office').length,
      subCentre: data.filter(c => c.centerType === 'Sub Centre').length
    };
    setStatistics(stats);
  };

  const handleDelete = async (id) => {
    modals.openConfirmModal({
      title: 'Delete Collection Center',
      children: <Text size="sm">Are you sure you want to deactivate this collection center?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await collectionCenterAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Collection center deactivated successfully',
            color: 'green'
          });
          fetchCenters();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to deactivate collection center',
            color: 'red'
          });
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCenters.length === 0) {
      notifications.show({
        title: 'Warning',
        message: 'Please select collection centers to delete',
        color: 'yellow'
      });
      return;
    }z

    modals.openConfirmModal({
      title: 'Bulk Delete Collection Centers',
      children: <Text size="sm">Are you sure you want to deactivate {selectedCenters.length} collection center(s)?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await Promise.all(selectedCenters.map(id => collectionCenterAPI.delete(id)));
          notifications.show({
            title: 'Success',
            message: `${selectedCenters.length} collection center(s) deactivated successfully`,
            color: 'green'
          });
          setSelectedCenters([]);
          fetchCenters();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to deactivate collection centers',
            color: 'red'
          });
        }
      }
    });
  };

  const handleExport = (format) => {
    try {
      const exportData = centers.map(c => ({
        'Center Name': c.centerName,
        'Center Type': c.centerType,
        'Village': c.address?.village || '-',
        'District': c.address?.district || '-',
        'State': c.address?.state || '-',
        'Pincode': c.address?.pincode || '-',
        'Incharge': c.contactDetails?.incharge || '-',
        'Phone': c.contactDetails?.phone || '-',
        'Email': c.contactDetails?.email || '-',
        'Start Date': new Date(c.startDate).toLocaleDateString(),
        'Status': c.status
      }));

      if (format === 'csv') {
        const headers = Object.keys(exportData[0]).join(',');
        const rows = exportData.map(row => Object.values(row).join(','));
        const csv = [headers, ...rows].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collection_centers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        notifications.show({
          title: 'Success',
          message: 'Exported to CSV successfully',
          color: 'green'
        });
      } else if (format === 'json') {
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `collection_centers_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        notifications.show({
          title: 'Success',
          message: 'Exported to JSON successfully',
          color: 'green'
        });
      }

      setShowExportModal(false);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to export data',
        color: 'red'
      });
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'Active',
      centerType: ''
    });
  };

  const handleOpenAddModal = () => {
    setSelectedCenterId(null);
    setShowCenterModal(true);
  };

  const handleOpenEditModal = (id) => {
    setSelectedCenterId(id);
    setShowCenterModal(true);
  };

  const handleCloseModal = () => {
    setShowCenterModal(false);
    setSelectedCenterId(null);
  };

  const handleModalSuccess = () => {
    fetchCenters();
  };

  const columns = [
    visibleColumns.centerName && {
      accessor: 'centerName',
      title: 'Center Name',
      sortable: true
    },
    visibleColumns.centerType && {
      accessor: 'centerType',
      title: 'Type',
      sortable: true,
      render: (center) => (
        <Badge color={center.centerType === 'Head Office' ? 'blue' : 'cyan'} variant="light">
          {center.centerType}
        </Badge>
      )
    },
    visibleColumns.village && {
      accessor: 'village',
      title: 'Village',
      render: (center) => center.address?.village || '-'
    },
    visibleColumns.district && {
      accessor: 'district',
      title: 'District',
      render: (center) => center.address?.district || '-'
    },
    visibleColumns.incharge && {
      accessor: 'incharge',
      title: 'Incharge',
      render: (center) => center.contactDetails?.incharge || '-'
    },
    visibleColumns.phone && {
      accessor: 'phone',
      title: 'Phone',
      render: (center) => center.contactDetails?.phone || '-'
    },
    visibleColumns.startDate && {
      accessor: 'startDate',
      title: 'Start Date',
      sortable: true,
      render: (center) => new Date(center.startDate).toLocaleDateString()
    },
    visibleColumns.status && {
      accessor: 'status',
      title: 'Status',
      render: (center) => (
        <Badge color={center.status === 'Active' ? 'green' : 'red'} variant="light">
          {center.status}
        </Badge>
      )
    },
    {
      accessor: 'actions',
      title: 'Actions',
      textAlign: 'right',
      render: (center) => (
        <Group gap="xs" justify="flex-end">
          <ActionIcon
            variant="subtle"
            color="green"
            onClick={() => handleOpenEditModal(center._id)}
            disabled={!canEdit('collectionCenters')}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDelete(center._id)}
            disabled={!canDelete('collectionCenters')}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      )
    }
  ].filter(Boolean);

  return (
    <Box p="md">
      <Paper p="md" mb="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>Collection Centre Management</Title>
            <Text c="dimmed" size="sm">Manage collection center information</Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleOpenAddModal}
            disabled={!canWrite('collectionCenters')}
          >
            Add Collection Center
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} mb="md">
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="blue">
                <IconBuilding size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Centers</Text>
                <Text size="xl" fw={700}>{statistics.total}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="green">
                <IconCircleCheck size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Active</Text>
                <Text size="xl" fw={700}>{statistics.active}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="red">
                <IconCircle size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Inactive</Text>
                <Text size="xl" fw={700}>{statistics.inactive}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="indigo">
                <IconBuilding size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Head Office</Text>
                <Text size="xl" fw={700}>{statistics.headOffice}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="cyan">
                <IconBuilding size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Sub Centre</Text>
                <Text size="xl" fw={700}>{statistics.subCentre}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        <Paper p="md" withBorder>
          <Group mb="md">
            <TextInput
              placeholder="Search by center name, village, district, or incharge"
              leftSection={<IconSearch size={16} />}
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="All Status"
              value={filters.status}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              data={[
                { value: '', label: 'All Status' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              style={{ width: 150 }}
            />
            <Select
              placeholder="All Types"
              value={filters.centerType}
              onChange={(value) => setFilters(prev => ({ ...prev, centerType: value }))}
              data={[
                { value: '', label: 'All Types' },
                { value: 'Head Office', label: 'Head Office' },
                { value: 'Sub Centre', label: 'Sub Centre' }
              ]}
              style={{ width: 150 }}
            />
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="default" leftSection={<IconColumns size={16} />}>
                  Columns
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {Object.keys(visibleColumns).map(col => (
                  <Menu.Item
                    key={col}
                    onClick={(e) => {
                      e.preventDefault();
                      setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
                    }}
                  >
                    <Checkbox
                      label={col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      checked={visibleColumns[col]}
                      onChange={() => {}}
                      readOnly
                    />
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="default"
              leftSection={<IconFileExport size={16} />}
              color="green"
              onClick={() => setShowExportModal(true)}
            >
              Export
            </Button>
            {(filters.search || filters.centerType) && (
              <Button
                variant="subtle"
                leftSection={<IconClearAll size={16} />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </Group>

          {selectedCenters.length > 0 && (
            <Paper p="md" withBorder mb="md" bg="blue.0">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{selectedCenters.length} collection center(s) selected</Text>
                <Group gap="xs">
                  <Button size="xs" color="red" onClick={handleBulkDelete} disabled={!canDelete('collectionCenters')}>
                    Deactivate Selected
                  </Button>
                  <Button size="xs" variant="default" onClick={() => setSelectedCenters([])}>
                    Clear Selection
                  </Button>
                </Group>
              </Group>
            </Paper>
          )}

          <DataTable
            columns={columns}
            records={centers}
            fetching={loading}
            totalRecords={pagination.total}
            recordsPerPage={pagination.pageSize}
            page={pagination.current}
            onPageChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
            recordsPerPageOptions={[10, 25, 50, 100]}
            onRecordsPerPageChange={(pageSize) => setPagination(prev => ({ ...prev, pageSize, current: 1 }))}
            selectedRecords={centers.filter(c => selectedCenters.includes(c._id))}
            onSelectedRecordsChange={(records) => setSelectedCenters(records.map(r => r._id))}
            highlightOnHover
            minHeight={centers.length === 0 ? 200 : undefined}
            noRecordsText="No collection centers found"
          />
        </Paper>
      </Paper>

      <Modal
        opened={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Collection Centers"
      >
        <Stack>
          <Text size="sm">Choose export format:</Text>
          <Button
            variant="default"
            leftSection={<IconFileExport size={16} />}
            onClick={() => handleExport('csv')}
          >
            Export as CSV
          </Button>
          <Button
            variant="default"
            leftSection={<IconFileExport size={16} />}
            onClick={() => handleExport('json')}
          >
            Export as JSON
          </Button>
        </Stack>
      </Modal>

      <CollectionCenterModal
        isOpen={showCenterModal}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        centerId={selectedCenterId}
      />
    </Box>
  );
};

export default CollectionCenterManagement;
