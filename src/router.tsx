import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { captureSignupOrigin } from "./lib/origin";

export const getRouter = () => {
  // Captura antes de qualquer render ou redirecionamento, sem efeitos no import/SSR.
  if (typeof window !== "undefined") {
    try {
      captureSignupOrigin();
    } catch {
      // Armazenamento indisponível não deve impedir a abertura do app.
    }
  }
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
