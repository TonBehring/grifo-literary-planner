import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteClub, leaveClub, updateClub, type Club, type ClubType } from "@/lib/api";

export type LeaveBlock = "ok" | "unico-admin" | "unico-membro";

export function leaveBlockReason(
  souAdmin: boolean,
  members: Array<{ user_id: string; papel: "admin" | "membro" }>,
  userId: string,
): LeaveBlock {
  const outros = members.filter((m) => m.user_id !== userId);
  if (outros.length === 0) return "unico-membro";
  if (souAdmin && !outros.some((m) => m.papel === "admin")) return "unico-admin";
  return "ok";
}

type Props = {
  club: Pick<Club, "id" | "nome" | "descricao" | "tipo">;
  souAdmin: boolean;
  userId: string;
  members: Array<{ user_id: string; papel: "admin" | "membro" }>;
  onUpdated: () => void;
  onDeleted: () => void;
  onLeft: () => void;
};

export function ClubOptionsMenu({ club, souAdmin, userId, members, onUpdated, onDeleted, onLeft }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [nome, setNome] = useState(club.nome);
  const [descricao, setDescricao] = useState(club.descricao ?? "");
  const [tipo, setTipo] = useState<ClubType>(club.tipo);
  const [confirmNome, setConfirmNome] = useState("");
  const [busy, setBusy] = useState(false);

  const block = leaveBlockReason(souAdmin, members, userId);

  function abrirEditar() {
    setNome(club.nome);
    setDescricao(club.descricao ?? "");
    setTipo(club.tipo);
    setEditOpen(true);
  }

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Dê um nome ao clube.");
      return;
    }
    setBusy(true);
    try {
      await updateClub(club.id, { nome: nome.trim(), descricao: descricao.trim() || null, tipo });
      toast.success("Clube atualizado");
      setEditOpen(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o clube");
    } finally {
      setBusy(false);
    }
  }

  async function excluir() {
    if (confirmNome !== club.nome) return;
    setBusy(true);
    try {
      await deleteClub(club.id);
      toast.success("Clube excluído");
      setDeleteOpen(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o clube");
    } finally {
      setBusy(false);
    }
  }

  async function sair() {
    if (block !== "ok") return;
    setBusy(true);
    try {
      await leaveClub(club.id, userId);
      toast.success("Você saiu do clube");
      setLeaveOpen(false);
      onLeft();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível sair do clube");
    } finally {
      setBusy(false);
    }
  }

  const tipoBtn = (t: ClubType, label: string) => (
    <button
      type="button"
      onClick={() => setTipo(t)}
      className={
        "flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-colors " +
        (tipo === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground")
      }
    >
      {label}
    </button>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opções do clube"
          className="ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {souAdmin && <DropdownMenuItem onSelect={abrirEditar}>Editar clube</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setLeaveOpen(true)}>Sair do clube</DropdownMenuItem>
          {souAdmin && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                setConfirmNome("");
                setDeleteOpen(true);
              }}
            >
              Excluir clube
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar clube</DialogTitle>
            <DialogDescription>Altere o nome, a descrição ou a visibilidade.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="club-edit-nome" className="text-sm text-muted-foreground">Nome do clube</label>
              <input
                id="club-edit-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="club-edit-desc" className="text-sm text-muted-foreground">Descrição (opcional)</label>
              <textarea
                id="club-edit-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visibilidade</p>
              <div className="mt-2 flex gap-2">
                {tipoBtn("privado", "Privado (só por convite)")}
                {tipoBtn("publico", "Público")}
              </div>
              {club.tipo === "privado" && tipo === "publico" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Clubes públicos aparecem em Descobrir clubes para qualquer leitor.
                </p>
              )}
            </div>
            <button
              onClick={salvar}
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir clube</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o clube para todos os membros, com posts, comentários, metas, encontros e
              convites. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <label htmlFor="club-delete-nome" className="text-sm text-muted-foreground">
              Digite o nome do clube para confirmar: <strong>{club.nome}</strong>
            </label>
            <input
              id="club-delete-nome"
              value={confirmNome}
              onChange={(e) => setConfirmNome(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-destructive"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <button
              onClick={excluir}
              disabled={busy || confirmNome !== club.nome}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
            >
              {busy ? "Excluindo…" : "Excluir para sempre"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do clube</AlertDialogTitle>
            <AlertDialogDescription>
              {block === "unico-admin"
                ? "Antes de sair, torne outro membro administrador."
                : block === "unico-membro"
                  ? souAdmin
                    ? "Você é o único membro deste clube. Em vez de sair, você pode excluir o clube."
                    : "Você é o único membro deste clube."
                  : "Você deixa de ver os posts e o ranking deste clube. Pode entrar de novo depois, se o clube for público ou com um convite."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {block === "ok" && (
              <button
                onClick={sair}
                disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Saindo…" : "Sair do clube"}
              </button>
            )}
            {block === "unico-membro" && souAdmin && (
              <button
                onClick={() => {
                  setLeaveOpen(false);
                  setConfirmNome("");
                  setDeleteOpen(true);
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
              >
                Excluir clube
              </button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
