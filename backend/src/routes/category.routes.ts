import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middlewares/auth.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import { Response } from 'express';
import { z } from 'zod';

const router = Router();

// Categories
router.get('/', authenticate, async (_req, res: Response) => {
  const cats = await prisma.category.findMany({ where: { is_active: true }, include: { children: true }, orderBy: { name: 'asc' } });
  res.json(cats);
});

router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, parentId } = z.object({ name: z.string(), parentId: z.string().uuid().optional() }).parse(req.body);
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const cat = await prisma.category.create({ data: { name, slug, parent_id: parentId } });
    res.status(201).json(cat);
  } catch (err) { res.status(400).json({ error: String(err) }); }
});

export default router;
