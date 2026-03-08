import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Paper, TextInput, Select,
  Badge, ActionIcon, Menu, Box, Grid, Card,
  ThemeIcon, Tooltip, Pagination
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus, IconSearch, IconFileText, IconEye, IconEdit, IconTrash,
  IconDotsVertical, IconRefresh, IconCalendar, IconCheck, IconSend,
  IconX, IconClock, IconArrowRight, IconPrinter, IconCurrencyRupee,
  IconBrandWhatsapp, IconMail
} from '@tabler/icons-react';
import { quotationAPI } from '../../services/api';
import QuotationSendModal from './QuotationSendModal';
import dayjs from 'dayjs';

const STATUS_CONFIG = {
  Draft:     { color: 'gray',   label: 'Draft' },
  Sent:      { color: 'blue',   label: 'Sent' },
  Accepted:  { color: 'green',  label: 'Accepted' },
  Rejected:  { color: 'red',    label: 'Rejected' },
  Expired:   { color: 'orange', label: 'Expired' },
  Converted: { color: 'teal',   label: 'Converted' }
};

const QuotationList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [sendTarget, setSendTarget] = useState(null); // quotation to send

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      if (status) params.status = status;
      if (dateRange[0]) params.startDate = dayjs(dateRange[0]).format('YYYY-MM-DD');
      if (dateRange[1]) params.endDate = dayjs(dateRange[1]).format('YYYY-MM-DD');

      const res = await quotationAPI.getAll(params);
      const data = res?.data?.data || res?.data || res || [];
      const pg = res?.data?.pagination || res?.pagination || {};
      setQuotations(Array.isArray(data) ? data : []);
      setPagination(p => ({ ...p, total: pg.total || 0, pages: pg.pages || 0 }));
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load quotations', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search, status, dateRange]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const handleDelete = (row) => {
    modals.openConfirmModal({
      title: 'Delete Quotation',
      children: <Text size="sm">Delete <b>{row.quotationNumber}</b>? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await quotationAPI.delete(row._id);
          notifications.show({ title: 'Deleted', message: 'Quotation deleted', color: 'green' });
          fetchQuotations();
        } catch (err) {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        }
      }
    });
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await quotationAPI.update(id, { status: newStatus });
      notifications.show({ title: 'Updated', message: `Status changed to ${newStatus}`, color: 'green' });
      fetchQuotations();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  // Summary counts
  const counts = quotations.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {});

  const statCards = [
    { label: 'Total', value: pagination.total, color: 'blue', icon: <IconFileText size={20}/> },
    { label: 'Draft', value: counts.Draft || 0, color: 'gray', icon: <IconClock size={20}/> },
    { label: 'Sent', value: counts.Sent || 0, color: 'blue', icon: <IconSend size={20}/> },
    { label: 'Accepted', value: counts.Accepted || 0, color: 'green', icon: <IconCheck size={20}/> },
    { label: 'Converted', value: counts.Converted || 0, color: 'teal', icon: <IconArrowRight size={20}/> },
  ];

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={2} fw={700}>Quotations / Estimates</Title>
          <Text c="dimmed" size="sm">Create and manage customer quotations</Text>
        </Box>
        <Group gap="xs">
          <Button variant="light" color="teal" leftSection={<IconFileText size={16}/>} onClick={() => navigate('/quotations/proposal')}>
            Business Proposal
          </Button>
          <Button leftSection={<IconPlus size={16}/>} onClick={() => navigate('/quotations/add')}>
            New Quotation
          </Button>
        </Group>
      </Group>

      {/* Stats */}
      <Grid mb="md" gutter="sm">
        {statCards.map(s => (
          <Grid.Col key={s.label} span={{ base: 6, sm: 4, md: 2.4 }}>
            <Card withBorder radius="md" p="sm">
              <Group gap="xs">
                <ThemeIcon size="md" variant="light" color={s.color} radius="md">
                  {s.icon}
                </ThemeIcon>
                <Box>
                  <Text size="xs" c="dimmed">{s.label}</Text>
                  <Text fw={700} size="lg">{s.value}</Text>
                </Box>
              </Group>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {/* Filters */}
      <Paper withBorder p="sm" mb="md" radius="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Search by number or customer..."
            leftSection={<IconSearch size={14}/>}
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            placeholder="All Status"
            data={['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted']}
            value={status}
            onChange={v => { setStatus(v || ''); setPagination(p => ({ ...p, page: 1 })); }}
            clearable
            style={{ width: 150 }}
          />
          <DatePickerInput
            type="range"
            placeholder="Date range"
            value={dateRange}
            onChange={setDateRange}
            leftSection={<IconCalendar size={14}/>}
            clearable
            style={{ minWidth: 220 }}
          />
          <Tooltip label="Refresh">
            <ActionIcon variant="light" onClick={fetchQuotations}><IconRefresh size={16}/></ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      {/* Table */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <DataTable
          records={quotations}
          fetching={loading}
          minHeight={300}
          noRecordsText="No quotations found"
          columns={[
            {
              accessor: 'quotationNumber',
              title: 'Quotation #',
              render: (row) => (
                <Text fw={600} size="sm" c="blue" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/quotations/view/${row._id}`)}>
                  {row.quotationNumber}
                </Text>
              )
            },
            {
              accessor: 'quotationDate',
              title: 'Date',
              render: (row) => <Text size="sm">{dayjs(row.quotationDate).format('DD MMM YYYY')}</Text>
            },
            {
              accessor: 'validUntil',
              title: 'Valid Until',
              render: (row) => {
                const expired = new Date(row.validUntil) < new Date();
                return <Text size="sm" c={expired ? 'red' : undefined}>{dayjs(row.validUntil).format('DD MMM YYYY')}</Text>;
              }
            },
            {
              accessor: 'partyName',
              title: 'Customer',
              render: (row) => (
                <Box>
                  <Text size="sm" fw={500}>{row.partyName || '—'}</Text>
                  {row.partyPhone && <Text size="xs" c="dimmed">{row.partyPhone}</Text>}
                </Box>
              )
            },
            {
              accessor: 'items',
              title: 'Items',
              render: (row) => <Text size="sm">{row.items?.length || 0}</Text>
            },
            {
              accessor: 'grandTotal',
              title: 'Amount',
              textAlign: 'right',
              render: (row) => (
                <Text size="sm" fw={600}>
                  ₹{(row.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              )
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
              accessor: 'actions',
              title: '',
              width: 60,
              render: (row) => (
                <Menu shadow="md" width={200} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle"><IconDotsVertical size={16}/></ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconEye size={14}/>} onClick={() => navigate(`/quotations/view/${row._id}`)}>View</Menu.Item>
                    <Menu.Item leftSection={<IconEdit size={14}/>} onClick={() => navigate(`/quotations/edit/${row._id}`)} disabled={row.status === 'Converted'}>Edit</Menu.Item>
                    <Menu.Divider/>
                    <Menu.Item leftSection={<IconBrandWhatsapp size={14}/>} color="green" onClick={() => setSendTarget(row)}>Send via WhatsApp</Menu.Item>
                    <Menu.Item leftSection={<IconMail size={14}/>} color="blue" onClick={() => setSendTarget(row)}>Send via Email</Menu.Item>
                    <Menu.Divider/>
                    {row.status === 'Draft' && <Menu.Item leftSection={<IconSend size={14}/>} onClick={() => handleStatusChange(row._id, 'Sent')}>Mark as Sent</Menu.Item>}
                    {row.status === 'Sent' && <Menu.Item leftSection={<IconCheck size={14}/>} color="green" onClick={() => handleStatusChange(row._id, 'Accepted')}>Mark Accepted</Menu.Item>}
                    {row.status === 'Sent' && <Menu.Item leftSection={<IconX size={14}/>} color="red" onClick={() => handleStatusChange(row._id, 'Rejected')}>Mark Rejected</Menu.Item>}
                    {(row.status === 'Accepted' || row.status === 'Sent') && (
                      <Menu.Item leftSection={<IconArrowRight size={14}/>} color="teal" onClick={() => navigate(`/quotations/view/${row._id}`)}>Convert to Invoice</Menu.Item>
                    )}
                    <Menu.Divider/>
                    <Menu.Item leftSection={<IconTrash size={14}/>} color="red" onClick={() => handleDelete(row)} disabled={row.status === 'Converted'}>Delete</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )
            }
          ]}
        />
      </Paper>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={pagination.pages}
            value={pagination.page}
            onChange={p => setPagination(prev => ({ ...prev, page: p }))}
          />
        </Group>
      )}

      {/* Send Modal */}
      {sendTarget && (
        <QuotationSendModal
          opened={!!sendTarget}
          onClose={() => setSendTarget(null)}
          quotation={sendTarget}
          onSent={fetchQuotations}
        />
      )}
    </Container>
  );
};

export default QuotationList;
