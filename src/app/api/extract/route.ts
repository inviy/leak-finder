import { NextResponse } from "next/server";
import { extractFromImages, NotConfiguredError, type ImageInput } from "@/lib/extract/claude";
import { ExtractError } from "@/lib/extract/schema";
import { allowRequest } from "@/lib/extract/rate-limit";
import { MAX_IMAGES } from "@/lib/extract/limits";

/** 비용 남용을 막는 한도 (공개 엔드포인트가 유료 모델을 부르므로) */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const TYPES = new Set<ImageInput["mediaType"]>(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: code, message }, { status });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRequest(ip)) return err(429, "rate_limited", "잠시 후 다시 시도해 주세요.");

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_TOTAL_BYTES + 64 * 1024) return err(413, "too_large", "이미지가 너무 커요.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "bad_request", "이미지를 읽지 못했어요.");
  }

  const files = form.getAll("images").filter((v): v is File => v instanceof File);
  if (files.length === 0) return err(400, "no_images", "캡처를 올려 주세요.");
  if (files.length > MAX_IMAGES) return err(400, "too_many", `캡처는 ${MAX_IMAGES}장까지 올릴 수 있어요.`);

  let total = 0;
  const images: ImageInput[] = [];
  for (const f of files) {
    if (!TYPES.has(f.type as ImageInput["mediaType"])) return err(400, "bad_type", "PNG, JPG, WEBP 이미지만 올릴 수 있어요.");
    if (f.size > MAX_IMAGE_BYTES) return err(413, "too_large", "이미지 한 장이 4MB를 넘어요.");
    total += f.size;
    if (total > MAX_TOTAL_BYTES) return err(413, "too_large", "이미지가 너무 커요.");
    // 메모리에서만 처리하고 어디에도 저장하지 않음
    images.push({
      mediaType: f.type as ImageInput["mediaType"],
      base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
    });
  }

  try {
    const extracted = await extractFromImages(images);
    return NextResponse.json(extracted, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof NotConfiguredError) return err(503, "not_configured", "자동 읽기가 아직 준비되지 않았어요. 직접 입력해 주세요.");
    if (e instanceof ExtractError) return err(422, "unreadable", "고지서를 읽지 못했어요. 다른 캡처를 올리거나 직접 입력해 주세요.");
    // 이미지나 응답 내용은 남기지 않고 종류만 기록
    console.error("extract failed:", e instanceof Error ? e.message : "unknown");
    return err(502, "upstream", "잠시 후 다시 시도해 주세요.");
  }
}
