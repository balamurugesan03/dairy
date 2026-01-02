import { useState, useEffect } from 'react';
import { itemAPI, ledgerAPI, supplierAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';

const ItemList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [ledgers, setLedgers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    fetchItems();
    fetchLedgers();
    fetchSuppliers();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll({ status: 'Active' });
      setLedgers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch ledgers:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await supplierAPI.getAll({ active: 'true' });
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await itemAPI.getAll();
      setItems(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({});
    setErrors({});
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    // Properly set ledger IDs and supplier ID for editing
    setFormData({
      ...item,
      purchaseLedger: item.purchaseLedger?._id || '',
      salesLedger: item.salesLedger?._id || '',
      supplier: item.supplier?._id || ''
    });
    setErrors({});
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Item',
      content: 'Are you sure you want to deactivate this item?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await itemAPI.delete(id);
          message.success('Item deactivated successfully');
          fetchItems();
        } catch (error) {
          message.error(error.message || 'Failed to deactivate item');
        }
      }
    });
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.itemCode) newErrors.itemCode = 'Item code is required';
    if (!formData.itemName) newErrors.itemName = 'Item name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.unit) newErrors.unit = 'Unit is required';
    if (!editingItem && !formData.openingBalance) newErrors.openingBalance = 'Opening balance is required';
    if (!formData.purchaseRate) newErrors.purchaseRate = 'Purchase rate is required';
    if (!formData.salesRate) newErrors.salesRate = 'Sales rate is required';

    // Validate ledger fields when category is selected
    if (formData.category) {
      if (!formData.purchaseLedger) newErrors.purchaseLedger = 'Purchase ledger is required';
      if (!formData.salesLedger) newErrors.salesLedger = 'Sales ledger is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      message.error('Please fill all required fields');
      return;
    }

    try {
      if (editingItem) {
        await itemAPI.update(editingItem._id, formData);
        message.success('Item updated successfully');
      } else {
        await itemAPI.create(formData);
        message.success('Item created successfully');
      }
      setModalVisible(false);
      fetchItems();
    } catch (error) {
      message.error(error.message || 'Failed to save item');
    }
  };

  const getTagColor = (balance) => {
    if (balance < 10) return '#ff4d4f';
    if (balance < 50) return '#faad14';
    return '#52c41a';
  };

  const renderTag = (balance, unit) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      background: `${getTagColor(balance)}20`,
      color: getTagColor(balance),
      border: `1px solid ${getTagColor(balance)}`
    }}>
      {balance} {unit}
    </span>
  );

  const getStatusTagColor = (status) => status === 'Active' ? '#52c41a' : '#ff4d4f';

  return (
    <div>
      <PageHeader
        title="Item Master"
        subtitle="Manage inventory items"
        extra={[
          <button
            key="add"
            className="btn btn-primary"
            onClick={handleAdd}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Add Item
          </button>
        ]}
      />

      <div style={{ overflowX: 'auto' }}>
        <table className="billing-table" style={{ minWidth: '1500px' }}>
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Current Balance</th>
              <th>Purchase Rate</th>
              <th>Sales Rate</th>
              <th>Supplier</th>
              <th>Purchase Ledger</th>
              <th>Sales Ledger</th>
              <th>GST %</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner"></div>
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan="13" className="table-empty">
                  No items found
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td>{item.itemCode}</td>
                  <td>{item.itemName}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td>{renderTag(item.currentBalance, item.unit)}</td>
                  <td>₹{item.purchaseRate || 0}</td>
                  <td>₹{item.salesRate || 0}</td>
                  <td>{item.supplier?.name || '-'}</td>
                  <td>{item.purchaseLedger?.ledgerName || '-'}</td>
                  <td>{item.salesLedger?.ledgerName || '-'}</td>
                  <td>{item.gstPercent || 0}%</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: `${getStatusTagColor(item.status)}20`,
                      color: getStatusTagColor(item.status),
                      border: `1px solid ${getStatusTagColor(item.status)}`
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-link"
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleDelete(item._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalVisible && (
        <div className="modal-overlay" onClick={() => setModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingItem ? 'Edit Item' : 'Add Item'}</h3>
              <button className="modal-close" onClick={() => setModalVisible(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Item Code</label>
                    <input
                      type="text"
                      className={`form-input ${errors.itemCode ? 'error' : ''}`}
                      placeholder="Enter item code"
                      value={formData.itemCode || ''}
                      onChange={(e) => handleInputChange('itemCode', e.target.value)}
                      disabled={editingItem}
                    />
                    {errors.itemCode && <div className="form-error">{errors.itemCode}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Item Name</label>
                    <input
                      type="text"
                      className={`form-input ${errors.itemName ? 'error' : ''}`}
                      placeholder="Enter item name"
                      value={formData.itemName || ''}
                      onChange={(e) => handleInputChange('itemName', e.target.value)}
                    />
                    {errors.itemName && <div className="form-error">{errors.itemName}</div>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Category</label>
                    <select
                      className={`form-select ${errors.category ? 'error' : ''}`}
                      value={formData.category || ''}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                    >
                      <option value="">Select category</option>
                      <option value="Feed">Feeds</option>
                      <option value="CattleFeed">CattleFeed</option>
                      <option value="Medicine">Medicine</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Dairy Products">Dairy Products</option>
                      <option value="Minerals">Minerals</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.category && <div className="form-error">{errors.category}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Unit</label>
                    <select
                      className={`form-select ${errors.unit ? 'error' : ''}`}
                      value={formData.unit || ''}
                      onChange={(e) => handleInputChange('unit', e.target.value)}
                    >
                      <option value="">Select unit</option>
                      <option value="Kg">Kg</option>
                      <option value="Ltr">Ltr</option>
                      <option value="Pcs">Pcs</option>
                      <option value="Box">Box</option>
                      <option value="Bag">Bag</option>
                    </select>
                    {errors.unit && <div className="form-error">{errors.unit}</div>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Supplier</label>
                  <select
                    className="form-select"
                    value={formData.supplier || ''}
                    onChange={(e) => handleInputChange('supplier', e.target.value)}
                  >
                    <option value="">Select supplier (Optional)</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier._id} value={supplier._id}>
                        {supplier.name} ({supplier.supplierId}) - {supplier.phone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Show ledger fields when category is selected */}
                {formData.category && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label required">
                        {formData.category} Purchase Ledger
                      </label>
                      <select
                        className={`form-select ${errors.purchaseLedger ? 'error' : ''}`}
                        value={formData.purchaseLedger || ''}
                        onChange={(e) => handleInputChange('purchaseLedger', e.target.value)}
                      >
                        <option value="">Select purchase ledger</option>
                        {ledgers.map((ledger) => (
                          <option key={ledger._id} value={ledger._id}>
                            {ledger.ledgerName} ({ledger.ledgerType})
                          </option>
                        ))}
                      </select>
                      {errors.purchaseLedger && <div className="form-error">{errors.purchaseLedger}</div>}
                    </div>

                    <div className="form-group">
                      <label className="form-label required">
                        {formData.category} Sales Ledger
                      </label>
                      <select
                        className={`form-select ${errors.salesLedger ? 'error' : ''}`}
                        value={formData.salesLedger || ''}
                        onChange={(e) => handleInputChange('salesLedger', e.target.value)}
                      >
                        <option value="">Select sales ledger</option>
                        {ledgers.map((ledger) => (
                          <option key={ledger._id} value={ledger._id}>
                            {ledger.ledgerName} ({ledger.ledgerType})
                          </option>
                        ))}
                      </select>
                      {errors.salesLedger && <div className="form-error">{errors.salesLedger}</div>}
                    </div>
                  </div>
                )}

                {!editingItem && (
                  <div className="form-group">
                    <label className="form-label required">Opening Balance</label>
                    <input
                      type="number"
                      className={`form-input ${errors.openingBalance ? 'error' : ''}`}
                      placeholder="Enter opening balance"
                      value={formData.openingBalance || ''}
                      onChange={(e) => handleInputChange('openingBalance', parseFloat(e.target.value))}
                      min="0"
                    />
                    {errors.openingBalance && <div className="form-error">{errors.openingBalance}</div>}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Purchase Rate</label>
                    <input
                      type="number"
                      className={`form-input ${errors.purchaseRate ? 'error' : ''}`}
                      placeholder="Enter purchase rate"
                      value={formData.purchaseRate || ''}
                      onChange={(e) => handleInputChange('purchaseRate', parseFloat(e.target.value))}
                      min="0"
                    />
                    {errors.purchaseRate && <div className="form-error">{errors.purchaseRate}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Sales Rate</label>
                    <input
                      type="number"
                      className={`form-input ${errors.salesRate ? 'error' : ''}`}
                      placeholder="Enter sales rate"
                      value={formData.salesRate || ''}
                      onChange={(e) => handleInputChange('salesRate', parseFloat(e.target.value))}
                      min="0"
                    />
                    {errors.salesRate && <div className="form-error">{errors.salesRate}</div>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">GST Percentage</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter GST %"
                      value={formData.gstPercent || ''}
                      onChange={(e) => handleInputChange('gstPercent', parseFloat(e.target.value))}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">HSN Code</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter HSN code"
                      value={formData.hsnCode || ''}
                      onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setModalVisible(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemList;
