import type { BillInput, CatalogPlan, ContractState, Diagnosis, Finding } from "./types";

export * from "./types";

/** 선택약정 할인율 */
export const SELECTIVE_DISCOUNT_RATE = 0.25;
/** 프로모션 종료를 "곧"으로 보는 기준 (개월) */
export const PROMO_SOON_MONTHS = 2;
/** R6: 평소(지난 달 중앙값)보다 이 비율 이상 많으면 확인 대상 */
export const SPIKE_RATIO = 1.3;
/** R6: 차이가 이 금액 미만이면 무시 (원) */
export const SPIKE_MIN_DIFF = 5000;

const won = (n: number) => Math.round(n);
const fmt = (n: number) => `${won(n).toLocaleString("ko-KR")}원`;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * R4: 사용량을 채우는 같은 통신사 요금제 중, 지금보다 싼 것 가운데 가장 비싼 것 (한 단계 아래).
 * 사용량을 모르거나 더 싼 요금제가 없으면 null.
 */
export function findCheaperPlan(input: BillInput, catalog: CatalogPlan[]): CatalogPlan | null {
  if (input.monthlyDataUsageGB === undefined || input.planMonthlyFee <= 0) return null;
  const usage = input.monthlyDataUsageGB;
  const candidates = catalog
    .filter((p) => p.carrier === input.carrier)
    .filter((p) => p.monthlyFee < input.planMonthlyFee && p.dataGB >= usage)
    .sort((a, b) => b.monthlyFee - a.monthlyFee);
  return candidates[0] ?? null;
}

const sumSavings = (fs: Finding[]) =>
  fs.filter((f) => f.kind === "saving").reduce((s, f) => s + f.yearlySaving, 0);

/** 절감액 큰 순, 확인 항목은 뒤로 */
/** 확인 항목 순서: 이미 끝난 약정처럼 놓치면 손해가 큰 것부터 */
function checkRank(f: Finding): number {
  if (f.rule === "R7") return f.variant === "ended" ? 0 : f.variant === "soon" ? 1 : f.variant === "long" ? 5 : 3;
  if (f.rule === "R1") return 2;
  return 4;
}

function sortFindings(fs: Finding[]): Finding[] {
  return [...fs].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "saving" ? -1 : 1;
    if (a.kind === "check") return checkRank(a) - checkRank(b);
    return b.yearlySaving - a.yearlySaving;
  });
}

/** 고지서 한 장 진단 */
/**
 * 선택약정 여부를 모를 때, 월정액 할인금액이 25% 와 맞는지로 힌트를 줌.
 * 금액만으로 단정하지 않으므로 결과는 항상 "확인" 이고 절감액에 더하지 않음.
 */
export function selectiveCheckReason(fee: number, discount?: number): string {
  const expected = won(fee * SELECTIVE_DISCOUNT_RATE);
  if (!discount) return "고지서만으로는 요금 25% 할인(선택약정)을 받는지 알 수 없어요. 할인 내역에서 '선택약정'이 있는지 확인해 보세요";
  if (Math.abs(discount - expected) <= Math.max(10, expected * 0.02)) {
    return `기본 요금 할인 ${fmt(discount)}이 기본 요금의 25%와 같아요. 요금 25% 할인(선택약정)일 가능성이 높으니 할인 내역에서 확인만 해 보세요`;
  }
  return (
    `기본 요금 할인 ${fmt(discount)}은 요금 25% 할인(선택약정, ${fmt(expected)})과 금액이 달라요. 가족 결합 같은 다른 할인일 수 있어요. ` +
    `25% 할인을 안 받고 있다면 1년에 약 ${fmt(expected * 12)}을 더 아낄 수 있어요`
  );
}

export function diagnose(input: BillInput, catalog: CatalogPlan[] = []): Diagnosis {
  const findings: Finding[] = [];
  const source = input.label;

  // R4 를 먼저 구해, R1 의 25% 할인을 바뀐 요금제 기준으로 계산 (중복 계산 방지)
  const cheaper = findCheaperPlan(input, catalog);
  const feeAfterR4 = cheaper ? cheaper.monthlyFee : input.planMonthlyFee;

  // R1 선택약정
  if (input.carrier !== "MVNO" && input.planMonthlyFee > 0) {
    if (input.hasSelectiveDiscount === false) {
      findings.push({
        rule: "R1",
        kind: "saving",
        title: "요금 25% 할인(선택약정) 안 받는 중",
        reason: `기본 요금 ${fmt(feeAfterR4)}의 25%를 할인받을 수 있어요 (기본 요금 × 25% × 12개월)`,
        yearlySaving: won(feeAfterR4 * SELECTIVE_DISCOUNT_RATE * 12),
        source,
      });
    } else if (input.hasSelectiveDiscount === null) {
      findings.push({
        rule: "R1",
        kind: "check",
        title: "요금 25% 할인(선택약정) 받는지 확인",
        reason: selectiveCheckReason(input.planMonthlyFee, input.planDiscount),
        yearlySaving: 0,
        source,
      });
    }
  }

  // R2 안 쓰는 유료 부가서비스 (할인 뒤 실제로 내는 금액 기준)
  const unused = input.addons
    .map((a) => ({ ...a, net: a.monthlyFee - (a.discount ?? 0) }))
    .filter((a) => !a.used && a.net > 0);
  if (unused.length > 0) {
    const monthly = unused.reduce((s, a) => s + a.net, 0);
    findings.push({
      rule: "R2",
      kind: "saving",
      title: `안 쓰는 부가서비스 ${unused.length}개`,
      reason: `${unused.map((a) => a.name).join(", ")} 해지 시 (월 ${fmt(monthly)} × 12개월)`,
      yearlySaving: won(monthly * 12),
      source,
    });
  }

  // R3 곧 끝나는 프로모션
  for (const p of input.promotions) {
    if (p.endsInMonths > PROMO_SOON_MONTHS || p.monthlyDiscount <= 0) continue;
    const months = Math.max(0, 12 - p.endsInMonths);
    findings.push({
      rule: "R3",
      kind: "saving",
      title: p.endsInMonths === 0 ? `${p.name} 할인 종료됨` : `${p.name} 할인 ${p.endsInMonths}개월 뒤 종료`,
      reason: `종료 후 월 ${fmt(p.monthlyDiscount)} 오름 (인상분 × ${months}개월)`,
      yearlySaving: won(p.monthlyDiscount * months),
      source,
    });
  }

  // R4 사용량보다 큰 요금제
  if (cheaper) {
    const diff = input.planMonthlyFee - cheaper.monthlyFee;
    findings.push({
      rule: "R4",
      kind: "saving",
      title: "사용량보다 큰 요금제",
      reason: `${cheaper.name}(월 ${fmt(cheaper.monthlyFee)})로도 충분해요 (차액 × 12개월)`,
      yearlySaving: won(diff * 12),
      source,
    });
  }

  // R5 연체 가산금: 이번 달 낸 만큼을 "막을 수 있었던 돈"으로 셈 (반복 가정 안 함)
  if (input.lateFees && input.lateFees > 0) {
    findings.push({
      rule: "R5",
      kind: "saving",
      title: "연체료",
      reason: `이번 달 연체로 ${fmt(input.lateFees)}이 더 붙었어요. 자동이체 계좌 잔액과 납부일을 확인해 보세요`,
      yearlySaving: won(input.lateFees),
      source,
    });
  }

  // R6 평소보다 많이 나온 달 (확인 항목, 절감액에 넣지 않음)
  const past = input.pastTotals ?? [];
  if (input.totalAmount !== undefined && past.length >= 2) {
    const usual = median(past);
    const diff = input.totalAmount - usual;
    if (usual > 0 && input.totalAmount >= usual * SPIKE_RATIO && diff >= SPIKE_MIN_DIFF) {
      findings.push({
        rule: "R6",
        kind: "check",
        title: "평소보다 많이 나온 달",
        reason: `평소 ${fmt(usual)}인데 이번 달 ${fmt(input.totalAmount)}, ${fmt(diff)} 더 나왔어요. 상세 내역을 확인해 보세요`,
        yearlySaving: 0,
        source,
      });
    }
  }

  // R7 인터넷·TV 약정. 끝나도 요금이 바로 오르지 않는 경우가 많지만,
  // 재약정이나 통신사 이동 때 받을 혜택을 놓치게 됨. 혜택 금액은 통신사, 시기마다 달라 확인 항목으로 둠
  const r7 = input.contract ? r7Finding(input.contract, input.contractStartYear) : undefined;
  if (r7) findings.push({ rule: "R7", kind: "check", yearlySaving: 0, source, variant: input.contract, ...r7 });

  const sorted = sortFindings(findings.map((f) => ({ ...f, statementType: input.statementType })));
  return { findings: sorted, yearlyTotal: sumSavings(sorted) };
}

/** 보통 3년 약정 */
const CONTRACT_YEARS = 3;

function r7Finding(c: ContractState, startYear?: number): Pick<Finding, "title" | "reason" | "endYear"> | undefined {
  const endYear = startYear ? startYear + CONTRACT_YEARS : undefined;
  const when = startYear ? `${startYear}년에 설치했다면 보통 3년 약정이라 ${endYear}년에 ` : "";
  switch (c) {
    case "ended":
      return {
        title: "인터넷 약정 끝남",
        reason: `${when ? when + "끝났을 가능성이 높아요. " : ""}약정이 끝났으면 재약정 혜택(요금 할인, 상품권)이나 다른 통신사 가입 혜택을 받을 수 있어요. 그냥 두면 이 혜택을 놓쳐요`,
        endYear,
      };
    case "soon":
      return {
        title: "인터넷 약정 곧 끝남",
        reason: `${when ? when + "끝나요. " : ""}끝나기 전에 지금 통신사의 재약정 혜택과 다른 통신사 가입 혜택을 비교해 두면 좋아요`,
        endYear,
      };
    case "long":
      // 끝나는 해를 알 때만: 놓치지 않게 달력 알림을 걸어 둠
      return endYear
        ? { title: "인터넷 약정 끝날 때 알림 받기", reason: `${when}끝나요. 끝나기 전에 알림을 받아 두면 혜택을 놓치지 않아요`, endYear }
        : undefined;
    case "unknown":
      return {
        title: "인터넷 약정 끝나는 날 확인",
        reason: "보통 3년 약정이에요. 이미 끝났다면 재약정이나 통신사 이동 혜택을 받을 수 있어요",
      };
  }
}

/** 고지서 여러 장 (모바일, 단말대금, 인터넷·TV 등)을 한 번에 진단 */
export function diagnoseAll(inputs: BillInput[], catalog: CatalogPlan[] = []): Diagnosis {
  const all = inputs.flatMap((b) => diagnose(b, catalog).findings);
  const sorted = sortFindings(all);
  return { findings: sorted, yearlyTotal: sumSavings(sorted) };
}
