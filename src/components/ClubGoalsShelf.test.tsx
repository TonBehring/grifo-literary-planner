import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const calls: Array<{ op: string; table: string; args: unknown[] }> = [];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    const rec = (op: string) => (...args: unknown[]) => { calls.push({ op, table, args }); return b; };
    b["insert"] = rec("insert"); b["delete"] = rec("delete"); b["eq"] = rec("eq");
    b["then"] = (r: (v: { error: null }) => void) => r({ error: null });
    return b;
  };
  return { calls, from: vi.fn(builder) };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: m.from, rpc: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/BookCover", () => ({ BookCover: () => null }));

import { toggleGoalCompletion, type ClubMember } from "@/lib/api";
import { ClubGoalsList, goalProgress } from "./ClubGoalsList";
import { ClubShelf, formatShelfPeriod, formatShelfRating } from "./ClubShelf";

const mem = (id: string): ClubMember => ({ user_id: id, papel: "membro", entrou_em: "", username: id, nome: id, avatar_url: null, ranking_oculto: false });
const goal = { id: "g1", club_id: "c1", titulo: "Ler 3 capítulos", descricao: null, prazo: null, criado_por: "u1", criado_em: "" };

let root: Root; let container: HTMLDivElement; let client: QueryClient;
beforeEach(() => {
  m.calls.length = 0; localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
});
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; });
async function show(el: React.ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}>{el}</QueryClientProvider>));
}

describe("metas", () => {
  it("toggle insere ou apaga a marcação do próprio usuário", async () => {
    await toggleGoalCompletion("g1", "u1", true);
    expect(m.calls[0]).toEqual({ op: "insert", table: "club_goal_completions", args: [{ goal_id: "g1", user_id: "u1" }] });
    m.calls.length = 0;
    await toggleGoalCompletion("g1", "u1", false);
    expect(m.calls.map((c) => c.op)).toEqual(["delete", "eq", "eq"]);
    expect(m.calls[1]!.args).toEqual(["goal_id", "g1"]);
    expect(m.calls[2]!.args).toEqual(["user_id", "u1"]);
  });

  it("progresso parcial e selo quando todos os membros cumprem", async () => {
    const members = [mem("u1"), mem("u2")];
    expect(goalProgress("g1", members, [{ goal_id: "g1", user_id: "u1", concluida_em: "" }])).toMatchObject({ n: 1, total: 2, atingida: false });
    client.setQueryData(["club-goal-completions", "c1"], [
      { goal_id: "g1", user_id: "u1", concluida_em: "" },
      { goal_id: "g1", user_id: "u2", concluida_em: "" },
    ]);
    await show(<ClubGoalsList clubId="c1" goals={[goal]} members={members} userId="u1" souAdmin={false} onDelete={() => {}} />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("2 de 2 membros cumpriram");
    expect(text).toContain("Meta atingida pelo clube 🎉");
    expect(document.querySelector("[aria-pressed='true']")?.textContent).toContain("Cumpri ✓");
  });
});

describe("estante", () => {
  it("formata período e nota", () => {
    expect(formatShelfPeriod("2026-11-21", "2026-12-05")).toBe("21/11 a 05/12/2026");
    expect(formatShelfPeriod("2026-11-21", null)).toBe("desde 21/11/2026");
    expect(formatShelfRating("4.33", 6)).toBe("4,3 · 6 avaliações");
    expect(formatShelfRating(null, 0)).toBe("Sem avaliações ainda");
  });

  it("vazia mostra o convite e com itens mostra os livros", async () => {
    client.setQueryData(["club-shelf", "c1"], []);
    await show(<ClubShelf clubId="c1" />);
    expect(document.body.textContent).toContain("Quando o clube terminar uma leitura, ela aparece aqui.");
    client.setQueryData(["club-shelf", "c2"], [{
      club_book_id: "cb1", book_id: "b1", titulo: "Dom Casmurro", autor: "Machado", capa_url: null,
      data_inicio: "2026-11-21", data_fim: "2026-12-05", nota_media: 4.3, avaliacoes: 6, membros_que_leram: 5,
    }]);
    await show(<ClubShelf clubId="c2" />);
    const t = document.body.textContent ?? "";
    expect(document.querySelectorAll("[data-testid='shelf-item']").length).toBe(1);
    expect(t).toContain("21/11 a 05/12/2026");
    expect(t).toContain("4,3 · 6 avaliações");
    expect(t).toContain("5 membros leram");
  });
});
