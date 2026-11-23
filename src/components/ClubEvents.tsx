import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clubMemberDisplayName,
  createClubEvent,
  deleteClubEvent,
  listClubEventRsvps,
  listClubEvents,
  setEventRsvp,
  type ClubEvent,
  type ClubMember,
  type EventRsvp,
} from "@/lib/api";

type ConfirmFn = (opts: { title: string; description?: string }) => Promise<boolean>;

const DURACAO_MS = 2 * 60 * 60 * 1000; // encontros entram na agenda com 2 horas

function toCalendarStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(ev: ClubEvent, clubNome: string): string {
  const inicio = new Date(ev.data_hora);
  const fim = new Date(inicio.getTime() + DURACAO_MS);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${ev.titulo} (${clubNome})`,
    dates: `${toCalendarStamp(inicio)}/${toCalendarStamp(fim)}`,
    details: ev.descricao ?? `Encontro do clube ${clubNome} no Grifo.`,
    location: ev.local_ou_link ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(ev: ClubEvent, clubNome: string): string {
  const inicio = new Date(ev.data_hora);
  const fim = new Date(inicio.getTime() + DURACAO_MS);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Grifo//Clubes de Leitura//PT",
    "BEGIN:VEVENT",
    `UID:${ev.id}@useogrifo.app`,
    `DTSTAMP:${toCalendarStamp(new Date())}`,
    `DTSTART:${toCalendarStamp(inicio)}`,
    `DTEND:${toCalendarStamp(fim)}`,
    `SUMMARY:${icsEscape(`${ev.titulo} (${clubNome})`)}`,
    `DESCRIPTION:${icsEscape(ev.descricao ?? `Encontro do clube ${clubNome} no Grifo.`)}`,
    `LOCATION:${icsEscape(ev.local_ou_link ?? "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function baixarIcs(ev: ClubEvent, clubNome: string) {
  const blob = new Blob([buildIcs(ev, clubNome)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "encontro-grifo.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nomesResumo(ids: string[], memberByUserId: Map<string, ClubMember>, userId: string): string {
  const nomes = ids.map((id) => {
    if (id === userId) return "você";
    const m = memberByUserId.get(id);
    return m ? clubMemberDisplayName(m) : "alguém";
  });
  if (nomes.length <= 3) return nomes.join(", ");
  return `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}`;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Seção "Encontros" do clube: criar (admin), lista dos próximos com
// "Vou / Não vou" e "Adicionar à agenda", e os anteriores escondidos.
export function ClubEvents({
  clubId,
  clubNome,
  userId,
  souAdmin,
  memberByUserId,
  confirm,
}: {
  clubId: string;
  clubNome: string;
  userId: string;
  souAdmin: boolean;
  memberByUserId: Map<string, ClubMember>;
  confirm: ConfirmFn;
}) {
  const queryClient = useQueryClient();
  const events = useQuery({ queryKey: ["club-events", clubId], queryFn: () => listClubEvents(clubId) });
  const eventIds = (events.data ?? []).map((e) => e.id);
  const rsvps = useQuery({
    queryKey: ["club-event-rsvps", clubId, eventIds.join(",")],
    queryFn: () => listClubEventRsvps(eventIds),
    enabled: eventIds.length > 0,
  });

  const [novoAberto, setNovoAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [criando, setCriando] = useState(false);
  const [verAnteriores, setVerAnteriores] = useState(false);

  const agora = Date.now();
  const proximos = (events.data ?? []).filter((e) => new Date(e.data_hora).getTime() >= agora);
  const anteriores = (events.data ?? [])
    .filter((e) => new Date(e.data_hora).getTime() < agora)
    .reverse();

  if (!souAdmin && !events.isLoading && (events.data ?? []).length === 0) return null;

  async function criar() {
    if (!titulo.trim() || !dataHora) {
      toast.error("Preencha pelo menos o título e a data/hora.");
      return;
    }
    setCriando(true);
    try {
      await createClubEvent({
        club_id: clubId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data_hora: new Date(dataHora).toISOString(),
        local_ou_link: local.trim() || null,
        criado_por: userId,
      });
      setTitulo("");
      setDataHora("");
      setLocal("");
      setDescricao("");
      setNovoAberto(false);
      void queryClient.invalidateQueries({ queryKey: ["club-events", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o encontro");
    } finally {
      setCriando(false);
    }
  }

  async function apagar(eventId: string) {
    if (!(await confirm({ title: "Apagar encontro?" }))) return;
    try {
      await deleteClubEvent(eventId);
      void queryClient.invalidateQueries({ queryKey: ["club-events", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível apagar o encontro");
    }
  }

  async function responder(eventId: string, atual: EventRsvp["resposta"] | null, nova: EventRsvp["resposta"]) {
    try {
      await setEventRsvp(eventId, userId, atual === nova ? null : nova);
      void queryClient.invalidateQueries({ queryKey: ["club-event-rsvps", clubId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar sua resposta");
    }
  }

  function cartao(ev: ClubEvent, passado: boolean) {
    const ehLink = ev.local_ou_link?.startsWith("http");
    const doEvento = (rsvps.data ?? []).filter((r) => r.event_id === ev.id);
    const vao = doEvento.filter((r) => r.resposta === "vou").map((r) => r.user_id);
    const minha = doEvento.find((r) => r.user_id === userId)?.resposta ?? null;
    const opcao = (valor: EventRsvp["resposta"], rotulo: string) => (
      <button
        type="button"
        aria-pressed={minha === valor}
        onClick={() => responder(ev.id, minha, valor)}
        className={
          "rounded-full px-4 py-1.5 text-xs font-medium transition-colors " +
          (minha === valor ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground")
        }
      >
        {rotulo}
      </button>
    );

    return (
      <div key={ev.id} className={"rounded-xl border border-border p-3 " + (passado ? "opacity-60" : "")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{ev.titulo}</p>
            <p className="text-xs text-muted-foreground">{formatarData(ev.data_hora)}</p>
            {ev.local_ou_link &&
              (ehLink ? (
                <a
                  href={ev.local_ou_link}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-xs text-primary underline underline-offset-4"
                >
                  {ev.local_ou_link}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">{ev.local_ou_link}</p>
              ))}
            {ev.descricao && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{ev.descricao}</p>
            )}
          </div>
          {souAdmin && (
            <button
              onClick={() => apagar(ev.id)}
              aria-label="Apagar encontro"
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {!passado && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {opcao("vou", "Vou")}
              {opcao("nao_vou", "Não vou")}
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline underline-offset-4">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Adicionar à agenda
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => window.open(googleCalendarUrl(ev, clubNome), "_blank", "noopener")}
                  >
                    Google Agenda
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => baixarIcs(ev, clubNome)}>
                    iPhone, Outlook e outros
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {vao.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {vao.length === 1 ? "Vai" : `Vão ${vao.length}`}: {nomesResumo(vao, memberByUserId, userId)}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div id="encontros" className="panel-cream mt-4 scroll-mt-4 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays className="h-4 w-4" />
          Encontros
        </p>
        {souAdmin && (
          <button
            onClick={() => setNovoAberto((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4"
          >
            <Plus className="h-3.5 w-3.5" />
            {novoAberto ? "Fechar" : "Marcar encontro"}
          </button>
        )}
      </div>

      {souAdmin && novoAberto && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border p-3">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título (ex.: Discussão do capítulo 1)"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="datetime-local"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Local ou link (ex.: endereço, Zoom, Meet…)"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder="Descrição (opcional)"
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={criar}
            disabled={criando}
            className="mt-1 rounded-full bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {criando ? "Salvando…" : "Marcar encontro"}
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {events.isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}

        {!events.isLoading && proximos.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum encontro marcado.</p>
        )}

        {proximos.map((ev) => cartao(ev, false))}

        {anteriores.length > 0 && (
          <button
            type="button"
            onClick={() => setVerAnteriores((v) => !v)}
            className="self-start text-xs font-medium text-muted-foreground underline underline-offset-4"
          >
            {verAnteriores ? "Esconder encontros anteriores" : `Ver encontros anteriores (${anteriores.length})`}
          </button>
        )}
        {verAnteriores && anteriores.map((ev) => cartao(ev, true))}
      </div>
    </div>
  );
}
