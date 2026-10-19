import type { Carrier, RuleId, StatementType } from "./diagnose";

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

/** 한 화면에 들어가게 짧게. 114 는 세 통신사 공통 고객센터 번호 */
const CUSTOMER_CENTER = "114(통신사 고객센터)에 전화해도 돼요.";

const GUIDES: Record<Exclude<RuleId, "R7">, Guide> = {
  R1: {
    title: "요금 25% 할인(선택약정) 받기",
    steps: [
      "전화 키패드에 *#06# 을 눌러 휴대폰 고유번호(IMEI)를 봐요.",
      "스마트초이스에서 그 번호로 25% 할인 대상인지 조회해요.",
      "대상이면 통신사 앱이나 대리점에서 신청해요. " + CUSTOMER_CENTER,
    ],
    caution: "12개월이나 24개월 약정이라, 중간에 그만두면 할인받은 돈 일부를 돌려내야 할 수 있어요.",
    link: { label: "스마트초이스", href: "https://www.smartchoice.or.kr" },
  },
  R2: {
    title: "안 쓰는 부가서비스 해지",
    steps: [
      "통신사 앱에서 지금 가입된 부가서비스 목록을 열어요.",
      "결과에 나온 서비스를 하나씩 해지해요. " + CUSTOMER_CENTER,
      "다음 달 고지서에서 해당 금액이 빠졌는지 확인해요.",
    ],
    caution: "폰케어 같은 파손, 분실 보험은 끄면 보장도 끝나고, 다시 가입이 안 될 수 있어요.",
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
    title: "연체료 다시 안 붙게 하기",
    steps: [
      "고지서에서 미납 금액과 납부일을 확인해요.",
      "은행 앱에서 자동이체가 살아 있는지, 납부일에 잔액이 충분한지 봐요.",
      "자동이체가 없으면 통신사 앱에서 자동이체를 등록해요. " + CUSTOMER_CENTER,
    ],
  },
  R6: {
    title: "많이 나온 달 확인하기",
    steps: [
      "그 달 요금 상세 내역에서 평소에 없던 항목을 찾아요 (소액결제, 콘텐츠 구매, 설치비, 위약금 등).",
      "모르는 항목이 있으면 통신사에 무엇인지 물어봐요. " + CUSTOMER_CENTER,
      "잘못 청구된 것이면 정정이나 환불을 요청해요.",
    ],
  },
};

const RULE_CHECK_SELECTIVE: Guide = {
  title: "요금 25% 할인 받는지 확인",
  steps: [
    "통신사 앱의 할인 내역에 '선택약정'이나 '요금할인 25%'가 있는지 봐요.",
    "없으면 전화 키패드에 *#06# 을 눌러 휴대폰 고유번호(IMEI)를 보고, 스마트초이스에서 대상인지 조회해요.",
    "대상이면 통신사 앱이나 대리점에서 신청해요. " + CUSTOMER_CENTER,
  ],
  caution: "12개월이나 24개월 약정이라, 중간에 그만두면 할인받은 돈 일부를 돌려내야 할 수 있어요.",
  link: { label: "스마트초이스", href: "https://www.smartchoice.or.kr" },
};

/**
 * R7 인터넷·TV 약정. 약정이 끝나도 요금이 바로 오르지 않는 경우가 많아,
 * "요금이 오른다"가 아니라 "받을 수 있는 혜택을 놓친다"로 안내한다.
 * 혜택 금액은 통신사와 시기마다 달라 적지 않는다.
 */
const SWITCH_CAUTION = "옮기면 설치비가 들 수 있고, 휴대폰과 묶은 결합 할인이 바뀔 수 있어요.";
const R7_GUIDES: Record<string, Guide> = {
  ended: {
    title: "인터넷 재약정 혜택 챙기기",
    steps: [
      "지금 통신사에 재약정하면 어떤 혜택(요금 할인, 상품권)을 주는지 물어봐요. " + CUSTOMER_CENTER,
      "다른 통신사에 새로 가입할 때 혜택(사은품, 요금)도 알아봐요.",
      "3년 동안 내는 돈과 받는 혜택을 합쳐 더 나은 쪽으로 정해요. 약정이 끝났으면 옮겨도 위약금이 없어요.",
    ],
    caution: SWITCH_CAUTION,
  },
  soon: {
    title: "인터넷 약정 끝나기 전에 비교하기",
    steps: [
      "약정이 끝나는 달을 달력에 적어 둬요.",
      "끝나기 한두 달 전에 지금 통신사의 재약정 혜택을 물어봐요. " + CUSTOMER_CENTER,
      "다른 통신사 가입 혜택과 3년 동안 내는 돈으로 비교해요.",
    ],
    caution: "약정 중에 해지하면 위약금이 있어요. 옮긴다면 끝난 뒤에 옮기세요.",
  },
  unknown: {
    title: "인터넷 약정 끝나는 날 확인하기",
    steps: [
      "통신사 앱이나 홈페이지의 가입 정보에서 약정 기간을 봐요.",
      "못 찾으면 114(통신사 고객센터)에 물어봐요.",
      "이미 끝났거나 곧 끝나면 재약정 혜택과 다른 통신사 가입 혜택을 비교해요.",
    ],
    caution: "통신사에 따라 약정이 끝나도 문자로 알려 주지 않기도 해요.",
  },
};

/**
 * 알뜰폰 가입자는 114 가 아니라 가입한 알뜰폰 회사 고객센터와 앱을 써야 함.
 * 인터넷·TV 는 알뜰폰이 아니라 큰 통신사에서 쓰므로 그대로 둠
 */
function forMvno(g: Guide): Guide {
  const fix = (t: string) =>
    t
      .replace("114(통신사 고객센터)에", "가입한 알뜰폰 회사 고객센터에")
      .replace("통신사 앱이나 대리점에서", "알뜰폰 회사 앱이나 고객센터에서")
      .replace(/통신사 앱/g, "알뜰폰 회사 앱");
  return { ...g, steps: g.steps.map(fix), caution: g.caution && fix(g.caution) };
}

/** kind 가 check 인 R1 은 확인 가이드, R7 은 약정 상황별 가이드 */
export function guideFor(
  rule: RuleId,
  kind: "saving" | "check",
  carrier?: Carrier,
  variant?: string,
  statementType?: StatementType,
): Guide {
  const g =
    rule === "R1" && kind === "check"
      ? RULE_CHECK_SELECTIVE
      : rule === "R7"
        ? (R7_GUIDES[variant ?? "unknown"] ?? R7_GUIDES.unknown)
        : GUIDES[rule];
  return carrier === "MVNO" && statementType !== "home" ? forMvno(g) : g;
}
