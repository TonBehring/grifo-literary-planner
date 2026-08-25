import { useState, useRef } from "react";
import { Camera, ImageIcon, Link2, Upload } from "lucide-react";
import { BookCover } from "@/components/BookCover";

export function CoverPicker({
  cover,
  title,
  onUpload,
  onUseUrl,
  onRemove,
  uploading,
}: {
  cover: string | null;
  title?: string | null;
  onUpload: (file: File) => void;
  onUseUrl: (url: string) => void;
  onRemove: () => void;
  uploading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const hasCover = Boolean(cover);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOpen(false);
    setShowUrl(false);
    onUpload(file);
  }

  function handleUseUrl() {
    const url = urlInput.trim();
    if (!url) return;
    onUseUrl(url);
    setUrlInput("");
    setShowUrl(false);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        <BookCover src={cover} title={title || null} />
      </div>

      <div className="relative min-w-0">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setShowUrl(false);
          }}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          <ImageIcon className="h-4 w-4" />
          {uploading ? "Enviando…" : hasCover ? "Trocar capa" : "Adicionar capa"}
        </button>

        {hasCover && (
          <button
            type="button"
            onClick={() => {
              onRemove();
              setOpen(false);
              setShowUrl(false);
            }}
            className="ml-3 text-sm text-muted-foreground underline underline-offset-4"
          >
            Remover
          </button>
        )}

        {open && (
          <div className="absolute top-full z-10 mt-2 w-56 rounded-xl border border-border bg-card p-2 text-card-foreground shadow-lg">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-white/10"
            >
              <Camera className="h-4 w-4 text-primary" />
              Tirar foto
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-white/10"
            >
              <Upload className="h-4 w-4 text-primary" />
              Enviar do dispositivo
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUrl(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:bg-white/10"
            >
              <Link2 className="h-4 w-4 text-primary" />
              Usar link da web
            </button>
          </div>
        )}

        {showUrl && (
          <div className="mt-3 flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Cole o link da imagem"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border border-border bg-card/0 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleUseUrl}
              className="shrink-0 rounded-xl border border-primary px-3 text-sm text-primary"
            >
              Usar
            </button>
          </div>
        )}

        {/* Envia arquivo já existente no dispositivo (galeria, arquivos, etc.) */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />

        {/* Abre a câmera diretamente no celular. "capture" é ignorado em
            desktop, onde o navegador simplesmente abre o seletor de arquivo
            normal — por isso é seguro deixar sempre presente. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={uploading}
          onChange={handleFileChange}
        />

        <p className="mt-2 text-xs text-muted-foreground">JPG ou PNG, até 5MB.</p>
      </div>
    </div>
  );
}
