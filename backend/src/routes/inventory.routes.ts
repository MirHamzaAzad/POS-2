import { Router } from 'express';
import { getInventoryBalances, adjustStock, receiveGoods, getMovements } from '../controllers/inventory.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/balances', getInventoryBalances);
router.get('/movements', getMovements);
router.post('/adjust', requireRole('ADMIN', 'MANAGER', 'INVENTORY'), adjustStock);
router.post('/receive', requireRole('ADMIN', 'MANAGER', 'INVENTORY'), receiveGoods);

export default router;
