import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WhatsAppNudge } from "@/components/WhatsAppNudge";
import { WhatsAppForm } from "@/components/WhatsAppForm";
import { dismissWhatsApp, formatWhatsApp, getWhatsApp, saveWhatsApp, validWhatsApp, whatsappDismissed, whatsappExcluded, WHATSAPP_DISMISS_KEY } from "@/lib/whatsapp";

const { rpc, maybeSingle, select, eq } = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn(), select: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from: () => ({ select }) } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  select.mockReturnValue({ eq }); eq.mockReturnValue({ maybeSingle });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  rpc.mockResolvedValue({ error: null });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); client.clear(); vi.useRealTimers(); });
async function nudge(open = false, pathname = "/biblioteca") {
  await act(async () => root.render(<QueryClientProvider client={client}><WhatsAppNudge userId="reader" pathname={pathname} subscriptionOpen={open} subscriptionLoading={false} /></QueryClientProvider>));
  await act(async () => vi.advanceTimersByTime(1));
}
async function advance(ms: number) { await act(async () => vi.advanceTimersByTime(ms)); }

it("reads a missing profile via maybeSingle as no WhatsApp", async () => {
  expect(await getWhatsApp("reader")).toEqual({ whatsapp: null, whatsapp_aceita_contato: true });
  expect(eq).toHaveBeenCalledWith("id", "reader"); expect(maybeSingle).toHaveBeenCalledTimes(1);
});
it.each(["11987654321", "1134567890"])("accepts Brazilian 10/11 digits: %s", (number) => expect(validWhatsApp(number)).toBe(true));
it.each(["119876543", "119876543210", ""])("rejects incomplete or oversized number: %s", (number) => expect(validWhatsApp(number)).toBe(false));
it("formats DDD and landline or mobile, stripping only a complete DDI", () => {
  expect(formatWhatsApp("5511987654321")).toBe("(11) 98765-4321");
  expect(formatWhatsApp("1134567890")).toBe("(11) 3456-7890");
  expect(formatWhatsApp("55987654321")).toBe("(55) 98765-4321");
});
it("saves exclusively through the existing RPC preserving opt-out", async () => {
  expect(await saveWhatsApp("(11) 98765-4321", false)).toEqual({ whatsapp: "5511987654321", whatsapp_aceita_contato: false });
  expect(rpc).toHaveBeenCalledWith("salvar_whatsapp", { p_whatsapp: "11987654321", p_aceita: false });
});
it("maps RPC invalid-number errors", async () => {
  rpc.mockResolvedValue({ error: { message: "whatsapp_invalido" } });
  await expect(saveWhatsApp("11987654321", true)).rejects.toThrow("Confira o número com DDD, por favor.");
});
it("dismisses for exactly three days and tolerates unavailable storage", () => {
  dismissWhatsApp(localStorage, 1000);
  expect(localStorage.getItem(WHATSAPP_DISMISS_KEY)).toBe(String(1000 + 259200000));
  expect(whatsappDismissed(localStorage, 1000 + 259200000 - 1)).toBe(true);
  expect(whatsappDismissed(localStorage, 1000 + 259200000)).toBe(false);
  expect(() => dismissWhatsApp({ setItem: () => { throw Error(); } })).not.toThrow();
});
it.each(["/conta", "/assinatura/retorno", "/confirmar", "/auth", "/redefinir-senha"])("excludes %s", async (path) => {
  expect(whatsappExcluded(path)).toBe(true); await nudge(false, path); await advance(4000); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("opens only after three seconds for a missing profile", async () => {
  await nudge(); await advance(2998); expect(document.querySelector('[role="dialog"]')).toBeNull();
  await advance(2); expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
it("does not open after subscription closes in the same navigation", async () => {
  await nudge(true); await nudge(false); await advance(4000); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("can open on the next navigation after a subscription conflict", async () => {
  await nudge(true); await nudge(false); await advance(4000);
  await act(async () => root.render(<QueryClientProvider client={client}><WhatsAppNudge key="next-page" userId="reader" pathname="/estatisticas" subscriptionOpen={false} subscriptionLoading={false} /></QueryClientProvider>));
  await advance(3000); expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
it.each(["Agora não", "Close"])("%s closes and suppresses for three days", async (name) => {
  await nudge(); await advance(3000);
  const button = Array.from(document.querySelectorAll("button")).find((item) => item.textContent === name);
  if (!button) throw new Error("Missing dismiss control");
  await act(async () => button.click());
  expect(Number(localStorage.getItem(WHATSAPP_DISMISS_KEY))).toBe(Date.now() + 259200000);
  expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
});
it("renders invalid RPC errors without updating the saved profile", async () => {
  rpc.mockResolvedValue({ error: { message: "whatsapp_invalido" } });
  await act(async () => root.render(<QueryClientProvider client={client}><WhatsAppForm userId="reader" profile={{ whatsapp: "5511987654321", whatsapp_aceita_contato: true }} /></QueryClientProvider>));
  await act(async () => container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Confira o número com DDD, por favor.");
  expect(client.getQueryData(["profile-whatsapp", "reader"])).toBeUndefined();
});
it("does not open with an existing saved number", async () => {
  maybeSingle.mockResolvedValue({ data: { whatsapp: "5511987654321", whatsapp_aceita_contato: false }, error: null });
  await nudge(); await advance(4000); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("does not mistake a failed profile read for a missing profile", async () => {
  maybeSingle.mockResolvedValue({ data: null, error: { message: "network" } });
  await nudge(); await advance(4000); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("defers when another dialog is open", async () => {
  const other = document.createElement("div"); other.setAttribute("role", "dialog"); other.setAttribute("data-state", "open"); document.body.append(other);
  await nudge(); await advance(4000); other.remove(); await advance(4000); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("form blocks duplicate submission and updates user cache on success", async () => {
  let resolve: ((value: { error: null }) => void) | undefined;
  rpc.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await act(async () => root.render(<QueryClientProvider client={client}><WhatsAppForm userId="reader" profile={{ whatsapp: "5511987654321", whatsapp_aceita_contato: true }} /></QueryClientProvider>));
  const form = container.querySelector("form");
  await act(async () => { form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  await act(async () => resolve?.({ error: null }));
  expect(client.getQueryData(["profile-whatsapp", "reader"])).toEqual({ whatsapp: "5511987654321", whatsapp_aceita_contato: true });
});