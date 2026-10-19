/** 고지서에서 읽어 내거나 사용자가 직접 고른 입력 */
export type Carrier = "SKT" | "KT" | "LGU" | "MVNO";

export interface Addon {
  name: string;
  /** 월 요금 (원) */
  monthlyFee: number;
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

export interface BillInput {
  carrier: Carrier;
  planName: string;
  /** 요금제 월정액 (할인 전, 원) */
  planMonthlyFee: number;
  /** 선택약정 할인을 받고 있는지 */
  hasSelectiveDiscount: boolean;
  addons: Addon[];
  promotions: Promotion[];
  /** 한 달 데이터 사용량 (GB), 모르면 비워 둠 */
  monthlyDataUsageGB?: number;
}

/** 요금제 표 (data/plans.json) 한 줄 */
export interface CatalogPlan {
  carrier: Carrier;
  name: string;
  monthlyFee: number;
  /** 기본 제공 데이터 (GB), 무제한은 Infinity 대신 9999 */
  dataGB: number;
}

export type RuleId = "R1" | "R2" | "R3" | "R4";

export interface Finding {
  rule: RuleId;
  title: string;
  /** 결과 카드에 그대로 보여 줄 근거 문장 */
  reason: string;
  /** 1년 절감액 (원) */
  yearlySaving: number;
}

export interface Diagnosis {
  findings: Finding[];
  yearlyTotal: number;
}
