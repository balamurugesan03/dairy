import express from 'express';
import {
  getWards, getWardMembers, saveWardMember, getStatement, emailStatement
} from '../controllers/lsgdMithramController.js';

// LSGD Reports → LSGD Mithram Statement
const router = express.Router();

router.get('/wards', getWards);
router.get('/ward-members', getWardMembers);
router.post('/ward-members', saveWardMember);
router.get('/statement', getStatement);
router.post('/email', emailStatement);

export default router;
