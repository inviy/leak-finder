import { describe, expect, it } from "vitest";
import { buildIcs, contractReminderDate, googleCalendarUrl, planContractReminder, type Reminder } from "./reminder";

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
