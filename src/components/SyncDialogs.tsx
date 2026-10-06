"use client";

import { useState } from "react";
import Link from "next/link";
import { Cloud, HardDrive, Info, LoaderCircle, LogIn, RefreshCw, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import type { InitialChoiceRequest } from "@/hooks/useCloudSync";
import type { StoreOverview } from "@/lib/sync/cloudSync";
import { describeBackup, type SyncBackup } from "@/lib/sync/backup";
import { formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Dialog, DialogList } from "@/components/Dialog";

const ok = <ShieldCheck className="size-4 text-teal-600" aria-hidden />;
const info = <Info className="size-4 text-slate-400" aria-hidden />;
const warn = <TriangleAlert className="size-4 text-amber-500" aria-hidden />;

// ---------------------------------------------------------------------------
// ログイン前の説明
// ---------------------------------------------------------------------------

export function LoginIntroDialog({
  ready,
  onLogin,
  onClose,
}: {
  /** ログインの準備（Firebase の読み込み）が終わったか。終わるまでボタンは押せない */
  ready: boolean;
  onLogin: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title="Google でログインして同期" onClose={busy ? undefined : onClose}>
      <p className="mt-2 text-sm text-slate-600">ログインすると、PC とスマホで同じデータを使えるようになります。</p>
      <DialogList
        items={[
          {
            icon: ok,
            text: (
              <>
                データは<strong>クラウド（Google Firebase・東京）</strong>に保存され、同じ Google
                アカウントでログインした端末どうしで自動的に同期されます。
              </>
            ),
          },
          {
            icon: ok,
            text: "TAMERU が利用するのはメールアドレスだけです。Google アカウントのパスワードや、他のデータにはアクセスしません。",
          },
          {
            icon: info,
            text: (
              <>
                この端末のデータは、そのままクラウドに保存されます。<strong>すでに他の端末で同期している場合</strong>
                は、どちらのデータを使うか選ぶ画面が出ます（置き換える前のデータは、この端末にバックアップされます）。
              </>
            ),
          },
          { icon: info, text: "ログアウトしても、この端末のデータは消えません。" },
        ]}
      />
      <p className="mt-4 text-xs text-slate-500">
        ログインすると、
        <Link href="/terms" target="_blank" className="text-teal-700 underline underline-offset-2">
          利用規約
        </Link>
        と
        <Link href="/privacy" target="_blank" className="text-teal-700 underline underline-offset-2">
          プライバシーポリシー
        </Link>
        に同意したものとみなします。
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </button>
        <button
          type="button"
          data-autofocus
          // 準備が終わる前に押すと、ログイン画面（ポップアップ）がブロックされることがあるため押せなくする
          disabled={busy || !ready}
          onClick={async () => {
            setBusy(true);
            try {
              await onLogin();
            } finally {
              setBusy(false);
              onClose();
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-70"
        >
          {busy || !ready ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          {ready ? "Google でログイン" : "準備中…"}
        </button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ログアウト
// ---------------------------------------------------------------------------

export function LogoutDialog({
  email,
  onLogout,
  onClose,
}: {
  email: string | null;
  onLogout: (clearLocal: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (clearLocal: boolean) => {
    setBusy(true);
    try {
      await onLogout(clearLocal);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="ログアウト" onClose={busy ? undefined : onClose}>
      <p className="mt-2 text-sm text-slate-600">
        {email ? `${email} からログアウトします。` : "ログアウトします。"}
        クラウドのデータは消えません。もう一度ログインすれば、続きから同期できます。
      </p>
      <div className="mt-5 space-y-2.5">
        <ChoiceButton
          icon={<HardDrive className="size-5 text-teal-600" aria-hidden />}
          title="この端末のデータを残してログアウト（おすすめ）"
          description="自分の PC・スマホ向け。ログアウト中もこの端末で入力でき、再ログインすると自動でまとめて同期します。"
          onClick={() => run(false)}
          disabled={busy}
          emphasized
          autoFocus
        />
        <ChoiceButton
          icon={<TriangleAlert className="size-5 text-rose-500" aria-hidden />}
          title="この端末のデータも削除してログアウト"
          description="家族や職場の PC など、共有の端末向け。この端末から資産データを消します（クラウドのデータは残ります）。"
          onClick={() => run(true)}
          disabled={busy}
        />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 同期をやめて、クラウドのデータを削除
// ---------------------------------------------------------------------------

const DELETE_WORD = "削除";

export function DeleteCloudDialog({ onDelete, onClose }: { onDelete: () => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title="同期をやめて、クラウドのデータを削除" onClose={busy ? undefined : onClose}>
      <DialogList
        items={[
          { icon: warn, text: <>クラウドに保存した TAMERU のデータを<strong>削除</strong>します。元に戻せません。</> },
          { icon: warn, text: "TAMERU のログイン登録を削除し、ログアウトします。他の端末も同期されなくなります。" },
          { icon: ok, text: <><strong>Google アカウントは削除されません。</strong>Gmail などは今まで通り使えます。</> },
          { icon: ok, text: "この端末のデータは残ります。他の端末のデータも、それぞれの端末に残ります。" },
        ]}
      />
      <label className="mt-5 block text-sm text-slate-700">
        実行するには「<strong>{DELETE_WORD}</strong>」と入力してください
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-autofocus
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
        />
      </label>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </button>
        <button
          type="button"
          disabled={text.trim() !== DELETE_WORD || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onDelete();
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "削除に失敗しました");
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          クラウドのデータを削除
        </button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 初回の選択（この端末とクラウドの両方にデータがある場合）
// ---------------------------------------------------------------------------

export function InitialSyncDialog({ request }: { request: InitialChoiceRequest }) {
  const [confirmDevice, setConfirmDevice] = useState(false);
  const updated = request.cloudUpdatedAt ? new Date(request.cloudUpdatedAt).toLocaleString("ja-JP") : null;

  if (confirmDevice) {
    return (
      <Dialog title="クラウドのデータを上書きしますか？">
        <DialogList
          items={[
            {
              icon: warn,
              text: (
                <>
                  クラウドのデータが、この端末のデータに<strong>置き換わります</strong>。他の端末で入力したデータも、次に開いたときにこの内容になります。
                </>
              ),
            },
            { icon: ok, text: "上書きする前のクラウドのデータは、この端末にバックアップします。あとから「バックアップから戻す」で元に戻せます。" },
          ]}
        />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-autofocus
            onClick={() => setConfirmDevice(false)}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={() => request.resolve("device")}
            className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
          >
            上書きする
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="どちらのデータを使いますか？" className="max-w-lg">
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        この端末とクラウドの両方にデータがあります。選んだほうのデータで、この端末とクラウドを揃えます。
        <strong>選ばなかったほうのデータは、この端末にバックアップ</strong>されるので、あとから戻せます。
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <OverviewCard icon={<Cloud className="size-4" />} title="クラウド" overview={request.cloud} note={updated ? `最終更新: ${updated}` : undefined} />
        <OverviewCard icon={<Smartphone className="size-4" />} title="この端末" overview={request.device} />
      </div>

      <div className="mt-5 space-y-2.5">
        <ChoiceButton
          icon={<Cloud className="size-5 text-teal-600" aria-hidden />}
          title="クラウドのデータを使う（おすすめ）"
          description="他の端末で入力したデータを、この端末に取り込みます。この端末のデータは置き換わります。"
          onClick={() => request.resolve("cloud")}
          emphasized
          autoFocus
        />
        <ChoiceButton
          icon={<Smartphone className="size-5 text-slate-500" aria-hidden />}
          title="この端末のデータを使う"
          description="この端末のデータでクラウドを上書きします。他の端末のデータも、この内容に置き換わります。"
          onClick={() => setConfirmDevice(true)}
        />
      </div>
    </Dialog>
  );
}

function OverviewCard({
  icon,
  title,
  overview,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  overview: StoreOverview;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-slate-900">
        {icon}
        {title}
      </p>
      <dl className="mt-2 space-y-0.5 text-xs text-slate-600">
        <div className="flex justify-between gap-2">
          <dt>総資産</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{formatYen(overview.total)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>最新の入力</dt>
          <dd className="tabular-nums">{overview.latest ? `${overview.latest.year}年${overview.latest.month}月` : "なし"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>口座 / 内訳</dt>
          <dd className="tabular-nums">
            {overview.accounts}件 / {overview.holdings}件
          </dd>
        </div>
      </dl>
      {note && <p className="mt-1.5 text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}

function ChoiceButton({
  icon,
  title,
  description,
  onClick,
  disabled,
  emphasized,
  autoFocus,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  emphasized?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-autofocus={autoFocus ? "" : undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition disabled:opacity-60",
        emphasized ? "border-2 border-teal-500 bg-teal-50/50 hover:bg-teal-50" : "border border-slate-200 hover:bg-slate-50",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="block font-medium text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// バックアップから戻す
// ---------------------------------------------------------------------------

export function RestoreBackupDialog({
  backup,
  onRestore,
  onClose,
}: {
  backup: SyncBackup;
  onRestore: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title="バックアップから戻す" onClose={onClose}>
      <DialogList
        items={[
          { icon: info, text: <>戻すデータ: {describeBackup(backup)}</> },
          { icon: warn, text: "今のデータが、このバックアップの内容に置き換わります。ログイン中は、他の端末にも同期されます。" },
          { icon: ok, text: "戻す前の今のデータも、新しくバックアップします。もう一度「バックアップから戻す」を押せば元に戻せます。" },
        ]}
      />
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={() => {
            onRestore();
            onClose();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
        >
          <RefreshCw className="size-4" />
          このデータに戻す
        </button>
      </div>
    </Dialog>
  );
}
