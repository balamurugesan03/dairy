import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { subsidyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  Container,
  Card,
  Table,
  Button,
  Group,
  TextInput,
  Select,
  Modal,
  Checkbox,
  Textarea,
  Radio,
  Badge,
  LoadingOverlay,
  Text,
  ActionIcon,
  Menu,
  Stack,
  Divider,
  Paper,
  Title,
  ScrollArea,
  Pagination
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconEye,
  IconEdit,
  IconTrash,
  IconFilter,
  IconDotsVertical,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypePdf
} from '@tabler/icons-react';

const SubsidyList = () => {
  const navigate = useNavigate();
  const [subsidies, setSubsidies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSubsidy, setEditingSubsidy] = useState(null);
  const [formData, setFormData] = useState({
    subsidyName: '',
    subsidyType: 'Subsidy',
    ledgerGroup: '',
    status: 'Active',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    subsidyType: '',
    ledgerGroup: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchSubsidies();
  }, []);

  const fetchSubsidies = async () => {
    setLoading(true);
    try {
      const response = await subsidyAPI.getAll();
      setSubsidies(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch subsidies');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingSubsidy(null);
    setFormData({
      subsidyName: '',
      subsidyType: 'Subsidy',
      ledgerGroup: '',
      status: 'Active',
      description: ''
    });
    setErrors({});
    setModalVisible(true);
  };

  const handleEdit = (subsidy) => {
    setEditingSubsidy(subsidy);
    setFormData({
      subsidyName: subsidy.subsidyName || '',
      subsidyType: subsidy.subsidyType || 'Subsidy',
      ledgerGroup: subsidy.ledgerGroup || '',
      status: subsidy.status || 'Active',
      description: subsidy.description || ''
    });
    setErrors({});
    setModalVisible(true);
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.subsidyName.trim()) newErrors.subsidyName = 'Subsidy name is required';
    if (!formData.subsidyType) newErrors.subsidyType = 'Subsidy type is required';
    if (!formData.ledgerGroup) newErrors.ledgerGroup = 'Ledger group is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (editingSubsidy) {
        await subsidyAPI.update(editingSubsidy._id, formData);
        message.success('Subsidy updated successfully');
      } else {
        await subsidyAPI.create(formData);
        message.success('Subsidy created successfully');
      }
      setModalVisible(false);
      fetchSubsidies();
    } catch (error) {
      message.error(error.message || 'Failed to save subsidy');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to deactivate this subsidy?')) {
      try {
        await subsidyAPI.delete(id);
        message.success('Subsidy deactivated successfully');
        fetchSubsidies();
      } catch (error) {
        message.error(error.message || 'Failed to delete subsidy');
      }
    }
  };

  const getSubsidyTypeColor = (type) => {
    return type === 'Subsidy' ? 'green' : 'blue';
  };

  const getLedgerGroupColor = (group) => {
    const colorMap = {
      'Advance due to Society': 'blue',
      'Advance due by Society': 'cyan',
      'Contingencies': 'yellow',
      'Trade Expenses': 'red',
      'Trade Income': 'green',
      'Miscellaneous Income': 'violet'
    };
    return colorMap[group] || 'gray';
  };

  const filteredSubsidies = subsidies.filter(subsidy => {
    if (filters.search && !subsidy.subsidyName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.subsidyType && subsidy.subsidyType !== filters.subsidyType) {
      return false;
    }
    if (filters.ledgerGroup && subsidy.ledgerGroup !== filters.ledgerGroup) {
      return false;
    }
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredSubsidies.length / pageSize);
  const paginatedSubsidies = filteredSubsidies.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredSubsidies.map((subsidy, index) => ({
      'S.No': index + 1,
      'Subsidy Name': subsidy.subsidyName,
      'Type': subsidy.subsidyType,
      'Ledger Group': subsidy.ledgerGroup,
      'Status': subsidy.status,
      'Description': subsidy.description || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Subsidies');

    // Auto-width columns
    const colWidths = [
      { wch: 6 },
      { wch: 25 },
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 40 }
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `Subsidies_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
    message.success('Excel exported successfully');
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(16);
    doc.text('Subsidy List', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 22);

    // Table data
    const tableData = filteredSubsidies.map((subsidy, index) => [
      index + 1,
      subsidy.subsidyName,
      subsidy.subsidyType,
      subsidy.ledgerGroup,
      subsidy.status,
      subsidy.description || '-'
    ]);

    doc.autoTable({
      head: [['S.No', 'Subsidy Name', 'Type', 'Ledger Group', 'Status', 'Description']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`Subsidies_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`);
    message.success('PDF exported successfully');
  };

  const ledgerGroupOptions = [
    'Advance due to Society',
    'Advance due by Society',
    'Contingencies',
    'Trade Expenses',
    'Trade Income',
    'Miscellaneous Income'
  ].map(group => ({ value: group, label: group }));

  return (
    <Container size="xl" py="md">
      <Stack spacing="md">
        <PageHeader
          title="Subsidy Management"
          subtitle="View and manage subsidies and discounts"
        />

        <Card shadow="sm" padding="lg" radius="md">
          <Group position="apart" mb="md">
            <Group>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAdd}
                radius="md"
              >
                Add Subsidy
              </Button>
              <Menu shadow="md" width={150}>
                <Menu.Target>
                  <Button variant="outline" leftSection={<IconDownload size={16} />} radius="md">
                    Export
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconFileSpreadsheet size={16} color="green" />}
                    onClick={exportToExcel}
                  >
                    Export Excel
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconFileTypePdf size={16} color="red" />}
                    onClick={exportToPDF}
                  >
                    Export PDF
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>

            <Group>
              <TextInput
                placeholder="Search by subsidy name"
                leftSection={<IconSearch size={16} />}
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                radius="md"
              />
              <Select
                placeholder="All Types"
                data={[
                  { value: '', label: 'All Types' },
                  { value: 'Subsidy', label: 'Subsidy' },
                  { value: 'Discount', label: 'Discount' }
                ]}
                value={filters.subsidyType}
                onChange={(value) => setFilters(prev => ({ ...prev, subsidyType: value }))}
                radius="md"
              />
              <Select
                placeholder="All Ledger Groups"
                data={[{ value: '', label: 'All Ledger Groups' }, ...ledgerGroupOptions]}
                value={filters.ledgerGroup}
                onChange={(value) => setFilters(prev => ({ ...prev, ledgerGroup: value }))}
                radius="md"
              />
            </Group>
          </Group>

          <Divider my="sm" />

          <ScrollArea>
            <Table highlightOnHover>
              <thead>
                <tr>
                  <th>Subsidy Name</th>
                  <th>Type</th>
                  <th>Ledger Group</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubsidies.map((subsidy) => (
                  <tr key={subsidy._id}>
                    <td>{subsidy.subsidyName}</td>
                    <td>
                      <Badge color={getSubsidyTypeColor(subsidy.subsidyType)} variant="light">
                        {subsidy.subsidyType}
                      </Badge>
                    </td>
                    <td>
                      <Badge color={getLedgerGroupColor(subsidy.ledgerGroup)} variant="light">
                        {subsidy.ledgerGroup}
                      </Badge>
                    </td>
                    <td>
                      <Badge color={subsidy.status === 'Active' ? 'green' : 'red'} variant="light">
                        {subsidy.status}
                      </Badge>
                    </td>
                    <td>
                      <Text lineClamp={1}>
                        {subsidy.description || '-'}
                      </Text>
                    </td>
                    <td>
                      <Group spacing="xs">
                        <ActionIcon
                          color="blue"
                          variant="subtle"
                          onClick={() => navigate(`/subsidies/view/${subsidy._id}`)}
                          title="View"
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="yellow"
                          variant="subtle"
                          onClick={() => handleEdit(subsidy)}
                          title="Edit"
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleDelete(subsidy._id)}
                          title="Delete"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </ScrollArea>

          {filteredSubsidies.length === 0 && !loading && (
            <Paper withBorder p="xl" mt="md">
              <Text align="center" color="dimmed">
                No subsidies found
              </Text>
            </Paper>
          )}

          {filteredSubsidies.length > 0 && (
            <Group position="apart" mt="md">
              <Group spacing="xs">
                <Text size="sm" color="dimmed">Show</Text>
                <Select
                  value={String(pageSize)}
                  onChange={(value) => setPageSize(Number(value))}
                  data={[
                    { value: '10', label: '10' },
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' }
                  ]}
                  size="xs"
                  w={70}
                  radius="md"
                />
                <Text size="sm" color="dimmed">per page</Text>
                <Text size="sm" color="dimmed" ml="md">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredSubsidies.length)} of {filteredSubsidies.length} entries
                </Text>
              </Group>
              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                size="sm"
                radius="md"
              />
            </Group>
          )}
        </Card>
      </Stack>

      <Modal
        opened={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingSubsidy ? 'Edit Subsidy' : 'Add Subsidy'}
        size="lg"
        radius="md"
      >
        <form onSubmit={handleSubmit}>
          <Stack spacing="md">
            <TextInput
              label="Subsidy Name"
              placeholder="Enter subsidy name"
              required
              value={formData.subsidyName}
              onChange={(e) => handleChange('subsidyName', e.target.value)}
              error={errors.subsidyName}
              radius="md"
            />

            <div>
              <Text size="sm" fw={500} mb="xs" required>
                Subsidy Type
              </Text>
              <Radio.Group
                value={formData.subsidyType}
                onChange={(value) => handleChange('subsidyType', value)}
                error={errors.subsidyType}
              >
                <Group mt="xs">
                  <Radio value="Subsidy" label="Subsidy" />
                  <Radio value="Discount" label="Discount" />
                </Group>
              </Radio.Group>
            </div>

            <Select
              label="Ledger Group"
              placeholder="Select Ledger Group"
              required
              data={ledgerGroupOptions}
              value={formData.ledgerGroup}
              onChange={(value) => handleChange('ledgerGroup', value)}
              error={errors.ledgerGroup}
              radius="md"
            />

            <Checkbox
              label="Active"
              checked={formData.status === 'Active'}
              onChange={(e) => handleChange('status', e.target.checked ? 'Active' : 'Inactive')}
            />

            <Textarea
              label="Description"
              placeholder="Enter description (optional)"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              minRows={4}
              radius="md"
            />

            <Group position="right" mt="md">
              <Button
                variant="default"
                onClick={() => setModalVisible(false)}
                radius="md"
              >
                Cancel
              </Button>
              <Button type="submit" radius="md">
                {editingSubsidy ? 'Update' : 'Save'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <LoadingOverlay visible={loading} />
    </Container>
  );
};

export default SubsidyList;