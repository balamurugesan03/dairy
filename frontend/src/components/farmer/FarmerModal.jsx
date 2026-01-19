import { useState, useEffect } from 'react';
import {
  Modal,
  Stepper,
  Button,
  Group,
  TextInput,
  Select,
  NumberInput,
  FileInput,
  Stack,
  Grid,
  Text,
  Box,
  rem
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { IconUpload, IconX, IconTrash } from '@tabler/icons-react';
import { farmerAPI, collectionCenterAPI } from '../../services/api';
import { message } from '../../utils/toast';

const FarmerModal = ({ isOpen, onClose, onSuccess, farmerId = null }) => {
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [additionalDocs, setAdditionalDocs] = useState([]);

  const isEditMode = Boolean(farmerId);

  const form = useForm({
    initialValues: {
      farmerNumber: '',
      memberId: '',
      farmerType: '',
      cowType: '',
      collectionCenter: '',
      admissionDate: null,
      personalDetails: {
        name: '',
        fatherName: '',
        age: '',
        dob: null,
        gender: '',
        phone: ''
      },
      address: {
        ward: '',
        village: '',
        panchayat: '',
        pin: ''
      },
      identityDetails: {
        aadhaar: '',
        pan: '',
        welfareNo: '',
        ksheerasreeId: '',
        idCardNumber: '',
        issueDate: null
      },
      bankDetails: {
        accountNumber: '',
        bankName: '',
        branch: '',
        ifsc: ''
      },
      financialDetails: {
        numberOfShares: 0,
        shareValue: 0,
        resolutionNo: '',
        resolutionDate: null,
        admissionFee: 0
      },
      documents: {
        aadhaar: null,
        bankPassbook: null,
        rationCard: null,
        incomeProof: null
      }
    },
    validate: (values) => {
      if (active === 0) {
        return {
          farmerNumber: !values.farmerNumber ? 'Farmer number is required' : null,
          memberId: !values.memberId ? 'Member ID is required' : null,
          'personalDetails.name': !values.personalDetails.name ? 'Name is required' : null,
          'personalDetails.phone': values.personalDetails.phone && !/^[0-9]{10}$/.test(values.personalDetails.phone)
            ? 'Please enter valid 10-digit phone number' : null
        };
      }
      if (active === 1) {
        return {
          'address.pin': values.address.pin && !/^[0-9]{6}$/.test(values.address.pin)
            ? 'Please enter valid 6-digit PIN code' : null
        };
      }
      if (active === 2) {
        return {
          'identityDetails.aadhaar': values.identityDetails.aadhaar && !/^[0-9]{12}$/.test(values.identityDetails.aadhaar)
            ? 'Please enter valid 12-digit Aadhaar number' : null,
          'identityDetails.pan': values.identityDetails.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(values.identityDetails.pan)
            ? 'Please enter valid PAN number' : null
        };
      }
      if (active === 4) {
        return {
          'bankDetails.ifsc': values.bankDetails.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.bankDetails.ifsc)
            ? 'Please enter valid IFSC code' : null
        };
      }
      return {};
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchCollectionCenters();
      if (isEditMode) {
        fetchFarmer();
      } else {
        resetForm();
      }
    }
  }, [isOpen, farmerId]);

  const resetForm = () => {
    form.reset();
    setActive(0);
    setAdditionalDocs([]);
  };

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll({ status: 'Active', limit: 100 });
      setCollectionCenters(response.data || []);
    } catch (error) {
      console.error('Failed to fetch collection centers:', error);
    }
  };

  const fetchFarmer = async () => {
    setLoading(true);
    try {
      const response = await farmerAPI.getById(farmerId);
      const farmer = response.data;

      form.setValues({
        farmerNumber: farmer.farmerNumber,
        memberId: farmer.memberId,
        farmerType: farmer.farmerType,
        cowType: farmer.cowType,
        collectionCenter: farmer.collectionCenter?._id || '',
        admissionDate: farmer.admissionDate ? new Date(farmer.admissionDate) : null,
        personalDetails: {
          name: farmer.personalDetails?.name || '',
          fatherName: farmer.personalDetails?.fatherName || '',
          age: farmer.personalDetails?.age || '',
          dob: farmer.personalDetails?.dob ? new Date(farmer.personalDetails.dob) : null,
          gender: farmer.personalDetails?.gender || '',
          phone: farmer.personalDetails?.phone || ''
        },
        address: {
          ward: farmer.address?.ward || '',
          village: farmer.address?.village || '',
          panchayat: farmer.address?.panchayat || '',
          pin: farmer.address?.pin || ''
        },
        identityDetails: {
          aadhaar: farmer.identityDetails?.aadhaar || '',
          pan: farmer.identityDetails?.pan || '',
          welfareNo: farmer.identityDetails?.welfareNo || '',
          ksheerasreeId: farmer.identityDetails?.ksheerasreeId || '',
          idCardNumber: farmer.identityDetails?.idCardNumber || '',
          issueDate: farmer.identityDetails?.issueDate ? new Date(farmer.identityDetails.issueDate) : null
        },
        bankDetails: {
          accountNumber: farmer.bankDetails?.accountNumber || '',
          bankName: farmer.bankDetails?.bankName || '',
          branch: farmer.bankDetails?.branch || '',
          ifsc: farmer.bankDetails?.ifsc || ''
        },
        financialDetails: {
          numberOfShares: farmer.financialDetails?.numberOfShares || 0,
          shareValue: farmer.financialDetails?.shareValue || 0,
          resolutionNo: farmer.financialDetails?.resolutionNo || '',
          resolutionDate: farmer.financialDetails?.resolutionDate ? new Date(farmer.financialDetails.resolutionDate) : null,
          admissionFee: farmer.financialDetails?.admissionFee || 0
        },
        documents: {
          aadhaar: farmer.documents?.aadhaar || null,
          bankPassbook: farmer.documents?.bankPassbook || null,
          rationCard: farmer.documents?.rationCard || null,
          incomeProof: farmer.documents?.incomeProof || null
        }
      });

      if (farmer.documents?.additionalDocuments) {
        setAdditionalDocs(farmer.documents.additionalDocuments);
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch farmer details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const nextStep = () => {
    const validation = form.validate();
    if (!validation.hasErrors) {
      setActive((current) => (current < 6 ? current + 1 : current));
    }
  };

  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  const handleSubmit = async () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      message.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const values = form.values;

      // Convert file objects to base64
      const documents = {};
      for (const key in values.documents) {
        if (values.documents[key] instanceof File) {
          documents[key] = await handleFileToBase64(values.documents[key]);
        } else {
          documents[key] = values.documents[key];
        }
      }

      const payload = {
        farmerNumber: values.farmerNumber,
        memberId: values.memberId,
        personalDetails: {
          name: values.personalDetails.name,
          fatherName: values.personalDetails.fatherName,
          age: parseInt(values.personalDetails.age) || null,
          dob: values.personalDetails.dob ? values.personalDetails.dob.toISOString() : null,
          gender: values.personalDetails.gender,
          phone: values.personalDetails.phone
        },
        address: {
          ward: values.address.ward,
          village: values.address.village,
          panchayat: values.address.panchayat,
          pin: values.address.pin
        },
        identityDetails: {
          aadhaar: values.identityDetails.aadhaar,
          pan: values.identityDetails.pan,
          welfareNo: values.identityDetails.welfareNo,
          ksheerasreeId: values.identityDetails.ksheerasreeId,
          idCardNumber: values.identityDetails.idCardNumber,
          issueDate: values.identityDetails.issueDate ? values.identityDetails.issueDate.toISOString() : null
        },
        farmerType: values.farmerType,
        cowType: values.cowType,
        collectionCenter: values.collectionCenter || null,
        admissionDate: values.admissionDate ? values.admissionDate.toISOString() : null,
        bankDetails: {
          accountNumber: values.bankDetails.accountNumber,
          bankName: values.bankDetails.bankName,
          branch: values.bankDetails.branch,
          ifsc: values.bankDetails.ifsc
        },
        financialDetails: {
          numberOfShares: parseFloat(values.financialDetails.numberOfShares) || 0,
          shareValue: parseFloat(values.financialDetails.shareValue) || 0,
          resolutionNo: values.financialDetails.resolutionNo,
          resolutionDate: values.financialDetails.resolutionDate ? values.financialDetails.resolutionDate.toISOString() : null,
          admissionFee: parseFloat(values.financialDetails.admissionFee) || 0
        },
        documents: {
          ...documents,
          additionalDocuments: additionalDocs
        }
      };

      if (isEditMode) {
        await farmerAPI.update(farmerId, payload);
        message.success('Farmer updated successfully');
      } else {
        await farmerAPI.create(payload);
        message.success('Farmer created successfully');
      }
      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      message.error(error.message || 'Failed to save farmer');
    } finally {
      setLoading(false);
    }
  };

  const handleSharesChange = (value) => {
    const shares = parseFloat(value) || 0;
    const calculatedShareValue = shares * 10;
    form.setFieldValue('financialDetails.numberOfShares', value);
    form.setFieldValue('financialDetails.shareValue', calculatedShareValue);
  };

  const addAdditionalDocument = () => {
    if (additionalDocs.length < 5) {
      setAdditionalDocs([...additionalDocs, '']);
    }
  };

  const removeAdditionalDocument = (index) => {
    const newDocs = [...additionalDocs];
    newDocs.splice(index, 1);
    setAdditionalDocs(newDocs);
  };

  const handleAdditionalDocChange = async (index, file) => {
    if (file) {
      const base64 = await handleFileToBase64(file);
      const newDocs = [...additionalDocs];
      newDocs[index] = base64;
      setAdditionalDocs(newDocs);
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Farmer' : 'Add New Farmer'}
      size="xl"
      padding="lg"
    >
      <Stepper active={active} onStepClick={setActive} breakpoint="sm">
        <Stepper.Step label="Personal Details" description="Basic information">
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Farmer Number"
                  placeholder="Enter farmer number"
                  required
                  disabled={isEditMode}
                  {...form.getInputProps('farmerNumber')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Member ID"
                  placeholder="Enter member ID"
                  required
                  {...form.getInputProps('memberId')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Name"
                  placeholder="Enter name"
                  required
                  {...form.getInputProps('personalDetails.name')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Father's Name"
                  placeholder="Enter father's name"
                  {...form.getInputProps('personalDetails.fatherName')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Age"
                  placeholder="Enter age"
                  min={0}
                  max={100}
                  {...form.getInputProps('personalDetails.age')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <DatePickerInput
                  label="Date of Birth"
                  placeholder="Select date"
                  {...form.getInputProps('personalDetails.dob')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Gender"
                  placeholder="Select gender"
                  data={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                    { value: 'Other', label: 'Other' }
                  ]}
                  {...form.getInputProps('personalDetails.gender')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Phone"
                  placeholder="Enter phone number"
                  maxLength={10}
                  {...form.getInputProps('personalDetails.phone')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Address" description="Location details">
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Ward"
                  placeholder="Enter ward"
                  {...form.getInputProps('address.ward')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Village"
                  placeholder="Enter village"
                  {...form.getInputProps('address.village')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Panchayat"
                  placeholder="Enter panchayat"
                  {...form.getInputProps('address.panchayat')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="PIN Code"
                  placeholder="Enter PIN code"
                  maxLength={6}
                  {...form.getInputProps('address.pin')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Identity Details" description="ID information">
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Aadhaar Number"
                  placeholder="Enter Aadhaar number"
                  maxLength={12}
                  {...form.getInputProps('identityDetails.aadhaar')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="PAN Number"
                  placeholder="Enter PAN number"
                  maxLength={10}
                  style={{ textTransform: 'uppercase' }}
                  {...form.getInputProps('identityDetails.pan')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Welfare Number"
                  placeholder="Enter welfare number"
                  {...form.getInputProps('identityDetails.welfareNo')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Ksheerasree ID"
                  placeholder="Enter Ksheerasree ID"
                  {...form.getInputProps('identityDetails.ksheerasreeId')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="ID Card Number"
                  placeholder="Enter ID card number"
                  {...form.getInputProps('identityDetails.idCardNumber')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <DatePickerInput
                  label="Issue Date"
                  placeholder="Select date"
                  {...form.getInputProps('identityDetails.issueDate')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Farmer Type" description="Classification">
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="Farmer Type"
                  placeholder="Select farmer type"
                  data={[
                    { value: 'A', label: 'Individual Farmer' },
                    { value: 'B', label: 'Farm' },
                    { value: 'C', label: 'Institution' },
                    { value: 'D', label: 'SHG' },
                    { value: 'E', label: 'Others' }
                  ]}
                  {...form.getInputProps('farmerType')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Cow Type"
                  placeholder="Select cow type"
                  data={[
                    { value: 'Desi', label: 'Desi' },
                    { value: 'Crossbreed', label: 'Crossbreed' },
                    { value: 'Jersey', label: 'Jersey' },
                    { value: 'HF', label: 'HF (Holstein Friesian)' }
                  ]}
                  {...form.getInputProps('cowType')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Collection Center"
                  placeholder="Select collection center"
                  data={collectionCenters.map(c => ({
                    value: c._id,
                    label: `${c.centerName} (${c.centerType})`
                  }))}
                  searchable
                  {...form.getInputProps('collectionCenter')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <DatePickerInput
                  label="Admission Date"
                  placeholder="Select date"
                  {...form.getInputProps('admissionDate')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Bank Details" description="Banking information">
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Account Number"
                  placeholder="Enter account number"
                  {...form.getInputProps('bankDetails.accountNumber')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Bank Name"
                  placeholder="Enter bank name"
                  {...form.getInputProps('bankDetails.bankName')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Branch"
                  placeholder="Enter branch"
                  {...form.getInputProps('bankDetails.branch')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="IFSC Code"
                  placeholder="Enter IFSC code"
                  maxLength={11}
                  style={{ textTransform: 'uppercase' }}
                  {...form.getInputProps('bankDetails.ifsc')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Financial Details" description="Shares information">
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <NumberInput
                  label="Number of Shares"
                  placeholder="Enter number of shares"
                  min={0}
                  value={form.values.financialDetails.numberOfShares}
                  onChange={handleSharesChange}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Share Value (Auto-calculated)"
                  value={form.values.financialDetails.shareValue}
                  disabled
                  description="Calculated as: Number of Shares × 10"
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Admission Fee"
                  placeholder="Enter admission fee"
                  min={0}
                  {...form.getInputProps('financialDetails.admissionFee')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Resolution Number"
                  placeholder="Enter resolution number"
                  {...form.getInputProps('financialDetails.resolutionNo')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <DatePickerInput
                  label="Resolution Date"
                  placeholder="Select date"
                  {...form.getInputProps('financialDetails.resolutionDate')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Documents" description="Upload files">
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <FileInput
                  label="Aadhaar Document"
                  placeholder="Upload file"
                  leftSection={<IconUpload size={rem(14)} />}
                  accept="image/*,.pdf"
                  {...form.getInputProps('documents.aadhaar')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <FileInput
                  label="Bank Passbook"
                  placeholder="Upload file"
                  leftSection={<IconUpload size={rem(14)} />}
                  accept="image/*,.pdf"
                  {...form.getInputProps('documents.bankPassbook')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <FileInput
                  label="Ration Card"
                  placeholder="Upload file"
                  leftSection={<IconUpload size={rem(14)} />}
                  accept="image/*,.pdf"
                  {...form.getInputProps('documents.rationCard')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <FileInput
                  label="Income Proof"
                  placeholder="Upload file"
                  leftSection={<IconUpload size={rem(14)} />}
                  accept="image/*,.pdf"
                  {...form.getInputProps('documents.incomeProof')}
                />
              </Grid.Col>
            </Grid>

            <Box mt="md">
              <Group justify="space-between" mb="sm">
                <Text fw={500}>Additional Documents (Max 5)</Text>
                {additionalDocs.length < 5 && (
                  <Button size="xs" variant="light" onClick={addAdditionalDocument}>
                    Add Document ({additionalDocs.length}/5)
                  </Button>
                )}
              </Group>

              <Stack gap="xs">
                {additionalDocs.map((doc, index) => (
                  <Group key={index}>
                    <FileInput
                      placeholder="Upload file"
                      leftSection={<IconUpload size={rem(14)} />}
                      accept="image/*,.pdf"
                      onChange={(file) => handleAdditionalDocChange(index, file)}
                      style={{ flex: 1 }}
                    />
                    <Button
                      color="red"
                      variant="subtle"
                      onClick={() => removeAdditionalDocument(index)}
                      leftSection={<IconTrash size={rem(14)} />}
                    >
                      Remove
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Stepper.Step>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={prevStep} disabled={active === 0}>
          Previous
        </Button>
        <Group>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          {active < 6 ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} loading={loading}>
              {isEditMode ? 'Update' : 'Save'}
            </Button>
          )}
        </Group>
      </Group>
    </Modal>
  );
};

export default FarmerModal;
