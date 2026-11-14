-- Cadastros por origem no /admin, sem expor auth.users diretamente ao navegador.
-- A chamada a admin_indicadores reutiliza exatamente a mesma checagem de
-- administrador já usada pelo painel e interrompe a função para não-administradores.
create or replace function public.admin_cadastros_por_origem(
  p_inicio timestamptz default null
)
returns table (
  utm_source text,
  utm_campaign text,
  cadastros bigint,
  assinaturas_ativas bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.admin_indicadores(null, null);

  return query
    select
      coalesce(
        nullif(btrim(u.raw_user_meta_data ->> 'utm_source'), ''),
        nullif(btrim(u.raw_user_meta_data ->> 'ref'), ''),
        'direto'
      ) as utm_source,
      coalesce(nullif(btrim(u.raw_user_meta_data ->> 'utm_campaign'), ''), '') as utm_campaign,
      count(*)::bigint as cadastros,
      count(*) filter (
        where exists (
          select 1
          from public.subscriptions s
          where s.user_id = u.id
            and s.current_period_end > now()
        )
      )::bigint as assinaturas_ativas
    from auth.users u
    where p_inicio is null or u.created_at >= p_inicio
    group by 1, 2
    order by cadastros desc, utm_source, utm_campaign;
end;
$$;

revoke all on function public.admin_cadastros_por_origem(timestamptz) from public, anon;
grant execute on function public.admin_cadastros_por_origem(timestamptz) to authenticated;
grant execute on function public.admin_cadastros_por_origem(timestamptz) to service_role;
