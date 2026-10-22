import express from 'express';
import {
  getManualEntries, createManualEntry, updateManualEntry, deleteManualEntry,
  getFormulas,       createFormula,      updateFormula,      deleteFormula,
  getLowCharts,      createLowChart,     updateLowChart,     deleteLowChart,
  getGoldLessCharts, createGoldLessChart,updateGoldLessChart,deleteGoldLessChart,
  getSlabRates,      createSlabRate,     updateSlabRate,     deleteSlabRate,
  getTsRates, getApplicableTsRate, createTsRate, updateTsRate, deleteTsRate
} from '../controllers/rateChartController.js';

const router = express.Router();

// ── Manual Entry ──────────────────────────────────────────────────
router.get('/manual-entries',         getManualEntries);
router.post('/manual-entries',        createManualEntry);
router.put('/manual-entries/:id',     updateManualEntry);
router.delete('/manual-entries/:id',  deleteManualEntry);

// ── Apply Formula ─────────────────────────────────────────────────
router.get('/formulas',               getFormulas);
router.post('/formulas',              createFormula);
router.put('/formulas/:id',           updateFormula);
router.delete('/formulas/:id',        deleteFormula);

// ── Low Chart ─────────────────────────────────────────────────────
router.get('/low-charts',             getLowCharts);
router.post('/low-charts',            createLowChart);
router.put('/low-charts/:id',         updateLowChart);
router.delete('/low-charts/:id',      deleteLowChart);

// ── Gold / Less / Existing Rate Chart ─────────────────────────────
router.get('/gold-less-charts',       getGoldLessCharts);
router.post('/gold-less-charts',      createGoldLessChart);
router.put('/gold-less-charts/:id',   updateGoldLessChart);
router.delete('/gold-less-charts/:id',deleteGoldLessChart);

// ── Slab Rate ─────────────────────────────────────────────────────
router.get('/slab-rates',             getSlabRates);
router.post('/slab-rates',            createSlabRate);
router.put('/slab-rates/:id',         updateSlabRate);
router.delete('/slab-rates/:id',      deleteSlabRate);

// ── TS (Total Solid) Rate Charge ──────────────────────────────────
router.get('/ts-rates',               getTsRates);
router.get('/ts-rates/applicable',    getApplicableTsRate);
router.post('/ts-rates',              createTsRate);
router.put('/ts-rates/:id',           updateTsRate);
router.delete('/ts-rates/:id',        deleteTsRate);

export default router;
