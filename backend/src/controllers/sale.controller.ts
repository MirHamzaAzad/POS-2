import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().positive(),
  unitPrice: z.number().positive(),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
});

const createSaleSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  clientTransactionId: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
  discountTotal: z.number().min(0).default(0),
  taxTotal: z.number().min(0).default(0),
  amountPaid: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CARD', 'WALLET', 'BANK_TRANSFER', 'MIXED']),
  paymentReference: z.string().optional(),
  channel: z.enum(['POS', 'MANUAL', 'OFFLINE_SYNCED']).default('POS'),
});

const generateInvoiceNumber = async (branchId: string): Promise<string> => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `GS-${dateStr}-`;
  const count = await prisma.sale.count({
    where: {
      branch_id: branchId,
      invoice_number: { startsWith: prefix },
    },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

export const createSale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createSaleSchema.parse(req.body);

    // Check for duplicate offline transaction
    if (data.clientTransactionId) {
      const existing = await prisma.sale.findUnique({
        where: { client_transaction_id: data.clientTransactionId },
      });
      if (existing) {
        res.status(200).json({ ...existing, duplicate: true });
        return;
      }
    }

    const subtotal = data.items.reduce(
      (sum, item) => sum + item.qty * item.unitPrice - item.discountAmount, 0
    );
    const grandTotal = subtotal + data.taxTotal - data.discountTotal;
    const changeReturned = Math.max(0, data.amountPaid - grandTotal);

    // Fetch product snapshots
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { inventory_bals: { where: { branch_id: data.branchId } } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    const invoiceNumber = await generateInvoiceNumber(data.branchId);

    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          branch_id: data.branchId,
          invoice_number: invoiceNumber,
          cashier_id: req.user!.id,
          customer_id: data.customerId,
          sale_status: 'COMPLETED',
          subtotal,
          discount_total: data.discountTotal,
          tax_total: data.taxTotal,
          grand_total: grandTotal,
          amount_paid: data.amountPaid,
          change_returned: changeReturned,
          sale_channel: data.channel,
          client_transaction_id: data.clientTransactionId,
          items: {
            create: data.items.map((item) => {
              const product = productMap.get(item.productId)!;
              return {
                product_id: item.productId,
                product_name_snapshot: product.name_en,
                barcode_snapshot: product.barcode,
                qty: item.qty,
                unit_price: item.unitPrice,
                discount_amount: item.discountAmount,
                tax_amount: item.taxAmount,
                line_total: item.qty * item.unitPrice - item.discountAmount + item.taxAmount,
              };
            }),
          },
          payments: {
            create: {
              payment_method: data.paymentMethod,
              amount: data.amountPaid,
              reference_number: data.paymentReference,
              payment_status: 'CAPTURED',
              paid_at: new Date(),
            },
          },
        },
        include: { items: true, payments: true },
      });

      // Decrement inventory
      for (const item of data.items) {
        await tx.inventoryBalance.updateMany({
          where: { branch_id: data.branchId, product_id: item.productId },
          data: {
            on_hand_qty: { decrement: item.qty },
            available_qty: { decrement: item.qty },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            branch_id: data.branchId,
            product_id: item.productId,
            movement_type: 'SALE',
            reference_type: 'SALE',
            reference_id: newSale.id,
            qty_in: 0,
            qty_out: item.qty,
            unit_cost: item.unitPrice,
            created_by: req.user!.id,
          },
        });
      }

      return newSale;
    });

    res.status(201).json(sale);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId, startDate, endDate, cashierId } = req.query;
    const branch = branchId as string || req.user?.branchId;

    const where: Record<string, unknown> = {};
    if (branch) where.branch_id = branch;
    if (cashierId) where.cashier_id = cashierId;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) (where.created_at as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.created_at as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: { select: { name_en: true, sku: true } } } },
        payments: true,
        cashier: { select: { full_name: true } },
        customer: { select: { full_name: true, phone: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    res.json(sales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSaleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: true,
        cashier: { select: { full_name: true } },
        customer: true,
        branch: { select: { name: true } },
      },
    });

    if (!sale) { res.status(404).json({ error: 'Sale not found' }); return; }
    res.json(sale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const voidSale = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) { res.status(404).json({ error: 'Sale not found' }); return; }
    if (sale.sale_status !== 'COMPLETED') {
      res.status(400).json({ error: 'Only completed sales can be voided' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id }, data: { sale_status: 'VOIDED' } });

      // Restore inventory
      for (const item of sale.items) {
        await tx.inventoryBalance.updateMany({
          where: { branch_id: sale.branch_id, product_id: item.product_id },
          data: {
            on_hand_qty: { increment: item.qty },
            available_qty: { increment: item.qty },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            branch_id: sale.branch_id,
            product_id: item.product_id,
            movement_type: 'RETURN',
            reference_type: 'VOID',
            reference_id: id,
            qty_in: item.qty,
            qty_out: 0,
            unit_cost: item.unit_price,
            notes: reason || 'Sale voided',
            created_by: req.user!.id,
          },
        });
      }
    });

    res.json({ message: 'Sale voided successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const processReturn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { items, reason } = req.body;

    const originalSale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!originalSale) { res.status(404).json({ error: 'Sale not found' }); return; }

    const refundTotal = items.reduce((sum: number, item: { qty: number; unitRefundPrice: number }) =>
      sum + item.qty * item.unitRefundPrice, 0);

    const today = new Date();
    const refundNumber = `RFN-${today.toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now()}`;

    const refund = await prisma.$transaction(async (tx) => {
      const newRefund = await tx.refund.create({
        data: {
          original_sale_id: id,
          branch_id: originalSale.branch_id,
          refund_number: refundNumber,
          processed_by: req.user!.id,
          refund_reason: reason,
          refund_total: refundTotal,
          items: {
            create: items.map((item: { productId: string; qty: number; unitRefundPrice: number }) => ({
              product_id: item.productId,
              qty: item.qty,
              unit_refund_price: item.unitRefundPrice,
              line_refund_total: item.qty * item.unitRefundPrice,
            })),
          },
        },
      });

      // Restore inventory
      for (const item of items) {
        await tx.inventoryBalance.updateMany({
          where: { branch_id: originalSale.branch_id, product_id: item.productId },
          data: {
            on_hand_qty: { increment: item.qty },
            available_qty: { increment: item.qty },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            branch_id: originalSale.branch_id,
            product_id: item.productId,
            movement_type: 'RETURN',
            reference_type: 'REFUND',
            reference_id: newRefund.id,
            qty_in: item.qty,
            qty_out: 0,
            unit_cost: item.unitRefundPrice,
            notes: reason,
            created_by: req.user!.id,
          },
        });
      }

      return newRefund;
    });

    res.status(201).json(refund);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
