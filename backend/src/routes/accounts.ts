import { Router } from 'express';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../controllers/accountController';

const router = Router();

router.get('/', getAccounts);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

export default router;
