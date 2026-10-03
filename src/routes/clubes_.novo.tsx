// src/routes/clubes_.novo.tsx
//
// IMPORTANTE: o nome do arquivo tem um "_" logo depois de "clubes"
// (clubes_.novo.tsx, não clubes.novo.tsx). É proposital — é a mesma
// convenção usada em livro.$id_.sessao.tsx, pra gerar a URL /clubes/novo
// SEM aninhar essa tela dentro de clubes.tsx (que não tem um <Outlet />
// pra exibir uma tela filha). Sem o "_", a rota existe mas nunca aparece
// na tela.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { createClub, createClubInvite, type ClubType } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/clubes/novo")({
  component: () => (
    <AppShell>
      <NovoClube />
    </AppShell>
  ),
});

function NovoClube() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<ClubType>("privado");
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!user) return;
    if (!nome.trim()) {
      toast.error("Dê um nome ao clube.");
      return;
    }
    setSalvando(true);
    try {
      const club = await createClub({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        tipo,
        criado_por: user.id,
      });
      const codigo = await createClubInvite(club.id, user.id);
      toast.success(`Clube criado! Código de convite: ${codigo}`, { duration: 8000 });
      navigate({ to: "/clubes" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o clube");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="flex min-h-[70vh] flex-col">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Criar clube</h1>
        <button
          onClick={() => navigate({ to: "/clubes" })}
          aria-label="Fechar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-sm text-muted-foreground">Nome do clube</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Clube do Livro — Torcida Tal"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Descrição (opcional)</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            placeholder="Do que esse clube trata?"
            className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Visibilidade</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setTipo("privado")}
              className={
                "flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-colors " +
                (tipo === "privado"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground")
              }
            >
              Privado (só por convite)
            </button>
            <button
              onClick={() => setTipo("publico")}
              className={
                "flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-colors " +
                (tipo === "publico"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground")
              }
            >
              Público
            </button>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-10">
        <button
          onClick={criar}
          disabled={salvando}
          className="w-full rounded-full bg-primary py-4 text-base font-medium text-primary-foreground disabled:opacity-60"
        >
          {salvando ? "Criando…" : "Criar clube"}
        </button>
      </div>
    </section>
  );
}
