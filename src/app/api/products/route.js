import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products            -> the full catalogue
// GET /api/products?supply=local_vendor -> just the daily-vendor subset (for the review dropdown)
export async function GET(request) {
  const supply = request.nextUrl.searchParams.get("supply");
  const where = supply ? { supply } : {};
  const products = await prisma.product.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json({ products });
}
