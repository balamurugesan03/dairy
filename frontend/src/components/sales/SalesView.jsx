import { useState, useEffect, useRef } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';


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
    return <LoadingSpinner />;
  }

  if (!sale) {
    return null;
  }

  const itemColumns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Item Name',
      dataIndex: 'itemName',
      key: 'itemName'
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity'
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      key: 'rate',
      render: (rate) => `₹${rate?.toFixed(2)}`
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `₹${amount?.toFixed(2)}`
    },
    {
      title: 'GST Amount',
      dataIndex: 'gstAmount',
      key: 'gstAmount',
      render: (gst) => `₹${gst?.toFixed(2)}`
    },
    {
      title: 'Total',
      key: 'total',
      render: (_, record) => `₹${(record.amount + record.gstAmount)?.toFixed(2)}`
    }
  ];

  return (
    <div>
      <PageHeader
        title="Sale Details"
        subtitle={`Bill No: ${sale.billNumber}`}
        extra={[
          <Button
            key="back"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/sales')}
          >
            Back
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            Print
          </Button>
        ]}
      />

      <div ref={printRef}>
        <Card title="Bill Information">
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Bill Number">
              {sale.billNumber}
            </Descriptions.Item>
            <Descriptions.Item label="Bill Date">
              {dayjs(sale.billDate).format('DD-MM-YYYY HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Customer Type">
              <Tag color={sale.customerType === 'Farmer' ? 'blue' : 'green'}>
                {sale.customerType}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Customer Name">
              {sale.customerName}
            </Descriptions.Item>
            <Descriptions.Item label="Customer Phone">
              {sale.customerPhone}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={
                sale.status === 'Paid' ? 'success' :
                sale.status === 'Partial' ? 'warning' : 'error'
              }>
                {sale.status}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Items" style={{ marginTop: 16 }}>
          <Table
            columns={itemColumns}
            dataSource={sale.items}
            rowKey={(record, index) => index}
            pagination={false}
          />

          <Divider />

          <div style={{ textAlign: 'right' }}>
            <Space direction="vertical" size="small" style={{ width: 300 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Subtotal:</Text>
                <Text>₹{sale.subtotal?.toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Total GST:</Text>
                <Text>₹{sale.totalGst?.toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Title level={5}>Grand Total:</Title>
                <Title level={5}>₹{sale.grandTotal?.toFixed(2)}</Title>
              </div>
              {sale.oldBalance > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Old Balance:</Text>
                    <Text>₹{sale.oldBalance?.toFixed(2)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Title level={5}>Total Due:</Title>
                    <Title level={5}>₹{sale.totalDue?.toFixed(2)}</Title>
                  </div>
                </>
              )}
            </Space>
          </div>
        </Card>

        <Card title="Payment Details" style={{ marginTop: 16 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Payment Mode">
              {sale.paymentMode}
            </Descriptions.Item>
            <Descriptions.Item label="Paid Amount">
              ₹{sale.paidAmount?.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="Balance Amount">
              <Text style={{ color: sale.balanceAmount > 0 ? 'red' : 'green' }}>
                ₹{sale.balanceAmount?.toFixed(2)}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="System Information" style={{ marginTop: 16 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Created At">
              {dayjs(sale.createdAt).format('DD-MM-YYYY HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {dayjs(sale.updatedAt).format('DD-MM-YYYY HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    </div>
  );
};

export default SalesView;
