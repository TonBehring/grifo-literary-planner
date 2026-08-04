# Diagnóstico: 16+ requisições para `user_books?status=eq.lendo`

## Resumo

A tela não está disparando 16 buscas diferentes. Ela dispara **uma única busca que falha na rede e é repetida automaticamente por duas camadas de retry empilhadas**. Nenhuma das três hipóteses levantadas se confirma.

## O que foi verificado

1. **Instância única do client Supabase** — `src/integrations/supabase/client.ts` cria o client uma só vez no escopo do módulo e é o único `createClient` do projeto. Não há clients duplicados nem listeners de auth duplicados.
2. **AuthProvider montado uma vez** — `AuthProvider` aparece só em `src/routes/__root.tsx`, envolvendo o `<Outlet />`. Não há StrictMode nem segunda montagem na árvore.
3. **QueryClient estável** — `new QueryClient(...)` está dentro de `getRouter()` em `src/router.tsx`, executado uma vez por router (padrão correto para SSR). O componente raiz apenas lê `queryClient` do contexto; não recria a instância a cada render.

## Causa raiz

A requisição registrada no log de rede termina em `Error: Failed to fetch` — falha de rede/CORS no navegador, antes de qualquer resposta do PostgREST. Sobre essa falha atuam duas camadas de repetição:

- **postgrest-js (client Supabase)**: repete automaticamente falhas de rede e marca cada tentativa com o header `x-retry-count`. O log mostra `x-retry-count: 3`, ou seja, a própria SDK já fez 4 tentativas para uma chamada.
- **TanStack Query**: `src/router.tsx` define `retry: 2` com `retryDelay` exponencial curto, o que transforma cada chamada do componente em até 3 execuções da `queryFn`.

3 execuções × ~4 tentativas internas ≈ 12–16 requisições idênticas em menos de um segundo — exatamente o padrão observado. O `enabled: Boolean(user)` e a queryKey são estáveis, então não há re-disparo por mudança de referência do `user`.

Efeito colateral que reforça a rajada: com `refetchOnWindowFocus`/`refetchOnReconnect` nos valores padrão, cada foco de janela ou reconexão reinicia todo o ciclo.

## Conclusão

O problema a resolver não é "loop de renderização", e sim **por que a chamada ao `user_books` falha com `Failed to fetch`** (origem do preview bloqueada no CORS do projeto Supabase, token expirado ou URL do projeto). O volume de requisições é apenas sintoma dos retries.

## Próximos passos sugeridos (nenhum código alterado ainda)

1. Confirmar a origem da falha de rede: comparar a origem do preview com as origens permitidas no projeto Supabase e checar se a chamada falha também autenticada fora do iframe.
2. Depois disso, reduzir a amplificação: ajustar `retry` no `QueryClient` para não repetir erros de rede indefinidamente (por exemplo `retry: 1` ou uma função que não repete falhas de fetch) e considerar `refetchOnWindowFocus: false`.
