import { Router } from 'express';
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from '../controllers/subscriptionController';

const router = Router();

router.get('/', getSubscriptions);
router.post('/', createSubscription);
router.put('/:id', updateSubscription);
router.delete('/:id', deleteSubscription);

export default router;
