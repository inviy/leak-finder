import { describe, expect, it } from "vitest";
import { diagnose, type BillInput, type CatalogPlan } from "./index";

// 테스트용 가상 요금제 (실제 요금 아님)
const catalog: CatalogPlan[] = [
  { carrier: "SKT", name: "테스트 100GB", monthlyFee: 69000, dataGB: 100 },
  { carrier: "SKT", name: "테스트 30GB", monthlyFee: 55000, dataGB: 30 },
  { carrier: "SKT", name: "테스트 10GB", monthlyFee: 45000, dataGB: 10 },
  { carrier: "KT", name: "테스트 KT 10GB", monthlyFee: 40000, dataGB: 10 },
];

const base: BillInput = {
  carrier: "SKT",
  planName: "테스트 100GB",
  planMonthlyFee: 69000,
  hasSelectiveDiscount: true,
  addons: [],
  promotions: [],
};

describe("diagnose", () => {
  it("새는 곳이 없으면 0원", () => {
    expect(diagnose(base, catalog)).toEqual({ findings: [], yearlyTotal: 0 });
  });

  it("R1 선택약정 미적용", () => {
    const r = diagnose({ ...base, hasSelectiveDiscount: false }, catalog);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ rule: "R1", yearlySaving: 69000 * 0.25 * 12 });
  });

  it("R1 은 알뜰폰에 적용하지 않음", () => {
    const r = diagnose({ ...base, carrier: "MVNO", hasSelectiveDiscount: false }, catalog);
    expect(r.findings).toHaveLength(0);
  });

  it("R2 안 쓰는 부가서비스만 합산", () => {
    const r = diagnose(
      {
        ...base,
        addons: [
          { name: "A", monthlyFee: 3300, used: true },
          { name: "B", monthlyFee: 2200, used: false },
          { name: "C", monthlyFee: 1100, used: false },
        ],
      },
      catalog,
    );
    expect(r.findings[0]).toMatchObject({ rule: "R2", yearlySaving: 3300 * 12 });
    expect(r.findings[0].reason).toContain("B, C");
  });

  it("R3 곧 끝나는 프로모션만, 남은 개월 반영", () => {
    const r = diagnose(
      {
        ...base,
        promotions: [
          { name: "결합", monthlyDiscount: 5000, endsInMonths: 2 },
          { name: "먼 할인", monthlyDiscount: 5000, endsInMonths: 6 },
        ],
      },
      catalog,
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ rule: "R3", yearlySaving: 5000 * 10 });
  });

  it("R4 사용량을 채우는 한 단계 아래 요금제", () => {
    const r = diagnose({ ...base, monthlyDataUsageGB: 8 }, catalog);
    expect(r.findings[0]).toMatchObject({ rule: "R4", yearlySaving: (69000 - 55000) * 12 });
  });

  it("R4 사용량 모르면 판단 안 함", () => {
    expect(diagnose(base, catalog).findings).toHaveLength(0);
  });

  it("R1 과 R4 가 같이 나오면 R1 은 바뀐 요금제 기준 (중복 방지)", () => {
    const r = diagnose({ ...base, hasSelectiveDiscount: false, monthlyDataUsageGB: 20 }, catalog);
    const r1 = r.findings.find((f) => f.rule === "R1")!;
    const r4 = r.findings.find((f) => f.rule === "R4")!;
    expect(r1.yearlySaving).toBe(55000 * 0.25 * 12);
    expect(r4.yearlySaving).toBe((69000 - 55000) * 12);
    expect(r.yearlyTotal).toBe(r1.yearlySaving + r4.yearlySaving);
  });

  it("절감액 큰 순서로 정렬", () => {
    const r = diagnose(
      {
        ...base,
        hasSelectiveDiscount: false,
        addons: [{ name: "B", monthlyFee: 1100, used: false }],
      },
      catalog,
    );
    expect(r.findings.map((f) => f.rule)).toEqual(["R1", "R2"]);
  });
});
