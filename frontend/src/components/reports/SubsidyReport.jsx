import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import './SubsidyReport.css';

const SubsidyReport = () => {
  const [loading, setLoading] = useState(false);
  const [subsidyData, setSubsidyData] = useState([]);
  const [summary, setSummary] = useState({
    totalFarmers: 0,
    totalLitres: 0,
    totalSubsidy: 0,
    totalAmount: 0
  });
  const [dateRange, setDateRange] = useState({
    startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('month').format('YYYY-MM-DD')
  });

  useEffect(() => {
    fetchSubsidyReport();
  }, []);

  const fetchSubsidyReport = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(dateRange.startDate).toISOString(),
        endDate: dayjs(dateRange.endDate).toISOString()
      };
      const response = await reportAPI.subsidy(params);

      setSubsidyData(response.data.subsidies || []);

      // Calculate summary
      const totalFarmers = response.data.subsidies?.length || 0;
      const totalLitres = response.data.subsidies?.reduce((sum, item) => sum + (item.totalLitres || 0), 0) || 0;
      const totalSubsidy = response.data.subsidies?.reduce((sum, item) => sum + (item.subsidyAmount || 0), 0) || 0;
      const totalAmount = response.data.subsidies?.reduce((sum, item) => sum + (item.totalAmount || 0), 0) || 0;

      setSummary({
        totalFarmers,
        totalLitres,
        totalSubsidy,
        totalAmount
      });
    } catch (error) {
      message.error(error.message || 'Failed to fetch subsidy report');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const exportData = subsidyData.map(item => ({
    'Farmer No': item.farmerNumber,
    'Farmer Name': item.farmer?.name || item.farmerName || '-',
    'Village': item.farmer?.address?.village || item.village || '-',
    'Farmer Type': item.farmer?.farmerType || item.farmerType || '-',
    'Cow Type': item.farmer?.cowType || item.cowType || '-',
    'Total Litres': (item.totalLitres || 0).toFixed(2),
    'Rate per Litre': (item.ratePerLitre || 0).toFixed(2),
    'Subsidy per Litre': (item.subsidyPerLitre || 0).toFixed(2),
    'Subsidy Amount': (item.subsidyAmount || 0).toFixed(2),
    'Total Amount': (item.totalAmount || 0).toFixed(2)
  }));

  return (
    <div className="subsidy-report">
      <PageHeader
        title="Subsidy Report"
        subtitle="Farmer subsidy details and calculations"
      />

      <div className="summary-cards">
        <div className="stat-card">
          <div className="stat-title">Total Farmers</div>
          <div className="stat-value">#{summary.totalFarmers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Litres</div>
          <div className="stat-value">{summary.totalLitres.toFixed(2)} L</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Subsidy</div>
          <div className="stat-value">₹{summary.totalSubsidy.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Amount</div>
          <div className="stat-value">₹{summary.totalAmount.toFixed(2)}</div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-controls">
          <div className="date-inputs">
            <input
              type="date"
              name="startDate"
              value={dateRange.startDate}
              onChange={handleDateChange}
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              name="endDate"
              value={dateRange.endDate}
              onChange={handleDateChange}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={fetchSubsidyReport}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <ExportButton
            data={exportData}
            filename="subsidy_report"
            buttonText="Export to Excel"
          />
        </div>

        <div className="table-container">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Farmer No</th>
                  <th>Farmer Name</th>
                  <th>Village</th>
                  <th>Farmer Type</th>
                  <th>Cow Type</th>
                  <th className="text-right">Total Litres</th>
                  <th className="text-right">Rate per Litre</th>
                  <th className="text-right">Subsidy per Litre</th>
                  <th className="text-right">Subsidy Amount</th>
                  <th className="text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {subsidyData.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="no-data">No data available</td>
                  </tr>
                ) : (
                  subsidyData.map((item, index) => (
                    <tr key={item.farmerNumber || item._id || index}>
                      <td>{item.farmerNumber}</td>
                      <td>{item.farmer?.name || item.farmerName || '-'}</td>
                      <td>{item.farmer?.address?.village || item.village || '-'}</td>
                      <td>{item.farmer?.farmerType || item.farmerType || '-'}</td>
                      <td>{item.farmer?.cowType || item.cowType || '-'}</td>
                      <td className="text-right">{(item.totalLitres || 0).toFixed(2)} L</td>
                      <td className="text-right">₹{(item.ratePerLitre || 0).toFixed(2)}</td>
                      <td className="text-right">₹{(item.subsidyPerLitre || 0).toFixed(2)}</td>
                      <td className="text-right">₹{(item.subsidyAmount || 0).toFixed(2)}</td>
                      <td className="text-right">₹{(item.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {subsidyData.length > 0 && (
                <tfoot>
                  <tr className="total-row">
                    <td colSpan="5" className="text-right">Total:</td>
                    <td className="text-right">{summary.totalLitres.toFixed(2)} L</td>
                    <td></td>
                    <td></td>
                    <td className="text-right">₹{summary.totalSubsidy.toFixed(2)}</td>
                    <td className="text-right">₹{summary.totalAmount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubsidyReport;
