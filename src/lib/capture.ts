/**
 * DOM 要素を PNG 画像として保存する。
 * - `data-capture-hide` 属性を持つ要素（操作ボタン等）とグラフのツールチップは画像に含めない
 * - スマホ（タッチ端末）では共有シート経由で「写真に保存」できるようにする
 */
export async function saveElementAsPng(node: HTMLElement, fileName: string): Promise<void> {
  // html-to-image はクリック時にだけ読み込む（初期表示のバンドルを軽く保つ）
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    filter: (el) => {
      if (!(el instanceof HTMLElement)) return true;
      if (el.dataset.captureHide !== undefined) return false;
      return !el.classList.contains("recharts-tooltip-wrapper");
    },
  });
  if (!blob) throw new Error("画像の生成に失敗しました");

  const file = new File([blob], fileName, { type: "image/png" });
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (isTouch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (e) {
      // 共有シートを閉じただけなら何もしない
      if (e instanceof DOMException && e.name === "AbortError") return;
      // それ以外はダウンロードにフォールバック
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 保存ファイル名: tameru-資産推移-20260928-1530.png（同日に複数回保存しても上書きされないよう時刻を含める） */
export function captureFileName(label: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `tameru-${label}-${stamp}.png`;
}
