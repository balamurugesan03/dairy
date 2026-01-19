import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { voucherAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';
import {
  Box,
  Button,
  Paper,
  Grid,
  Text,
  Select,
  LoadingOverlay,
  Group,
  Stack,
  Container,
  Title,
  Divider,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Card,
  ScrollArea,
  Menu,
  Modal,
  TextInput,
  Textarea,
  SimpleGrid,
  RingProgress,
  Center
} from '@mantine/core';
import {
  IconReceipt,
  IconCash,
  IconExchange,
  IconEye,
  IconTrash,
  IconFilter,
  IconCalendar,
  IconDownload,
  IconPlus,
  IconChevronDown,
  IconSearch,
  IconRefresh,
  IconReceipt2,
  IconCurrencyRupee,
  IconFileInvoice,
  IconChartBar,
  IconEdit,
  IconCopy,
  IconPrinter,
  IconInfoCircle,
  IconTrendingUp,
  IconTrendingDown,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';

const VoucherList = () => {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await voucherAPI.getAll();
      setVouchers(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Voucher',
      content: 'This action cannot be undone. All entries associated with this voucher will be deleted.',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await voucherAPI.delete(id);
          message.success('Voucher deleted successfully');
          fetchVouchers();
        } catch (error) {
          message.error(error.message || 'Failed to delete voucher');
        }
      }
    });
  };

  const handleView = (voucher) => {
    setSelectedVoucher(voucher);
    setViewModalOpened(true);
  };

  const handleDuplicate = async (voucher) => {
    try {
      const { _id, __v, ...voucherData } = voucher;
      voucherData.voucherDate = dayjs().format('YYYY-MM-DD');
      voucherData.referenceNumber = `COPY-${voucher.referenceNumber}`;
      
      await voucherAPI.create(voucherData);
      message.success('Voucher duplicated successfully');
      fetchVouchers();
    } catch (error) {
      message.error(error.message || 'Failed to duplicate voucher');
    }
  };

  const getTypeColor = (type) => {
    if (type === 'Receipt') return 'green';
    else if (type === 'Payment') return 'red';
    else if (type === 'Journal') return 'blue';
    return 'gray';
  };

  const getTypeIcon = (type) => {
    if (type === 'Receipt') return <IconReceipt2 size={14} />;
    else if (type === 'Payment') return <IconCash size={14} />;
    else if (type === 'Journal') return <IconExchange size={14} />;
    return null;
  };

  const filteredVouchers = vouchers.filter(voucher => {
    if (voucherTypeFilter && voucher.voucherType !== voucherTypeFilter) return false;
    
    if (dateRange[0] && dateRange[1]) {
      const voucherDate = dayjs(voucher.voucherDate);
      if (voucherDate.isBefore(dateRange[0], 'day') || voucherDate.isAfter(dateRange[1], 'day')) {
        return false;
      }
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        (voucher.voucherNumber?.toLowerCase().includes(query)) ||
        (voucher.referenceNumber?.toLowerCase().includes(query)) ||
        (voucher.narration?.toLowerCase().includes(query)) ||
        (voucher.entries?.some(entry => entry.ledgerName?.toLowerCase().includes(query)))
      );
    }
    
    return true;
  });

  const stats = {
    total: filteredVouchers.length,
    receipt: filteredVouchers.filter(v => v.voucherType === 'Receipt').length,
    payment: filteredVouchers.filter(v => v.voucherType === 'Payment').length,
    journal: filteredVouchers.filter(v => v.voucherType === 'Journal').length,
    totalDebits: filteredVouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0),
    totalCredits: filteredVouchers.reduce((sum, v) => sum + (v.totalCredit || 0), 0),
    difference: Math.abs(filteredVouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0) - 
                       filteredVouchers.reduce((sum, v) => sum + (v.totalCredit || 0), 0))
  };

  const exportData = filteredVouchers.map(voucher => ({
    'Voucher No': voucher.voucherNumber,
    'Reference No': voucher.referenceNumber || '-',
    'Date': dayjs(voucher.voucherDate).format('DD-MM-YYYY'),
    'Type': voucher.voucherType,
    'Total Debit': voucher.totalDebit,
    'Total Credit': voucher.totalCredit,
    'Reference Type': voucher.referenceType,
    'Narration': voucher.narration || '-'
  }));

  const rows = filteredVouchers.map((voucher, index) => {
    const isManual = voucher.referenceType === 'Manual';
    return (
      <tr key={voucher._id}>
        <td style={{ textAlign: 'center' }}>
          <Badge variant="outline" color="blue" radius="sm">
            {index + 1}
          </Badge>
        </td>
        <td>
          <Group gap="xs" wrap="nowrap">
            <Box sx={{ color: getTypeColor(voucher.voucherType) }}>
              {getTypeIcon(voucher.voucherType)}
            </Box>
            <Text size="sm" weight={500}>
              {voucher.voucherNumber}
            </Text>
          </Group>
          <Text size="xs" color="dimmed">
            Ref: {voucher.referenceNumber || '-'}
          </Text>
        </td>
        <td>
          <Text size="sm">{dayjs(voucher.voucherDate).format('DD-MM-YYYY')}</Text>
        </td>
        <td>
          <Badge
            color={getTypeColor(voucher.voucherType)}
            variant="filled"
            radius="sm"
            size="sm"
          >
            {voucher.voucherType}
          </Badge>
        </td>
        <td style={{ textAlign: 'right' }}>
          <Group spacing={4} position="right" noWrap>
            <IconTrendingUp size={14} color="red" />
            <Text weight={600} color="red" size="sm">
              ₹{(voucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Group>
        </td>
        <td style={{ textAlign: 'right' }}>
          <Group spacing={4} position="right" noWrap>
            <IconTrendingDown size={14} color="green" />
            <Text weight={600} color="green" size="sm">
              ₹{(voucher.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Group>
        </td>
        <td>
          <Text size="sm" color={isManual ? 'blue' : 'dimmed'} weight={isManual ? 500 : 400}>
            {voucher.referenceType}
          </Text>
        </td>
        <td>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="Quick View" withArrow>
              <ActionIcon
                color="blue"
                variant="light"
                size="sm"
                onClick={() => handleView(voucher)}
              >
                <IconEye size={14} />
              </ActionIcon>
            </Tooltip>
            
            <Tooltip label="View Details" withArrow>
              <ActionIcon
                color="gray"
                variant="light"
                size="sm"
                onClick={() => navigate(`/accounting/vouchers/view/${voucher._id}`)}
              >
                <IconInfoCircle size={14} />
              </ActionIcon>
            </Tooltip>
            
            {isManual && (
              <>
                <Tooltip label="Duplicate" withArrow>
                  <ActionIcon
                    color="yellow"
                    variant="light"
                    size="sm"
                    onClick={() => handleDuplicate(voucher)}
                  >
                    <IconCopy size={14} />
                  </ActionIcon>
                </Tooltip>
                
                <Tooltip label="Delete" withArrow>
                  <ActionIcon
                    color="red"
                    variant="light"
                    size="sm"
                    onClick={() => handleDelete(voucher._id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        </td>
      </tr>
    );
  });

  return (
    <Container size="xl" py="md">
      {/* Header Section */}
      <Paper p="lg" mb="md" withBorder shadow="sm" radius="md" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Group position="apart">
          <Box>
            <Title order={2} color="white">Voucher Management</Title>
            <Text color="white" size="sm" opacity={0.9}>
              Manage all accounting vouchers in one place
            </Text>
          </Box>
          
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <Button 
                leftSection={<IconPlus size={18} />} 
                color="white" 
                variant="filled"
                size="md"
                style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}
              >
                Create Voucher
                <IconChevronDown size={16} style={{ marginLeft: 8 }} />
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Create New Voucher</Menu.Label>
              <Menu.Item
                icon={<IconReceipt2 size={16} color="green" />}
                onClick={() => navigate('/accounting/vouchers/receipt')}
              >
                Receipt Voucher
              </Menu.Item>
              <Menu.Item
                icon={<IconCash size={16} color="red" />}
                onClick={() => navigate('/accounting/vouchers/payment')}
              >
                Payment Voucher
              </Menu.Item>
              <Menu.Item
                icon={<IconExchange size={16} color="blue" />}
                onClick={() => navigate('/accounting/vouchers/journal')}
              >
                Journal Voucher
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Quick Actions</Menu.Label>
              <Menu.Item icon={<IconPrinter size={16} />}>Print All</Menu.Item>
              <Menu.Item icon={<IconDownload size={16} />}>Export All</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Paper>

      {/* Stats Cards */}
      <Grid gutter="md" mb="md">
        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #4dabf7' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>Total Vouchers</Text>
                <Text size="xl" weight={700}>{stats.total}</Text>
              </Box>
              <RingProgress
                size={60}
                thickness={4}
                sections={[{ value: 100, color: '#4dabf7' }]}
                label={
                  <Center>
                    <IconFileInvoice size={22} color="#4dabf7" />
                  </Center>
                }
              />
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #40c057' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>Receipts</Text>
                <Text size="xl" weight={700} color="green">{stats.receipt}</Text>
              </Box>
              <RingProgress
                size={60}
                thickness={4}
                sections={[{ value: stats.total > 0 ? (stats.receipt / stats.total) * 100 : 0, color: '#40c057' }]}
                label={
                  <Center>
                    <IconReceipt2 size={22} color="#40c057" />
                  </Center>
                }
              />
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #fa5252' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>Payments</Text>
                <Text size="xl" weight={700} color="red">{stats.payment}</Text>
              </Box>
              <RingProgress
                size={60}
                thickness={4}
                sections={[{ value: stats.total > 0 ? (stats.payment / stats.total) * 100 : 0, color: '#fa5252' }]}
                label={
                  <Center>
                    <IconCash size={22} color="#fa5252" />
                  </Center>
                }
              />
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #228be6' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>Journals</Text>
                <Text size="xl" weight={700} color="blue">{stats.journal}</Text>
              </Box>
              <RingProgress
                size={60}
                thickness={4}
                sections={[{ value: stats.total > 0 ? (stats.journal / stats.total) * 100 : 0, color: '#228be6' }]}
                label={
                  <Center>
                    <IconExchange size={22} color="#228be6" />
                  </Center>
                }
              />
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Financial Summary */}
      <Card withBorder p="lg" radius="md" mb="md">
        <Group position="apart" mb="md">
          <Title order={4}>
            <Group spacing="xs">
              <IconChartBar size={20} />
              Financial Summary
            </Group>
          </Title>
          <Badge 
            color={stats.difference < 0.01 ? 'green' : 'orange'} 
            variant="filled"
            size="lg"
          >
            {stats.difference < 0.01 ? 'Balanced' : 'Unbalanced'}
          </Badge>
        </Group>
        
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <Paper p="md" withBorder>
            <Group position="apart">
              <Text size="sm" color="dimmed">Total Debits</Text>
              <IconTrendingUp size={18} color="red" />
            </Group>
            <Text size="xl" weight={700} color="red" mt="xs">
              ₹{stats.totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Paper>
          
          <Paper p="md" withBorder>
            <Group position="apart">
              <Text size="sm" color="dimmed">Total Credits</Text>
              <IconTrendingDown size={18} color="green" />
            </Group>
            <Text size="xl" weight={700} color="green" mt="xs">
              ₹{stats.totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Paper>
          
          <Paper p="md" withBorder>
            <Group position="apart">
              <Text size="sm" color="dimmed">Difference</Text>
              {stats.difference < 0.01 ? <IconCheck size={18} color="green" /> : <IconX size={18} color="red" />}
            </Group>
            <Text size="xl" weight={700} color={stats.difference < 0.01 ? 'green' : 'red'} mt="xs">
              ₹{stats.difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Paper>
        </SimpleGrid>
      </Card>

      {/* Search and Filters */}
      <Paper p="lg" mb="md" withBorder shadow="sm" radius="md">
        <Grid gutter="md" align="flex-end">
          <Grid.Col xs={12} md={4}>
            <TextInput
              placeholder="Search by voucher number, reference, narration..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<IconSearch size={16} />}
              rightSection={
                searchQuery && (
                  <ActionIcon size="xs" onClick={() => setSearchQuery('')}>
                    <IconX size={12} />
                  </ActionIcon>
                )
              }
            />
          </Grid.Col>
          
          <Grid.Col xs={12} sm={6} md={3}>
            <DatePickerInput
              type="range"
              label="Date Range"
              placeholder="Pick dates"
              value={dateRange}
              onChange={setDateRange}
              icon={<IconCalendar size={16} />}
              clearable
            />
          </Grid.Col>
          
          <Grid.Col xs={12} sm={6} md={3}>
            <Select
              label="Voucher Type"
              placeholder="All Types"
              data={[
                { value: '', label: '📁 All Types' },
                { value: 'Receipt', label: '📥 Receipt' },
                { value: 'Payment', label: '📤 Payment' },
                { value: 'Journal', label: '📝 Journal' }
              ]}
              value={voucherTypeFilter}
              onChange={setVoucherTypeFilter}
              clearable
            />
          </Grid.Col>
          
          <Grid.Col xs={12} sm={6} md={2}>
            <Button
              variant="light"
              color="gray"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                setDateRange([null, null]);
                setVoucherTypeFilter('');
                setSearchQuery('');
              }}
              fullWidth
            >
              Reset
            </Button>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Vouchers Table */}
      <Paper p="md" withBorder shadow="sm" radius="md">
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        <Group position="apart" mb="md">
          <Title order={4}>Voucher List</Title>
          <Group spacing="xs">
            <ExportButton
              data={exportData}
              filename={`vouchers_${dayjs().format('YYYY-MM-DD')}`}
              buttonText="Export"
              variant="light"
            />
            <Text size="sm" color="dimmed">
              Showing {filteredVouchers.length} of {vouchers.length} vouchers
            </Text>
          </Group>
        </Group>

        {filteredVouchers.length === 0 ? (
          <Card p="xl" withBorder>
            <Stack align="center" spacing="md">
              <IconReceipt2 size={64} color="gray" />
              <Text color="dimmed" size="lg">No vouchers found</Text>
              <Text color="dimmed" size="sm" ta="center">
                Try adjusting your search or filter criteria
              </Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate('/accounting/vouchers/receipt')}
              >
                Create First Voucher
              </Button>
            </Stack>
          </Card>
        ) : (
          <>
            <ScrollArea>
              <Table striped highlightOnHover withBorder verticalSpacing="sm">
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                    <th style={{ width: '180px' }}>Voucher Details</th>
                    <th style={{ width: '100px' }}>Date</th>
                    <th style={{ width: '100px' }}>Type</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Debit</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Credit</th>
                    <th style={{ width: '100px' }}>Ref Type</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>{rows}</tbody>
              </Table>
            </ScrollArea>
          </>
        )}
      </Paper>

      {/* Quick View Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title="Voucher Quick View"
        size="md"
        centered
        radius="md"
      >
        {selectedVoucher && (
          <Stack spacing="md">
            <Group position="apart">
              <Badge color={getTypeColor(selectedVoucher.voucherType)} size="lg">
                {selectedVoucher.voucherType}
              </Badge>
              <Text weight={500}>{selectedVoucher.voucherNumber}</Text>
            </Group>
            
            <Divider />
            
            <SimpleGrid cols={2}>
              <Box>
                <Text size="sm" color="dimmed">Date</Text>
                <Text weight={500}>{dayjs(selectedVoucher.voucherDate).format('DD-MM-YYYY')}</Text>
              </Box>
              <Box>
                <Text size="sm" color="dimmed">Reference</Text>
                <Text weight={500}>{selectedVoucher.referenceNumber || '-'}</Text>
              </Box>
              <Box>
                <Text size="sm" color="dimmed">Total Debit</Text>
                <Text weight={500} color="red">
                  ₹{(selectedVoucher.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Box>
              <Box>
                <Text size="sm" color="dimmed">Total Credit</Text>
                <Text weight={500} color="green">
                  ₹{(selectedVoucher.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Box>
            </SimpleGrid>
            
            <Box>
              <Text size="sm" color="dimmed">Narration</Text>
              <Paper p="sm" withBorder bg="gray.0">
                <Text size="sm">{selectedVoucher.narration || 'No narration'}</Text>
              </Paper>
            </Box>
            
            <Divider />
            
            <Group position="right">
              <Button
                variant="light"
                onClick={() => navigate(`/accounting/vouchers/view/${selectedVoucher._id}`)}
              >
                Full Details
              </Button>
              <Button
                onClick={() => setViewModalOpened(false)}
              >
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default VoucherList;