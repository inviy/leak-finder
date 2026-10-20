/**
 * 자주 쓰는 구독 서비스 목록. 카드 명세서의 가맹점 이름을 이 목록으로 알아봄.
 * 가맹점 이름은 카드사, 결제 경로마다 달라서 여러 모양을 함께 적음.
 * 가격은 적지 않음 (자주 바뀜). 금액은 늘 사용자 명세서에 찍힌 값을 씀.
 */
export type SubCategory = "video" | "music" | "shopping" | "delivery" | "reading" | "ai" | "cloud" | "appstore";

export const CATEGORY_LABEL: Record<SubCategory, string> = {
  video: "영상",
  music: "음악",
  shopping: "쇼핑 멤버십",
  delivery: "배달 멤버십",
  reading: "책",
  ai: "AI",
  cloud: "저장공간",
  appstore: "앱 마켓 결제",
};

export interface SubService {
  id: string;
  name: string;
  category: SubCategory;
  /** 가맹점 이름에서 찾을 모양 (대소문자 무시) */
  patterns: RegExp[];
  /** 통신 고지서에 이 서비스가 부가서비스로 있으면 같은 것으로 봄 */
  telecomPatterns?: RegExp[];
}

export const SUB_SERVICES: SubService[] = [
  { id: "netflix", name: "넷플릭스", category: "video", patterns: [/넷플릭스/, /netflix/i], telecomPatterns: [/넷플릭스/, /netflix/i] },
  { id: "youtube", name: "유튜브 프리미엄", category: "video", patterns: [/유튜브/, /youtube/i], telecomPatterns: [/유튜브/, /youtube/i] },
  { id: "disney", name: "디즈니+", category: "video", patterns: [/디즈니/, /disney/i], telecomPatterns: [/디즈니/, /disney/i] },
  { id: "tving", name: "티빙", category: "video", patterns: [/티빙/, /tving/i], telecomPatterns: [/티빙/, /tving/i] },
  { id: "wavve", name: "웨이브", category: "video", patterns: [/웨이브/, /wavve/i], telecomPatterns: [/웨이브/, /wavve/i] },
  { id: "watcha", name: "왓챠", category: "video", patterns: [/왓챠/, /watcha/i] },
  { id: "coupang", name: "쿠팡 와우", category: "shopping", patterns: [/와우\s*멤버십/, /쿠팡.*(와우|멤버십)/, /coupang.*wow/i] },
  { id: "naverplus", name: "네이버플러스 멤버십", category: "shopping", patterns: [/네이버\s*플러스/, /naver\s*plus/i, /네이버.*멤버십/] },
  { id: "kurly", name: "컬리멤버스", category: "shopping", patterns: [/컬리\s*멤버스/] },
  { id: "melon", name: "멜론", category: "music", patterns: [/멜론/, /melon/i], telecomPatterns: [/멜론/] },
  { id: "genie", name: "지니뮤직", category: "music", patterns: [/지니\s*뮤직/, /genie\s*music/i], telecomPatterns: [/지니\s*뮤직/, /지니\s*음악/] },
  { id: "flo", name: "플로", category: "music", patterns: [/플로\s*(이용권|뮤직)?$/, /\bflo\b/i], telecomPatterns: [/플로/] },
  { id: "vibe", name: "바이브", category: "music", patterns: [/바이브/, /\bvibe\b/i] },
  { id: "spotify", name: "스포티파이", category: "music", patterns: [/스포티파이/, /spotify/i] },
  { id: "baemin", name: "배민클럽", category: "delivery", patterns: [/배민\s*클럽/, /배달의민족.*클럽/] },
  { id: "yogiyo", name: "요기패스", category: "delivery", patterns: [/요기\s*패스/, /요기요.*패스/] },
  { id: "millie", name: "밀리의 서재", category: "reading", patterns: [/밀리의\s*서재/, /millie/i], telecomPatterns: [/밀리의\s*서재/] },
  { id: "ridi", name: "리디", category: "reading", patterns: [/리디\s*(셀렉트)?/, /\bridi/i] },
  { id: "chatgpt", name: "ChatGPT", category: "ai", patterns: [/openai/i, /chatgpt/i] },
  { id: "claude", name: "Claude", category: "ai", patterns: [/anthropic/i, /claude\.ai/i] },
  { id: "gemini", name: "Google One (Gemini)", category: "ai", patterns: [/google\s*\*?\s*one/i, /구글\s*원/] },
  { id: "icloud", name: "iCloud+", category: "cloud", patterns: [/icloud/i] },
  { id: "apple", name: "애플 결제 (앱스토어)", category: "appstore", patterns: [/apple\.com\/bill/i, /애플\s*(코리아)?$/, /^apple/i] },
  { id: "googleplay", name: "구글 플레이 결제", category: "appstore", patterns: [/google\s*\*?\s*play/i, /구글\s*플레이/] },
];

export function matchService(merchant: string): SubService | undefined {
  return SUB_SERVICES.find((s) => s.patterns.some((p) => p.test(merchant)));
}
