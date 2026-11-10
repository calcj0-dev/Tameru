"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";
import { ChartLine, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "ホーム", icon: ChartLine },
  { href: "/record", label: "記録", icon: PencilLine },
] as const;

const DISCARD_MESSAGE = "保存していない変更があります。変更を破棄しますか？";

/**
 * 画面の切り替え（ホーム／記録）。スマホは画面の下に固定、PC はヘッダーの下に表示する。
 * 記録の画面で保存していない変更があるときは、移る前に確認する。
 */
export function TabNav({ unsavedChangesRef }: { unsavedChangesRef?: RefObject<boolean> }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="画面の切り替え"
      className={cn(
        // スマホ: 画面の下に固定（iPhone の画面下のバーに重ならないよう余白を取る）
        "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(15,23,42,0.04)]",
        // PC: ヘッダーの下に通常どおり並べる
        "sm:static sm:border-b sm:border-t-0 sm:pb-0 sm:shadow-none",
      )}
    >
      <ul className="mx-auto grid max-w-7xl grid-cols-2 sm:flex sm:gap-1 sm:px-6">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (active) return;
                  if (unsavedChangesRef?.current && !window.confirm(DISCARD_MESSAGE)) e.preventDefault();
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition",
                  "sm:-mb-px sm:flex-row sm:gap-1.5 sm:border-b-2 sm:px-4 sm:py-3 sm:text-sm",
                  active
                    ? "text-teal-700 sm:border-teal-600"
                    : "text-slate-500 hover:text-slate-800 sm:border-transparent",
                )}
              >
                <Icon className="size-5 sm:size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
