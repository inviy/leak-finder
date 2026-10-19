import type { Carrier, RuleId } from "./diagnose";

/**
 * 진단 항목별 조치 가이드.
 * 통신사 앱 메뉴 이름과 경로는 통신사마다 다르고 자주 바뀌므로 적지 않는다.
 * 모든 통신사에 똑같이 맞는 방법(IMEI 확인, 스마트초이스, 고객센터 114 등)만 적는다.
 */
export interface Guide {
  title: string;
  steps: string[];
  /** 하기 전에 알아 둘 것 */
  caution?: string;
  link?: { label: string; href: string };
}

const CUSTOMER_CENTER = "휴대폰에서 114로 전화해 상담원에게 요청해도 돼요 (통신사 고객센터).";

const GUIDES: Record<RuleId, Guide> = {
  R1: {
    title: "선택약정 할인 받기",
    steps: [
      "휴대폰 전화 앱 키패드에 *#06# 을 눌러 단말기 고유번호(IMEI)를 확인해요.",
      "스마트초이스에서 그 번호로 25% 요금할인을 받을 수 있는지 조회해요.",
      "가능하면 통신사 앱의 요금할인 신청 메뉴나 대리점에서 신청해요. " + CUSTOMER_CENTER,
    ],
    caution: "12개월 또는 24개월 약정이에요. 기간 안에 해지하면 할인받은 금액 일부를 돌려내야 할 수 있어요.",
    link: { label: "스마트초이스", href: "https://www.smartchoice.or.kr" },
  },
  R2: {
    title: "안 쓰는 부가서비스 해지",
    steps: [
      "통신사 앱에서 지금 가입된 부가서비스 목록을 열어요.",
      "결과에 나온 서비스를 하나씩 해지해요. " + CUSTOMER_CENTER,
      "다음 달 고지서에서 해당 금액이 빠졌는지 확인해요.",
    ],
    caution: "폰케어처럼 파손, 분실 보험인 서비스는 해지하면 보장도 끝나요. 해지 후에는 다시 가입이 안 되는 경우도 있어요.",
  },
  R3: {
    title: "끝나는 할인 미리 챙기기",
    steps: [
      "할인이 끝나는 달을 달력에 적어 둬요.",
      "끝나기 전에 같은 할인을 연장하거나 다른 할인으로 바꿀 수 있는지 통신사에 물어봐요. " + CUSTOMER_CENTER,
      "연장이 안 되면 요금제나 통신사를 바꾸는 것이 나은지 비교해요.",
    ],
  },
  R4: {
    title: "사용량에 맞는 요금제로 바꾸기",
    steps: [
      "최근 몇 달 데이터 사용량을 통신사 앱에서 확인해요.",
      "결과에 나온 요금제로 바꿔도 사용량이 충분한지 다시 확인해요.",
      "통신사 앱이나 고객센터에서 요금제를 바꿔요. " + CUSTOMER_CENTER,
    ],
    caution: "약정이나 결합 할인이 요금제에 묶여 있으면 바꿀 때 할인이 줄어들 수 있어요. 바꾸기 전에 꼭 물어보세요.",
  },
  R5: {
    title: "연체 가산금 다시 안 붙게 하기",
    steps: [
      "고지서에서 미납 금액과 납부일을 확인해요.",
      "자동이체 계좌의 잔액이 납부일에 충분한지, 자동이체가 해지되지 않았는지 은행 앱에서 확인해요.",
      "자동이체가 없으면 통신사 앱에서 자동이체를 등록해요. " + CUSTOMER_CENTER,
    ],
  },
  R6: {
    title: "많이 나온 달 확인하기",
    steps: [
      "그 달 상세 명세서에서 평소에 없던 항목을 찾아요 (소액결제, 콘텐츠 구매, 설치비, 위약금 등).",
      "모르는 항목이 있으면 통신사에 무엇인지 물어봐요. " + CUSTOMER_CENTER,
      "잘못 청구된 것이면 정정이나 환불을 요청해요.",
    ],
  },
};

const RULE_CHECK_SELECTIVE: Guide = {
  title: "선택약정 할인 받고 있는지 확인",
  steps: [
    "통신사 앱이나 홈페이지에서 할인상세 내역 화면을 열어요.",
    "'선택약정' 또는 '요금할인 25%' 항목이 있는지 봐요.",
    "없으면 휴대폰 전화 앱 키패드에 *#06# 을 눌러 단말기 고유번호(IMEI)를 확인하고, 스마트초이스에서 25% 요금할인 대상인지 조회해요.",
    "대상이면 통신사 앱의 요금할인 신청 메뉴나 대리점에서 신청해요. " + CUSTOMER_CENTER,
  ],
  caution: "12개월 또는 24개월 약정이에요. 기간 안에 해지하면 할인받은 금액 일부를 돌려내야 할 수 있어요.",
  link: { label: "스마트초이스", href: "https://www.smartchoice.or.kr" },
};

/** 알뜰폰은 선택약정 대상이 아니라 다른 안내가 필요 없음. kind 가 check 인 R1 은 확인 가이드 */
export function guideFor(rule: RuleId, kind: "saving" | "check", carrier?: Carrier): Guide {
  void carrier;
  if (rule === "R1" && kind === "check") return RULE_CHECK_SELECTIVE;
  return GUIDES[rule];
}
