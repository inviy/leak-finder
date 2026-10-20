/**
 * 모델이 고지서 캡처에서 읽어 낸 결과의 모양과 검증.
 * 모델 출력은 신뢰하지 않는 입력이므로, 여기서 모양과 범위를 확인한 값만 앞으로 넘긴다.
 */

export type ExtractedKind = "mobile" | "device" | "home";

export interface ExtractedItem {
  /** 고지서 묶음 이름, 예: "월정액", "부가서비스 이용료", "가산금" */
  section: string;
  /** 항목 이름, 예: "캐치콜서비스" */
  name: string;
  /** 이용금액 (원) */
  amount: number;
  /** 할인금액 (원, 양수) */
  discount: number;
}

export interface ExtractedStatement {
  kind: ExtractedKind;
  items: ExtractedItem[];
  /** 이 명세서의 요금계 (원), 못 읽으면 null */
  total: number | null;
  /** 지난 달 청구 합계 (오래된 달부터) */
  pastTotals: number[];
}

/** 카드, 은행 결제 내역 한 줄 (구독 찾기용) */
export interface ExtractedPayment {
  /** 가맹점 이름 그대로, 예: "NETFLIX.COM", "쿠팡(와우멤버십)" */
  merchant: string;
  /** 결제 금액 (원, 양수) */
  amount: number;
  /** 결제일 "YYYY-MM-DD", 안 보이면 null */
  date: string | null;
}

export interface Extracted {
  statements: ExtractedStatement[];
  payments: ExtractedPayment[];
}

const LIMITS = {
  statements: 6,
  items: 60,
  text: 60,
  /** 한 항목이 이보다 크면 잘못 읽은 것으로 봄 (원) */
  amount: 10_000_000,
  pastTotals: 12,
  payments: 80,
};

const KINDS: ExtractedKind[] = ["mobile", "device", "home"];

/** 화면에 보일 글자만 남김: 제어문자 제거, 길이 제한 */
function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (s === "") return null;
  return s.slice(0, LIMITS.text);
}

/** 숫자 또는 "62,728원" 같은 문자열 → 정수 원 */
function toWon(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const neg = /^\s*-/.test(v);
    const d = v.replace(/[^\d]/g, "");
    if (d === "") return null;
    n = Number(d) * (neg ? -1 : 1);
  } else return null;
  if (!Number.isFinite(n)) return null;
  n = Math.round(n);
  if (Math.abs(n) > LIMITS.amount) return null;
  return n;
}

export class ExtractError extends Error {}

/** "YYYY-MM-DD" 이면서 실제로 있는 날짜인지 (2026-13-40 같은 값은 버림) */
function isRealDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** 모델 응답 문자열에서 첫 JSON 객체를 꺼냄 (```json 블록이나 앞뒤 설명이 붙어도) */
export function pickJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ExtractError("응답에 JSON 이 없음");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new ExtractError("JSON 해석 실패");
  }
}

/** 모양이 틀린 항목은 버리고, 남은 것이 하나도 없으면 실패 */
export function validateExtracted(raw: unknown): Extracted {
  if (!raw || typeof raw !== "object") throw new ExtractError("객체가 아님");
  const list = (raw as { statements?: unknown }).statements;
  if (!Array.isArray(list)) throw new ExtractError("statements 없음");

  const statements: ExtractedStatement[] = [];
  for (const s of list.slice(0, LIMITS.statements)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const kind = KINDS.includes(o.kind as ExtractedKind) ? (o.kind as ExtractedKind) : "mobile";

    const items: ExtractedItem[] = [];
    for (const it of Array.isArray(o.items) ? o.items.slice(0, LIMITS.items) : []) {
      if (!it || typeof it !== "object") continue;
      const r = it as Record<string, unknown>;
      const name = cleanText(r.name);
      const amount = toWon(r.amount);
      if (!name || amount === null) continue;
      const discount = Math.abs(toWon(r.discount) ?? 0);
      items.push({ section: cleanText(r.section) ?? "", name, amount, discount });
    }

    const total = o.total === null || o.total === undefined ? null : toWon(o.total);
    const pastTotals = (Array.isArray(o.pastTotals) ? o.pastTotals : [])
      .slice(0, LIMITS.pastTotals)
      .map(toWon)
      .filter((n): n is number => n !== null && n >= 0);

    if (items.length === 0 && total === null) continue;
    statements.push({ kind, items, total, pastTotals });
  }

  // 카드, 은행 결제 내역: 가맹점과 금액이 있는 줄만, 카드 번호처럼 보이는 글은 버림
  const payments: ExtractedPayment[] = [];
  const plist = (raw as { payments?: unknown }).payments;
  for (const it of Array.isArray(plist) ? plist.slice(0, LIMITS.payments) : []) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    // 모델이 실수로 붙인 카드 번호 일부("본인 850*", "1234****")는 지움
    const merchant = cleanText(
      typeof r.merchant === "string"
        ? r.merchant.replace(/(본인|가족)?\s*\d{2,4}\*+(\d|\*)*/g, " ").replace(/(본인|가족)\s*$/g, "")
        : r.merchant,
    );
    const amount = toWon(r.amount);
    if (!merchant || amount === null || amount === 0) continue;
    if (/\d{4}[-\s*]?\d{4}[-\s*]?\d{4}/.test(merchant)) continue;
    const date = typeof r.date === "string" && isRealDate(r.date) ? r.date : null;
    payments.push({ merchant, amount: Math.abs(amount), date });
  }

  if (statements.length === 0 && payments.length === 0) throw new ExtractError("읽어 낸 명세서가 없음");
  return { statements, payments };
}
