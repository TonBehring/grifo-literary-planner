// Copa dos clubes de torcida (v1, escondida: só admins).
// Os dados ficam em copas / copa_clubes / copa_rodadas / copa_jogos /
// copa_demo_leituras e só são lidos pelas funções copa_* do banco.

import { supabase } from "@/integrations/supabase/client";

export type CopaResumo = { id: string; nome: string; modo: "demo" | "oficial"; criado_em: string };

export type CopaClube = { id: string; nome: string; time: string; cor: string | null; logo: string | null };

export type CopaLinhaTabela = {
  clube_id: string;
  nome: string;
  time: string;
  cor: string | null;
  logo: string | null;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pro: number;
  contra: number;
  saldo: number;
};

export type CopaJogo = {
  id: string;
  mandante: string;
  visitante: string;
  placar_mandante: number | null;
  placar_visitante: number | null;
  resultado: "mandante" | "visitante" | "empate" | null;
};

export type CopaEscalacao = {
  clube_id: string;
  leitor: string;
  paginas: number;
  posicao: number;
  titular: boolean;
};

export type CopaRodada = {
  id: string;
  numero: number;
  inicio: string;
  fim: string;
  status: "encerrada" | "ao_vivo" | "futura";
  jogos: CopaJogo[];
  escalacoes: CopaEscalacao[];
};

export type CopaDados = {
  copa: {
    id: string;
    nome: string;
    modo: "demo" | "oficial";
    titulares: number;
    teto_diario: number;
    empate_pct: number;
    data_referencia: string;
    data_simulada: boolean;
  };
  clubes: CopaClube[];
  tabela: CopaLinhaTabela[];
  rodadas: CopaRodada[];
  total_paginas: number;
};

export async function listarCopas(): Promise<CopaResumo[]> {
  const { data, error } = await supabase.rpc("copa_lista");
  if (error) throw new Error(error.message);
  return (data ?? []) as CopaResumo[];
}

export async function getCopa(copaId: string): Promise<CopaDados> {
  const { data, error } = await supabase.rpc("copa_dados", { p_copa: copaId });
  if (error) throw new Error(error.message);
  return data as CopaDados;
}

/** Muda o número de titulares e, na demonstração, o "hoje" simulado. */
export async function configurarCopa(
  copaId: string,
  titulares: number,
  dataReferencia: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("copa_configurar", {
    p_copa: copaId,
    p_titulares: titulares,
    p_data_referencia: dataReferencia,
  });
  if (error) throw new Error(error.message);
}

/** "2027-01-04" -> "04/01" */
export function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia ?? ""}/${mes ?? ""}`;
}

/** "Imortal Leitura" -> "IL" (para clube sem logo) */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "") : nome.slice(0, 2);
  return letras.toUpperCase();
}

export function formatPaginas(n: number): string {
  return n.toLocaleString("pt-BR");
}
