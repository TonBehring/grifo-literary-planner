import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/auth";

const { signUp, resend, conversion, toastError } = vi.hoisted(() => ({
  signUp: vi.fn(), resend: vi.fn(), conversion: vi.fn(), toastError: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true, supabase: { auth: { signUp, resend } },
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/google-ads", () => ({ reportSignupConversion: conversion }));
vi.mock("@/lib/meta-pixel", () => ({ reportMetaCompleteRegistration: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => vi.fn(),
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  signUp.mockResolvedValue({ data: { user: { id: "new-user", identities: [{}] }, session: null }, error: null });
  resend.mockResolvedValue({ error: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const Page = Route.options?.component ?? (Route as unknown as { component: React.ComponentType }).component;
  if (!Page || typeof Page !== "function") throw new Error("Missing auth page");
  await act(async () => root.render(<Page />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});
function button(name: string) {
  const result = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === name);
  if (!result) throw new Error(`Missing ${name}`);
  return result;
}
async function click(name: string) { await act(async () => button(name).click()); }
async function prepare() {
  await click("Criar conta");
  for (const [index, value] of ["Leitor", "reader@example.com", "safe-test-password"].entries()) {
    const input = container.querySelectorAll("input")[index];
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
}
async function submit() {
  await act(async () => container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
async function seconds(count: number) {
  for (let i = 0; i < count; i++) await act(async () => vi.advanceTimersByTime(1000));
}
it("replaces signup with a persistent receipt and blocks resend for exactly 60 seconds", async () => {
  await prepare();
  await submit();
  expect(signUp).toHaveBeenCalledTimes(1);
  expect(conversion).toHaveBeenCalledTimes(1);
  expect(container.querySelector("form")).toBeNull();
  await seconds(59);
  expect(button("Reenviar e-mail (1s)").disabled).toBe(true);
  await seconds(1);
  await click("Reenviar e-mail");
  expect(resend).toHaveBeenCalledWith({ type: "signup", email: "reader@example.com", options: { emailRedirectTo: window.location.origin } });
  expect(button("Reenviar e-mail (60s)").disabled).toBe(true);
});
it.each([
  { status: 429, message: "unknown" },
  { code: "over_email_send_rate_limit", message: "unknown" },
  { message: "For security purposes" },
  { message: "Email rate limit exceeded" },
])("treats email-send limits as a receipt, never a conversion: %j", async (error) => {
  signUp.mockResolvedValue({ data: { user: null, session: null }, error });
  await prepare();
  await submit();
  expect(container.querySelector("form")).toBeNull();
  expect(button("Reenviar e-mail (60s)").disabled).toBe(true);
  expect(conversion).not.toHaveBeenCalled();
  expect(toastError).toHaveBeenCalledTimes(1);
});
it("moves an existing identity to login without counting signup", async () => {
  signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
  await prepare();
  await submit();
  expect(conversion).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe("reader@example.com");
  expect(button("Entrar").disabled).toBe(false);
  expect(container.querySelectorAll("input")).toHaveLength(2);
});
it("clears the signup form when choosing another email", async () => {
  await prepare();
  await submit();
  await click("Usar outro e-mail");
  expect(Array.from(container.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"])')).map((input) => input.value)).toEqual(["", "", ""]);
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
});
it("keeps the email when returning to login", async () => {
  await prepare();
  await submit();
  await click("Já confirmei, quero entrar");
  expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.value).toBe("reader@example.com");
  expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
});
it("blocks double submissions while signup is pending", async () => {
  signUp.mockReturnValue(new Promise(() => {}));
  await prepare();
  await act(async () => {
    const form = container.querySelector("form");
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(signUp).toHaveBeenCalledTimes(1);
  expect(button("Aguarde…").disabled).toBe(true);
});