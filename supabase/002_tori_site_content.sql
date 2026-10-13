-- Tori edits her public site from the plan ("My site"): data.pub holds her public words and pieces.
-- tu_public_get() returns only the known public sections of the one row marked is_public.
-- Pieces she hid keep their resume line but lose their video links here, so hidden stays hidden.
-- Pages treat everything as untrusted text: escaped on render, links and media checked by js/site-content.js.
-- Undo: re-run the tu_public_get definition from 001_tori_plan.sql.
create or replace function public.tu_public_get()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with src as (
    select case when jsonb_typeof(p.data -> 'pub') = 'object' then p.data -> 'pub' else '{}'::jsonb end as pub
    from toriplan.plans p
    where p.is_public
    limit 1
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'v', pub -> 'v',
    'text', case when jsonb_typeof(pub -> 'text') = 'object' then pub -> 'text' end,
    'works', case when jsonb_typeof(pub -> 'works') = 'object' then (
      select coalesce(jsonb_object_agg(w.key,
        case when coalesce(w.value ->> 'hidden', '') <> '' then w.value - 'yt' - 'src' - 'poster' else w.value end), '{}'::jsonb)
      from jsonb_each(pub -> 'works') w where jsonb_typeof(w.value) = 'object') end,
    'teach', case when jsonb_typeof(pub -> 'teach') = 'object' then pub -> 'teach' end,
    'looking', case when jsonb_typeof(pub -> 'looking') = 'object' then pub -> 'looking' end,
    'quotes', case when jsonb_typeof(pub -> 'quotes') = 'object' then pub -> 'quotes' end,
    'jobs', case when jsonb_typeof(pub -> 'jobs') = 'object' then pub -> 'jobs' end,
    'training', case when jsonb_typeof(pub -> 'training') = 'object' then pub -> 'training' end,
    'skills', case when jsonb_typeof(pub -> 'skills') = 'object' then pub -> 'skills' end))
  from src;
$$;

revoke all on function public.tu_public_get() from public;
grant execute on function public.tu_public_get() to anon, authenticated;
