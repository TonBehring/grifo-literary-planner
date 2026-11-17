import { beforeEach, expect, it, vi } from "vitest";
const { updateUser, conv, meta } = vi.hoisted(() => ({ updateUser: vi.fn(), conv: vi.fn(), meta: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { updateUser } } }));
vi.mock("@/lib/google-ads", () => ({ reportSignupConversion: conv }));
vi.mock("@/lib/meta-pixel", () => ({ reportMetaCompleteRegistration: meta }));
import { handleOAuthLogin, resetOAuthProcessed, OAUTH_PENDING_KEY } from "./oauth";
import type { User } from "@supabase/supabase-js";

const NOW = Date.parse("2026-11-17T18:00:00Z");
function user(over: Partial<User> = {}): User {
  return { id: Math.random().toString(), app_metadata: { provider: "google" }, user_metadata: {},
    identities: [], created_at: new Date(NOW - 2 * 60000).toISOString(), aud: "", ...over } as User;
}
beforeEach(() => { vi.clearAllMocks(); resetOAuthProcessed(); localStorage.clear(); updateUser.mockResolvedValue({}); });

it("grava terms_accepted_at quando falta", async () => {
  await handleOAuthLogin(user(), NOW);
  expect(updateUser).toHaveBeenCalledTimes(1);
  expect(updateUser.mock.calls[0][0].data.terms_accepted_at).toBe(new Date(NOW).toISOString());
});
it("não grava terms_accepted_at quando já existe", async () => {
  await handleOAuthLogin(user({ user_metadata: { terms_accepted_at: "x" } }), NOW);
  expect(updateUser).not.toHaveBeenCalled();
});
it("dispara conversões para conta nova com pending recente", async () => {
  localStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ ts: NOW - 5 * 60000 }));
  await handleOAuthLogin(user(), NOW);
  expect(conv).toHaveBeenCalledTimes(1);
  expect(meta).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
});
it("não dispara para conta antiga, mas limpa pending", async () => {
  localStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ ts: NOW - 60000 }));
  await handleOAuthLogin(user({ created_at: new Date(NOW - 20 * 60000).toISOString() }), NOW);
  expect(conv).not.toHaveBeenCalled();
  expect(localStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
});
it("não dispara com pending antigo (mais de 30 min)", async () => {
  localStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ ts: NOW - 31 * 60000 }));
  await handleOAuthLogin(user(), NOW);
  expect(conv).not.toHaveBeenCalled();
});
