import express from 'express';
import {
  createCollection,
  getAllCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  getFarmerHistory,
  getFarmerStats,
  getFarmerWiseSummary,
} from '../controllers/milkCollectionController.js';

const router = express.Router();

// Summary / aggregate routes — BEFORE /:id
router.get('/summary/farmer-wise',         getFarmerWiseSummary);
router.get('/farmer/:farmerNumber/stats',  getFarmerStats);
router.get('/farmer/:farmerNumber',        getFarmerHistory);

// Main CRUD
router.post('/',      createCollection);
router.get('/',       getAllCollections);
router.get('/:id',    getCollectionById);
router.put('/:id',    updateCollection);
router.delete('/:id', deleteCollection);

export default router;
