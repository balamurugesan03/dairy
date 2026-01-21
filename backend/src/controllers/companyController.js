import Company from '../models/Company.js';

// Create a new company
export const createCompany = async (req, res) => {
  try {
    const companyData = req.body;

    // Check if company with same name already exists
    const existingCompany = await Company.findOne({
      companyName: companyData.companyName
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company with this name already exists'
      });
    }

    // Check if username already exists
    if (companyData.username) {
      const existingUsername = await Company.findOne({
        username: companyData.username.toLowerCase()
      });

      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Validate business types
    if (!companyData.businessTypes || companyData.businessTypes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one business type must be selected'
      });
    }

    const company = new Company(companyData);
    await company.save();

    // Remove password from response
    company.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create company'
    });
  }
};

// Get all companies (with optional filters)
export const getAllCompanies = async (req, res) => {
  try {
    const { status, businessType, limit, all } = req.query;

    let query = {};

    // If 'all' parameter is true, don't filter by status
    if (all === 'true' || all === '1') {
      // No status filter - get all companies
    } else if (status) {
      query.status = status;
    } else {
      // Default to active companies for non-admin requests
      query.status = 'Active';
    }

    // Filter by business type
    if (businessType) {
      query.businessTypes = businessType;
    }

    let companiesQuery = Company.find(query).sort({ companyName: 1 });

    // Apply limit if specified
    if (limit) {
      companiesQuery = companiesQuery.limit(parseInt(limit));
    }

    const companies = await companiesQuery;

    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch companies'
    });
  }
};

// Get company by ID
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch company'
    });
  }
};

// Update company
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if trying to update to a duplicate company name
    if (updateData.companyName) {
      const existingCompany = await Company.findOne({
        companyName: updateData.companyName,
        _id: { $ne: id }
      });

      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'Company with this name already exists'
        });
      }
    }

    // Check if trying to update to a duplicate username
    if (updateData.username) {
      const existingUsername = await Company.findOne({
        username: updateData.username.toLowerCase(),
        _id: { $ne: id }
      });

      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }

    // Validate business types if provided
    if (updateData.businessTypes && updateData.businessTypes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one business type must be selected'
      });
    }

    // If password is being updated, use save() to trigger pre-save hook for hashing
    if (updateData.password) {
      const company = await Company.findById(id);
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      // Update all fields
      Object.keys(updateData).forEach(key => {
        company[key] = updateData[key];
      });

      await company.save();

      // Remove password from response
      company.password = undefined;

      return res.status(200).json({
        success: true,
        message: 'Company updated successfully',
        data: company
      });
    }

    // For non-password updates, use findByIdAndUpdate
    const company = await Company.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update company'
    });
  }
};

// Delete company (permanent delete)
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Permanently delete the company
    await Company.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Company "${company.companyName}" deleted permanently`
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete company'
    });
  }
};

// Get company statistics
export const getCompanyStats = async (req, res) => {
  try {
    const totalCompanies = await Company.countDocuments({ status: 'Active' });
    const dairyCompanies = await Company.countDocuments({
      status: 'Active',
      businessTypes: 'Dairy Cooperative Society'
    });
    const privateFirms = await Company.countDocuments({
      status: 'Active',
      businessTypes: 'Private Firm'
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalCompanies,
        dairyCooperatives: dairyCompanies,
        privateFirms: privateFirms
      }
    });
  } catch (error) {
    console.error('Error fetching company stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch company statistics'
    });
  }
};
