// Seed script: fills the catalogue with realistic kirana-store products.
// Run it with:  npm run seed
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// `unitsPerCrate` lets the app turn "1 crate" into the right number of packets.
const products = [
  { name: "Toned Milk 500ml",        category: "Dairy",   unit: "packet", unitsPerCrate: 30, stock: 18, aliases: "toned milk,toned,tm,tonned milk,blue milk" },
  { name: "Full Cream Milk 500ml",   category: "Dairy",   unit: "packet", unitsPerCrate: 30, stock: 10, aliases: "full cream,fc milk,malai milk,gold milk" },
  { name: "Double Toned Milk 500ml", category: "Dairy",   unit: "packet", unitsPerCrate: 30, stock: 6,  aliases: "double toned,dt milk,green milk" },
  { name: "Cow Milk 500ml",          category: "Dairy",   unit: "packet", unitsPerCrate: 30, stock: 8,  aliases: "cow milk,gaay milk,desi milk" },
  { name: "Curd 400g",               category: "Dairy",   unit: "cup",    unitsPerCrate: 12, stock: 9,  aliases: "curd,dahi,yogurt" },
  { name: "Paneer 200g",             category: "Dairy",   unit: "packet", unitsPerCrate: 20, stock: 5,  aliases: "paneer,cottage cheese" },
  { name: "Butter 100g",             category: "Dairy",   unit: "packet", unitsPerCrate: 24, stock: 14, aliases: "butter,makkhan,amul butter" },
  { name: "White Bread 400g",        category: "Bakery",  unit: "loaf",   unitsPerCrate: 1,  stock: 7,  aliases: "white bread,bread,safed bread,milk bread" },
  { name: "Brown Bread 400g",        category: "Bakery",  unit: "loaf",   unitsPerCrate: 1,  stock: 4,  aliases: "brown bread,brown,wheat bread,atta bread" },
  { name: "Pav Bun (pack of 6)",     category: "Bakery",  unit: "pack",   unitsPerCrate: 1,  stock: 5,  aliases: "pav,buns,ladi pav,bun" },
  { name: "Eggs (tray of 30)",       category: "Poultry", unit: "tray",   unitsPerCrate: 1,  stock: 6,  aliases: "eggs,anda,egg tray,ande" },
];

async function main() {
  for (const p of products) {
    // "upsert" = update if it already exists, otherwise create it.
    // This makes the seed safe to run multiple times.
    await prisma.product.upsert({
      where: { name: p.name },
      update: { category: p.category, unit: p.unit, unitsPerCrate: p.unitsPerCrate, aliases: p.aliases },
      create: p,
    });
  }
  const count = await prisma.product.count();
  console.log(`✅ Seed complete. Catalogue now has ${count} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
