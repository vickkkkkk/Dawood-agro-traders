import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate sequential return number: SR-YYYYMMDD-XXXX or PR-YYYYMMDD-XXXX
 */
async function generateReturnNo(type) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = type === 'SALE' ? `SR-${dateStr}-` : `PR-${dateStr}-`;

  const lastReturn = await prisma.returnRecord.findFirst({
    where: { returnNo: { startsWith: prefix } },
    orderBy: { returnNo: 'desc' },
  });

  let sequence = 1;
  if (lastReturn) {
    const lastSeq = parseInt(lastReturn.returnNo.split('-').pop(), 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

// GET /api/returns
export const getReturnRecords = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      startDate,
      endDate,
      customerId,
      supplierId,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (type) {
      where.type = type.toUpperCase();
    }

    if (startDate || endDate) {
      where.returnDate = {};
      if (startDate) where.returnDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.returnDate.lte = end;
      }
    }

    if (customerId) {
      where.customerId = Number(customerId);
    }

    if (supplierId) {
      where.supplierId = Number(supplierId);
    }

    if (search) {
      where.OR = [
        { returnNo: { contains: search } },
        { referenceNo: { contains: search } },
      ];
    }

    const [returns, total] = await Promise.all([
      prisma.returnRecord.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { returnDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          supplier: { select: { id: true, name: true, phone: true, company: true } },
          user: { select: { id: true, name: true, email: true } },
          items: true,
        },
      }),
      prisma.returnRecord.count({ where }),
    ]);

    res.json({
      success: true,
      data: returns,
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

// GET /api/returns/:id
export const getReturnRecordById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const returnRec = await prisma.returnRecord.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        supplier: true,
        user: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    if (!returnRec) {
      return res.status(404).json({ success: false, message: 'Return record not found.' });
    }

    res.json({
      success: true,
      data: returnRec,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/returns/sales
export const createSaleReturn = async (req, res, next) => {
  try {
    const { billId, reason, reasonDetails, refundMethod, items } = req.body;

    if (!billId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid return data.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id: Number(billId) },
        include: { items: { include: { product: true } }, customer: true },
      });

      if (!bill) {
        throw Object.assign(new Error('Bill not found'), { statusCode: 404 });
      }

      if (bill.isVoid) {
        throw Object.assign(new Error('Cannot return items from a voided bill'), { statusCode: 400 });
      }

      let totalRefund = 0;
      const returnRecordItems = [];

      for (const item of items) {
        const billItem = bill.items.find(i => i.id === Number(item.billItemId));
        if (!billItem) {
          throw Object.assign(new Error(`Item with ID ${item.billItemId} not found on this bill`), { statusCode: 404 });
        }

        const qty = Number(item.quantity);
        const availableToReturn = Number(billItem.quantity) - Number(billItem.returnedQuantity || 0);

        if (qty <= 0 || qty > availableToReturn) {
          throw Object.assign(new Error(`Invalid return quantity for product ${billItem.product?.name || 'Item'}`), { statusCode: 400 });
        }

        const itemRefund = Number(billItem.unitPrice) * qty;
        totalRefund += itemRefund;

        // 1. Update BillItem returned quantity
        await tx.billItem.update({
          where: { id: billItem.id },
          data: {
            returnedQuantity: { increment: qty },
            total: { decrement: itemRefund },
          },
        });

        // 2. Increment stock quantity
        await tx.product.update({
          where: { id: billItem.productId },
          data: {
            stockQty: { increment: qty },
          },
        });

        returnRecordItems.push({
          productId: billItem.productId,
          productName: billItem.product?.name || `Product #${billItem.productId}`,
          quantity: qty,
          unitPrice: Number(billItem.unitPrice),
          total: itemRefund,
        });
      }

      // 3. Recalculate bill totals
      const newSubtotal = Math.max(0, Number(bill.subtotal) - totalRefund);
      const newTotal = Math.max(0, Number(bill.total) - totalRefund);

      let newAmountPaid = Number(bill.amountPaid);
      let newCreditAmount = Number(bill.creditAmount);

      // 4. Refund / Credit calculations
      if (refundMethod === 'CREDIT') {
        newCreditAmount = newTotal - newAmountPaid;

        if (bill.customerId) {
          await tx.customer.update({
            where: { id: bill.customerId },
            data: { creditBalance: { decrement: totalRefund } },
          });

          await tx.creditTransaction.create({
            data: {
              customerId: bill.customerId,
              billId: bill.id,
              type: 'RETURN',
              amount: totalRefund,
              description: `Item return credit adj. - Bill ${bill.billNo}`,
              transactionDate: new Date(),
            },
          });
        }
      } else if (refundMethod === 'CASH' || refundMethod === 'ONLINE') {
        if (bill.paymentMethod === 'CREDIT') {
          const creditDeduction = Math.min(totalRefund, bill.creditAmount);
          const cashRefund = totalRefund - creditDeduction;

          if (creditDeduction > 0 && bill.customerId) {
            await tx.customer.update({
              where: { id: bill.customerId },
              data: { creditBalance: { decrement: creditDeduction } },
            });

            await tx.creditTransaction.create({
              data: {
                customerId: bill.customerId,
                billId: bill.id,
                type: 'RETURN',
                amount: creditDeduction,
                description: `Item return credit adj. - Bill ${bill.billNo}`,
                transactionDate: new Date(),
              },
            });
          }

          if (cashRefund > 0) {
            newAmountPaid = Math.max(0, newAmountPaid - cashRefund);
          }
          newCreditAmount = bill.creditAmount - creditDeduction;
        } else {
          // Cash or Online original sale
          newAmountPaid = Math.max(0, newAmountPaid - totalRefund);
          newCreditAmount = 0;
        }
      }

      // 5. Update Bill Record
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          amountPaid: newAmountPaid,
          creditAmount: newCreditAmount,
          hasReturns: true,
        },
      });

      // 6. Check if full or partial return
      const updatedBill = await tx.bill.findUnique({
        where: { id: bill.id },
        include: { items: true },
      });
      const totalQty = updatedBill.items.reduce((sum, i) => sum + Number(i.quantity), 0);
      const totalRetQty = updatedBill.items.reduce((sum, i) => sum + Number(i.returnedQuantity || 0), 0);
      const isFullReturn = totalRetQty >= totalQty;

      // 7. Create Return Record
      const returnNo = await generateReturnNo('SALE');
      const returnRecord = await tx.returnRecord.create({
        data: {
          returnNo,
          type: 'SALE',
          subType: isFullReturn ? 'FULL' : 'PARTIAL',
          referenceNo: bill.billNo,
          billId: bill.id,
          customerId: bill.customerId,
          reason,
          reasonDetails,
          refundMethod,
          netAmount: totalRefund,
          userId: req.user.id,
          items: {
            create: returnRecordItems,
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      return returnRecord;
    });

    res.status(201).json({
      success: true,
      message: 'Sale return processed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/returns/purchases
export const createPurchaseReturn = async (req, res, next) => {
  try {
    const { purchaseId, reason, reasonDetails, refundMethod, items } = req.body;

    if (!purchaseId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid return data.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: Number(purchaseId) },
        include: { items: { include: { product: true } }, supplier: true, liability: true },
      });

      if (!purchase) {
        throw Object.assign(new Error('Purchase GRN not found'), { statusCode: 404 });
      }

      let totalRefundCost = 0;
      const returnRecordItems = [];

      for (const item of items) {
        const purchaseItem = purchase.items.find(i => i.id === Number(item.purchaseItemId));
        if (!purchaseItem) {
          throw Object.assign(new Error(`Item with ID ${item.purchaseItemId} not found on this purchase GRN`), { statusCode: 404 });
        }

        const qty = Number(item.quantity);
        const availableToReturn = Number(purchaseItem.quantity) - Number(purchaseItem.returnedQuantity || 0);

        if (qty <= 0 || qty > availableToReturn) {
          throw Object.assign(new Error(`Invalid return quantity for product ${purchaseItem.product?.name || 'Item'}`), { statusCode: 400 });
        }

        const itemRefund = Number(purchaseItem.unitPrice) * qty;
        totalRefundCost += itemRefund;

        // 1. Update PurchaseItem returned quantity
        await tx.purchaseItem.update({
          where: { id: purchaseItem.id },
          data: {
            returnedQuantity: { increment: qty },
          },
        });

        // 2. Decrement product stock quantity
        await tx.product.update({
          where: { id: purchaseItem.productId },
          data: {
            stockQty: { decrement: qty },
          },
        });

        returnRecordItems.push({
          productId: purchaseItem.productId,
          productName: purchaseItem.product?.name || `Product #${purchaseItem.productId}`,
          quantity: qty,
          unitPrice: Number(purchaseItem.unitPrice),
          total: itemRefund,
        });
      }

      // 3. Recalculate purchase totals
      const newTotal = Math.max(0, Number(purchase.total) - totalRefundCost);
      const newGrandTotal = Math.max(0, Number(purchase.grandTotal || purchase.total) - totalRefundCost);

      // 4. Adjust liability / cash flow
      if (purchase.paymentMethod === 'LIABILITY' && purchase.liability) {
        const liab = purchase.liability;
        const liabilityDeduction = Math.min(totalRefundCost, liab.remainingBalance);
        const cashRefund = totalRefundCost - liabilityDeduction;

        const newRemaining = Math.max(0, liab.remainingBalance - liabilityDeduction);
        const newLiabTotal = Math.max(0, liab.totalAmount - totalRefundCost);
        const newStatus = newRemaining === 0 ? 'PAID' : (liab.paidAmount > 0 ? 'PARTIAL' : 'UNPAID');

        await tx.liability.update({
          where: { id: liab.id },
          data: {
            totalAmount: newLiabTotal,
            remainingBalance: newRemaining,
            status: newStatus,
          },
        });

        if (cashRefund > 0 && (refundMethod === 'CASH' || refundMethod === 'ONLINE')) {
          await tx.cashTransaction.create({
            data: {
              type: 'INFLOW',
              amount: cashRefund,
              paymentMethod: refundMethod === 'CASH' ? 'CASH' : 'BANK',
              description: `Purchase Return Cash Refund: GRN #${purchase.grnNo} (${purchase.supplier?.name})`,
            },
          });
        }
      } else if (purchase.paymentMethod === 'CASH' || purchase.paymentMethod === 'BANK') {
        if (refundMethod === 'CASH' || refundMethod === 'ONLINE') {
          await tx.cashTransaction.create({
            data: {
              type: 'INFLOW',
              amount: totalRefundCost,
              paymentMethod: refundMethod === 'CASH' ? 'CASH' : 'BANK',
              description: `Purchase Return Cash Refund: GRN #${purchase.grnNo} (${purchase.supplier?.name})`,
            },
          });
        }
      }

      // 5. Update Purchase Record
      await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          total: newTotal,
          grandTotal: newGrandTotal,
          hasReturns: true,
        },
      });

      // 6. Check if full or partial return
      const updatedPurchase = await tx.purchase.findUnique({
        where: { id: purchase.id },
        include: { items: true },
      });
      const totalQty = updatedPurchase.items.reduce((sum, i) => sum + Number(i.quantity), 0);
      const totalRetQty = updatedPurchase.items.reduce((sum, i) => sum + Number(i.returnedQuantity || 0), 0);
      const isFullReturn = totalRetQty >= totalQty;

      // 7. Create Return Record
      const returnNo = await generateReturnNo('PURCHASE');
      const returnRecord = await tx.returnRecord.create({
        data: {
          returnNo,
          type: 'PURCHASE',
          subType: isFullReturn ? 'FULL' : 'PARTIAL',
          referenceNo: purchase.grnNo,
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          reason,
          reasonDetails,
          refundMethod,
          netAmount: totalRefundCost,
          userId: req.user.id,
          items: {
            create: returnRecordItems,
          },
        },
        include: {
          items: true,
          supplier: true,
        },
      });

      return returnRecord;
    });

    res.status(201).json({
      success: true,
      message: 'Purchase return processed successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
