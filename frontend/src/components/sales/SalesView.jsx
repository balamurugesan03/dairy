// import { useState, useEffect, useRef } from 'react';
// import { message } from '../../utils/toast';
// import { useNavigate, useParams } from 'react-router-dom';
// import { useReactToPrint } from 'react-to-print';
// import dayjs from 'dayjs';
// import { salesAPI } from '../../services/api';
// import PageHeader from '../common/PageHeader';
// import LoadingSpinner from '../common/LoadingSpinner';


// const SalesView = () => {
//   const navigate = useNavigate();
//   const { id } = useParams();
//   const printRef = useRef();
//   const [sale, setSale] = useState(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     fetchSale();
//   }, [id]);

//   const fetchSale = async () => {
//     setLoading(true);
//     try {
//       const response = await salesAPI.getById(id);
//       setSale(response.data);
//     } catch (error) {
//       message.error(error.message || 'Failed to fetch sale details');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handlePrint = useReactToPrint({
//     content: () => printRef.current,
//   });

//   if (loading) {
//     return <LoadingSpinner />;
//   }

//   if (!sale) {
//     return null;
//   }

//   const itemColumns = [
//     {
//       title: '#',
//       key: 'index',
//       width: 50,
//       render: (_, __, index) => index + 1
//     },
//     {
//       title: 'Item Name',
//       dataIndex: 'itemName',
//       key: 'itemName'
//     },
//     {
//       title: 'Quantity',
//       dataIndex: 'quantity',
//       key: 'quantity'
//     },
//     {
//       title: 'Rate',
//       dataIndex: 'rate',
//       key: 'rate',
//       render: (rate) => `₹${rate?.toFixed(2)}`
//     },
//     {
//       title: 'Amount',
//       dataIndex: 'amount',
//       key: 'amount',
//       render: (amount) => `₹${amount?.toFixed(2)}`
//     },
//     {
//       title: 'GST Amount',
//       dataIndex: 'gstAmount',
//       key: 'gstAmount',
//       render: (gst) => `₹${gst?.toFixed(2)}`
//     },
//     {
//       title: 'Total',
//       key: 'total',
//       render: (_, record) => `₹${(record.amount + record.gstAmount)?.toFixed(2)}`
//     }
//   ];

//   return (
//     <div>
//       <PageHeader
//         title="Sale Details"
//         subtitle={`Bill No: ${sale.billNumber}`}
//         extra={[
//           <Button
//             key="back"
//             icon={<ArrowLeftOutlined />}
//             onClick={() => navigate('/sales')}
//           >
//             Back
//           </Button>,
//           <Button
//             key="print"
//             type="primary"
//             icon={<PrinterOutlined />}
//             onClick={handlePrint}
//           >
//             Print
//           </Button>
//         ]}
//       />

//       <div ref={printRef}>
//         <Card title="Bill Information">
//           <Descriptions bordered column={2}>
//             <Descriptions.Item label="Bill Number">
//               {sale.billNumber}
//             </Descriptions.Item>
//             <Descriptions.Item label="Bill Date">
//               {dayjs(sale.billDate).format('DD-MM-YYYY HH:mm')}
//             </Descriptions.Item>
//             <Descriptions.Item label="Customer Type">
//               <Tag color={sale.customerType === 'Farmer' ? 'blue' : 'green'}>
//                 {sale.customerType}
//               </Tag>
//             </Descriptions.Item>
//             <Descriptions.Item label="Customer Name">
//               {sale.customerName}
//             </Descriptions.Item>
//             <Descriptions.Item label="Customer Phone">
//               {sale.customerPhone}
//             </Descriptions.Item>
//             <Descriptions.Item label="Status">
//               <Tag color={
//                 sale.status === 'Paid' ? 'success' :
//                 sale.status === 'Partial' ? 'warning' : 'error'
//               }>
//                 {sale.status}
//               </Tag>
//             </Descriptions.Item>
//           </Descriptions>
//         </Card>

//         <Card title="Items" style={{ marginTop: 16 }}>
//           <Table
//             columns={itemColumns}
//             dataSource={sale.items}
//             rowKey={(record, index) => index}
//             pagination={false}
//           />

//           <Divider />

//           <div style={{ textAlign: 'right' }}>
//             <Space direction="vertical" size="small" style={{ width: 300 }}>
//               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                 <Text strong>Subtotal:</Text>
//                 <Text>₹{sale.subtotal?.toFixed(2)}</Text>
//               </div>
//               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                 <Text strong>Total GST:</Text>
//                 <Text>₹{sale.totalGst?.toFixed(2)}</Text>
//               </div>
//               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                 <Title level={5}>Grand Total:</Title>
//                 <Title level={5}>₹{sale.grandTotal?.toFixed(2)}</Title>
//               </div>
//               {sale.oldBalance > 0 && (
//                 <>
//                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                     <Text>Old Balance:</Text>
//                     <Text>₹{sale.oldBalance?.toFixed(2)}</Text>
//                   </div>
//                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
//                     <Title level={5}>Total Due:</Title>
//                     <Title level={5}>₹{sale.totalDue?.toFixed(2)}</Title>
//                   </div>
//                 </>
//               )}
//             </Space>
//           </div>
//         </Card>

//         <Card title="Payment Details" style={{ marginTop: 16 }}>
//           <Descriptions bordered column={2}>
//             <Descriptions.Item label="Payment Mode">
//               {sale.paymentMode}
//             </Descriptions.Item>
//             <Descriptions.Item label="Paid Amount">
//               ₹{sale.paidAmount?.toFixed(2)}
//             </Descriptions.Item>
//             <Descriptions.Item label="Balance Amount">
//               <Text style={{ color: sale.balanceAmount > 0 ? 'red' : 'green' }}>
//                 ₹{sale.balanceAmount?.toFixed(2)}
//               </Text>
//             </Descriptions.Item>
//           </Descriptions>
//         </Card>

//         <Card title="System Information" style={{ marginTop: 16 }}>
//           <Descriptions bordered column={2}>
//             <Descriptions.Item label="Created At">
//               {dayjs(sale.createdAt).format('DD-MM-YYYY HH:mm:ss')}
//             </Descriptions.Item>
//             <Descriptions.Item label="Updated At">
//               {dayjs(sale.updatedAt).format('DD-MM-YYYY HH:mm:ss')}
//             </Descriptions.Item>
//           </Descriptions>
//         </Card>
//       </div>
//     </div>
//   );
// };

// export default SalesView;


import { useState, useEffect, useRef } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  Container,
  Paper,
  Table,
  Group,
  Button,
  Title,
  Text,
  Divider,
  Badge,
  Card,
  Stack,
  Grid,
  SimpleGrid,
  Box,
  Center,
  Space,
  ThemeIcon,
  ActionIcon
} from '@mantine/core';
import {
  IconArrowLeft,
  IconPrinter,
  IconCalendar,
  IconUser,
  IconPhone,
  IconCash,
  IconReceipt2,
  IconClock,
  IconEdit,
  IconCurrencyRupee
} from '@tabler/icons-react';

const SalesView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const printRef = useRef();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSale();
  }, [id]);

  const fetchSale = async () => {
    setLoading(true);
    try {
      const response = await salesAPI.getById(id);
      setSale(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch sale details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  if (loading) {
    return (
      <Container size="lg">
        <Center style={{ height: '60vh' }}>
          <LoadingSpinner />
        </Center>
      </Container>
    );
  }

  if (!sale) {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'green';
      case 'Partial': return 'yellow';
      case 'Pending': return 'red';
      default: return 'gray';
    }
  };

  const getCustomerTypeColor = (type) => {
    switch (type) {
      case 'Farmer': return 'blue';
      case 'Retailer': return 'teal';
      default: return 'gray';
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toFixed(2) || '0.00'}`;
  };

  // Table columns for items
  const itemRows = sale.items?.map((item, index) => (
    <Table.Tr key={index}>
      <Table.Td>{index + 1}</Table.Td>
      <Table.Td>{item.itemName}</Table.Td>
      <Table.Td>{item.quantity}</Table.Td>
      <Table.Td>{formatCurrency(item.rate)}</Table.Td>
      <Table.Td>{formatCurrency(item.amount)}</Table.Td>
      <Table.Td>{formatCurrency(item.gstAmount)}</Table.Td>
      <Table.Td>{formatCurrency(item.amount + item.gstAmount)}</Table.Td>
    </Table.Tr>
  )) || [];

  return (
    <Container size="lg" py="md">
      {/* Header */}
      <Paper shadow="xs" p="md" mb="md" withBorder>
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={2}>Sale Details</Title>
            <Text c="dimmed" size="sm">
              Bill No: {sale.billNumber}
            </Text>
          </div>
          <Group>
            <Button
              variant="outline"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/sales')}
            >
              Back
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrint}
            >
              Print
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Printable Content */}
      <div ref={printRef}>
        {/* Bill Information */}
        <Card withBorder shadow="sm" mb="md">
          <Card.Section withBorder inheritPadding py="sm">
            <Group justify="space-between">
              <Title order={3}>Bill Information</Title>
              <Badge size="lg" color={getStatusColor(sale.status)}>
                {sale.status}
              </Badge>
            </Group>
          </Card.Section>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" size="sm" color="blue">
                  <IconReceipt2 size={14} />
                </ThemeIcon>
                <Text fw={500}>Bill Number:</Text>
                <Text>{sale.billNumber}</Text>
              </Group>
              
              <Group gap="xs">
                <ThemeIcon variant="light" size="sm" color="blue">
                  <IconCalendar size={14} />
                </ThemeIcon>
                <Text fw={500}>Bill Date:</Text>
                <Text>{dayjs(sale.billDate).format('DD-MM-YYYY HH:mm')}</Text>
              </Group>

              <Group gap="xs">
                <ThemeIcon variant="light" size="sm" color="blue">
                  <IconUser size={14} />
                </ThemeIcon>
                <Text fw={500}>Customer Name:</Text>
                <Text>{sale.customerName}</Text>
              </Group>
            </Stack>

            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" size="sm" color="teal">
                  <Badge color={getCustomerTypeColor(sale.customerType)}>
                    {sale.customerType}
                  </Badge>
                </ThemeIcon>
              </Group>

              <Group gap="xs">
                <ThemeIcon variant="light" size="sm" color="blue">
                  <IconPhone size={14} />
                </ThemeIcon>
                <Text fw={500}>Customer Phone:</Text>
                <Text>{sale.customerPhone}</Text>
              </Group>
            </Stack>
          </SimpleGrid>
        </Card>

        {/* Items Table */}
        <Card withBorder shadow="sm" mb="md">
          <Card.Section withBorder inheritPadding py="sm">
            <Title order={3}>Items</Title>
          </Card.Section>

          <Table.ScrollContainer minWidth={800}>
            <Table verticalSpacing="sm" mt="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 50 }}>#</Table.Th>
                  <Table.Th>Item Name</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Rate</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>GST Amount</Table.Th>
                  <Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{itemRows}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Divider my="lg" />

          {/* Totals */}
          <Stack align="flex-end" gap="xs">
            <Group justify="space-between" w={300}>
              <Text fw={500}>Subtotal:</Text>
              <Text>{formatCurrency(sale.subtotal)}</Text>
            </Group>
            
            <Group justify="space-between" w={300}>
              <Text fw={500}>Total GST:</Text>
              <Text>{formatCurrency(sale.totalGst)}</Text>
            </Group>

            <Group justify="space-between" w={300} mt="sm">
              <Title order={4}>Grand Total:</Title>
              <Title order={4}>{formatCurrency(sale.grandTotal)}</Title>
            </Group>

            {sale.oldBalance > 0 && (
              <>
                <Group justify="space-between" w={300}>
                  <Text>Old Balance:</Text>
                  <Text>{formatCurrency(sale.oldBalance)}</Text>
                </Group>
                
                <Group justify="space-between" w={300} mt="sm">
                  <Title order={4}>Total Due:</Title>
                  <Title order={4}>{formatCurrency(sale.totalDue)}</Title>
                </Group>
              </>
            )}
          </Stack>
        </Card>

        {/* Payment Details */}
        <Card withBorder shadow="sm" mb="md">
          <Card.Section withBorder inheritPadding py="sm">
            <Group justify="space-between">
              <Title order={3}>Payment Details</Title>
              <ThemeIcon variant="light" color="blue">
                <IconCash size={20} />
              </ThemeIcon>
            </Group>
          </Card.Section>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="md">
            <Stack gap="xs">
              <Text fw={500}>Payment Mode</Text>
              <Badge variant="light" color="blue" size="lg">
                {sale.paymentMode}
              </Badge>
            </Stack>

            <Stack gap="xs">
              <Text fw={500}>Paid Amount</Text>
              <Group gap="xs">
                <IconCurrencyRupee size={16} />
                <Title order={4}>{sale.paidAmount?.toFixed(2)}</Title>
              </Group>
            </Stack>

            <Stack gap="xs">
              <Text fw={500}>Balance Amount</Text>
              <Group gap="xs">
                <IconCurrencyRupee size={16} />
                <Title 
                  order={4} 
                  c={sale.balanceAmount > 0 ? 'red' : 'green'}
                >
                  {sale.balanceAmount?.toFixed(2)}
                </Title>
              </Group>
            </Stack>
          </SimpleGrid>
        </Card>

        {/* System Information */}
        <Card withBorder shadow="sm">
          <Card.Section withBorder inheritPadding py="sm">
            <Group justify="space-between">
              <Title order={3}>System Information</Title>
              <ThemeIcon variant="light" color="gray">
                <IconClock size={20} />
              </ThemeIcon>
            </Group>
          </Card.Section>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
            <Stack gap="xs">
              <Text fw={500}>Created At</Text>
              <Group gap="xs">
                <IconCalendar size={16} />
                <Text>{dayjs(sale.createdAt).format('DD-MM-YYYY HH:mm:ss')}</Text>
              </Group>
            </Stack>

            <Stack gap="xs">
              <Text fw={500}>Updated At</Text>
              <Group gap="xs">
                <IconCalendar size={16} />
                <Text>{dayjs(sale.updatedAt).format('DD-MM-YYYY HH:mm:ss')}</Text>
              </Group>
            </Stack>
          </SimpleGrid>
        </Card>
      </div>
    </Container>
  );
};

export default SalesView;
