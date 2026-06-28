import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate bill number: DAT-YYYYMMDD-XXXX
 */
async function generateBillNo() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `DAT-${dateStr}-`;

  const lastBill = await prisma.bill.findFirst({
    where: { billNo: { startsWith: prefix } },
    orderBy: { billNo: 'desc' },
  });

  let sequence = 1;
  if (lastBill) {
    const lastSeq = parseInt(lastBill.billNo.split('-').pop(), 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

// POST /api/billing/bills
export const createBill = async (req, res, next) => {
  try {
    const {
      customerId,
      items,
      discount = 0,
      paymentMethod,
      amountPaid = 0,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required.',
      });
    }

    // If payment method is CREDIT, customer is required
    if (paymentMethod === 'CREDIT' && !customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer is required for credit payments.',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Validate and prepare items
      let subtotal = 0;
      const billItems = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw Object.assign(new Error(`Product with ID ${item.productId} not found.`), { statusCode: 404 });
        }

        if (!product.isActive) {
          throw Object.assign(new Error(`Product "${product.name}" is inactive.`), { statusCode: 400 });
        }

        if (Number(product.stockQty) < Number(item.quantity)) {
          throw Object.assign(
            new Error(`Insufficient stock for "${product.name}". Available: ${product.stockQty}, Requested: ${item.quantity}`),
            { statusCode: 400 }
          );
        }

        const unitPrice = item.unitPrice || Number(product.salePrice);
        const itemTotal = unitPrice * Number(item.quantity);
        subtotal += itemTotal;

        billItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPrice,
          total: itemTotal,
          purchasePrice: Number(product.purchasePrice),
        });

        // Deduct stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: { decrement: Number(item.quantity) },
          },
        });
      }

      const total = subtotal - Number(discount);
      const paymentStatus = paymentMethod === 'CREDIT' ? 'CREDIT' : 'PAID';
      const creditAmount = paymentMethod === 'CREDIT' ? total - Number(amountPaid) : 0;
      const finalAmountPaid = paymentMethod === 'CREDIT'
        ? Number(amountPaid)
        : (amountPaid !== undefined ? Math.max(0, Math.min(total, Number(amountPaid))) : total);

      const billNo = await generateBillNo();

      // If CREDIT, update customer balance first so the included customer relation gets the updated credit balance
      if (paymentMethod === 'CREDIT' && creditAmount > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            creditBalance: { increment: creditAmount },
          },
        });
      }

      // Create the bill
      const bill = await tx.bill.create({
        data: {
          billNo,
          customerId: customerId || null,
          userId: req.user.id,
          subtotal,
          discount: Number(discount),
          total,
          paymentMethod,
          paymentStatus,
          amountPaid: finalAmountPaid,
          creditAmount: creditAmount > 0 ? creditAmount : 0,
          billDate: new Date(),
          items: {
            create: billItems,
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // If CREDIT, create credit transaction
      if (paymentMethod === 'CREDIT' && creditAmount > 0) {
        await tx.creditTransaction.create({
          data: {
            customerId,
            billId: bill.id,
            type: 'CREDIT',
            amount: creditAmount,
            description: `Credit sale - Bill ${billNo}`,
            transactionDate: new Date(),
          },
        });
      }

      return bill;
    });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/billing/bills
export const getBills = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      paymentMethod,
      customerId,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = { isVoid: false };

    if (startDate || endDate) {
      where.billDate = {};
      if (startDate) where.billDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.billDate.lte = end;
      }
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (customerId) {
      where.customerId = Number(customerId);
    }

    if (search) {
      where.billNo = { contains: search };
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.bill.count({ where }),
    ]);

    res.json({
      success: true,
      data: bills,
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

// GET /api/billing/bills/:id
export const getBillById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bill = await prisma.bill.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        },
        customer: true,
        user: { select: { id: true, name: true, email: true } },
        creditTransactions: true,
      },
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found.',
      });
    }

    res.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/billing/daily-sales
export const getDailySales = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const targetYear = Number(year) || new Date().getFullYear();
    const targetMonth = Number(month) || new Date().getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const bills = await prisma.bill.findMany({
      where: {
        billDate: { gte: startDate, lte: endDate },
        isVoid: false,
      },
      select: {
        billDate: true,
        total: true,
        paymentMethod: true,
      },
      orderBy: { billDate: 'asc' },
    });

    // Group by date
    const dailyMap = {};
    for (const bill of bills) {
      const dateKey = bill.billDate.toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, totalSales: 0, billCount: 0 };
      }
      dailyMap[dateKey].totalSales += Number(bill.total);
      dailyMap[dateKey].billCount += 1;
    }

    const dailySales = Object.values(dailyMap);

    res.json({
      success: true,
      data: dailySales,
      month: targetMonth,
      year: targetYear,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/billing/bills/:id/void - Admin only
export const voidBill = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bill = await prisma.bill.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found.',
      });
    }

    if (bill.isVoid) {
      return res.status(400).json({
        success: false,
        message: 'Bill is already voided.',
      });
    }

    await prisma.$transaction(async (tx) => {
      // Mark bill as void
      await tx.bill.update({
        where: { id: Number(id) },
        data: { isVoid: true },
      });

      // Restore stock for each item
      for (const item of bill.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: { increment: Number(item.quantity) },
          },
        });
      }

      // If it was a credit bill, reverse the credit
      if (bill.paymentMethod === 'CREDIT' && bill.customerId && Number(bill.creditAmount) > 0) {
        await tx.customer.update({
          where: { id: bill.customerId },
          data: {
            creditBalance: { decrement: Number(bill.creditAmount) },
          },
        });

        await tx.creditTransaction.create({
          data: {
            customerId: bill.customerId,
            billId: bill.id,
            type: 'PAYMENT',
            amount: Number(bill.creditAmount),
            description: `Bill voided - ${bill.billNo}`,
            transactionDate: new Date(),
          },
        });
      }
    });

    res.json({
      success: true,
      message: 'Bill voided successfully. Stock has been restored.',
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/billing/bills/:id/return-item
export const returnBillItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { billItemId, quantity } = req.body;
    
    if (!billItemId || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid return data.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id: Number(id) },
        include: { items: true, customer: true }
      });

      if (!bill) {
        throw Object.assign(new Error('Bill not found'), { statusCode: 404 });
      }

      if (bill.isVoid) {
        throw Object.assign(new Error('Cannot return items from a voided bill'), { statusCode: 400 });
      }

      const itemToReturn = bill.items.find(i => i.id === Number(billItemId));
      
      if (!itemToReturn) {
        throw Object.assign(new Error('Item not found in this bill'), { statusCode: 404 });
      }

      const availableToReturn = Number(itemToReturn.quantity) - Number(itemToReturn.returnedQuantity || 0);
      
      if (Number(quantity) > availableToReturn) {
        throw Object.assign(new Error(`Cannot return more than available quantity (${availableToReturn})`), { statusCode: 400 });
      }

      // 1. Update BillItem
      const refundAmount = Number(itemToReturn.unitPrice) * Number(quantity);
      
      await tx.billItem.update({
        where: { id: itemToReturn.id },
        data: {
          returnedQuantity: { increment: Number(quantity) },
          total: { decrement: refundAmount }
        }
      });

      // 2. Restore Product Stock
      await tx.product.update({
        where: { id: itemToReturn.productId },
        data: {
          stockQty: { increment: Number(quantity) }
        }
      });

      // 3. Recalculate Bill totals
      const newSubtotal = Math.max(0, Number(bill.subtotal) - refundAmount);
      const newTotal = Math.max(0, Number(bill.total) - refundAmount);

      let newAmountPaid = Number(bill.amountPaid);
      let newCreditAmount = Number(bill.creditAmount);

      if (bill.paymentMethod === 'CREDIT') {
         // Do not touch Cash or Online (newAmountPaid remains unchanged).
         // Adjust the bill's creditAmount.
         newCreditAmount = newTotal - newAmountPaid;

         if (bill.customerId) {
           await tx.customer.update({
             where: { id: bill.customerId },
             data: { creditBalance: { decrement: refundAmount } }
           });
           
           await tx.creditTransaction.create({
             data: {
               customerId: bill.customerId,
               billId: bill.id,
               type: 'RETURN', 
               amount: refundAmount,
               description: `Item return adj. - Bill ${bill.billNo}`,
               transactionDate: new Date(),
             }
           });
         }
      } else {
         // CASH or Online - deduct refundAmount directly from amountPaid.
         newAmountPaid = Math.max(0, newAmountPaid - refundAmount);
         newCreditAmount = 0;
      }

      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          amountPaid: newAmountPaid,
          creditAmount: newCreditAmount,
          hasReturns: true
        },
        include: {
          items: { include: { product: true } },
          customer: true
        }
      });

      return updatedBill;
    });

    res.json({
      success: true,
      message: 'Item returned successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

