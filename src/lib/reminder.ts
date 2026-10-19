/**
 * 가입이나 서버 없이 "놓치지 않게 알려 주기".
 * 휴대폰 달력에 넣을 일정 파일(.ics)과 구글 캘린더 추가 주소를 만든다.
 * 개인정보는 넣지 않는다 (제목, 날짜, 할 일 설명만).
 */
export interface Reminder {
  title: string;
  /** 알림 날짜 (현지 날짜) */
  date: { year: number; month: number; day: number };
  details: string;
  /** 같은 알림을 두 번 넣어도 하나로 보이게 하는 값 */
  id: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Reminder["date"]) => `${d.year}${pad(d.month)}${pad(d.day)}`;

function nextDay(d: Reminder["date"]): Reminder["date"] {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + 1));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** iCalendar 글자 규칙: 쉼표, 세미콜론, 역슬래시, 줄바꿈 이스케이프 */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 하루 종일 일정 + 그날 아침 9시 알림 */
export function buildIcs(r: Reminder, stamp: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//leak-finder//KO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${r.id}@leak-finder`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(r.date)}`,
    `DTEND;VALUE=DATE:${ymd(nextDay(r.date))}`,
    `SUMMARY:${esc(r.title)}`,
    `DESCRIPTION:${esc(r.details)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(r.title)}`,
    "TRIGGER;RELATED=START:PT9H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** 안드로이드 등 .ics 를 바로 못 여는 기기용 */
export function googleCalendarUrl(r: Reminder): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: r.title,
    dates: `${ymd(r.date)}/${ymd(nextDay(r.date))}`,
    details: r.details,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** 약정이 끝나는 해와 (알면) 설치한 달로 알림 날짜: 끝나기 한 달 전 1일, 달을 모르면 그해 1월 1일 */
export function contractReminderDate(endYear: number, month?: number): Reminder["date"] {
  if (!month) return { year: endYear, month: 1, day: 1 };
  return month === 1 ? { year: endYear - 1, month: 12, day: 1 } : { year: endYear, month: month - 1, day: 1 };
}

type YMD = Reminder["date"];
const key = (d: YMD) => d.year * 10000 + d.month * 100 + d.day;

/**
 * 오늘 기준으로 약정 알림을 정함.
 * - 설치한 달을 알고, 끝나는 달이 이미 지났으면 알림 대신 "이미 끝남"
 * - 알림 날짜가 이미 지났으면 다음 달 1일로 (올해 끝나는데 달을 모를 때 등)
 */
export function planContractReminder(
  endYear: number,
  month: number | undefined,
  today: YMD,
): { kind: "ended"; endYear: number; month: number } | { kind: "remind"; date: YMD } {
  if (month && key({ year: endYear, month, day: 1 }) <= key({ ...today, day: 1 })) {
    return { kind: "ended", endYear, month };
  }
  const date = contractReminderDate(endYear, month);
  if (key(date) > key(today)) return { kind: "remind", date };
  const next = today.month === 12 ? { year: today.year + 1, month: 1, day: 1 } : { year: today.year, month: today.month + 1, day: 1 };
  return { kind: "remind", date: next };
}
