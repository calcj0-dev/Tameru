"use client";

import { HELP_SECTIONS, type HelpBlock } from "@/lib/helpContent";
import { Dialog } from "@/components/Dialog";

/** ヘルプ。開くと全項目をそのまま表示する */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="ヘルプ" onClose={onClose} className="max-w-lg">
      <div className="mt-4 space-y-5">
        {HELP_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`help-${section.id}`}>
            <h3 id={`help-${section.id}`} className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="size-2 shrink-0 rounded-sm bg-teal-600" aria-hidden />
              {section.title}
            </h3>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
              {section.body.map((block, i) => (
                <HelpBlockView key={i} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

function HelpBlockView({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "sub":
      return <h4 className="pt-1 font-medium text-slate-900">{block.text}</h4>;
    case "steps":
      return (
        <ol className="list-decimal space-y-1 pl-5 marker:text-teal-600">
          {block.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-5 marker:text-slate-400">
          {block.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      );
  }
}
