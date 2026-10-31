import express from 'express';
import { getPanchayats, getFormFarmers, getFarmerDocuments } from '../controllers/farmerFormController.js';

// Lookups for the farmer report forms (Crop Damage Statement, Monthly Agri Statistics)
const router = express.Router();

router.get('/panchayats', getPanchayats);
router.get('/farmers', getFormFarmers);
router.get('/documents/:farmerId', getFarmerDocuments);

export default router;
