/** 고지서에서 읽어 내거나 사용자가 직접 고른 입력 */
export type Carrier = "SKT" | "KT" | "LGU" | "MVNO";

export interface Addon {
  name: string;
  /** 월 이용금액 (원) */
  monthlyFee: number;
  /** 고지서에 찍힌 할인금액 (원, 양수로). 없으면 0 */
  discount?: number;
  /** 사용자가 "쓰고 있음"으로 체크했는지 */
  used: boolean;
}

export interface Promotion {
  name: string;
  /** 지금 받고 있는 월 할인액 (원) */
  monthlyDiscount: number;
  /** 할인이 끝나기까지 남은 개월 (이미 끝났으면 0) */
  endsInMonths: number;
}

/** 고지서 한 장 (모바일, 인터넷·TV 등 명세서 단위) */
export interface BillInput {
  /** 결과 카드에 보일 이름, 예: "모바일", "인터넷·TV" */
  label?: string;
  carrier: Carrier;
  planName: string;
  /** 요금제 월정액 (할인 전, 원). 요금제가 없는 명세서(단말대금 등)는 0 */
  planMonthlyFee: number;
  /** 월정액 줄에 찍힌 할인금액 (원, 양수). 무슨 할인인지는 모를 수 있음 */
  planDiscount?: number;
  /**
   * 선택약정 할인을 받고 있는지.
   * null = 고지서만으로 알 수 없음 (할인이 합계로만 찍힌 경우)
   */
  hasSelectiveDiscount: boolean | null;
  addons: Addon[];
  promotions: Promotion[];
  /** 이번 달 연체 가산금 합계 (가산금 + 미납가산금, 원) */
  lateFees?: number;
  /** 이번 달 청구 합계 (원) */
  totalAmount?: number;
  /** 지난 달들의 청구 합계 (원, 오래된 달부터). R6 비교용 */
  pastTotals?: number[];
  /** 한 달 데이터 사용량 (GB), 모르면 비워 둠 */
  monthlyDataUsageGB?: number;
}

/** 요금제 표 (data/plans.json) 한 줄 */
export interface CatalogPlan {
  carrier: Carrier;
  name: string;
  monthlyFee: number;
  /** 기본 제공 데이터 (GB), 무제한은 9999 */
  dataGB: number;
}

export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

/**
 * saving = 줄일 수 있는 돈 (1년 절감액에 합산)
 * check  = 사용자가 확인해 봐야 하는 것 (합산하지 않음)
 */
export type FindingKind = "saving" | "check";

export interface Finding {
  rule: RuleId;
  kind: FindingKind;
  title: string;
  /** 결과 카드에 그대로 보여 줄 근거 문장 */
  reason: string;
  /** 1년 절감액 (원). check 는 0 */
  yearlySaving: number;
  /** 어느 명세서에서 나왔는지 */
  source?: string;
}

export interface Diagnosis {
  findings: Finding[];
  /** saving 항목만 합산 */
  yearlyTotal: number;
}
