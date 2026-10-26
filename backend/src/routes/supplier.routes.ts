import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { Response } from 'express';
import { z } from 'zod';

const router = Router();

const supplierSchema = z.object({ name: z.string().min(1), phone: z.string(), email: z.string().email().optional(), address: z.string().optional(), taxNumber: z.string().optional() });

router.get('/', authenticate, async (_req, res: Response) => {
  const suppliers = await prisma.supplier.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
  res.json(suppliers);
});

router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res: Response) => {
  try {
    const data = supplierSchema.parse(req.body);
    const sup = await prisma.supplier.create({ data: { name: data.name, phone: data.phone, email: data.email, address: data.address, tax_number: data.taxNumber } });
    res.status(201).json(sup);
  } catch (err) { res.status(400).json({ error: String(err) }); }
});

export default router;
