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

  it("인터넷 약정은 상황마다 다른 안내, 금액이나 통신사별 번호를 지어내지 않음", () => {
    const titles = ["ended", "soon", "unknown"].map((v) => guideFor("R7", "check", undefined, v).title);
    expect(new Set(titles).size).toBe(3);
    for (const v of ["ended", "soon", "unknown"]) {
      const g = guideFor("R7", "check", undefined, v);
      const text = [...g.steps, g.caution ?? ""].join(" ");
      expect(text).not.toMatch(/\d+만\s?원|\d{1,3}(,\d{3})+원/);
      expect(text).not.toMatch(/\d{3,4}-\d{3,4}/);
    }
    expect(guideFor("R7", "check", undefined, "ended").steps.join(" ")).toContain("위약금이 없어요");
  });

  it("링크는 https", () => {
    for (const r of RULES) {
      const href = guideFor(r, "saving").link?.href;
      if (href) expect(href.startsWith("https://")).toBe(true);
    }
  });
});

describe("알뜰폰 안내", () => {
  it("휴대폰 관련 안내는 114 대신 알뜰폰 회사 고객센터", () => {
    for (const r of ["R2", "R5"] as const) {
      const text = guideFor(r, "saving", "MVNO", undefined, "mobile").steps.join(" ");
      expect(text).not.toContain("114");
      expect(text).toContain("알뜰폰 회사");
    }
  });
  it("인터넷·TV 는 알뜰폰이어도 통신사 안내 그대로", () => {
    expect(guideFor("R7", "check", "MVNO", "unknown", "home").steps.join(" ")).toContain("114");
  });
  it("큰 통신사는 114 안내 그대로", () => {
    expect(guideFor("R2", "saving", "KT", undefined, "mobile").steps.join(" ")).toContain("114");
  });
});
