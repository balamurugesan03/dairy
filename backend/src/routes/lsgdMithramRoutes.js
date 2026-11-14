import express from 'express';
import {
  getWards, getWardMembers, saveWardMember, getStatement, emailStatement,
  listSaved, getSaved, createSaved, updateSaved, deleteSaved
} from '../controllers/lsgdMithramController.js';

// LSGD Reports → LSGD Milk Statement (route keeps its original "mithram" path)
const router = express.Router();

router.get('/wards', getWards);
router.get('/ward-members', getWardMembers);
router.post('/ward-members', saveWardMember);
router.get('/statement', getStatement);
router.post('/email', emailStatement);

// Saved statements
router.get('/saved', listSaved);
router.get('/saved/:id', getSaved);
router.post('/saved', createSaved);
router.put('/saved/:id', updateSaved);
router.delete('/saved/:id', deleteSaved);

export default router;
