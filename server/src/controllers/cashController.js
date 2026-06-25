import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Helper to calculate current cash in hand and bank balances
 */
const getBalances = async () => {
  // 1. Query POS Cash sales (non-void, cash or credit, where amountPaid > 0)
  const bills = await prisma.bill.findMany({
    where: { isVoid: false },
    select: {
      total: true,
      amountPaid: true,
      paymentMethod: true,
    }
  });

  let posCashInflow = 0;
  let posOnlineInflow = 0;

  for (const b of bills) {
    const method = b.paymentMethod?.toUpperCase();
    const paid = Number(b.amountPaid || 0);
    if (method === 'CASH' || method === 'CREDIT') {
      posCashInflow += paid;
    } else if (['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(method)) {
      posOnlineInflow += paid;
    }
  }

  // 2. Query Credit transaction payments & paybacks
  const creditTxs = await prisma.creditTransaction.findMany({
    where: {
      type: { in: ['PAYMENT', 'PAYBACK'] }
    },
    select: {
      type: true,
      amount: true,
      paymentMethod: true,
    }
  });

  let creditCashInflow = 0;
  let creditCashOutflow = 0;
  let creditOnlineInflow = 0;
  let creditOnlineOutflow = 0;

  for (const tx of creditTxs) {
    const isOnline = ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(tx.paymentMethod?.toUpperCase());
    const amt = Number(tx.amount || 0);
    if (tx.type === 'PAYMENT') {
      if (isOnline) {
        creditOnlineInflow += amt;
      } else {
        creditCashInflow += amt;
      }
    } else if (tx.type === 'PAYBACK') {
      if (isOnline) {
        creditOnlineOutflow += amt;
      } else {
        creditCashOutflow += amt;
      }
    }
  }

  // 3. Query Custom Cash transactions
  const cashTxs = await prisma.cashTransaction.findMany({
    select: {
      type: true,
      amount: true,
      paymentMethod: true,
    }
  });

  let manualInflow = 0;
  let manualBankInflow = 0;
  let manualOutflow = 0; // EXPENSE, PARTY_PAYMENT, LIABILITY, GOODS_PURCHASE, TRANSPORT
  let manualBankOutflow = 0;
  let bankTransfers = 0;

  for (const tx of cashTxs) {
    const amt = Number(tx.amount || 0);
    const isBank = tx.paymentMethod?.toUpperCase() === 'BANK';

    if (tx.type === 'INFLOW') {
      if (isBank) {
        manualBankInflow += amt;
      } else {
        manualInflow += amt;
      }
    } else if (tx.type === 'BANK_TRANSFER') {
      bankTransfers += amt;
    } else {
      // EXPENSE, PARTY_PAYMENT, LIABILITY, GOODS_PURCHASE, TRANSPORT
      if (isBank) {
        manualBankOutflow += amt;
      } else {
        manualOutflow += amt;
      }
    }
  }

  const cashInHand = posCashInflow + creditCashInflow - creditCashOutflow + manualInflow - manualOutflow - bankTransfers;
  const bankBalance = posOnlineInflow + creditOnlineInflow - creditOnlineOutflow + bankTransfers + manualBankInflow - manualBankOutflow;
  const totalOut = creditCashOutflow + manualOutflow + manualBankOutflow;
  const totalBankTransferred = bankTransfers;

  return {
    cashInHand,
    bankBalance,
    totalInflows: posCashInflow + creditCashInflow + manualInflow + manualBankInflow,
    totalOutflows: totalOut,
    totalBankTransferred,
  };
};

// GET /api/cash/summary
export const getCashSummary = async (req, res, next) => {
  try {
    const balances = await getBalances();
    res.json({
      success: true,
      data: balances,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/cash/ledger
export const getCashLedger = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Fetch POS Cash Inflows
    const bills = await prisma.bill.findMany({
      where: {
        isVoid: false,
        amountPaid: { gt: 0 },
        paymentMethod: { in: ['CASH', 'CREDIT'] }
      },
      include: {
        customer: { select: { name: true } }
      }
    });

    const billItems = bills.map(b => ({
      id: `bill-${b.id}`,
      date: b.billDate,
      type: 'SALE',
      category: 'Inflow',
      amount: b.amountPaid,
      description: `POS Sale - Bill #${b.billNo}${b.customer ? ` (Customer: ${b.customer.name})` : ''}`,
      details: { billNo: b.billNo }
    }));

    // Fetch credit recoveries/refunds
    const creditTxs = await prisma.creditTransaction.findMany({
      where: {
        type: { in: ['PAYMENT', 'PAYBACK'] }
      },
      include: {
        customer: { select: { name: true } },
        bill: { select: { billNo: true } }
      }
    });

    const cashCreditTxs = creditTxs.filter(tx => {
      const isOnline = ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'].includes(tx.paymentMethod?.toUpperCase());
      return !isOnline;
    });

    const creditItems = cashCreditTxs.map(tx => {
      if (tx.type === 'PAYMENT') {
        return {
          id: `credit-${tx.id}`,
          date: tx.transactionDate,
          type: 'RECOVERY',
          category: 'Inflow',
          amount: tx.amount,
          description: `Udhar Recovery - Customer: ${tx.customer?.name}${tx.bill ? ` (Bill: ${tx.bill.billNo})` : ''}`,
          details: { description: tx.description }
        };
      } else {
        return {
          id: `credit-${tx.id}`,
          date: tx.transactionDate,
          type: 'REFUND',
          category: 'Outflow',
          amount: tx.amount,
          description: `Advance Refund - Customer: ${tx.customer?.name}`,
          details: { description: tx.description }
        };
      }
    });

    // Custom cash transactions
    const cashTxs = await prisma.cashTransaction.findMany({});

    const cashItems = cashTxs.map(tx => {
      let category = 'Outflow';
      if (tx.type === 'INFLOW') {
        category = 'Inflow';
      }

      let desc = tx.description || '';
      const methodLabel = tx.paymentMethod?.toUpperCase() === 'BANK' ? ' (Paid from Bank)' : '';

      if (tx.type === 'BANK_TRANSFER') {
        desc = `Transfer to Bank: ${tx.description || 'Deposit'}`;
      } else if (tx.type === 'PARTY_PAYMENT') {
        desc = `Party Payment to ${tx.partyName}${methodLabel}${tx.description ? ` - ${tx.description}` : ''}`;
      } else if (tx.type === 'LIABILITY') {
        desc = `Liability Payment: ${tx.liabilityName} (Remaining Balance: PKR ${tx.remainingBalance || 0})${methodLabel}${tx.description ? ` - ${tx.description}` : ''}`;
      } else if (tx.type === 'GOODS_PURCHASE') {
        desc = `Purchase of Goods: ${tx.itemName} x ${tx.quantity} @ PKR ${tx.unitPrice}${methodLabel}${tx.description ? ` - ${tx.description}` : ''}`;
      } else if (tx.type === 'TRANSPORT') {
        desc = `Transport / Bilty: ${tx.description || 'Transport Charges'}${methodLabel}`;
      } else if (tx.type === 'EXPENSE') {
        desc = `Expense: ${tx.description || 'General Outflow'}${methodLabel}`;
      } else if (tx.type === 'INFLOW') {
        desc = `Manual Inflow: ${tx.description || 'General Inflow'}${tx.paymentMethod?.toUpperCase() === 'BANK' ? ' (Deposited to Bank)' : ''}`;
      }

      return {
        id: `cash-${tx.id}`,
        date: tx.date,
        type: tx.type,
        category,
        amount: tx.amount,
        description: desc,
        details: {
          partyName: tx.partyName,
          liabilityName: tx.liabilityName,
          remainingBalance: tx.remainingBalance,
          itemName: tx.itemName,
          quantity: tx.quantity,
          unitPrice: tx.unitPrice,
          paymentMethod: tx.paymentMethod
        }
      };
    });

    // Combine
    let combinedLedger = [...billItems, ...creditItems, ...cashItems];

    // Filter by search if provided
    if (search) {
      const q = search.toLowerCase();
      combinedLedger = combinedLedger.filter(item => 
        item.description.toLowerCase().includes(q) || 
        item.type.toLowerCase().includes(q)
      );
    }

    // Sort chronologically descending
    combinedLedger.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Paginate
    const total = combinedLedger.length;
    const paginatedItems = combinedLedger.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      data: paginatedItems,
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

// GET /api/cash/transactions
export const getCashTransactions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.cashTransaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { date: 'desc' }
      }),
      prisma.cashTransaction.count({ where })
    ]);

    res.json({
      success: true,
      data: transactions,
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

// POST /api/cash/transactions
export const createCashTransaction = async (req, res, next) => {
  try {
    const {
      type,
      amount,
      date,
      description,
      partyName,
      liabilityName,
      remainingBalance,
      itemName,
      quantity,
      unitPrice,
      paymentMethod = 'CASH'
    } = req.body;

    // Validate type
    const validTypes = ['INFLOW', 'EXPENSE', 'BANK_TRANSFER', 'PARTY_PAYMENT', 'LIABILITY', 'GOODS_PURCHASE', 'TRANSPORT'];
    if (!type || !validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid transaction type. Allowed: ${validTypes.join(', ')}`
      });
    }

    const activeType = type.toUpperCase();

    // Validate amount
    const amt = Number(amount);
    if (activeType !== 'GOODS_PURCHASE' && (isNaN(amt) || amt <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number.'
      });
    }

    // Check balance if it is an outflow to prevent overdraft
    const pm = paymentMethod?.toUpperCase() === 'BANK' ? 'BANK' : 'CASH';

    if (activeType !== 'INFLOW') {
      const { cashInHand, bankBalance } = await getBalances();
      const neededAmt = activeType === 'GOODS_PURCHASE' ? (Number(quantity || 0) * Number(unitPrice || 0)) : amt;

      if (pm === 'CASH' && neededAmt > cashInHand) {
        return res.status(400).json({
          success: false,
          message: `Insufficient cash in hand. Available cash is PKR ${cashInHand.toFixed(2)}, but requested PKR ${neededAmt.toFixed(2)}.`
        });
      } else if (pm === 'BANK' && neededAmt > bankBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient bank balance. Available balance is PKR ${bankBalance.toFixed(2)}, but requested PKR ${neededAmt.toFixed(2)}.`
        });
      }
    }

    // Specific validation based on type
    const txData = {
      type: activeType,
      amount: amt,
      date: date ? new Date(date) : new Date(),
      description: description || null,
      paymentMethod: pm
    };

    if (activeType === 'PARTY_PAYMENT') {
      if (!partyName || partyName.trim() === '') {
        return res.status(400).json({ success: false, message: 'Party name is required for party payments.' });
      }
      txData.partyName = partyName.trim();
    } else if (activeType === 'LIABILITY') {
      if (!liabilityName || liabilityName.trim() === '') {
        return res.status(400).json({ success: false, message: 'Liability name is required for liability payments.' });
      }
      txData.liabilityName = liabilityName.trim();
      txData.remainingBalance = remainingBalance !== undefined ? Number(remainingBalance) : 0;
    } else if (activeType === 'GOODS_PURCHASE') {
      if (!itemName || itemName.trim() === '') {
        return res.status(400).json({ success: false, message: 'Item name is required for goods purchases.' });
      }
      if (!quantity || Number(quantity) <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be a positive number.' });
      }
      if (!unitPrice || Number(unitPrice) <= 0) {
        return res.status(400).json({ success: false, message: 'Unit price must be a positive number.' });
      }
      txData.itemName = itemName.trim();
      txData.quantity = Number(quantity);
      txData.unitPrice = Number(unitPrice);
      txData.amount = Number(quantity) * Number(unitPrice);
    }

    const transaction = await prisma.cashTransaction.create({
      data: txData
    });

    res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully.',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};
