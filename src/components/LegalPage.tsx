import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, PiggyBank } from "lucide-react";
import { LEGAL_ESTABLISHED } from "@/lib/site";
import { SiteFooterLinks } from "@/components/SiteFooterLinks";

/** プライバシーポリシー・利用規約の共通レイアウト */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/30">
              <PiggyBank className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-[0.12em] text-slate-900">TAMERU</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="size-4" aria-hidden />
            TAMERU に戻る
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <article className="rounded-2xl bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-200 sm:p-8 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-slate-400 [&_p]:mt-2">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {children}
          <p className="mt-10 text-right text-xs text-slate-500">制定日: {LEGAL_ESTABLISHED}</p>
        </article>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-slate-400">
        <SiteFooterLinks />
      </footer>
    </div>
  );
}
