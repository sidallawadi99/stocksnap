import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products  -> the full catalogue (used to populate dropdowns).
export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ products });
}
