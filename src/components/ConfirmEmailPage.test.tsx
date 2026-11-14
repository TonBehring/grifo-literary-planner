import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConfirmEmailPage } from "./ConfirmEmailPage";

const { verifyOtp, resend, signOut, navigate, auth } = vi.hoisted(() => ({
  verifyOtp: vi.fn(), resend: vi.fn(), signOut: vi.fn(), navigate: vi.fn(),
  auth: { user: null as null | { id: string }, loading: false },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { verifyOtp, resend, signOut } } }));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  auth.user = null;
  verifyOtp.mockResolvedValue({ error: null });
  resend.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({ error: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});
async function render(type?: string, tokenHash = "test-token") {
  await act(async () => root.render(<ConfirmEmailPage tokenHash={tokenHash} type={type} />));
}
async function click() {
  await act(async () => container.querySelector("button")?.click());
}
async function send() {
  const input = container.querySelector("input");
  if (!input) throw new Error("Expected recovery email field");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "reader@example.com");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

it("does not consume the token until a person clicks", async () => {
  await render();
  expect(verifyOtp).not.toHaveBeenCalled();
  await click();
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: "email" });
  expect(navigate).toHaveBeenCalledWith({ to: "/" });
});
it.each(["signup", "email_change", "invite"])("accepts %s and maps signup to email", async (type) => {
  await render(type);
  await click();
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: type === "signup" ? "email" : type });
});
it("does not verify a missing token", async () => {
  await render("email", "");
  await click();
  expect(verifyOtp).not.toHaveBeenCalled();
  expect(container.querySelector("form")).not.toBeNull();
});
it("rejects unsupported token types without calling auth", async () => {
  await render("recovery");
  await click();
  expect(verifyOtp).not.toHaveBeenCalled();
});
it("signs out a locally signed-in account before verifying a new token", async () => {
  auth.user = { id: "other-reader" };
  await render();
  expect(container.querySelector('a[href="/"]')).toBeNull();
  await click();
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: "email" });
  expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(verifyOtp.mock.invocationCallOrder[0]);
  expect(navigate).toHaveBeenCalledWith({ to: "/" });
});
it("still verifies when the local sign-out fails", async () => {
  auth.user = { id: "other-reader" };
  signOut.mockRejectedValue(new Error("network"));
  await render();
  await click();
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token", type: "email" });
});
it("shows the confirmed screen only when no token is present", async () => {
  auth.user = { id: "reader" };
  await render("email", "");
  expect(container.textContent).toContain("Seu e-mail já está confirmado");
  expect(container.querySelector('a[href="/"]')).not.toBeNull();
  expect(verifyOtp).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});
it("blocks duplicate verification while the first request is pending", async () => {
  verifyOtp.mockReturnValue(new Promise(() => {}));
  await render();
  await act(async () => {
    const button = container.querySelector("button");
    button?.click();
    button?.click();
  });
  expect(verifyOtp).toHaveBeenCalledTimes(1);
  expect(container.querySelector("button")?.disabled).toBe(true);
});
it("resends with the origin and prevents a second send for 60 seconds", async () => {
  await render("email", "");
  await click();
  await send();
  expect(resend).toHaveBeenCalledWith({ type: "signup", email: "reader@example.com", options: { emailRedirectTo: window.location.origin } });
  await send();
  expect(resend).toHaveBeenCalledTimes(1);
  for (let second = 0; second < 59; second++) await act(async () => vi.advanceTimersByTime(1000));
  expect(container.querySelector("button")?.disabled).toBe(true);
  await act(async () => vi.advanceTimersByTime(1000));
  expect(container.querySelector("button")?.disabled).toBe(false);
});
it("applies the same 60-second block when the provider rate-limits", async () => {
  resend.mockResolvedValue({ error: { status: 429, message: "rate limit" } });
  await render("email", "");
  await click();
  await send();
  await send();
  expect(resend).toHaveBeenCalledTimes(1);
  for (let second = 0; second < 60; second++) await act(async () => vi.advanceTimersByTime(1000));
  await send();
  expect(resend).toHaveBeenCalledTimes(2);
});
it("shows recovery instead of navigating when verification fails", async () => {
  verifyOtp.mockResolvedValue({ error: { message: "expired" } });
  await render();
  await click();
  expect(navigate).not.toHaveBeenCalled();
  expect(container.querySelector("form")).not.toBeNull();
});