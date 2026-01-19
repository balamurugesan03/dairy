import { useState } from 'react';
import { Menu, Button, Text, Stack, Loader } from '@mantine/core';
import { IconDownload, IconFileTypeCsv, IconFileTypeXls, IconFileTypePdf } from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { notifications } from '@mantine/notifications';

const ExportMenu = ({
  data,
  columns,
  filename = 'export',
  selectedOnly = false,
  title = '',
  onExport = null
}) => {
  const [exporting, setExporting] = useState(false);

  const formatDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  const exportToExcel = () => {
    try {
      setExporting(true);

      const exportData = data.map(row => {
        const exportRow = {};
        columns.forEach(col => {
          if (col.export !== false) {
            const key = col.dataKey || col.key || col.field;
            const label = col.label || col.title || key;
            let value = row[key];

            if (col.render && typeof col.render === 'function') {
              value = col.render(row);
              if (typeof value === 'object') {
                value = '';
              }
            }

            exportRow[label] = value || '';
          }
        });
        return exportRow;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');

      const colWidths = columns.map(col => ({
        wch: Math.max(15, (col.label || col.title || '').length + 2)
      }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `${filename}_${formatDate()}.xlsx`);

      notifications.show({
        title: 'Export Successful',
        message: `Exported ${data.length} records to Excel`,
        color: 'green'
      });

      if (onExport) onExport('excel', data.length);
    } catch (error) {
      notifications.show({
        title: 'Export Failed',
        message: 'Failed to export to Excel',
        color: 'red'
      });
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const exportToCSV = () => {
    try {
      setExporting(true);

      const headers = columns
        .filter(col => col.export !== false)
        .map(col => col.label || col.title || col.key);

      const rows = data.map(row => {
        return columns
          .filter(col => col.export !== false)
          .map(col => {
            const key = col.dataKey || col.key || col.field;
            let value = row[key];

            if (col.render && typeof col.render === 'function') {
              value = col.render(row);
              if (typeof value === 'object') {
                value = '';
              }
            }

            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${formatDate()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      notifications.show({
        title: 'Export Successful',
        message: `Exported ${data.length} records to CSV`,
        color: 'green'
      });

      if (onExport) onExport('csv', data.length);
    } catch (error) {
      notifications.show({
        title: 'Export Failed',
        message: 'Failed to export to CSV',
        color: 'red'
      });
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    try {
      setExporting(true);

      const doc = new jsPDF('landscape');

      doc.setFontSize(18);
      doc.text(title || filename, 14, 20);

      doc.setFontSize(10);
      doc.text(`Exported on: ${new Date().toLocaleDateString()}`, 14, 28);

      const headers = [columns
        .filter(col => col.export !== false)
        .map(col => col.label || col.title || col.key)
      ];

      const rows = data.map(row => {
        return columns
          .filter(col => col.export !== false)
          .map(col => {
            const key = col.dataKey || col.key || col.field;
            let value = row[key];

            if (col.render && typeof col.render === 'function') {
              value = col.render(row);
              if (typeof value === 'object') {
                value = '';
              }
            }

            return value || '';
          });
      });

      doc.autoTable({
        startY: 35,
        head: headers,
        body: rows,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { top: 35, right: 10, bottom: 20, left: 10 }
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`${filename}_${formatDate()}.pdf`);

      notifications.show({
        title: 'Export Successful',
        message: `Exported ${data.length} records to PDF`,
        color: 'green'
      });

      if (onExport) onExport('pdf', data.length);
    } catch (error) {
      notifications.show({
        title: 'Export Failed',
        message: 'Failed to export to PDF',
        color: 'red'
      });
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Menu position="bottom-end" shadow="md">
      <Menu.Target>
        <Button
          variant="default"
          leftSection={exporting ? <Loader size={16} /> : <IconDownload size={16} />}
          disabled={exporting || !data || data.length === 0}
        >
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          Export as
          {selectedOnly && <Text component="span" size="xs" c="blue" ml="xs">(Selected Only)</Text>}
        </Menu.Label>
        <Menu.Item
          leftSection={<IconFileTypeXls size={20} />}
          onClick={exportToExcel}
        >
          <Stack gap={2}>
            <Text size="sm" fw={500}>Excel</Text>
            <Text size="xs" c="dimmed">Export to .xlsx format</Text>
          </Stack>
        </Menu.Item>

        <Menu.Item
          leftSection={<IconFileTypeCsv size={20} />}
          onClick={exportToCSV}
        >
          <Stack gap={2}>
            <Text size="sm" fw={500}>CSV</Text>
            <Text size="xs" c="dimmed">Export to .csv format</Text>
          </Stack>
        </Menu.Item>

        <Menu.Item
          leftSection={<IconFileTypePdf size={20} />}
          onClick={exportToPDF}
        >
          <Stack gap={2}>
            <Text size="sm" fw={500}>PDF</Text>
            <Text size="xs" c="dimmed">Export to .pdf format</Text>
          </Stack>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default ExportMenu;
