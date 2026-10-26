import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getDailyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, branchId } = req.query;
    const branch = branchId as string || req.user?.branchId;
    const targetDate = date ? new Date(date as string) : new Date();
    const start = new Date(targetDate); start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate); end.setHours(23, 59, 59, 999);

    const [sales, refunds] = await Promise.all([
      prisma.sale.findMany({
        where: {
          branch_id: branch,
          created_at: { gte: start, lte: end },
          sale_status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
        },
        include: { items: true, payments: true },
      }),
      prisma.refund.findMany({
        where: {
          branch_id: branch,
          created_at: { gte: start, lte: end },
        },
      }),
    ]);

    const totalSales = sales.reduce((s, sale) => s + sale.grand_total, 0);
    const totalCash = sales.reduce((s, sale) =>
      s + sale.payments.filter((p) => p.payment_method === 'CASH').reduce((ps, p) => ps + p.amount, 0), 0);
    const totalCard = sales.reduce((s, sale) =>
      s + sale.payments.filter((p) => p.payment_method === 'CARD').reduce((ps, p) => ps + p.amount, 0), 0);
    const totalDiscount = sales.reduce((s, sale) => s + sale.discount_total, 0);
    const totalRefunds = refunds.reduce((s, r) => s + r.refund_total, 0);
    const netSales = totalSales - totalRefunds;

    // Top products
    const itemAgg: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!itemAgg[item.product_id]) {
          itemAgg[item.product_id] = { name: item.product_name_snapshot, qty: 0, revenue: 0 };
        }
        itemAgg[item.product_id].qty += item.qty;
        itemAgg[item.product_id].revenue += item.line_total;
      }
    }

    const topProducts = Object.entries(itemAgg)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([productId, data]) => ({ productId, ...data }));

    res.json({
      date: targetDate.toISOString().slice(0, 10),
      totalTransactions: sales.length,
      totalSales,
      totalCash,
      totalCard,
      totalDiscount,
      totalRefunds,
      netSales,
      topProducts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCashierReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, branchId } = req.query;
    const branch = branchId as string || req.user?.branchId;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const end = endDate ? new Date(endDate as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const sales = await prisma.sale.findMany({
      where: {
        branch_id: branch,
        created_at: { gte: start, lte: end },
        sale_status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      include: { cashier: { select: { full_name: true } } },
    });

    const cashierAgg: Record<string, { name: string; transactions: number; total: number }> = {};
    for (const sale of sales) {
      if (!cashierAgg[sale.cashier_id]) {
        cashierAgg[sale.cashier_id] = { name: sale.cashier.full_name, transactions: 0, total: 0 };
      }
      cashierAgg[sale.cashier_id].transactions++;
      cashierAgg[sale.cashier_id].total += sale.grand_total;
    }

    res.json(Object.entries(cashierAgg).map(([cashierId, data]) => ({ cashierId, ...data })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStockReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { branchId } = req.query;
    const branch = branchId as string || req.user?.branchId;

    const balances = await prisma.inventoryBalance.findMany({
      where: branch ? { branch_id: branch } : {},
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            unit: { select: { code: true } },
            prices: { where: { is_active: true }, take: 1, orderBy: { effective_from: 'desc' } },
          },
        },
      },
    });

    const report = balances.map((b) => {
      const price = b.product.prices[0];
      return {
        productId: b.product_id,
        sku: b.product.sku,
        name: b.product.name_en,
        category: b.product.category.name,
        unit: b.product.unit.code,
        onHandQty: b.on_hand_qty,
        reorderLevel: b.reorder_level,
        isLowStock: b.on_hand_qty <= b.reorder_level,
        retailPrice: price?.retail_price || 0,
        stockValue: b.on_hand_qty * (price?.purchase_cost || 0),
      };
    });

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
