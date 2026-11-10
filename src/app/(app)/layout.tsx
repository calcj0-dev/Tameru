import { AppShell } from "@/components/app/AppShell";

/** ホーム・記録の2画面に共通の枠（タブで切り替えても、データや同期の状態を保つ） */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
