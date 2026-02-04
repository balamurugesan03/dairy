import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Table,
  Badge,
  Button,
  LoadingOverlay,
  Center,
  Box,
  Grid,
  Card,
  ThemeIcon,
  Divider,
  ActionIcon,
  Tooltip,
  Collapse,
  Select,
  Tabs,
  ScrollArea
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import {
  IconFileInvoice,
  IconCalendar,
  IconPrinter,
  IconFileSpreadsheet,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconBuilding,
  IconUsers,
  IconReceipt,
  IconFileExport,
  IconCreditCard,
  IconBan,
  IconWorld,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';

const VyaparGSTR1 = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedSections, setExpandedSections] = useState({
    b2b: true,
    b2cl: true,
    b2cs: true,
    exports: false,
    creditNotes: false,
    nilRated: false
  });

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount
  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const month = selectedMonth.getMonth() + 1;
      const year = selectedMonth.getFullYear();
      const returnPeriod = `${String(month).padStart(2, '0')}${year}`;

      const response = await reportAPI.vyaparGSTR1({ returnPeriod });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch GSTR-1 report');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  const handleApplyFilter = () => {
    fetchReport();
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!reportData) {
      message.warning('No data to export');
      return;
    }

    const wb = XLSX.utils.book_new();

    // B2B Sheet
    if (reportData.sections.b2b.invoices.length > 0) {
      const b2bData = reportData.sections.b2b.invoices.map((inv, idx) => ({
        '#': idx + 1,
        'GSTIN': inv.gstin,
        'Party Name': inv.partyName,
        'Invoice Number': inv.invoiceNumber,
        'Invoice Date': formatDate(inv.invoiceDate),
        'Place of Supply': inv.placeOfSupply,
        'Taxable Value': inv.taxableValue.toFixed(2),
        'CGST': inv.cgst.toFixed(2),
        'SGST': inv.sgst.toFixed(2),
        'IGST': inv.igst.toFixed(2),
        'Invoice Value': inv.invoiceValue.toFixed(2)
      }));
      const b2bSheet = XLSX.utils.json_to_sheet(b2bData);
      XLSX.utils.book_append_sheet(wb, b2bSheet, 'B2B');
    }

    // B2CL Sheet
    if (reportData.sections.b2cl.invoices.length > 0) {
      const b2clData = reportData.sections.b2cl.invoices.map((inv, idx) => ({
        '#': idx + 1,
        'Party Name': inv.partyName,
        'Invoice Number': inv.invoiceNumber,
        'Invoice Date': formatDate(inv.invoiceDate),
        'Place of Supply': inv.placeOfSupply,
        'Taxable Value': inv.taxableValue.toFixed(2),
        'CGST': inv.cgst.toFixed(2),
        'SGST': inv.sgst.toFixed(2),
        'IGST': inv.igst.toFixed(2),
        'Invoice Value': inv.invoiceValue.toFixed(2)
      }));
      const b2clSheet = XLSX.utils.json_to_sheet(b2clData);
      XLSX.utils.book_append_sheet(wb, b2clSheet, 'B2CL');
    }

    // B2CS Sheet
    if (reportData.sections.b2cs.grouped?.length > 0) {
      const b2csData = reportData.sections.b2cs.grouped.map((grp, idx) => ({
        '#': idx + 1,
        'Place of Supply': grp.placeOfSupply,
        'GST Rate': `${grp.gstRate}%`,
        'Invoice Count': grp.invoiceCount,
        'Taxable Value': grp.taxableValue.toFixed(2),
        'CGST': grp.cgst.toFixed(2),
        'SGST': grp.sgst.toFixed(2),
        'IGST': grp.igst.toFixed(2)
      }));
      const b2csSheet = XLSX.utils.json_to_sheet(b2csData);
      XLSX.utils.book_append_sheet(wb, b2csSheet, 'B2CS');
    }

    // Summary Sheet
    const summaryData = [
      { Section: 'B2B', 'Invoice Count': reportData.sections.b2b.summary.count, 'Taxable Value': reportData.sections.b2b.summary.taxableValue.toFixed(2), 'Total Tax': (reportData.sections.b2b.summary.cgst + reportData.sections.b2b.summary.sgst + reportData.sections.b2b.summary.igst).toFixed(2), 'Invoice Value': reportData.sections.b2b.summary.invoiceValue.toFixed(2) },
      { Section: 'B2CL', 'Invoice Count': reportData.sections.b2cl.summary.count, 'Taxable Value': reportData.sections.b2cl.summary.taxableValue.toFixed(2), 'Total Tax': (reportData.sections.b2cl.summary.cgst + reportData.sections.b2cl.summary.sgst + reportData.sections.b2cl.summary.igst).toFixed(2), 'Invoice Value': reportData.sections.b2cl.summary.invoiceValue.toFixed(2) },
      { Section: 'B2CS', 'Invoice Count': reportData.sections.b2cs.summary.count, 'Taxable Value': reportData.sections.b2cs.summary.taxableValue.toFixed(2), 'Total Tax': (reportData.sections.b2cs.summary.cgst + reportData.sections.b2cs.summary.sgst + reportData.sections.b2cs.summary.igst).toFixed(2), 'Invoice Value': reportData.sections.b2cs.summary.invoiceValue.toFixed(2) },
      { Section: 'Nil Rated', 'Invoice Count': reportData.sections.nilRated.summary.count, 'Taxable Value': '-', 'Total Tax': '-', 'Invoice Value': reportData.sections.nilRated.summary.nilRated.toFixed(2) },
      { Section: 'TOTAL', 'Invoice Count': reportData.grandTotal.invoiceCount, 'Taxable Value': reportData.grandTotal.taxableValue.toFixed(2), 'Total Tax': reportData.grandTotal.totalTax.toFixed(2), 'Invoice Value': reportData.grandTotal.invoiceValue.toFixed(2) }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    XLSX.writeFile(wb, `GSTR1_${dayjs(selectedMonth).format('MMM_YYYY')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  // Print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const periodString = reportData?.returnPeriod?.periodString || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GSTR-1 Report - ${periodString}</title>
        <style>
          @media print { @page { size: A4 landscape; margin: 8mm; } }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; padding: 10px; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #1565c0; padding-bottom: 8px; margin-bottom: 12px; }
          .header h1 { margin: 0; color: #1565c0; font-size: 16px; }
          .header p { margin: 3px 0 0; color: #666; font-size: 10px; }
          .section { margin-bottom: 15px; page-break-inside: avoid; }
          .section-title { background: #e3f2fd; padding: 6px 10px; font-weight: 600; color: #1565c0; border-left: 4px solid #1565c0; margin-bottom: 5px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; font-size: 8px; }
          th, td { padding: 4px 6px; border: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: 600; text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .total-row { background: #fff3e0; font-weight: 700; }
          .grand-total { background: #e8f5e9; font-weight: 700; font-size: 10px; }
          .summary-box { display: inline-block; padding: 8px 15px; margin: 5px; background: #f5f5f5; border-radius: 4px; text-align: center; }
          .summary-box .label { font-size: 8px; color: #666; }
          .summary-box .value { font-size: 12px; font-weight: 700; color: #1565c0; }
          .footer { margin-top: 15px; text-align: center; font-size: 8px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>GSTR-1 - OUTWARD SUPPLIES RETURN</h1>
          <p>Return Period: ${periodString} | Generated on: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
        </div>

        <!-- Summary -->
        <div style="text-align: center; margin-bottom: 15px;">
          <div class="summary-box">
            <div class="label">Total Invoices</div>
            <div class="value">${reportData?.grandTotal?.invoiceCount || 0}</div>
          </div>
          <div class="summary-box">
            <div class="label">Taxable Value</div>
            <div class="value">${formatCurrency(reportData?.grandTotal?.taxableValue)}</div>
          </div>
          <div class="summary-box">
            <div class="label">Total Tax</div>
            <div class="value">${formatCurrency(reportData?.grandTotal?.totalTax)}</div>
          </div>
          <div class="summary-box">
            <div class="label">Invoice Value</div>
            <div class="value">${formatCurrency(reportData?.grandTotal?.invoiceValue)}</div>
          </div>
        </div>

        <!-- B2B Section -->
        ${reportData?.sections?.b2b?.invoices?.length > 0 ? `
        <div class="section">
          <div class="section-title">B2B Invoices - Supplies to Registered Persons (${reportData.sections.b2b.summary.count} invoices)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>GSTIN</th>
                <th>Party Name</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Place of Supply</th>
                <th>Taxable Value</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>IGST</th>
                <th>Invoice Value</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.sections.b2b.invoices.map((inv, idx) => `
                <tr>
                  <td style="text-align:center">${idx + 1}</td>
                  <td>${inv.gstin}</td>
                  <td class="text-left">${inv.partyName}</td>
                  <td>${inv.invoiceNumber}</td>
                  <td>${formatDate(inv.invoiceDate)}</td>
                  <td>${inv.placeOfSupply}</td>
                  <td class="text-right">${formatCurrency(inv.taxableValue)}</td>
                  <td class="text-right">${formatCurrency(inv.cgst)}</td>
                  <td class="text-right">${formatCurrency(inv.sgst)}</td>
                  <td class="text-right">${formatCurrency(inv.igst)}</td>
                  <td class="text-right">${formatCurrency(inv.invoiceValue)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="6" class="text-right"><strong>B2B Total</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2b.summary.taxableValue)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2b.summary.cgst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2b.summary.sgst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2b.summary.igst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2b.summary.invoiceValue)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- B2CL Section -->
        ${reportData?.sections?.b2cl?.invoices?.length > 0 ? `
        <div class="section">
          <div class="section-title">B2C Large Invoices - Invoice Value > ₹2.5 Lakhs (${reportData.sections.b2cl.summary.count} invoices)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Party Name</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Place of Supply</th>
                <th>Taxable Value</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>IGST</th>
                <th>Invoice Value</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.sections.b2cl.invoices.map((inv, idx) => `
                <tr>
                  <td style="text-align:center">${idx + 1}</td>
                  <td class="text-left">${inv.partyName}</td>
                  <td>${inv.invoiceNumber}</td>
                  <td>${formatDate(inv.invoiceDate)}</td>
                  <td>${inv.placeOfSupply}</td>
                  <td class="text-right">${formatCurrency(inv.taxableValue)}</td>
                  <td class="text-right">${formatCurrency(inv.cgst)}</td>
                  <td class="text-right">${formatCurrency(inv.sgst)}</td>
                  <td class="text-right">${formatCurrency(inv.igst)}</td>
                  <td class="text-right">${formatCurrency(inv.invoiceValue)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" class="text-right"><strong>B2CL Total</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cl.summary.taxableValue)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cl.summary.cgst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cl.summary.sgst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cl.summary.igst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cl.summary.invoiceValue)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- B2CS Section -->
        ${reportData?.sections?.b2cs?.grouped?.length > 0 ? `
        <div class="section">
          <div class="section-title">B2C Small Supplies - Summary by Rate & Place (${reportData.sections.b2cs.summary.count} invoices)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Place of Supply</th>
                <th>GST Rate</th>
                <th>Invoice Count</th>
                <th>Taxable Value</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>IGST</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.sections.b2cs.grouped.map((grp, idx) => `
                <tr>
                  <td style="text-align:center">${idx + 1}</td>
                  <td>${grp.placeOfSupply}</td>
                  <td style="text-align:center">${grp.gstRate}%</td>
                  <td style="text-align:center">${grp.invoiceCount}</td>
                  <td class="text-right">${formatCurrency(grp.taxableValue)}</td>
                  <td class="text-right">${formatCurrency(grp.cgst)}</td>
                  <td class="text-right">${formatCurrency(grp.sgst)}</td>
                  <td class="text-right">${formatCurrency(grp.igst)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" class="text-right"><strong>B2CS Total</strong></td>
                <td style="text-align:center"><strong>${reportData.sections.b2cs.summary.count}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cs.summary.taxableValue)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cs.summary.cgst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cs.summary.sgst)}</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.b2cs.summary.igst)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Nil Rated Section -->
        ${reportData?.sections?.nilRated?.supplies?.length > 0 ? `
        <div class="section">
          <div class="section-title">Nil Rated, Exempt & Non-GST Supplies (${reportData.sections.nilRated.summary.count} supplies)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Party Name</th>
                <th>Supply Type</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.sections.nilRated.supplies.map((sup, idx) => `
                <tr>
                  <td style="text-align:center">${idx + 1}</td>
                  <td>${sup.invoiceNumber}</td>
                  <td>${formatDate(sup.invoiceDate)}</td>
                  <td class="text-left">${sup.partyName}</td>
                  <td>${sup.supplyType}</td>
                  <td class="text-right">${formatCurrency(sup.invoiceValue)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" class="text-right"><strong>Nil Rated Total</strong></td>
                <td class="text-right"><strong>${formatCurrency(reportData.sections.nilRated.summary.nilRated)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Grand Total -->
        <div class="section">
          <table>
            <tr class="grand-total">
              <td colspan="6" class="text-right"><strong>GRAND TOTAL</strong></td>
              <td class="text-right"><strong>${formatCurrency(reportData?.grandTotal?.taxableValue)}</strong></td>
              <td class="text-right"><strong>${formatCurrency(reportData?.grandTotal?.cgst)}</strong></td>
              <td class="text-right"><strong>${formatCurrency(reportData?.grandTotal?.sgst)}</strong></td>
              <td class="text-right"><strong>${formatCurrency(reportData?.grandTotal?.igst)}</strong></td>
              <td class="text-right"><strong>${formatCurrency(reportData?.grandTotal?.invoiceValue)}</strong></td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p>This is a computer-generated report. | GSTR-1 Return Period: ${periodString}</p>
        </div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Render section header
  const renderSectionHeader = (section, title, icon, count, total) => (
    <Paper
      p="sm"
      mb={0}
      style={{
        backgroundColor: '#e3f2fd',
        borderLeft: '4px solid #1565c0',
        cursor: 'pointer'
      }}
      onClick={() => toggleSection(section)}
    >
      <Group justify="space-between">
        <Group gap="sm">
          <ThemeIcon size="sm" variant="light" color="blue">
            {icon}
          </ThemeIcon>
          <Text fw={600} c="blue.7">{title}</Text>
          <Badge size="sm" variant="filled" color="blue">{count} invoices</Badge>
          {expandedSections[section] ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </Group>
        <Text fw={600} c="blue.7">{formatCurrency(total)}</Text>
      </Group>
    </Paper>
  );

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Page Header */}
        <Paper p="md" withBorder style={{ borderColor: '#1565c0', borderWidth: 2 }}>
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <ThemeIcon size="xl" variant="filled" color="blue" radius="md">
                <IconFileInvoice size={28} />
              </ThemeIcon>
              <Box>
                <Title order={2} fw={700} c="blue.7">GSTR-1 Report</Title>
                <Text size="sm" c="dimmed">
                  Outward Supplies Return - GST Filing Format
                </Text>
              </Box>
            </Group>
            <Group gap="xs">
              <Tooltip label="Refresh">
                <ActionIcon variant="light" size="lg" onClick={fetchReport}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Export to Excel">
                <ActionIcon variant="light" color="green" size="lg" onClick={handleExportExcel}>
                  <IconFileSpreadsheet size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Print">
                <ActionIcon variant="light" color="blue" size="lg" onClick={handlePrint}>
                  <IconPrinter size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>

        {/* Filters */}
        <Paper p="md" withBorder>
          <Group gap="md" align="flex-end">
            <Box>
              <Text size="sm" fw={500} mb={4}>Return Period</Text>
              <MonthPickerInput
                placeholder="Select month"
                value={selectedMonth}
                onChange={handleMonthChange}
                leftSection={<IconCalendar size={16} />}
                valueFormat="MMMM YYYY"
                style={{ width: 200 }}
              />
            </Box>
            <Button
              leftSection={<IconFileInvoice size={16} />}
              onClick={handleApplyFilter}
              style={{ backgroundColor: '#1565c0' }}
            >
              Generate GSTR-1
            </Button>
          </Group>
        </Paper>

        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {reportData && !loading && (
          <>
            {/* Return Period Info */}
            <Paper p="sm" withBorder bg="blue.0">
              <Group justify="center" gap="xl">
                <Text size="sm" fw={600} c="blue.7">
                  Return Period: {reportData.returnPeriod?.periodString}
                </Text>
                <Divider orientation="vertical" />
                <Text size="sm">
                  From: {formatDate(reportData.returnPeriod?.startDate)}
                </Text>
                <Text size="sm">
                  To: {formatDate(reportData.returnPeriod?.endDate)}
                </Text>
              </Group>
            </Paper>

            {/* Summary Cards */}
            <Grid>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Card p="md" withBorder bg="blue.0">
                  <Group gap="xs">
                    <ThemeIcon size="lg" variant="light" color="blue">
                      <IconReceipt size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text size="xs" c="blue.7" fw={500}>Total Invoices</Text>
                      <Text size="xl" fw={700} c="blue.7">{reportData.grandTotal.invoiceCount}</Text>
                    </Box>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Card p="md" withBorder bg="orange.0">
                  <Group gap="xs">
                    <ThemeIcon size="lg" variant="light" color="orange">
                      <IconFileInvoice size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text size="xs" c="orange.7" fw={500}>Taxable Value</Text>
                      <Text size="lg" fw={700} c="orange.7">{formatCurrency(reportData.grandTotal.taxableValue)}</Text>
                    </Box>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Card p="md" withBorder bg="red.0">
                  <Group gap="xs">
                    <ThemeIcon size="lg" variant="light" color="red">
                      <IconCreditCard size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text size="xs" c="red.7" fw={500}>Total Tax</Text>
                      <Text size="lg" fw={700} c="red.7">{formatCurrency(reportData.grandTotal.totalTax)}</Text>
                    </Box>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 3 }}>
                <Card p="md" withBorder bg="green.0">
                  <Group gap="xs">
                    <ThemeIcon size="lg" variant="light" color="green">
                      <IconCheck size={20} />
                    </ThemeIcon>
                    <Box>
                      <Text size="xs" c="green.7" fw={500}>Invoice Value</Text>
                      <Text size="lg" fw={700} c="green.7">{formatCurrency(reportData.grandTotal.invoiceValue)}</Text>
                    </Box>
                  </Group>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Tax Breakdown */}
            <Paper p="md" withBorder>
              <Group justify="space-around">
                <Box ta="center">
                  <Text size="xs" c="dimmed">CGST</Text>
                  <Text size="lg" fw={700} c="red.7">{formatCurrency(reportData.grandTotal.cgst)}</Text>
                </Box>
                <Divider orientation="vertical" />
                <Box ta="center">
                  <Text size="xs" c="dimmed">SGST</Text>
                  <Text size="lg" fw={700} c="orange.7">{formatCurrency(reportData.grandTotal.sgst)}</Text>
                </Box>
                <Divider orientation="vertical" />
                <Box ta="center">
                  <Text size="xs" c="dimmed">IGST</Text>
                  <Text size="lg" fw={700} c="blue.7">{formatCurrency(reportData.grandTotal.igst)}</Text>
                </Box>
                <Divider orientation="vertical" />
                <Box ta="center">
                  <Text size="xs" c="dimmed">CESS</Text>
                  <Text size="lg" fw={700} c="gray.7">{formatCurrency(reportData.grandTotal.cess || 0)}</Text>
                </Box>
              </Group>
            </Paper>

            {/* Tabs for different views */}
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab value="summary" leftSection={<IconReceipt size={14} />}>Summary</Tabs.Tab>
                <Tabs.Tab value="b2b" leftSection={<IconBuilding size={14} />}>B2B ({reportData.sections.b2b.summary.count})</Tabs.Tab>
                <Tabs.Tab value="b2cl" leftSection={<IconUsers size={14} />}>B2CL ({reportData.sections.b2cl.summary.count})</Tabs.Tab>
                <Tabs.Tab value="b2cs" leftSection={<IconUsers size={14} />}>B2CS ({reportData.sections.b2cs.summary.count})</Tabs.Tab>
                <Tabs.Tab value="nilrated" leftSection={<IconBan size={14} />}>Nil Rated ({reportData.sections.nilRated.summary.count})</Tabs.Tab>
              </Tabs.List>

              {/* Summary Tab */}
              <Tabs.Panel value="summary" pt="md">
                <Paper withBorder>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr style={{ backgroundColor: '#1565c0' }}>
                        <Table.Th style={{ color: 'white' }}>Section</Table.Th>
                        <Table.Th style={{ color: 'white', textAlign: 'center' }}>Invoices</Table.Th>
                        <Table.Th style={{ color: 'white', textAlign: 'right' }}>Taxable Value</Table.Th>
                        <Table.Th style={{ color: 'white', textAlign: 'right' }}>CGST</Table.Th>
                        <Table.Th style={{ color: 'white', textAlign: 'right' }}>SGST</Table.Th>
                        <Table.Th style={{ color: 'white', textAlign: 'right' }}>IGST</Table.Th>
                        <Table.Th style={{ color: 'white', textAlign: 'right' }}>Invoice Value</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td><Badge color="blue" variant="light">B2B</Badge> Supplies to Registered Persons</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.b2b.summary.count}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.taxableValue)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.cgst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.sgst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.igst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.invoiceValue)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td><Badge color="orange" variant="light">B2CL</Badge> Large Invoices (&gt; ₹2.5L)</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.b2cl.summary.count}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cl.summary.taxableValue)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cl.summary.cgst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cl.summary.sgst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cl.summary.igst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cl.summary.invoiceValue)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td><Badge color="green" variant="light">B2CS</Badge> Small Supplies</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.b2cs.summary.count}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cs.summary.taxableValue)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cs.summary.cgst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cs.summary.sgst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cs.summary.igst)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2cs.summary.invoiceValue)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td><Badge color="gray" variant="light">NIL</Badge> Nil Rated / Exempt</Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.nilRated.summary.count}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.nilRated.summary.nilRated)}</Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr style={{ backgroundColor: '#e8f5e9' }}>
                        <Table.Td><Text fw={700}>GRAND TOTAL</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}><Text fw={700}>{reportData.grandTotal.invoiceCount}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.grandTotal.taxableValue)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="red.7">{formatCurrency(reportData.grandTotal.cgst)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="orange.7">{formatCurrency(reportData.grandTotal.sgst)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="blue.7">{formatCurrency(reportData.grandTotal.igst)}</Text></Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="green.7">{formatCurrency(reportData.grandTotal.invoiceValue)}</Text></Table.Td>
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </Paper>
              </Tabs.Panel>

              {/* B2B Tab */}
              <Tabs.Panel value="b2b" pt="md">
                <Paper withBorder>
                  <Box p="sm" style={{ backgroundColor: '#e3f2fd', borderBottom: '1px solid #90caf9' }}>
                    <Text fw={600} c="blue.7">{reportData.sections.b2b.title}</Text>
                    <Text size="xs" c="dimmed">{reportData.sections.b2b.description}</Text>
                  </Box>
                  <ScrollArea>
                    <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 1000 }}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 40 }}>#</Table.Th>
                          <Table.Th style={{ width: 150 }}>GSTIN</Table.Th>
                          <Table.Th>Party Name</Table.Th>
                          <Table.Th>Invoice No</Table.Th>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Place of Supply</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Taxable Value</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>CGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>SGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>IGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Invoice Value</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {reportData.sections.b2b.invoices.length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={11}>
                              <Center py="xl">
                                <Text c="dimmed">No B2B invoices for this period</Text>
                              </Center>
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          reportData.sections.b2b.invoices.map((inv, idx) => (
                            <Table.Tr key={inv._id || idx}>
                              <Table.Td>{idx + 1}</Table.Td>
                              <Table.Td><Text size="xs" ff="monospace">{inv.gstin}</Text></Table.Td>
                              <Table.Td><Text size="sm" fw={500}>{inv.partyName}</Text></Table.Td>
                              <Table.Td><Badge size="sm" variant="light">{inv.invoiceNumber}</Badge></Table.Td>
                              <Table.Td>{formatDate(inv.invoiceDate)}</Table.Td>
                              <Table.Td>{inv.placeOfSupply}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(inv.taxableValue)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text c="red.7">{formatCurrency(inv.cgst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text c="orange.7">{formatCurrency(inv.sgst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text c="blue.7">{formatCurrency(inv.igst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>{formatCurrency(inv.invoiceValue)}</Text></Table.Td>
                            </Table.Tr>
                          ))
                        )}
                      </Table.Tbody>
                      {reportData.sections.b2b.invoices.length > 0 && (
                        <Table.Tfoot>
                          <Table.Tr style={{ backgroundColor: '#fff3e0' }}>
                            <Table.Td colSpan={6} style={{ textAlign: 'right' }}><Text fw={700}>B2B Total</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.sections.b2b.summary.taxableValue)}</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="red.7">{formatCurrency(reportData.sections.b2b.summary.cgst)}</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="orange.7">{formatCurrency(reportData.sections.b2b.summary.sgst)}</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="blue.7">{formatCurrency(reportData.sections.b2b.summary.igst)}</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="green.7">{formatCurrency(reportData.sections.b2b.summary.invoiceValue)}</Text></Table.Td>
                          </Table.Tr>
                        </Table.Tfoot>
                      )}
                    </Table>
                  </ScrollArea>
                </Paper>
              </Tabs.Panel>

              {/* B2CL Tab */}
              <Tabs.Panel value="b2cl" pt="md">
                <Paper withBorder>
                  <Box p="sm" style={{ backgroundColor: '#fff3e0', borderBottom: '1px solid #ffcc80' }}>
                    <Text fw={600} c="orange.7">{reportData.sections.b2cl.title}</Text>
                    <Text size="xs" c="dimmed">{reportData.sections.b2cl.description}</Text>
                  </Box>
                  <ScrollArea>
                    <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 900 }}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 40 }}>#</Table.Th>
                          <Table.Th>Party Name</Table.Th>
                          <Table.Th>Invoice No</Table.Th>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Place of Supply</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Taxable Value</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>CGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>SGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>IGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Invoice Value</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {reportData.sections.b2cl.invoices.length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={10}>
                              <Center py="xl">
                                <Text c="dimmed">No B2C Large invoices for this period</Text>
                              </Center>
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          reportData.sections.b2cl.invoices.map((inv, idx) => (
                            <Table.Tr key={inv._id || idx}>
                              <Table.Td>{idx + 1}</Table.Td>
                              <Table.Td><Text size="sm" fw={500}>{inv.partyName}</Text></Table.Td>
                              <Table.Td><Badge size="sm" variant="light" color="orange">{inv.invoiceNumber}</Badge></Table.Td>
                              <Table.Td>{formatDate(inv.invoiceDate)}</Table.Td>
                              <Table.Td>{inv.placeOfSupply}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(inv.taxableValue)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text c="red.7">{formatCurrency(inv.cgst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text c="orange.7">{formatCurrency(inv.sgst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text c="blue.7">{formatCurrency(inv.igst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>{formatCurrency(inv.invoiceValue)}</Text></Table.Td>
                            </Table.Tr>
                          ))
                        )}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Paper>
              </Tabs.Panel>

              {/* B2CS Tab */}
              <Tabs.Panel value="b2cs" pt="md">
                <Paper withBorder>
                  <Box p="sm" style={{ backgroundColor: '#e8f5e9', borderBottom: '1px solid #a5d6a7' }}>
                    <Text fw={600} c="green.7">{reportData.sections.b2cs.title}</Text>
                    <Text size="xs" c="dimmed">{reportData.sections.b2cs.description}</Text>
                  </Box>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 40 }}>#</Table.Th>
                        <Table.Th>Place of Supply</Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>GST Rate</Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>Invoice Count</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Taxable Value</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>CGST</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>SGST</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>IGST</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(!reportData.sections.b2cs.grouped || reportData.sections.b2cs.grouped.length === 0) ? (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Center py="xl">
                              <Text c="dimmed">No B2C Small supplies for this period</Text>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        reportData.sections.b2cs.grouped.map((grp, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>{idx + 1}</Table.Td>
                            <Table.Td>{grp.placeOfSupply}</Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}><Badge variant="light">{grp.gstRate}%</Badge></Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>{grp.invoiceCount}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(grp.taxableValue)}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text c="red.7">{formatCurrency(grp.cgst)}</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text c="orange.7">{formatCurrency(grp.sgst)}</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}><Text c="blue.7">{formatCurrency(grp.igst)}</Text></Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                    {reportData.sections.b2cs.grouped?.length > 0 && (
                      <Table.Tfoot>
                        <Table.Tr style={{ backgroundColor: '#e8f5e9' }}>
                          <Table.Td colSpan={3} style={{ textAlign: 'right' }}><Text fw={700}>B2CS Total</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}><Text fw={700}>{reportData.sections.b2cs.summary.count}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.sections.b2cs.summary.taxableValue)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="red.7">{formatCurrency(reportData.sections.b2cs.summary.cgst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="orange.7">{formatCurrency(reportData.sections.b2cs.summary.sgst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="blue.7">{formatCurrency(reportData.sections.b2cs.summary.igst)}</Text></Table.Td>
                        </Table.Tr>
                      </Table.Tfoot>
                    )}
                  </Table>
                </Paper>
              </Tabs.Panel>

              {/* Nil Rated Tab */}
              <Tabs.Panel value="nilrated" pt="md">
                <Paper withBorder>
                  <Box p="sm" style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                    <Text fw={600} c="gray.7">{reportData.sections.nilRated.title}</Text>
                    <Text size="xs" c="dimmed">{reportData.sections.nilRated.description}</Text>
                  </Box>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 40 }}>#</Table.Th>
                        <Table.Th>Invoice No</Table.Th>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Party Name</Table.Th>
                        <Table.Th>Supply Type</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Value</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {reportData.sections.nilRated.supplies.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={6}>
                            <Center py="xl">
                              <Text c="dimmed">No nil rated/exempt supplies for this period</Text>
                            </Center>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        reportData.sections.nilRated.supplies.map((sup, idx) => (
                          <Table.Tr key={idx}>
                            <Table.Td>{idx + 1}</Table.Td>
                            <Table.Td><Badge size="sm" variant="light" color="gray">{sup.invoiceNumber}</Badge></Table.Td>
                            <Table.Td>{formatDate(sup.invoiceDate)}</Table.Td>
                            <Table.Td>{sup.partyName}</Table.Td>
                            <Table.Td><Badge color="gray">{sup.supplyType}</Badge></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(sup.invoiceValue)}</Table.Td>
                          </Table.Tr>
                        ))
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Tabs.Panel>
            </Tabs>
          </>
        )}

        {/* Empty State */}
        {!reportData && !loading && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size={80} variant="light" color="blue">
                <IconFileInvoice size={40} />
              </ThemeIcon>
              <Text c="dimmed" size="lg" fw={500}>Select a return period to generate GSTR-1</Text>
              <Button
                variant="light"
                onClick={fetchReport}
                style={{ backgroundColor: '#1565c0', color: 'white' }}
              >
                Generate This Month's GSTR-1
              </Button>
            </Stack>
          </Center>
        )}
      </Stack>
    </Container>
  );
};

export default VyaparGSTR1;
