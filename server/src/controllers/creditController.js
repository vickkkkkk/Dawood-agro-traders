import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/credits/summary
export const getCreditSummary = async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { creditBalance: { not: 0 } },
      orderBy: { creditBalance: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        creditBalance: true,
        updatedAt: true,
      },
    });

    const totalOutstanding = customers
      .filter((c) => c.creditBalance > 0)
      .reduce((sum, c) => sum + Number(c.creditBalance), 0);

    res.json({
      success: true,
      data: {
        customers,
        totalOutstanding,
        customerCount: customers.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/credits/customer/:customerId
export const getCustomerCredits = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const customer = await prisma.customer.findUnique({
      where: { id: Number(customerId) },
      select: { id: true, name: true, phone: true, creditBalance: true },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { customerId: Number(customerId) },
        skip,
        take: Number(limit),
        orderBy: { transactionDate: 'desc' },
        include: {
          bill: { select: { id: true, billNo: true } },
        },
      }),
      prisma.creditTransaction.count({
        where: { customerId: Number(customerId) },
      }),
    ]);

    res.json({
      success: true,
      data: {
        customer,
        transactions,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/credits/payment
export const recordPayment = async (req, res, next) => {
  try {
    const { customerId, amount, description } = req.body;

    if (!customerId || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and a positive amount are required.',
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: Number(customerId) },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const paymentAmount = Number(amount);

    const result = await prisma.$transaction(async (tx) => {
      // Reduce customer balance (could make it negative if payment exceeds debt)
      const updatedCustomer = await tx.customer.update({
        where: { id: Number(customerId) },
        data: {
          creditBalance: { decrement: paymentAmount },
        },
      });

      // Create credit transaction record
      const transaction = await tx.creditTransaction.create({
        data: {
          customerId: Number(customerId),
          type: 'PAYMENT',
          amount: paymentAmount,
          description: description || 'Credit payment received',
          transactionDate: new Date(),
        },
      });

      return { customer: updatedCustomer, transaction };
    });

    res.status(201).json({
      success: true,
      message: `Payment of PKR ${paymentAmount} recorded successfully.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/credits/overdue
export const getOverdue = async (req, res, next) => {
  try {
    // Get customers with credit > 0 and their oldest unpaid credit transaction
    const customers = await prisma.customer.findMany({
      where: { creditBalance: { gt: 0 } },
      include: {
        creditTransactions: {
          where: { type: 'CREDIT' },
          orderBy: { transactionDate: 'asc' },
          take: 1,
          select: {
            transactionDate: true,
            amount: true,
            description: true,
          },
        },
      },
      orderBy: { creditBalance: 'desc' },
    });

    const overdueCustomers = customers.map((c) => {
      const oldestCredit = c.creditTransactions[0];
      const daysSinceCredit = oldestCredit
        ? Math.floor(
            (new Date().getTime() - new Date(oldestCredit.transactionDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        creditBalance: c.creditBalance,
        oldestCreditDate: oldestCredit?.transactionDate || null,
        daysSinceOldestCredit: daysSinceCredit,
      };
    });

    // Sort by days overdue (longest first)
    overdueCustomers.sort((a, b) => b.daysSinceOldestCredit - a.daysSinceOldestCredit);

    res.json({
      success: true,
      data: overdueCustomers,
      count: overdueCustomers.length,
    });
  } catch (error) {
    next(error);
  }
};
