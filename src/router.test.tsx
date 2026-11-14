import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vitest";
import { getRouter } from "./router";

vi.mock("./routeTree.gen", async () => {
  const { createRootRoute, createRoute, Outlet, useNavigate } = await import("@tanstack/react-router");
  function VisitorPage() {
    const navigate = useNavigate();
    useEffect(() => { void navigate({ to: "/auth" }); }, [navigate]);
    return null;
  }
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: VisitorPage });
  const auth = createRoute({ getParentRoute: () => root, path: "/auth", component: () => <div>Login</div> });
  return { routeTree: root.addChildren([index, auth]) };
});

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

it("preserves x/y origin when a signed-out visitor is redirected from / to /auth", async () => {
  localStorage.clear();
  window.history.replaceState(null, "", "/?utm_source=x&utm_campaign=y");
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const router = getRouter();
  // The origin must already exist before even the first render.
  expect(JSON.parse(localStorage.getItem("grifo_origem") ?? "null")).toMatchObject({
    utm_source: "x", utm_campaign: "y",
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(<RouterProvider router={router} />);
      await router.load();
    });
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/auth"));
    expect(window.location.search).toBe("");
    expect(JSON.parse(localStorage.getItem("grifo_origem") ?? "null")).toMatchObject({
      utm_source: "x", utm_campaign: "y",
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});