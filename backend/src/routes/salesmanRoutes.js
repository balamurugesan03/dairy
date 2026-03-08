import express from 'express';
import {
  createSalesman,
  getAllSalesman,
  searchSalesman,
  getSalesmanById,
  updateSalesman,
  deleteSalesman
} from '../controllers/salesmanController.js';

const router = express.Router();

router.post('/', createSalesman);
router.get('/', getAllSalesman);
router.get('/search', searchSalesman);   // MUST be before /:id
router.get('/:id', getSalesmanById);
router.put('/:id', updateSalesman);
router.delete('/:id', deleteSalesman);

export default router;
