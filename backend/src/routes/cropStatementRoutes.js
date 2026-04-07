import express from 'express';
import {
  getAllStatements,
  getStatementById,
  createStatement,
  updateStatement,
  deleteStatement
} from '../controllers/cropStatementController.js';

const router = express.Router();

router.get('/',       getAllStatements);
router.get('/:id',    getStatementById);
router.post('/',      createStatement);
router.put('/:id',    updateStatement);
router.delete('/:id', deleteStatement);

export default router;
