import { Router } from 'express';
import { exportCSV } from '../controllers/exportController';

const router = Router();

router.get('/csv', exportCSV);

export default router;
