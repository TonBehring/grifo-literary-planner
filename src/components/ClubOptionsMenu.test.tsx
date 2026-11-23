import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ updateClub: vi.fn(), deleteClub: vi.fn(), leaveClub: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Menu simplificado: renderiza os itens direto, para testar quem vê o quê.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...p }: { children: React.ReactNode }) => <button {...p}>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => (
    <button data-item onClick={onSelect}>{children}</button>
  ),
}));

import { ClubOptionsMenu, leaveBlockReason } from "./ClubOptionsMenu";

type M = { user_id: string; papel: "admin" | "membro" };
const club = { id: "c1", nome: "Clube Azul", descricao: null, tipo: "privado" as const };
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

function items() {
  return Array.from(document.querySelectorAll("[data-item]")).map((b) => b.textContent);
}
function btn(label: string) {
  return Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label);
}
async function show(souAdmin: boolean, members: M[]) {
  await act(async () => {
    root.render(
      <ClubOptionsMenu club={club} souAdmin={souAdmin} userId="u1" members={members}
        onUpdated={() => {}} onDeleted={() => {}} onLeft={() => {}} />,
    );
  });
}

describe("ClubOptionsMenu", () => {
  it("admin vê Editar e Excluir", async () => {
    await show(true, [{ user_id: "u1", papel: "admin" }, { user_id: "u2", papel: "admin" }]);
    expect(items()).toEqual(["Editar clube", "Sair do clube", "Excluir clube"]);
  });

  it("membro comum vê só Sair", async () => {
    await show(false, [{ user_id: "u1", papel: "membro" }, { user_id: "u2", papel: "admin" }]);
    expect(items()).toEqual(["Sair do clube"]);
  });

  it("Excluir para sempre só habilita com o nome exato", async () => {
    await show(true, [{ user_id: "u1", papel: "admin" }]);
    await act(async () => btn("Excluir clube")!.click());
    const input = document.getElementById("club-delete-nome") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const type = async (v: string) =>
      act(async () => { setter.call(input, v); input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect((btn("Excluir para sempre") as HTMLButtonElement).disabled).toBe(true);
    await type("clube azul");
    expect((btn("Excluir para sempre") as HTMLButtonElement).disabled).toBe(true);
    await type("Clube Azul");
    expect((btn("Excluir para sempre") as HTMLButtonElement).disabled).toBe(false);
  });

  it("único admin com outros membros não consegue sair", async () => {
    const members: M[] = [{ user_id: "u1", papel: "admin" }, { user_id: "u2", papel: "membro" }];
    expect(leaveBlockReason(true, members, "u1")).toBe("unico-admin");
    expect(leaveBlockReason(true, [{ user_id: "u1", papel: "admin" }], "u1")).toBe("unico-membro");
    expect(leaveBlockReason(true, [...members, { user_id: "u3", papel: "admin" }], "u1")).toBe("ok");
    await show(true, members);
    await act(async () => btn("Sair do clube")!.click());
    expect(document.body.textContent).toContain("Antes de sair, torne outro membro administrador.");
    expect(Array.from(document.querySelectorAll("button:not([data-item])")).some((b) => b.textContent === "Sair do clube")).toBe(false);
  });
});
