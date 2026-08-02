import { Router } from 'express';
import {
  getInstallments,
  createInstallment,
  deleteInstallment,
  updateInstallmentPaymentDate,
  getInstallmentTransactions,
} from '../controllers/installmentController';

const router = Router();

router.get('/', getInstallments);
router.get('/:id/transactions', getInstallmentTransactions);
router.post('/', createInstallment);
router.delete('/:id', deleteInstallment);
router.patch('/:id/payment-date', updateInstallmentPaymentDate);

export default router;
