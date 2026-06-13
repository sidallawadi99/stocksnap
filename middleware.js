import { NextResponse } from "next/server";

// Edge-safe decode of the (unsigned) base64 session cookie.
function decode(raw) {
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always-open paths: login API, logout, the WhatsApp webhook (Twilio), assets.
  if (
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/logout") ||
    pathname.startsWith("/api/whatsapp") ||
    pathname.startsWith("/uploads") ||
    pathname === "/jumbotail.png"
  ) {
    return NextResponse.next();
  }

  const raw = request.cookies.get("stocksnap_session")?.value;
  const session = raw ? decode(raw) : null;

  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL(session.role === "admin" ? "/admin" : "/", request.url));
    return NextResponse.next();
  }

  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  // Role-based routing: admins live on /admin, owners on /.
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === "/" && session.role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

// Run on everything except Next internals and the favicon.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
