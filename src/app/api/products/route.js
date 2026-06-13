import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/products[?supply=local_vendor] -> the signed-in store's catalogue.
export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ products: [] }, { status: 401 });
  }
  const supply = request.nextUrl.searchParams.get("supply");
  const where = { storeId: session.storeId, ...(supply ? { supply } : {}) };
  const products = await prisma.product.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json({ products });
}

// POST /api/products -> create a new product in the signed-in store's catalogue.
// Used by the "add as new product" flow for an unmatched delivery line.
export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  }

  // Don't create a duplicate name within the store — return the existing one.
  const existing = await prisma.product.findFirst({ where: { storeId: session.storeId, name } });
  if (existing) {
    return NextResponse.json({ product: existing });
  }

  const product = await prisma.product.create({
    data: {
      storeId: session.storeId,
      name,
      category: body.category?.trim() || "Other",
      unit: body.unit?.trim() || "packet",
      unitsPerCrate: Math.max(1, Math.round(Number(body.unitsPerCrate) || 1)),
      supply: "local_vendor", // added from a delivery slip
      shelfLifeDays: body.shelfLifeDays ? Math.round(Number(body.shelfLifeDays)) : null,
      stock: 0,
    },
  });
  return NextResponse.json({ product });
}
