import { Router } from 'express';
import { createSale, getSales, getSaleById, voidSale, processReturn } from '../controllers/sale.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', createSale);
router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/:id/void', requireRole('ADMIN', 'MANAGER'), voidSale);
router.post('/:id/return', requireRole('ADMIN', 'MANAGER', 'CASHIER'), processReturn);

export default router;
