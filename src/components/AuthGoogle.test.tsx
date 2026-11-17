import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/auth";

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ isSupabaseConfigured: true, supabase: { auth: { signInWithOAuth } } }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/google-ads", () => ({ reportSignupConversion: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ reportMetaCompleteRegistration: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (o: unknown) => o, useNavigate: () => vi.fn() }));

let root: Root; let container: HTMLDivElement;
const originalUA = navigator.userAgent;
function setUA(ua: string) { Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true }); }
async function render() {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  await act(async () => root.render(<Page />));
}
const find = (t: string) => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === t);
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); signInWithOAuth.mockResolvedValue({ error: null }); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); setUA(originalUA); });

it("chama signInWithOAuth com google e redirectTo da inicial", async () => {
  await render();
  await act(async () => find("Continuar com o Google")!.click());
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: window.location.origin + "/" } });
  expect(localStorage.getItem("grifo_oauth_pending")).toContain("ts");
});
it("esconde o botão e mostra o aviso no Instagram", async () => {
  setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0");
  await render();
  expect(find("Continuar com o Google")).toBeUndefined();
  expect(find("Copiar link")).toBeDefined();
  expect(container.textContent).toContain("Abrir no navegador");
});
