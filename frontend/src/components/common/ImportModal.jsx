import { useState, useCallback } from 'react';
import { Modal, Stack, Text, Button, Group, Table, Alert, Progress } from '@mantine/core';
import { Dropzone, MIME_TYPES } from '@mantine/dropzone';
import { IconUpload, IconX, IconFileSpreadsheet, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { notifications } from '@mantine/notifications';

const ImportModal = ({
  isOpen,
  onClose,
  onImport,
  templateUrl = null,
  entityType = 'records',
  validationSchema = {},
  requiredFields = []
}) => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview, 3: Results

  const validateRow = (row, index) => {
    const rowErrors = [];

    // Check required fields
    requiredFields.forEach(field => {
      if (!row[field] || row[field] === '') {
        rowErrors.push({
          row: index + 2,
          field,
          message: `${field} is required`
        });
      }
    });

    // Apply validation schema
    Object.keys(validationSchema).forEach(field => {
      const value = row[field];
      const rules = validationSchema[field];

      if (!value && !rules.required) return;

      if (rules.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          rowErrors.push({
            row: index + 2,
            field,
            message: 'Invalid email format'
          });
        }
      }

      if (rules.type === 'phone' && value) {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(value.toString().replace(/\D/g, ''))) {
          rowErrors.push({
            row: index + 2,
            field,
            message: 'Phone must be 10 digits'
          });
        }
      }

      if (rules.type === 'number' && value) {
        if (isNaN(value)) {
          rowErrors.push({
            row: index + 2,
            field,
            message: 'Must be a number'
          });
        }
      }

      if (rules.min !== undefined && value < rules.min) {
        rowErrors.push({
          row: index + 2,
          field,
          message: `Must be at least ${rules.min}`
        });
      }

      if (rules.max !== undefined && value > rules.max) {
        rowErrors.push({
          row: index + 2,
          field,
          message: `Must be at most ${rules.max}`
        });
      }

      if (rules.pattern && value) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(value)) {
          rowErrors.push({
            row: index + 2,
            field,
            message: rules.patternMessage || 'Invalid format'
          });
        }
      }
    });

    return rowErrors;
  };

  const parseFile = useCallback((file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          notifications.show({
            title: 'Error',
            message: 'The file is empty',
            color: 'red'
          });
          return;
        }

        // Validate all rows
        const allErrors = [];
        jsonData.forEach((row, index) => {
          const rowErrors = validateRow(row, index);
          allErrors.push(...rowErrors);
        });

        setData(jsonData);
        setPreviewData(jsonData.slice(0, 10));
        setErrors(allErrors);
        setStep(2);

        if (allErrors.length > 0) {
          notifications.show({
            title: 'Validation Warnings',
            message: `Found ${allErrors.length} validation errors`,
            color: 'yellow'
          });
        } else {
          notifications.show({
            title: 'Ready to Import',
            message: `Ready to import ${jsonData.length} records`,
            color: 'green'
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Parse Error',
          message: 'Failed to parse file',
          color: 'red'
        });
        console.error(error);
      }
    };

    reader.onerror = () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to read file',
        color: 'red'
      });
    };

    reader.readAsArrayBuffer(file);
  }, [requiredFields, validationSchema]);

  const handleDrop = (files) => {
    const file = files[0];
    if (file) {
      setFile(file);
      parseFile(file);
    }
  };

  const handleImport = async () => {
    if (errors.length > 0) {
      notifications.show({
        title: 'Validation Errors',
        message: 'Please fix all validation errors before importing',
        color: 'red'
      });
      return;
    }

    setImporting(true);
    try {
      await onImport(data);
      setStep(3);
    } catch (error) {
      notifications.show({
        title: 'Import Failed',
        message: error.message || 'Import failed',
        color: 'red'
      });
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const handleImportValid = async () => {
    const errorRows = new Set(errors.map(e => e.row));
    const validData = data.filter((_, index) => !errorRows.has(index + 2));

    if (validData.length === 0) {
      notifications.show({
        title: 'No Valid Records',
        message: 'No valid records to import',
        color: 'red'
      });
      return;
    }

    setImporting(true);
    try {
      await onImport(validData);
      setStep(3);
      notifications.show({
        title: 'Import Successful',
        message: `Imported ${validData.length} valid records`,
        color: 'green'
      });
    } catch (error) {
      notifications.show({
        title: 'Import Failed',
        message: error.message || 'Import failed',
        color: 'red'
      });
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setData([]);
    setErrors([]);
    setPreviewData([]);
    setStep(1);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={`Import ${entityType}`}
      size="xl"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {/* Step 1: Upload */}
        {step === 1 && (
          <>
            <Dropzone
              onDrop={handleDrop}
              accept={[MIME_TYPES.xlsx, MIME_TYPES.xls, MIME_TYPES.csv]}
              maxSize={5 * 1024 * 1024}
              maxFiles={1}
            >
              <Group justify="center" gap="xl" style={{ minHeight: 200, pointerEvents: 'none' }}>
                <Dropzone.Accept>
                  <IconUpload size={50} stroke={1.5} />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX size={50} stroke={1.5} />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconFileSpreadsheet size={50} stroke={1.5} />
                </Dropzone.Idle>

                <div>
                  <Text size="lg" inline>
                    Drag & drop file here, or click to browse
                  </Text>
                  <Text size="sm" c="dimmed" inline mt={7}>
                    Supported formats: .xlsx, .xls, .csv (Max 5MB)
                  </Text>
                </div>
              </Group>
            </Dropzone>

            {templateUrl && (
              <Alert variant="light" color="blue" icon={<IconAlertCircle />}>
                <Text size="sm">Need help? Download our template file with sample data:</Text>
                <Button
                  component="a"
                  href={templateUrl}
                  download
                  variant="light"
                  size="xs"
                  mt="xs"
                >
                  Download Template
                </Button>
              </Alert>
            )}
          </>
        )}

        {/* Step 2: Preview & Validation */}
        {step === 2 && (
          <>
            <Group grow>
              <Alert color="blue">
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Total Rows</Text>
                  <Text size="lg" fw={700}>{data.length}</Text>
                </Stack>
              </Alert>
              <Alert color="green">
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Valid</Text>
                  <Text size="lg" fw={700}>
                    {data.length - new Set(errors.map(e => e.row)).size}
                  </Text>
                </Stack>
              </Alert>
              <Alert color="red">
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Errors</Text>
                  <Text size="lg" fw={700}>{errors.length}</Text>
                </Stack>
              </Alert>
            </Group>

            {errors.length > 0 && (
              <Alert color="red" title={`Validation Errors (${errors.length})`} icon={<IconAlertCircle />}>
                <Stack gap="xs" mt="xs">
                  {errors.slice(0, 10).map((error, index) => (
                    <Text key={index} size="sm">
                      Row {error.row} - <strong>{error.field}</strong>: {error.message}
                    </Text>
                  ))}
                  {errors.length > 10 && (
                    <Text size="sm" c="dimmed">And {errors.length - 10} more errors...</Text>
                  )}
                </Stack>
              </Alert>
            )}

            <Stack gap="xs">
              <Text fw={500}>Preview (First 10 rows)</Text>
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      {previewData.length > 0 &&
                        Object.keys(previewData[0]).map((key) => (
                          <Table.Th key={key}>{key}</Table.Th>
                        ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {previewData.map((row, index) => (
                      <Table.Tr key={index}>
                        {Object.values(row).map((value, i) => (
                          <Table.Td key={i}>{value}</Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            </Stack>
          </>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <Stack align="center" py="xl">
            <IconCheck size={64} color="var(--mantine-color-green-6)" />
            <Text size="xl" fw={700}>Import Completed!</Text>
            <Text size="sm" c="dimmed">
              Successfully imported {data.length} {entityType}
            </Text>
          </Stack>
        )}

        {/* Footer Actions */}
        <Group justify="space-between" mt="md">
          {step === 1 && (
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === 2 && (
            <>
              <Button variant="default" onClick={handleReset}>
                Choose Different File
              </Button>
              <Group gap="sm">
                {errors.length > 0 && (
                  <Button
                    color="yellow"
                    onClick={handleImportValid}
                    loading={importing}
                  >
                    Import Valid Only
                  </Button>
                )}
                <Button
                  onClick={handleImport}
                  loading={importing}
                  disabled={errors.length > 0}
                >
                  Import All ({data.length})
                </Button>
              </Group>
            </>
          )}

          {step === 3 && (
            <Button onClick={handleClose} fullWidth>
              Done
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
};

export default ImportModal;
