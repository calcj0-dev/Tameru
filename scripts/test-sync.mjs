/**
 * ログイン・同期の自動テストを実行する（npm run test:e2e:sync）。
 * 1. Firebase エミュレーターに接続するテスト用ビルドを作る（.next-e2e。通常のビルドは上書きしない）
 * 2. エミュレーター（ログイン・データベース）を起動し、その中で
 *    - セキュリティルールのテスト（Vitest: tests/rules）
 *    - ログイン・同期の画面テスト（Playwright: e2e/sync）
 *    を実行する。本番のクラウドには一切接続しない。
 * Java が必要（Firestore エミュレーターが Java で動くため）。
 */
import { spawnSync } from "node:child_process";

const run = (command, env = {}) => {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const extraArgs = process.argv.slice(2).join(" ");

run("npx next build", { NEXT_PUBLIC_FIREBASE_EMULATOR: "1", NEXT_DIST_DIR: ".next-e2e" });
run(
  `npx firebase emulators:exec --project tameru-dde4e --only auth,firestore ` +
    `"npx vitest run --config vitest.rules.config.mts && npx playwright test -c playwright.sync.config.ts ${extraArgs}"`,
);
