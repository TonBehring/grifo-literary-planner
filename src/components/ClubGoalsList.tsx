import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  clubMemberDisplayName,
  listGoalCompletions,
  toggleGoalCompletion,
  updateClubGoal,
  type ClubGoal,
  type ClubMember,
  type GoalCompletion,
} from "@/lib/api";

const CELEBRATED_KEY = "grifo_metas_comemoradas";

function readCelebrated(): string[] {
  try {
    const raw = localStorage.getItem(CELEBRATED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function markCelebrated(id: string) {
  try {
    const list = readCelebrated();
    if (!list.includes(id)) localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...list, id]));
  } catch {
    /* ignora */
  }
}

export function goalProgress(goalId: string, members: ClubMember[], completions: GoalCompletion[]) {
  const memberIds = new Set(members.map((m) => m.user_id));
  const done = completions.filter((c) => c.goal_id === goalId && memberIds.has(c.user_id));
  const total = members.length;
  return { n: done.length, total, atingida: total > 0 && done.length === total, userIds: done.map((d) => d.user_id) };
}

function Avatar({ member }: { member: ClubMember }) {
  const nome = clubMemberDisplayName(member);
  return member.avatar_url ? (
    <img src={member.avatar_url} alt={nome} title={nome} className="h-6 w-6 rounded-full border-2 border-background object-cover" />
  ) : (
    <span title={nome} className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
      {nome.replace("@", "").slice(0, 1).toUpperCase()}
    </span>
  );
}

const campo = "w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary";

export function ClubGoalsList({
  clubId,
  goals,
  members,
  userId,
  souAdmin,
  onDelete,
}: {
  clubId: string;
  goals: ClubGoal[];
  members: ClubMember[];
  userId: string;
  souAdmin: boolean;
  onDelete: (goalId: string) => void;
}) {
  const queryClient = useQueryClient();
  const completions = useQuery({
    queryKey: ["club-goal-completions", clubId],
    queryFn: () => listGoalCompletions(clubId),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrar, setCelebrar] = useState<ClubGoal | null>(null);
  const [editando, setEditando] = useState<{ id: string; titulo: string; descricao: string; prazo: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const items = useMemo(() => {
    const list = goals.map((g) => ({ goal: g, p: goalProgress(g.id, members, completions.data ?? []) }));
    return list.sort((a, b) => Number(a.p.atingida) - Number(b.p.atingida));
  }, [goals, members, completions.data]);

  useEffect(() => {
    if (celebrar || !completions.data || members.length === 0) return;
    const celebrated = readCelebrated();
    const nova = items.find((i) => i.p.atingida && !celebrated.includes(i.goal.id));
    if (nova) {
      markCelebrated(nova.goal.id);
      setCelebrar(nova.goal);
    }
  }, [items, celebrar, completions.data, members.length]);

  async function toggle(goalId: string, done: boolean) {
    setBusy(goalId);
    try {
      await toggleGoalCompletion(goalId, userId, done);
      await queryClient.invalidateQueries({ queryKey: ["club-goal-completions", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível marcar a meta");
    } finally {
      setBusy(null);
    }
  }

  async function salvarEdicao() {
    if (!editando) return;
    if (!editando.titulo.trim()) {
      toast.error("Dê um título à meta.");
      return;
    }
    setSalvando(true);
    try {
      await updateClubGoal(editando.id, {
        titulo: editando.titulo.trim(),
        descricao: editando.descricao.trim() || null,
        prazo: editando.prazo || null,
      });
      setEditando(null);
      await queryClient.invalidateQueries({ queryKey: ["club-goals", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a meta");
    } finally {
      setSalvando(false);
    }
  }

  const byId = new Map(members.map((m) => [m.user_id, m]));

  return (
    <>
      {items.map(({ goal, p }) => {
        const prazoVencido = goal.prazo ? new Date(goal.prazo + "T23:59:59").getTime() < Date.now() : false;
        const cumpri = p.userIds.includes(userId);
        const quem = p.userIds.map((id) => byId.get(id)).filter((m): m is ClubMember => Boolean(m));

        if (editando?.id === goal.id) {
          return (
            <div key={goal.id} data-testid="club-goal" className="flex flex-col gap-2 rounded-xl border border-primary/40 p-3">
              <p className="text-xs font-medium text-[#85651C]">Editando meta</p>
              <input
                value={editando.titulo}
                onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                aria-label="Título da meta"
                className={campo}
              />
              <textarea
                value={editando.descricao}
                onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                rows={2}
                placeholder="Descrição (opcional)"
                aria-label="Descrição da meta"
                className={campo}
              />
              <div>
                <label className="text-xs text-muted-foreground">Prazo (opcional)</label>
                <input
                  type="date"
                  value={editando.prazo}
                  onChange={(e) => setEditando({ ...editando, prazo: e.target.value })}
                  className={"mt-1 " + campo}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void salvarEdicao()}
                  disabled={salvando}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
                <button onClick={() => setEditando(null)} className="text-xs text-muted-foreground underline underline-offset-4">
                  Cancelar
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={goal.id}
            data-testid="club-goal"
            className={"rounded-xl border p-3 " + (p.atingida ? "border-primary bg-primary/10" : "border-border")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{goal.titulo}</p>
                {p.atingida && (
                  <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                    Meta atingida pelo clube 🎉
                  </span>
                )}
                {goal.prazo && (
                  <p className="text-xs text-muted-foreground">
                    Prazo: {new Date(goal.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                    {prazoVencido && !p.atingida && " · Prazo encerrado"}
                  </p>
                )}
                {goal.descricao && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{goal.descricao}</p>
                )}
              </div>
              {souAdmin && (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={() =>
                      setEditando({
                        id: goal.id,
                        titulo: goal.titulo,
                        descricao: goal.descricao ?? "",
                        prazo: goal.prazo ?? "",
                      })
                    }
                    aria-label="Editar meta"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(goal.id)}
                    aria-label="Apagar meta"
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-2">
              <p className="text-xs text-muted-foreground">{p.n} de {p.total} membros cumpriram</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-teal" style={{ width: `${p.total ? (p.n / p.total) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex -space-x-1.5">
                {quem.slice(0, 5).map((m) => <Avatar key={m.user_id} member={m} />)}
                {quem.length > 5 && <span className="pl-2 text-xs text-muted-foreground">+{quem.length - 5}</span>}
              </div>
              <button
                aria-pressed={cumpri}
                disabled={busy === goal.id}
                onClick={() => {
                  const vaiCompletar = !cumpri && p.n + 1 === p.total;
                  void toggle(goal.id, !cumpri).then(() => {
                    if (vaiCompletar && !readCelebrated().includes(goal.id)) {
                      markCelebrated(goal.id);
                      setCelebrar(goal);
                    }
                  });
                }}
                className={
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-60 " +
                  (cumpri ? "bg-teal text-background" : "border border-border text-foreground")
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {cumpri ? "Cumpri ✓" : "Cumpri"}
              </button>
            </div>
          </div>
        );
      })}

      <Dialog open={Boolean(celebrar)} onOpenChange={(o) => !o && setCelebrar(null)}>
        <DialogContent className="card-teal !bg-teal max-w-md rounded-3xl border-none p-7">
          <div className="text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 text-[11px] tracking-[0.2em] text-primary uppercase">Meta atingida pelo clube</p>
            <h2 className="font-display mt-2 text-2xl leading-snug">{celebrar?.titulo}</h2>
            <p className="mt-2 text-sm opacity-70">Todos os membros cumpriram. Que leitura em grupo!</p>
            <button
              onClick={() => setCelebrar(null)}
              className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground"
            >
              Comemorar 🎉
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
