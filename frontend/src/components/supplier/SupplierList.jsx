// import { useState, useEffect, useMemo } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   Paper,
//   Title,
//   Group,
//   Button,
//   TextInput,
//   Select,
//   Grid,
//   Badge,
//   ActionIcon,
//   Menu,
//   Checkbox,
//   Collapse,
//   NumberInput,
//   Modal,
//   Stack,
//   Text,
//   Loader,
//   Center,
//   Box,
//   Card,
//   SimpleGrid
// } from '@mantine/core';
// import { DataTable } from 'mantine-datatable';
// import {
//   IconPlus,
//   IconSearch,
//   IconFilter,
//   IconFileExport,
//   IconEdit,
//   IconEye,
//   IconTrash,
//   IconCheck,
//   IconX,
//   IconUsers,
//   IconCheckCircle,
//   IconCircle,
//   IconCurrencyRupee,
//   IconColumns,
//   IconChevronDown,
//   IconClearAll
// } from '@tabler/icons-react';
// import { modals } from '@mantine/modals';
// import { notifications } from '@mantine/notifications';
// import { supplierAPI } from '../../services/api';
// import SupplierModal from './SupplierModal';

// const SupplierList = () => {
//   const navigate = useNavigate();
//   const [suppliers, setSuppliers] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [statistics, setStatistics] = useState({
//     total: 0,
//     active: 0,
//     inactive: 0,
//     totalBalance: 0
//   });
//   const [pagination, setPagination] = useState({
//     current: 1,
//     pageSize: 10,
//     total: 0
//   });
//   const [filters, setFilters] = useState({
//     search: '',
//     active: 'true',
//     state: '',
//     district: '',
//     minBalance: '',
//     maxBalance: ''
//   });
//   const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
//   const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
//   const [selectedSuppliers, setSelectedSuppliers] = useState([]);
//   const [visibleColumns, setVisibleColumns] = useState({
//     supplierId: true,
//     name: true,
//     phone: true,
//     email: true,
//     state: true,
//     district: true,
//     openingBalance: true,
//     status: true
//   });
//   const [showExportModal, setShowExportModal] = useState(false);
//   const [showSupplierModal, setShowSupplierModal] = useState(false);
//   const [selectedSupplierId, setSelectedSupplierId] = useState(null);

//   useEffect(() => {
//     fetchSuppliers();
//   }, [pagination.current, pagination.pageSize]);

//   useEffect(() => {
//     setPagination(prev => ({ ...prev, current: 1 }));
//     fetchSuppliers();
//   }, [filters, sortConfig]);

//   const fetchSuppliers = async () => {
//     setLoading(true);
//     try {
//       const params = {
//         page: pagination.current,
//         limit: pagination.pageSize,
//         active: filters.active,
//         search: filters.search,
//         state: filters.state,
//         district: filters.district,
//         minBalance: filters.minBalance,
//         maxBalance: filters.maxBalance
//       };
//       const response = await supplierAPI.getAll(params);
//       setSuppliers(response.data);
//       setPagination(prev => ({
//         ...prev,
//         total: response.pagination?.total || response.data.length
//       }));

//       calculateStatistics(response.data);
//     } catch (error) {
//       notifications.show({
//         title: 'Error',
//         message: error.message || 'Failed to fetch suppliers',
//         color: 'red'
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const calculateStatistics = (data) => {
//     const stats = {
//       total: data.length,
//       active: data.filter(s => s.active).length,
//       inactive: data.filter(s => !s.active).length,
//       totalBalance: data.reduce((sum, s) => sum + (s.openingBalance || 0), 0)
//     };
//     setStatistics(stats);
//   };

//   const handleDelete = async (id) => {
//     modals.openConfirmModal({
//       title: 'Delete Supplier',
//       children: <Text size="sm">Are you sure you want to deactivate this supplier?</Text>,
//       labels: { confirm: 'Delete', cancel: 'Cancel' },
//       confirmProps: { color: 'red' },
//       onConfirm: async () => {
//         try {
//           await supplierAPI.delete(id);
//           notifications.show({
//             title: 'Success',
//             message: 'Supplier deactivated successfully',
//             color: 'green'
//           });
//           fetchSuppliers();
//         } catch (error) {
//           notifications.show({
//             title: 'Error',
//             message: error.message || 'Failed to deactivate supplier',
//             color: 'red'
//           });
//         }
//       }
//     });
//   };

//   const handleBulkDelete = async () => {
//     if (selectedSuppliers.length === 0) {
//       notifications.show({
//         title: 'Warning',
//         message: 'Please select suppliers to delete',
//         color: 'yellow'
//       });
//       return;
//     }

//     modals.openConfirmModal({
//       title: 'Bulk Delete Suppliers',
//       children: <Text size="sm">Are you sure you want to deactivate {selectedSuppliers.length} supplier(s)?</Text>,
//       labels: { confirm: 'Delete', cancel: 'Cancel' },
//       confirmProps: { color: 'red' },
//       onConfirm: async () => {
//         try {
//           await Promise.all(selectedSuppliers.map(id => supplierAPI.delete(id)));
//           notifications.show({
//             title: 'Success',
//             message: `${selectedSuppliers.length} supplier(s) deactivated successfully`,
//             color: 'green'
//           });
//           setSelectedSuppliers([]);
//           fetchSuppliers();
//         } catch (error) {
//           notifications.show({
//             title: 'Error',
//             message: error.message || 'Failed to deactivate suppliers',
//             color: 'red'
//           });
//         }
//       }
//     });
//   };

//   const handleExport = (format) => {
//     try {
//       const exportData = suppliers.map(s => ({
//         'Supplier ID': s.supplierId,
//         'Name': s.name,
//         'Phone': s.phone,
//         'Email': s.email || '-',
//         'State': s.state || '-',
//         'District': s.district || '-',
//         'Opening Balance': s.openingBalance?.toFixed(2) || '0.00',
//         'Status': s.active ? 'Active' : 'Inactive'
//       }));

//       if (format === 'csv') {
//         const headers = Object.keys(exportData[0]).join(',');
//         const rows = exportData.map(row => Object.values(row).join(','));
//         const csv = [headers, ...rows].join('\n');

//         const blob = new Blob([csv], { type: 'text/csv' });
//         const url = window.URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `suppliers_${new Date().toISOString().split('T')[0]}.csv`;
//         a.click();
//         window.URL.revokeObjectURL(url);

//         notifications.show({
//           title: 'Success',
//           message: 'Exported to CSV successfully',
//           color: 'green'
//         });
//       } else if (format === 'json') {
//         const json = JSON.stringify(exportData, null, 2);
//         const blob = new Blob([json], { type: 'application/json' });
//         const url = window.URL.createObjectURL(blob);
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = `suppliers_${new Date().toISOString().split('T')[0]}.json`;
//         a.click();
//         window.URL.revokeObjectURL(url);

//         notifications.show({
//           title: 'Success',
//           message: 'Exported to JSON successfully',
//           color: 'green'
//         });
//       }

//       setShowExportModal(false);
//     } catch (error) {
//       notifications.show({
//         title: 'Error',
//         message: 'Failed to export data',
//         color: 'red'
//       });
//     }
//   };

//   const clearFilters = () => {
//     setFilters({
//       search: '',
//       active: 'true',
//       state: '',
//       district: '',
//       minBalance: '',
//       maxBalance: ''
//     });
//   };

//   const handleOpenAddModal = () => {
//     setSelectedSupplierId(null);
//     setShowSupplierModal(true);
//   };

//   const handleOpenEditModal = (id) => {
//     setSelectedSupplierId(id);
//     setShowSupplierModal(true);
//   };

//   const handleCloseModal = () => {
//     setShowSupplierModal(false);
//     setSelectedSupplierId(null);
//   };

//   const handleModalSuccess = () => {
//     fetchSuppliers();
//   };

//   const columns = [
//     visibleColumns.supplierId && {
//       accessor: 'supplierId',
//       title: 'Supplier ID',
//       sortable: true
//     },
//     visibleColumns.name && {
//       accessor: 'name',
//       title: 'Name',
//       sortable: true
//     },
//     visibleColumns.phone && {
//       accessor: 'phone',
//       title: 'Phone'
//     },
//     visibleColumns.email && {
//       accessor: 'email',
//       title: 'Email',
//       render: (supplier) => supplier.email || '-'
//     },
//     visibleColumns.state && {
//       accessor: 'state',
//       title: 'State',
//       render: (supplier) => supplier.state || '-'
//     },
//     visibleColumns.district && {
//       accessor: 'district',
//       title: 'District',
//       render: (supplier) => supplier.district || '-'
//     },
//     visibleColumns.openingBalance && {
//       accessor: 'openingBalance',
//       title: 'Opening Balance',
//       sortable: true,
//       render: (supplier) => `₹${supplier.openingBalance?.toFixed(2) || '0.00'}`
//     },
//     visibleColumns.status && {
//       accessor: 'status',
//       title: 'Status',
//       render: (supplier) => (
//         <Badge color={supplier.active ? 'green' : 'red'} variant="light">
//           {supplier.active ? 'Active' : 'Inactive'}
//         </Badge>
//       )
//     },
//     {
//       accessor: 'actions',
//       title: 'Actions',
//       textAlign: 'right',
//       render: (supplier) => (
//         <Group gap="xs" justify="flex-end">
//           <ActionIcon
//             variant="subtle"
//             color="blue"
//             onClick={() => navigate(`/suppliers/view/${supplier._id}`)}
//           >
//             <IconEye size={16} />
//           </ActionIcon>
//           <ActionIcon
//             variant="subtle"
//             color="green"
//             onClick={() => handleOpenEditModal(supplier._id)}
//           >
//             <IconEdit size={16} />
//           </ActionIcon>
//           <ActionIcon
//             variant="subtle"
//             color="red"
//             onClick={() => handleDelete(supplier._id)}
//           >
//             <IconTrash size={16} />
//           </ActionIcon>
//         </Group>
//       )
//     }
//   ].filter(Boolean);

//   return (
//     <Box p="md">
//       <Paper p="md" mb="md">
//         <Group justify="space-between" mb="md">
//           <div>
//             <Title order={2}>Supplier Management</Title>
//             <Text c="dimmed" size="sm">Manage supplier information</Text>
//           </div>
//           <Button leftSection={<IconPlus size={16} />} onClick={handleOpenAddModal}>
//             Add Supplier
//           </Button>
//         </Group>

//         <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
//           <Card withBorder>
//             <Group>
//               <ActionIcon size="lg" variant="light" color="blue">
//                 <IconUsers size={20} />
//               </ActionIcon>
//               <div>
//                 <Text size="xs" c="dimmed">Total Suppliers</Text>
//                 <Text size="xl" fw={700}>{statistics.total}</Text>
//               </div>
//             </Group>
//           </Card>
//           <Card withBorder>
//             <Group>
//               <ActionIcon size="lg" variant="light" color="green">
//                 <IconCheckCircle size={20} />
//               </ActionIcon>
//               <div>
//                 <Text size="xs" c="dimmed">Active</Text>
//                 <Text size="xl" fw={700}>{statistics.active}</Text>
//               </div>
//             </Group>
//           </Card>
//           <Card withBorder>
//             <Group>
//               <ActionIcon size="lg" variant="light" color="red">
//                 <IconCircle size={20} />
//               </ActionIcon>
//               <div>
//                 <Text size="xs" c="dimmed">Inactive</Text>
//                 <Text size="xl" fw={700}>{statistics.inactive}</Text>
//               </div>
//             </Group>
//           </Card>
//           <Card withBorder>
//             <Group>
//               <ActionIcon size="lg" variant="light" color="teal">
//                 <IconCurrencyRupee size={20} />
//               </ActionIcon>
//               <div>
//                 <Text size="xs" c="dimmed">Total Balance</Text>
//                 <Text size="xl" fw={700}>₹{statistics.totalBalance.toFixed(2)}</Text>
//               </div>
//             </Group>
//           </Card>
//         </SimpleGrid>

//         <Paper p="md" withBorder>
//           <Group mb="md">
//             <TextInput
//               placeholder="Search by supplier ID, name, phone, or email"
//               leftSection={<IconSearch size={16} />}
//               value={filters.search}
//               onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
//               style={{ flex: 1 }}
//             />
//             <Select
//               placeholder="All Status"
//               value={filters.active}
//               onChange={(value) => setFilters(prev => ({ ...prev, active: value }))}
//               data={[
//                 { value: '', label: 'All Status' },
//                 { value: 'true', label: 'Active' },
//                 { value: 'false', label: 'Inactive' }
//               ]}
//               style={{ width: 150 }}
//             />
//             <Menu shadow="md" width={200}>
//               <Menu.Target>
//                 <Button variant="default" leftSection={<IconColumns size={16} />}>
//                   Columns
//                 </Button>
//               </Menu.Target>
//               <Menu.Dropdown>
//                 {Object.keys(visibleColumns).map(col => (
//                   <Menu.Item key={col}>
//                     <Checkbox
//                       label={col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
//                       checked={visibleColumns[col]}
//                       onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col]: e.currentTarget.checked }))}
//                     />
//                   </Menu.Item>
//                 ))}
//               </Menu.Dropdown>
//             </Menu>
//             <Button
//               variant="default"
//               leftSection={<IconFilter size={16} />}
//               onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
//             >
//               Advanced Filters
//             </Button>
//             <Button
//               variant="default"
//               leftSection={<IconFileExport size={16} />}
//               color="green"
//               onClick={() => setShowExportModal(true)}
//             >
//               Export
//             </Button>
//             {(filters.search || filters.state || filters.district || filters.minBalance || filters.maxBalance) && (
//               <Button
//                 variant="subtle"
//                 leftSection={<IconClearAll size={16} />}
//                 onClick={clearFilters}
//               >
//                 Clear Filters
//               </Button>
//             )}
//           </Group>

//           <Collapse in={showAdvancedFilters}>
//             <Paper p="md" withBorder mb="md">
//               <Grid>
//                 <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
//                   <TextInput
//                     label="State"
//                     placeholder="Enter state"
//                     value={filters.state}
//                     onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
//                   />
//                 </Grid.Col>
//                 <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
//                   <TextInput
//                     label="District"
//                     placeholder="Enter district"
//                     value={filters.district}
//                     onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value }))}
//                   />
//                 </Grid.Col>
//                 <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
//                   <NumberInput
//                     label="Min Balance"
//                     placeholder="0"
//                     value={filters.minBalance}
//                     onChange={(value) => setFilters(prev => ({ ...prev, minBalance: value }))}
//                   />
//                 </Grid.Col>
//                 <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
//                   <NumberInput
//                     label="Max Balance"
//                     placeholder="10000"
//                     value={filters.maxBalance}
//                     onChange={(value) => setFilters(prev => ({ ...prev, maxBalance: value }))}
//                   />
//                 </Grid.Col>
//               </Grid>
//             </Paper>
//           </Collapse>

//           {selectedSuppliers.length > 0 && (
//             <Paper p="md" withBorder mb="md" bg="blue.0">
//               <Group justify="space-between">
//                 <Text size="sm" fw={500}>{selectedSuppliers.length} supplier(s) selected</Text>
//                 <Group gap="xs">
//                   <Button size="xs" color="red" onClick={handleBulkDelete}>
//                     Deactivate Selected
//                   </Button>
//                   <Button size="xs" variant="default" onClick={() => setSelectedSuppliers([])}>
//                     Clear Selection
//                   </Button>
//                 </Group>
//               </Group>
//             </Paper>
//           )}

//           <DataTable
//             columns={columns}
//             records={suppliers}
//             fetching={loading}
//             totalRecords={pagination.total}
//             recordsPerPage={pagination.pageSize}
//             page={pagination.current}
//             onPageChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
//             recordsPerPageOptions={[10, 25, 50, 100]}
//             onRecordsPerPageChange={(pageSize) => setPagination(prev => ({ ...prev, pageSize, current: 1 }))}
//             selectedRecords={suppliers.filter(s => selectedSuppliers.includes(s._id))}
//             onSelectedRecordsChange={(records) => setSelectedSuppliers(records.map(r => r._id))}
//             highlightOnHover
//             minHeight={suppliers.length === 0 ? 200 : undefined}
//             noRecordsText="No suppliers found"
//           />
//         </Paper>
//       </Paper>

//       <Modal
//         opened={showExportModal}
//         onClose={() => setShowExportModal(false)}
//         title="Export Suppliers"
//       >
//         <Stack>
//           <Text size="sm">Choose export format:</Text>
//           <Button
//             variant="default"
//             leftSection={<IconFileExport size={16} />}
//             onClick={() => handleExport('csv')}
//           >
//             Export as CSV
//           </Button>
//           <Button
//             variant="default"
//             leftSection={<IconFileExport size={16} />}
//             onClick={() => handleExport('json')}
//           >
//             Export as JSON
//           </Button>
//         </Stack>
//       </Modal>

//       <SupplierModal
//         isOpen={showSupplierModal}
//         onClose={handleCloseModal}
//         onSuccess={handleModalSuccess}
//         supplierId={selectedSupplierId}
//       />
//     </Box>
//   );
// };

// export default SupplierList;


import { useState, useEffect, useMemo } from 'react';
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
  NumberInput,
  Modal,
  Stack,
  Text,
  Loader,
  Center,
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
  IconEye,
  IconTrash,
  IconCheck,
  IconX,
  IconUsers,
  IconCircleCheck, // Changed from IconCheckCircle
  IconCircle, // Changed from IconCircle
  IconCurrencyRupee,
  IconColumns,
  IconChevronDown,
  IconClearAll
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { supplierAPI } from '../../services/api';
import SupplierModal from './SupplierModal';

const SupplierList = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    totalBalance: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    active: 'true',
    state: '',
    district: '',
    minBalance: '',
    maxBalance: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState({
    supplierId: true,
    name: true,
    phone: true,
    email: true,
    state: true,
    district: true,
    openingBalance: true,
    status: true
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchSuppliers();
  }, [filters, sortConfig]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        active: filters.active,
        search: filters.search,
        state: filters.state,
        district: filters.district,
        minBalance: filters.minBalance,
        maxBalance: filters.maxBalance
      };
      const response = await supplierAPI.getAll(params);
      setSuppliers(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || response.data.length
      }));

      calculateStatistics(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch suppliers',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (data) => {
    const stats = {
      total: data.length,
      active: data.filter(s => s.active).length,
      inactive: data.filter(s => !s.active).length,
      totalBalance: data.reduce((sum, s) => sum + (s.openingBalance || 0), 0)
    };
    setStatistics(stats);
  };

  const handleDelete = async (id) => {
    modals.openConfirmModal({
      title: 'Delete Supplier',
      children: <Text size="sm">Are you sure you want to deactivate this supplier?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await supplierAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Supplier deactivated successfully',
            color: 'green'
          });
          fetchSuppliers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to deactivate supplier',
            color: 'red'
          });
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedSuppliers.length === 0) {
      notifications.show({
        title: 'Warning',
        message: 'Please select suppliers to delete',
        color: 'yellow'
      });
      return;
    }

    modals.openConfirmModal({
      title: 'Bulk Delete Suppliers',
      children: <Text size="sm">Are you sure you want to deactivate {selectedSuppliers.length} supplier(s)?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await Promise.all(selectedSuppliers.map(id => supplierAPI.delete(id)));
          notifications.show({
            title: 'Success',
            message: `${selectedSuppliers.length} supplier(s) deactivated successfully`,
            color: 'green'
          });
          setSelectedSuppliers([]);
          fetchSuppliers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to deactivate suppliers',
            color: 'red'
          });
        }
      }
    });
  };

  const handleExport = (format) => {
    try {
      const exportData = suppliers.map(s => ({
        'Supplier ID': s.supplierId,
        'Name': s.name,
        'Phone': s.phone,
        'Email': s.email || '-',
        'State': s.state || '-',
        'District': s.district || '-',
        'Opening Balance': s.openingBalance?.toFixed(2) || '0.00',
        'Status': s.active ? 'Active' : 'Inactive'
      }));

      if (format === 'csv') {
        const headers = Object.keys(exportData[0]).join(',');
        const rows = exportData.map(row => Object.values(row).join(','));
        const csv = [headers, ...rows].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `suppliers_${new Date().toISOString().split('T')[0]}.csv`;
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
        a.download = `suppliers_${new Date().toISOString().split('T')[0]}.json`;
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
      active: 'true',
      state: '',
      district: '',
      minBalance: '',
      maxBalance: ''
    });
  };

  const handleOpenAddModal = () => {
    setSelectedSupplierId(null);
    setShowSupplierModal(true);
  };

  const handleOpenEditModal = (id) => {
    setSelectedSupplierId(id);
    setShowSupplierModal(true);
  };

  const handleCloseModal = () => {
    setShowSupplierModal(false);
    setSelectedSupplierId(null);
  };

  const handleModalSuccess = () => {
    fetchSuppliers();
  };

  const columns = [
    visibleColumns.supplierId && {
      accessor: 'supplierId',
      title: 'Supplier ID',
      sortable: true
    },
    visibleColumns.name && {
      accessor: 'name',
      title: 'Name',
      sortable: true
    },
    visibleColumns.phone && {
      accessor: 'phone',
      title: 'Phone'
    },
    visibleColumns.email && {
      accessor: 'email',
      title: 'Email',
      render: (supplier) => supplier.email || '-'
    },
    visibleColumns.state && {
      accessor: 'state',
      title: 'State',
      render: (supplier) => supplier.state || '-'
    },
    visibleColumns.district && {
      accessor: 'district',
      title: 'District',
      render: (supplier) => supplier.district || '-'
    },
    visibleColumns.openingBalance && {
      accessor: 'openingBalance',
      title: 'Opening Balance',
      sortable: true,
      render: (supplier) => `₹${supplier.openingBalance?.toFixed(2) || '0.00'}`
    },
    visibleColumns.status && {
      accessor: 'status',
      title: 'Status',
      render: (supplier) => (
        <Badge color={supplier.active ? 'green' : 'red'} variant="light">
          {supplier.active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      accessor: 'actions',
      title: 'Actions',
      textAlign: 'right',
      render: (supplier) => (
        <Group gap="xs" justify="flex-end">
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={() => navigate(`/suppliers/view/${supplier._id}`)}
          >
            <IconEye size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="green"
            onClick={() => handleOpenEditModal(supplier._id)}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDelete(supplier._id)}
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
            <Title order={2}>Supplier Management</Title>
            <Text c="dimmed" size="sm">Manage supplier information</Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={handleOpenAddModal}>
            Add Supplier
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="blue">
                <IconUsers size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Suppliers</Text>
                <Text size="xl" fw={700}>{statistics.total}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="green">
                <IconCircleCheck size={20} /> {/* Changed from IconCheckCircle */}
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
                <IconCircle size={20} /> {/* Changed from IconCircle */}
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Inactive</Text>
                <Text size="xl" fw={700}>{statistics.inactive}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="teal">
                <IconCurrencyRupee size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Balance</Text>
                <Text size="xl" fw={700}>₹{statistics.totalBalance.toFixed(2)}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        <Paper p="md" withBorder>
          <Group mb="md">
            <TextInput
              placeholder="Search by supplier ID, name, phone, or email"
              leftSection={<IconSearch size={16} />}
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="All Status"
              value={filters.active}
              onChange={(value) => setFilters(prev => ({ ...prev, active: value }))}
              data={[
                { value: '', label: 'All Status' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' }
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
                  <Menu.Item key={col}>
                    <Checkbox
                      label={col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      checked={visibleColumns[col]}
                      onChange={(e) => setVisibleColumns(prev => ({ ...prev, [col]: e.currentTarget.checked }))}
                    />
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Button
              variant="default"
              leftSection={<IconFilter size={16} />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              Advanced Filters
            </Button>
            <Button
              variant="default"
              leftSection={<IconFileExport size={16} />}
              color="green"
              onClick={() => setShowExportModal(true)}
            >
              Export
            </Button>
            {(filters.search || filters.state || filters.district || filters.minBalance || filters.maxBalance) && (
              <Button
                variant="subtle"
                leftSection={<IconClearAll size={16} />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </Group>

          <Collapse in={showAdvancedFilters}>
            <Paper p="md" withBorder mb="md">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <TextInput
                    label="State"
                    placeholder="Enter state"
                    value={filters.state}
                    onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <TextInput
                    label="District"
                    placeholder="Enter district"
                    value={filters.district}
                    onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <NumberInput
                    label="Min Balance"
                    placeholder="0"
                    value={filters.minBalance}
                    onChange={(value) => setFilters(prev => ({ ...prev, minBalance: value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <NumberInput
                    label="Max Balance"
                    placeholder="10000"
                    value={filters.maxBalance}
                    onChange={(value) => setFilters(prev => ({ ...prev, maxBalance: value }))}
                  />
                </Grid.Col>
              </Grid>
            </Paper>
          </Collapse>

          {selectedSuppliers.length > 0 && (
            <Paper p="md" withBorder mb="md" bg="blue.0">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{selectedSuppliers.length} supplier(s) selected</Text>
                <Group gap="xs">
                  <Button size="xs" color="red" onClick={handleBulkDelete}>
                    Deactivate Selected
                  </Button>
                  <Button size="xs" variant="default" onClick={() => setSelectedSuppliers([])}>
                    Clear Selection
                  </Button>
                </Group>
              </Group>
            </Paper>
          )}

          <DataTable
            columns={columns}
            records={suppliers}
            fetching={loading}
            totalRecords={pagination.total}
            recordsPerPage={pagination.pageSize}
            page={pagination.current}
            onPageChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
            recordsPerPageOptions={[10, 25, 50, 100]}
            onRecordsPerPageChange={(pageSize) => setPagination(prev => ({ ...prev, pageSize, current: 1 }))}
            selectedRecords={suppliers.filter(s => selectedSuppliers.includes(s._id))}
            onSelectedRecordsChange={(records) => setSelectedSuppliers(records.map(r => r._id))}
            highlightOnHover
            minHeight={suppliers.length === 0 ? 200 : undefined}
            noRecordsText="No suppliers found"
          />
        </Paper>
      </Paper>

      <Modal
        opened={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Suppliers"
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

      <SupplierModal
        isOpen={showSupplierModal}
        onClose={handleCloseModal}
        onSuccess={handleModalSuccess}
        supplierId={selectedSupplierId}
      />
    </Box>
  );
};

export default SupplierList;