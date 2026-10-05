import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Highlighter, Quote, StickyNote, Camera } from "lucide-react";
import { toast } from "sonner";
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

// Antes de mandar a foto pro OCR, converte pra escala de cinza e realça o
// contraste — ajuda bastante o Tesseract a ler fotos de celular (que quase
// sempre têm sombra, reflexo ou luz irregular) melhor do que a imagem crua.
function preprocessForOcr(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem"));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Não foi possível abrir a imagem"));
      img.onload = () => {
        // Limita o maior lado a 1800px — o Tesseract não precisa de mais
        // resolução que isso, e imagens menores processam bem mais rápido
        // no celular da pessoa.
        const maxSide = 1800;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponível"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const contrast = 1.35; // realce leve de contraste
        for (let i = 0; i < data.length; i += 4) {
          const red = data[i] ?? 0;
          const green = data[i + 1] ?? 0;
          const blue = data[i + 2] ?? 0;
          const gray = red * 0.299 + green * 0.587 + blue * 0.114;
          const adjusted = (gray - 128) * contrast + 128;
          const clamped = Math.max(0, Math.min(255, adjusted));
          data[i] = clamped;
          data[i + 1] = clamped;
          data[i + 2] = clamped;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
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
  const [ocrLoading, setOcrLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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

  // Insere o texto lido da foto na posição do cursor (ou no final, se não
  // houver foco no textarea ainda) — sempre como texto editável, porque
  // OCR erra nome próprio, pontuação e acento com frequência.
  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    const clean = text.trim();
    if (!clean) return;
    if (!el) {
      setContent((prev) => (prev.trim() ? `${prev}\n\n${clean}` : clean));
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const needsBreakBefore = before && !before.endsWith("\n") ? "\n\n" : "";
    const merged = `${before}${needsBreakBefore}${clean}${after}`;
    setContent(merged.slice(0, 2000));
    requestAnimationFrame(() => {
      el.focus();
      const pos = (before + needsBreakBefore + clean).length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleOcrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setOcrLoading(true);
    try {
      const preprocessed = await preprocessForOcr(file);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("por");
      try {
        const { data } = await worker.recognize(preprocessed);
        const text = (data.text || "").trim();
        if (!text) {
          toast.error("Não conseguimos ler texto nessa foto. Tente com mais luz ou mais perto da página.");
        } else {
          insertAtCursor(text);
          toast.success("Texto da foto adicionado (leitura experimental) — revise com atenção antes de guardar.");
        }
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      console.error("Erro no OCR da nota:", err);
      toast.error("Não foi possível ler a foto agora. Você pode digitar a nota normalmente.");
    } finally {
      setOcrLoading(false);
    }
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

          <div className="mx-1 h-5 w-px bg-border" />

          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={ocrLoading}
            aria-label="Tirar foto da página"
            title="Tirar foto da página"
            className="flex items-center gap-1.5 rounded-lg border border-primary/60 px-2.5 py-2 text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
            {ocrLoading ? "Lendo a página…" : "Tirar foto"}
          </button>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={ocrLoading}
            onChange={handleOcrFile}
          />
        </div>

        <p className="px-5 pt-1 text-[11px] text-muted-foreground">
          Leitura de foto ainda é experimental — confira o texto com calma antes de guardar.
        </p>

        <div className="flex-1 overflow-y-auto px-5 pb-2 pt-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            maxLength={2000}
            autoFocus
            placeholder="Grife o trecho que te marcou, ou escreva seu resumo e aprendizados… ou tire uma foto da página."
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
