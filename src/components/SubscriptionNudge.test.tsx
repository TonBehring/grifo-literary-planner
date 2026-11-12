import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SubscriptionNudge } from "@/components/SubscriptionNudge";

const { rpc, invoke, createSubscriptionCheckout } = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  createSubscriptionCheckout: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, functions: { invoke } } }));
vi.mock("@/lib/subscription", () => ({
  createSubscriptionCheckout,
  hasActiveAccess: () => false,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("location", { href: "" });
  rpc.mockResolvedValue({ data: null, error: null });
  createSubscriptionCheckout.mockResolvedValue("https://pay/x");
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  client.clear();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SubscriptionNudge subscription={null} loading={false} pathname="/biblioteca" />
      </QueryClientProvider>,
    ),
  );
  await act(async () => {});
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  );
}

it("shows Pix first, then card, with the renewal note", async () => {
  await render();
  const all = Array.from(document.querySelectorAll("button"));
  const pix = buttonByText("Pagar com Pix");
  const card = buttonByText("Pagar com cartão");
  expect(pix).toBeTruthy();
  expect(card).toBeTruthy();
  expect(all.indexOf(pix!)).toBeLessThan(all.indexOf(card!));
  expect(document.body.textContent).toContain(
    "Pix: pagamento anual, sem renovação automática. Cartão: renova sozinho todo ano.",
  );
});

it("asks for pix when Pagar com Pix is clicked", async () => {
  await render();
  const pix = buttonByText("Pagar com Pix")!;
  await act(async () => pix.click());
  expect(createSubscriptionCheckout).toHaveBeenCalledWith("pix");
});

it("asks for card when Pagar com cartão is clicked", async () => {
  await render();
  const card = buttonByText("Pagar com cartão")!;
  await act(async () => card.click());
  expect(createSubscriptionCheckout).toHaveBeenCalledWith("card");
});

it("disables both buttons while the clicked one is loading", async () => {
  let resolve!: (url: string) => void;
  createSubscriptionCheckout.mockReturnValue(new Promise<string>((r) => (resolve = r)));
  await render();
  const pix = buttonByText("Pagar com Pix")!;
  const card = buttonByText("Pagar com cartão")!;
  await act(async () => pix.click());
  expect(pix.disabled).toBe(true);
  expect(card.disabled).toBe(true);
  await act(async () => resolve("https://pay/x"));
});
