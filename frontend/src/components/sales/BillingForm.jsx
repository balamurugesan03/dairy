// import { useState, useEffect, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useReactToPrint } from 'react-to-print';
// import dayjs from 'dayjs';
// import { farmerAPI, itemAPI, salesAPI, customerAPI, collectionCenterAPI, subsidyAPI } from '../../services/api';
// import PageHeader from '../common/PageHeader';
// import SearchableSelect from '../common/SearchableSelect';
// import { message as toast } from '../../utils/toast';
// import './BillingForm.css';

// const BillingForm = () => {
//   const navigate = useNavigate();
//   const printRef = useRef();
//   const [loading, setLoading] = useState(false);
//   const [items, setItems] = useState([]);
//   const [farmers, setFarmers] = useState([]);
//   const [customers, setCustomers] = useState([]);
//   const [collectionCenters, setCollectionCenters] = useState([]);
//   const [subsidies, setSubsidies] = useState([]);
//   const [selectedCustomer, setSelectedCustomer] = useState(null);
//   const [selectedFarmerNumber, setSelectedFarmerNumber] = useState('');
//   const [billItems, setBillItems] = useState([]);
//   const [errors, setErrors] = useState({});

//   const [formData, setFormData] = useState({
//     customerType: 'Other',
//     customerId: null,
//     customerName: '',
//     customerPhone: '',
//     itemId: null,
//     quantity: '',
//     collectionCenterId: null,
//     subsidyId: null,
//     paymentMode: 'Cash',
//     paidAmount: ''
//   });

//   const [calculations, setCalculations] = useState({
//     subtotal: 0,
//     totalGst: 0,
//     grandTotal: 0,
//     oldBalance: 0,
//     totalDue: 0
//   });
//   const [showBalanceAlert, setShowBalanceAlert] = useState(false);

//   useEffect(() => {
//     fetchItems();
//     fetchFarmers();
//     fetchCustomers();
//     fetchCollectionCenters();
//     fetchSubsidies();
//   }, []);

//   const fetchItems = async () => {
//     try {
//       const response = await itemAPI.getAll();
//       setItems(response.data.filter(item => item.status === 'Active'));
//     } catch (error) {
//       toast.error(error.message || 'Failed to fetch items');
//     }
//   };

//   const fetchFarmers = async () => {
//     try {
//       const response = await farmerAPI.getAll();
//       setFarmers(response.data.filter(farmer => farmer.status === 'Active'));
//     } catch (error) {
//       toast.error(error.message || 'Failed to fetch farmers');
//     }
//   };

//   const fetchCustomers = async () => {
//     try {
//       const response = await customerAPI.getAll();
//       setCustomers(response.data.filter(customer => customer.active === true));
//     } catch (error) {
//       toast.error(error.message || 'Failed to fetch customers');
//     }
//   };

//   const fetchCollectionCenters = async () => {
//     try {
//       const response = await collectionCenterAPI.getAll();
//       setCollectionCenters(response.data.filter(center => center.status === 'Active'));
//     } catch (error) {
//       toast.error(error.message || 'Failed to fetch collection centers');
//     }
//   };

//   const fetchSubsidies = async () => {
//     try {
//       const response = await subsidyAPI.getAll();
//       setSubsidies(response.data.filter(subsidy => subsidy.status === 'Active'));
//     } catch (error) {
//       toast.error(error.message || 'Failed to fetch subsidies');
//     }
//   };

//   const fetchPreviousBalance = async (customerId) => {
//     try {
//       const response = await salesAPI.getCustomerHistory(customerId);
//       const sales = response.data || [];
//       // Calculate total outstanding balance from previous bills
//       const totalOutstanding = sales.reduce((sum, sale) => sum + (sale.balanceAmount || 0), 0);
//       return totalOutstanding;
//     } catch (error) {
//       console.error('Error fetching previous balance:', error);
//       return 0;
//     }
//   };

//   const handleInputChange = (name, value) => {
//     setFormData(prev => ({
//       ...prev,
//       [name]: value
//     }));
//     // Clear error when user starts typing
//     if (errors[name]) {
//       setErrors(prev => ({ ...prev, [name]: '' }));
//     }
//   };

//   const handleCustomerTypeChange = (e) => {
//     const type = e.target.value;
//     handleInputChange('customerType', type);
//     setFormData(prev => ({
//       ...prev,
//       customerId: null,
//       customerName: '',
//       customerPhone: ''
//     }));
//     setSelectedCustomer(null);
//     setSelectedFarmerNumber('');
//     setCalculations(prev => ({ ...prev, oldBalance: 0 }));
//     setShowBalanceAlert(false);
//   };

//   const handleCustomerSelect = async (e) => {
//     const farmerId = e.target.value;
//     if (!farmerId) {
//       setSelectedCustomer(null);
//       setSelectedFarmerNumber('');
//       setFormData(prev => ({
//         ...prev,
//         customerId: null,
//         customerName: '',
//         customerPhone: ''
//       }));
//       setCalculations(prev => ({ ...prev, oldBalance: 0 }));
//       setShowBalanceAlert(false);
//       return;
//     }

//     const farmer = farmers.find(f => f._id === farmerId);
//     if (farmer) {
//       setSelectedCustomer(farmer);
//       setSelectedFarmerNumber(farmer.farmerNumber || '');
//       setFormData(prev => ({
//         ...prev,
//         customerId: farmerId,
//         customerName: farmer.personalDetails?.name || '',
//         customerPhone: farmer.personalDetails?.phone || ''
//       }));

//       // Fetch previous balance from sales history
//       const previousBalance = await fetchPreviousBalance(farmerId);
//       setCalculations(prev => ({ ...prev, oldBalance: previousBalance }));
//       setShowBalanceAlert(previousBalance > 0);
//     }
//   };

//   const handleCustomerSelectForCustomer = async (e) => {
//     const customerId = e.target.value;
//     if (!customerId) {
//       setSelectedCustomer(null);
//       setFormData(prev => ({
//         ...prev,
//         customerId: null,
//         customerName: '',
//         customerPhone: ''
//       }));
//       setCalculations(prev => ({ ...prev, oldBalance: 0 }));
//       setShowBalanceAlert(false);
//       return;
//     }

//     const customer = customers.find(c => c._id === customerId);
//     if (customer) {
//       setSelectedCustomer(customer);
//       setFormData(prev => ({
//         ...prev,
//         customerId: customerId,
//         customerName: customer.name || '',
//         customerPhone: customer.phone || ''
//       }));

//       // Fetch previous balance from sales history
//       const previousBalance = await fetchPreviousBalance(customerId);
//       const totalOldBalance = (customer.openingBalance || 0) + previousBalance;

//       setCalculations(prev => ({ ...prev, oldBalance: totalOldBalance }));
//       setShowBalanceAlert(totalOldBalance > 0);
//     }
//   };

//   const handleAddItem = () => {
//     if (!formData.itemId || !formData.quantity) {
//       toast.error('Please select item and enter quantity');
//       return;
//     }

//     const item = items.find(i => i._id === formData.itemId);
//     if (!item) return;

//     if (parseFloat(formData.quantity) > item.currentBalance) {
//       toast.error(`Insufficient stock! Available: ${item.currentBalance} ${item.unit}`);
//       return;
//     }

//     const quantity = parseFloat(formData.quantity);
//     const rate = item.salesRate;
//     const amount = quantity * rate;
//     const gstAmount = (amount * (item.gstPercent || 0)) / 100;

//     const newItem = {
//       itemId: item._id,
//       itemName: item.itemName,
//       itemCode: item.itemCode,
//       unit: item.unit,
//       quantity,
//       rate,
//       amount,
//       gstPercent: item.gstPercent || 0,
//       gstAmount
//     };

//     const updatedItems = [...billItems, newItem];
//     setBillItems(updatedItems);
//     calculateTotals(updatedItems);

//     setFormData(prev => ({ ...prev, itemId: null, quantity: '' }));
//   };

//   const handleRemoveItem = (index) => {
//     const updatedItems = billItems.filter((_, i) => i !== index);
//     setBillItems(updatedItems);
//     calculateTotals(updatedItems);
//   };

//   const calculateTotals = (items) => {
//     const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
//     const totalGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
//     const grandTotal = subtotal + totalGst;
//     const totalDue = grandTotal + calculations.oldBalance;

//     setCalculations(prev => ({
//       ...prev,
//       subtotal,
//       totalGst,
//       grandTotal,
//       totalDue
//     }));
//   };

//   const validateForm = () => {
//     const newErrors = {};

//     if (formData.customerType === 'Farmer') {
//       if (!formData.customerId) {
//         newErrors.customerId = 'Please select a farmer';
//       }
//     } else if (formData.customerType === 'Customer') {
//       if (!formData.customerId) {
//         newErrors.customerId = 'Please select a customer';
//       }
//     } else {
//       if (!formData.customerName) {
//         newErrors.customerName = 'Please enter customer name';
//       }
//       if (!formData.customerPhone) {
//         newErrors.customerPhone = 'Please enter phone number';
//       } else if (!/^[0-9]{10}$/.test(formData.customerPhone)) {
//         newErrors.customerPhone = 'Please enter valid 10-digit phone number';
//       }
//     }

//     if (!formData.paymentMode) {
//       newErrors.paymentMode = 'Please select payment mode';
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     if (billItems.length === 0) {
//       toast.error('Please add at least one item');
//       return;
//     }

//     if (!validateForm()) {
//       toast.error('Please fill all required fields');
//       return;
//     }

//     setLoading(true);
//     try {
//       const payload = {
//         billDate: new Date().toISOString(),
//         customerType: formData.customerType,
//         customerId: (formData.customerType === 'Farmer' || formData.customerType === 'Customer') ? formData.customerId : null,
//         customerName: formData.customerName,
//         customerPhone: formData.customerPhone,
//         items: billItems,
//         subtotal: calculations.subtotal,
//         totalGst: calculations.totalGst,
//         grandTotal: calculations.grandTotal,
//         oldBalance: calculations.oldBalance,
//         totalDue: calculations.totalDue,
//         collectionCenterId: formData.collectionCenterId || null,
//         subsidyId: formData.subsidyId || null,
//         paymentMode: formData.paymentMode,
//         paidAmount: parseFloat(formData.paidAmount) || 0,
//         balanceAmount: calculations.totalDue - (parseFloat(formData.paidAmount) || 0)
//       };

//       const response = await salesAPI.create(payload);
//       toast.success('Bill created successfully');

//       if (window.confirm('Do you want to print the bill?')) {
//         handlePrint();
//       }

//       navigate('/sales');
//     } catch (error) {
//       toast.error(error.message || 'Failed to create bill');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handlePrint = useReactToPrint({
//     content: () => printRef.current,
//   });

//   const itemOptions = items.map(item => ({
//     label: `${item.itemCode} - ${item.itemName} (Stock: ${item.currentBalance} ${item.unit})`,
//     value: item._id
//   }));

//   return (
//     <div className="billing-form-container">
//       <PageHeader
//         title="Create Bill"
//         subtitle="Generate sales bill"
//       />

//       <div className="billing-card">
//         <form onSubmit={handleSubmit} className="billing-form">
//           {/* Customer Information */}
//           <div className="form-row">
//             <div className="form-group">
//               <label className="form-label required">Customer Type</label>
//               <select
//                 className="form-select"
//                 value={formData.customerType}
//                 onChange={handleCustomerTypeChange}
//               >
//                 <option value="Farmer">Farmer</option>
//                 <option value="Customer">Customer</option>
//                 <option value="Other">Other</option>
//               </select>
//             </div>

//             {formData.customerType === 'Farmer' ? (
//               <div className="form-group" style={{ gridColumn: 'span 2' }}>
//                 <label className="form-label required">Select Farmer</label>
//                 <select
//                   className={`form-select ${errors.customerId ? 'error' : ''}`}
//                   value={formData.customerId || ''}
//                   onChange={handleCustomerSelect}
//                 >
//                   <option value="">-- Select Farmer --</option>
//                   {farmers.map(farmer => (
//                     <option key={farmer._id} value={farmer._id}>
//                       {farmer.farmerNumber} - {farmer.personalDetails?.name || 'N/A'}
//                       {farmer.memberId ? ` | Member ID: ${farmer.memberId}` : ''}
//                     </option>
//                   ))}
//                 </select>
//                 {errors.customerId && <div className="form-error">{errors.customerId}</div>}
//               </div>
//             ) : formData.customerType === 'Customer' ? (
//               <div className="form-group" style={{ gridColumn: 'span 2' }}>
//                 <label className="form-label required">Select Customer</label>
//                 <select
//                   className={`form-select ${errors.customerId ? 'error' : ''}`}
//                   value={formData.customerId || ''}
//                   onChange={handleCustomerSelectForCustomer}
//                 >
//                   <option value="">-- Select Customer --</option>
//                   {customers.map(customer => (
//                     <option key={customer._id} value={customer._id}>
//                       {customer.customerId} - {customer.name}
//                       {customer.phone ? ` | ${customer.phone}` : ''}
//                     </option>
//                   ))}
//                 </select>
//                 {errors.customerId && <div className="form-error">{errors.customerId}</div>}
//               </div>
//             ) : (
//               <>
//                 <div className="form-group">
//                   <label className="form-label required">Customer Name</label>
//                   <input
//                     type="text"
//                     className={`form-input ${errors.customerName ? 'error' : ''}`}
//                     placeholder="Enter customer name"
//                     value={formData.customerName}
//                     onChange={(e) => handleInputChange('customerName', e.target.value)}
//                   />
//                   {errors.customerName && <div className="form-error">{errors.customerName}</div>}
//                 </div>
//                 <div className="form-group">
//                   <label className="form-label required">Phone</label>
//                   <input
//                     type="text"
//                     className={`form-input ${errors.customerPhone ? 'error' : ''}`}
//                     placeholder="Enter phone number"
//                     value={formData.customerPhone}
//                     onChange={(e) => handleInputChange('customerPhone', e.target.value)}
//                     maxLength={10}
//                   />
//                   {errors.customerPhone && <div className="form-error">{errors.customerPhone}</div>}
//                 </div>
//               </>
//             )}
//           </div>

//           {selectedCustomer && formData.customerType === 'Farmer' && (
//             <div className="form-row">
//               <div className="form-group">
//                 <label className="form-label">Farmer Number</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={selectedFarmerNumber}
//                   disabled
//                 />
//               </div>
//               <div className="form-group">
//                 <label className="form-label">Farmer Name</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={formData.customerName}
//                   disabled
//                 />
//               </div>
//               <div className="form-group">
//                 <label className="form-label">Phone</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={formData.customerPhone}
//                   disabled
//                 />
//               </div>
//             </div>
//           )}

//           {selectedCustomer && formData.customerType === 'Customer' && (
//             <div className="form-row">
//               <div className="form-group">
//                 <label className="form-label">Customer ID</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={selectedCustomer.customerId || ''}
//                   disabled
//                 />
//               </div>
//               <div className="form-group">
//                 <label className="form-label">Customer Name</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={formData.customerName}
//                   disabled
//                 />
//               </div>
//               <div className="form-group">
//                 <label className="form-label">Phone</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={formData.customerPhone}
//                   disabled
//                 />
//               </div>
//               {selectedCustomer.email && (
//                 <div className="form-group">
//                   <label className="form-label">Email</label>
//                   <input
//                     type="text"
//                     className="form-input"
//                     value={selectedCustomer.email}
//                     disabled
//                   />
//                 </div>
//               )}
//               {selectedCustomer.address && (
//                 <div className="form-group" style={{ gridColumn: 'span 2' }}>
//                   <label className="form-label">Address</label>
//                   <input
//                     type="text"
//                     className="form-input"
//                     value={selectedCustomer.address}
//                     disabled
//                   />
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Previous Balance Alert */}
//           {showBalanceAlert && calculations.oldBalance > 0 && (
//             <div style={{
//               backgroundColor: '#fff3cd',
//               border: '1px solid #ffc107',
//               borderRadius: '8px',
//               padding: '16px',
//               marginTop: '16px',
//               display: 'flex',
//               alignItems: 'center',
//               gap: '12px'
//             }}>
//               <svg
//                 style={{ width: '24px', height: '24px', color: '#856404', flexShrink: 0 }}
//                 viewBox="0 0 16 16"
//                 fill="currentColor"
//               >
//                 <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
//               </svg>
//               <div style={{ flex: 1 }}>
//                 <strong style={{ color: '#856404', fontSize: '14px' }}>Previous Balance Outstanding</strong>
//                 <p style={{ margin: '4px 0 0 0', color: '#856404', fontSize: '14px' }}>
//                   This {formData.customerType.toLowerCase()} has a previous outstanding balance of{' '}
//                   <strong style={{ fontSize: '16px' }}>₹{calculations.oldBalance.toFixed(2)}</strong>
//                   {' '}which will be added to the total due amount.
//                 </p>
//               </div>
//             </div>
//           )}

//           {/* Divider */}
//           <div className="divider">
//             <span className="divider-text">Add Items</span>
//           </div>

//           {/* Add Items Section */}
//           <div className="form-row">
//             <div className="form-group" style={{ gridColumn: 'span 2' }}>
//               <label className="form-label">Select Item</label>
//               <SearchableSelect
//                 options={itemOptions}
//                 placeholder="Select an item"
//                 value={formData.itemId}
//                 onChange={(value) => handleInputChange('itemId', value)}
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Quantity</label>
//               <input
//                 type="number"
//                 className="form-input"
//                 placeholder="Enter quantity"
//                 value={formData.quantity}
//                 onChange={(e) => handleInputChange('quantity', e.target.value)}
//                 min="0.01"
//                 step="0.01"
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">&nbsp;</label>
//               <button
//                 type="button"
//                 className="btn btn-dashed w-full"
//                 onClick={handleAddItem}
//               >
//                 <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
//                   <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
//                 </svg>
//                 Add
//               </button>
//             </div>
//           </div>

//           {/* Items Table */}
//           <table className="billing-table">
//             <thead>
//               <tr>
//                 <th>#</th>
//                 <th>Item</th>
//                 <th>Quantity</th>
//                 <th>Rate</th>
//                 <th>Amount</th>
//                 <th>GST</th>
//                 <th>Total</th>
//                 <th>Action</th>
//               </tr>
//             </thead>
//             <tbody>
//               {billItems.length === 0 ? (
//                 <tr>
//                   <td colSpan="8" className="table-empty">
//                     No items added yet
//                   </td>
//                 </tr>
//               ) : (
//                 billItems.map((item, index) => (
//                   <tr key={`${item.itemId}-${index}`}>
//                     <td>{index + 1}</td>
//                     <td>{item.itemName}</td>
//                     <td>{item.quantity} {item.unit}</td>
//                     <td>₹{item.rate?.toFixed(2)}</td>
//                     <td>₹{item.amount?.toFixed(2)}</td>
//                     <td>{item.gstPercent}% (₹{item.gstAmount?.toFixed(2)})</td>
//                     <td>₹{(item.amount + item.gstAmount)?.toFixed(2)}</td>
//                     <td>
//                       <button
//                         type="button"
//                         className="btn btn-danger"
//                         onClick={() => handleRemoveItem(index)}
//                       >
//                         <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
//                           <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
//                           <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
//                         </svg>
//                         Remove
//                       </button>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>

//           {/* Summary Section */}
//           <div className="summary-card">
//             <div className="summary-row">
//               <span className="summary-label">Subtotal:</span>
//               <span className="summary-value">₹{calculations.subtotal.toFixed(2)}</span>
//             </div>
//             <div className="summary-row">
//               <span className="summary-label">Total GST:</span>
//               <span className="summary-value">₹{calculations.totalGst.toFixed(2)}</span>
//             </div>
//             <div className="summary-row total">
//               <span className="summary-label">Grand Total:</span>
//               <span className="summary-value">₹{calculations.grandTotal.toFixed(2)}</span>
//             </div>
//             {calculations.oldBalance > 0 && (
//               <>
//                 <div className="summary-row">
//                   <span className="summary-label">Old Balance:</span>
//                   <span className="summary-value">₹{calculations.oldBalance.toFixed(2)}</span>
//                 </div>
//                 <div className="summary-row total">
//                   <span className="summary-label">Total Due:</span>
//                   <span className="summary-value">₹{calculations.totalDue.toFixed(2)}</span>
//                 </div>
//               </>
//             )}
//           </div>

//           {/* Divider */}
//           <div className="divider">
//             <span className="divider-text">Payment Details</span>
//           </div>

//           {/* Payment Section */}
//           <div className="form-row">
//             <div className="form-group">
//               <label className="form-label">Collection Center</label>
//               <select
//                 className="form-select"
//                 value={formData.collectionCenterId || ''}
//                 onChange={(e) => handleInputChange('collectionCenterId', e.target.value)}
//               >
//                 <option value="">-- Select Collection Center --</option>
//                 {collectionCenters.map(center => (
//                   <option key={center._id} value={center._id}>
//                     {center.centerName} ({center.centerType})
//                   </option>
//                 ))}
//               </select>
//             </div>
//             <div className="form-group">
//               <label className="form-label">Subsidy</label>
//               <select
//                 className="form-select"
//                 value={formData.subsidyId || ''}
//                 onChange={(e) => handleInputChange('subsidyId', e.target.value)}
//               >
//                 <option value="">-- Select Subsidy --</option>
//                 {subsidies.map(subsidy => (
//                   <option key={subsidy._id} value={subsidy._id}>
//                     {subsidy.subsidyName} ({subsidy.subsidyType})
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           <div className="form-row">
//             <div className="form-group">
//               <label className="form-label required">Payment Mode</label>
//               <select
//                 className="form-select"
//                 value={formData.paymentMode}
//                 onChange={(e) => handleInputChange('paymentMode', e.target.value)}
//               >
//                 <option value="Cash">Cash</option>
//                 <option value="Credit">Credit</option>
//                 <option value="Bank">Bank</option>
//               </select>
//             </div>
//             <div className="form-group">
//               <label className="form-label">Paid Amount (₹)</label>
//               <input
//                 type="number"
//                 className="form-input"
//                 placeholder="Enter paid amount"
//                 value={formData.paidAmount}
//                 onChange={(e) => handleInputChange('paidAmount', e.target.value)}
//                 min="0"
//                 max={calculations.totalDue}
//               />
//             </div>
//           </div>

//           {/* Form Actions */}
//           <div className="btn-group mt-24">
//             <button
//               type="submit"
//               className="btn btn-primary"
//               disabled={loading}
//             >
//               {loading ? (
//                 <>
//                   <div className="spinner"></div>
//                   Saving...
//                 </>
//               ) : (
//                 <>
//                   <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
//                     <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
//                   </svg>
//                   Save Bill
//                 </>
//               )}
//             </button>
//             <button
//               type="button"
//               className="btn btn-default"
//               onClick={() => navigate('/sales')}
//             >
//               Cancel
//             </button>
//           </div>
//         </form>
//       </div>

//       {/* Hidden Print Section */}
//       <div style={{ display: 'none' }}>
//         <div ref={printRef} style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
//           <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Dairy Cooperative</h2>
//           <hr />
//           <p><strong>Bill Date:</strong> {dayjs().format('DD-MM-YYYY HH:mm')}</p>
//           <p><strong>Customer:</strong> {formData.customerName}</p>
//           <p><strong>Phone:</strong> {formData.customerPhone}</p>
//           <hr />
//           <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
//             <thead>
//               <tr>
//                 <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>#</th>
//                 <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Item</th>
//                 <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Quantity</th>
//                 <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Rate</th>
//                 <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Amount</th>
//                 <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>GST</th>
//                 <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               {billItems.map((item, index) => (
//                 <tr key={index}>
//                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>{index + 1}</td>
//                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.itemName}</td>
//                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.quantity} {item.unit}</td>
//                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{item.rate?.toFixed(2)}</td>
//                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{item.amount?.toFixed(2)}</td>
//                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.gstPercent}% (₹{item.gstAmount?.toFixed(2)})</td>
//                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{(item.amount + item.gstAmount)?.toFixed(2)}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//           <hr style={{ marginTop: '20px' }} />
//           <div style={{ marginTop: '20px', fontSize: '16px' }}>
//             <p><strong>Subtotal:</strong> ₹{calculations.subtotal.toFixed(2)}</p>
//             <p><strong>Total GST:</strong> ₹{calculations.totalGst.toFixed(2)}</p>
//             <p style={{ fontSize: '18px' }}><strong>Grand Total:</strong> ₹{calculations.grandTotal.toFixed(2)}</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default BillingForm;


import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  Table,
  Select,
  TextInput,
  NumberInput,
  Card,
  Alert,
  Loader,
  Center,
  Divider,
  Box,
  useMantineTheme,
  Grid,
  SimpleGrid,
  Badge,
  ActionIcon,
  Modal,
  ScrollArea,
  Kbd
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconX,
  IconUser,
  IconPhone,
  IconPackage,
  IconCurrencyRupee,
  IconBuilding,
  IconDiscount,
  IconCash,
  IconAlertCircle,
  IconPrinter,
  IconReceipt,
  IconSearch,
  IconCheck,
  IconShoppingCart,
  IconCalculator,
  IconBarcode,
  IconCreditCard,
  IconDeviceFloppy,
  IconQrcode,
  IconUserCircle,
  IconPercentage,
  IconReceiptRefund,
  IconReceipt2,
  IconDeviceMobile,
  IconCoin
} from '@tabler/icons-react';
import { farmerAPI, itemAPI, salesAPI, customerAPI, collectionCenterAPI, subsidyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';

const BillingForm = () => {
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const printRef = useRef();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedFarmerNumber, setSelectedFarmerNumber] = useState('');
  const [billItems, setBillItems] = useState([]);
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  const form = useForm({
    initialValues: {
      customerType: 'Other',
      customerId: null,
      customerName: '',
      customerPhone: '',
      itemId: null,
      quantity: '1',
      collectionCenterId: null,
      subsidyId: null,
      paymentMode: 'Cash',
      paidAmount: ''
    },

    validate: (values) => {
      const errors = {};
      
      if (values.customerType === 'Farmer' && !values.customerId) {
        errors.customerId = 'Please select a farmer';
      } else if (values.customerType === 'Customer' && !values.customerId) {
        errors.customerId = 'Please select a customer';
      } else if (values.customerType === 'Other') {
        if (!values.customerName) {
          errors.customerName = 'Please enter customer name';
        }
      }
      
      return errors;
    },
  });

  const [calculations, setCalculations] = useState({
    subtotal: 0,
    totalGst: 0,
    grandTotal: 0,
    oldBalance: 0,
    totalDue: 0,
    discount: 0
  });

  useEffect(() => {
    fetchItems();
    fetchFarmers();
    fetchCustomers();
    fetchCollectionCenters();
    fetchSubsidies();
  }, []);

  // Calculate totals whenever billItems change
  useEffect(() => {
    calculateTotals();
  }, [billItems]);

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll();
      setItems(response.data.filter(item => item.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch items',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchFarmers = async () => {
    try {
      const response = await farmerAPI.getAll();
      setFarmers(response.data.filter(farmer => farmer.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch farmers',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      setCustomers(response.data.filter(customer => customer.active === true));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch customers',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll();
      setCollectionCenters(response.data.filter(center => center.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch collection centers',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchSubsidies = async () => {
    try {
      const response = await subsidyAPI.getAll();
      setSubsidies(response.data.filter(subsidy => subsidy.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch subsidies',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchPreviousBalance = async (customerId) => {
    try {
      const response = await salesAPI.getCustomerHistory(customerId);
      const sales = response.data || [];
      return sales.reduce((sum, sale) => sum + (sale.balanceAmount || 0), 0);
    } catch (error) {
      console.error('Error fetching previous balance:', error);
      return 0;
    }
  };

  const handleCustomerTypeChange = (type) => {
    form.setValues({
      ...form.values,
      customerType: type,
      customerId: null,
      customerName: '',
      customerPhone: ''
    });
    setSelectedCustomer(null);
    setSelectedFarmerNumber('');
    setCalculations(prev => ({ ...prev, oldBalance: 0 }));
    setShowBalanceAlert(false);
  };

  const handleFarmerSelect = async (farmerId) => {
    if (!farmerId) {
      setSelectedCustomer(null);
      setSelectedFarmerNumber('');
      form.setValues({
        ...form.values,
        customerId: null,
        customerName: '',
        customerPhone: ''
      });
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      setShowBalanceAlert(false);
      return;
    }

    const farmer = farmers.find(f => f._id === farmerId);
    if (farmer) {
      setSelectedCustomer(farmer);
      setSelectedFarmerNumber(farmer.farmerNumber || '');
      form.setValues({
        ...form.values,
        customerId: farmerId,
        customerName: farmer.personalDetails?.name || '',
        customerPhone: farmer.personalDetails?.phone || ''
      });

      const previousBalance = await fetchPreviousBalance(farmerId);
      setCalculations(prev => ({ ...prev, oldBalance: previousBalance }));
      setShowBalanceAlert(previousBalance > 0);
    }
  };

  const handleCustomerSelect = async (customerId) => {
    if (!customerId) {
      setSelectedCustomer(null);
      form.setValues({
        ...form.values,
        customerId: null,
        customerName: '',
        customerPhone: ''
      });
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      setShowBalanceAlert(false);
      return;
    }

    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      form.setValues({
        ...form.values,
        customerId: customerId,
        customerName: customer.name || '',
        customerPhone: customer.phone || ''
      });

      const previousBalance = await fetchPreviousBalance(customerId);
      const totalOldBalance = (customer.openingBalance || 0) + previousBalance;

      setCalculations(prev => ({ ...prev, oldBalance: totalOldBalance }));
      setShowBalanceAlert(totalOldBalance > 0);
    }
  };

  const handleBarcodeInput = (e) => {
    const value = e.target.value;
    setBarcodeInput(value);
    
    // Simulate barcode scanning with Enter key
    if (e.key === 'Enter' && value.trim()) {
      const item = items.find(i => i.itemCode === value.trim());
      if (item) {
        form.setFieldValue('itemId', item._id);
        setTimeout(() => handleAddItem(), 100);
      }
      setBarcodeInput('');
    }
  };

  const handleAddItem = () => {
    if (!form.values.itemId || !form.values.quantity) {
      notifications.show({
        title: 'Error',
        message: 'Please select item and enter quantity',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    const item = items.find(i => i._id === form.values.itemId);
    if (!item) return;

    if (parseFloat(form.values.quantity) > item.currentBalance) {
      notifications.show({
        title: 'Insufficient Stock',
        message: `Available: ${item.currentBalance} ${item.unit}`,
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    const quantity = parseFloat(form.values.quantity);
    const rate = item.salesRate || 0;
    const amount = quantity * rate;
    const gstAmount = (amount * (item.gstPercent || 0)) / 100;

    // Check if item already exists in bill
    const existingItemIndex = billItems.findIndex(bi => bi.itemId === item._id);
    
    if (existingItemIndex > -1) {
      // Update existing item quantity
      const updatedItems = [...billItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + quantity,
        amount: (updatedItems[existingItemIndex].quantity + quantity) * rate,
        gstAmount: ((updatedItems[existingItemIndex].quantity + quantity) * rate * (item.gstPercent || 0)) / 100
      };
      setBillItems(updatedItems);
    } else {
      // Add new item
      const newItem = {
        itemId: item._id,
        itemName: item.itemName,
        itemCode: item.itemCode,
        unit: item.unit,
        quantity,
        rate,
        amount,
        gstPercent: item.gstPercent || 0,
        gstAmount
      };
      setBillItems([...billItems, newItem]);
    }

    form.setFieldValue('itemId', null);
    form.setFieldValue('quantity', '1');
    setBarcodeInput('');
  };

  const handleRemoveItem = (index) => {
    const updatedItems = billItems.filter((_, i) => i !== index);
    setBillItems(updatedItems);
  };

  const handleQuantityChange = (index, newQuantity) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    updatedItems[index] = {
      ...item,
      quantity: newQuantity,
      amount: newQuantity * item.rate,
      gstAmount: (newQuantity * item.rate * item.gstPercent) / 100
    };
    setBillItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = billItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalGst = billItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const grandTotal = subtotal + totalGst - calculations.discount;
    const totalDue = grandTotal + calculations.oldBalance;

    setCalculations(prev => ({
      ...prev,
      subtotal,
      totalGst,
      grandTotal,
      totalDue
    }));
  };

  const handleDiscountChange = (value) => {
    const discount = Math.min(parseFloat(value) || 0, calculations.subtotal);
    setCalculations(prev => ({
      ...prev,
      discount,
      grandTotal: prev.subtotal + prev.totalGst - discount
    }));
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    onAfterPrint: () => {
      setPrintModalOpened(false);
      resetForm();
    }
  });

  const handleSubmit = async (values) => {
    if (billItems.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please add at least one item',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        billDate: new Date().toISOString(),
        customerType: values.customerType,
        customerId: (values.customerType === 'Farmer' || values.customerType === 'Customer') ? values.customerId : null,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        items: billItems,
        subtotal: calculations.subtotal,
        totalGst: calculations.totalGst,
        discount: calculations.discount,
        grandTotal: calculations.grandTotal,
        oldBalance: calculations.oldBalance,
        totalDue: calculations.totalDue,
        collectionCenterId: values.collectionCenterId || null,
        subsidyId: values.subsidyId || null,
        paymentMode: values.paymentMode,
        paidAmount: parseFloat(values.paidAmount) || 0,
        balanceAmount: calculations.totalDue - (parseFloat(values.paidAmount) || 0)
      };

      await salesAPI.create(payload);
      
      setPrintModalOpened(true);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create bill',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    form.reset();
    setBillItems([]);
    setSelectedCustomer(null);
    setSelectedFarmerNumber('');
    setCalculations({
      subtotal: 0,
      totalGst: 0,
      grandTotal: 0,
      oldBalance: 0,
      totalDue: 0,
      discount: 0
    });
    setBarcodeInput('');
  };

  const itemOptions = items.map(item => ({
    value: item._id,
    label: `${item.itemCode} - ${item.itemName} (${item.currentBalance} ${item.unit})`
  }));

  const farmerOptions = farmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber || ''} - ${farmer.personalDetails?.name || 'N/A'} ${farmer.memberId ? ` | ${farmer.memberId}` : ''}`
  }));

  const customerOptions = customers.map(customer => ({
    value: customer._id,
    label: `${customer.customerId} - ${customer.name} ${customer.phone ? ` | ${customer.phone}` : ''}`
  }));

  const quickItems = items.slice(0, 8); // Show first 8 items as quick buttons

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="POS Billing"
        subtitle="Quick billing system"
        extra={
          <Group spacing="xs">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={resetForm}
              variant="light"
              color="gray"
              size="sm"
            >
              New Bill
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={() => printRef.current && handlePrint()}
              variant="light"
              size="sm"
              disabled={billItems.length === 0}
            >
              Print Preview
            </Button>
          </Group>
        }
      />

      {/* POS Layout */}
      <Grid gutter="md">
        {/* Left Panel - Product Selection */}
        <Grid.Col span={8}>
          <Paper withBorder radius="md" style={{ height: '100%' }}>
            <Stack spacing="md" p="md">
              {/* Quick Search */}
              <Box>
                <TextInput
                  placeholder="Scan barcode or search items..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  icon={<IconBarcode size={16} />}
                  rightSection={
                    <Kbd size="xs" mr="xs">
                      Enter
                    </Kbd>
                  }
                  styles={{
                    input: {
                      fontSize: '16px',
                      height: '50px'
                    }
                  }}
                />
              </Box>

              {/* Quick Item Buttons */}
              <Box>
                <Text size="sm" fw={500} mb="xs">Quick Items</Text>
                <SimpleGrid cols={4} spacing="xs">
                  {quickItems.map(item => (
                    <Button
                      key={item._id}
                      variant="light"
                      color="blue"
                      size="sm"
                      onClick={() => {
                        form.setFieldValue('itemId', item._id);
                        handleAddItem();
                      }}
                      styles={{
                        root: {
                          height: '60px',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px 4px'
                        }
                      }}
                    >
                      <Text size="xs" lineClamp={1} fw={500}>{item.itemName}</Text>
                      <Text size="xs" c="dimmed">₹{item.salesRate}</Text>
                    </Button>
                  ))}
                </SimpleGrid>
              </Box>

              {/* Product Search */}
              <Box>
                <Select
                  label="Search Product"
                  placeholder="Type product name or code..."
                  value={form.values.itemId}
                  onChange={(value) => form.setFieldValue('itemId', value)}
                  data={itemOptions}
                  searchable
                  clearable
                  nothingFound="No items found"
                  icon={<IconSearch size={16} />}
                  styles={{
                    input: {
                      height: '40px'
                    }
                  }}
                />
                <Grid gutter="xs" mt="xs">
                  <Grid.Col span={8}>
                    <NumberInput
                      label="Quantity"
                      value={form.values.quantity}
                      onChange={(value) => form.setFieldValue('quantity', value)}
                      min={0.01}
                      step={0.01}
                      precision={2}
                      icon={<IconCalculator size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Box pt={28}>
                      <Button
                        fullWidth
                        leftSection={<IconPlus size={16} />}
                        onClick={handleAddItem}
                        color="green"
                        disabled={!form.values.itemId}
                      >
                        Add
                      </Button>
                    </Box>
                  </Grid.Col>
                </Grid>
              </Box>

              {/* Customer Information */}
              <Box>
                <Divider label="Customer Information" labelPosition="center" mb="xs" />
                <Grid gutter="xs">
                  <Grid.Col span={3}>
                    <Select
                      label="Type"
                      value={form.values.customerType}
                      onChange={handleCustomerTypeChange}
                      data={[
                        { value: 'Farmer', label: 'Farmer' },
                        { value: 'Customer', label: 'Customer' },
                        { value: 'Other', label: 'Other' }
                      ]}
                      icon={<IconUserCircle size={16} />}
                      size="xs"
                    />
                  </Grid.Col>
                  <Grid.Col span={9}>
                    {form.values.customerType === 'Farmer' ? (
                      <Select
                        label="Select Farmer"
                        placeholder="Search farmer..."
                        value={form.values.customerId}
                        onChange={handleFarmerSelect}
                        data={farmerOptions}
                        error={form.errors.customerId}
                        searchable
                        clearable
                        size="xs"
                      />
                    ) : form.values.customerType === 'Customer' ? (
                      <Select
                        label="Select Customer"
                        placeholder="Search customer..."
                        value={form.values.customerId}
                        onChange={handleCustomerSelect}
                        data={customerOptions}
                        error={form.errors.customerId}
                        searchable
                        clearable
                        size="xs"
                      />
                    ) : (
                      <Grid gutter="xs">
                        <Grid.Col span={6}>
                          <TextInput
                            label="Name"
                            placeholder="Enter name"
                            value={form.values.customerName}
                            onChange={(e) => form.setFieldValue('customerName', e.target.value)}
                            error={form.errors.customerName}
                            size="xs"
                          />
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <TextInput
                            label="Phone"
                            placeholder="Enter phone"
                            value={form.values.customerPhone}
                            onChange={(e) => form.setFieldValue('customerPhone', e.target.value)}
                            size="xs"
                          />
                        </Grid.Col>
                      </Grid>
                    )}
                  </Grid.Col>
                </Grid>
              </Box>
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Right Panel - Bill Summary */}
        <Grid.Col span={4}>
          <Paper withBorder radius="md" style={{ height: '100%' }}>
            <Stack spacing="md" p="md">
              {/* Bill Header */}
              <Group position="apart">
                <div>
                  <Text fw={700} size="xl">Bill #{dayjs().format('YYYYMMDDHHmm')}</Text>
                  <Text size="sm" c="dimmed">{dayjs().format('DD MMM YYYY, hh:mm A')}</Text>
                </div>
                <Badge color="green" size="lg" variant="filled">
                  Active
                </Badge>
              </Group>

              {/* Customer Info */}
              {(form.values.customerName || selectedCustomer) && (
                <Card withBorder radius="sm" p="xs">
                  <Group position="apart">
                    <Text size="sm" fw={500}>
                      {form.values.customerName || selectedCustomer?.name}
                    </Text>
                    <Badge size="sm" color="blue">
                      {form.values.customerType}
                    </Badge>
                  </Group>
                  {form.values.customerPhone && (
                    <Text size="xs" c="dimmed">{form.values.customerPhone}</Text>
                  )}
                </Card>
              )}

              {/* Items List */}
              <ScrollArea style={{ height: 300 }}>
                <Stack spacing="xs">
                  {billItems.length === 0 ? (
                    <Center py="xl">
                      <Text c="dimmed" size="sm">No items added</Text>
                    </Center>
                  ) : (
                    billItems.map((item, index) => (
                      <Paper key={index} withBorder p="xs" radius="sm">
                        <Group position="apart" wrap="nowrap">
                          <Box style={{ flex: 1 }}>
                            <Text size="sm" fw={500} lineClamp={1}>
                              {item.itemName}
                            </Text>
                            <Group spacing="xs">
                              <Text size="xs" c="dimmed">
                                ₹{item.rate} × {item.quantity} {item.unit}
                              </Text>
                            </Group>
                          </Box>
                          <Group spacing="xs" wrap="nowrap">
                            <NumberInput
                              value={item.quantity}
                              onChange={(value) => handleQuantityChange(index, value)}
                              min={0.01}
                              step={0.01}
                              precision={2}
                              size="xs"
                              style={{ width: 70 }}
                            />
                            <Text fw={600} size="sm" style={{ minWidth: 60, textAlign: 'right' }}>
                              ₹{(item.amount + item.gstAmount).toFixed(2)}
                            </Text>
                            <ActionIcon
                              color="red"
                              size="sm"
                              variant="light"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))
                  )}
                </Stack>
              </ScrollArea>

              {/* Bill Summary */}
              <Box>
                <Stack spacing={4}>
                  <Group position="apart">
                    <Text size="sm" c="dimmed">Subtotal</Text>
                    <Text size="sm">₹{calculations.subtotal.toFixed(2)}</Text>
                  </Group>
                  <Group position="apart">
                    <Text size="sm" c="dimmed">GST</Text>
                    <Text size="sm">₹{calculations.totalGst.toFixed(2)}</Text>
                  </Group>
                  <Group position="apart">
                    <Group spacing={4}>
                      <IconPercentage size={14} />
                      <Text size="sm" c="dimmed">Discount</Text>
                    </Group>
                    <NumberInput
                      value={calculations.discount}
                      onChange={handleDiscountChange}
                      min={0}
                      max={calculations.subtotal}
                      step={1}
                      size="xs"
                      style={{ width: 100 }}
                      rightSection={<IconCurrencyRupee size={12} />}
                    />
                  </Group>
                  {calculations.oldBalance > 0 && (
                    <Group position="apart">
                      <Text size="sm" c="orange">Old Balance</Text>
                      <Text size="sm" c="orange">₹{calculations.oldBalance.toFixed(2)}</Text>
                    </Group>
                  )}
                  <Divider />
                  <Group position="apart">
                    <Text fw={700} size="lg">Total Due</Text>
                    <Text fw={700} size="lg" c="blue">₹{calculations.totalDue.toFixed(2)}</Text>
                  </Group>
                </Stack>
              </Box>

              {/* Payment Section */}
              <Box>
                <Divider label="Payment" labelPosition="center" mb="xs" />
                <Grid gutter="xs">
                  <Grid.Col span={6}>
                    <Select
                      label="Mode"
                      value={form.values.paymentMode}
                      onChange={(value) => form.setFieldValue('paymentMode', value)}
                      data={[
                        { value: 'Cash', label: 'Cash' },
                        { value: 'Card', label: 'Card' },
                        { value: 'UPI', label: 'UPI' },
                        { value: 'Credit', label: 'Credit' }
                      ]}
                      icon={<IconCreditCard size={16} />}
                      size="xs"
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Paid Amount"
                      placeholder="Enter amount"
                      value={form.values.paidAmount}
                      onChange={(value) => form.setFieldValue('paidAmount', value)}
                      min={0}
                      max={calculations.totalDue}
                      step={0.01}
                      precision={2}
                      icon={<IconCurrencyRupee size={16} />}
                      size="xs"
                    />
                  </Grid.Col>
                </Grid>
                {form.values.paidAmount > 0 && (
                  <Card mt="xs" p="xs" bg="green.0">
                    <Group position="apart">
                      <Text size="sm" fw={500}>Change</Text>
                      <Text size="sm" fw={600} c="green">
                        ₹{(parseFloat(form.values.paidAmount) - calculations.totalDue).toFixed(2)}
                      </Text>
                    </Group>
                  </Card>
                )}
              </Box>

              {/* Action Buttons */}
              <Button
                size="lg"
                leftSection={<IconDeviceFloppy size={20} />}
                onClick={form.onSubmit(handleSubmit)}
                loading={loading}
                disabled={billItems.length === 0}
                fullWidth
                color="green"
                styles={{
                  root: {
                    height: '50px',
                    fontSize: '16px'
                  }
                }}
              >
                {loading ? 'Processing...' : 'Save & Print Bill'}
              </Button>

              <Group grow>
                <Button
                  variant="light"
                  leftSection={<IconX size={16} />}
                  onClick={() => navigate('/sales')}
                  color="gray"
                >
                  Cancel
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconReceipt2 size={16} />}
                  onClick={resetForm}
                  color="blue"
                >
                  New Bill
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Print Confirmation Modal */}
      <Modal
        opened={printModalOpened}
        onClose={() => setPrintModalOpened(false)}
        title="Bill Created Successfully"
        centered
        size="sm"
      >
        <Stack>
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Text size="sm">Bill has been saved successfully!</Text>
          </Alert>
          <Text size="sm" ta="center">Do you want to print the bill?</Text>
          <Group position="right">
            <Button
              variant="light"
              onClick={() => {
                setPrintModalOpened(false);
                resetForm();
              }}
            >
              Skip
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={() => {
                handlePrint();
                setPrintModalOpened(false);
              }}
              color="green"
            >
              Print
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hidden Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
          {/* Thermal Printer Style Bill */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: '5px 0' }}>DAIRY COOPERATIVE</h2>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '2px 0' }}>GSTIN: XXXXXXXX</p>
            <p style={{ margin: '2px 0' }}>Phone: XXXXXXXXXX</p>
            <p style={{ margin: '2px 0' }}>{dayjs().format('DD-MM-YYYY HH:mm:ss')}</p>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
          </div>

          {/* Customer Info */}
          {(form.values.customerName || selectedCustomer) && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: '2px 0' }}>
                <strong>Customer:</strong> {form.values.customerName || selectedCustomer?.name}
              </p>
              {form.values.customerPhone && (
                <p style={{ margin: '2px 0' }}>
                  <strong>Phone:</strong> {form.values.customerPhone}
                </p>
              )}
              <p style={{ margin: '2px 0' }}>
                <strong>Type:</strong> {form.values.customerType}
              </p>
            </div>
          )}

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'left' }}>Item</th>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'right' }}>Qty</th>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'right' }}>Price</th>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {billItems.map((item, index) => (
                <tr key={index}>
                  <td style={{ padding: '3px 0', borderBottom: '1px dotted #ccc' }}>
                    {item.itemName}
                  </td>
                  <td style={{ padding: '3px 0', textAlign: 'right', borderBottom: '1px dotted #ccc' }}>
                    {item.quantity} {item.unit}
                  </td>
                  <td style={{ padding: '3px 0', textAlign: 'right', borderBottom: '1px dotted #ccc' }}>
                    {item.rate.toFixed(2)}
                  </td>
                  <td style={{ padding: '3px 0', textAlign: 'right', borderBottom: '1px dotted #ccc' }}>
                    {(item.amount + item.gstAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div style={{ marginTop: '20px' }}>
            <p style={{ margin: '2px 0', textAlign: 'right' }}>
              Subtotal: ₹{calculations.subtotal.toFixed(2)}
            </p>
            <p style={{ margin: '2px 0', textAlign: 'right' }}>
              GST: ₹{calculations.totalGst.toFixed(2)}
            </p>
            {calculations.discount > 0 && (
              <p style={{ margin: '2px 0', textAlign: 'right' }}>
                Discount: -₹{calculations.discount.toFixed(2)}
              </p>
            )}
            {calculations.oldBalance > 0 && (
              <p style={{ margin: '2px 0', textAlign: 'right' }}>
                Old Balance: ₹{calculations.oldBalance.toFixed(2)}
              </p>
            )}
            <p style={{ margin: '5px 0', textAlign: 'right', borderTop: '1px dashed #000', paddingTop: '5px' }}>
              <strong>GRAND TOTAL: ₹{calculations.totalDue.toFixed(2)}</strong>
            </p>
            {form.values.paidAmount > 0 && (
              <>
                <p style={{ margin: '2px 0', textAlign: 'right' }}>
                  Paid: ₹{parseFloat(form.values.paidAmount).toFixed(2)}
                </p>
                <p style={{ margin: '2px 0', textAlign: 'right' }}>
                  Balance: ₹{(calculations.totalDue - parseFloat(form.values.paidAmount)).toFixed(2)}
                </p>
              </>
            )}
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '2px 0' }}><strong>Thank You!</strong></p>
            <p style={{ margin: '2px 0' }}>Please visit again</p>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default BillingForm;