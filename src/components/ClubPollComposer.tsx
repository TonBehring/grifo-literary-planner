import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { criarEnquete, MAX_OPCOES } from "@/lib/club-polls";

const campo =
  "w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary";

// Formulário de nova enquete no mural do clube.
export function ClubPollComposer({ clubId, onCreated }: { clubId: string; onCreated: () => void }) {
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>(["", ""]);
  const [multipla, setMultipla] = useState(false);
  const [comPrazo, setComPrazo] = useState(false);
  const [encerraEm, setEncerraEm] = useState("");
  const [pagina, setPagina] = useState("");
  const [salvando, setSalvando] = useState(false);

  function mudarOpcao(i: number, texto: string) {
    setOpcoes((lista) => lista.map((o, j) => (j === i ? texto : o)));
  }

  async function publicar() {
    const validas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (!pergunta.trim()) {
      toast.error("Escreva a pergunta da enquete.");
      return;
    }
    if (validas.length < 2) {
      toast.error("Coloque pelo menos 2 opções.");
      return;
    }
    if (comPrazo && !encerraEm) {
      toast.error("Escolha quando a enquete encerra, ou desmarque essa opção.");
      return;
    }
    setSalvando(true);
    try {
      await criarEnquete({
        clubId,
        pergunta: pergunta.trim(),
        opcoes: validas,
        multipla,
        encerraEm: comPrazo && encerraEm ? new Date(encerraEm).toISOString() : null,
        pagina: pagina.trim() ? Number(pagina) : null,
      });
      setPergunta("");
      setOpcoes(["", ""]);
      setMultipla(false);
      setComPrazo(false);
      setEncerraEm("");
      setPagina("");
      toast.success("Enquete publicada no mural.");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível publicar a enquete");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value.slice(0, 500))}
        rows={2}
        placeholder="Pergunta (ex.: Qual será o próximo livro do clube?)"
        aria-label="Pergunta da enquete"
        className={campo}
      />
      {opcoes.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={o}
            onChange={(e) => mudarOpcao(i, e.target.value.slice(0, 100))}
            placeholder={`Opção ${i + 1}`}
            aria-label={`Opção ${i + 1}`}
            className={campo}
          />
          {opcoes.length > 2 && (
            <button
              type="button"
              onClick={() => setOpcoes((lista) => lista.filter((_, j) => j !== i))}
              aria-label={`Tirar opção ${i + 1}`}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {opcoes.length < MAX_OPCOES && (
        <button
          type="button"
          onClick={() => setOpcoes((lista) => [...lista, ""])}
          className="inline-flex items-center gap-1 self-start text-xs font-medium text-[#85651C] underline underline-offset-4"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar opção
        </button>
      )}

      <label className="mt-1 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={multipla} onChange={(e) => setMultipla(e.target.checked)} className="h-4 w-4 accent-primary" />
        Permitir escolher mais de uma opção
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={comPrazo} onChange={(e) => setComPrazo(e.target.checked)} className="h-4 w-4 accent-primary" />
        Definir data para encerrar
      </label>
      {comPrazo && (
        <input
          type="datetime-local"
          value={encerraEm}
          onChange={(e) => setEncerraEm(e.target.value)}
          aria-label="Data e hora de encerramento"
          className={campo}
        />
      )}

      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          value={pagina}
          onChange={(e) => setPagina(e.target.value)}
          placeholder="Página (opcional)"
          aria-label="Página do livro (opcional)"
          className="w-36 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void publicar()}
          disabled={salvando}
          className="ml-auto rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {salvando ? "Publicando…" : "Publicar enquete"}
        </button>
      </div>
    </div>
  );
}
