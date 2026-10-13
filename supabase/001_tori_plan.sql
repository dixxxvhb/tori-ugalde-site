-- Tori's outreach plan: one row per plan, reached only by its secret link token.
-- Studios, statuses, notes and the videos she adds to her public site.
-- Lives in the figgg Supabase project, isolated in its own schema that the API does not expose.
-- Access is only through the two SECURITY DEFINER functions below, which require the token.
-- Remove completely with: drop function public.tu_plan_get(text); drop function public.tu_plan_apply(text, jsonb); drop function public.tu_public_get(); drop schema toriplan cascade;

create schema if not exists toriplan;
revoke all on schema toriplan from public, anon, authenticated;

create table if not exists toriplan.plans (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (length(token) >= 32),
  name text not null,
  -- Exactly one plan may feed the public portfolio.
  is_public boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  rev bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists plans_one_public on toriplan.plans (is_public) where is_public;
alter table toriplan.plans enable row level security;
-- No policies on purpose: nobody reads or writes the table directly.
revoke all on toriplan.plans from public, anon, authenticated;

create or replace function public.tu_plan_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('name', p.name, 'data', p.data, 'rev', p.rev, 'updated_at', p.updated_at)
  from toriplan.plans p
  where p_token is not null and length(p_token) >= 32 and p.token = p_token;
$$;

-- p_ops: [{"path": ["track","s:exchange-dance","status"], "value": "Emailed"}, {"path": ["saved","s:exchange-dance"], "value": null}]
-- A null or missing value deletes the key. Paths are 2 to 4 short keys under an allowed top-level key.
create or replace function public.tu_plan_apply(p_token text, p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_data jsonb;
  v_op jsonb;
  v_path text[];
  v_val jsonb;
  v_n int;
  i int;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 or jsonb_array_length(p_ops) > 50 then
    raise exception 'bad ops' using errcode = '22023';
  end if;

  select p.id, p.data into v_id, v_data from toriplan.plans p where p.token = p_token for update;
  if v_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  for v_op in select * from jsonb_array_elements(p_ops) loop
    if jsonb_typeof(v_op) is distinct from 'object' or jsonb_typeof(v_op -> 'path') is distinct from 'array' then
      raise exception 'bad op' using errcode = '22023';
    end if;
    v_n := jsonb_array_length(v_op -> 'path');
    if v_n < 2 or v_n > 4 then
      raise exception 'bad path' using errcode = '22023';
    end if;
    select array_agg(x order by o) into v_path
      from jsonb_array_elements_text(v_op -> 'path') with ordinality as t(x, o);
    if v_path[1] not in ('saved', 'track', 'custom', 'pub', 'goals', 'sent', 'tpl') then
      raise exception 'bad path' using errcode = '22023';
    end if;
    for i in 1 .. v_n loop
      if v_path[i] is null or v_path[i] !~ '^[A-Za-z0-9:_.-]{1,120}$' or v_path[i] in ('__proto__', 'constructor', 'prototype') then
        raise exception 'bad key' using errcode = '22023';
      end if;
    end loop;

    v_val := v_op -> 'value';
    if v_val is null or v_val = 'null'::jsonb then
      v_data := v_data #- v_path;
    else
      if jsonb_typeof(v_val) not in ('string', 'boolean', 'number') then
        raise exception 'bad value' using errcode = '22023';
      end if;
      if jsonb_typeof(v_val) = 'string' and length(v_val #>> '{}') > 4000 then
        raise exception 'value too long' using errcode = '22023';
      end if;
      -- Make sure every parent object exists, then set the leaf.
      for i in 1 .. v_n - 1 loop
        if jsonb_typeof(v_data #> v_path[1:i]) is distinct from 'object' then
          v_data := jsonb_set(v_data, v_path[1:i], '{}'::jsonb, true);
        end if;
      end loop;
      v_data := jsonb_set(v_data, v_path, v_val, true);
    end if;
  end loop;

  if pg_column_size(v_data) > 262144 then
    raise exception 'plan too large' using errcode = '22023';
  end if;

  update toriplan.plans set data = v_data, rev = rev + 1, updated_at = now() where id = v_id;
  return public.tu_plan_get(p_token);
end;
$$;

-- The public portfolio reads only the videos Tori chose to publish, and only valid YouTube ids.
create or replace function public.tu_public_get()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.key,
      'yt', v.value ->> 'yt',
      'title', left(coalesce(v.value ->> 'title', ''), 120),
      'kind', left(coalesce(v.value ->> 'kind', ''), 120),
      'year', left(coalesce(v.value ->> 'year', ''), 20),
      'order', left(coalesce(v.value ->> 'order', ''), 12))
    order by v.value ->> 'order', v.key), '[]'::jsonb)
  from toriplan.plans p,
       jsonb_each(case when jsonb_typeof(p.data #> '{pub,videos}') = 'object' then p.data #> '{pub,videos}' else '{}'::jsonb end) v
  where p.is_public
    and jsonb_typeof(v.value) = 'object'
    and coalesce(v.value ->> 'yt', '') ~ '^[A-Za-z0-9_-]{11}$'
    and coalesce(v.value ->> 'hidden', '') = '';
$$;

revoke all on function public.tu_public_get() from public;
grant execute on function public.tu_public_get() to anon, authenticated;

revoke all on function public.tu_plan_get(text) from public;
revoke all on function public.tu_plan_apply(text, jsonb) from public;
grant execute on function public.tu_plan_get(text) to anon, authenticated;
grant execute on function public.tu_plan_apply(text, jsonb) to anon, authenticated;
