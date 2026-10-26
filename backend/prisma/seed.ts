import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Galiyat Store POS database...');

  // Branch
  const branch = await prisma.branch.upsert({
    where: { code: 'GS-MAIN' },
    update: {},
    create: {
      code: 'GS-MAIN',
      name: 'Galiyat Store - Main Branch',
      address: 'Main Bazar, Galiyat',
      phone: '0300-0000000',
    },
  });
  console.log('✅ Branch created:', branch.name);

  // Permissions
  const permKeys = [
    'sales.create', 'sales.void', 'sales.view',
    'inventory.view', 'inventory.adjust', 'inventory.receive',
    'products.create', 'products.edit', 'products.delete',
    'reports.view', 'users.manage', 'settings.manage',
  ];

  for (const key of permKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  // Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Full system access' },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: { name: 'MANAGER', description: 'Store manager' },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: 'CASHIER' },
    update: {},
    create: { name: 'CASHIER', description: 'Cashier / billing counter' },
  });

  const inventoryRole = await prisma.role.upsert({
    where: { name: 'INVENTORY' },
    update: {},
    create: { name: 'INVENTORY', description: 'Inventory officer' },
  });

  // Assign all permissions to admin
  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: adminRole.id, permission_id: perm.id } },
      update: {},
      create: { role_id: adminRole.id, permission_id: perm.id },
    });
  }

  // Assign cashier permissions
  const cashierPermKeys = ['sales.create', 'sales.view'];
  for (const key of cashierPermKeys) {
    const perm = allPerms.find((p) => p.key === key)!;
    await prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: cashierRole.id, permission_id: perm.id } },
      update: {},
      create: { role_id: cashierRole.id, permission_id: perm.id },
    });
  }

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: adminPassword,
      full_name: 'Store Admin',
      phone: '0300-0000001',
      email: 'admin@galiyatstore.pk',
      branch_id: branch.id,
      roles: { create: { role_id: adminRole.id } },
    },
  });
  console.log('✅ Admin user created:', admin.username);

  // Manager user
  const managerPassword = await bcrypt.hash('manager123', 12);
  await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      username: 'manager',
      password_hash: managerPassword,
      full_name: 'Store Manager',
      phone: '0300-0000002',
      branch_id: branch.id,
      roles: { create: { role_id: managerRole.id } },
    },
  });

  // Cashier user
  const cashierPassword = await bcrypt.hash('cashier123', 12);
  await prisma.user.upsert({
    where: { username: 'cashier1' },
    update: {},
    create: {
      username: 'cashier1',
      password_hash: cashierPassword,
      full_name: 'Ahmed Ali',
      phone: '0300-0000003',
      branch_id: branch.id,
      roles: { create: { role_id: cashierRole.id } },
    },
  });
  console.log('✅ Users created: admin, manager, cashier1');

  // Units
  const units = [
    { code: 'PCS', name: 'Pieces', decimal_precision: 0 },
    { code: 'KG', name: 'Kilograms', decimal_precision: 3 },
    { code: 'G', name: 'Grams', decimal_precision: 0 },
    { code: 'L', name: 'Liters', decimal_precision: 2 },
    { code: 'ML', name: 'Milliliters', decimal_precision: 0 },
    { code: 'PKT', name: 'Packet', decimal_precision: 0 },
    { code: 'BOX', name: 'Box', decimal_precision: 0 },
    { code: 'DOZ', name: 'Dozen', decimal_precision: 0 },
  ];

  const unitMap: Record<string, string> = {};
  for (const unit of units) {
    const u = await prisma.unit.upsert({
      where: { id: `unit-${unit.code}` },
      update: {},
      create: { id: `unit-${unit.code}`, ...unit },
    });
    unitMap[unit.code] = u.id;
  }
  console.log('✅ Units created');

  // Categories
  const categories = [
    { name: 'Staples & Grains', children: ['Rice', 'Flour', 'Sugar', 'Salt', 'Lentils & Pulses'] },
    { name: 'Cooking Essentials', children: ['Cooking Oil & Ghee', 'Spices & Masala', 'Condiments & Sauces'] },
    { name: 'Beverages', children: ['Tea & Coffee', 'Soft Drinks', 'Juices & Drinks', 'Water'] },
    { name: 'Packaged Food', children: ['Biscuits & Snacks', 'Noodles & Pasta', 'Breakfast Cereals'] },
    { name: 'Dairy & Eggs', children: ['Milk', 'Yogurt & Dahi', 'Cheese & Butter', 'Eggs'] },
    { name: 'Frozen Foods', children: ['Frozen Chicken', 'Frozen Snacks', 'Ice Cream'] },
    { name: 'Household', children: ['Cleaning Products', 'Toiletries', 'Disposables'] },
  ];

  const catMap: Record<string, string> = {};
  for (const cat of categories) {
    const parent = await prisma.category.upsert({
      where: { id: `cat-${cat.name.replace(/\s+/g, '-').toLowerCase()}` },
      update: {},
      create: {
        id: `cat-${cat.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: cat.name,
        slug: cat.name.toLowerCase().replace(/\s+/g, '-'),
      },
    });
    catMap[cat.name] = parent.id;

    for (const child of cat.children) {
      const childCat = await prisma.category.upsert({
        where: { id: `cat-${child.replace(/\s+/g, '-').toLowerCase()}` },
        update: {},
        create: {
          id: `cat-${child.replace(/\s+/g, '-').toLowerCase()}`,
          name: child,
          slug: child.toLowerCase().replace(/\s+/g, '-'),
          parent_id: parent.id,
        },
      });
      catMap[child] = childCat.id;
    }
  }
  console.log('✅ Categories created');

  // Tax classes
  const taxClass = await prisma.taxClass.upsert({
    where: { id: 'tax-standard' },
    update: {},
    create: { id: 'tax-standard', name: 'Standard GST', rate_percent: 17.0 },
  });

  await prisma.taxClass.upsert({
    where: { id: 'tax-zero' },
    update: {},
    create: { id: 'tax-zero', name: 'Zero Rated', rate_percent: 0.0 },
  });
  console.log('✅ Tax classes created');

  // Sample products
  const sampleProducts = [
    { sku: 'RICE-001', barcode: '8901234560001', nameEn: 'Basmati Rice 5KG', cat: 'Rice', unit: 'PKT', storage: 'DRY', price: 1200, cost: 1000 },
    { sku: 'FLOUR-001', barcode: '8901234560002', nameEn: 'Wheat Flour 10KG', cat: 'Flour', unit: 'PKT', storage: 'DRY', price: 1400, cost: 1200 },
    { sku: 'SUGAR-001', barcode: '8901234560003', nameEn: 'Refined Sugar 1KG', cat: 'Sugar', unit: 'PKT', storage: 'DRY', price: 200, cost: 165 },
    { sku: 'OIL-001', barcode: '8901234560004', nameEn: 'Sunflower Oil 1L', cat: 'Cooking Oil & Ghee', unit: 'L', storage: 'DRY', price: 500, cost: 430 },
    { sku: 'TEA-001', barcode: '8901234560005', nameEn: 'Lipton Tea 200g', cat: 'Tea & Coffee', unit: 'PKT', storage: 'DRY', price: 550, cost: 470 },
    { sku: 'MILK-001', barcode: '8901234560006', nameEn: 'Olpers Milk 1L', cat: 'Milk', unit: 'L', storage: 'CHILLED', price: 165, cost: 140 },
    { sku: 'BISC-001', barcode: '8901234560007', nameEn: 'Oreo Biscuits 120g', cat: 'Biscuits & Snacks', unit: 'PKT', storage: 'DRY', price: 100, cost: 82 },
    { sku: 'CHKN-001', barcode: '8901234560008', nameEn: 'Frozen Chicken 1KG', cat: 'Frozen Chicken', unit: 'KG', storage: 'FROZEN', price: 700, cost: 580, expiry: true },
    { sku: 'COKE-001', barcode: '8901234560009', nameEn: 'Coca-Cola 1.5L', cat: 'Soft Drinks', unit: 'L', storage: 'DRY', price: 100, cost: 85 },
    { sku: 'SALT-001', barcode: '8901234560010', nameEn: 'Iodized Salt 1KG', cat: 'Salt', unit: 'PKT', storage: 'DRY', price: 55, cost: 42 },
  ];

  for (const p of sampleProducts) {
    const catId = catMap[p.cat];
    const unitId = unitMap[p.unit];
    if (!catId || !unitId) continue;

    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        barcode: p.barcode,
        name_en: p.nameEn,
        category_id: catId,
        unit_id: unitId,
        storage_type: p.storage,
        track_expiry: p.expiry || false,
        prices: {
          create: {
            branch_id: branch.id,
            retail_price: p.price,
            purchase_cost: p.cost,
            margin_amount: p.price - p.cost,
            price_version: 1,
            effective_from: new Date(),
          },
        },
      },
    });

    // Create inventory balance
    await prisma.inventoryBalance.upsert({
      where: { branch_id_product_id: { branch_id: branch.id, product_id: product.id } },
      update: {},
      create: {
        branch_id: branch.id,
        product_id: product.id,
        on_hand_qty: 50,
        reserved_qty: 0,
        available_qty: 50,
        reorder_level: 10,
        reorder_qty: 20,
      },
    });
  }
  console.log('✅ Sample products and inventory created');

  // Register
  await prisma.register.upsert({
    where: { id: 'reg-001' },
    update: {},
    create: {
      id: 'reg-001',
      branch_id: branch.id,
      code: 'REG-001',
      name: 'Counter 1',
    },
  });

  console.log('\n🎉 Galiyat Store POS database seeded successfully!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin   → username: admin    / password: admin123');
  console.log('   Manager → username: manager  / password: manager123');
  console.log('   Cashier → username: cashier1 / password: cashier123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
