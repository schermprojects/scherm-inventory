import {
  BarChart3,
  Boxes,
  Building2,
  FolderKanban,
  LayoutDashboard,
  ShoppingCart,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/auth/permissions";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: readonly Role[];
};

export const navigationItems: readonly NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "COMMERCIAL", "VIEWER"],
  },
  {
    label: "Inventário",
    href: "/inventory",
    icon: Boxes,
    roles: ["ADMIN", "COMMERCIAL", "VIEWER"],
  },
  {
    label: "Projetos",
    href: "/projects",
    icon: FolderKanban,
    roles: ["ADMIN", "COMMERCIAL"],
  },
  {
  label: "Clientes",
  href: "/clients",
  icon: Building2,
  roles: ["ADMIN", "COMMERCIAL", "VIEWER"],
},
  {
    label: "Compras",
    href: "/purchases",
    icon: ShoppingCart,
    roles: ["ADMIN", "COMMERCIAL"],
  },
  {
    label: "Relatórios",
    href: "/reports",
    icon: BarChart3,
    roles: ["ADMIN", "COMMERCIAL", "VIEWER"],
  },
  {
    label: "Usuários",
    href: "/users",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    label: "Minha conta",
    href: "/account",
    icon: UserRound,
    roles: ["ADMIN", "COMMERCIAL", "VIEWER"],
  },
] as const;

export function getNavigationForRole(
  role: Role,
): NavigationItem[] {
  return navigationItems.filter((item) =>
    item.roles.includes(role),
  );
} 