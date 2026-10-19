import { describe, expect, it } from "vitest";
import { diagnose, diagnoseAll, selectiveCheckReason, type BillInput } from "./index";
import { ktHomeOctober, ktHomeSeptember, ktMobile } from "./fixtures/kt-2026-10";

const base: BillInput = {
  carrier: "SKT",
  planName: "테스트",
  planMonthlyFee: 50000,
  hasSelectiveDiscount: true,
  addons: [],
  promotions: [],
};

describe("R1 선택약정을 알 수 없을 때", () => {
  it("확인 항목으로 띄우고 절감액에는 넣지 않음", () => {
    const r = diagnose({ ...base, hasSelectiveDiscount: null });
    expect(r.findings).toEqual([expect.objectContaining({ rule: "R1", kind: "check", yearlySaving: 0 })]);
    expect(r.yearlyTotal).toBe(0);
  });

  it("요금제가 없는 명세서(단말대금 등)는 R1 판단 안 함", () => {
    expect(diagnose({ ...base, planMonthlyFee: 0, hasSelectiveDiscount: false }).findings).toHaveLength(0);
  });
});

describe("R2 부가서비스 할인 반영", () => {
  it("전액 할인된 부가서비스는 새는 돈이 아님", () => {
    const r = diagnose({ ...base, addons: [{ name: "무료", monthlyFee: 3000, discount: 3000, used: false }] });
    expect(r.findings).toHaveLength(0);
  });

  it("일부 할인이면 실제 내는 금액만", () => {
    const r = diagnose({ ...base, addons: [{ name: "반값", monthlyFee: 3000, discount: 1000, used: false }] });
    expect(r.findings[0]).toMatchObject({ rule: "R2", yearlySaving: 2000 * 12 });
  });
});

describe("R5 연체 가산금", () => {
  it("이번 달 가산금을 그대로 절감액으로", () => {
    const r = diagnose({ ...base, lateFees: 1520 });
    expect(r.findings[0]).toMatchObject({ rule: "R5", kind: "saving", yearlySaving: 1520 });
  });

  it("가산금 0 이면 없음", () => {
    expect(diagnose({ ...base, lateFees: 0 }).findings).toHaveLength(0);
  });
});

describe("R6 평소보다 많이 나온 달", () => {
  it("중앙값의 1.3배 이상이고 5천 원 이상 차이면 확인 항목", () => {
    const r = diagnose(ktHomeSeptember);
    expect(r.findings).toEqual([expect.objectContaining({ rule: "R6", kind: "check", yearlySaving: 0 })]);
    expect(r.findings[0].reason).toContain("60,420원");
  });

  it("평소와 같은 달은 없음", () => {
    expect(diagnose(ktHomeOctober).findings).toHaveLength(0);
  });

  it("지난 달 기록이 2개 미만이면 판단 안 함", () => {
    expect(diagnose({ ...base, totalAmount: 100000, pastTotals: [40000] }).findings).toHaveLength(0);
  });

  it("비율은 넘어도 차이가 5천 원 미만이면 무시", () => {
    expect(diagnose({ ...base, totalAmount: 13000, pastTotals: [9000, 9000] }).findings).toHaveLength(0);
  });
});

describe("실제 KT 고지서 (2026년 10월, 금액만)", () => {
  it("모바일: 부가서비스 3개 + 가산금, 선택약정은 확인 항목", () => {
    const r = diagnose(ktMobile);
    expect(r.findings.map((f) => [f.rule, f.kind])).toEqual([
      ["R2", "saving"],
      ["R5", "saving"],
      ["R1", "check"],
    ]);
    // 캐치콜 1,000 + 폰케어 2,100 + 폰케어 플러스 3,455 = 6,555원/월 (듀얼번호는 전액 할인)
    expect(r.findings[0].yearlySaving).toBe(6555 * 12);
    expect(r.yearlyTotal).toBe(6555 * 12 + 1520);
  });

  it("여러 장을 합치면 출처가 붙고 확인 항목은 뒤로", () => {
    const r = diagnoseAll([ktMobile, ktHomeSeptember]);
    expect(r.yearlyTotal).toBe(78660 + 1520);
    expect(r.findings.map((f) => `${f.source}:${f.rule}`)).toEqual([
      "휴대폰:R2",
      "휴대폰:R5",
      "휴대폰:R1",
      "인터넷·TV:R6",
    ]);
  });
});

describe("R1 확인 문구 (월정액 할인금액으로 힌트)", () => {
  it("할인이 25% 와 다르면 다른 할인일 수 있다고 알리고, 받을 수 있는 금액을 알려 줌", () => {
    const r = selectiveCheckReason(62728, 9220);
    expect(r).toContain("9,220원");
    expect(r).toContain("15,682원");
    expect(r).toContain("188,184원");
  });
  it("할인이 25% 와 같으면 선택약정일 가능성이 높다고 알림", () => {
    expect(selectiveCheckReason(62728, 15682)).toContain("가능성이 높");
  });
  it("할인금액이 없으면 할인상세 확인 안내", () => {
    expect(selectiveCheckReason(62728)).toContain("할인 내역");
  });
  it("확인 항목은 절감액에 더하지 않음", () => {
    const d = diagnose({ carrier: "KT", planName: "", planMonthlyFee: 62728, planDiscount: 9220, hasSelectiveDiscount: null, addons: [], promotions: [] });
    expect(d.findings[0].kind).toBe("check");
    expect(d.yearlyTotal).toBe(0);
  });
});
