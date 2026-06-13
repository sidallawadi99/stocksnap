import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// GET /api/logout → clear the session and go to the login page.
export async function GET(request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
