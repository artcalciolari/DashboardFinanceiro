import { Router } from 'express';
import { settleTransaction, reimburseTransaction } from '../controllers/settlementController';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../controllers/transactionController';

const router = Router();

router.get('/', getTransactions);
router.post('/', createTransaction);
router.patch('/:id/settlement', settleTransaction);
router.patch('/:id/reimbursement', reimburseTransaction);
router.put('/:id', updateTransaction);
router.patch('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
