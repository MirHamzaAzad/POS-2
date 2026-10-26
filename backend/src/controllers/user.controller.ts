import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  fullName: z.string().min(1),
  phone: z.string(),
  email: z.string().email().optional(),
  branchId: z.string().uuid().optional(),
  roles: z.array(z.string()),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(6).optional(),
});

export const getUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        branch: { select: { id: true, name: true } },
        roles: { include: { role: true } },
      },
      orderBy: { full_name: 'asc' },
    });
    res.json(users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      email: u.email,
      phone: u.phone,
      isActive: u.is_active,
      lastLoginAt: u.last_login_at,
      branch: u.branch,
      roles: u.roles.map((r) => r.role.name),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);

    const roleRecords = await prisma.role.findMany({
      where: { name: { in: data.roles } },
    });

    const user = await prisma.user.create({
      data: {
        username: data.username,
        password_hash: passwordHash,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email,
        branch_id: data.branchId,
        roles: {
          create: roleRecords.map((r) => ({ role_id: r.id })),
        },
      },
      include: { roles: { include: { role: true } } },
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      roles: user.roles.map((r) => r.role.name),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (data.fullName) updateData.full_name = data.fullName;
    if (data.phone) updateData.phone = data.phone;
    if (data.email) updateData.email = data.email;
    if (data.branchId) updateData.branch_id = data.branchId;
    if (data.password) updateData.password_hash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    res.json({ id: user.id, username: user.username, fullName: user.full_name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const updated = await prisma.user.update({
      where: { id },
      data: { is_active: !user.is_active },
    });
    res.json({ id: updated.id, isActive: updated.is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
