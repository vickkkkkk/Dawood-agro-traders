import { PrismaClient } from '@prisma/client';
import { getBalances } from './cashController.js';

const prisma = new PrismaClient();

// GET /api/liabilities
export const getLiabilities = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      supplierId,
      grnNo,
      startDate,
      endDate,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (supplierId) {
      where.supplierId = Number(supplierId);
    }

    if (grnNo) {
      where.grnNo = { contains: grnNo };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      const searchLower = search.toLowerCase();
      where.OR = [
        { grnNo: { contains: search } },
        { supplier: { name: { contains: search } } },
        { supplier: { company: { contains: search } } },
      ];
      
      // If it's a numeric search, match ID
      const numericSearch = parseInt(search, 10);
      if (!isNaN(numericSearch)) {
        where.OR.push({ id: numericSearch });
      }
    }

    const [liabilities, total] = await Promise.all([
      prisma.liability.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, company: true } },
          purchase: {
            select: {
              id: true,
              grnNo: true,
              purchaseDate: true,
              purchaseOrderRef: true,
              grandTotal: true,
              items: {
                include: {
                  product: { select: { name: true, sku: true, unit: true } }
                }
              }
            }
          },
          _count: { select: { payments: true } }
        }
      }),
      prisma.liability.count({ where })
    ]);

    res.json({
      success: true,
      data: liabilities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/liabilities/:id
export const getLiabilityById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const liability = await prisma.liability.findUnique({
      where: { id: Number(id) },
      include: {
        supplier: true,
        purchase: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true, unit: true } }
              }
            }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!liability) {
      return res.status(404).json({
        success: false,
        message: 'Liability record not found.'
      });
    }

    res.json({
      success: true,
      data: liability
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/liabilities/:id/payments
export const createLiabilityPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, description, date } = req.body;

    const payAmt = Number(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be a positive number.'
      });
    }

    const pm = paymentMethod?.toUpperCase();
    if (!['CASH', 'BANK'].includes(pm)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Must be CASH or BANK.'
      });
    }

    const liability = await prisma.liability.findUnique({
      where: { id: Number(id) }
    });

    if (!liability) {
      return res.status(404).json({
        success: false,
        message: 'Liability record not found.'
      });
    }

    if (liability.remainingBalance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This liability is already fully paid.'
      });
    }

    if (payAmt > liability.remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (PKR ${payAmt.toFixed(2)}) exceeds remaining balance (PKR ${liability.remainingBalance.toFixed(2)}).`
      });
    }

    // Check overdraft limits
    const { cashInHand, bankBalance } = await getBalances();
    if (pm === 'CASH' && payAmt > cashInHand) {
      return res.status(400).json({
        success: false,
        message: `Insufficient cash in hand. Available: PKR ${cashInHand.toFixed(2)}, requested: PKR ${payAmt.toFixed(2)}.`
      });
    } else if (pm === 'BANK' && payAmt > bankBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient bank balance. Available: PKR ${bankBalance.toFixed(2)}, requested: PKR ${payAmt.toFixed(2)}.`
      });
    }

    const txDate = date ? new Date(date) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update liability balances
      const newPaid = Number(liability.paidAmount) + payAmt;
      const newRemaining = Math.max(0, Number(liability.remainingBalance) - payAmt);
      const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';

      const updatedLiability = await tx.liability.update({
        where: { id: liability.id },
        data: {
          paidAmount: newPaid,
          remainingBalance: newRemaining,
          status: newStatus
        }
      });

      // 2. Create LiabilityPayment history record
      const paymentLog = await tx.liabilityPayment.create({
        data: {
          liabilityId: liability.id,
          amount: payAmt,
          paymentMethod: pm,
          paymentDate: txDate,
          description: description || null
        }
      });

      // 3. Create CashTransaction outflow to trigger Cash Management Sync
      await tx.cashTransaction.create({
        data: {
          type: 'LIABILITY',
          amount: payAmt,
          date: txDate,
          paymentMethod: pm,
          description: description || `Partial Payment for Liability GRN #${liability.grnNo} (ID: ${liability.id})`
        }
      });

      return { updatedLiability, paymentLog };
    });

    res.status(201).json({
      success: true,
      message: 'Liability payment recorded successfully.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
