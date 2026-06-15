import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/customers
export const getCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      success: true,
      data: customers,
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

// POST /api/customers
export const createCustomer = async (req, res, next) => {
  try {
    const { name, phone, address, initialBalance = 0 } = req.body;
    const balance = Number(initialBalance);

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name,
          phone,
          address: address || null,
          creditBalance: balance,
        },
      });

      if (balance !== 0) {
        await tx.creditTransaction.create({
          data: {
            customerId: created.id,
            type: balance > 0 ? 'CREDIT' : 'PAYMENT',
            amount: Math.abs(balance),
            description: balance > 0 ? 'Initial Outstanding Balance' : 'Initial Advance Payment',
            transactionDate: new Date(),
          },
        });
      }

      return created;
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully.',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/customers/:id
export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, address, creditBalance } = req.body;

    const existing = await prisma.customer.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    const customer = await prisma.$transaction(async (tx) => {
      if (creditBalance !== undefined) {
        const newBalance = Number(creditBalance);
        const oldBalance = Number(existing.creditBalance);
        const difference = newBalance - oldBalance;

        if (difference !== 0) {
          updateData.creditBalance = newBalance;

          await tx.creditTransaction.create({
            data: {
              customerId: Number(id),
              type: difference > 0 ? 'CREDIT' : 'PAYMENT',
              amount: Math.abs(difference),
              description: 'Balance adjustment / update',
              transactionDate: new Date(),
            },
          });
        }
      }

      return await tx.customer.update({
        where: { id: Number(id) },
        data: updateData,
      });
    });

    res.json({
      success: true,
      message: 'Customer updated successfully.',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/customers/:id
export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) },
      include: {
        bills: {
          where: { isVoid: false },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            billNo: true,
            total: true,
            paymentMethod: true,
            paymentStatus: true,
            creditAmount: true,
            billDate: true,
          },
        },
        creditTransactions: {
          orderBy: { transactionDate: 'desc' },
          take: 20,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/customers/:id/ledger
export const getCustomerLedger = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) },
      select: { id: true, name: true, phone: true, creditBalance: true },
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where: { customerId: Number(id) },
        skip,
        take: Number(limit),
        orderBy: { transactionDate: 'desc' },
        include: {
          bill: { select: { id: true, billNo: true } },
        },
      }),
      prisma.creditTransaction.count({ where: { customerId: Number(id) } }),
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
