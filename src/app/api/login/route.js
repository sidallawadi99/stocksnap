import { NextResponse } from "next/server";
import { authenticate, encodeSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request) {
  const { username, password } = await request.json();
  const session = await authenticate((username || "").trim(), (password || "").trim());
  if (!session) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }
  const res = NextResponse.json({ role: session.role });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
