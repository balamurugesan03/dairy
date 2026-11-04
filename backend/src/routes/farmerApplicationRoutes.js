import express from 'express';
import {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  getApplicationPrefill
} from '../controllers/farmerApplicationController.js';

const router = express.Router();

router.get('/prefill', getApplicationPrefill);
router.get('/',        getApplications);
router.get('/:id',     getApplicationById);
router.post('/',       createApplication);
router.put('/:id',     updateApplication);
router.delete('/:id',  deleteApplication);

export default router;
