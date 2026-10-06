import Link from "next/link";
import { CONTACT_URL } from "@/lib/site";

/** 画面下のリンク（プライバシーポリシー・利用規約・お問い合わせ） */
export function SiteFooterLinks() {
  const link = "underline-offset-2 hover:text-slate-600 hover:underline";
  return (
    <nav aria-label="サイト情報" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <Link href="/privacy" className={link}>
        プライバシーポリシー
      </Link>
      <span aria-hidden>・</span>
      <Link href="/terms" className={link}>
        利用規約
      </Link>
      {CONTACT_URL && (
        <>
          <span aria-hidden>・</span>
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className={link}>
            お問い合わせ
          </a>
        </>
      )}
    </nav>
  );
}
