import Agent from '../models/Agent.js';
import CollectionCenter from '../models/CollectionCenter.js';

// Create new agent
export const createAgent = async (req, res) => {
  try {
    const { agentCode, agentName, collectionCenterId, phone, email, address, status } = req.body;

    // Validate collection center exists
    const center = await CollectionCenter.findById(collectionCenterId);
    if (!center) {
      return res.status(400).json({
        success: false,
        message: 'Collection center not found'
      });
    }

    const agent = new Agent({
      agentCode,
      agentName,
      collectionCenterId,
      phone,
      email,
      address,
      status,
      companyId: req.companyId
    });

    await agent.save();
    await agent.populate('collectionCenterId', 'centerName centerType');

    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      data: agent
    });
  } catch (error) {
    console.error('Error creating agent:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Agent with this code already exists'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Error creating agent'
    });
  }
};

// Get all agents with pagination and filters
export const getAllAgents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      collectionCenterId = '',
      all = ''
    } = req.query;

    const query = { companyId: req.companyId };

    if (search) {
      query.$or = [
        { agentCode: { $regex: search, $options: 'i' } },
        { agentName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (collectionCenterId) query.collectionCenterId = collectionCenterId;

    // If 'all' param passed, return all active agents (for dropdown use in MilkPurchase)
    if (all === 'true') {
      const agents = await Agent.find({ ...query, status: 'Active' })
        .populate('collectionCenterId', 'centerName centerType')
        .sort({ agentName: 1 });

      return res.status(200).json({
        success: true,
        data: agents
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const agents = await Agent.find(query)
      .populate('collectionCenterId', 'centerName centerType')
      .sort({ agentName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Agent.countDocuments(query);

    res.status(200).json({
      success: true,
      data: agents,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching agents'
    });
  }
};

// Get agent by ID
export const getAgentById = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('collectionCenterId', 'centerName centerType');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching agent'
    });
  }
};

// Update agent
export const updateAgent = async (req, res) => {
  try {
    const { collectionCenterId } = req.body;

    if (collectionCenterId) {
      const center = await CollectionCenter.findById(collectionCenterId);
      if (!center) {
        return res.status(400).json({
          success: false,
          message: 'Collection center not found'
        });
      }
    }

    const agent = await Agent.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    ).populate('collectionCenterId', 'centerName centerType');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Agent updated successfully',
      data: agent
    });
  } catch (error) {
    console.error('Error updating agent:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Agent with this code already exists'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Error updating agent'
    });
  }
};

// Toggle status (Active/Inactive)
export const toggleAgentStatus = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    agent.status = agent.status === 'Active' ? 'Inactive' : 'Active';
    await agent.save();

    res.status(200).json({
      success: true,
      message: `Agent ${agent.status === 'Active' ? 'activated' : 'deactivated'} successfully`,
      data: agent
    });
  } catch (error) {
    console.error('Error toggling agent status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error toggling status'
    });
  }
};

// Delete agent (soft delete)
export const deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    agent.status = 'Inactive';
    await agent.save();

    res.status(200).json({
      success: true,
      message: 'Agent deactivated successfully',
      data: agent
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting agent'
    });
  }
};
