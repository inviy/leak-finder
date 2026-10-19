import type { StatementDraft } from "../draft";
import { parseWon, parseWonList } from "../draft";

/**
 * 읽은 결과를 보고 "무엇을 더 올리면 되는지" 콕 집어 알려 주기.
 * 처음부터 맞는 화면을 찾아오라고 하지 않고, 아무 요금 화면이나 올린 뒤 빠진 것만 요청한다.
 * 통신사가 메뉴나 화면을 바꿔도 읽은 결과로 판단하므로 깨지지 않음.
 */
export interface MissingHint {
  /** 목록 한 줄 */
  text: string;
  /** 꼭 필요한지 (false 면 "있으면 좋아요") */
  required: boolean;
}

export function findMissing(drafts: StatementDraft[]): MissingHint[] {
  const hints: MissingHint[] = [];
  const mobiles = drafts.filter((d) => d.kind === "mobile");

  for (const d of mobiles) {
    if (!parseWon(d.planMonthlyFee)) {
      hints.push({ text: `${d.label}: 기본 요금이 안 보여요. 항목별 금액이 나오는 요금 상세 화면을 올려 주세요.`, required: true });
    }
  }
  if (mobiles.length === 0 && drafts.length > 0) {
    hints.push({ text: "휴대폰 요금 화면이 없어요. 안 쓰는 부가서비스는 휴대폰 요금에서 가장 많이 찾아요.", required: false });
  }
  if (drafts.length > 0 && drafts.every((d) => parseWonList(d.pastTotals).length === 0)) {
    hints.push({ text: "최근 몇 달 요금 화면이 있으면 평소보다 많이 나온 달도 찾아 드려요.", required: false });
  }
  return hints;
}
