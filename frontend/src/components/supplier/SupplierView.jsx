import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Paper,
  Title,
  Group,
  Button,
  Text,
  Badge,
  Tabs,
  Grid,
  Card,
  Table,
  Box,
  Stack,
  ActionIcon,
  Modal,
  Image,
  Loader,
  Center,
  SimpleGrid
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconBrandWhatsapp,
  IconFileExport,
  IconPrinter,
  IconPlus,
  IconShoppingCart,
  IconCreditCard,
  IconFileText,
  IconUsers
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { supplierAPI, voucherAPI, stockAPI } from '../../services/api';

const SupplierView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [statistics, setStatistics] = useState({
    totalPurchases: 0,
    totalPayments: 0,
    outstandingBalance: 0,
    transactionCount: 0
  });
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchSupplier();
    fetchTransactions();
    fetchPurchases();
  }, [id]);

  useEffect(() => {
    if (transactions.length > 0 || purchases.length > 0) {
      calculateStatistics();
    }
  }, [transactions, purchases]);

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const response = await supplierAPI.getById(id);
      setSupplier(response.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch supplier details',
        color: 'red'
      });
      navigate('/suppliers');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await voucherAPI.getAll({
        partyType: 'supplier',
        partyId: id,
        ...dateFilter
      });
      setTransactions(response.data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await stockAPI.getTransactions({
        supplierId: id,
        type: 'in',
        ...dateFilter
      });
      setPurchases(response.data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    }
  };

  const calculateStatistics = () => {
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalPayments = transactions
      .filter(t => t.voucherType === 'payment')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const outstandingBalance = totalPurchases - totalPayments;
    const transactionCount = transactions.length + purchases.length;

    setStatistics({
      totalPurchases,
      totalPayments,
      outstandingBalance,
      transactionCount
    });
  };

  const handleExport = () => {
    try {
      const exportData = {
        supplier: {
          'Supplier ID': supplier.supplierId,
          'Name': supplier.name,
          'Phone': supplier.phone,
          'Email': supplier.email || '-',
          'Address': supplier.address || '-',
          'State': supplier.state || '-',
          'District': supplier.district || '-',
          'GST Number': supplier.gstNumber || '-',
          'PAN Number': supplier.panNumber || '-'
        },
        statistics: {
          'Total Purchases': `₹${statistics.totalPurchases.toFixed(2)}`,
          'Total Payments': `₹${statistics.totalPayments.toFixed(2)}`,
          'Outstanding Balance': `₹${statistics.outstandingBalance.toFixed(2)}`,
          'Total Transactions': statistics.transactionCount
        },
        transactions: transactions.map(t => ({
          'Date': dayjs(t.date).format('DD-MM-YYYY'),
          'Voucher No': t.voucherNumber,
          'Type': t.voucherType,
          'Amount': `₹${t.amount?.toFixed(2)}`,
          'Description': t.description || '-'
        })),
        purchases: purchases.map(p => ({
          'Date': dayjs(p.date).format('DD-MM-YYYY'),
          'Item': p.itemName,
          'Quantity': p.quantity,
          'Rate': `₹${p.rate?.toFixed(2)}`,
          'Total': `₹${p.totalAmount?.toFixed(2)}`
        }))
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supplier_${supplier.supplierId}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);

      notifications.show({
        title: 'Success',
        message: 'Exported successfully',
        color: 'green'
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to export data',
        color: 'red'
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const phone = supplier.phone.replace(/[^0-9]/g, '');
    const text = `Hello ${supplier.name}, your current outstanding balance is ₹${statistics.outstandingBalance.toFixed(2)}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading || !supplier) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Box p="md">
      <Paper p="md" mb="md">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>Supplier Details</Title>
            <Text c="dimmed" size="sm">View details for {supplier.name}</Text>
          </div>
          <Group>
            <Button
              variant="default"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/suppliers')}
            >
              Back
            </Button>
            <Button
              leftSection={<IconEdit size={16} />}
              onClick={() => navigate(`/suppliers/edit/${id}`)}
            >
              Edit
            </Button>
          </Group>
        </Group>

        <Group mb="md">
          <Button
            variant="light"
            color="green"
            leftSection={<IconBrandWhatsapp size={16} />}
            onClick={handleWhatsApp}
          >
            Send WhatsApp
          </Button>
          <Button
            variant="light"
            leftSection={<IconFileExport size={16} />}
            onClick={handleExport}
          >
            Export Data
          </Button>
          <Button
            variant="light"
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate(`/vouchers/add?supplier=${id}`)}
          >
            Add Transaction
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="md">
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="blue">
                <IconShoppingCart size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Purchases</Text>
                <Text size="xl" fw={700}>₹{statistics.totalPurchases.toFixed(2)}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="green">
                <IconCreditCard size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Payments</Text>
                <Text size="xl" fw={700}>₹{statistics.totalPayments.toFixed(2)}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="orange">
                <IconFileText size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Outstanding Balance</Text>
                <Text size="xl" fw={700}>₹{Math.abs(statistics.outstandingBalance).toFixed(2)}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group>
              <ActionIcon size="lg" variant="light" color="violet">
                <IconUsers size={20} />
              </ActionIcon>
              <div>
                <Text size="xs" c="dimmed">Total Transactions</Text>
                <Text size="xl" fw={700}>{statistics.transactionCount}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="transactions">Transactions</Tabs.Tab>
            <Tabs.Tab value="purchases">Purchase History</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder>
                  <Title order={5} mb="md">Basic Information</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={500}>Supplier ID:</Text>
                      <Text>{supplier.supplierId}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>Name:</Text>
                      <Text>{supplier.name}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>Phone:</Text>
                      <Text>{supplier.phone}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>Email:</Text>
                      <Text>{supplier.email || '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>Opening Balance:</Text>
                      <Text>₹{supplier.openingBalance?.toFixed(2) || '0.00'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>Status:</Text>
                      <Badge color={supplier.active ? 'green' : 'red'}>
                        {supplier.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder>
                  <Title order={5} mb="md">Address Information</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={500}>Address:</Text>
                      <Text>{supplier.address || '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>State:</Text>
                      <Text>{supplier.state || '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>District:</Text>
                      <Text>{supplier.district || '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>PIN Code:</Text>
                      <Text>{supplier.pincode || '-'}</Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder>
                  <Title order={5} mb="md">Tax Information</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={500}>GST Number:</Text>
                      <Text>{supplier.gstNumber || '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>PAN Number:</Text>
                      <Text>{supplier.panNumber || '-'}</Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder>
                  <Title order={5} mb="md">System Information</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text fw={500}>Created At:</Text>
                      <Text>{supplier.createdAt ? dayjs(supplier.createdAt).format('DD-MM-YYYY HH:mm') : '-'}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={500}>Last Updated:</Text>
                      <Text>{supplier.updatedAt ? dayjs(supplier.updatedAt).format('DD-MM-YYYY HH:mm') : '-'}</Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="transactions" pt="md">
            <Card withBorder>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Voucher No</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Debit</Table.Th>
                    <Table.Th>Credit</Table.Th>
                    <Table.Th>Balance</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {transactions.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Center>
                          <Text c="dimmed">No transactions found</Text>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    transactions.map((transaction, index) => {
                      const runningBalance = transactions
                        .slice(0, index + 1)
                        .reduce((sum, t) => {
                          if (t.voucherType === 'receipt') return sum + (t.amount || 0);
                          if (t.voucherType === 'payment') return sum - (t.amount || 0);
                          return sum;
                        }, supplier.openingBalance || 0);

                      return (
                        <Table.Tr key={transaction._id}>
                          <Table.Td>{dayjs(transaction.date).format('DD-MM-YYYY')}</Table.Td>
                          <Table.Td>{transaction.voucherNumber}</Table.Td>
                          <Table.Td>
                            <Badge color={transaction.voucherType === 'receipt' ? 'red' : 'green'}>
                              {transaction.voucherType}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{transaction.description || '-'}</Table.Td>
                          <Table.Td>{transaction.voucherType === 'receipt' ? `₹${transaction.amount?.toFixed(2)}` : '-'}</Table.Td>
                          <Table.Td>{transaction.voucherType === 'payment' ? `₹${transaction.amount?.toFixed(2)}` : '-'}</Table.Td>
                          <Table.Td fw={700}>₹{runningBalance.toFixed(2)}</Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="purchases" pt="md">
            <Card withBorder>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Item</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Unit</Table.Th>
                    <Table.Th>Rate</Table.Th>
                    <Table.Th>Total Amount</Table.Th>
                    <Table.Th>Remarks</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {purchases.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Center>
                          <Text c="dimmed">No purchase history found</Text>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    purchases.map((purchase) => (
                      <Table.Tr key={purchase._id}>
                        <Table.Td>{dayjs(purchase.date).format('DD-MM-YYYY')}</Table.Td>
                        <Table.Td>{purchase.itemName || '-'}</Table.Td>
                        <Table.Td>{purchase.quantity || 0}</Table.Td>
                        <Table.Td>{purchase.unit || '-'}</Table.Td>
                        <Table.Td>₹{purchase.rate?.toFixed(2) || '0.00'}</Table.Td>
                        <Table.Td>₹{purchase.totalAmount?.toFixed(2) || '0.00'}</Table.Td>
                        <Table.Td>{purchase.remarks || '-'}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <Modal
        opened={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        title={selectedDocument?.title}
        size="lg"
      >
        {selectedDocument && (
          <Stack>
            <Image src={selectedDocument.data} alt={selectedDocument.title} />
            <Group>
              <Button
                component="a"
                href={selectedDocument.data}
                download={`${selectedDocument.title}.jpg`}
              >
                Download
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
};

export default SupplierView;
