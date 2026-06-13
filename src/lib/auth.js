import { cookies } from "next/headers";
import { prisma } from "./prisma";

// PROTOTYPE auth: plain-text passwords, a base64 (unsigned) session cookie.
// Production would hash passwords (bcrypt) and use signed/JWT sessions or OAuth.
export const SESSION_COOKIE = "stocksnap_session";
const ADMIN = { username: "admin", password: "admin" };

export function encodeSession(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}
export function decodeSession(raw) {
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString());
  } catch {
    return null;
  }
}

// Check credentials → a session object, or null.
export async function authenticate(username, password) {
  if (username === ADMIN.username && password === ADMIN.password) {
    return { role: "admin", username: "admin", name: "Admin" };
  }
  const store = await prisma.store.findUnique({ where: { username } });
  if (store && store.password === password) {
    return { role: "owner", storeId: store.id, username: store.username, name: store.name };
  }
  return null;
}

// Read the current session in a server component / route handler.
export async function getSession() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? decodeSession(raw) : null;
}
