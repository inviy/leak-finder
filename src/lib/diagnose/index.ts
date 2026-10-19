import type { BillInput, CatalogPlan, Diagnosis, Finding } from "./types";

export * from "./types";

/** 선택약정 할인율 */
export const SELECTIVE_DISCOUNT_RATE = 0.25;
/** 프로모션 종료를 "곧"으로 보는 기준 (개월) */
export const PROMO_SOON_MONTHS = 2;

const won = (n: number) => Math.round(n);
const fmt = (n: number) => `${won(n).toLocaleString("ko-KR")}원`;

/**
 * R4: 사용량을 채우는 같은 통신사 요금제 중, 지금보다 싼 것 가운데 가장 비싼 것 (한 단계 아래).
 * 사용량을 모르거나 더 싼 요금제가 없으면 null.
 */
export function findCheaperPlan(input: BillInput, catalog: CatalogPlan[]): CatalogPlan | null {
  if (input.monthlyDataUsageGB === undefined) return null;
  const usage = input.monthlyDataUsageGB;
  const candidates = catalog
    .filter((p) => p.carrier === input.carrier)
    .filter((p) => p.monthlyFee < input.planMonthlyFee && p.dataGB >= usage)
    .sort((a, b) => b.monthlyFee - a.monthlyFee);
  return candidates[0] ?? null;
}

export function diagnose(input: BillInput, catalog: CatalogPlan[] = []): Diagnosis {
  const findings: Finding[] = [];

  // R4 를 먼저 구해, R1 의 25% 할인을 바뀐 요금제 기준으로 계산 (중복 계산 방지)
  const cheaper = findCheaperPlan(input, catalog);
  const feeAfterR4 = cheaper ? cheaper.monthlyFee : input.planMonthlyFee;

  if (!input.hasSelectiveDiscount && input.carrier !== "MVNO") {
    const saving = feeAfterR4 * SELECTIVE_DISCOUNT_RATE * 12;
    findings.push({
      rule: "R1",
      title: "선택약정 할인 안 받는 중",
      reason: `월정액 ${fmt(feeAfterR4)}의 25%를 할인받을 수 있어요 (월정액 × 25% × 12개월)`,
      yearlySaving: won(saving),
    });
  }

  const unused = input.addons.filter((a) => !a.used && a.monthlyFee > 0);
  if (unused.length > 0) {
    const monthly = unused.reduce((s, a) => s + a.monthlyFee, 0);
    findings.push({
      rule: "R2",
      title: `안 쓰는 부가서비스 ${unused.length}개`,
      reason: `${unused.map((a) => a.name).join(", ")} 해지 시 (월 ${fmt(monthly)} × 12개월)`,
      yearlySaving: won(monthly * 12),
    });
  }

  const ending = input.promotions.filter((p) => p.endsInMonths <= PROMO_SOON_MONTHS && p.monthlyDiscount > 0);
  for (const p of ending) {
    const months = Math.max(0, 12 - p.endsInMonths);
    findings.push({
      rule: "R3",
      title: p.endsInMonths === 0 ? `${p.name} 할인 종료됨` : `${p.name} 할인 ${p.endsInMonths}개월 뒤 종료`,
      reason: `종료 후 월 ${fmt(p.monthlyDiscount)} 오름 (인상분 × ${months}개월)`,
      yearlySaving: won(p.monthlyDiscount * months),
    });
  }

  if (cheaper) {
    const diff = input.planMonthlyFee - cheaper.monthlyFee;
    findings.push({
      rule: "R4",
      title: "사용량보다 큰 요금제",
      reason: `${cheaper.name}(월 ${fmt(cheaper.monthlyFee)})로도 충분해요 (차액 × 12개월)`,
      yearlySaving: won(diff * 12),
    });
  }

  findings.sort((a, b) => b.yearlySaving - a.yearlySaving);
  return { findings, yearlyTotal: findings.reduce((s, f) => s + f.yearlySaving, 0) };
}
