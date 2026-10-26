import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

const productSchema = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().min(1).optional(),
  unitId: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  nameEn: z.string().min(1),
  nameUr: z.string().optional(),
  description: z.string().optional(),
  storageType: z.enum(['DRY', 'CHILLED', 'FROZEN']),
  trackExpiry: z.boolean(),
  retailPrice: z.number().positive(),
  purchaseCost: z.number().positive(),
  branchId: z.string().min(1).optional(),
  reorderLevel: z.number().default(0),
  reorderQty: z.number().default(0),
});

export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, categoryId, storageType, lowStock, branchId } = req.query;
    const branch = branchId as string || req.user?.branchId;

    const where: Record<string, unknown> = { is_active: true };
    if (categoryId) where.category_id = categoryId;
    if (storageType) where.storage_type = storageType;
    if (search) {
      where.OR = [
        { name_en: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        unit: true,
        prices: {
          where: { is_active: true },
          orderBy: { effective_from: 'desc' },
          take: 1,
        },
        inventory_bals: branch ? { where: { branch_id: branch } } : undefined,
      },
      orderBy: { name_en: 'asc' },
    });

    let result = products;
    if (lowStock === 'true' && branch) {
      result = products.filter((p) => {
        const bal = p.inventory_bals[0];
        return bal && bal.on_hand_qty <= bal.reorder_level;
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProductByBarcode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.params;
    const branchId = req.user?.branchId;

    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { barcode: code },
          { barcodes: { some: { barcode_value: code } } },
          { sku: code },
        ],
        is_active: true,
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        prices: {
          where: { is_active: true },
          orderBy: { effective_from: 'desc' },
          take: 1,
        },
        inventory_bals: branchId ? { where: { branch_id: branchId } } : undefined,
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = productSchema.parse(req.body);
    const branch = data.branchId || req.user?.branchId;

    const product = await prisma.product.create({
      data: {
        category_id: data.categoryId,
        brand_id: data.brandId,
        unit_id: data.unitId,
        sku: data.sku,
        barcode: data.barcode,
        name_en: data.nameEn,
        name_ur: data.nameUr,
        description: data.description,
        storage_type: data.storageType,
        track_expiry: data.trackExpiry,
        prices: {
          create: {
            branch_id: branch,
            retail_price: data.retailPrice,
            purchase_cost: data.purchaseCost,
            margin_amount: data.retailPrice - data.purchaseCost,
            price_version: 1,
            effective_from: new Date(),
            is_active: true,
          },
        },
      },
      include: { category: true, unit: true, prices: true },
    });

    // Create inventory balance record if branch specified
    if (branch) {
      await prisma.inventoryBalance.create({
        data: {
          branch_id: branch,
          product_id: product.id,
          on_hand_qty: 0,
          reserved_qty: 0,
          available_qty: 0,
          reorder_level: data.reorderLevel,
          reorder_qty: data.reorderQty,
        },
      }).catch(() => {/* may already exist */});
    }

    res.status(201).json(product);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = productSchema.partial().parse(req.body);
    const branch = req.user?.branchId;

    const updateData: Record<string, unknown> = {};
    if (data.categoryId) updateData.category_id = data.categoryId;
    if (data.brandId) updateData.brand_id = data.brandId;
    if (data.unitId) updateData.unit_id = data.unitId;
    if (data.nameEn) updateData.name_en = data.nameEn;
    if (data.nameUr !== undefined) updateData.name_ur = data.nameUr;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.storageType) updateData.storage_type = data.storageType;
    if (data.trackExpiry !== undefined) updateData.track_expiry = data.trackExpiry;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Update price if changed
    if (data.retailPrice || data.purchaseCost) {
      const currentPrice = await prisma.productPrice.findFirst({
        where: { product_id: id, is_active: true },
        orderBy: { price_version: 'desc' },
      });

      await prisma.productPrice.updateMany({ where: { product_id: id, is_active: true }, data: { is_active: false } });
      await prisma.productPrice.create({
        data: {
          product_id: id,
          branch_id: branch,
          retail_price: data.retailPrice || currentPrice?.retail_price || 0,
          purchase_cost: data.purchaseCost || currentPrice?.purchase_cost || 0,
          margin_amount: (data.retailPrice || currentPrice?.retail_price || 0) - (data.purchaseCost || currentPrice?.purchase_cost || 0),
          price_version: (currentPrice?.price_version || 0) + 1,
          effective_from: new Date(),
          is_active: true,
        },
      });
    }

    res.json(product);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.product.update({ where: { id }, data: { is_active: false } });
    res.json({ message: 'Product deactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
