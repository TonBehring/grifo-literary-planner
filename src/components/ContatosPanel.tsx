import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Camera, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  USERNAME_REGEX,
  connectByUsername,
  getMyUsername,
  listContacts,
  setUsername as saveUsername,
  type Contato,
} from "@/lib/contatos";
import QrScannerView from "@/components/QrScannerView";

const inputClass =
  "w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary";

export function ContatosPanel() {
  const { user } = useAuth();
  const [username, setUsernameState] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);
  const [savingUsername, setSavingUsername] = useState(false);

  const [contacts, setContacts] = useState<Contato[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);

  const [target, setTarget] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function refreshContacts() {
    setLoadingContacts(true);
    try {
      setContacts(await listContacts());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar seus contatos.");
    } finally {
      setLoadingContacts(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void getMyUsername(user.id).then((u) => {
      if (!alive) return;
      setUsernameState(u);
      setDraft(u ?? "");
      setLoadingUser(false);
    });
    void refreshContacts();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleSaveUsername() {
    const value = draft.trim().toLowerCase();
    if (!USERNAME_REGEX.test(value)) {
      toast.error("Use de 3 a 20 caracteres: letras minúsculas, números e _");
      return;
    }
    setSavingUsername(true);
    try {
      const saved = await saveUsername(value);
      setUsernameState(saved);
      setDraft(saved);
      toast.success("Nome de usuário salvo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o nome de usuário.");
    } finally {
      setSavingUsername(false);
    }
  }

  async function connect(value: string) {
    const cleaned = value.trim().toLowerCase().replace(/^grifo:/, "");
    if (!cleaned) return;
    setConnecting(true);
    try {
      const contato = await connectByUsername(cleaned);
      toast.success(`Você está conectado com ${contato.nome}.`);
      setTarget("");
      await refreshContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível conectar.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="panel-cream mt-6 space-y-5 rounded-2xl p-5">
      <h2 className="font-display text-2xl">Meus contatos</h2>

      <label className="block">
        <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Nome de usuário
        </span>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.toLowerCase())}
            maxLength={20}
            placeholder="ex: maria_leitora"
            className={inputClass}
          />
          <button
            onClick={handleSaveUsername}
            disabled={savingUsername || loadingUser}
            className="shrink-0 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {savingUsername ? "…" : "Salvar"}
          </button>
        </div>
      </label>
      <p className="-mt-3 text-xs text-muted-foreground">
        Entre 3 e 20 caracteres, apenas letras minúsculas, números e underline.
      </p>

      {username && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-4">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Meu código
          </span>
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG value={username} size={148} level="M" />
          </div>
          <span className="font-display text-lg">@{username}</span>
          <p className="text-center text-xs text-muted-foreground">
            Mostre este código para outra pessoa escanear e se conectar com você.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Conectar com alguém
        </span>
        <div className="flex gap-2">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value.toLowerCase())}
            maxLength={20}
            placeholder="nome de usuário"
            className={inputClass}
          />
          <button
            onClick={() => void connect(target)}
            disabled={connecting || !target.trim()}
            className="shrink-0 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Conectar
          </button>
          <button
            type="button"
            onClick={() => setScanning((v) => !v)}
            aria-label="Ler QR Code"
            className="shrink-0 rounded-xl border border-border px-3 text-muted-foreground hover:text-foreground"
          >
            <Camera className="h-4 w-4" />
          </button>
        </div>
        {scanning && (
          <QrScannerView
            onResult={(value) => {
              setScanning(false);
              void connect(value);
            }}
          />
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" /> Conectados
          </span>
          <button
            onClick={() => void refreshContacts()}
            aria-label="Atualizar contatos"
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {loadingContacts ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não tem contatos. Escaneie o QR Code de alguém para começar.
          </p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5 text-sm"
              >
                <span>{c.nome}</span>
                {c.username && <span className="text-xs text-muted-foreground">@{c.username}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}