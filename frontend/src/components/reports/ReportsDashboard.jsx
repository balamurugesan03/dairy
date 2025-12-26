import { useNavigate } from 'react-router-dom';
import PageHeader from '../common/PageHeader';
import './ReportsDashboard.css';

const ReportsDashboard = () => {
  const navigate = useNavigate();

  const reports = [
    {
      title: 'Sales Report',
      description: 'View sales transactions with date filtering and export options',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#1890ff">
          <circle cx="9" cy="21" r="1" strokeWidth="2"/>
          <circle cx="20" cy="21" r="1" strokeWidth="2"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/sales',
      color: '#e6f7ff'
    },
    {
      title: 'Stock Report',
      description: 'Current stock levels and inventory balance',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#52c41a">
          <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="3 10 12 13 21 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/stock',
      color: '#f6ffed'
    },
    {
      title: 'Financial Reports',
      description: 'Profit & Loss, Balance Sheet, and Trading Account',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#faad14">
          <line x1="12" y1="1" x2="12" y2="23" strokeWidth="2" strokeLinecap="round"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/financial',
      color: '#fffbe6'
    },
    {
      title: 'Subsidy Report',
      description: 'Farmer subsidy details and calculations',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#722ed1">
          <polyline points="20 12 20 22 4 22 4 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="2" y="7" width="20" height="5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="22" x2="12" y2="7" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/subsidy',
      color: '#f9f0ff'
    },
    {
      title: 'Receipts & Disbursement',
      description: 'Summary of all receipts and disbursements',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="#eb2f96">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="13" x2="8" y2="13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="16" y1="17" x2="8" y2="17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      path: '/reports/receipts-disbursement',
      color: '#fff0f6'
    }
  ];

  return (
    <div className="reports-dashboard-container">
      <PageHeader
        title="Reports Dashboard"
        subtitle="Access all reports and analytics"
      />

      <div className="reports-grid">
        {reports.map((report, index) => (
          <div
            key={index}
            className="report-card"
            style={{ backgroundColor: report.color }}
            onClick={() => navigate(report.path)}
          >
            <div className="report-card-content">
              <div className="report-icon">
                {report.icon}
              </div>
              <h3 className="report-title">{report.title}</h3>
              <p className="report-description">{report.description}</p>
              <button className="btn btn-primary">View Report</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsDashboard;
