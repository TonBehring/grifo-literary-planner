// Guarda o código de um convite de clube enquanto a pessoa faz login ou
// cria a conta. O link de convite é /clubes/entrar?codigo=ABC123; quem não
// está logado vai para /auth e perderia o código no caminho.

const KEY = "grifo_convite_clube";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function normalizar(codigo: string): string {
  return codigo.trim().toUpperCase().slice(0, 8);
}

export function codigoDoLink(search: string): string | null {
  const codigo = new URLSearchParams(search).get("codigo");
  return codigo ? normalizar(codigo) : null;
}

// Chamado antes de mandar para /auth: se a pessoa abriu um link de convite, guarda o código.
export function savePendingInviteFromUrl(pathname: string, search: string): void {
  if (!pathname.startsWith("/clubes/entrar")) return;
  const codigo = codigoDoLink(search);
  if (!codigo) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ codigo, em: Date.now() }));
  } catch {
    // navegador sem armazenamento: a mensagem do convite também traz o código escrito
  }
}

export function peekPendingInvite(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const salvo = JSON.parse(raw) as { codigo?: string; em?: number };
    if (!salvo.codigo || !salvo.em || Date.now() - salvo.em > VALIDADE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return salvo.codigo;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
