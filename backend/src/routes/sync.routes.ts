import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middlewares/auth.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Response } from 'express';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// Push offline transactions
router.post('/push', async (req: AuthRequest, res: Response) => {
  try {
    const { transactions } = z.object({
      transactions: z.array(z.any()),
    }).parse(req.body);

    const results = [];
    for (const tx of transactions) {
      results.push({ clientId: tx.clientTransactionId, status: 'QUEUED' });
    }
    res.json({ received: results.length, results });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// Pull latest product/price updates for offline cache
router.get('/pull', async (req: AuthRequest, res: Response) => {
  try {
    const since = req.query.since ? new Date(req.query.since as string) : new Date(0);
    const branch = req.user?.branchId;

    const [products, prices] = await Promise.all([
      prisma.product.findMany({
        where: { is_active: true, updated_at: { gte: since } },
        include: {
          prices: { where: { is_active: true }, take: 1, orderBy: { effective_from: 'desc' } },
          category: true,
          unit: true,
        },
      }),
      prisma.productPrice.findMany({
        where: { is_active: true, branch_id: branch },
        orderBy: { effective_from: 'desc' },
      }),
    ]);

    res.json({ products, prices, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
