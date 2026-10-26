import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

const adjustmentSchema = z.object({
  branchId: z.string().uuid(),
  productId: z.string().uuid(),
  adjustmentType: z.enum(['INCREMENT', 'DECREMENT', 'SET']),
  qty: z.number(),
  reason: z.string().min(1),
  movementType: z.enum(['ADJUSTMENT', 'DAMAGE', 'EXPIRED', 'COUNT_CORRECTION']).default('ADJUSTMENT'),
});

const receiveGoodsSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  poId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    qty: z.number().positive(),
    unitCost: z.number().positive(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
  })),
});

export const getInventoryBalances = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId, lowStock } = req.query;
    const branch = branchId as string || req.user?.branchId;

    const balances = await prisma.inventoryBalance.findMany({
      where: branch ? { branch_id: branch } : {},
      include: {
        product: {
          include: { category: true, unit: true },
        },
      },
      orderBy: { product: { name_en: 'asc' } },
    });

    const result = lowStock === 'true'
      ? balances.filter((b) => b.on_hand_qty <= b.reorder_level)
      : balances;

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = adjustmentSchema.parse(req.body);

    const balance = await prisma.inventoryBalance.findUnique({
      where: { branch_id_product_id: { branch_id: data.branchId, product_id: data.productId } },
    });

    if (!balance) {
      res.status(404).json({ error: 'Inventory balance not found' });
      return;
    }

    let newQty = balance.on_hand_qty;
    let qtyIn = 0, qtyOut = 0;

    if (data.adjustmentType === 'INCREMENT') {
      newQty += data.qty;
      qtyIn = data.qty;
    } else if (data.adjustmentType === 'DECREMENT') {
      newQty -= data.qty;
      qtyOut = data.qty;
    } else {
      qtyIn = data.qty > balance.on_hand_qty ? data.qty - balance.on_hand_qty : 0;
      qtyOut = data.qty < balance.on_hand_qty ? balance.on_hand_qty - data.qty : 0;
      newQty = data.qty;
    }

    await prisma.$transaction([
      prisma.inventoryBalance.update({
        where: { branch_id_product_id: { branch_id: data.branchId, product_id: data.productId } },
        data: {
          on_hand_qty: newQty,
          available_qty: Math.max(0, newQty - balance.reserved_qty),
        },
      }),
      prisma.inventoryMovement.create({
        data: {
          branch_id: data.branchId,
          product_id: data.productId,
          movement_type: data.movementType,
          reference_type: 'MANUAL',
          reference_id: 'ADJUSTMENT',
          qty_in: qtyIn,
          qty_out: qtyOut,
          unit_cost: 0,
          notes: data.reason,
          created_by: req.user!.id,
        },
      }),
    ]);

    res.json({ message: 'Stock adjusted successfully', newQty });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const receiveGoods = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = receiveGoodsSchema.parse(req.body);
    const today = new Date();
    const grnNumber = `GRN-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now()}`;
    const totalCost = data.items.reduce((s, i) => s + i.qty * i.unitCost, 0);

    const grn = await prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          branch_id: data.branchId,
          supplier_id: data.supplierId,
          po_id: data.poId,
          grn_number: grnNumber,
          received_by: req.user!.id,
          received_at: new Date(),
          total_cost: totalCost,
          items: {
            create: data.items.map((item) => ({
              product_id: item.productId,
              batch_number: item.batchNumber,
              expiry_date: item.expiryDate ? new Date(item.expiryDate) : undefined,
              qty_received: item.qty,
              unit_cost: item.unitCost,
              line_total: item.qty * item.unitCost,
            })),
          },
        },
      });

      for (const item of data.items) {
        await tx.inventoryBalance.upsert({
          where: { branch_id_product_id: { branch_id: data.branchId, product_id: item.productId } },
          update: {
            on_hand_qty: { increment: item.qty },
            available_qty: { increment: item.qty },
          },
          create: {
            branch_id: data.branchId,
            product_id: item.productId,
            on_hand_qty: item.qty,
            reserved_qty: 0,
            available_qty: item.qty,
            reorder_level: 0,
            reorder_qty: 0,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            branch_id: data.branchId,
            product_id: item.productId,
            movement_type: 'PURCHASE_RECEIPT',
            reference_type: 'GRN',
            reference_id: receipt.id,
            qty_in: item.qty,
            qty_out: 0,
            unit_cost: item.unitCost,
            created_by: req.user!.id,
          },
        });
      }

      return receipt;
    });

    res.status(201).json(grn);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMovements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId, productId, movementType, startDate, endDate } = req.query;
    const branch = branchId as string || req.user?.branchId;

    const where: Record<string, unknown> = {};
    if (branch) where.branch_id = branch;
    if (productId) where.product_id = productId;
    if (movementType) where.movement_type = movementType;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) (where.created_at as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.created_at as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        product: { select: { name_en: true, sku: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    res.json(movements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
