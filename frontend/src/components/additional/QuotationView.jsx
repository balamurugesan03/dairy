import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, Grid, Badge,
  ActionIcon, Divider, Box, Table, Loader, Center, Modal, Select,
  NumberInput, ThemeIcon, Card, Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconArrowLeft, IconEdit, IconPrinter, IconArrowRight, IconCheck,
  IconSend, IconX, IconFileInvoice, IconAlertCircle, IconBrandWhatsapp, IconMail
} from '@tabler/icons-react';
import { quotationAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';
import QuotationSendModal from './QuotationSendModal';
import dayjs from 'dayjs';

const STATUS_CONFIG = {
  Draft:     { color: 'gray' },
  Sent:      { color: 'blue' },
  Accepted:  { color: 'green' },
  Rejected:  { color: 'red' },
  Expired:   { color: 'orange' },
  Converted: { color: 'teal' }
};

const QuotationView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const printRef = useRef(null);
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [convertModal, setConvertModal] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('Credit');
  const [paidAmount, setPaidAmount] = useState(0);
  const [converting, setConverting] = useState(false);

  useEffect(() => { fetchQuotation(); }, [id]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const res = await quotationAPI.getById(id);
      setQuotation(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      navigate('/quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await quotationAPI.update(id, { status: newStatus });
      notifications.show({ title: 'Updated', message: `Status changed to ${newStatus}`, color: 'green' });
      fetchQuotation();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const res = await quotationAPI.convertToInvoice(id, { paymentMode, paidAmount });
      const invoice = res?.data?.invoice || res?.data;
      notifications.show({ title: 'Converted!', message: `Invoice ${invoice?.invoiceNumber || ''} created`, color: 'teal' });
      setConvertModal(false);
      navigate(`/business-inventory/sales/list`);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setConverting(false);
    }
  };

  const handlePrint = () => printReport(printRef, { title: 'Quotation', orientation: 'landscape' });

  if (loading) return <Center h={400}><Loader/></Center>;
  if (!quotation) return null;

  const q = quotation;
  const statusCfg = STATUS_CONFIG[q.status] || { color: 'gray' };
  const canConvert = ['Accepted', 'Sent', 'Draft'].includes(q.status);

  return (
    <Container size="xl" py="md" ref={printRef}>
      {/* Action Bar */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate('/quotations')}><IconArrowLeft size={18}/></ActionIcon>
          <Box>
            <Title order={2} fw={700}>{q.quotationNumber}</Title>
            <Text size="sm" c="dimmed">{dayjs(q.quotationDate).format('DD MMM YYYY')} · Valid until {dayjs(q.validUntil).format('DD MMM YYYY')}</Text>
          </Box>
          <Badge color={statusCfg.color} size="lg" variant="light">{q.status}</Badge>
        </Group>
        <Group>
          {q.status === 'Draft' && <Button size="sm" variant="light" leftSection={<IconSend size={14}/>} onClick={() => handleStatusChange('Sent')}>Mark Sent</Button>}
          {q.status === 'Sent' && <Button size="sm" variant="light" color="green" leftSection={<IconCheck size={14}/>} onClick={() => handleStatusChange('Accepted')}>Accept</Button>}
          {q.status === 'Sent' && <Button size="sm" variant="light" color="red" leftSection={<IconX size={14}/>} onClick={() => handleStatusChange('Rejected')}>Reject</Button>}
          {canConvert && (
            <Button size="sm" color="teal" leftSection={<IconArrowRight size={14}/>} onClick={() => setConvertModal(true)}>
              Convert to Invoice
            </Button>
          )}
          {q.status !== 'Converted' && (
            <Button size="sm" variant="default" leftSection={<IconEdit size={14}/>} onClick={() => navigate(`/quotations/edit/${id}`)}>Edit</Button>
          )}
          <Button size="sm" color="green" variant="light" leftSection={<IconBrandWhatsapp size={14}/>} onClick={() => setSendModal(true)}>WhatsApp</Button>
          <Button size="sm" color="blue" variant="light" leftSection={<IconMail size={14}/>} onClick={() => setSendModal(true)}>Email</Button>
          <Button size="sm" variant="default" leftSection={<IconPrinter size={14}/>} onClick={handlePrint}>Print</Button>
        </Group>
      </Group>

      {q.status === 'Converted' && q.convertedToInvoice?.invoiceNumber && (
        <Alert icon={<IconFileInvoice size={16}/>} color="teal" mb="md" radius="md">
          Converted to Invoice: <b>{q.convertedToInvoice.invoiceNumber}</b> on {dayjs(q.convertedToInvoice.convertedDate).format('DD MMM YYYY')}
        </Alert>
      )}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          {/* Customer Info */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm" c="dimmed" tt="uppercase" size="xs">Bill To</Text>
            <Text fw={700} size="lg">{q.partyName || '—'}</Text>
            {q.partyPhone && <Text size="sm">{q.partyPhone}</Text>}
            {q.partyEmail && <Text size="sm" c="dimmed">{q.partyEmail}</Text>}
            {q.partyAddress && <Text size="sm">{q.partyAddress}</Text>}
            {q.partyGstin && <Text size="sm">GSTIN: {q.partyGstin}</Text>}
          </Paper>

          {/* Items Table */}
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }} mb="md">
            <Box p="sm" style={{ background: 'var(--mantine-color-gray-1)' }}>
              <Text fw={600} size="sm">Items</Text>
            </Box>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Item</Table.Th>
                  <Table.Th>HSN</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Qty</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Rate</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Disc%</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>GST%</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {q.items?.map((item, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{item.itemName}</Text>
                      {item.itemCode && <Text size="xs" c="dimmed">{item.itemCode}</Text>}
                    </Table.Td>
                    <Table.Td><Text size="sm">{item.hsnCode || '—'}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm">{item.quantity} {item.unit}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm">₹{(item.rate || 0).toFixed(2)}</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm">{item.discountPercent || 0}%</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm">{item.gstPercent || 0}%</Text></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600}>₹{(item.totalAmount || 0).toFixed(2)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          {/* Notes */}
          {(q.notes || q.termsAndConditions) && (
            <Grid>
              {q.notes && (
                <Grid.Col span={6}>
                  <Paper withBorder radius="md" p="md">
                    <Text fw={600} size="sm" mb="xs">Notes</Text>
                    <Text size="sm" c="dimmed">{q.notes}</Text>
                  </Paper>
                </Grid.Col>
              )}
              {q.termsAndConditions && (
                <Grid.Col span={6}>
                  <Paper withBorder radius="md" p="md">
                    <Text fw={600} size="sm" mb="xs">Terms & Conditions</Text>
                    <Text size="sm" c="dimmed">{q.termsAndConditions}</Text>
                  </Paper>
                </Grid.Col>
              )}
            </Grid>
          )}
        </Grid.Col>

        {/* Summary */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="md" p="md">
            <Text fw={700} mb="md">Amount Summary</Text>
            <Stack gap={6}>
              <Group justify="space-between"><Text size="sm" c="dimmed">Gross Amount</Text><Text size="sm">₹{(q.grossAmount || 0).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Item Discount</Text><Text size="sm" c="red">- ₹{(q.itemDiscount || 0).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Bill Discount</Text><Text size="sm" c="red">- ₹{(q.billDiscount || 0).toFixed(2)}</Text></Group>
              <Divider/>
              <Group justify="space-between"><Text size="sm" c="dimmed">Taxable Amount</Text><Text size="sm">₹{(q.taxableAmount || 0).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">CGST</Text><Text size="sm">₹{(q.totalCgst || 0).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">SGST</Text><Text size="sm">₹{(q.totalSgst || 0).toFixed(2)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="dimmed">Round Off</Text><Text size="sm">₹{(q.roundOff || 0).toFixed(2)}</Text></Group>
              <Divider/>
              <Group justify="space-between">
                <Text fw={700} size="lg">Grand Total</Text>
                <Text fw={700} size="xl" c="blue">₹{(q.grandTotal || 0).toFixed(2)}</Text>
              </Group>
            </Stack>

            {canConvert && (
              <Button fullWidth mt="lg" color="teal" leftSection={<IconArrowRight size={16}/>} onClick={() => setConvertModal(true)}>
                Convert to Invoice
              </Button>
            )}
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Send Modal */}
      <QuotationSendModal
        opened={sendModal}
        onClose={() => setSendModal(false)}
        quotation={q}
        onSent={fetchQuotation}
      />

      {/* Convert Modal */}
      <Modal opened={convertModal} onClose={() => setConvertModal(false)} title="Convert to Invoice" size="sm">
        <Stack>
          <Text size="sm">This will create a sales invoice for <b>₹{(q.grandTotal || 0).toFixed(2)}</b></Text>
          <Select
            label="Payment Mode"
            value={paymentMode}
            onChange={setPaymentMode}
            data={['Cash', 'Credit', 'Bank Transfer', 'UPI', 'Cheque']}
          />
          <NumberInput
            label="Amount Received Now (₹)"
            value={paidAmount}
            onChange={setPaidAmount}
            min={0}
            max={q.grandTotal}
            decimalScale={2}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setConvertModal(false)}>Cancel</Button>
            <Button color="teal" loading={converting} onClick={handleConvert}>Convert</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default QuotationView;
