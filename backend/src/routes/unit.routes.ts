import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middlewares/auth.middleware';
import { Response } from 'express';

const router = Router();

router.get('/', authenticate, async (_req, res: Response) => {
  const units = await prisma.unit.findMany({ orderBy: { name: 'asc' } });
  res.json(units);
});

export default router;
