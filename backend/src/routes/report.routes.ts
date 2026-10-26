import { Router } from 'express';
import { getDailyReport, getCashierReport, getStockReport } from '../controllers/report.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'));

router.get('/daily', getDailyReport);
router.get('/cashier', getCashierReport);
router.get('/stock', getStockReport);

export default router;
