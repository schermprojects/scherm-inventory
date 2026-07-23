"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Settings,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";

const navigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Inventário",
    href: "/inventory",
    icon: Boxes,
  },
  {
    label: "Movimentações",
    href: "/movements",
    icon: ClipboardList,
  },
  {
    label: "Categorias",
    href: "/categories",
    icon: FolderTree,
  },
  {
    label: "Clientes",
    href: "/clients",
    icon: Users,
  },
  {
    label: "Localizações",
    href: "/locations",
    icon: MapPin,
  },
  {
    label: "Manutenções",
    href: "/maintenance",
    icon: Wrench,
  },
  {
    label: "Relatórios",
    href: "/reports",
    icon: ChartNoAxesCombined,
  },
  {
    label: "Usuários",
    href: "/users",
    icon: Warehouse,
  },
  {
    label: "Configurações",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 flex-col bg-[#2B2B2B] text-white lg:flex">
      <div className="flex h-24 items-center justify-center border-b border-white/10 px-4">
        <Image
          src="/logo/scherm-logo-clara.png"
          alt="Scherm"
          width={210}
          height={60}
          className="w-full max-w-[210px] h-auto object-contain"
          priority
        />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#F57B00] text-white"
                  : "text-zinc-300 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-zinc-200">
              Sistema online
            </span>
          </div>

          <p className="mt-1 text-xs text-zinc-500">
            Scherm Inventory
          </p>
        </div>
      </div>
    </aside>
  );
}