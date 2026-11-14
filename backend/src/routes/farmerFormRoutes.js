import express from 'express';
import {
  getPanchayats, getFormFarmers, getFarmerDocuments, getPanchayatWards, updateFarmerDetails,
  getFarmerDocumentSummary, uploadFarmerDocument, deleteFarmerDocument
} from '../controllers/farmerFormController.js';

// Lookups for the farmer report forms (Crop Damage Statement, Monthly Agri Statistics, LSGD reports)
// and the save-back of farmer details / documents typed or uploaded on those reports.
const router = express.Router();

router.get('/panchayats', getPanchayats);
router.get('/farmers', getFormFarmers);
router.put('/farmers/:farmerId/details', updateFarmerDetails);
router.get('/wards', getPanchayatWards);
router.get('/documents/:farmerId/summary', getFarmerDocumentSummary);
router.get('/documents/:farmerId', getFarmerDocuments);
router.post('/documents/:farmerId', uploadFarmerDocument);
router.delete('/documents/:farmerId/:type', deleteFarmerDocument);

export default router;
