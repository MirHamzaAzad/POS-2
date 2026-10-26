import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { Response } from 'express';
import { z } from 'zod';

const router = Router();

router.get('/', authenticate, async (_req, res: Response) => {
  const brands = await prisma.brand.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
  res.json(brands);
});

router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res: Response) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const brand = await prisma.brand.create({ data: { name } });
    res.status(201).json(brand);
  } catch (err) { res.status(400).json({ error: String(err) }); }
});

export default router;
