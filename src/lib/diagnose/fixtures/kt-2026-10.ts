import type { BillInput } from "../types";

/**
 * 실제 KT 고지서(2026년 10월) 화면에서 금액만 옮긴 테스트 데이터.
 * 이름, 전화번호, 서비스 번호는 넣지 않음.
 * "used" 값은 사용자가 확인 화면에서 체크를 풀었다고 가정한 것.
 */

/** 모바일 통신요금 명세서 */
export const ktMobile: BillInput = {
  label: "모바일",
  carrier: "KT",
  planName: "(고지서에 요금제명 없음)",
  planMonthlyFee: 62728,
  // 월정액 할인 -9,220원이 합계로만 찍혀 선택약정인지 알 수 없음
  hasSelectiveDiscount: null,
  addons: [
    { name: "듀얼번호 Lite/투폰", monthlyFee: 3000, discount: 3000, used: false },
    { name: "캐치콜서비스", monthlyFee: 1000, used: false },
    { name: "KT365폰케어_파손", monthlyFee: 2100, used: false },
    { name: "KT365폰케어_파손_플러스서비스", monthlyFee: 3455, used: false },
  ],
  promotions: [],
  // 가산금 1,090 + 미납가산금 430
  lateFees: 1520,
};

/** 인터넷·TV 통합명세서, 9월 청구 기준 (평소보다 많이 나온 달) */
export const ktHomeSeptember: BillInput = {
  label: "인터넷·TV",
  carrier: "KT",
  planName: "인터넷 + TV라이트 2회선",
  planMonthlyFee: 0,
  hasSelectiveDiscount: true,
  addons: [],
  promotions: [],
  totalAmount: 104640,
  pastTotals: [44220, 44220],
};

/** 인터넷·TV 통합명세서, 10월 청구 기준 (평소와 같음) */
export const ktHomeOctober: BillInput = {
  ...ktHomeSeptember,
  totalAmount: 44220,
  pastTotals: [44220, 104640],
};
