/**
 * TAMERU の紹介文（画面の下に表示）。
 * データの読み込み前から HTML に含めて、検索エンジンにも何のサイトか伝わるようにする。
 */
export function SiteAbout() {
  return (
    <section aria-labelledby="site-about-title" className="mx-auto max-w-3xl text-left text-xs leading-relaxed text-slate-500">
      <h2 id="site-about-title" className="font-semibold text-slate-600">
        TAMERU について
      </h2>
      <p className="mt-1">
        TAMERU は、銀行や証券会社との口座連携なしで、毎月の資産を手入力で記録する無料の資産管理アプリです。
        総資産の推移やポートフォリオの構成比をグラフで確認でき、前月比・前年比も自動で計算します。
        スプレッドシート（Excel・Google スプレッドシート）で資産管理をしていた方は、表のコピー＆貼り付けでそのまま移行できます。
        登録なしですぐに使え、Google でログインすると PC とスマホでデータを同期できます。
      </p>
    </section>
  );
}
