import { useState, useEffect } from 'react';
import {
  Container,
  Card,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Grid,
  Box,
  Button,
  Select,
  Radio,
  Checkbox,
  Slider,
  Table,
  ScrollArea,
  Badge,
  NumberInput,
  Loader,
  Center,
  Tabs,
  ActionIcon,
  Menu,
  Pagination,
  Tooltip,
  Alert,
  Modal
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBuildingBank,
  IconCash,
  IconUsers,
  IconCheck,
  IconX,
  IconDotsVertical,
  IconEye,
  IconTrash,
  IconDownload,
  IconRefresh,
  IconFilter,
  IconAlertCircle,
  IconCheckbox,
  IconSquare
} from '@tabler/icons-react';
import { bankTransferAPI } from '../../services/api';
import { message } from '../../utils/toast';

const BankTransferManagement = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('transfer');

  // Form state
  const [transferBasis, setTransferBasis] = useState('As on Date Balance');
  const [asOnDate, setAsOnDate] = useState(new Date());
  const [applyDate, setApplyDate] = useState(new Date());
  const [collectionCenter, setCollectionCenter] = useState('all');
  const [bank, setBank] = useState('all');
  const [roundDownAmount, setRoundDownAmount] = useState(10);
  const [dueByList, setDueByList] = useState(false);

  // Data state
  const [transferDetails, setTransferDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState({
    totalProducers: 0,
    totalNetPayable: 0,
    totalTransferAmount: 0,
    totalApproved: 0,
    negativeBalances: 0
  });

  // Dropdown data
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [banks, setBanks] = useState([]);

  // Transfer log state
  const [transferLogs, setTransferLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logPagination, setLogPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 10
  });
  const [logFilters, setLogFilters] = useState({
    status: '',
    fromDate: null,
    toDate: null
  });

  // View modal
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Load dropdown data
  useEffect(() => {
    loadDropdownData();
  }, []);

  // Load transfer logs when tab changes
  useEffect(() => {
    if (activeTab === 'log') {
      loadTransferLogs();
    }
  }, [activeTab, logPagination.page, logFilters]);

  const loadDropdownData = async () => {
    try {
      const [centersRes, banksRes] = await Promise.all([
        bankTransferAPI.getCollectionCenters(),
        bankTransferAPI.getBanks()
      ]);

      if (centersRes.success) {
        setCollectionCenters([
          { value: 'all', label: 'All' },
          ...centersRes.data.map(c => ({ value: c._id, label: c.name }))
        ]);
      }

      if (banksRes.success) {
        setBanks([
          { value: 'all', label: 'All' },
          ...banksRes.data.map(b => ({ value: b.name, label: `${b.name} (${b.count})` }))
        ]);
      }
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const loadTransferLogs = async () => {
    setLogLoading(true);
    try {
      const params = {
        page: logPagination.page,
        limit: logPagination.limit,
        ...logFilters,
        fromDate: logFilters.fromDate ? logFilters.fromDate.toISOString() : undefined,
        toDate: logFilters.toDate ? logFilters.toDate.toISOString() : undefined
      };

      const response = await bankTransferAPI.getAll(params);
      if (response.success) {
        setTransferLogs(response.data);
        setLogPagination(prev => ({
          ...prev,
          ...response.pagination
        }));
      }
    } catch (error) {
      message.error(error.message || 'Error loading transfer logs');
    } finally {
      setLogLoading(false);
    }
  };

  // Retrieve balances
  const handleRetrieve = async () => {
    setRetrieving(true);
    try {
      const response = await bankTransferAPI.retrieve({
        transferBasis,
        asOnDate: asOnDate.toISOString(),
        applyDate: applyDate.toISOString(),
        collectionCenter,
        bank,
        roundDownAmount,
        dueByList
      });

      if (response.success) {
        setTransferDetails(response.data);
        setSummary(response.summary);
        message.success(response.message);
      }
    } catch (error) {
      message.error(error.message || 'Error retrieving balances');
    } finally {
      setRetrieving(false);
    }
  };

  // Apply bank transfer
  const handleApplyTransfer = async () => {
    const approvedCount = transferDetails.filter(d => d.approved && d.transferAmount > 0).length;

    if (approvedCount === 0) {
      message.warning('No approved transfers to process');
      return;
    }

    setApplying(true);
    try {
      const response = await bankTransferAPI.apply({
        transferBasis,
        asOnDate: asOnDate.toISOString(),
        applyDate: applyDate.toISOString(),
        collectionCenter,
        collectionCenterName: collectionCenters.find(c => c.value === collectionCenter)?.label || 'All',
        bank,
        bankName: banks.find(b => b.value === bank)?.label || 'All',
        roundDownAmount,
        dueByList,
        transferDetails
      });

      if (response.success) {
        message.success(response.message);
        setTransferDetails([]);
        setSummary({
          totalProducers: 0,
          totalNetPayable: 0,
          totalTransferAmount: 0,
          totalApproved: 0,
          negativeBalances: 0
        });
        // Switch to log tab
        setActiveTab('log');
      }
    } catch (error) {
      message.error(error.message || 'Error applying bank transfer');
    } finally {
      setApplying(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setTransferDetails([]);
    setSummary({
      totalProducers: 0,
      totalNetPayable: 0,
      totalTransferAmount: 0,
      totalApproved: 0,
      negativeBalances: 0
    });
    setTransferBasis('As on Date Balance');
    setAsOnDate(new Date());
    setApplyDate(new Date());
    setCollectionCenter('all');
    setBank('all');
    setRoundDownAmount(10);
    setDueByList(false);
  };

  // Toggle individual approval
  const handleToggleApproval = (index) => {
    setTransferDetails(prev => {
      const updated = [...prev];
      updated[index].approved = !updated[index].approved;
      return updated;
    });
    updateSummary();
  };

  // Toggle all approvals
  const handleSelectAll = () => {
    const allApproved = transferDetails.every(d => d.approved || d.transferAmount <= 0);
    setTransferDetails(prev =>
      prev.map(d => ({
        ...d,
        approved: d.transferAmount > 0 ? !allApproved : false
      }))
    );
    updateSummary();
  };

  // Handle amount change
  const handleAmountChange = (index, value) => {
    setTransferDetails(prev => {
      const updated = [...prev];
      updated[index].transferAmount = value || 0;
      return updated;
    });
  };

  // Update summary
  const updateSummary = () => {
    setSummary({
      totalProducers: transferDetails.length,
      totalNetPayable: transferDetails.reduce((sum, d) => sum + d.netPayable, 0),
      totalTransferAmount: transferDetails.filter(d => d.approved).reduce((sum, d) => sum + d.transferAmount, 0),
      totalApproved: transferDetails.filter(d => d.approved).length,
      negativeBalances: transferDetails.filter(d => d.netPayable < 0).length
    });
  };

  // View transfer details
  const handleViewTransfer = async (transfer) => {
    try {
      const response = await bankTransferAPI.getById(transfer._id);
      if (response.success) {
        setSelectedTransfer(response.data);
        setViewModalOpen(true);
      }
    } catch (error) {
      message.error('Error loading transfer details');
    }
  };

  // Cancel transfer from log
  const handleCancelTransfer = async (transfer) => {
    if (!confirm('Are you sure you want to cancel this transfer?')) return;

    try {
      const response = await bankTransferAPI.cancel(transfer._id);
      if (response.success) {
        message.success('Transfer cancelled successfully');
        loadTransferLogs();
      }
    } catch (error) {
      message.error(error.message || 'Error cancelling transfer');
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'gray',
      'Retrieved': 'blue',
      'Applied': 'yellow',
      'Completed': 'green',
      'Cancelled': 'red'
    };
    return colors[status] || 'gray';
  };

  // Recalculate based on round down change
  useEffect(() => {
    if (transferDetails.length > 0) {
      setTransferDetails(prev =>
        prev.map(d => ({
          ...d,
          transferAmount: d.netPayable > 0
            ? Math.floor(d.netPayable / roundDownAmount) * roundDownAmount
            : 0
        }))
      );
    }
  }, [roundDownAmount]);

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Box>
            <Title order={2}>Bank Transfer</Title>
            <Text c="dimmed" size="sm">Transfer funds to producer bank accounts</Text>
          </Box>
        </Group>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="transfer" leftSection={<IconBuildingBank size={16} />}>
              Bank Transfer
            </Tabs.Tab>
            <Tabs.Tab value="log" leftSection={<IconCash size={16} />}>
              Transfer Log
            </Tabs.Tab>
          </Tabs.List>

          {/* Bank Transfer Tab */}
          <Tabs.Panel value="transfer" pt="md">
            <Stack gap="md">
              {/* Form Section */}
              <Card withBorder p="md">
                <Stack gap="md">
                  {/* Transfer Basis */}
                  <Box>
                    <Text fw={500} mb="xs">Bank Transfer Based On:</Text>
                    <Radio.Group value={transferBasis} onChange={setTransferBasis}>
                      <Group>
                        <Radio value="As on Date Balance" label="As on Date Balance" />
                        <Radio value="Last Processed Period" label="Last Processed Period" />
                      </Group>
                    </Radio.Group>
                  </Box>

                  {/* Date Fields */}
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="As on Date Balance"
                        placeholder="Select date"
                        value={asOnDate}
                        onChange={setAsOnDate}
                        maxDate={new Date()}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <DatePickerInput
                        label="Apply Date"
                        placeholder="Select date"
                        value={applyDate}
                        onChange={setApplyDate}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Select
                        label="Collection Center"
                        placeholder="Select center"
                        data={collectionCenters}
                        value={collectionCenter}
                        onChange={setCollectionCenter}
                        searchable
                        clearable
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Select
                        label="Bank"
                        placeholder="Select bank"
                        data={banks}
                        value={bank}
                        onChange={setBank}
                        searchable
                        clearable
                      />
                    </Grid.Col>
                  </Grid>

                  {/* Slider and Checkbox */}
                  <Grid align="flex-end">
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <Box>
                        <Group justify="space-between" mb="xs">
                          <Text fw={500} size="sm">Nearest Round Down Transfer Amount (INR)</Text>
                          <Badge size="lg" variant="filled">{roundDownAmount}</Badge>
                        </Group>
                        <Slider
                          value={roundDownAmount}
                          onChange={setRoundDownAmount}
                          min={1}
                          max={100}
                          step={1}
                          marks={[
                            { value: 1, label: '1' },
                            { value: 10, label: '10' },
                            { value: 50, label: '50' },
                            { value: 100, label: '100' }
                          ]}
                        />
                      </Box>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Checkbox
                        label="Due By List"
                        description="Show only producers with positive balance"
                        checked={dueByList}
                        onChange={(e) => setDueByList(e.currentTarget.checked)}
                      />
                    </Grid.Col>
                  </Grid>

                  {/* Action Buttons */}
                  <Group justify="center" mt="md">
                    <Button
                      color="green"
                      leftSection={<IconRefresh size={16} />}
                      onClick={handleRetrieve}
                      loading={retrieving}
                    >
                      Retrieve
                    </Button>
                    <Button
                      color="blue"
                      leftSection={<IconBuildingBank size={16} />}
                      onClick={handleApplyTransfer}
                      loading={applying}
                      disabled={transferDetails.length === 0}
                    >
                      Apply Bank Transfer
                    </Button>
                    <Button
                      color="gray"
                      variant="outline"
                      leftSection={<IconX size={16} />}
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </Group>
                </Stack>
              </Card>

              {/* Transfer Details Table */}
              {transferDetails.length > 0 && (
                <Card withBorder p={0}>
                  {/* Header with light red background */}
                  <Box
                    p="md"
                    style={{
                      background: 'var(--mantine-color-red-1)',
                      borderBottom: '1px solid var(--mantine-color-red-3)'
                    }}
                  >
                    <Group justify="space-between">
                      <Box>
                        <Text fw={600} c="red.8">Bank Transfer - Details</Text>
                        <Text size="sm" c="red.7">
                          Bank Transfer Apply on {formatDate(applyDate)} [ Based on {transferBasis} ]
                        </Text>
                      </Box>
                      <Group gap="xs">
                        <Badge color="blue" size="lg">
                          Total: {summary.totalProducers}
                        </Badge>
                        <Badge color="green" size="lg">
                          Approved: {summary.totalApproved}
                        </Badge>
                        <Badge color="yellow" size="lg">
                          Amount: {formatCurrency(summary.totalTransferAmount)}
                        </Badge>
                      </Group>
                    </Group>
                  </Box>

                  {/* Checkbox buttons on top */}
                  <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                    <Group gap="xs">
                      <Tooltip label="Select All / Deselect All">
                        <Button
                          variant="light"
                          size="xs"
                          leftSection={
                            transferDetails.every(d => d.approved || d.transferAmount <= 0)
                              ? <IconCheckbox size={14} />
                              : <IconSquare size={14} />
                          }
                          onClick={handleSelectAll}
                        >
                          {transferDetails.every(d => d.approved || d.transferAmount <= 0)
                            ? 'Deselect All'
                            : 'Select All'}
                        </Button>
                      </Tooltip>
                      <Tooltip label="Select only positive balances">
                        <Button
                          variant="light"
                          size="xs"
                          color="green"
                          onClick={() => {
                            setTransferDetails(prev =>
                              prev.map(d => ({
                                ...d,
                                approved: d.netPayable > 0 && d.transferAmount > 0
                              }))
                            );
                          }}
                        >
                          Select Positive
                        </Button>
                      </Tooltip>
                      <Tooltip label="Clear all selections">
                        <Button
                          variant="light"
                          size="xs"
                          color="red"
                          onClick={() => {
                            setTransferDetails(prev =>
                              prev.map(d => ({ ...d, approved: false }))
                            );
                          }}
                        >
                          Clear Selection
                        </Button>
                      </Tooltip>
                    </Group>
                  </Box>

                  <ScrollArea>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 60 }}>Sl No</Table.Th>
                          <Table.Th>Producer ID</Table.Th>
                          <Table.Th>Producer Name</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Net Payable</Table.Th>
                          <Table.Th style={{ width: 150 }}>Amount</Table.Th>
                          <Table.Th style={{ width: 80, textAlign: 'center' }}>Approve</Table.Th>
                          <Table.Th>Bank Details</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {transferDetails.map((detail, index) => (
                          <Table.Tr key={detail.farmerId || index}>
                            <Table.Td>{index + 1}</Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={500}>{detail.producerId}</Text>
                            </Table.Td>
                            <Table.Td>{detail.producerName}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Text
                                size="sm"
                                fw={500}
                                c={detail.netPayable < 0 ? 'red' : 'inherit'}
                              >
                                {formatCurrency(detail.netPayable)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <NumberInput
                                size="xs"
                                value={detail.transferAmount}
                                onChange={(value) => handleAmountChange(index, value)}
                                min={0}
                                max={detail.netPayable > 0 ? detail.netPayable : 0}
                                step={roundDownAmount}
                                hideControls
                                disabled={detail.netPayable <= 0}
                                styles={{
                                  input: {
                                    textAlign: 'right'
                                  }
                                }}
                              />
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Checkbox
                                checked={detail.approved}
                                onChange={() => handleToggleApproval(index)}
                                disabled={detail.transferAmount <= 0}
                              />
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {detail.bankDetails?.accountNumber || '-'} / {detail.bankDetails?.bankCode || detail.bankDetails?.ifscCode || '-'}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>

                  {/* Summary Footer */}
                  <Box p="md" style={{ borderTop: '2px solid var(--mantine-color-gray-3)' }}>
                    <Grid>
                      <Grid.Col span={3}>
                        <Text size="sm" c="dimmed">Total Producers</Text>
                        <Text size="lg" fw={600}>{summary.totalProducers}</Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text size="sm" c="dimmed">Total Net Payable</Text>
                        <Text size="lg" fw={600}>{formatCurrency(summary.totalNetPayable)}</Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text size="sm" c="dimmed">Total Approved</Text>
                        <Text size="lg" fw={600} c="green">{summary.totalApproved}</Text>
                      </Grid.Col>
                      <Grid.Col span={3}>
                        <Text size="sm" c="dimmed">Total Transfer Amount</Text>
                        <Text size="lg" fw={700} c="blue">{formatCurrency(summary.totalTransferAmount)}</Text>
                      </Grid.Col>
                    </Grid>
                  </Box>
                </Card>
              )}

              {/* Empty State */}
              {transferDetails.length === 0 && !retrieving && (
                <Card withBorder p="xl">
                  <Center>
                    <Stack align="center" gap="md">
                      <IconBuildingBank size={48} color="gray" />
                      <Text c="dimmed" ta="center">
                        Click "Retrieve" to load producer balances for bank transfer
                      </Text>
                    </Stack>
                  </Center>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Transfer Log Tab */}
          <Tabs.Panel value="log" pt="md">
            <Stack gap="md">
              {/* Filters */}
              <Card withBorder p="md">
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <IconFilter size={18} />
                    <Text fw={600}>Filters</Text>
                  </Group>
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => setLogFilters({ status: '', fromDate: null, toDate: null })}
                  >
                    Clear
                  </Button>
                </Group>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      placeholder="Status"
                      data={[
                        { value: 'Draft', label: 'Draft' },
                        { value: 'Applied', label: 'Applied' },
                        { value: 'Completed', label: 'Completed' },
                        { value: 'Cancelled', label: 'Cancelled' }
                      ]}
                      value={logFilters.status}
                      onChange={(value) => setLogFilters(prev => ({ ...prev, status: value }))}
                      clearable
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DatePickerInput
                      placeholder="From Date"
                      value={logFilters.fromDate}
                      onChange={(value) => setLogFilters(prev => ({ ...prev, fromDate: value }))}
                      clearable
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DatePickerInput
                      placeholder="To Date"
                      value={logFilters.toDate}
                      onChange={(value) => setLogFilters(prev => ({ ...prev, toDate: value }))}
                      clearable
                    />
                  </Grid.Col>
                </Grid>
              </Card>

              {/* Transfer Log Table */}
              <Card withBorder>
                {logLoading ? (
                  <Center p="xl">
                    <Loader />
                  </Center>
                ) : transferLogs.length === 0 ? (
                  <Center p="xl">
                    <Stack align="center" gap="md">
                      <IconCash size={48} color="gray" />
                      <Text c="dimmed">No transfer logs found</Text>
                    </Stack>
                  </Center>
                ) : (
                  <>
                    <ScrollArea>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Transfer No</Table.Th>
                            <Table.Th>Apply Date</Table.Th>
                            <Table.Th>As On Date</Table.Th>
                            <Table.Th>Transfer Basis</Table.Th>
                            <Table.Th>Collection Center</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Producers</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th></Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {transferLogs.map((log) => (
                            <Table.Tr key={log._id}>
                              <Table.Td>
                                <Text size="sm" fw={500}>{log.transferNumber}</Text>
                              </Table.Td>
                              <Table.Td>{formatDate(log.applyDate)}</Table.Td>
                              <Table.Td>{formatDate(log.asOnDate)}</Table.Td>
                              <Table.Td>
                                <Text size="xs">{log.transferBasis}</Text>
                              </Table.Td>
                              <Table.Td>{log.collectionCenterName || 'All'}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Badge variant="light">{log.totalApproved}</Badge>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={500}>
                                  {formatCurrency(log.totalTransferAmount)}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge color={getStatusColor(log.status)}>
                                  {log.status}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Menu position="bottom-end">
                                  <Menu.Target>
                                    <ActionIcon variant="subtle">
                                      <IconDotsVertical size={16} />
                                    </ActionIcon>
                                  </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Item
                                      leftSection={<IconEye size={14} />}
                                      onClick={() => handleViewTransfer(log)}
                                    >
                                      View Details
                                    </Menu.Item>
                                    {log.status === 'Applied' && (
                                      <>
                                        <Menu.Item
                                          leftSection={<IconCheck size={14} />}
                                          color="green"
                                          onClick={async () => {
                                            try {
                                              await bankTransferAPI.complete(log._id);
                                              message.success('Transfer marked as completed');
                                              loadTransferLogs();
                                            } catch (error) {
                                              message.error(error.message);
                                            }
                                          }}
                                        >
                                          Mark Completed
                                        </Menu.Item>
                                        <Menu.Item
                                          leftSection={<IconX size={14} />}
                                          color="red"
                                          onClick={() => handleCancelTransfer(log)}
                                        >
                                          Cancel Transfer
                                        </Menu.Item>
                                      </>
                                    )}
                                    <Menu.Item
                                      leftSection={<IconDownload size={14} />}
                                    >
                                      Export
                                    </Menu.Item>
                                  </Menu.Dropdown>
                                </Menu>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>

                    {logPagination.pages > 1 && (
                      <Group justify="center" p="md">
                        <Pagination
                          total={logPagination.pages}
                          value={logPagination.page}
                          onChange={(page) => setLogPagination(prev => ({ ...prev, page }))}
                        />
                      </Group>
                    )}
                  </>
                )}
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* View Modal */}
        <Modal
          opened={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={
            <Group>
              <IconBuildingBank size={20} />
              <Text fw={600}>Transfer Details - {selectedTransfer?.transferNumber}</Text>
            </Group>
          }
          size="xl"
        >
          {selectedTransfer && (
            <Stack gap="md">
              {/* Transfer Info */}
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Apply Date</Text>
                  <Text fw={500}>{formatDate(selectedTransfer.applyDate)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">As On Date</Text>
                  <Text fw={500}>{formatDate(selectedTransfer.asOnDate)}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Transfer Basis</Text>
                  <Text fw={500}>{selectedTransfer.transferBasis}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Status</Text>
                  <Badge color={getStatusColor(selectedTransfer.status)}>
                    {selectedTransfer.status}
                  </Badge>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Collection Center</Text>
                  <Text fw={500}>{selectedTransfer.collectionCenterName || 'All'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Bank</Text>
                  <Text fw={500}>{selectedTransfer.bankName || 'All'}</Text>
                </Grid.Col>
              </Grid>

              {/* Summary */}
              <Paper withBorder p="md" bg="blue.0">
                <Grid>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Total Producers</Text>
                    <Text size="lg" fw={600}>{selectedTransfer.totalApproved}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Total Net Payable</Text>
                    <Text size="lg" fw={600}>{formatCurrency(selectedTransfer.totalNetPayable)}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Total Transfer Amount</Text>
                    <Text size="lg" fw={700} c="blue">{formatCurrency(selectedTransfer.totalTransferAmount)}</Text>
                  </Grid.Col>
                </Grid>
              </Paper>

              {/* Transfer Details Table */}
              <ScrollArea h={300}>
                <Table striped highlightOnHover size="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Sl No</Table.Th>
                      <Table.Th>Producer ID</Table.Th>
                      <Table.Th>Producer Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Net Payable</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Transfer Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {selectedTransfer.transferDetails?.map((detail, index) => (
                      <Table.Tr key={detail._id || index}>
                        <Table.Td>{index + 1}</Table.Td>
                        <Table.Td>{detail.producerId}</Table.Td>
                        <Table.Td>{detail.producerName}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text c={detail.netPayable < 0 ? 'red' : 'inherit'}>
                            {formatCurrency(detail.netPayable)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatCurrency(detail.transferAmount)}
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="sm"
                            color={
                              detail.transferStatus === 'Transferred' ? 'green' :
                              detail.transferStatus === 'Failed' ? 'red' :
                              detail.transferStatus === 'Cancelled' ? 'gray' : 'yellow'
                            }
                          >
                            {detail.transferStatus}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
};

export default BankTransferManagement;
