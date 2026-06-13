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
