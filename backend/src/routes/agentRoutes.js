import express from 'express';
import {
  createAgent,
  getAllAgents,
  getAgentById,
  updateAgent,
  toggleAgentStatus,
  deleteAgent
} from '../controllers/agentController.js';

const router = express.Router();

// Create new agent
router.post('/', createAgent);

// Get all agents (supports ?all=true for dropdown, and pagination/filters)
router.get('/', getAllAgents);

// Get agent by ID
router.get('/:id', getAgentById);

// Update agent
router.put('/:id', updateAgent);

// Toggle status (Active/Inactive)
router.patch('/:id/status', toggleAgentStatus);

// Delete/Deactivate agent
router.delete('/:id', deleteAgent);

export default router;
