export type PermissionSet = Record<string, { view: boolean; manage: boolean }>;
export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  role_label: string;
  permissions: PermissionSet | { all: true };
};
export function hasAccess(
  session: SessionUser | null,
  module: string,
  action: "view" | "manage" = "view",
) {
  if (!session) return false;
  if (session.role === "superadmin" || "all" in session.permissions)
    return true;
  return Boolean((session.permissions as PermissionSet)[module]?.[action]);
}
export function roleLabel(session: SessionUser | null) {
  return (
    session?.role_label ||
    (session?.role === "superadmin" ? "Superadmin" : "Supervisor")
  );
}
