import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/inventory/products
export const getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      stockStatus,
      isActive,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    // Active filter (default: show active only)
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    } else {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = Number(categoryId);
    }

    if (stockStatus === 'low') {
      // Products where stockQty > 0 AND stockQty <= lowStockAlert
      where.stockQty = { gt: 0 };
      // We'll filter further after query since we need to compare two fields
    } else if (stockStatus === 'out') {
      where.stockQty = { lte: 0 };
    }

    let [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { name: 'asc' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Post-filter for 'low' stock (comparing two columns)
    if (stockStatus === 'low') {
      products = products.filter(
        (p) => Number(p.stockQty) <= Number(p.lowStockAlert) && Number(p.stockQty) > 0
      );
    }

    res.json({
      success: true,
      data: products,
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

// POST /api/inventory/products
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      sku,
      categoryId,
      purchasePrice,
      salePrice,
      stockQty = 0,
      unit = 'bags',
      lowStockAlert = 10,
      expiryDate,
      batchNo,
    } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        categoryId: Number(categoryId),
        purchasePrice: Number(purchasePrice),
        salePrice: Number(salePrice),
        stockQty: Number(stockQty),
        unit,
        lowStockAlert: Number(lowStockAlert),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        batchNo: batchNo || null,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/inventory/products/:id
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      sku,
      categoryId,
      purchasePrice,
      salePrice,
      stockQty,
      unit,
      lowStockAlert,
      expiryDate,
      batchNo,
    } = req.body;

    const existing = await prisma.product.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (sku !== undefined) updateData.sku = sku;
    if (categoryId !== undefined) updateData.categoryId = Number(categoryId);
    if (purchasePrice !== undefined) updateData.purchasePrice = Number(purchasePrice);
    if (salePrice !== undefined) updateData.salePrice = Number(salePrice);
    if (stockQty !== undefined) updateData.stockQty = Number(stockQty);
    if (unit !== undefined) updateData.unit = unit;
    if (lowStockAlert !== undefined) updateData.lowStockAlert = Number(lowStockAlert);
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (batchNo !== undefined) updateData.batchNo = batchNo || null;

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      message: 'Product updated successfully.',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/inventory/products/:id (soft delete)
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    await prisma.product.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Product deactivated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/inventory/low-stock
export const getLowStock = async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { stockQty: 'asc' },
    });

    const lowStockProducts = products.filter(
      (p) => Number(p.stockQty) <= Number(p.lowStockAlert)
    );

    res.json({
      success: true,
      data: lowStockProducts,
      count: lowStockProducts.length,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/inventory/expiring
export const getExpiring = async (req, res, next) => {
  try {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        expiryDate: {
          not: null,
          lte: thirtyDaysLater,
        },
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/inventory/categories
export const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/inventory/categories
export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const category = await prisma.category.create({
      data: { name, description: description || null },
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/inventory/categories/:id
export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const existing = await prisma.category.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: updateData,
    });

    res.json({
      success: true,
      message: 'Category updated successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/inventory/categories/:id
export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.category.findUnique({
      where: { id: Number(id) },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    if (existing._count.products > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${existing._count.products} product(s) associated.`,
      });
    }

    await prisma.category.delete({ where: { id: Number(id) } });

    res.json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
