import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { CONTACT_URL, OPERATOR_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "プライバシーポリシー | TAMERU",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="プライバシーポリシー">
      <p>
        {OPERATOR_NAME}（以下「運営者」）は、資産管理アプリ「TAMERU」（以下「本サービス」）における利用者の情報を、以下のとおり取り扱います。
      </p>

      <h2>1. 取得する情報</h2>
      <ul>
        <li>
          <strong>Google でログインしない場合</strong>
          ：入力した資産のデータは、利用者の端末（ブラウザ）の中だけに保存されます。運営者には送信されません。
        </li>
        <li>
          <strong>Google でログインした場合</strong>
          <ul>
            <li>
              Google アカウントの情報：メールアドレス、名前、プロフィール画像。ログインのしくみが自動で保存します。本サービスの画面で使うのはメールアドレスのみです。
            </li>
            <li>資産のデータ：口座名・内訳のメモ・金額など。端末間で同期するために、クラウドに保存します。</li>
          </ul>
        </li>
        <li>
          <strong>アクセス情報</strong>
          ：閲覧したページ、国・地域、端末やブラウザの種類など。個人を特定しない形で集計します。Cookie は使用しません。
        </li>
      </ul>

      <h2>2. 利用目的</h2>
      <ul>
        <li>端末間でデータを同期するため</li>
        <li>本サービスの利用状況を把握し、改善するため</li>
        <li>お問い合わせに対応するため</li>
      </ul>

      <h2>3. 第三者への提供</h2>
      <p>法令に基づく場合を除き、本人の同意なく第三者に提供しません。</p>

      <h2>4. 外部サービスの利用</h2>
      <p>
        本サービスは、次の外部サービスを利用しています。これらの事業者は米国の事業者で、各社のプライバシーポリシーに従って情報を取り扱います。
      </p>
      <ul>
        <li>Google Firebase（ログイン・データの保存。データは東京リージョンに保存）</li>
        <li>Vercel（サイトの配信・アクセスの集計）</li>
      </ul>

      <h2>5. データの管理と削除</h2>
      <ul>
        <li>クラウドのデータは、本人のアカウントからしか読み書きできないように設定しています。</li>
        <li>利用者は、画面右上のメニューの「同期をやめて、クラウドのデータを削除」から、いつでもクラウドのデータを削除できます。</li>
        <li>端末内のデータは、ブラウザのサイトデータを削除すると消えます。</li>
      </ul>

      <h2>6. お問い合わせ</h2>
      {CONTACT_URL ? (
        <p>
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline underline-offset-2">
            お問い合わせフォーム
          </a>
          からご連絡ください。個人で運営しているため、返信までにお時間をいただく場合や、すべてのお問い合わせに返信できない場合があります。
        </p>
      ) : (
        <p>お問い合わせフォームは準備中です。</p>
      )}

      <h2>7. 改定</h2>
      <p>本ポリシーは、必要に応じて改定することがあります。改定後の内容は、このページに掲載した時点から有効になります。</p>
    </LegalPage>
  );
}
