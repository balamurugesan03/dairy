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
  Checkbox,
  Alert,
  Loader,
  Avatar,
  ActionIcon,
  rem
} from '@mantine/core';
import { IconCamera, IconX } from '@tabler/icons-react';
import { IconInfoCircle } from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { IconUpload, IconTrash } from '@tabler/icons-react';
import { farmerAPI, collectionCenterAPI } from '../../services/api';
import { message } from '../../utils/toast';

const FarmerModal = ({ isOpen, onClose, onSuccess, farmerId = null }) => {
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [additionalDocs, setAdditionalDocs] = useState([]);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [pincodeOptions, setPincodeOptions] = useState([]);

  const isEditMode = Boolean(farmerId);

  const form = useForm({
    initialValues: {
      farmerNumber: '',
      memberId: '',
      isMembership: false,
      membershipDate: null,
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
        phone: '',
        caste: '',
        photo: null,
        nomineeName: '',
        nomineeRelation: ''
      },
      address: {
        houseName: '',
        ward: '',
        place: '',
        post: '',
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
        isMembership: farmer.isMembership || false,
        membershipDate: farmer.membershipDate ? new Date(farmer.membershipDate) : null,
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
          phone: farmer.personalDetails?.phone || '',
          caste: farmer.personalDetails?.caste || '',
          photo: farmer.personalDetails?.photo || null,
          nomineeName: farmer.personalDetails?.nomineeName || '',
          nomineeRelation: farmer.personalDetails?.nomineeRelation || ''
        },
        address: {
          houseName: farmer.address?.houseName || '',
          ward: farmer.address?.ward || '',
          place: farmer.address?.place || '',
          post: farmer.address?.post || '',
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
          numberOfShares: farmer.financialDetails?.totalShares || farmer.financialDetails?.oldShares || 0,
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

  const toISOString = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return new Date(value).toISOString();
    return null;
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
          dob: toISOString(values.personalDetails.dob),
          gender: values.personalDetails.gender,
          phone: values.personalDetails.phone,
          caste: values.personalDetails.caste,
          photo: values.personalDetails.photo,
          nomineeName: values.personalDetails.nomineeName,
          nomineeRelation: values.personalDetails.nomineeRelation
        },
        address: {
          houseName: values.address.houseName,
          ward: values.address.ward,
          place: values.address.place,
          post: values.address.post,
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
          issueDate: toISOString(values.identityDetails.issueDate)
        },
        isMembership: values.isMembership,
        membershipDate: values.isMembership ? toISOString(values.membershipDate) : null,
        farmerType: values.farmerType,
        cowType: values.cowType,
        collectionCenter: values.collectionCenter || null,
        admissionDate: toISOString(values.admissionDate),
        bankDetails: {
          accountNumber: values.bankDetails.accountNumber,
          bankName: values.bankDetails.bankName,
          branch: values.bankDetails.branch,
          ifsc: values.bankDetails.ifsc
        },
        financialDetails: {
          oldShares: parseFloat(values.financialDetails.numberOfShares) || 0,
          totalShares: parseFloat(values.financialDetails.numberOfShares) || 0,
          shareValue: parseFloat(values.financialDetails.shareValue) || 0,
          resolutionNo: values.financialDetails.resolutionNo,
          resolutionDate: toISOString(values.financialDetails.resolutionDate),
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

  const calculateAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age : '';
  };

  const handleDobChange = (date) => {
    form.setFieldValue('personalDetails.dob', date);
    form.setFieldValue('personalDetails.age', calculateAge(date));
  };

  const handleAgeChange = (value) => {
    const age = parseInt(value) || 0;
    form.setFieldValue('personalDetails.age', age);
    if (age > 0) {
      const dob = new Date();
      dob.setFullYear(dob.getFullYear() - age);
      form.setFieldValue('personalDetails.dob', dob);
    }
  };

  const handleSharesChange = (value) => {
    form.setFieldValue('financialDetails.numberOfShares', value);
    form.setFieldValue('financialDetails.shareValue', (parseFloat(value) || 0) * 10);
  };

  const handlePincodeChange = async (value) => {
    form.setFieldValue('address.pin', value);
    setPincodeOptions([]);
    if (value.length === 6) {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${value}`);
        const data = await res.json();
        if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
          const offices = data[0].PostOffice;
          form.setFieldValue('address.panchayat', offices[0].Block || offices[0].Taluk || '');
          if (offices.length === 1) {
            form.setFieldValue('address.village', offices[0].Name);
          } else {
            setPincodeOptions(offices);
            form.setFieldValue('address.village', offices[0].Name);
          }
        } else {
          message.error('Invalid PIN code or no data found');
        }
      } catch {
        message.error('Failed to fetch pincode data');
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const handleVillageSelect = (officeName) => {
    form.setFieldValue('address.village', officeName);
    const office = pincodeOptions.find(o => o.Name === officeName);
    if (office) form.setFieldValue('address.panchayat', office.Block || office.Taluk || '');
  };

  const addAdditionalDocument = () => {
    if (additionalDocs.length < 5) setAdditionalDocs([...additionalDocs, '']);
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

  const focusNext = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const container = e.target.closest('.farmer-modal-body');
      if (!container) return;
      const inputs = Array.from(container.querySelectorAll('input:not([disabled]):not([type="hidden"]), select:not([disabled])'));
      const idx = inputs.indexOf(e.target);
      if (idx !== -1 && idx < inputs.length - 1) inputs[idx + 1].focus();
    }
  };

  const handleFarmerNumberKeyDown = (e) => {
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (!allowedKeys.includes(e.key) && !/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    focusNext(e);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Farmer' : 'Add New Farmer'}
      size="xl"
      padding="lg"
    >
      <div className="farmer-modal-body">
        <Stepper active={active} onStepClick={setActive} breakpoint="sm">
          <Stepper.Step label="Personal Details" description="Basic information">
            <Stack gap="md" mt="md">
              {/* Photo Upload */}
              <Group justify="center">
                <Box style={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar
                    src={form.values.personalDetails.photo}
                    size={90}
                    radius={90}
                    style={{ border: '2px solid #dee2e6', cursor: 'pointer' }}
                    onClick={() => document.getElementById('farmer-photo-input-modal').click()}
                  >
                    <IconCamera size={32} color="#adb5bd" />
                  </Avatar>
                  {form.values.personalDetails.photo && (
                    <ActionIcon
                      size="xs"
                      color="red"
                      variant="filled"
                      radius="xl"
                      style={{ position: 'absolute', top: 0, right: 0 }}
                      onClick={() => form.setFieldValue('personalDetails.photo', null)}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  )}
                  <input
                    id="farmer-photo-input-modal"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const base64 = await handleFileToBase64(file);
                        form.setFieldValue('personalDetails.photo', base64);
                      }
                      e.target.value = '';
                    }}
                  />
                </Box>
              </Group>
              <Text size="xs" c="dimmed" ta="center" mt={-8}>Click photo to upload</Text>
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Farmer Number"
                    placeholder="Enter farmer number"
                    required
                    disabled={isEditMode}
                    {...form.getInputProps('farmerNumber')}
                    onKeyDown={handleFarmerNumberKeyDown}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Name"
                    placeholder="Enter name"
                    required
                    {...form.getInputProps('personalDetails.name')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Father's Name"
                    placeholder="Enter father's name"
                    {...form.getInputProps('personalDetails.fatherName')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Age"
                    placeholder="Enter age"
                    min={0}
                    max={150}
                    value={form.values.personalDetails.age}
                    onChange={handleAgeChange}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <DatePickerInput
                    label="Date of Birth"
                    placeholder="Select date"
                    value={form.values.personalDetails.dob}
                    onChange={handleDobChange}
                    maxDate={new Date()}
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
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Caste"
                    placeholder="Select caste"
                    data={[
                      { value: 'General', label: 'General' },
                      { value: 'OBC', label: 'OBC' },
                      { value: 'SC', label: 'SC' },
                      { value: 'ST', label: 'ST' },
                      { value: 'Others', label: 'Others' }
                    ]}
                    {...form.getInputProps('personalDetails.caste')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Collection Centre"
                    placeholder="Select collection centre"
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
                <Grid.Col span={6}>
                  <TextInput
                    label="Name of Nominee"
                    placeholder="Enter nominee name"
                    {...form.getInputProps('personalDetails.nomineeName')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Relation with Producer"
                    placeholder="e.g. Son, Daughter, Spouse"
                    {...form.getInputProps('personalDetails.nomineeRelation')}
                    onKeyDown={focusNext}
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
                    label="House Name"
                    placeholder="Enter house name"
                    {...form.getInputProps('address.houseName')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Ward"
                    placeholder="Enter ward"
                    {...form.getInputProps('address.ward')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Place"
                    placeholder="Enter place"
                    {...form.getInputProps('address.place')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Post"
                    placeholder="Enter post office"
                    {...form.getInputProps('address.post')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  {pincodeOptions.length > 1 ? (
                    <Select
                      label="Village / Post Office"
                      placeholder="Select post office"
                      data={pincodeOptions.map(o => ({ value: o.Name, label: o.Name }))}
                      value={form.values.address.village}
                      onChange={handleVillageSelect}
                      searchable
                    />
                  ) : (
                    <TextInput
                      label="Village"
                      placeholder="Enter village"
                      {...form.getInputProps('address.village')}
                      onKeyDown={focusNext}
                    />
                  )}
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Taluk"
                    placeholder="Auto-filled from PIN code"
                    {...form.getInputProps('address.panchayat')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="PIN Code"
                    placeholder="Enter 6-digit PIN code"
                    maxLength={6}
                    value={form.values.address.pin}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    error={form.errors['address.pin']}
                    rightSection={pincodeLoading ? <Loader size="xs" /> : null}
                    onKeyDown={focusNext}
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
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="PAN Number"
                    placeholder="Enter PAN number"
                    maxLength={10}
                    {...form.getInputProps('identityDetails.pan')}
                    onChange={(e) => form.setFieldValue('identityDetails.pan', e.target.value.toUpperCase())}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Welfare Number"
                    placeholder="Enter welfare number"
                    {...form.getInputProps('identityDetails.welfareNo')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Ksheerasree ID"
                    placeholder="Enter Ksheerasree ID"
                    {...form.getInputProps('identityDetails.ksheerasreeId')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="ID Card Number"
                    placeholder="Enter ID card number"
                    {...form.getInputProps('identityDetails.idCardNumber')}
                    onKeyDown={focusNext}
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
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Bank Name"
                    placeholder="Enter bank name"
                    {...form.getInputProps('bankDetails.bankName')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Branch"
                    placeholder="Enter branch"
                    {...form.getInputProps('bankDetails.branch')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="IFSC Code"
                    placeholder="Enter IFSC code"
                    maxLength={11}
                    {...form.getInputProps('bankDetails.ifsc')}
                    onChange={(e) => form.setFieldValue('bankDetails.ifsc', e.target.value.toUpperCase())}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Financial Details" description="Shares information">
            <Stack gap="md" mt="md">
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label={
                      <Group gap="xs" mb={2}>
                        <span>Member Number</span>
                        <Checkbox
                          size="xs"
                          label="Is Member"
                          checked={form.values.isMembership}
                          onChange={(e) => {
                            form.setFieldValue('isMembership', e.currentTarget.checked);
                            if (!e.currentTarget.checked) form.setFieldValue('membershipDate', null);
                          }}
                          styles={{ label: { fontWeight: 400, fontSize: 12 } }}
                        />
                      </Group>
                    }
                    placeholder="Tick 'Is Member' to enable"
                    disabled={!form.values.isMembership}
                    {...form.getInputProps('memberId')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                {form.values.isMembership && (
                  <Grid.Col span={6}>
                    <DatePickerInput
                      label="Membership Date"
                      placeholder="Select membership date"
                      {...form.getInputProps('membershipDate')}
                    />
                  </Grid.Col>
                )}
              </Grid>

              {!form.values.isMembership && (
                <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
                  Enable "Is Member" above to enter share and financial information.
                </Alert>
              )}

              <Grid>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Number of Shares"
                    placeholder="Enter number of shares"
                    min={0}
                    disabled={!form.values.isMembership}
                    value={form.values.financialDetails.numberOfShares}
                    onChange={handleSharesChange}
                    onKeyDown={focusNext}
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
                    disabled={!form.values.isMembership}
                    {...form.getInputProps('financialDetails.admissionFee')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Resolution Number"
                    placeholder="Enter resolution number"
                    disabled={!form.values.isMembership}
                    {...form.getInputProps('financialDetails.resolutionNo')}
                    onKeyDown={focusNext}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <DatePickerInput
                    label="Resolution Date"
                    placeholder="Select date"
                    disabled={!form.values.isMembership}
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
                    leftSection={<IconUpload size={14} />}
                    accept="image/*,.pdf"
                    {...form.getInputProps('documents.aadhaar')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FileInput
                    label="Bank Passbook"
                    placeholder="Upload file"
                    leftSection={<IconUpload size={14} />}
                    accept="image/*,.pdf"
                    {...form.getInputProps('documents.bankPassbook')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FileInput
                    label="Ration Card"
                    placeholder="Upload file"
                    leftSection={<IconUpload size={14} />}
                    accept="image/*,.pdf"
                    {...form.getInputProps('documents.rationCard')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <FileInput
                    label="Income Proof"
                    placeholder="Upload file"
                    leftSection={<IconUpload size={14} />}
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
                        leftSection={<IconUpload size={14} />}
                        accept="image/*,.pdf"
                        onChange={(file) => handleAdditionalDocChange(index, file)}
                        style={{ flex: 1 }}
                      />
                      <Button
                        color="red"
                        variant="subtle"
                        onClick={() => removeAdditionalDocument(index)}
                        leftSection={<IconTrash size={14} />}
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
      </div>
    </Modal>
  );
};

export default FarmerModal;
