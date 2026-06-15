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
      select: { total: true, paymentMethod: true, amountPaid: true, creditAmount: true },
    });

    const cashPayments = periodBills
      .reduce((sum, b) => {
        if (b.paymentMethod?.toUpperCase() === 'CASH' || b.paymentMethod?.toUpperCase() === 'CREDIT') {
          return sum + Number(b.amountPaid);
        }
        return sum;
      }, 0);

    const onlinePayments = periodBills
      .filter((b) => ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(b.paymentMethod?.toUpperCase()))
      .reduce((sum, b) => sum + Number(b.amountPaid), 0);

    const creditPayments = periodBills
      .filter((b) => b.paymentMethod?.toUpperCase() === 'CREDIT')
      .reduce((sum, b) => sum + Number(b.creditAmount), 0);

    const totalSales = cashPayments + onlinePayments + creditPayments;
    const billCount = periodBills.length;

    // Total stock value
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { stockQty: true, purchasePrice: true, salePrice: true },
    });
    const totalStockValue = products.reduce(
      (sum, p) => sum + Number(p.stockQty) * Number(p.purchasePrice),
      0
    );

    // Total credits outstanding
    const creditCustomers = await prisma.customer.findMany({
      where: { creditBalance: { gt: 0 } },
      select: { creditBalance: true },
    });
    const totalCredits = creditCustomers.reduce(
      (sum, c) => sum + Number(c.creditBalance),
      0
    );

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
        lowStockCount,
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

    const dailyMap = {};
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
        };
      }
      dailyMap[dateKey].billCount += 1;
      dailyMap[dateKey].totalDiscount += Number(bill.discount);
      
      let billCash = 0;
      let billOnline = 0;
      let billCredit = 0;

      if (bill.paymentMethod === 'CASH') {
        billCash = Number(bill.amountPaid);
      } else if (bill.paymentMethod === 'CREDIT') {
        billCash = Number(bill.amountPaid);
        billCredit = Number(bill.creditAmount);
      } else if (['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(bill.paymentMethod)) {
        billOnline = Number(bill.amountPaid);
      }

      dailyMap[dateKey].cash += billCash;
      dailyMap[dateKey].online += billOnline;
      dailyMap[dateKey].credit += billCredit;
      dailyMap[dateKey].total += (billCash + billOnline + billCredit);
    }

    res.json({
      success: true,
      data: Object.values(dailyMap),
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

      if (bill.paymentMethod === 'CASH') {
        billCash = Number(bill.amountPaid);
      } else if (bill.paymentMethod === 'CREDIT') {
        billCash = Number(bill.amountPaid);
        billCredit = Number(bill.creditAmount);
      } else if (['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(bill.paymentMethod)) {
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
      totalCost += Number(item.product.purchasePrice) * Number(item.quantity);
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
