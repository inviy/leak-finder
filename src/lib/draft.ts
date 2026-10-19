import type { BillInput, Carrier } from "./diagnose";

/** 화면에서 편집하는 명세서 한 장 (입력 중이라 숫자는 문자열) */
export type StatementKind = "mobile" | "device" | "home";
export type Selective = "yes" | "no" | "unknown";

export interface AddonDraft {
  id: string;
  name: string;
  fee: string;
  discount: string;
  used: boolean;
}

export interface StatementDraft {
  id: string;
  kind: StatementKind;
  label: string;
  planMonthlyFee: string;
  /** 월정액 줄의 할인금액 */
  planDiscount: string;
  selective: Selective;
  addons: AddonDraft[];
  lateFees: string;
  totalAmount: string;
  /** 지난 달 청구액, 쉼표나 공백으로 구분 */
  pastTotals: string;
}

export const KIND_LABEL: Record<StatementKind, string> = {
  mobile: "휴대폰",
  device: "휴대폰 할부금",
  home: "인터넷·TV",
};

// 서버 렌더와 브라우저에서 같은 순서로 만들어지도록 시각, 난수를 쓰지 않음
let seq = 0;
export const newId = () => `d${(seq++).toString(36)}`;

export function newAddon(): AddonDraft {
  return { id: newId(), name: "", fee: "", discount: "", used: true };
}

export function newStatement(kind: StatementKind): StatementDraft {
  return {
    id: newId(),
    kind,
    label: KIND_LABEL[kind],
    planMonthlyFee: "",
    planDiscount: "",
    selective: kind === "mobile" ? "unknown" : "yes",
    addons: [],
    lateFees: "",
    totalAmount: "",
    pastTotals: "",
  };
}

/** "62,728" / "62728원" / "" → 숫자 (빈 값은 undefined) */
/** 입력칸 표시용: "62728" → "62,728". 숫자 아닌 글자는 버림 */
export function formatWon(s: string): string {
  const digits = s.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseWon(s: string): number | undefined {
  const digits = s.replace(/[^\d]/g, "");
  if (digits === "") return undefined;
  return Number(digits);
}

/**
 * "44,220, 104,640 / 44220" → [44220, 104640, 44220]
 * 쉼표가 천 단위 구분과 목록 구분에 같이 쓰이므로, 세 자리 묶음 숫자를 하나로 읽음
 */
export function parseWonList(s: string): number[] {
  return (s.match(/\d{1,3}(?:,\d{3})+|\d+/g) ?? []).map((t) => Number(t.replace(/,/g, "")));
}

export function toBillInput(d: StatementDraft, carrier: Carrier): BillInput {
  const selective = d.selective === "yes" ? true : d.selective === "no" ? false : null;
  return {
    label: d.label || KIND_LABEL[d.kind],
    carrier,
    planName: "",
    // 요금제가 있는 건 모바일만. 단말대금, 인터넷·TV 는 R1 판단 안 함
    planMonthlyFee: d.kind === "mobile" ? parseWon(d.planMonthlyFee) ?? 0 : 0,
    planDiscount: d.kind === "mobile" ? parseWon(d.planDiscount) : undefined,
    hasSelectiveDiscount: selective,
    addons: d.addons
      .filter((a) => a.name.trim() !== "" && parseWon(a.fee) !== undefined)
      .map((a) => ({
        name: a.name.trim(),
        monthlyFee: parseWon(a.fee) ?? 0,
        discount: parseWon(a.discount) ?? 0,
        used: a.used,
      })),
    promotions: [],
    lateFees: parseWon(d.lateFees),
    totalAmount: parseWon(d.totalAmount),
    pastTotals: parseWonList(d.pastTotals),
  };
}
