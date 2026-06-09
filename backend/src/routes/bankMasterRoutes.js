import express from 'express';
import { getAllBanks, createBank, updateBank, deleteBank } from '../controllers/bankMasterController.js';

const router = express.Router();

router.get('/',       getAllBanks);
router.post('/',      createBank);
router.put('/:id',    updateBank);
router.delete('/:id', deleteBank);

export default router;
