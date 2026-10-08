// SNS で共有したときのプレビュー画像（src/app/opengraph-image.png）を作り直す
// 使い方: node scripts/og/make-og-image.mjs（og-image.html を 1200×630 でスクリーンショットする）
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.join(here, "og-image.html")).href);
await page.screenshot({ path: path.join(here, "../../src/app/opengraph-image.png") });
await browser.close();
