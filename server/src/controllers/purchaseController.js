import { PrismaClient } from '@prisma/client';
import { getBalances } from './cashController.js';

const prisma = new PrismaClient();

/**
 * Generate GRN number: GRN-YYYYMMDD-XXXX
 */
async function generateGrnNo() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `GRN-${dateStr}-`;

  const lastPurchase = await prisma.purchase.findFirst({
    where: { grnNo: { startsWith: prefix } },
    orderBy: { grnNo: 'desc' },
  });

  let sequence = 1;
  if (lastPurchase) {
    const lastSeq = parseInt(lastPurchase.grnNo.split('-').pop(), 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

// GET /api/purchases
export const getPurchases = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      supplierId,
      status,
      search,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.purchaseDate.lte = end;
      }
    }

    if (supplierId) {
      where.supplierId = Number(supplierId);
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.grnNo = { contains: search };
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, company: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
          liability: {
            select: { id: true, status: true, remainingBalance: true }
          }
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    res.json({
      success: true,
      data: purchases,
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

// POST /api/purchases
export const createPurchase = async (req, res, next) => {
  try {
    const {
      supplierId,
      items,
      status = 'RECEIVED',
      purchaseOrderRef,
      paymentMethod = 'CASH',
      biltyNo,
      transporterName,
      transportCost = 0,
      biltyDate,
      transportPaymentMethod,
      dueDate
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required.',
      });
    }

    const goodsPm = paymentMethod.toUpperCase();
    const transPm = transportPaymentMethod?.toUpperCase();
    const tCost = Number(transportCost || 0);

    // Calculate Goods Purchase Total
    let purchaseTotal = 0;
    for (const item of items) {
      purchaseTotal += Number(item.unitPrice) * Number(item.quantity);
    }
    const grandTotal = purchaseTotal + tCost;

    // Check overdraft limits
    let cashNeeded = 0;
    let bankNeeded = 0;

    if (goodsPm === 'CASH') {
      cashNeeded += purchaseTotal;
    } else if (goodsPm === 'BANK') {
      bankNeeded += purchaseTotal;
    }

    if (tCost > 0) {
      if (transPm === 'CASH') {
        cashNeeded += tCost;
      } else if (transPm === 'BANK') {
        bankNeeded += tCost;
      }
    }

    if (cashNeeded > 0 || bankNeeded > 0) {
      const { cashInHand, bankBalance } = await getBalances();
      if (cashNeeded > cashInHand) {
        return res.status(400).json({
          success: false,
          message: `Insufficient cash in hand. Required: PKR ${cashNeeded.toFixed(2)}, Available: PKR ${cashInHand.toFixed(2)}.`
        });
      }
      if (bankNeeded > bankBalance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient bank balance. Required: PKR ${bankNeeded.toFixed(2)}, Available: PKR ${bankBalance.toFixed(2)}.`
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const purchaseItems = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw Object.assign(new Error(`Product with ID ${item.productId} not found.`), { statusCode: 404 });
        }

        const unitPrice = Number(item.unitPrice);
        const salePrice = Number(item.salePrice || 0);
        const quantity = Number(item.quantity);
        const itemTotal = unitPrice * quantity;

        purchaseItems.push({
          productId: item.productId,
          quantity,
          unitPrice,
          salePrice,
          total: itemTotal,
          batchNo: item.batchNo || null,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        });

        // Update product stock & prices if status is RECEIVED
        if (status === 'RECEIVED') {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQty: { increment: quantity },
              purchasePrice: unitPrice,
              salePrice: salePrice > 0 ? salePrice : product.salePrice, // Track margin dynamically
              ...(item.batchNo && { batchNo: item.batchNo }),
              ...(item.expiryDate && { expiryDate: new Date(item.expiryDate) }),
            },
          });
        }
      }

      const grnNo = await generateGrnNo();

      // Create Purchase Record
      const purchase = await tx.purchase.create({
        data: {
          grnNo,
          supplierId: Number(supplierId),
          userId: req.user.id,
          total: purchaseTotal,
          grandTotal,
          status,
          purchaseDate: new Date(),
          purchaseOrderRef: purchaseOrderRef || null,
          paymentMethod: goodsPm,
          biltyNo: biltyNo || null,
          transporterName: transporterName || null,
          transportCost: tCost,
          biltyDate: biltyDate ? new Date(biltyDate) : null,
          transportPaymentMethod: transPm || null,
          items: {
            create: purchaseItems,
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          supplier: true,
        },
      });

      // Synchronize Cash Management
      // A. Goods Outflow
      if (goodsPm === 'CASH' || goodsPm === 'BANK') {
        await tx.cashTransaction.create({
          data: {
            type: 'GOODS_PURCHASE',
            amount: purchaseTotal,
            paymentMethod: goodsPm,
            description: `Goods Purchase: GRN #${grnNo} (${purchase.supplier?.name})`
          }
        });
      }

      // B. Transport Outflow
      if (tCost > 0 && (transPm === 'CASH' || transPm === 'BANK')) {
        await tx.cashTransaction.create({
          data: {
            type: 'TRANSPORT',
            amount: tCost,
            paymentMethod: transPm,
            description: `Transport Cost: GRN #${grnNo} (${transporterName || 'Unspecified'})`
          }
        });
      }

      // C. Supplier Liability Settle
      let liabilityAmount = 0;
      if (goodsPm === 'LIABILITY') {
        liabilityAmount += purchaseTotal;
      }
      if (tCost > 0 && transPm === 'LIABILITY') {
        liabilityAmount += tCost;
      }

      if (liabilityAmount > 0) {
        await tx.liability.create({
          data: {
            grnNo,
            purchaseId: purchase.id,
            supplierId: Number(supplierId),
            totalAmount: liabilityAmount,
            remainingBalance: liabilityAmount,
            status: 'UNPAID',
            dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
      }

      return purchase;
    });

    res.status(201).json({
      success: true,
      message: 'Purchase recorded successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/purchases/:id
export const getPurchaseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const purchase = await prisma.purchase.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
        supplier: true,
      },
    });

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found.' });
    }

    res.json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/purchases/suppliers
export const getSuppliers = async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { company: { contains: search } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { purchases: true } },
      },
    });

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/purchases/suppliers
export const createSupplier = async (req, res, next) => {
  try {
    const { name, phone, address, company } = req.body;

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: phone || null,
        address: address || null,
        company: company || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully.',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/purchases/suppliers/:id
export const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, address, company } = req.body;

    const existing = await prisma.supplier.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (company !== undefined) updateData.company = company;

    const supplier = await prisma.supplier.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully.',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};
