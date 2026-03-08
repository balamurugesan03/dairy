import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { Center, Loader } from '@mantine/core';
import { useCompany } from '../../context/CompanyContext';
import { quotationAPI } from '../../services/api';
import dayjs from 'dayjs';
import './QuotationPrint.css';

const QuotationPrint = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { selectedCompany } = useCompany();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handlePrint = () => window.print();

  if (loading) return <Center h={400}><Loader /></Center>;
  if (!quotation) return null;

  const q = quotation;
  const c = selectedCompany || {};

  // Group items by GST% for summary
  const gstSummary = {};
  (q.items || []).forEach(item => {
    const key = item.gstPercent || 0;
    if (!gstSummary[key]) gstSummary[key] = { taxable: 0, cgst: 0, sgst: 0 };
    gstSummary[key].taxable += item.taxableAmount || 0;
    gstSummary[key].cgst += item.cgstAmount || 0;
    gstSummary[key].sgst += item.sgstAmount || 0;
  });

  const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Convert number to words (simple Indian format)
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

  const amountInWords = toWords(Math.floor(q.grandTotal || 0)) + ' Rupees Only';

  return (
    <div className="qp-wrapper">
      {/* Toolbar — hidden on print */}
      <div className="qp-toolbar no-print">
        <button className="qp-btn qp-btn-outline" onClick={() => navigate('/quotations')}>
          ← Back to List
        </button>
        <button className="qp-btn qp-btn-outline" onClick={() => navigate(`/quotations/edit/${id}`)}>
          ✏ Edit
        </button>
        <button className="qp-btn qp-btn-primary" onClick={handlePrint}>
          🖨 Print / Download
        </button>
      </div>

      {/* Invoice Sheet */}
      <div className="qp-page">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="qp-header">
          <div className="qp-company">
            <div className="qp-company-logo">
              {c.companyName ? c.companyName.charAt(0).toUpperCase() : 'C'}
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
            <div className="qp-doc-title">QUOTATION</div>
            <div className="qp-doc-subtitle">Estimate / Proforma</div>
            <table className="qp-meta-table">
              <tbody>
                <tr>
                  <td className="qp-meta-label">Quotation No.</td>
                  <td className="qp-meta-value">{q.quotationNumber}</td>
                </tr>
                <tr>
                  <td className="qp-meta-label">Date</td>
                  <td className="qp-meta-value">{dayjs(q.quotationDate).format('DD MMM YYYY')}</td>
                </tr>
                <tr>
                  <td className="qp-meta-label">Valid Until</td>
                  <td className="qp-meta-value">{dayjs(q.validUntil).format('DD MMM YYYY')}</td>
                </tr>
                <tr>
                  <td className="qp-meta-label">Status</td>
                  <td className="qp-meta-value">
                    <span className={`qp-status qp-status-${(q.status || '').toLowerCase()}`}>
                      {q.status}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="qp-divider" />

        {/* ── BILL TO ────────────────────────────────────────── */}
        <div className="qp-parties">
          <div className="qp-bill-to">
            <div className="qp-section-label">BILL TO</div>
            <div className="qp-party-name">{q.partyName || '—'}</div>
            {q.partyOrganization && <div className="qp-party-org">{q.partyOrganization}</div>}
            {q.partyAddress && <div className="qp-party-detail">{q.partyAddress}</div>}
            {q.partyPhone && <div className="qp-party-detail">Ph: {q.partyPhone}</div>}
            {q.partyEmail && <div className="qp-party-detail">Email: {q.partyEmail}</div>}
            {q.partyGstin && <div className="qp-party-detail">GSTIN: {q.partyGstin}</div>}
            {q.partyState && <div className="qp-party-detail">State: {q.partyState}</div>}
          </div>
          <div className="qp-ship-to">
            <div className="qp-section-label">PREPARED BY</div>
            <div className="qp-party-name">{c.companyName || '—'}</div>
            {c.address && <div className="qp-party-detail">{c.address}</div>}
            {c.phone && <div className="qp-party-detail">Ph: {c.phone}</div>}
            {c.gstin && <div className="qp-party-detail">GSTIN: {c.gstin}</div>}
          </div>
        </div>

        {/* ── ITEMS TABLE ────────────────────────────────────── */}
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
            {(q.items || []).map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'qp-row-even' : 'qp-row-odd'}>
                <td className="qp-center">{idx + 1}</td>
                <td>
                  <span className="qp-item-name">{item.itemName}</span>
                  {item.itemCode && <span className="qp-item-code"> [{item.itemCode}]</span>}
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

        {/* ── TOTALS + GST SUMMARY ───────────────────────────── */}
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
                    <td className="qp-right">{fmt(vals.cgst + vals.sgst)}</td>
                  </tr>
                ))}
                <tr className="qp-gst-total">
                  <td>Total</td>
                  <td className="qp-right">{fmt(q.taxableAmount)}</td>
                  <td className="qp-right">{fmt(q.totalCgst)}</td>
                  <td className="qp-right">{fmt(q.totalSgst)}</td>
                  <td className="qp-right">{fmt(q.totalGst)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="qp-totals">
            <div className="qp-total-row">
              <span>Gross Amount</span>
              <span>₹ {fmt(q.grossAmount)}</span>
            </div>
            {q.itemDiscount > 0 && (
              <div className="qp-total-row qp-discount">
                <span>Item Discount</span>
                <span>- ₹ {fmt(q.itemDiscount)}</span>
              </div>
            )}
            {q.billDiscount > 0 && (
              <div className="qp-total-row qp-discount">
                <span>Bill Discount</span>
                <span>- ₹ {fmt(q.billDiscount)}</span>
              </div>
            )}
            <div className="qp-total-row">
              <span>Taxable Amount</span>
              <span>₹ {fmt(q.taxableAmount)}</span>
            </div>
            {q.totalCgst > 0 && (
              <div className="qp-total-row">
                <span>CGST</span>
                <span>₹ {fmt(q.totalCgst)}</span>
              </div>
            )}
            {q.totalSgst > 0 && (
              <div className="qp-total-row">
                <span>SGST</span>
                <span>₹ {fmt(q.totalSgst)}</span>
              </div>
            )}
            {q.totalIgst > 0 && (
              <div className="qp-total-row">
                <span>IGST</span>
                <span>₹ {fmt(q.totalIgst)}</span>
              </div>
            )}
            {q.roundOff !== 0 && (
              <div className="qp-total-row">
                <span>Round Off</span>
                <span>₹ {fmt(q.roundOff)}</span>
              </div>
            )}
            <div className="qp-divider" style={{ margin: '6px 0' }} />
            <div className="qp-total-row qp-grand-total">
              <span>GRAND TOTAL</span>
              <span>₹ {fmt(q.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="qp-amount-words">
          <span className="qp-words-label">Amount in Words: </span>
          <span className="qp-words-value">{amountInWords}</span>
        </div>

        {/* ── NOTES & TERMS ──────────────────────────────────── */}
        {(q.notes || q.termsAndConditions) && (
          <div className="qp-notes-section">
            {q.notes && (
              <div className="qp-notes-block">
                <div className="qp-section-label">NOTES</div>
                <div className="qp-notes-text">{q.notes}</div>
              </div>
            )}
            {q.termsAndConditions && (
              <div className="qp-notes-block">
                <div className="qp-section-label">TERMS & CONDITIONS</div>
                <div className="qp-notes-text" style={{ whiteSpace: 'pre-line' }}>{q.termsAndConditions}</div>
              </div>
            )}
          </div>
        )}

        {/* ── SIGNATURE ──────────────────────────────────────── */}
        <div className="qp-signature">
          <div className="qp-sig-block">
            <div className="qp-sig-line" />
            <div className="qp-sig-label">Customer Signature &amp; Seal</div>
          </div>
          <div className="qp-sig-center">
            <div className="qp-sig-accept">
              This quotation is valid until <strong>{dayjs(q.validUntil).format('DD MMM YYYY')}</strong>.
              <br />Please confirm acceptance by signing and returning.
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

export default QuotationPrint;
