"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type { Role } from "@/lib/auth/permissions";

import { getNavigationForRole } from "./navigation";

type SidebarProps = {
  role: Role;
};

const SIDEBAR_PINNED_KEY =
  "schermix-sidebar-pinned";

export function Sidebar({
  role,
}: SidebarProps) {
  const pathname = usePathname();

  const [isPinned, setIsPinned] =
    useState(false);

  const [isHovered, setIsHovered] =
    useState(false);

  const [hasLoadedPreference, setHasLoadedPreference] =
    useState(false);

  const navigation =
    getNavigationForRole(role);

  const isExpanded =
    isPinned || isHovered;

  useEffect(() => {
    const savedPreference =
      window.localStorage.getItem(
        SIDEBAR_PINNED_KEY,
      );

    setIsPinned(
      savedPreference === "true",
    );

    setHasLoadedPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPreference) {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_PINNED_KEY,
      String(isPinned),
    );
  }, [
    isPinned,
    hasLoadedPreference,
  ]);

  function handleTogglePin() {
    setIsPinned(
      (current) => !current,
    );
  }

return (
  <div
    className={[
      "relative hidden min-h-screen shrink-0 lg:block",
      isPinned ? "w-72" : "w-20",
    ].join(" ")}
  >
    <aside
      onMouseEnter={() =>
        setIsHovered(true)
      }
      onMouseLeave={() =>
        setIsHovered(false)
      }
      className={[
        "absolute inset-y-0 left-0 z-40 flex min-h-screen flex-col bg-[#2B2B2B] text-white shadow-xl transition-[width] duration-300",
        isExpanded ? "w-72" : "w-20",
      ].join(" ")}
    >
      <div
        className={[
          "relative flex h-24 items-center border-b border-white/10",
          isExpanded
            ? "justify-center px-4"
            : "justify-center px-2",
        ].join(" ")}
      >
        <Image
          src={
            isExpanded
              ? "/logo/Logo3.png"
              : "/logo/LogoSC.png"
          }
          alt="Schermix"
          width={
            isExpanded ? 280 : 52
          }
          height={60}
          className={
            isExpanded
              ? "h-auto w-full max-w-[240px] object-contain"
              : "h-auto w-full max-w-[48px] object-contain"
          }
          priority
        />

        {isExpanded && (
          <button
            type="button"
            onClick={handleTogglePin}
            aria-label={
              isPinned
                ? "Desafixar menu lateral"
                : "Fixar menu lateral"
            }
            title={
              isPinned
                ? "Desafixar menu"
                : "Fixar menu"
            }
            className={[
              "absolute bottom-2 right-3 flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isPinned
                ? "text-[#F57B00] hover:bg-white/10"
                : "text-zinc-400 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {isPinned ? (
              <PinOff size={15} />
            ) : (
              <Pin size={15} />
            )}
          </button>
        )}
      </div>

      <nav
        className={[
          "flex-1 space-y-1 overflow-y-auto py-5",
          isExpanded ? "px-3" : "px-2",
        ].join(" ")}
      >
        {navigation.map((item) => {
          const Icon = item.icon;

          const isActive =
            pathname === item.href ||
            pathname.startsWith(
              `${item.href}/`,
            );

          return (
            <Link
              key={item.href}
              href={item.href}
              title={
                isExpanded
                  ? undefined
                  : item.label
              }
              className={[
                "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                isExpanded
                  ? "gap-3 px-3"
                  : "justify-center px-2",
                isActive
                  ? "bg-[#F57B00] text-white"
                  : "text-zinc-300 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <Icon
                size={19}
                strokeWidth={1.9}
                className="shrink-0"
              />

              {isExpanded && (
                <span>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div
        className={[
          "border-t border-white/10",
          isExpanded ? "p-4" : "p-2",
        ].join(" ")}
      >
        {isExpanded ? (
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

              <span className="text-sm font-medium text-zinc-200">
                Sistema online
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-500">
              Schermix
            </p>
          </div>
        ) : (
          <div
            className="flex items-center justify-center py-3"
            title="Sistema online"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
        )}
            </div>
    </aside>
  </div>
  );
}