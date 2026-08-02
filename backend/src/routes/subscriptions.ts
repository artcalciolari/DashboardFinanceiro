import { Router } from 'express';
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionTransactions,
} from '../controllers/subscriptionController';

const router = Router();

router.get('/', getSubscriptions);
router.get('/:id/transactions', getSubscriptionTransactions);
router.post('/', createSubscription);
router.patch('/:id', updateSubscription);
router.put('/:id', updateSubscription);
router.delete('/:id', deleteSubscription);

export default router;
