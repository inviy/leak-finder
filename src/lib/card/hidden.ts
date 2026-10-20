import type { Finding } from "../diagnose/types";
import type { Extracted, ExtractedPayment } from "../extract/schema";

/**
 * 카드 명세서, 할부금 고지서에 찍혀 있지만 회사가 굳이 알려 주지 않는 비용.
 *
 * H1 리볼빙 (명세서에는 "일부결제금액이월약정"으로 찍혀 가입 사실을 모르는 경우가 많음)
 * H2 해외 원화결제 (원화로 결제하면 환전이 두 번 일어나 수수료가 더 붙음)
 * H3 카드 채무면제·유예 상품 (발급할 때 같이 가입되고 매달 소액이라 눈에 안 띔)
 * H4 휴대폰 단말기 할부수수료 (할부금에 붙는 이자)
 *
 * 모두 "확인" 항목: 지금 얼마가 새는지는 보이지만, 끄는 게 맞는지는 사용자 사정에 따라 다름.
 */

const REVOLVING = /리볼빙|이월\s*약정|일부\s*결제\s*금액\s*이월|결제\s*금액\s*이월|이월\s*(수수료|이자)/;
const DEBT_PROTECTION = /채무\s*(면제|유예)|DCDS/i;
const DCC = /원화\s*결제|\bDCC\b/i;
const FOREIGN = /\(해외\)|해외\s*(이용|결제|승인|사용)/;
const INSTALLMENT_FEE = /할부\s*(수수료|이자)/;

/** 구독 찾기에서 빼야 하는 카드 비용 줄 (수수료, 이자, 이월, 연회비) */
// "이자카야", "이월드" 같은 가게 이름은 빼려고 이자, 이월은 붙는 말까지 봄
export const CARD_FEE_ROW =
  /수수료|연회비|리볼빙|DCDS|채무\s*(면제|유예)|이월\s*(약정|금액|잔액|수수료|이자)|(할부|연체|결제)\s*이자|이자\s*$/i;

const fmt = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const sum = (ps: ExtractedPayment[]) => ps.reduce((a, p) => a + p.amount, 0);
const CARD = "카드 명세서";

export function diagnoseHidden(x: Extracted): Finding[] {
  const out: Finding[] = [];
  const pays = x.payments ?? [];

  const revolving = pays.filter((p) => REVOLVING.test(p.merchant));
  if (revolving.length > 0) {
    const won = sum(revolving);
    out.push({
      rule: "H1",
      kind: "check",
      title: "리볼빙이 걸려 있어요",
      reason: `명세서에 리볼빙(일부결제금액이월약정) 관련 금액 ${fmt(won)}이 있어요. 리볼빙은 카드론보다 비싼 연 17%대 이자가 붙어요. 가입한 기억이 없다면 상담 전화에서 "연체 예방용"으로 등록됐을 수 있어요`,
      yearlySaving: 0,
      source: CARD,
    });
  }

  const protection = pays.filter((p) => DEBT_PROTECTION.test(p.merchant));
  if (protection.length > 0) {
    const won = sum(protection);
    out.push({
      rule: "H3",
      kind: "check",
      title: "카드 채무면제 상품에 가입돼 있어요",
      reason: `채무면제·유예 수수료 월 ${fmt(won)}이 나가고 있어요 (1년이면 약 ${fmt(won * 12)}). 카드를 만들 때 같이 가입되는 경우가 많아요`,
      yearlySaving: 0,
      source: CARD,
    });
  }

  const dcc = pays.filter((p) => DCC.test(p.merchant));
  const foreign = pays.filter((p) => !DCC.test(p.merchant) && FOREIGN.test(p.merchant));
  if (dcc.length > 0 || foreign.length > 0) {
    out.push({
      rule: "H2",
      kind: "check",
      title: dcc.length > 0 ? "해외 원화결제 수수료가 붙었어요" : "해외 결제는 원화결제 차단해 두기",
      reason:
        dcc.length > 0
          ? `해외에서 원화로 결제해 수수료 ${fmt(sum(dcc))}이 더 나갔어요. 원화로 결제하면 환전이 두 번 일어나 보통 3~8%가 더 붙어요`
          : `해외 결제가 ${foreign.length}건 있어요. 원화로 결제되면 3~8% 수수료가 더 붙는데, 결제할 때는 알아채기 어려워요. 카드 앱에서 한 번만 막아 두면 돼요`,
      yearlySaving: 0,
      source: CARD,
      variant: dcc.length > 0 ? "charged" : "prevent",
    });
  }

  const fees = x.statements.flatMap((s) => s.items).filter((it) => INSTALLMENT_FEE.test(it.name) && it.amount > it.discount);
  if (fees.length > 0) {
    const won = fees.reduce((a, it) => a + it.amount - it.discount, 0);
    out.push({
      rule: "H4",
      kind: "check",
      title: "휴대폰 할부 이자가 나가고 있어요",
      reason: `단말기 할부수수료가 이번 달 ${fmt(won)}이에요. 할부가 남은 동안 매달 붙는 이자라, 남은 할부금을 한 번에 갚으면 그 뒤 이자는 안 나가요`,
      yearlySaving: 0,
      source: "휴대폰 할부금",
      statementType: "mobile",
    });
  }

  return out;
}
