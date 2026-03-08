import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, TextInput, Select,
  Badge, ActionIcon, Menu, Loader, Center, Box, Grid, Card, ThemeIcon,
  Tooltip, Pagination
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus, IconSearch, IconTool, IconEye, IconEdit, IconTrash,
  IconDotsVertical, IconRefresh, IconAlertCircle, IconCheck, IconX,
  IconEngine, IconCalendar
} from '@tabler/icons-react';
import { machineAPI } from '../../services/api';
import dayjs from 'dayjs';

const STATUS_CONFIG = {
  Active:              { color: 'green',  label: 'Active' },
  'Under Maintenance': { color: 'orange', label: 'Under Maintenance' },
  Disposed:            { color: 'red',    label: 'Disposed' },
  Sold:                { color: 'gray',   label: 'Sold' },
  Inactive:            { color: 'gray',   label: 'Inactive' }
};

const MachineList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const fetchMachines = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (status) params.status = status;

      const res = await machineAPI.getAll(params);
      const data = res?.data?.data || res?.data || res || [];
      const pg = res?.data?.pagination || res?.pagination || {};
      setMachines(Array.isArray(data) ? data : []);
      setPagination(p => ({ ...p, total: pg.total || 0, pages: pg.pages || 0 }));
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load machines', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search, status]);

  useEffect(() => { fetchMachines(); }, [fetchMachines]);

  const handleDelete = (row) => {
    modals.openConfirmModal({
      title: 'Delete Machine',
      children: <Text size="sm">Delete <b>{row.machineName}</b>? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await machineAPI.delete(row._id);
          notifications.show({ title: 'Deleted', message: 'Machine deleted', color: 'green' });
          fetchMachines();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const counts = machines.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {});
  const statCards = [
    { label: 'Total', value: pagination.total, color: 'blue', icon: <IconEngine size={20}/> },
    { label: 'Active', value: counts.Active || 0, color: 'green', icon: <IconCheck size={20}/> },
    { label: 'Maintenance', value: counts['Under Maintenance'] || 0, color: 'orange', icon: <IconTool size={20}/> },
    { label: 'Disposed', value: (counts.Disposed || 0) + (counts.Sold || 0), color: 'red', icon: <IconX size={20}/> },
  ];

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={2} fw={700}>Machine / Asset Register</Title>
          <Text c="dimmed" size="sm">Track machinery and equipment with maintenance logs</Text>
        </Box>
        <Button leftSection={<IconPlus size={16}/>} onClick={() => navigate('/machines/add')}>
          Add Machine
        </Button>
      </Group>

      {/* Stats */}
      <Grid mb="md" gutter="sm">
        {statCards.map(s => (
          <Grid.Col key={s.label} span={{ base: 6, sm: 3 }}>
            <Card withBorder radius="md" p="sm">
              <Group gap="xs">
                <ThemeIcon size="md" variant="light" color={s.color} radius="md">{s.icon}</ThemeIcon>
                <Box><Text size="xs" c="dimmed">{s.label}</Text><Text fw={700} size="lg">{s.value}</Text></Box>
              </Group>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {/* Filters */}
      <Paper withBorder p="sm" mb="md" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search machine, serial, location..."
            leftSection={<IconSearch size={14}/>}
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            placeholder="All Status"
            data={['Active', 'Under Maintenance', 'Disposed', 'Sold', 'Inactive']}
            value={status}
            onChange={v => { setStatus(v || ''); setPagination(p => ({ ...p, page: 1 })); }}
            clearable style={{ width: 180 }}
          />
          <Tooltip label="Refresh">
            <ActionIcon variant="light" onClick={fetchMachines}><IconRefresh size={16}/></ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <DataTable
          records={machines}
          fetching={loading}
          minHeight={300}
          noRecordsText="No machines found"
          columns={[
            {
              accessor: 'machineCode',
              title: 'Code',
              render: (row) => (
                <Text fw={600} size="sm" c="blue" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/machines/view/${row._id}`)}>
                  {row.machineCode}
                </Text>
              )
            },
            {
              accessor: 'machineName',
              title: 'Machine / Asset',
              render: (row) => (
                <Box>
                  <Text size="sm" fw={500}>{row.machineName}</Text>
                  {row.category && <Text size="xs" c="dimmed">{row.category}</Text>}
                </Box>
              )
            },
            {
              accessor: 'make',
              title: 'Make / Model',
              render: (row) => (
                <Box>
                  <Text size="sm">{row.make || '—'}</Text>
                  {row.model && <Text size="xs" c="dimmed">{row.model}</Text>}
                </Box>
              )
            },
            {
              accessor: 'serialNumber',
              title: 'Serial No',
              render: (row) => <Text size="sm">{row.serialNumber || '—'}</Text>
            },
            {
              accessor: 'location',
              title: 'Location',
              render: (row) => (
                <Box>
                  <Text size="sm">{row.location || '—'}</Text>
                  {row.assignedTo && <Text size="xs" c="dimmed">{row.assignedTo}</Text>}
                </Box>
              )
            },
            {
              accessor: 'maintenanceLogs',
              title: 'Maintenance',
              render: (row) => {
                const lastLog = row.maintenanceLogs?.slice(-1)[0];
                const nextDate = lastLog?.nextMaintenanceDate;
                const daysToNext = nextDate ? dayjs(nextDate).diff(dayjs(), 'day') : null;
                return (
                  <Box>
                    <Text size="sm">{row.maintenanceLogs?.length || 0} logs</Text>
                    {nextDate && (
                      <Text size="xs" c={daysToNext !== null && daysToNext < 7 ? 'orange' : 'dimmed'}>
                        Next: {dayjs(nextDate).format('DD MMM')}
                      </Text>
                    )}
                  </Box>
                );
              }
            },
            {
              accessor: 'status',
              title: 'Status',
              render: (row) => {
                const cfg = STATUS_CONFIG[row.status] || { color: 'gray', label: row.status };
                return <Badge color={cfg.color} variant="light" size="sm">{cfg.label}</Badge>;
              }
            },
            {
              accessor: 'actions', title: '', width: 60,
              render: (row) => (
                <Menu shadow="md" width={180} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle"><IconDotsVertical size={16}/></ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconEye size={14}/>} onClick={() => navigate(`/machines/view/${row._id}`)}>View / Maintenance</Menu.Item>
                    <Menu.Item leftSection={<IconEdit size={14}/>} onClick={() => navigate(`/machines/edit/${row._id}`)}>Edit</Menu.Item>
                    <Menu.Divider/>
                    <Menu.Item leftSection={<IconTrash size={14}/>} color="red" onClick={() => handleDelete(row)}>Delete</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )
            }
          ]}
        />
      </Paper>

      {pagination.pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={pagination.pages} value={pagination.page} onChange={p => setPagination(prev => ({ ...prev, page: p }))}/>
        </Group>
      )}
    </Container>
  );
};

export default MachineList;
