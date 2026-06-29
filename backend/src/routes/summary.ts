import { Router } from 'express';
import {
  getMonthlySummary,
  getCategorySummary,
  getMonthlyEvolution,
  getAccountSummary,
} from '../controllers/summaryController';

const router = Router();

router.get('/monthly', getMonthlySummary);
router.get('/categories', getCategorySummary);
router.get('/evolution', getMonthlyEvolution);
router.get('/accounts', getAccountSummary);

export default router;
