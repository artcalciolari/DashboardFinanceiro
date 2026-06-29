import { Router } from 'express';
import accountRoutes from './accounts';
import categoryRoutes from './categories';
import transactionRoutes from './transactions';
import installmentRoutes from './installments';
import subscriptionRoutes from './subscriptions';
import summaryRoutes from './summary';
import alertRoutes from './alerts';
import exportRoutes from './export';

export const router = Router();

router.use('/accounts', accountRoutes);
router.use('/categories', categoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/installments', installmentRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/summary', summaryRoutes);
router.use('/alerts', alertRoutes);
router.use('/export', exportRoutes);
