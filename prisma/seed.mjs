// Seed script: a realistic ~50-SKU kirana catalogue.
//
//  - supply: "local_vendor" = arrives daily on handwritten slips (12 SKUs).
//  - supply: "distributor"  = bought via formal invoices/POs (38 SKUs).
//
// Perishable (local-vendor) items also get a shelf life and a few seeded
// "batches" so the dashboard can show how many units expire today.
//
// Run with:  npm run seed
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

// ─── 12 LOCAL-VENDOR SKUs (the handwritten-slip subset) ──────────────────────
const localVendor = [
  { name: "Toned Milk 500ml",        brand: "Mother Dairy", category: "Dairy",  unit: "packet", unitsPerCrate: 30, stock: 18, shelfLifeDays: 2,  aliases: "toned milk,toned,tm,tonned milk,blue milk,doodh" },
  { name: "Full Cream Milk 500ml",   brand: "Amul",         category: "Dairy",  unit: "packet", unitsPerCrate: 30, stock: 10, shelfLifeDays: 2,  aliases: "full cream,fc milk,malai milk,gold milk" },
  { name: "Double Toned Milk 500ml", brand: "Mother Dairy", category: "Dairy",  unit: "packet", unitsPerCrate: 30, stock: 6,  shelfLifeDays: 2,  aliases: "double toned,dt milk,green milk" },
  { name: "Cow Milk 500ml",          brand: "Amul",         category: "Dairy",  unit: "packet", unitsPerCrate: 30, stock: 8,  shelfLifeDays: 2,  aliases: "cow milk,gaay milk,desi milk" },
  { name: "Buffalo Milk 500ml",      brand: "Local",        category: "Dairy",  unit: "packet", unitsPerCrate: 30, stock: 5,  shelfLifeDays: 2,  aliases: "buffalo milk,bhains milk,bhains ka doodh" },
  { name: "Curd 400g",               brand: "Mother Dairy", category: "Dairy",  unit: "cup",    unitsPerCrate: 12, stock: 9,  shelfLifeDays: 4,  aliases: "curd,dahi,yogurt" },
  { name: "Paneer 200g",             brand: "Amul",         category: "Dairy",  unit: "packet", unitsPerCrate: 20, stock: 5,  shelfLifeDays: 5,  aliases: "paneer,cottage cheese" },
  { name: "Buttermilk 200ml",        brand: "Amul",         category: "Dairy",  unit: "packet", unitsPerCrate: 30, stock: 12, shelfLifeDays: 3,  aliases: "buttermilk,chaas,chhach,mattha" },
  { name: "White Bread 400g",        brand: "Britannia",    category: "Bakery", unit: "loaf",   unitsPerCrate: 1,  stock: 7,  shelfLifeDays: 4,  aliases: "white bread,bread,safed bread,milk bread,double roti" },
  { name: "Brown Bread 400g",        brand: "Harvest Gold", category: "Bakery", unit: "loaf",   unitsPerCrate: 1,  stock: 4,  shelfLifeDays: 4,  aliases: "brown bread,brown,wheat bread,atta bread" },
  { name: "Pav Bun (pack of 6)",     brand: "Local",        category: "Bakery", unit: "pack",   unitsPerCrate: 1,  stock: 5,  shelfLifeDays: 3,  aliases: "pav,buns,ladi pav,bun" },
  { name: "Eggs (tray of 30)",       brand: "Local",        category: "Eggs",   unit: "tray",   unitsPerCrate: 6,  stock: 6,  shelfLifeDays: 21, aliases: "eggs,anda,egg tray,ande,egg" },
];

// ─── 38 DISTRIBUTOR SKUs (formal inventory) ──────────────────────────────────
// (A couple are intentionally low to show the low-stock signal works here too.)
const distributor = [
  { name: "Basmati Rice 5kg",          brand: "India Gate",   category: "Staples",   unit: "bag",    stock: 12 },
  { name: "Sona Masoori Rice 10kg",    brand: "Daawat",       category: "Staples",   unit: "bag",    stock: 8 },
  { name: "Whole Wheat Atta 10kg",     brand: "Aashirvaad",   category: "Staples",   unit: "bag",    stock: 15 },
  { name: "Maida 1kg",                 brand: "Rajdhani",     category: "Staples",   unit: "packet", stock: 20 },
  { name: "Toor Dal 1kg",              brand: "Tata Sampann", category: "Staples",   unit: "packet", stock: 18 },
  { name: "Moong Dal 1kg",             brand: "Tata Sampann", category: "Staples",   unit: "packet", stock: 14 },
  { name: "Chana Dal 1kg",             brand: "Tata Sampann", category: "Staples",   unit: "packet", stock: 16 },
  { name: "Urad Dal 1kg",              brand: "Tata Sampann", category: "Staples",   unit: "packet", stock: 6 },
  { name: "Masoor Dal 1kg",            brand: "Tata Sampann", category: "Staples",   unit: "packet", stock: 9 },
  { name: "Sugar 1kg",                 brand: "Madhur",       category: "Staples",   unit: "packet", stock: 25 },
  { name: "Jaggery (Gur) 1kg",         brand: "Local",        category: "Staples",   unit: "packet", stock: 5 },
  { name: "Iodised Salt 1kg",          brand: "Tata",         category: "Staples",   unit: "packet", stock: 30 },
  { name: "Sunflower Oil 1L",          brand: "Fortune",      category: "Oils",      unit: "bottle", stock: 22 },
  { name: "Mustard Oil 1L",            brand: "Fortune",      category: "Oils",      unit: "bottle", stock: 13 },
  { name: "Cow Ghee 1L",               brand: "Amul",         category: "Oils",      unit: "jar",    stock: 4 },
  { name: "Turmeric Powder 200g",      brand: "Everest",      category: "Spices",    unit: "packet", stock: 17 },
  { name: "Red Chilli Powder 200g",    brand: "MDH",          category: "Spices",    unit: "packet", stock: 15 },
  { name: "Coriander Powder 200g",     brand: "Everest",      category: "Spices",    unit: "packet", stock: 12 },
  { name: "Cumin (Jeera) 100g",        brand: "Catch",        category: "Spices",    unit: "packet", stock: 11 },
  { name: "Garam Masala 100g",         brand: "Everest",      category: "Spices",    unit: "packet", stock: 14 },
  { name: "Tata Tea Premium 500g",     brand: "Tata Tea",     category: "Beverages", unit: "packet", stock: 19 },
  { name: "Nescafe Classic 100g",      brand: "Nescafe",      category: "Beverages", unit: "jar",    stock: 8 },
  { name: "Bournvita 500g",            brand: "Cadbury",      category: "Beverages", unit: "jar",    stock: 10 },
  { name: "Coca-Cola 750ml",           brand: "Coca-Cola",    category: "Beverages", unit: "bottle", stock: 24 },
  { name: "Real Mixed Fruit Juice 1L", brand: "Real",         category: "Beverages", unit: "carton", stock: 13 },
  { name: "Bisleri Water 1L",          brand: "Bisleri",      category: "Beverages", unit: "bottle", stock: 40 },
  { name: "Parle-G Biscuits 100g",     brand: "Parle",        category: "Snacks",    unit: "packet", stock: 35 },
  { name: "Marie Gold 200g",           brand: "Britannia",    category: "Snacks",    unit: "packet", stock: 22 },
  { name: "Maggi Noodles 70g",         brand: "Nestle",       category: "Snacks",    unit: "packet", stock: 50 },
  { name: "Aloo Bhujia 200g",          brand: "Haldiram",     category: "Snacks",    unit: "packet", stock: 18 },
  { name: "Lay's Classic 52g",         brand: "Lay's",        category: "Snacks",    unit: "packet", stock: 28 },
  { name: "Amul Butter 100g",          brand: "Amul",         category: "Snacks",    unit: "packet", stock: 16 },
  { name: "Colgate Toothpaste 100g",   brand: "Colgate",      category: "Personal Care", unit: "tube",   stock: 20 },
  { name: "Lux Soap 100g",             brand: "Lux",          category: "Personal Care", unit: "bar",    stock: 26 },
  { name: "Clinic Plus Shampoo 175ml", brand: "Clinic Plus",  category: "Personal Care", unit: "bottle", stock: 14 },
  { name: "Whisper Ultra Pads 7s",     brand: "Whisper",      category: "Personal Care", unit: "packet", stock: 12 },
  { name: "Surf Excel Detergent 1kg",  brand: "Surf Excel",   category: "Household", unit: "packet", stock: 17 },
  { name: "Vim Dishwash Bar 200g",     brand: "Vim",          category: "Household", unit: "bar",    stock: 30 },
];

async function main() {
  // Fresh catalogue each run (batches cascade-delete with their product).
  await prisma.product.deleteMany();

  const now = Date.now();
  for (const p of localVendor) {
    const prod = await prisma.product.create({ data: { ...p, supply: "local_vendor" } });

    // Split current stock into batches so some units expire today (a "fair
    // assumption": roughly one day's worth of an evenly-stocked item).
    const S = p.shelfLifeDays;
    const expiringToday = Math.min(prod.stock, Math.max(0, Math.round(prod.stock / S)));
    const fresh = prod.stock - expiringToday;

    if (expiringToday > 0) {
      await prisma.batch.create({
        data: { productId: prod.id, quantity: expiringToday, receivedAt: new Date(now - S * DAY), expiresAt: new Date(now) },
      });
    }
    if (fresh > 0) {
      await prisma.batch.create({
        data: { productId: prod.id, quantity: fresh, receivedAt: new Date(now - DAY), expiresAt: new Date(now + (S - 1) * DAY) },
      });
    }
  }

  for (const p of distributor) {
    await prisma.product.create({ data: { ...p, unitsPerCrate: 1, supply: "distributor" } });
  }

  const total = await prisma.product.count();
  const local = await prisma.product.count({ where: { supply: "local_vendor" } });
  const batches = await prisma.batch.count();
  console.log(`✅ Seed complete. ${total} products (${local} local-vendor, ${total - local} distributor), ${batches} batches.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
