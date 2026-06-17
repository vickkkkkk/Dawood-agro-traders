import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding admin user only...');
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
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
