/**
 * Claude API 인증 방식 고르기.
 *
 * 1. ANTHROPIC_API_KEY 가 있으면 API 키 (로컬 개발용)
 * 2. 페더레이션 ID 가 있으면 ID 페더레이션 (Vercel 이 발급하는 짧은 OIDC 토큰을 교환, 정적 키 없음)
 * 3. 둘 다 없으면 자동 읽기 꺼짐
 *
 * SDK 는 API 키가 있으면 페더레이션보다 키를 먼저 쓰므로, 운영에서는 키를 넣지 않는다.
 */
export type AuthMode =
  | { kind: "api_key" }
  | {
      kind: "federation";
      federationRuleId: string;
      organizationId: string;
      serviceAccountId?: string;
      workspaceId?: string;
    }
  | { kind: "none" };

type Env = Record<string, string | undefined>;

const val = (env: Env, k: string) => {
  const v = env[k]?.trim();
  return v ? v : undefined;
};

export function resolveAuth(env: Env): AuthMode {
  if (val(env, "ANTHROPIC_API_KEY")) return { kind: "api_key" };
  const federationRuleId = val(env, "ANTHROPIC_FEDERATION_RULE_ID");
  const organizationId = val(env, "ANTHROPIC_ORGANIZATION_ID");
  if (federationRuleId && organizationId) {
    return {
      kind: "federation",
      federationRuleId,
      organizationId,
      serviceAccountId: val(env, "ANTHROPIC_SERVICE_ACCOUNT_ID"),
      workspaceId: val(env, "ANTHROPIC_WORKSPACE_ID"),
    };
  }
  return { kind: "none" };
}
