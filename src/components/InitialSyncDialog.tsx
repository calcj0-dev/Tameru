"use client";

import { Cloud, Smartphone } from "lucide-react";
import type { InitialChoiceRequest } from "@/hooks/useCloudSync";

/**
 * 初めて同期する端末で、この端末とクラウドの両方にデータがある場合の選択ダイアログ。
 */
export function InitialSyncDialog({ request }: { request: InitialChoiceRequest }) {
  const updated = request.cloudUpdatedAt ? new Date(request.cloudUpdatedAt).toLocaleString("ja-JP") : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="initial-sync-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="initial-sync-title" className="text-lg font-semibold text-slate-900">
          どちらのデータを使いますか？
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          この端末とクラウドの両方にデータがあります。選んだほうのデータで、この端末とクラウドを揃えます。
        </p>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={() => request.resolve("cloud")}
            className="flex w-full items-start gap-3 rounded-xl border-2 border-teal-500 bg-teal-50/50 p-3.5 text-left transition hover:bg-teal-50"
          >
            <Cloud className="mt-0.5 size-5 shrink-0 text-teal-600" aria-hidden />
            <span>
              <span className="block font-medium text-slate-900">クラウドのデータを使う（おすすめ）</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                他の端末で入力したデータを、この端末に取り込みます。この端末のデータは置き換わります。
                {updated && <span className="block">クラウドの最終更新: {updated}</span>}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => request.resolve("device")}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:bg-slate-50"
          >
            <Smartphone className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
            <span>
              <span className="block font-medium text-slate-900">この端末のデータを使う</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                この端末のデータでクラウドを上書きします。他の端末のデータも、この内容に置き換わります。
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
