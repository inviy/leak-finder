import { KIND_LABEL, newAddon, newStatement, type StatementDraft } from "../draft";
import type { Extracted, ExtractedItem, ExtractedStatement } from "./schema";

/** 원 단위 절사(10원 미만 할인 등)로 생기는 차이는 허용 */
export const SUM_TOLERANCE = 10;
/** 부가가치세율 */
export const VAT_RATE = 0.1;

export interface ReconcileWarning {
  label: string;
  message: string;
}

export interface Reconciled {
  drafts: StatementDraft[];
  warnings: ReconcileWarning[];
}

const fmt = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const has = (it: ExtractedItem, ...words: string[]) =>
  words.some((w) => it.section.includes(w) || it.name.includes(w));

const isPlan = (it: ExtractedItem) => it.section.includes("월정액") || it.name === "월정액" || it.name.includes("기본료");
const isAddon = (it: ExtractedItem) => it.section.includes("부가서비스");
const isLateFee = (it: ExtractedItem) => has(it, "가산금");

/** 항목을 더한 값 (이용금액 - 할인) */
export function itemsNet(items: ExtractedItem[]): number {
  return items.reduce((s, it) => s + it.amount - it.discount, 0);
}

function toDraft(s: ExtractedStatement): StatementDraft {
  const d = newStatement(s.kind);
  if (s.kind === "mobile") {
    const plan = s.items.find(isPlan);
    if (plan) {
      d.planMonthlyFee = String(plan.amount);
      // 할인이 합계로만 찍혀 무슨 할인인지 알 수 없음 → 사용자가 확인
      d.selective = plan.discount > 0 ? "unknown" : "no";
    }
  }
  if (s.kind !== "device") {
    d.addons = s.items.filter(isAddon).map((it) => ({
      ...newAddon(),
      name: it.name,
      fee: String(it.amount),
      discount: it.discount ? String(it.discount) : "",
      used: true,
    }));
  }
  const late = s.items.filter(isLateFee).reduce((sum, it) => sum + it.amount - it.discount, 0);
  if (late > 0) d.lateFees = String(late);
  if (s.total !== null) d.totalAmount = String(s.total);
  if (s.pastTotals.length > 0) d.pastTotals = s.pastTotals.join(", ");
  return d;
}

/**
 * 모델이 읽은 결과를 화면 입력값으로 바꾸고, 항목 합과 요금계가 맞는지 검산.
 * 안 맞으면 경고를 붙여 확인 화면에서 사용자가 고치게 한다.
 */
export function reconcile(x: Extracted): Reconciled {
  const drafts: StatementDraft[] = [];
  const warnings: ReconcileWarning[] = [];
  const seen = new Map<string, number>();

  for (const s of x.statements) {
    const d = toDraft(s);
    // 같은 종류가 여러 장이면 "모바일 2" 처럼 구분
    const n = (seen.get(s.kind) ?? 0) + 1;
    seen.set(s.kind, n);
    if (n > 1) d.label = `${KIND_LABEL[s.kind]} ${n}`;
    drafts.push(d);

    if (s.total !== null && s.items.length > 0) {
      const net = itemsNet(s.items);
      // 인터넷·TV 명세서는 항목이 부가세 전 금액이고 요금계만 부가세 포함인 경우가 있음
      const matches = [net, net * (1 + VAT_RATE)].some((v) => Math.abs(v - s.total!) <= SUM_TOLERANCE);
      if (!matches) {
        warnings.push({
          label: d.label,
          message: `읽은 항목을 더하면 ${fmt(net)}인데 요금계는 ${fmt(s.total)}이에요. 빠지거나 잘못 읽은 금액이 있는지 확인해 주세요.`,
        });
      }
    } else if (s.total === null) {
      warnings.push({ label: d.label, message: "요금계를 읽지 못했어요. 이번 달 청구 합계를 직접 넣어 주세요." });
    }
  }

  return { drafts, warnings };
}
