import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { Center, Loader } from '@mantine/core';
import { useCompany } from '../../context/CompanyContext';
import { businessSalesAPI } from '../../services/api';
import dayjs from 'dayjs';
import '../additional/QuotationPrint.css';

const BusinessSalesInvoicePrint = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { selectedCompany } = useCompany();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchInvoice(); }, [id]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await businessSalesAPI.getById(id);
      setInvoice(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      navigate('/business-inventory/sales/list');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) return <Center h={400}><Loader /></Center>;
  if (!invoice) return null;

  const inv = invoice;
  const c = selectedCompany || {};

  // Group items by GST% for summary
  const gstSummary = {};
  (inv.items || []).forEach(item => {
    const key = item.gstPercent || 0;
    if (!gstSummary[key]) gstSummary[key] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    gstSummary[key].taxable += item.taxableAmount || 0;
    gstSummary[key].cgst += item.cgstAmount || 0;
    gstSummary[key].sgst += item.sgstAmount || 0;
    gstSummary[key].igst += item.igstAmount || 0;
  });

  const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Number to words (Indian format)
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const toWords = (num) => {
    num = Math.round(num);
    if (num === 0) return 'Zero';
    const convert = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    return convert(num);
  };

  const amountInWords = toWords(Math.floor(inv.grandTotal || 0)) + ' Rupees Only';

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return { background: '#d3f9d8', color: '#2f9e44' };
      case 'Partial': return { background: '#fff3bf', color: '#e67700' };
      case 'Unpaid': return { background: '#ffe3e3', color: '#c92a2a' };
      default: return { background: '#f1f3f5', color: '#495057' };
    }
  };

  const docTitle = inv.invoiceType === 'Sale' ? 'TAX INVOICE'
    : inv.invoiceType === 'Estimate' ? 'ESTIMATE'
    : inv.invoiceType === 'Delivery Challan' ? 'DELIVERY CHALLAN'
    : inv.invoiceType === 'Proforma' ? 'PROFORMA INVOICE'
    : (inv.invoiceType || 'INVOICE').toUpperCase();

  const statusStyle = getStatusColor(inv.paymentStatus);

  return (
    <div className="qp-wrapper">
      {/* Toolbar — hidden on print */}
      <div className="qp-toolbar no-print">
        <button className="qp-btn qp-btn-outline" onClick={() => navigate('/business-inventory/sales/list')}>
          ← Back to List
        </button>
        <button className="qp-btn qp-btn-outline" onClick={() => navigate(`/business-inventory/sales/edit/${id}`)}>
          ✏ Edit
        </button>
        <button className="qp-btn qp-btn-primary" onClick={handlePrint}>
          🖨 Print / Download
        </button>
      </div>

      {/* Invoice Page */}
      <div className="qp-page">

        {/* HEADER */}
        <div className="qp-header">
          <div className="qp-company">
            <div className="qp-company-logo">
              {c.companyName ? c.companyName.charAt(0).toUpperCase() : 'B'}
            </div>
            <div className="qp-company-info">
              <div className="qp-company-name">{c.companyName || 'Your Company Name'}</div>
              {c.address && <div className="qp-company-detail">{c.address}</div>}
              {(c.city || c.state || c.pincode) && (
                <div className="qp-company-detail">
                  {[c.city, c.state, c.pincode].filter(Boolean).join(', ')}
                </div>
              )}
              {c.phone && <div className="qp-company-detail">Ph: {c.phone}</div>}
              {c.email && <div className="qp-company-detail">Email: {c.email}</div>}
              {c.gstin && <div className="qp-company-detail">GSTIN: {c.gstin}</div>}
            </div>
          </div>

          <div className="qp-doc-info">
            <div className="qp-doc-title">{docTitle}</div>
            <div className="qp-doc-subtitle">
              {inv.invoiceType === 'Sale' ? 'Original for Recipient' : inv.invoiceType}
            </div>
            <table className="qp-meta-table">
              <tbody>
                <tr>
                  <td className="qp-meta-label">Invoice No.</td>
                  <td className="qp-meta-value">{inv.invoiceNumber}</td>
                </tr>
                <tr>
                  <td className="qp-meta-label">Date</td>
                  <td className="qp-meta-value">{dayjs(inv.invoiceDate).format('DD MMM YYYY')}</td>
                </tr>
                {inv.poNumber && (
                  <tr>
                    <td className="qp-meta-label">PO No.</td>
                    <td className="qp-meta-value">{inv.poNumber}</td>
                  </tr>
                )}
                {inv.ewaybillNumber && (
                  <tr>
                    <td className="qp-meta-label">E-Way Bill</td>
                    <td className="qp-meta-value">{inv.ewaybillNumber}</td>
                  </tr>
                )}
                <tr>
                  <td className="qp-meta-label">Status</td>
                  <td className="qp-meta-value">
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.5px', ...statusStyle
                    }}>
                      {inv.paymentStatus}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="qp-divider" />

        {/* BILL TO / COMPANY */}
        <div className="qp-parties">
          <div className="qp-bill-to">
            <div className="qp-section-label">BILL TO</div>
            <div className="qp-party-name">{inv.partyName || 'Walk-in Customer'}</div>
            {inv.partyAddress && <div className="qp-party-detail">{inv.partyAddress}</div>}
            {inv.partyPhone && <div className="qp-party-detail">Ph: {inv.partyPhone}</div>}
            {inv.partyGstin && <div className="qp-party-detail">GSTIN: {inv.partyGstin}</div>}
            {inv.partyState && <div className="qp-party-detail">State: {inv.partyState}</div>}
          </div>
          <div className="qp-ship-to">
            <div className="qp-section-label">FROM</div>
            <div className="qp-party-name">{c.companyName || '—'}</div>
            {c.address && <div className="qp-party-detail">{c.address}</div>}
            {c.phone && <div className="qp-party-detail">Ph: {c.phone}</div>}
            {c.gstin && <div className="qp-party-detail">GSTIN: {c.gstin}</div>}
            {inv.salesmanName && <div className="qp-party-detail">Salesman: {inv.salesmanName}</div>}
            {inv.vehicleNumber && <div className="qp-party-detail">Vehicle: {inv.vehicleNumber}</div>}
            {inv.transportName && <div className="qp-party-detail">Transport: {inv.transportName}</div>}
          </div>
        </div>

        {/* ITEMS TABLE */}
        <table className="qp-items-table">
          <thead>
            <tr>
              <th className="qp-col-sno">#</th>
              <th className="qp-col-item">Item / Description</th>
              <th className="qp-col-hsn">HSN/SAC</th>
              <th className="qp-col-qty">Qty</th>
              <th className="qp-col-unit">Unit</th>
              <th className="qp-col-rate">Rate (₹)</th>
              <th className="qp-col-disc">Disc%</th>
              <th className="qp-col-taxable">Taxable (₹)</th>
              <th className="qp-col-gst">GST%</th>
              <th className="qp-col-total">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'qp-row-even' : 'qp-row-odd'}>
                <td className="qp-center">{idx + 1}</td>
                <td>
                  <span className="qp-item-name">{item.itemName}</span>
                  {item.itemCode && <span className="qp-item-code"> [{item.itemCode}]</span>}
                  {item.freeQty > 0 && <span className="qp-item-code"> +{item.freeQty} Free</span>}
                </td>
                <td className="qp-center">{item.hsnCode || '—'}</td>
                <td className="qp-center">{item.quantity}</td>
                <td className="qp-center">{item.unit || '—'}</td>
                <td className="qp-right">{fmt(item.rate)}</td>
                <td className="qp-center">{item.discountPercent || 0}%</td>
                <td className="qp-right">{fmt(item.taxableAmount)}</td>
                <td className="qp-center">{item.gstPercent || 0}%</td>
                <td className="qp-right qp-bold">{fmt(item.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALS + GST SUMMARY */}
        <div className="qp-bottom">
          {/* GST Summary */}
          <div className="qp-gst-summary">
            <div className="qp-section-label" style={{ marginBottom: 6 }}>TAX SUMMARY</div>
            <table className="qp-gst-table">
              <thead>
                <tr>
                  <th>GST%</th>
                  <th>Taxable (₹)</th>
                  <th>CGST (₹)</th>
                  <th>SGST (₹)</th>
                  {Object.values(gstSummary).some(v => v.igst > 0) && <th>IGST (₹)</th>}
                  <th>Total Tax (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(gstSummary).map(([rate, vals]) => (
                  <tr key={rate}>
                    <td className="qp-center">{rate}%</td>
                    <td className="qp-right">{fmt(vals.taxable)}</td>
                    <td className="qp-right">{fmt(vals.cgst)}</td>
                    <td className="qp-right">{fmt(vals.sgst)}</td>
                    {Object.values(gstSummary).some(v => v.igst > 0) && (
                      <td className="qp-right">{fmt(vals.igst)}</td>
                    )}
                    <td className="qp-right">{fmt(vals.cgst + vals.sgst + vals.igst)}</td>
                  </tr>
                ))}
                <tr className="qp-gst-total">
                  <td>Total</td>
                  <td className="qp-right">{fmt(inv.taxableAmount)}</td>
                  <td className="qp-right">{fmt(inv.totalCgst)}</td>
                  <td className="qp-right">{fmt(inv.totalSgst)}</td>
                  {Object.values(gstSummary).some(v => v.igst > 0) && (
                    <td className="qp-right">{fmt(inv.totalIgst)}</td>
                  )}
                  <td className="qp-right">{fmt(inv.totalGst)}</td>
                </tr>
              </tbody>
            </table>

            {/* Payment info */}
            <div style={{ marginTop: 14 }}>
              <div className="qp-section-label" style={{ marginBottom: 6 }}>PAYMENT</div>
              <table className="qp-gst-table">
                <tbody>
                  <tr>
                    <td style={{ padding: '5px 8px', border: '1px solid #dee2e6' }}>Mode</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #dee2e6', fontWeight: 600 }}>
                      {inv.paymentMode || '—'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 8px', border: '1px solid #dee2e6' }}>Amount Paid</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #dee2e6', fontWeight: 600, color: '#2f9e44' }}>
                      ₹ {fmt(inv.paidAmount)}
                    </td>
                  </tr>
                  {inv.balanceAmount > 0 && (
                    <tr>
                      <td style={{ padding: '5px 8px', border: '1px solid #dee2e6' }}>Balance Due</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #dee2e6', fontWeight: 700, color: '#c92a2a' }}>
                        ₹ {fmt(inv.balanceAmount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="qp-totals">
            <div className="qp-total-row">
              <span>Gross Amount</span>
              <span>₹ {fmt(inv.grossAmount)}</span>
            </div>
            {inv.itemDiscount > 0 && (
              <div className="qp-total-row qp-discount">
                <span>Item Discount</span>
                <span>- ₹ {fmt(inv.itemDiscount)}</span>
              </div>
            )}
            {inv.billDiscount > 0 && (
              <div className="qp-total-row qp-discount">
                <span>Bill Discount</span>
                <span>- ₹ {fmt(inv.billDiscount)}</span>
              </div>
            )}
            {inv.promotionDiscount > 0 && (
              <div className="qp-total-row qp-discount">
                <span>Promo Discount</span>
                <span>- ₹ {fmt(inv.promotionDiscount)}</span>
              </div>
            )}
            <div className="qp-total-row">
              <span>Taxable Amount</span>
              <span>₹ {fmt(inv.taxableAmount)}</span>
            </div>
            {inv.totalCgst > 0 && (
              <div className="qp-total-row">
                <span>CGST</span>
                <span>₹ {fmt(inv.totalCgst)}</span>
              </div>
            )}
            {inv.totalSgst > 0 && (
              <div className="qp-total-row">
                <span>SGST</span>
                <span>₹ {fmt(inv.totalSgst)}</span>
              </div>
            )}
            {inv.totalIgst > 0 && (
              <div className="qp-total-row">
                <span>IGST</span>
                <span>₹ {fmt(inv.totalIgst)}</span>
              </div>
            )}
            {inv.roundOff !== 0 && (
              <div className="qp-total-row">
                <span>Round Off</span>
                <span>₹ {fmt(inv.roundOff)}</span>
              </div>
            )}
            <div className="qp-divider" style={{ margin: '6px 0' }} />
            <div className="qp-total-row qp-grand-total">
              <span>GRAND TOTAL</span>
              <span>₹ {fmt(inv.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="qp-amount-words">
          <span className="qp-words-label">Amount in Words: </span>
          <span className="qp-words-value">{amountInWords}</span>
        </div>

        {/* NOTES & TERMS */}
        {(inv.notes || inv.termsAndConditions) && (
          <div className="qp-notes-section">
            {inv.notes && (
              <div className="qp-notes-block">
                <div className="qp-section-label">NOTES</div>
                <div className="qp-notes-text">{inv.notes}</div>
              </div>
            )}
            {inv.termsAndConditions && (
              <div className="qp-notes-block">
                <div className="qp-section-label">TERMS &amp; CONDITIONS</div>
                <div className="qp-notes-text" style={{ whiteSpace: 'pre-line' }}>{inv.termsAndConditions}</div>
              </div>
            )}
          </div>
        )}

        {/* SIGNATURE */}
        <div className="qp-signature">
          <div className="qp-sig-block">
            <div className="qp-sig-line" />
            <div className="qp-sig-label">Customer Signature &amp; Seal</div>
          </div>
          <div className="qp-sig-center">
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
              Thank you for your business!<br />
              Please retain this invoice for your records.
            </div>
          </div>
          <div className="qp-sig-block">
            <div className="qp-sig-line" />
            <div className="qp-sig-label">For {c.companyName || 'Company'}</div>
            <div className="qp-sig-sublabel">Authorized Signatory</div>
          </div>
        </div>

        {/* Footer */}
        <div className="qp-footer">
          <div>This is a computer-generated document. No signature required unless stated.</div>
          <div>Generated on {dayjs().format('DD MMM YYYY, hh:mm A')}</div>
        </div>
      </div>
    </div>
  );
};

export default BusinessSalesInvoicePrint;
