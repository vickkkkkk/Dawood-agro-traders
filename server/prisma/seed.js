import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // --- Seed Admin User ---
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dawoodagro.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@dawoodagro.com',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // --- Seed Categories ---
  const categoryNames = [
    { name: 'Fertilizers', description: 'Chemical and organic fertilizers for crops' },
    { name: 'Seeds', description: 'High quality agricultural seeds' },
    { name: 'Pesticides', description: 'Insecticides, herbicides, and fungicides' },
    { name: 'Animal Feed', description: 'Feed for cattle, poultry, and livestock' },
    { name: 'Farm Equipment', description: 'Tools and equipment for farming' },
    { name: 'General', description: 'General agricultural supplies' },
  ];

  const categories = {};
  for (const cat of categoryNames) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categories[cat.name] = created;
  }
  console.log(`✅ ${Object.keys(categories).length} categories created`);

  // --- Seed Products ---
  const products = [
    {
      name: 'DAP Fertilizer 50kg',
      sku: 'FRT-DAP-50',
      categoryId: categories['Fertilizers'].id,
      purchasePrice: 8500,
      salePrice: 9200,
      stockQty: 150,
      unit: 'bags',
      lowStockAlert: 20,
      batchNo: 'B2026-001',
    },
    {
      name: 'Urea Fertilizer 50kg',
      sku: 'FRT-UREA-50',
      categoryId: categories['Fertilizers'].id,
      purchasePrice: 3800,
      salePrice: 4200,
      stockQty: 200,
      unit: 'bags',
      lowStockAlert: 30,
      batchNo: 'B2026-002',
    },
    {
      name: 'SOP Potash 50kg',
      sku: 'FRT-SOP-50',
      categoryId: categories['Fertilizers'].id,
      purchasePrice: 7200,
      salePrice: 7800,
      stockQty: 80,
      unit: 'bags',
      lowStockAlert: 15,
    },
    {
      name: 'Wheat Seed Galaxy',
      sku: 'SED-WHT-GAL',
      categoryId: categories['Seeds'].id,
      purchasePrice: 4500,
      salePrice: 5000,
      stockQty: 100,
      unit: 'bags',
      lowStockAlert: 15,
      batchNo: 'SW-2026',
    },
    {
      name: 'Cotton Seed FH-142',
      sku: 'SED-CTN-142',
      categoryId: categories['Seeds'].id,
      purchasePrice: 3200,
      salePrice: 3600,
      stockQty: 60,
      unit: 'bags',
      lowStockAlert: 10,
    },
    {
      name: 'Rice Seed Super Basmati',
      sku: 'SED-RIC-SB',
      categoryId: categories['Seeds'].id,
      purchasePrice: 5500,
      salePrice: 6200,
      stockQty: 45,
      unit: 'bags',
      lowStockAlert: 10,
    },
    {
      name: 'Confidor Insecticide 250ml',
      sku: 'PST-CNF-250',
      categoryId: categories['Pesticides'].id,
      purchasePrice: 1800,
      salePrice: 2100,
      stockQty: 35,
      unit: 'bags',
      lowStockAlert: 10,
      expiryDate: new Date('2027-06-30'),
    },
    {
      name: 'Cattle Feed Premium 40kg',
      sku: 'AFD-CTL-40',
      categoryId: categories['Animal Feed'].id,
      purchasePrice: 2800,
      salePrice: 3200,
      stockQty: 120,
      unit: 'bags',
      lowStockAlert: 20,
    },
    {
      name: 'Poultry Feed Starter 25kg',
      sku: 'AFD-PLT-25',
      categoryId: categories['Animal Feed'].id,
      purchasePrice: 2200,
      salePrice: 2500,
      stockQty: 5,
      unit: 'bags',
      lowStockAlert: 15,
    },
    {
      name: 'Spray Pump Manual 16L',
      sku: 'EQP-SPR-16',
      categoryId: categories['Farm Equipment'].id,
      purchasePrice: 3500,
      salePrice: 4200,
      stockQty: 12,
      unit: 'bags',
      lowStockAlert: 5,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }
  console.log(`✅ ${products.length} products created`);

  // --- Seed Suppliers ---
  const suppliers = [
    {
      name: 'Engro Fertilizers',
      phone: '0300-1234567',
      address: 'Engro Chemical Complex, Daharki, Sindh',
      company: 'Engro Corporation',
    },
    {
      name: 'FFC Limited',
      phone: '0321-9876543',
      address: 'FFC Building, Rawalpindi',
      company: 'Fauji Fertilizer Company',
    },
    {
      name: 'Ali Akbar Group',
      phone: '0333-5551234',
      address: 'Industrial Area, Multan',
      company: 'Ali Akbar Enterprises',
    },
  ];

  for (const supplier of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { name: supplier.name } });
    if (!existing) {
      await prisma.supplier.create({ data: supplier });
    }
  }
  console.log(`✅ ${suppliers.length} suppliers created`);

  // --- Seed Customers ---
  const customers = [
    {
      name: 'Muhammad Aslam',
      phone: '0301-1112233',
      address: 'Village Chak No. 45, Sahiwal',
      creditBalance: 15000,
    },
    {
      name: 'Haji Karim Bakhsh',
      phone: '0312-4445566',
      address: 'Mouza Basti Malook, Lodhran',
      creditBalance: 42000,
    },
    {
      name: 'Ghulam Mustafa',
      phone: '0345-7778899',
      address: 'Chak No. 119/WB, Vehari',
      creditBalance: 0,
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { phone: customer.phone },
      update: {},
      create: customer,
    });
  }
  console.log(`✅ ${customers.length} customers created`);

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
