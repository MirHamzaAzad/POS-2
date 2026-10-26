import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Response } from 'express';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const poSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  expectedDate: z.string(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    orderedQty: z.number().positive(),
    unitCost: z.number().positive(),
  })),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const branch = req.user?.branchId;
  const orders = await prisma.purchaseOrder.findMany({
    where: branch ? { branch_id: branch } : {},
    include: { supplier: { select: { name: true } }, items: { include: { product: { select: { name_en: true } } } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(orders);
});

router.post('/', requireRole('ADMIN', 'MANAGER', 'INVENTORY'), async (req: AuthRequest, res: Response) => {
  try {
    const data = poSchema.parse(req.body);
    const total = data.items.reduce((s, i) => s + i.orderedQty * i.unitCost, 0);
    const poNumber = `PO-${Date.now()}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        branch_id: data.branchId,
        supplier_id: data.supplierId,
        po_number: poNumber,
        status: 'DRAFT',
        expected_date: new Date(data.expectedDate),
        total_amount: total,
        created_by: req.user!.id,
        items: {
          create: data.items.map((i) => ({
            product_id: i.productId,
            ordered_qty: i.orderedQty,
            received_qty: 0,
            unit_cost: i.unitCost,
            line_total: i.orderedQty * i.unitCost,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json(po);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

export default router;
