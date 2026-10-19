import { describe, expect, it } from "vitest";
import { resolveAuth } from "./auth";

describe("resolveAuth", () => {
  it("아무것도 없으면 꺼짐", () => {
    expect(resolveAuth({})).toEqual({ kind: "none" });
  });

  it("API 키가 있으면 키 (페더레이션 값이 같이 있어도 키 우선, SDK 동작과 동일)", () => {
    expect(
      resolveAuth({ ANTHROPIC_API_KEY: "k", ANTHROPIC_FEDERATION_RULE_ID: "fdrl_1", ANTHROPIC_ORGANIZATION_ID: "o" }),
    ).toEqual({ kind: "api_key" });
  });

  it("규칙 ID 와 조직 ID 가 있으면 페더레이션", () => {
    expect(
      resolveAuth({
        ANTHROPIC_FEDERATION_RULE_ID: " fdrl_1 ",
        ANTHROPIC_ORGANIZATION_ID: "org",
        ANTHROPIC_SERVICE_ACCOUNT_ID: "svac_1",
        ANTHROPIC_WORKSPACE_ID: "",
      }),
    ).toEqual({
      kind: "federation",
      federationRuleId: "fdrl_1",
      organizationId: "org",
      serviceAccountId: "svac_1",
      workspaceId: undefined,
    });
  });

  it("둘 중 하나만 있으면 꺼짐", () => {
    expect(resolveAuth({ ANTHROPIC_FEDERATION_RULE_ID: "fdrl_1" })).toEqual({ kind: "none" });
    expect(resolveAuth({ ANTHROPIC_ORGANIZATION_ID: "org" })).toEqual({ kind: "none" });
  });

  it("빈 문자열 키는 없는 것으로", () => {
    expect(resolveAuth({ ANTHROPIC_API_KEY: "  " })).toEqual({ kind: "none" });
  });
});
