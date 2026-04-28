import Agent from '../models/Agent.js';
import Ledger from '../models/Ledger.js';
import CollectionCenter from '../models/CollectionCenter.js';
import { generateCode } from '../models/Counter.js';

// Auto-create ledger for a newly saved agent
const createAgentLedger = async (agent, companyId) => {
  const existing = await Ledger.findOne({
    'linkedEntity.entityType': 'Agent',
    'linkedEntity.entityId':   agent._id,
    companyId
  });
  if (existing) return existing;

  const ledger = new Ledger({
    ledgerName:           `${agent.agentName} (${agent.agentCode})`,
    ledgerType:           'Advance due to Society',
    linkedEntity:         { entityType: 'Agent', entityId: agent._id },
    openingBalance:       0,
    openingBalanceType:   'Dr',
    currentBalance:       0,
    balanceType:          'Dr',
    parentGroup:          'Advance due to Society',
    status:               'Active',
    companyId
  });
  await ledger.save();

  agent.ledgerId = ledger._id;
  await agent.save();

  return ledger;
};

// Auto-generate agent code: AGT-0001, AGT-0002, ...
const generateAgentCode = async (companyId) =>
  generateCode('AGT', companyId, { monthly: false });

// Create new agent
export const createAgent = async (req, res) => {
  try {
    const { agentName, collectionCenterId, phone, email, address, status, dateOfJoining } = req.body;

    // Validate collection center exists
    const center = await CollectionCenter.findById(collectionCenterId);
    if (!center) {
      return res.status(400).json({
        success: false,
        message: 'Collection center not found'
      });
    }

    // Auto-generate agent code
    const agentCode = await generateAgentCode(req.companyId);

    const agent = new Agent({
      agentCode,
      agentName,
      collectionCenterId,
      phone,
      email,
      address,
      status,
      dateOfJoining: dateOfJoining || new Date(),
      companyId: req.companyId
    });

    await agent.save();

    // Auto-create ledger entry in accounts
    try {
      await createAgentLedger(agent, req.companyId);
    } catch (ledgerErr) {
      console.error('Agent ledger creation error (non-fatal):', ledgerErr.message);
    }

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

// Bulk import agents from OpenLyssa collection_agent table
export const bulkImportAgents = async (req, res) => {
  try {
    const { agents } = req.body;

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ success: false, message: 'Agents array is required' });
    }

    const results = { total: agents.length, created: 0, updated: 0, errors: [] };

    for (let i = 0; i < agents.length; i++) {
      const row = agents[i];
      const rowNumber = i + 2;

      try {
        if (!row.agentCode || !row.agentName) {
          results.errors.push({ row: rowNumber, agentCode: row.agentCode || 'N/A', message: 'agentCode and agentName are required' });
          continue;
        }

        // Resolve collectionCenterId
        let collectionCenterId = row.collectionCenterId || null;
        if (!collectionCenterId) {
          // Fall back: first active center for this company
          const center = await CollectionCenter.findOne({ companyId: req.companyId, status: 'Active' });
          collectionCenterId = center?._id || null;
        }

        if (!collectionCenterId) {
          results.errors.push({ row: rowNumber, agentCode: row.agentCode, message: 'No collection center found for this company' });
          continue;
        }

        const data = {
          agentCode:          row.agentCode,
          agentName:          row.agentName,
          collectionCenterId: collectionCenterId,
          status:             row.status || 'Active',
          dateOfJoining:      row.dateOfJoining ? new Date(row.dateOfJoining) : undefined,
          companyId:          req.companyId,
        };

        const existing = await Agent.findOne({ agentCode: row.agentCode, companyId: req.companyId });

        if (existing) {
          await Agent.findByIdAndUpdate(existing._id, { $set: data });
          results.updated++;
          // Ensure ledger exists for previously imported agents too
          try { await createAgentLedger(existing, req.companyId); } catch (_) {}
        } else {
          const newAgent = await Agent.create(data);
          results.created++;
          // Auto-post to ledger / accounts
          try { await createAgentLedger(newAgent, req.companyId); } catch (_) {}
        }
      } catch (err) {
        results.errors.push({ row: rowNumber, agentCode: row.agentCode || 'N/A', message: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Import done: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
      data: results
    });
  } catch (error) {
    console.error('Bulk import agents error:', error);
    res.status(500).json({ success: false, message: error.message || 'Bulk import failed' });
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
