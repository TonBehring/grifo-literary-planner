import { beforeEach, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { createSubscriptionCheckout } from "@/lib/subscription";

beforeEach(() => vi.clearAllMocks());

it("sends pix as the method in the request body", async () => {
  invoke.mockResolvedValue({ data: { checkout_url: "https://pay/pix" }, error: null });
  expect(await createSubscriptionCheckout("pix")).toBe("https://pay/pix");
  expect(invoke).toHaveBeenCalledWith("asaas-create-subscription", { body: { method: "pix" } });
});

it("defaults to card when no method is given", async () => {
  invoke.mockResolvedValue({ data: { checkout_url: "https://pay/card" }, error: null });
  expect(await createSubscriptionCheckout()).toBe("https://pay/card");
  expect(invoke).toHaveBeenCalledWith("asaas-create-subscription", { body: { method: "card" } });
});

it("surfaces the function error instead of a blank redirect", async () => {
  invoke.mockResolvedValue({ data: null, error: { message: "asaas offline" } });
  await expect(createSubscriptionCheckout("pix")).rejects.toThrow("asaas offline");
});
