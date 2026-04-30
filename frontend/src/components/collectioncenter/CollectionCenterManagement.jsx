import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconClearAll,
  IconX,
  IconUpload
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { collectionCenterAPI } from '../../services/api';
import CollectionCenterModal from './CollectionCenterModal';
import ImportModal from '../common/ImportModal';
import { useAuth } from '../../context/AuthContext';

const CollectionCenterManagement = () => {
  const { canWrite, canEdit, canDelete } = useAuth();
  const navigate = useNavigate();
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [sortStatus, setSortStatus] = useState({ columnAccessor: '', direction: 'asc' });

  useEffect(() => {
    fetchCenters();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
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
      const [pageRes, allRes] = await Promise.all([
        collectionCenterAPI.getAll(params),
        collectionCenterAPI.getAll({ limit: 1000 })
      ]);
      setCenters(pageRes.data);
      setPagination(prev => ({
        ...prev,
        total: pageRes.pagination?.totalItems || pageRes.data.length
      }));
      calculateStatistics(allRes.data);
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
    }

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

  const handleImport = async (data) => {
    // Parse DD-MM-YYYY or leave as-is for ISO / Excel serial
    const parseDate = (val) => {
      if (!val) return undefined;
      if (typeof val === 'number') {
        if (val <= 0) return undefined;
        return new Date(Math.round((val - 25569) * 86400 * 1000));
      }
      const str = String(val).trim();
      if (!str || str === '0000-00-00' || str.startsWith('#')) return undefined;
      const ddmmyyyy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (ddmmyyyy) {
        const d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
        return isNaN(d.getTime()) ? undefined : d;
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? undefined : d;
    };

    // Detect OpenLyssa format (has center_name column)
    const isOpenLyssa = data.length > 0 && 'center_name' in data[0];

    const centers = data.map(row => {
      if (isOpenLyssa) {
        return {
          centerName:  String(row['center_name'] || '').trim(),
          centerType:  row['head_office'] === 'Y' ? 'Head Office' : 'Sub Centre',
          status:      row['active'] === 'Y' ? 'Active' : 'Inactive',
          startDate:   parseDate(row['start_date']),
          street:      row['address'] ? String(row['address']).trim() : undefined,
          description: row['short']   ? String(row['short']).trim()   : undefined,
        };
      }
      // Generic / manual template
      return {
        centerName:  String(row['Center Name'] || '').trim(),
        centerType:  row['Center Type'] || 'Sub Centre',
        status:      row['Status'] || 'Active',
        startDate:   parseDate(row['Start Date']),
        street:      row['Address'] ? String(row['Address']).trim() : undefined,
        description: row['Description'] ? String(row['Description']).trim() : undefined,
      };
    });

    const response = await collectionCenterAPI.bulkImport(centers);
    const { created, updated, errors } = response.data;

    if (errors.length === 0) {
      notifications.show({
        title: 'Import Successful',
        message: `${created} centers created, ${updated} updated.`,
        color: 'green'
      });
    } else {
      notifications.show({
        title: 'Import Completed with Errors',
        message: `${created} created, ${updated} updated, ${errors.length} failed.`,
        color: 'yellow'
      });
    }

    fetchCenters();
    return response;
  };

  const handleExport = (format) => {
    if (centers.length === 0) {
      notifications.show({ title: 'Warning', message: 'No data to export', color: 'yellow' });
      return;
    }
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

  const getSortedCenters = () => {
    const { columnAccessor: col, direction: dir } = sortStatus;
    if (!col) return centers;
    const d = dir === 'asc' ? 1 : -1;
    return [...centers].sort((a, b) => {
      let av, bv;
      if (col === 'centerName')  { av = a.centerName;           bv = b.centerName; }
      else if (col === 'centerType') { av = a.centerType;       bv = b.centerType; }
      else if (col === 'village')    { av = a.address?.village; bv = b.address?.village; }
      else if (col === 'district')   { av = a.address?.district;bv = b.address?.district; }
      else if (col === 'startDate')  { av = new Date(a.startDate||0); bv = new Date(b.startDate||0); }
      else if (col === 'status')     { av = a.status;           bv = b.status; }
      else return 0;
      if (av == null) return d; if (bv == null) return -d;
      if (typeof av === 'string') return av.localeCompare(bv) * d;
      return (av > bv ? 1 : av < bv ? -1 : 0) * d;
    });
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
      sortable: true,
      render: (center) => center.address?.village || '-'
    },
    visibleColumns.district && {
      accessor: 'district',
      title: 'District',
      sortable: true,
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
          <Group gap="xs">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenAddModal}
              disabled={!canWrite('collectionCenters')}
            >
              Add Collection Center
            </Button>
            <Button
              variant="light"
              color="teal"
              leftSection={<IconUpload size={16} />}
              onClick={() => setShowImportModal(true)}
              disabled={!canWrite('collectionCenters')}
            >
              Import (OpenLyssa)
            </Button>
            <Button
              variant="default"
              leftSection={<IconX size={16} />}
              onClick={() => navigate('/')}
            >
              Close
            </Button>
          </Group>
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

          <Box style={{ overflowX: 'auto' }}>
            <DataTable
              columns={columns}
              records={getSortedCenters()}
              fetching={loading}
              sortStatus={sortStatus}
              onSortStatusChange={setSortStatus}
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
          </Box>
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

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        entityType="Collection Centers (OpenLyssa)"
        requiredFields={['center_name']}
      />
    </Box>
  );
};

export default CollectionCenterManagement;
