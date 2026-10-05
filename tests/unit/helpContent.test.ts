import { describe, expect, it } from "vitest";
import { HELP_SECTIONS } from "@/lib/helpContent";

describe("ヘルプの内容", () => {
  it("id が重複せず、どの項目にも本文がある", () => {
    const ids = HELP_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of HELP_SECTIONS) {
      expect(section.title).not.toBe("");
      expect(section.body.length).toBeGreaterThan(0);
    }
  });
});
