import express from 'express';
import {
  getAll,
  getById,
  create,
  update,
  remove,
  lookupProducer,
} from '../controllers/individualDeductionEarningController.js';

const router = express.Router();

router.get('/',                    getAll);
router.get('/lookup/:code',        lookupProducer);
router.get('/:id',                 getById);
router.post('/',                   create);
router.put('/:id',                 update);
router.delete('/:id',              remove);

export default router;
