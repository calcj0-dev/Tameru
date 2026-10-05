/**
 * ヘルプの内容。画面（HelpDialog）とは分けて、ここに文章だけを書く。
 * 項目を追加するときは HELP_SECTIONS に足す。
 */

/** 文章のかたまり */
export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "sub"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "list"; items: string[] };

export interface HelpSection {
  id: string;
  title: string;
  body: HelpBlock[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "what",
    title: "TAMERU でできること",
    body: [
      {
        type: "list",
        items: [
          "口座・内訳ごとに、毎月末の残高を記録できます",
          "資産の推移と内訳（資産クラス・地域・口座別）をグラフで確認できます",
          "Google でログインすると、PC とスマホでデータを同期できます（任意）",
        ],
      },
    ],
  },
  {
    id: "getting-started",
    title: "最初にすること",
    body: [
      {
        type: "steps",
        items: [
          "資産入力の「編集」を押します",
          "口座と内訳を作ります（見本の口座は、名前を変えるか削除してください）",
          "各月末の残高を入力して「保存」を押します",
        ],
      },
      { type: "sub", text: "スプレッドシートから移すとき" },
      {
        type: "steps",
        items: [
          "上の手順で口座と内訳を作ります",
          "「編集」→「スプレッドシート連携」→「① 表を出力」で「表をコピー」を押します",
          "スプレッドシートの A1 セルに貼り付け、金額を埋めます",
          "見出しも含めて表全体をコピーし、「② 取り込む」に貼り付けて「取り込む」→「保存」を押します",
        ],
      },
    ],
  },
  {
    id: "storage",
    title: "データの保存場所",
    body: [
      {
        type: "list",
        items: [
          "ログインしない場合：この端末のブラウザの中だけに保存されます。ブラウザのデータを消すと、TAMERU のデータも消えます",
          "Google でログインした場合：クラウドにも保存され、端末どうしで同期されます。本人以外は見られません",
          "Google ログイン後にログアウトしても、クラウドのデータは残ります",
        ],
      },
    ],
  },
];
