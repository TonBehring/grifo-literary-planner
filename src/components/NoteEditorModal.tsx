import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Highlighter, Quote, StickyNote } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const DRAFT_PREFIX = "grifo-draft-nota:";

function draftKeyFor(userBookId: string, noteId: string | null) {
  return `${DRAFT_PREFIX}${userBookId}:${noteId ?? "novo"}`;
}

function wrapSelection(
  value: string,
  start: number,
  end: number,
  token: string,
): { value: string; selStart: number; selEnd: number } {
  const before = value.slice(0, start);
  const selected = value.slice(start, end) || "texto";
  const after = value.slice(end);
  const wrapped = `${token}${selected}${token}`;
  return {
    value: before + wrapped + after,
    selStart: before.length + token.length,
    selEnd: before.length + token.length + selected.length,
  };
}

export function NoteEditorModal({
  open,
  onOpenChange,
  userBookId,
  noteId,
  initialContent,
  initialKind,
  initialPage,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBookId: string;
  noteId: string | null;
  initialContent: string;
  initialKind: "nota" | "citacao";
  initialPage: string;
  saving: boolean;
  onSave: (data: { content: string; kind: "nota" | "citacao"; page: string }) => void;
}) {
  const key = draftKeyFor(userBookId, noteId);
  const [content, setContent] = useState(initialContent);
  const [kind, setKind] = useState<"nota" | "citacao">(initialKind);
  const [page, setPage] = useState(initialPage);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ao abrir o modal, se existir um rascunho salvo (de uma sessão anterior
  // em que o usuário escreveu algo e não chegou a salvar), recupera ele em
  // vez do conteúdo original.
  useEffect(() => {
    if (!open) return;
    let draft: string | null = null;
    try {
      draft = localStorage.getItem(key);
    } catch {
      draft = null;
    }
    if (draft && draft.trim() && draft !== initialContent) {
      setContent(draft);
      setRestoredDraft(true);
    } else {
      setContent(initialContent);
      setRestoredDraft(false);
    }
    setKind(initialKind);
    setPage(initialPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  // Autosave do rascunho enquanto o usuário digita, pra nunca mais perder
  // um texto por fechar o app ou a aba sem salvar.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        if (content.trim() && content !== initialContent) {
          localStorage.setItem(key, content);
        } else {
          localStorage.removeItem(key);
        }
      } catch {
        // Se o localStorage estiver indisponível, só não teremos rascunho —
        // não é motivo pra travar a digitação.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [content, open, key, initialContent]);

  function applyToken(token: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { value, selStart, selEnd } = wrapSelection(
      content,
      el.selectionStart,
      el.selectionEnd,
      token,
    );
    setContent(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function handleSave() {
    if (!content.trim()) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignora
    }
    onSave({ content: content.trim(), kind, page });
  }

  const isEditing = noteId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="panel-cream !bg-cream flex max-h-[85vh] w-[min(640px,92vw)] flex-col gap-0 rounded-3xl border-none p-0">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-xl">{isEditing ? "Editar anotação" : "Nova anotação"}</h2>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            {(["citacao", "nota"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors " +
                  (kind === k
                    ? "border-primary bg-primary/20"
                    : "border-border text-muted-foreground")
                }
              >
                {k === "citacao" ? <Quote className="h-4 w-4" /> : <StickyNote className="h-4 w-4" />}
                {k === "citacao" ? "Citação" : "Nota"}
              </button>
            ))}
          </div>
        )}

        {restoredDraft && (
          <p className="mx-5 mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            Recuperamos um rascunho que ainda não tinha sido salvo.
          </p>
        )}

        <div className="flex items-center gap-1 px-5 pt-3">
          <ToolbarButton label="Negrito" onClick={() => applyToken("**")}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Itálico" onClick={() => applyToken("*")}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Grifado" onClick={() => applyToken("==")}>
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 pt-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            maxLength={2000}
            autoFocus
            placeholder="Grife o trecho que te marcou, ou escreva seu resumo e aprendizados…"
            className="min-h-[220px] w-full resize-none rounded-xl border border-border p-3 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">{content.length}/2000</p>
        </div>

        <div className="flex items-center gap-3 border-t border-border px-5 py-4">
          {!isEditing && (
            <input
              value={page}
              onChange={(e) => setPage(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Página (opcional)"
              className="w-32 shrink-0 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          )}
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
    >
      {children}
    </button>
  );
}
