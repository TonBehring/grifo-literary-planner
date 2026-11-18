import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/livro.$id_.sessao_.$sessionId";

const mocks = vi.hoisted(() => ({
  addNote: vi.fn(), navigate: vi.fn(), success: vi.fn(), error: vi.fn(),
  active: true, startedAt: "2026-11-18T02:30:00.000Z",
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ ...options, useParams: () => ({ id: "book-123", sessionId: "session-456" }) }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/BookCover", () => ({ BookCover: () => null }));
vi.mock("@/components/SubscriptionGate", () => ({
  useHasActiveSubscription: () => ({ active: mocks.active, loading: false }),
  SubscriptionRequiredNotice: () => <p>Assinatura necessária</p>,
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "user-789" } }) }));
vi.mock("@/lib/api", () => ({
  addNote: mocks.addNote,
  getUserBook: vi.fn(), getReadingSession: vi.fn(), addReadingLog: vi.fn(),
  finishReadingSession: vi.fn(), updateReadingSessionSom: vi.fn(), updateUserBook: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let pause: ReturnType<typeof vi.spyOn>;
function button(label: string) {
  const element = Array.from(document.querySelectorAll("button")).find((item) => item.textContent === label);
  if (!element) throw new Error(`Botão não encontrado: ${label}`);
  return element;
}
async function click(label: string) { await act(async () => button(label).click()); }
async function write(selector: string, value: string) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) throw new Error("Campo não encontrado");
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("Campo não editável");
  await act(async () => { setter.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
}
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.active = true;
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T02:30:10.000Z"));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } } });
  client.setQueryData(["user_book", "book-123"], { id: "book-123", current_page: 0, format: "fisico", book: { title: "Livro de teste" } });
  client.setQueryData(["reading_session", "session-456"], { iniciado_em: mocks.startedAt, modo: "livre", som_ambiente: "chuva" });
  mocks.addNote.mockResolvedValue({ id: "note-1", kind: "citacao" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
async function render() {
  const Page = (Route as unknown as { component: ComponentType }).component;
  await act(async () => root.render(<QueryClientProvider client={client}><Page /></QueryClientProvider>));
}
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); client.clear(); vi.useRealTimers(); vi.restoreAllMocks();
});

it("guarda a citação no livro da sessão sem navegar, pausar o tempo ou interromper o som", async () => {
  await render();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const pausesBefore = pause.mock.calls.length;
  await click("Anotar");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await write("textarea", "Uma citação durante a leitura");
  await write('input[placeholder="Página (opcional)"]', "42");
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(container.textContent).toContain("00:13");
  await click("Guardar");
  await act(async () => vi.advanceTimersByTimeAsync(0));
  expect(mocks.addNote).toHaveBeenCalledWith({ user_book_id: "book-123", user_id: "user-789", content: "Uma citação durante a leitura", kind: "citacao", page: 42 });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notes", "book-123"] });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(pause.mock.calls.length).toBe(pausesBefore);
  expect(mocks.success).toHaveBeenCalledWith("Anotação guardada");
});

it("mantém o texto e o modal abertos quando o salvamento falha", async () => {
  mocks.addNote.mockRejectedValue(new Error("Falha de rede"));
  await render(); await click("Anotar");
  await write("textarea", "Rascunho preservado"); await click("Guardar");
  await act(async () => vi.advanceTimersByTimeAsync(0));
  expect(document.querySelector("textarea")?.value).toBe("Rascunho preservado");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(mocks.error).toHaveBeenCalledWith("Não foi possível guardar a anotação. Tente de novo.");
  expect(mocks.navigate).not.toHaveBeenCalled();
});

it("não oferece anotações sem assinatura ativa", async () => {
  mocks.active = false; await render();
  expect(Array.from(document.querySelectorAll("button")).some((item) => item.textContent === "Anotar")).toBe(false);
  expect(mocks.addNote).not.toHaveBeenCalled();
});

it("aplica o limite e a página opcional compartilhados ao criar uma nota", async () => {
  const { createBookNote } = await import("@/lib/notes");
  await createBookNote("book-123", "user-789", { content: "a".repeat(2001), kind: "nota", page: "" });
  expect(mocks.addNote).toHaveBeenCalledWith({ user_book_id: "book-123", user_id: "user-789", content: "a".repeat(2000), kind: "nota", page: null });
});