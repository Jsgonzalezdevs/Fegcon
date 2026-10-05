import { count, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { internalUsers } from "@/db/schema";

export type Role = "administrador" | "auxiliar" | "cartera" | "creditos" | "consulta";

export async function requireRole(allowed: Role[]) {
  const identity = await getChatGPTUser();
  if (!identity) return { error: Response.json({ error: "Sesión requerida." }, { status: 401 }) };
  const db = getDb();
  let [user] = await db.select().from(internalUsers).where(eq(internalUsers.authUserId, identity.userId)).limit(1);
  if (!user) {
    const [{ total }] = await db.select({ total: count() }).from(internalUsers);
    const role: Role = total === 0 ? "administrador" : "consulta";
    [user] = await db.insert(internalUsers).values({ authUserId: identity.userId, email: identity.email, fullName: identity.displayName, role }).returning();
  }
  if (!user.active || !allowed.includes(user.role)) return { error: Response.json({ error: "No tiene permiso para esta acción." }, { status: 403 }) };
  return { db, user };
}
