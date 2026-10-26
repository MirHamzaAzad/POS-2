import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthRequest extends Request<any, any, any, any> {
  user?: {
    id: string;
    username: string;
    roles: string[];
    permissions: string[];
    branchId?: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, is_active: true },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token or user not found' });
      return;
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.key)
    );

    req.user = {
      id: user.id,
      username: user.username,
      roles,
      permissions,
      branchId: user.branch_id ?? undefined,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hasRole = allowedRoles.some((role) => req.user!.roles.includes(role));
    if (!hasRole) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Required roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const hasPermission = permissions.some((perm) => req.user!.permissions.includes(perm));
    if (!hasPermission) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Required permissions: ${permissions.join(', ')}`,
      });
      return;
    }

    next();
  };
};
