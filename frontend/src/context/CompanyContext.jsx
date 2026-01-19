import { createContext, useContext, useState, useEffect } from 'react';
import { companyAPI } from '../services/api';

const CompanyContext = createContext();

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

export const CompanyProvider = ({ children }) => {
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load company data from localStorage on mount
  useEffect(() => {
    loadCompanyFromStorage();
  }, []);

  const loadCompanyFromStorage = async () => {
    try {
      const savedCompanyId = localStorage.getItem('selectedCompanyId');
      const savedBusinessType = localStorage.getItem('selectedBusinessType');

      if (savedCompanyId && savedBusinessType) {
        // Fetch the company details from API with timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );

        const response = await Promise.race([
          companyAPI.getById(savedCompanyId),
          timeoutPromise
        ]);

        if (response.success) {
          const company = response.data;

          // Verify the company is still active
          if (company.status === 'Active') {
            // Verify the saved business type is still valid for this company
            if (company.businessTypes.includes(savedBusinessType)) {
              setSelectedCompany(company);
              setSelectedBusinessType(savedBusinessType);
            } else {
              // Business type no longer valid, clear storage
              clearCompany();
            }
          } else {
            // Company is no longer active, clear storage
            clearCompany();
          }
        } else {
          clearCompany();
        }
      }
    } catch (error) {
      console.error('Error loading company from storage:', error);
      clearCompany();
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await companyAPI.getAll();
      if (response.success) {
        setCompanies(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      setCompanies([]);
    }
  };

  const setCompany = (company, businessType) => {
    // Validate that the business type is supported by the company
    if (!company.businessTypes.includes(businessType)) {
      console.error('Invalid business type for this company');
      return;
    }

    setSelectedCompany(company);
    setSelectedBusinessType(businessType);

    // Save to localStorage
    localStorage.setItem('selectedCompanyId', company._id);
    localStorage.setItem('selectedBusinessType', businessType);
  };

  const clearCompany = () => {
    setSelectedCompany(null);
    setSelectedBusinessType(null);
    localStorage.removeItem('selectedCompanyId');
    localStorage.removeItem('selectedBusinessType');
  };

  const switchCompany = (company, businessType) => {
    setCompany(company, businessType);
    // Reload the page to refresh all data
    window.location.href = '/';
  };

  const value = {
    selectedCompany,
    selectedBusinessType,
    companies,
    loading,
    setCompany,
    clearCompany,
    switchCompany,
    fetchCompanies
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

export default CompanyContext;
