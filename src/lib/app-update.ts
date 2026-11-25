// Detecta quando uma versão nova do Grifo foi publicada enquanto o app está
// aberto (o app instalado no celular fica dias na memória sem recarregar).
//
// Como funciona: o HTML publicado lista os arquivos .js e .css do app, e o
// nome de cada um muda a cada publicação. Na primeira verificação o Grifo
// guarda essa lista; se depois o servidor citar um arquivo que não estava
// nela, existe versão nova.

const INTERVALO_MS = 15 * 60 * 1000;

/** Arquivos .js/.css do próprio site citados num HTML. */
export function assetsDoHtml(html: string): string[] {
  const achados = new Set<string>();
  const re = /(?:src|href)="(\/[^"?#]+\.(?:js|css))(?:[?#][^"]*)?"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) achados.add(m[1]);
  }
  return [...achados];
}

async function assetsDoServidor(): Promise<string[] | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const lista = assetsDoHtml(await res.text());
    return lista.length ? lista : null;
  } catch {
    // Sem internet ou servidor fora: tenta de novo na próxima vez.
    return null;
  }
}

/**
 * Verifica logo ao abrir (guarda a versão atual), ao voltar para o app e a
 * cada 15 minutos. Chama onNova uma vez quando acha versão nova. Devolve a
 * função que para as verificações.
 */
export function observarVersaoNova(onNova: () => void): () => void {
  let avisado = false;
  let verificando = false;
  let base: Set<string> | null = null;

  async function verificar() {
    if (avisado || verificando || document.visibilityState !== "visible") return;
    verificando = true;
    try {
      const agora = await assetsDoServidor();
      if (!agora) return;
      if (!base) {
        base = new Set(agora);
        return;
      }
      const conhecidos = base;
      if (agora.some((a) => !conhecidos.has(a))) {
        avisado = true;
        onNova();
      }
    } finally {
      verificando = false;
    }
  }

  const aoVoltar = () => void verificar();
  document.addEventListener("visibilitychange", aoVoltar);
  window.addEventListener("focus", aoVoltar);
  const timer = window.setInterval(() => void verificar(), INTERVALO_MS);
  const primeira = window.setTimeout(() => void verificar(), 3_000);

  return () => {
    document.removeEventListener("visibilitychange", aoVoltar);
    window.removeEventListener("focus", aoVoltar);
    window.clearInterval(timer);
    window.clearTimeout(primeira);
  };
}

const CHAVE_RECARGA = "grifo_atualizado_em";

/** Recarrega para a versão nova, no máximo uma vez a cada 5 minutos. */
export function recarregarParaVersaoNova(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE_RECARGA) ?? 0);
    if (Date.now() - ultima < 5 * 60 * 1000) return false;
    sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
  } catch {
    /* sem sessionStorage: recarrega mesmo assim */
  }
  window.location.reload();
  return true;
}
