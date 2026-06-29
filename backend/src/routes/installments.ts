import { Router } from 'express';
import {
  getInstallments,
  createInstallment,
  deleteInstallment,
  updateInstallmentPaymentDate,
} from '../controllers/installmentController';

const router = Router();

router.get('/', getInstallments);
router.post('/', createInstallment);
router.delete('/:id', deleteInstallment);
router.patch('/:id/payment-date', updateInstallmentPaymentDate);

export default router;
