export type Role =
  | "ADMIN"
  | "BACKOFFICE"
  | "COMMERCIAL"
  | "VIEWER";

export const permissions = {
  dashboard: {
    view: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
      "VIEWER",
    ],
  },

  inventory: {
    view: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
      "VIEWER",
    ],

    create: [
      "ADMIN",
      "BACKOFFICE",
    ],

    update: [
      "ADMIN",
      "BACKOFFICE",
    ],

    stockEntry: [
      "ADMIN",
      "BACKOFFICE",
    ],

    delete: [
      "ADMIN",
      "BACKOFFICE",
    ],
  },

  projects: {
    view: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
      "VIEWER",
    ],

    create: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
    ],

    update: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
    ],

    delete: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
    ],
  },

  purchases: {
    view: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
    ],

    update: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
    ],
  },

  reports: {
    view: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
      "VIEWER",
    ],

    export: [
      "ADMIN",
      "BACKOFFICE",
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

  audit: {
    view: ["ADMIN"],
  },

  account: {
    view: [
      "ADMIN",
      "BACKOFFICE",
      "COMMERCIAL",
      "VIEWER",
    ],

    changeOwnPassword: [
      "ADMIN",
      "BACKOFFICE",
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

export function isBackoffice(
  role: Role,
): boolean {
  return role === "BACKOFFICE";
}

export function canManageOperations(
  role: Role,
): boolean {
  return (
    role === "ADMIN" ||
    role === "BACKOFFICE"
  );
}