import { Router } from 'express';
import {
  getAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  checkAlerts,
} from '../controllers/alertController';

const router = Router();

router.get('/', getAlerts);
router.get('/check', checkAlerts);
router.post('/', createAlert);
router.put('/:id', updateAlert);
router.delete('/:id', deleteAlert);

export default router;
