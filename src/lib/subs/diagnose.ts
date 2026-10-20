import type { Finding } from "../diagnose";
import { CATEGORY_LABEL, SUB_SERVICES, type SubCategory } from "./catalog";
import { duplicateGroups, telecomOverlaps } from "./detect";

/** 확인 화면에서 사용자가 고른 상태까지 담은 구독 */
export interface SubInput {
  key: string;
  name: string;
  category: SubCategory | "other";
  monthly: number;
  /** 사용자가 "안 쓰는 구독"으로 고르지 않았으면 true */
  used: boolean;
  /** 20일 안에 두 번 결제된 날짜 */
  doubled?: [string, string];
}

/** 2026-10-03 → 10/3 */
const md = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}`;
};

const fmt = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const SOURCE = "카드 결제";

/**
 * S1 안 쓰는 구독 (사용자가 고른 것, 절감)
 * S2 같은 종류 구독이 여러 개 (확인)
 * S3 통신 고지서 부가서비스에 있는 서비스를 카드로 또 결제 (확인, 금액이 크고 확실한 편이라 확인 항목 맨 앞)
 * S4 같은 구독이 한 달 안에 두 번 결제됨 (확인, 계정 두 개나 가족 결제일 수 있음)
 */
export function diagnoseSubs(subs: SubInput[], telecomItemNames: string[] = []): Finding[] {
  const out: Finding[] = [];

  const unused = subs.filter((s) => !s.used && s.monthly > 0);
  if (unused.length > 0) {
    const monthly = unused.reduce((a, s) => a + s.monthly, 0);
    out.push({
      rule: "S1",
      kind: "saving",
      title: `안 쓰는 구독 ${unused.length}개`,
      reason: `${unused.map((s) => s.name).join(", ")} 해지 시 (월 ${fmt(monthly)} × 12개월)`,
      yearlySaving: monthly * 12,
      source: SOURCE,
    });
  }

  // 남겨 둔 것들 중 같은 종류가 여러 개면 정리 권유
  const kept = subs.filter((s) => s.used);
  for (const g of duplicateGroups(kept)) {
    const cheapestOthers = [...g.subs].sort((a, b) => b.monthly - a.monthly).slice(1);
    const save = cheapestOthers.reduce((a, s) => a + s.monthly, 0);
    out.push({
      rule: "S2",
      kind: "check",
      title: `${g.label} 구독 ${g.subs.length}개`,
      reason: `${g.subs.map((s) => s.name).join(", ")}. 하나만 남기면 1년에 약 ${fmt(save * 12)}을 아낄 수 있어요`,
      yearlySaving: 0,
      source: SOURCE,
      variant: g.category,
    });
  }

  for (const id of telecomOverlaps(kept.map((s) => s.key), telecomItemNames)) {
    const s = kept.find((x) => x.key === id)!;
    const name = SUB_SERVICES.find((x) => x.id === id)?.name ?? s.name;
    out.push({
      rule: "S3",
      kind: "check",
      title: `${name} 두 번 내는 중일 수 있음`,
      reason: `통신 고지서에도 ${name}이 있는데 카드로도 결제하고 있어요. 하나만 남기면 1년에 약 ${fmt(s.monthly * 12)}을 아낄 수 있어요`,
      yearlySaving: 0,
      source: SOURCE,
    });
  }
  const doubled = kept.filter((s) => s.doubled && s.monthly > 0);
  if (doubled.length > 0) {
    const monthly = doubled.reduce((a, s) => a + s.monthly, 0);
    const which = doubled.map((s) => `${s.name}(${md(s.doubled![0])}, ${md(s.doubled![1])})`).join(", ");
    out.push({
      rule: "S4",
      kind: "check",
      title: doubled.length === 1 ? `${doubled[0].name} 한 달에 두 번 결제` : `구독 ${doubled.length}개가 한 달에 두 번 결제`,
      reason: `${which}. 계정이 두 개이거나 가족이 따로 내고 있을 수 있어요. 하나로 합치면 1년에 약 ${fmt(monthly * 12)}을 아낄 수 있어요`,
      yearlySaving: 0,
      source: SOURCE,
    });
  }
  return out;
}

export { CATEGORY_LABEL };
