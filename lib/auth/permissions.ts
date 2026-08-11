export type Role =
  | "ADMIN"
  | "COMMERCIAL"
  | "VIEWER";

export const permissions = {
  dashboard: {
    view: [
      "ADMIN",
      "COMMERCIAL",
      "VIEWER",
    ],
  },

  inventory: {
    view: [
      "ADMIN",
      "COMMERCIAL",
      "VIEWER",
    ],
    create: [
      "ADMIN",
      "COMMERCIAL",
    ],
    update: [
      "ADMIN",
      "COMMERCIAL",
    ],
    stockEntry: [
      "ADMIN",
      "COMMERCIAL",
    ],
    delete: ["ADMIN"],
  },

  projects: {
    view: [
      "ADMIN",
      "COMMERCIAL",
      "VIEWER",
    ],
    create: [
      "ADMIN",
      "COMMERCIAL",
    ],
    update: [
      "ADMIN",
      "COMMERCIAL",
    ],
    delete: [
      "ADMIN",
      "COMMERCIAL",
    ],
  },

  purchases: {
    view: [
      "ADMIN",
      "COMMERCIAL",
    ],
    update: [
      "ADMIN",
      "COMMERCIAL",
    ],
  },

  reports: {
    view: [
      "ADMIN",
      "COMMERCIAL",
      "VIEWER",
    ],
    export: [
      "ADMIN",
      "COMMERCIAL",
      "VIEWER",
    ],
  },

  users: {
    view: ["ADMIN"],
    create: ["ADMIN"],
    update: ["ADMIN"],
    delete: ["ADMIN"],
    changeAnyPassword: ["ADMIN"],
  },

  account: {
    view: [
      "ADMIN",
      "COMMERCIAL",
      "VIEWER",
    ],
    changeOwnPassword: [
      "ADMIN",
      "COMMERCIAL",
      "VIEWER",
    ],
  },
} as const satisfies Record<
  string,
  Record<string, readonly Role[]>
>;

export function hasPermission(
  role: Role,
  allowedRoles: readonly Role[],
): boolean {
  return allowedRoles.includes(role);
}

export function isAdmin(
  role: Role,
): boolean {
  return role === "ADMIN";
}