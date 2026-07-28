import { requireRole } from "@/lib/require-role";

export function requireAdmin() {
  return requireRole(["ADMIN"]);
}