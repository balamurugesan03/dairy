
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Group,
  Text,
  Title,
  Button,
  TextInput,
  Select,
  Table,
  ScrollArea,
  Badge,
  ActionIcon,
  Tooltip,
  Stack,
  SimpleGrid,
  ThemeIcon,
  Divider,
  Pagination,
  Center,
  Loader
} from '@mantine/core';
import {
  IconUser,
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconSearch,
  IconBuilding,
  IconPhone,
  IconToggleLeft,
  IconToggleRight,
  IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { agentAPI, collectionCenterAPI } from '../../services/api';
import AgentModal from './AgentModal';
import ImportModal from '../common/ImportModal';
import { IconUpload } from '@tabler/icons-react';

const AgentManagement = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', page: 1, limit: 10 });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCenterId, setImportCenterId] = useState('');
  const [collectionCenters, setCollectionCenters] = useState([]);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentAPI.getAll({
        page: filters.page,
        limit: filters.limit,
        search: filters.search,
        status: filters.status
      });
      setAgents(res.data || []);
      if (res.pagination) setPagination(res.pagination);
    } catch (error) {
      notifications.show({ title: 'Error', message: error.message || 'Failed to fetch agents', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  useEffect(() => {
    collectionCenterAPI.getAll({ status: 'Active', limit: 100 }).then(res => {
      const centers = res.data || [];
      setCollectionCenters(centers);
      if (centers.length === 1) setImportCenterId(centers[0]._id);
    }).catch(() => {});
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handleOpenAdd = () => { setSelectedId(null); setModalOpen(true); };
  const handleOpenEdit = (id) => { setSelectedId(id); setModalOpen(true); };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await agentAPI.toggleStatus(id);
      notifications.show({
        title: 'Success',
        message: `Agent ${currentStatus === 'Active' ? 'deactivated' : 'activated'}`,
        color: 'green'
      });
      fetchAgents();
    } catch (error) {
      notifications.show({ title: 'Error', message: error.message || 'Failed to toggle status', color: 'red' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this agent?')) return;
    try {
      await agentAPI.delete(id);
      notifications.show({ title: 'Success', message: 'Agent deactivated', color: 'green' });
      fetchAgents();
    } catch (error) {
      notifications.show({ title: 'Error', message: error.message || 'Failed to delete agent', color: 'red' });
    }
  };

  const handleImport = async (data) => {
    if (!importCenterId) {
      notifications.show({ title: 'Select Center', message: 'Please select a collection center before importing', color: 'yellow' });
      throw new Error('No collection center selected');
    }

    // Normalize keys to lowercase (handles Excel casing differences)
    const parseDateTime = (val) => {
      if (!val) return undefined;
      if (typeof val === 'number') {
        if (val <= 0) return undefined;
        return new Date(Math.round((val - 25569) * 86400 * 1000));
      }
      const str = String(val).trim();
      if (!str || str === '0000-00-00' || str.startsWith('#')) return undefined;
      // DD-MM-YYYY HH:MM or DD-MM-YYYY
      const m = str.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}:\d{2}))?/);
      if (m) {
        const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] || '00:00'}:00`);
        return isNaN(d.getTime()) ? undefined : d;
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const agents = data.map(row => {
      const r = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v])
      );
      const caId  = String(r['ca_id']  || '').trim();
      const dcsId = String(r['dcs_id'] || '').trim();
      return {
        agentCode:          caId && dcsId ? `AG-${dcsId}-${caId}` : `AG-${caId}`,
        agentName:          String(r['name'] || '').trim(),
        status:             String(r['active'] || '').toUpperCase() === 'N' ? 'Inactive' : 'Active',
        dateOfJoining:      parseDateTime(r['date_entry']),
        collectionCenterId: importCenterId,
      };
    });

    const response = await agentAPI.bulkImport(agents);
    const { created, updated, errors } = response.data;

    if (errors.length === 0) {
      notifications.show({ title: 'Import Successful', message: `${created} agents created, ${updated} updated.`, color: 'green' });
    } else {
      notifications.show({ title: 'Import Completed', message: `${created} created, ${updated} updated, ${errors.length} failed.`, color: 'yellow' });
    }
    fetchAgents();
    return response;
  };

  // Stats — fetched globally (not page-scoped)
  const [globalStats, setGlobalStats] = useState({ active: 0, inactive: 0 });

  useEffect(() => {
    agentAPI.getAll({ limit: 1000 }).then(res => {
      const all = res.data || [];
      setGlobalStats({
        active: all.filter(a => a.status === 'Active').length,
        inactive: all.filter(a => a.status === 'Inactive').length
      });
    }).catch(() => {});
  }, [agents]); // re-run whenever the list refreshes

  return (
    <Box p="md">
      {/* Header */}
      <Paper
        radius="lg"
        mb="md"
        style={{
          background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 40%, #ffffff 100%)',
          border: '1px solid #90caf9',
          overflow: 'hidden'
        }}
      >
        <Box
          style={{
            background: 'linear-gradient(90deg, #1565c0 0%, #1976d2 50%, #42a5f5 100%)',
            padding: '10px 20px'
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconUser size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Agent Management</Title>
                <Text size="xs" c="rgba(255,255,255,0.8)">Manage collection agents</Text>
              </Box>
            </Group>
            <Group gap="xs">
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleOpenAdd}
                style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}
                size="sm"
              >
                Add Agent
              </Button>
              <Select
                placeholder="Select Center"
                value={importCenterId}
                onChange={v => setImportCenterId(v || '')}
                data={collectionCenters.map(c => ({ value: c._id, label: c.centerName }))}
                size="sm"
                style={{ minWidth: 160 }}
                styles={{ input: { background: 'rgba(255,255,255,0.9)' } }}
              />
              <Button
                leftSection={<IconUpload size={16} />}
                onClick={() => setShowImportModal(true)}
                style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)' }}
                size="sm"
              >
                Import
              </Button>
              <Button
                leftSection={<IconX size={16} />}
                onClick={() => navigate('/')}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)' }}
                size="sm"
              >
                Close
              </Button>
            </Group>
          </Group>
        </Box>

        {/* Stats */}
        <Box px="xl" py="sm">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <Box style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total</Text>
              <Text fw={800} c="blue.7" size="lg">{pagination.totalItems}</Text>
            </Box>
            <Box style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Active</Text>
              <Text fw={800} c="green.7" size="lg">{globalStats.active}</Text>
            </Box>
            <Box style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">Inactive</Text>
              <Text fw={800} c="red.7" size="lg">{globalStats.inactive}</Text>
            </Box>
          </SimpleGrid>
        </Box>
      </Paper>

      {/* Filters */}
      <Paper radius="md" p="md" mb="md" withBorder>
        <Group gap="md" wrap="wrap" align="flex-end">
          <TextInput
            placeholder="Search agents..."
            leftSection={<IconSearch size={16} />}
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            style={{ flex: '2 1 200px' }}
            size="sm"
          />
          <Select
            placeholder="All Statuses"
            value={filters.status}
            onChange={v => handleFilterChange('status', v || '')}
            data={[
              { value: '', label: 'All Statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]}
            clearable
            style={{ flex: '1 1 140px' }}
            size="sm"
          />
          <ActionIcon
            size="lg"
            variant="light"
            color="blue"
            onClick={fetchAgents}
            title="Refresh"
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box
          style={{
            background: 'linear-gradient(90deg, #1565c0 0%, #1976d2 100%)',
            padding: '10px 16px'
          }}
        >
          <Text fw={700} size="sm" c="white">Agent List</Text>
        </Box>

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="md" /></Center>
          ) : agents.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconUser size={40} color="#bdbdbd" />
                <Text c="dimmed" size="sm">No agents found. Add one above.</Text>
              </Stack>
            </Center>
          ) : (
            <Table striped highlightOnHover withColumnBorders style={{ fontSize: 13 }}>
              <Table.Thead style={{ background: 'linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%)' }}>
                <Table.Tr>
                  {['#', 'Code', 'Agent Name', 'Collection Center', 'Phone', 'Status', 'Actions'].map(col => (
                    <Table.Th
                      key={col}
                      style={{
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        color: '#1565c0',
                        padding: '10px 14px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {col}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {agents.map((agent, idx) => (
                  <Table.Tr key={agent._id}>
                    <Table.Td style={{ padding: '8px 14px', color: '#1565c0', fontWeight: 700 }}>
                      {(filters.page - 1) * filters.limit + idx + 1}
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 14px', fontWeight: 600 }}>
                      <Badge variant="light" color="blue" size="sm">{agent.agentCode}</Badge>
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 14px', fontWeight: 600 }}>
                      <Group gap="xs">
                        <IconUser size={14} color="#1565c0" />
                        {agent.agentName}
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 14px' }}>
                      {agent.collectionCenterId ? (
                        <Group gap="xs">
                          <IconBuilding size={13} color="#6a1b9a" />
                          <Text size="xs">{agent.collectionCenterId.centerName}</Text>
                        </Group>
                      ) : '—'}
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 14px' }}>
                      {agent.phone ? (
                        <Group gap="xs">
                          <IconPhone size={13} color="#388e3c" />
                          {agent.phone}
                        </Group>
                      ) : '—'}
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 14px' }}>
                      <Badge
                        color={agent.status === 'Active' ? 'green' : 'red'}
                        variant="light"
                        size="sm"
                      >
                        {agent.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ padding: '8px 10px' }}>
                      <Group gap="xs">
                        <Tooltip label="Edit" withArrow>
                          <ActionIcon size="sm" color="blue" variant="light" radius="md" onClick={() => handleOpenEdit(agent._id)}>
                            <IconEdit size={13} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={agent.status === 'Active' ? 'Deactivate' : 'Activate'} withArrow>
                          <ActionIcon
                            size="sm"
                            color={agent.status === 'Active' ? 'orange' : 'green'}
                            variant="light"
                            radius="md"
                            onClick={() => handleToggleStatus(agent._id, agent.status)}
                          >
                            {agent.status === 'Active'
                              ? <IconToggleLeft size={13} />
                              : <IconToggleRight size={13} />}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Deactivate" withArrow>
                          <ActionIcon size="sm" color="red" variant="light" radius="md" onClick={() => handleDelete(agent._id)}>
                            <IconTrash size={13} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </ScrollArea>

        <>
          <Divider />
          <Group justify="space-between" px="md" py="sm" wrap="wrap" gap="xs">
            <Text size="xs" c="dimmed">
              {pagination.totalItems > 0
                ? `Showing ${(filters.page - 1) * filters.limit + 1}–${Math.min(filters.page * filters.limit, pagination.totalItems)} of ${pagination.totalItems} agents`
                : 'No agents found'}
            </Text>
            <Group gap="sm" wrap="wrap">
              <Group gap="xs" align="center">
                <Text size="xs" c="dimmed">Per page:</Text>
                <Select
                  size="xs"
                  value={String(filters.limit)}
                  onChange={v => setFilters(prev => ({ ...prev, limit: Number(v), page: 1 }))}
                  data={['10', '20', '30', '50', '100']}
                  styles={{ input: { width: 60, textAlign: 'center' } }}
                />
              </Group>
              {pagination.totalPages > 1 && (
                <Pagination
                  total={pagination.totalPages}
                  value={filters.page}
                  onChange={page => setFilters(prev => ({ ...prev, page }))}
                  size="sm"
                />
              )}
            </Group>
          </Group>
        </>
      </Paper>

      <AgentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { fetchAgents(); setModalOpen(false); }}
        agentId={selectedId}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        entityType="Agents (OpenLyssa)"
        requiredFields={['ca_id', 'name']}
      />
    </Box>
  );
};

export default AgentManagement;
