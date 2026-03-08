import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, TextInput, Select,
  Badge, ActionIcon, Menu, Loader, Center, Box, Grid, Card, ThemeIcon,
  Tooltip, Pagination, Progress
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus, IconSearch, IconShield, IconEye, IconEdit, IconTrash,
  IconDotsVertical, IconRefresh, IconAlertCircle, IconCheck, IconX,
  IconCalendar, IconShieldCheck, IconShieldOff
} from '@tabler/icons-react';
import { warrantyAPI } from '../../services/api';
import dayjs from 'dayjs';

const STATUS_CONFIG = {
  Active:  { color: 'green',  label: 'Active' },
  Expired: { color: 'red',    label: 'Expired' },
  Claimed: { color: 'orange', label: 'Claimed' },
  Void:    { color: 'gray',   label: 'Void' }
};

const WarrantyList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [warranties, setWarranties] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const fetchWarranties = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (status) params.status = status;

      const res = await warrantyAPI.getAll(params);
      const data = res?.data?.data || res?.data || res || [];
      const pg = res?.data?.pagination || res?.pagination || {};
      setWarranties(Array.isArray(data) ? data : []);
      setPagination(p => ({ ...p, total: pg.total || 0, pages: pg.pages || 0 }));
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load warranties', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search, status]);

  useEffect(() => { fetchWarranties(); }, [fetchWarranties]);

  const handleDelete = (row) => {
    modals.openConfirmModal({
      title: 'Delete Warranty',
      children: <Text size="sm">Delete warranty for <b>{row.itemName}</b>? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await warrantyAPI.delete(row._id);
          notifications.show({ title: 'Deleted', message: 'Warranty deleted', color: 'green' });
          fetchWarranties();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  // Days remaining helper
  const daysRemaining = (endDate) => {
    const diff = dayjs(endDate).diff(dayjs(), 'day');
    return diff;
  };

  const counts = warranties.reduce((acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc; }, {});
  const statCards = [
    { label: 'Total', value: pagination.total, color: 'blue', icon: <IconShield size={20}/> },
    { label: 'Active', value: counts.Active || 0, color: 'green', icon: <IconShieldCheck size={20}/> },
    { label: 'Expired', value: counts.Expired || 0, color: 'red', icon: <IconShieldOff size={20}/> },
    { label: 'Claimed', value: counts.Claimed || 0, color: 'orange', icon: <IconAlertCircle size={20}/> },
  ];

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={2} fw={700}>Warranty Management</Title>
          <Text c="dimmed" size="sm">Track product warranties and claims</Text>
        </Box>
        <Button leftSection={<IconPlus size={16}/>} onClick={() => navigate('/warranty/add')}>
          Add Warranty
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
            placeholder="Search item, customer, serial..."
            leftSection={<IconSearch size={14}/>}
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            placeholder="All Status"
            data={['Active', 'Expired', 'Claimed', 'Void']}
            value={status}
            onChange={v => { setStatus(v || ''); setPagination(p => ({ ...p, page: 1 })); }}
            clearable style={{ width: 140 }}
          />
          <Tooltip label="Refresh">
            <ActionIcon variant="light" onClick={fetchWarranties}><IconRefresh size={16}/></ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <DataTable
          records={warranties}
          fetching={loading}
          minHeight={300}
          noRecordsText="No warranties found"
          columns={[
            {
              accessor: 'warrantyNumber',
              title: 'Warranty #',
              render: (row) => (
                <Text fw={600} size="sm" c="blue" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/warranty/view/${row._id}`)}>
                  {row.warrantyNumber}
                </Text>
              )
            },
            {
              accessor: 'itemName',
              title: 'Item',
              render: (row) => (
                <Box>
                  <Text size="sm" fw={500}>{row.itemName}</Text>
                  {row.serialNumber && <Text size="xs" c="dimmed">S/N: {row.serialNumber}</Text>}
                </Box>
              )
            },
            {
              accessor: 'customerName',
              title: 'Customer',
              render: (row) => (
                <Box>
                  <Text size="sm">{row.customerName || '—'}</Text>
                  {row.customerPhone && <Text size="xs" c="dimmed">{row.customerPhone}</Text>}
                </Box>
              )
            },
            {
              accessor: 'warrantyType',
              title: 'Type',
              render: (row) => <Badge variant="light" size="sm">{row.warrantyType || '—'}</Badge>
            },
            {
              accessor: 'warrantyStartDate',
              title: 'Start',
              render: (row) => <Text size="sm">{row.warrantyStartDate ? dayjs(row.warrantyStartDate).format('DD MMM YY') : '—'}</Text>
            },
            {
              accessor: 'warrantyEndDate',
              title: 'Expiry',
              render: (row) => {
                const days = daysRemaining(row.warrantyEndDate);
                return (
                  <Box>
                    <Text size="sm" c={days < 0 ? 'red' : days < 30 ? 'orange' : undefined}>
                      {row.warrantyEndDate ? dayjs(row.warrantyEndDate).format('DD MMM YY') : '—'}
                    </Text>
                    {days > 0 && <Text size="xs" c="dimmed">{days}d left</Text>}
                  </Box>
                );
              }
            },
            {
              accessor: 'claims',
              title: 'Claims',
              render: (row) => <Text size="sm">{row.claims?.length || 0}</Text>
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
                    <Menu.Item leftSection={<IconEye size={14}/>} onClick={() => navigate(`/warranty/view/${row._id}`)}>View / Claims</Menu.Item>
                    <Menu.Item leftSection={<IconEdit size={14}/>} onClick={() => navigate(`/warranty/edit/${row._id}`)}>Edit</Menu.Item>
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

export default WarrantyList;
