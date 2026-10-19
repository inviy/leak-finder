import { describe, expect, it } from "vitest";
import {
  buildIcs,
  contractReminder,
  contractReminderDate,
  contractReminderPath,
  contractReminderTitle,
  foldLine,
  googleCalendarUrl,
  parseReminderQuery,
  planContractReminder,
  type Reminder,
} from "./reminder";

const r: Reminder = {
  title: "인터넷 약정 끝나는 달, 재약정 혜택 비교",
  date: { year: 2027, month: 2, day: 1 },
  details: "새는돈: 지금 통신사 재약정 혜택, 다른 통신사 가입 혜택을 비교하세요",
  id: "r7-2027-02",
};

describe("달력 알림", () => {
  it("하루 종일 일정, 다음 날로 끝, 아침 9시 알림", () => {
    const ics = buildIcs(r, "20261019T000000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270201");
    expect(ics).toContain("DTEND;VALUE=DATE:20270202");
    expect(ics).toContain("TRIGGER;RELATED=START:PT9H");
    expect(ics).toContain("\r\n");
    // 쉼표는 이스케이프
    expect(ics).toContain("재약정 혜택\\, 다른");
  });

  it("월말, 연말 다음 날 계산", () => {
    expect(buildIcs({ ...r, date: { year: 2027, month: 12, day: 31 } }, "x")).toContain("DTEND;VALUE=DATE:20280101");
  });

  it("구글 캘린더 주소", () => {
    const u = new URL(googleCalendarUrl(r));
    expect(u.hostname).toBe("calendar.google.com");
    expect(u.searchParams.get("dates")).toBe("20270201/20270202");
    expect(u.searchParams.get("text")).toBe(r.title);
  });

  it("알림 날짜: 끝나기 한 달 전 1일, 달을 모르면 그해 1월 1일", () => {
    expect(contractReminderDate(2027, 3)).toEqual({ year: 2027, month: 2, day: 1 });
    expect(contractReminderDate(2027, 1)).toEqual({ year: 2026, month: 12, day: 1 });
    expect(contractReminderDate(2027)).toEqual({ year: 2027, month: 1, day: 1 });
  });
});

describe("약정 알림 날짜를 오늘 기준으로", () => {
  const today = { year: 2026, month: 10, day: 19 };
  it("끝나는 달이 이미 지났으면 알림 대신 이미 끝남", () => {
    expect(planContractReminder(2026, 3, today)).toEqual({ kind: "ended", endYear: 2026, month: 3 });
    expect(planContractReminder(2026, 10, today)).toEqual({ kind: "ended", endYear: 2026, month: 10 });
  });
  it("올해 끝나는데 달을 모르면 다음 달 1일", () => {
    expect(planContractReminder(2026, undefined, today)).toEqual({ kind: "remind", date: { year: 2026, month: 11, day: 1 } });
  });
  it("끝나기 한 달 전이 아직 남았으면 그날", () => {
    expect(planContractReminder(2026, 12, today)).toEqual({ kind: "remind", date: { year: 2026, month: 11, day: 1 } });
    expect(planContractReminder(2027, 3, today)).toEqual({ kind: "remind", date: { year: 2027, month: 2, day: 1 } });
    expect(planContractReminder(2027, undefined, today)).toEqual({ kind: "remind", date: { year: 2027, month: 1, day: 1 } });
  });
  it("12월이면 다음 해 1월 1일", () => {
    expect(planContractReminder(2026, undefined, { year: 2026, month: 12, day: 5 })).toEqual({ kind: "remind", date: { year: 2027, month: 1, day: 1 } });
  });
});

describe("달력 파일 줄 접기 (RFC 5545)", () => {
  const bytes = (t: string) => new TextEncoder().encode(t).length;
  it("모든 줄이 75바이트 이하이고, 펼치면 원래 글", () => {
    const ics = buildIcs(contractReminder({ year: 2026, month: 11, day: 1 }, 12, 2026, "https://leak-finder-five.vercel.app"), "20261019T080000Z");
    const lines = ics.split("\r\n");
    expect(Math.max(...lines.map(bytes))).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DESCRIPTION:새는돈 알림: 지금 통신사에 재약정 혜택을 물어보고\\, 다른 통신사 가입 혜택과 비교해 보세요. https://leak-finder-five.vercel.app");
  });
  it("짧은 줄은 그대로, 한글이 중간에서 안 잘림", () => {
    expect(foldLine("SUMMARY:짧음")).toBe("SUMMARY:짧음");
    const long = "X:" + "가".repeat(60);
    for (const part of foldLine(long).split("\r\n")) expect(() => decodeURIComponent(encodeURIComponent(part))).not.toThrow();
    expect(foldLine(long).replace(/\r\n /g, "")).toBe(long);
  });
});

describe("달력 파일 주소 검사", () => {
  const today = { year: 2026, month: 10, day: 19 };
  const q = (s: string) => new URLSearchParams(s);
  it("화면이 만든 주소는 통과", () => {
    const path = contractReminderPath({ year: 2027, month: 2, day: 1 }, 3, 2027);
    expect(parseReminderQuery(new URL(path, "https://x").searchParams, today)).toEqual({
      date: { year: 2027, month: 2, day: 1 },
      endMonth: 3,
      endYear: 2027,
    });
  });
  it("없는 날짜, 형식 오류, 먼 미래, 해가 어긋난 값은 거절", () => {
    expect(parseReminderQuery(q("d=20270230&m=1&y=2027"), today)).toBeNull();
    expect(parseReminderQuery(q("d=2027-02-01&m=1&y=2027"), today)).toBeNull();
    expect(parseReminderQuery(q("d=20270201&m=2&y=2027"), today)).toBeNull();
    expect(parseReminderQuery(q("d=20270201&e=13&y=2027"), today)).toBeNull();
    expect(parseReminderQuery(q("d=20270201&e=x&y=2027"), today)).toBeNull();
    expect(parseReminderQuery(q("d=20500101&m=0&y=2050"), today)).toBeNull();
    expect(parseReminderQuery(q("d=20270201&m=1&y=2030"), today)).toBeNull();
  });
});

describe("알림 제목에 끝나는 해와 달", () => {
  it("달을 알면 해와 달, 모르면 해만", () => {
    expect(contractReminderTitle(2027, 12)).toBe("2027년 12월, 인터넷 약정 끝나요");
    expect(contractReminderTitle(2027)).toBe("2027년, 인터넷 약정 끝나는 해예요");
  });
  it("달을 모르면 e=0, 예전 주소 m=1 도 받아 줌", () => {
    const today = { year: 2026, month: 10, day: 19 };
    expect(parseReminderQuery(new URLSearchParams("d=20270101&e=0&y=2027"), today)).toEqual({ date: { year: 2027, month: 1, day: 1 }, endYear: 2027, endMonth: undefined });
    expect(parseReminderQuery(new URLSearchParams("d=20271101&m=1&y=2027"), today)).toMatchObject({ legacyMonthKnown: true });
  });
});
