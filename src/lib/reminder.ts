/**
 * 가입이나 저장 없이 "놓치지 않게 알려 주기".
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

/**
 * 한 줄을 75바이트 이하로 접기 (RFC 5545 3.1). 이어지는 줄은 공백 한 칸으로 시작.
 * 한글(3바이트)이 중간에서 잘리지 않게 글자 단위로 자름
 */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // 이어지는 줄은 앞 공백 1바이트
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

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
  ]
    .map(foldLine)
    .join("\r\n")
    .concat("\r\n");
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

/**
 * 인터넷 약정 알림 내용. 서버(달력 파일)와 화면(구글 캘린더)이 같은 글을 쓰도록 한 곳에서 만듦.
 * 사용자가 쓴 글은 넣지 않고 날짜와 정해진 문장만 씀
 */
export function contractReminder(date: YMD, monthKnown: boolean, endYear: number, siteUrl: string): Reminder {
  return {
    id: `r7-${date.year}-${pad(date.month)}-${pad(date.day)}`,
    title: monthKnown ? "다음 달 인터넷 약정 끝나요" : `${endYear}년, 인터넷 약정 끝나는 해예요`,
    details: `새는돈 알림: 지금 통신사에 재약정 혜택을 물어보고, 다른 통신사 가입 혜택과 비교해 보세요. ${siteUrl}`,
    date,
  };
}

/** 달력 파일 주소 (서버가 text/calendar 로 내려 줌. 아이폰 Safari 는 이 방식이어야 바로 "캘린더에 추가") */
export function contractReminderPath(date: YMD, monthKnown: boolean, endYear: number): string {
  const q = new URLSearchParams({ d: ymd(date), m: monthKnown ? "1" : "0", y: String(endYear) });
  return `/api/reminder?${q.toString()}`;
}

/** 서버에서 주소 값 검사: 형식이 틀리거나 너무 먼 날짜는 거절 */
export function parseReminderQuery(
  q: URLSearchParams,
  today: YMD,
): { date: YMD; monthKnown: boolean; endYear: number } | null {
  const d = q.get("d") ?? "";
  const m = q.get("m");
  const y = q.get("y") ?? "";
  if (!/^\d{8}$/.test(d) || (m !== "0" && m !== "1") || !/^\d{4}$/.test(y)) return null;
  const date = { year: Number(d.slice(0, 4)), month: Number(d.slice(4, 6)), day: Number(d.slice(6, 8)) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (check.getUTCFullYear() !== date.year || check.getUTCMonth() + 1 !== date.month || check.getUTCDate() !== date.day) return null;
  const endYear = Number(y);
  // 오늘부터 10년 안, 끝나는 해와 알림 날짜가 1년 넘게 어긋나지 않음
  if (key(date) < key(today) - 10000 || date.year > today.year + 10) return null;
  if (Math.abs(endYear - date.year) > 1) return null;
  return { date, monthKnown: m === "1", endYear };
}
