import { describe, expect, it } from "vitest";
import type { RuleId } from "./diagnose";
import { guideFor } from "./guides";

const RULES: RuleId[] = ["R1", "R2", "R3", "R4", "R5", "R6"];

describe("guideFor", () => {
  it("모든 규칙에 단계가 2개 이상 있는 가이드가 있음", () => {
    for (const r of RULES) {
      const g = guideFor(r, "saving");
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("선택약정을 모를 때는 확인 가이드", () => {
    expect(guideFor("R1", "check").title).toContain("확인");
    expect(guideFor("R1", "saving").title).toContain("받기");
  });

  it("보험성 부가서비스 해지 주의 문구", () => {
    expect(guideFor("R2", "saving").caution).toContain("보장");
  });

  it("지어낸 메뉴 경로(>)나 통신사별 전화번호를 쓰지 않음", () => {
    for (const r of RULES) {
      const text = [...guideFor(r, "saving").steps, guideFor(r, "saving").caution ?? ""].join(" ");
      expect(text).not.toMatch(/>\s*\S/);
      expect(text).not.toMatch(/\d{3,4}-\d{3,4}/);
    }
  });

  it("링크는 https", () => {
    for (const r of RULES) {
      const href = guideFor(r, "saving").link?.href;
      if (href) expect(href.startsWith("https://")).toBe(true);
    }
  });
});
