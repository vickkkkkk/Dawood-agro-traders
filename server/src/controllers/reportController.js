import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/reports/dashboard
export const getDashboard = async (req, res, next) => {
  try {
    const { startDate, endDate, month, year } = req.query;

    // Default to today
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    let periodStart;
    let periodEnd;

    if (month || year) {
      const targetYear = Number(year) || today.getFullYear();
      const targetMonth = Number(month) || today.getMonth() + 1;
      periodStart = new Date(targetYear, targetMonth - 1, 1);
      periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    } else {
      periodStart = startDate
        ? new Date(startDate)
        : new Date(today.getFullYear(), today.getMonth(), 1);
      periodEnd = endDate
        ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })()
        : todayEnd;
    }

    // Today's sales
    const todayBills = await prisma.bill.findMany({
      where: {
        billDate: { gte: todayStart, lte: todayEnd },
        isVoid: false,
      },
      select: { total: true, amountPaid: true, creditAmount: true, paymentMethod: true },
    });
    const todaySales = todayBills.reduce((sum, b) => sum + Number(b.paymentMethod === 'CREDIT' ? b.total : b.amountPaid), 0);
    const todayBillCount = todayBills.length;

    // Period sales
    const periodBills = await prisma.bill.findMany({
      where: {
        billDate: { gte: periodStart, lte: periodEnd },
        isVoid: false,
      },
      select: {
        total: true,
        paymentMethod: true,
        amountPaid: true,
        creditAmount: true,
        items: {
          select: {
            quantity: true,
            returnedQuantity: true,
            purchasePrice: true,
            product: {
              select: {
                purchasePrice: true,
              },
            },
          },
        },
      },
    });

    const cashPaymentsFromBills = periodBills
      .reduce((sum, b) => {
        if (b.paymentMethod?.toUpperCase() === 'CASH' || b.paymentMethod?.toUpperCase() === 'CREDIT') {
          return sum + Number(b.amountPaid);
        }
        return sum;
      }, 0);

    const onlinePaymentsFromBills = periodBills
      .filter((b) => ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(b.paymentMethod?.toUpperCase()))
      .reduce((sum, b) => sum + Number(b.amountPaid), 0);

    const creditPayments = periodBills
      .filter((b) => b.paymentMethod?.toUpperCase() === 'CREDIT')
      .reduce((sum, b) => sum + Number(b.creditAmount), 0);

    const billCount = periodBills.length;

    // Fetch CreditTransaction PAYMENT and PAYBACK records in the period.
    // PAYMENT = cash received (adds to hand), PAYBACK = cash returned (subtracts from hand)
    const creditTxActivity = await prisma.creditTransaction.findMany({
      where: {
        type: { in: ['PAYMENT', 'PAYBACK'] },
        transactionDate: { gte: periodStart, lte: periodEnd },
      },
      select: { type: true, amount: true, paymentMethod: true },
    });

    const cashFromCreditTx = creditTxActivity
      .filter((tx) => !['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(tx.paymentMethod?.toUpperCase()))
      .reduce((sum, tx) => {
        const amt = Number(tx.amount);
        return tx.type === 'PAYMENT' ? sum + amt : sum - amt;
      }, 0);

    const onlineFromCreditTx = creditTxActivity
      .filter((tx) => ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(tx.paymentMethod?.toUpperCase()))
      .reduce((sum, tx) => {
        const amt = Number(tx.amount);
        return tx.type === 'PAYMENT' ? sum + amt : sum - amt;
      }, 0);

    const cashPayments = cashPaymentsFromBills + cashFromCreditTx;
    const onlinePayments = onlinePaymentsFromBills + onlineFromCreditTx;
    const totalSales = cashPayments + onlinePayments + creditPayments;

    let totalCreditConsume = 0;
    for (const b of periodBills) {
      for (const item of b.items) {
        const netQty = Number(item.quantity) - Number(item.returnedQuantity || 0);
        const itemPurchasePrice = Number(item.purchasePrice !== undefined && item.purchasePrice !== 0 ? item.purchasePrice : (item.product?.purchasePrice || 0));
        totalCreditConsume += itemPurchasePrice * netQty;
      }
    }

    // Total stock value & outstanding credits
    let totalStockValue = 0;
    let totalCredits = 0;
    let totalAdvance = 0;

    if (periodStart <= today) {
      const evaluationEnd = periodEnd > today ? today : periodEnd;

      // Total stock value
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, stockQty: true, purchasePrice: true, createdAt: true },
      });

      const billItemsAfter = await prisma.billItem.findMany({
        where: {
          bill: {
            billDate: { gt: evaluationEnd },
            isVoid: false,
          },
          product: { isActive: true },
        },
        select: {
          productId: true,
          quantity: true,
          returnedQuantity: true,
        },
      });

      const purchaseItemsAfter = await prisma.purchaseItem.findMany({
        where: {
          purchase: {
            purchaseDate: { gt: evaluationEnd },
            status: 'RECEIVED',
          },
          product: { isActive: true },
        },
        select: {
          productId: true,
          quantity: true,
        },
      });

      const stockChanges = {};
      for (const item of billItemsAfter) {
        if (!stockChanges[item.productId]) {
          stockChanges[item.productId] = 0;
        }
        stockChanges[item.productId] += (Number(item.quantity) - Number(item.returnedQuantity));
      }

      for (const item of purchaseItemsAfter) {
        if (!stockChanges[item.productId]) {
          stockChanges[item.productId] = 0;
        }
        stockChanges[item.productId] -= Number(item.quantity);
      }

      totalStockValue = products.reduce((sum, p) => {
        if (p.createdAt > evaluationEnd) {
          return sum;
        }
        const change = stockChanges[p.id] || 0;
        const historicalQty = Math.max(0, Number(p.stockQty) + change);
        return sum + historicalQty * Number(p.purchasePrice);
      }, 0);

      // Total credits outstanding
      const customers = await prisma.customer.findMany({
        select: { id: true, creditBalance: true }
      });

      const creditTransactionsAfter = await prisma.creditTransaction.findMany({
        where: {
          transactionDate: { gt: evaluationEnd }
        },
        select: {
          customerId: true,
          type: true,
          amount: true
        }
      });

      const creditChangesAfter = {};
      for (const tx of creditTransactionsAfter) {
        if (!creditChangesAfter[tx.customerId]) {
          creditChangesAfter[tx.customerId] = 0;
        }
        if (tx.type === 'CREDIT' || tx.type === 'PAYBACK') {
          creditChangesAfter[tx.customerId] += Number(tx.amount);
        } else if (tx.type === 'PAYMENT') {
          creditChangesAfter[tx.customerId] -= Number(tx.amount);
        }
      }

      totalCredits = customers.reduce((sum, c) => {
        const currentBal = Number(c.creditBalance);
        const changeAfter = creditChangesAfter[c.id] || 0;
        const historicalBal = currentBal - changeAfter;
        if (historicalBal > 0) {
          return sum + historicalBal;
        }
        return sum;
      }, 0);

      totalAdvance = customers.reduce((sum, c) => {
        const currentBal = Number(c.creditBalance);
        const changeAfter = creditChangesAfter[c.id] || 0;
        const historicalBal = currentBal - changeAfter;
        if (historicalBal < 0) {
          return sum + Math.abs(historicalBal);
        }
        return sum;
      }, 0);
    }

    // Low stock count
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: { stockQty: true, lowStockAlert: true },
    });
    const lowStockCount = allProducts.filter(
      (p) => Number(p.stockQty) <= Number(p.lowStockAlert)
    ).length;

    res.json({
      success: true,
      data: {
        todaySales,
        todayBillCount,
        totalSales,
        billCount,
        cashPayments,
        onlinePayments,
        creditPayments,
        totalStockValue,
        totalCredits,
        totalAdvance,
        lowStockCount,
        totalCreditConsume,
        period: {
          start: periodStart,
          end: periodEnd,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/daily-sales
export const getDailySales = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const targetYear = Number(year) || new Date().getFullYear();
    const targetMonth = Number(month) || new Date().getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Fetch bills for the period
    const bills = await prisma.bill.findMany({
      where: {
        billDate: { gte: startDate, lte: endDate },
        isVoid: false,
      },
      select: {
        billDate: true,
        total: true,
        paymentMethod: true,
        discount: true,
        amountPaid: true,
        creditAmount: true,
      },
      orderBy: { billDate: 'asc' },
    });

    // Fetch CreditTransaction PAYMENT and PAYBACK records for the period
    // PAYMENT = cash received (receivable collection / advance received)
    // PAYBACK = cash returned to customer (subtracts from Rcv/Adv and Cash in Hand)
    const creditTxActivity = await prisma.creditTransaction.findMany({
      where: {
        type: { in: ['PAYMENT', 'PAYBACK'] },
        transactionDate: { gte: startDate, lte: endDate },
      },
      select: {
        customerId: true,
        transactionDate: true,
        type: true,
        amount: true,
        paymentMethod: true,
      },
      orderBy: { transactionDate: 'asc' },
    });

    const dailyMap = {};

    // --- Pass 1: aggregate bills ---
    for (const bill of bills) {
      const dateKey = bill.billDate.toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          total: 0,
          billCount: 0,
          cash: 0,
          online: 0,
          credit: 0,
          totalDiscount: 0,
          receive: 0,
          advance: 0,
          payback: 0,
          cashInHand: 0,
          manualInflow: 0,
          manualOutflow: 0,
          bankTransfers: 0,
        };
      }
      dailyMap[dateKey].billCount += 1;
      dailyMap[dateKey].totalDiscount += Number(bill.discount);

      let billCash = 0;
      let billOnline = 0;
      let billCredit = 0;

      const method = bill.paymentMethod?.toUpperCase();
      if (method === 'CASH') {
        billCash = Number(bill.amountPaid);
      } else if (method === 'CREDIT') {
        billCash = Number(bill.amountPaid);
        billCredit = Number(bill.creditAmount);
      } else if (['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(method)) {
        billOnline = Number(bill.amountPaid);
      }

      dailyMap[dateKey].cash += billCash;
      dailyMap[dateKey].online += billOnline;
      dailyMap[dateKey].credit += billCredit;
      dailyMap[dateKey].total += (billCash + billOnline + billCredit);
    }

    // --- Pass 2: rebuild balances and compute receive/advance/payback ---
    const activeCustomerIds = [...new Set(creditTxActivity.map(tx => tx.customerId).filter(Boolean))];
    
    let customerTransactions = [];
    if (activeCustomerIds.length > 0) {
      customerTransactions = await prisma.creditTransaction.findMany({
        where: {
          customerId: { in: activeCustomerIds },
          transactionDate: { lte: endDate },
        },
        orderBy: [
          { transactionDate: 'asc' },
          { id: 'asc' },
        ],
      });
    }

    const txByCustomer = {};
    for (const tx of customerTransactions) {
      if (!txByCustomer[tx.customerId]) {
        txByCustomer[tx.customerId] = [];
      }
      txByCustomer[tx.customerId].push(tx);
    }

    for (const customerId of activeCustomerIds) {
      const txs = txByCustomer[customerId] || [];
      let balance = 0;

      for (const tx of txs) {
        const dateKey = tx.transactionDate.toISOString().slice(0, 10);
        const isWithinPeriod = tx.transactionDate >= startDate && tx.transactionDate <= endDate;
        const amount = Number(tx.amount);
        const type = tx.type;

        if (type === 'CREDIT') {
          balance += amount;
        } else if (type === 'PAYBACK') {
          balance += amount;

          if (isWithinPeriod) {
            if (!dailyMap[dateKey]) {
              dailyMap[dateKey] = {
                date: dateKey,
                total: 0,
                billCount: 0,
                cash: 0,
                online: 0,
                credit: 0,
                totalDiscount: 0,
                receive: 0,
                advance: 0,
                payback: 0,
                cashInHand: 0,
                manualInflow: 0,
                manualOutflow: 0,
                bankTransfers: 0,
              };
            }

            const isOnline = ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(
              tx.paymentMethod?.toUpperCase()
            );

            if (isOnline) {
              dailyMap[dateKey].online -= amount;
            } else {
              dailyMap[dateKey].payback += amount;
            }
            dailyMap[dateKey].total -= amount;
          }
        } else if (type === 'PAYMENT') {
          const balanceBefore = balance;
          balance -= amount;

          if (isWithinPeriod) {
            if (!dailyMap[dateKey]) {
              dailyMap[dateKey] = {
                date: dateKey,
                total: 0,
                billCount: 0,
                cash: 0,
                online: 0,
                credit: 0,
                totalDiscount: 0,
                receive: 0,
                advance: 0,
                payback: 0,
                cashInHand: 0,
                manualInflow: 0,
                manualOutflow: 0,
                bankTransfers: 0,
              };
            }

            const isOnline = ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(
              tx.paymentMethod?.toUpperCase()
            );

            let recAmt = 0;
            let advAmt = 0;

            if (balanceBefore > 0) {
              recAmt = Math.min(amount, balanceBefore);
              advAmt = Math.max(0, amount - balanceBefore);
            } else {
              recAmt = 0;
              advAmt = amount;
            }

            if (isOnline) {
              dailyMap[dateKey].online += amount;
            } else {
              dailyMap[dateKey].receive += recAmt;
              dailyMap[dateKey].advance += advAmt;
            }
            dailyMap[dateKey].total += amount;
          }
        }
      }
    }

    // --- Fetch custom Cash transactions ---
    const cashTxs = await prisma.cashTransaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });

    for (const tx of cashTxs) {
      const dateKey = tx.date.toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          total: 0,
          billCount: 0,
          cash: 0,
          online: 0,
          credit: 0,
          totalDiscount: 0,
          receive: 0,
          advance: 0,
          payback: 0,
          cashInHand: 0,
          manualInflow: 0,
          manualOutflow: 0,
          bankTransfers: 0,
        };
      }
      const amt = Number(tx.amount || 0);
      if (tx.type === 'INFLOW') {
        dailyMap[dateKey].manualInflow += amt;
      } else if (tx.type === 'BANK_TRANSFER') {
        dailyMap[dateKey].bankTransfers += amt;
        dailyMap[dateKey].online += amt;
        dailyMap[dateKey].total += amt;
      } else {
        // EXPENSE, PARTY_PAYMENT, LIABILITY, GOODS_PURCHASE
        dailyMap[dateKey].manualOutflow += amt;
      }
    }

    // --- Pass 3: compute cashInHand per day ---
    for (const day of Object.values(dailyMap)) {
      const customInflow = Number(day.manualInflow || 0);
      const customOutflow = Number(day.manualOutflow || 0);
      const bankTransfers = Number(day.bankTransfers || 0);
      day.cashInHand = day.cash + day.receive + day.advance - day.payback + customInflow - customOutflow - bankTransfers;
    }

    res.json({
      success: true,
      data: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
      month: targetMonth,
      year: targetYear,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/monthly-sales
export const getMonthlySales = async (req, res, next) => {
  try {
    const { year } = req.query;
    const targetYear = Number(year) || new Date().getFullYear();

    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const bills = await prisma.bill.findMany({
      where: {
        billDate: { gte: startDate, lte: endDate },
        isVoid: false,
      },
      select: {
        billDate: true,
        total: true,
        paymentMethod: true,
        amountPaid: true,
        creditAmount: true,
      },
      orderBy: { billDate: 'asc' },
    });

    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${targetYear}-${String(m).padStart(2, '0')}`;
      monthlyMap[key] = {
        month: m,
        year: targetYear,
        label: key,
        totalSales: 0,
        billCount: 0,
        cashSales: 0,
        creditSales: 0,
      };
    }

    for (const bill of bills) {
      const month = bill.billDate.getMonth() + 1;
      const key = `${targetYear}-${String(month).padStart(2, '0')}`;
      
      let billCash = 0;
      let billOnline = 0;
      let billCredit = 0;

      const method = bill.paymentMethod?.toUpperCase();
      if (method === 'CASH') {
        billCash = Number(bill.amountPaid);
      } else if (method === 'CREDIT') {
        billCash = Number(bill.amountPaid);
        billCredit = Number(bill.creditAmount);
      } else if (['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(method)) {
        billOnline = Number(bill.amountPaid);
      }

      monthlyMap[key].cashSales += billCash;
      monthlyMap[key].creditSales += billCredit;
      monthlyMap[key].totalSales += (billCash + billOnline + billCredit);
      monthlyMap[key].billCount += 1;
    }

    res.json({
      success: true,
      data: Object.values(monthlyMap),
      year: targetYear,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/profit
export const getProfitReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const today = new Date();
    const periodStart = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const periodEnd = endDate
      ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })()
      : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Get all bill items with product purchase price for the period
    const billItems = await prisma.billItem.findMany({
      where: {
        bill: {
          billDate: { gte: periodStart, lte: periodEnd },
          isVoid: false,
        },
      },
      include: {
        product: { select: { purchasePrice: true } },
        bill: { select: { discount: true } },
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;

    for (const item of billItems) {
      totalRevenue += Number(item.total);
      const netQty = Number(item.quantity) - Number(item.returnedQuantity || 0);
      const itemPurchasePrice = Number(item.purchasePrice !== undefined && item.purchasePrice !== 0 ? item.purchasePrice : (item.product?.purchasePrice || 0));
      totalCost += itemPurchasePrice * netQty;
    }

    // Total discounts
    const bills = await prisma.bill.findMany({
      where: {
        billDate: { gte: periodStart, lte: periodEnd },
        isVoid: false,
      },
      select: { discount: true, total: true },
    });

    const totalDiscount = bills.reduce((sum, b) => sum + Number(b.discount), 0);
    const totalSales = bills.reduce((sum, b) => sum + Number(b.total), 0);
    const grossProfit = totalRevenue - totalCost;
    const netProfit = totalSales - totalCost;

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalCost,
        grossProfit,
        totalDiscount,
        totalSales,
        netProfit,
        profitMargin: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0,
        period: { start: periodStart, end: periodEnd },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/stock-value
export const getStockValue = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQty: true,
        purchasePrice: true,
        salePrice: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const stockData = products.map((p) => ({
      ...p,
      costValue: Number(p.stockQty) * Number(p.purchasePrice),
      retailValue: Number(p.stockQty) * Number(p.salePrice),
    }));

    const totalCostValue = stockData.reduce((sum, p) => sum + p.costValue, 0);
    const totalRetailValue = stockData.reduce((sum, p) => sum + p.retailValue, 0);
    const potentialProfit = totalRetailValue - totalCostValue;

    res.json({
      success: true,
      data: {
        products: stockData,
        summary: {
          totalCostValue,
          totalRetailValue,
          potentialProfit,
          totalProducts: stockData.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/purchase-ledger
export const getPurchaseLedger = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        purchasePrice: true,
        purchaseItems: {
          where: {
            purchase: { status: 'RECEIVED' }
          },
          select: {
            quantity: true,
            unitPrice: true,
            total: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const data = products.map(p => {
      const totalQty = p.purchaseItems.reduce((sum, item) => sum + Number(item.quantity), 0);
      const totalCost = p.purchaseItems.reduce((sum, item) => sum + Number(item.total), 0);
      const batchCount = p.purchaseItems.length;
      
      const avgPrice = totalQty > 0 ? (totalCost / totalQty) : Number(p.purchasePrice);

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        totalQuantityPurchased: totalQty,
        averagePurchasePrice: avgPrice,
        latestPurchasePrice: p.purchasePrice,
        batchCount
      };
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/purchase-ledger/:productId
export const getProductPurchaseDetail = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
      select: { id: true, name: true, sku: true, unit: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const purchaseItems = await prisma.purchaseItem.findMany({
      where: {
        productId: Number(productId),
        purchase: { status: 'RECEIVED' }
      },
      include: {
        purchase: {
          select: {
            grnNo: true,
            purchaseDate: true,
            supplier: { select: { name: true, company: true } }
          }
        }
      },
      orderBy: {
        purchase: { purchaseDate: 'desc' }
      }
    });

    const history = purchaseItems.map(item => ({
      id: item.id,
      grnNo: item.purchase.grnNo,
      date: item.purchase.purchaseDate,
      supplierName: item.purchase.supplier.name,
      supplierCompany: item.purchase.supplier.company,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate
    }));

    res.json({
      success: true,
      data: {
        product,
        history
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/sales-ledger
export const getSalesLedger = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        purchasePrice: true,
        purchaseItems: {
          where: {
            purchase: { status: 'RECEIVED' }
          },
          select: {
            quantity: true,
            unitPrice: true,
            total: true
          }
        },
        billItems: {
          where: {
            bill: { isVoid: false }
          },
          select: {
            quantity: true,
            returnedQuantity: true,
            unitPrice: true,
            total: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const data = products.map(p => {
      const totalPurchased = p.purchaseItems.reduce((sum, item) => sum + Number(item.quantity), 0);
      const totalPurchaseCost = p.purchaseItems.reduce((sum, item) => sum + Number(item.total), 0);
      
      const wac = totalPurchased > 0 ? (totalPurchaseCost / totalPurchased) : Number(p.purchasePrice);

      let totalSold = 0;
      let totalRevenue = 0;
      
      for (const item of p.billItems) {
        const netQty = Number(item.quantity) - Number(item.returnedQuantity || 0);
        if (netQty > 0) {
          totalSold += netQty;
          totalRevenue += netQty * Number(item.unitPrice);
        }
      }

      const avgSalePrice = totalSold > 0 ? (totalRevenue / totalSold) : 0;
      const remainingQty = totalPurchased - totalSold;
      
      const cogs = totalSold * wac;
      const netProfit = totalRevenue - cogs;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        totalQuantityPurchased: totalPurchased,
        totalQuantitySold: totalSold,
        remainingQuantity: remainingQty,
        weightedAverageCost: wac,
        averageSalePrice: avgSalePrice,
        totalRevenue,
        cogs,
        netProfit
      };
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/sales-ledger/:productId
export const getProductSalesDetail = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
      select: { id: true, name: true, sku: true, unit: true, purchasePrice: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const purchaseItems = await prisma.purchaseItem.findMany({
      where: {
        productId: Number(productId),
        purchase: { status: 'RECEIVED' }
      },
      select: {
        quantity: true,
        total: true
      }
    });

    const totalPurchased = purchaseItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalPurchaseCost = purchaseItems.reduce((sum, item) => sum + Number(item.total), 0);
    const wac = totalPurchased > 0 ? (totalPurchaseCost / totalPurchased) : Number(product.purchasePrice);

    const billItems = await prisma.billItem.findMany({
      where: {
        productId: Number(productId),
        bill: { isVoid: false }
      },
      include: {
        bill: {
          select: {
            billNo: true,
            billDate: true,
            customer: { select: { name: true } }
          }
        }
      },
      orderBy: {
        bill: { billDate: 'desc' }
      }
    });

    const history = billItems.map(item => {
      const netQty = Number(item.quantity) - Number(item.returnedQuantity || 0);
      const revenue = netQty * Number(item.unitPrice);
      const cost = netQty * wac;
      const profit = revenue - cost;

      return {
        id: item.id,
        billNo: item.bill.billNo,
        date: item.bill.billDate,
        customerName: item.bill.customer?.name || 'Walk-in Customer',
        quantitySold: netQty,
        salePrice: Number(item.unitPrice),
        totalRevenue: revenue,
        costBasis: cost,
        profit
      };
    }).filter(h => h.quantitySold > 0);

    const totalNetProfit = history.reduce((sum, h) => sum + h.profit, 0);
    const totalQuantitySold = history.reduce((sum, h) => sum + h.quantitySold, 0);

    res.json({
      success: true,
      data: {
        product,
        weightedAverageCost: wac,
        totalQuantitySold,
        totalNetProfit,
        history
      }
    });
  } catch (error) {
    next(error);
  }
};
