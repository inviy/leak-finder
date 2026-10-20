import type { ExtractedPayment } from "../extract/schema";
import { CATEGORY_LABEL, matchService, SUB_SERVICES, type SubCategory } from "./catalog";

/** 찾은 정기결제 한 건 (확인 화면, 진단 입력) */
export interface FoundSub {
  /** 서비스 id, 목록에 없는 반복 결제는 "repeat:가맹점" */
  key: string;
  name: string;
  category: SubCategory | "other";
  /** 가장 최근 결제 금액 (원) */
  monthly: number;
  /** 명세서에서 몇 번 보였는지 */
  seen: number;
  /** 목록에 없지만 같은 곳에 같은 금액이 2번 이상 → 정기결제로 보임 */
  guessed: boolean;
}

/** 정기결제가 아닌 돈 흐름 (현금 인출, 사람에게 보내는 이체 등) */
const NOT_SUBSCRIPTION = /ATM|출금|현금|송금|이체|입금|환불|취소/i;

const DAY = 86_400_000;
/** 같은 금액 결제 두 건이 "한 달 간격"인지 (25~35일, 또는 두 달 간격 55~65일) */
function monthlyApart(dates: string[]): boolean {
  const ts = dates.map((d) => Date.parse(d)).sort((a, b) => a - b);
  for (let i = 1; i < ts.length; i++) {
    const gap = (ts[i] - ts[i - 1]) / DAY;
    if ((gap >= 25 && gap <= 35) || (gap >= 55 && gap <= 65)) return true;
  }
  return false;
}

const latest = (ps: ExtractedPayment[]) =>
  [...ps].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];

/**
 * 카드 결제 내역에서 정기결제 찾기
 * 1. 구독 목록에 있는 가맹점
 * 2. 목록에 없어도 같은 가맹점에 같은 금액이 한 달 간격으로 2번 이상
 *    (같은 주유소에 같은 날, 같은 주에 넣은 것이나 ATM 출금은 정기결제가 아님)
 */
export function detectSubscriptions(payments: ExtractedPayment[]): FoundSub[] {
  const byService = new Map<string, ExtractedPayment[]>();
  const rest = new Map<string, ExtractedPayment[]>();
  for (const p of payments) {
    const s = matchService(p.merchant);
    // "자동이체 넷플릭스"처럼 알려진 구독이면 먼저 잡고, 아닌 것 중 현금, 이체는 버림
    if (!s && NOT_SUBSCRIPTION.test(p.merchant)) continue;
    const map = s ? byService : rest;
    const k = s ? s.id : p.merchant.replace(/\s+/g, " ").trim();
    map.set(k, [...(map.get(k) ?? []), p]);
  }

  const found: FoundSub[] = [];
  for (const [id, ps] of byService) {
    const s = SUB_SERVICES.find((x) => x.id === id)!;
    found.push({ key: id, name: s.name, category: s.category, monthly: latest(ps).amount, seen: ps.length, guessed: false });
  }
  for (const [merchant, ps] of rest) {
    const byAmount = new Map<number, string[]>();
    for (const p of ps) if (p.date) byAmount.set(p.amount, [...(byAmount.get(p.amount) ?? []), p.date]);
    const repeated = [...byAmount.entries()].find(([, dates]) => dates.length >= 2 && monthlyApart(dates));
    if (repeated) {
      found.push({ key: `repeat:${merchant}`, name: merchant, category: "other", monthly: repeated[0], seen: repeated[1].length, guessed: true });
    }
  }
  return found.sort((a, b) => b.monthly - a.monthly);
}

/** 같은 종류 구독이 2개 이상인 묶음 (예: 영상 3개) */
export function duplicateGroups(subs: { category: SubCategory | "other"; name: string; monthly: number }[]) {
  const groups = new Map<SubCategory, typeof subs>();
  for (const s of subs) {
    if (s.category === "other" || s.category === "appstore") continue;
    groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([category, list]) => ({ category, label: CATEGORY_LABEL[category], subs: list }));
}

/** 통신 고지서 부가서비스에 이미 있는 서비스를 카드로 또 결제 중인지 */
export function telecomOverlaps(subKeys: string[], telecomItemNames: string[]): string[] {
  return SUB_SERVICES.filter(
    (s) => subKeys.includes(s.id) && s.telecomPatterns?.some((p) => telecomItemNames.some((n) => p.test(n))),
  ).map((s) => s.id);
}
