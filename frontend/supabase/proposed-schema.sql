-- PROPOSED CONTRACT ONLY. Not deployed and not a migration.
-- Inspect/reconcile the existing project before applying. No sample services are inserted.
begin;

create table public.moveon_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
alter table public.moveon_admins enable row level security;
revoke all on public.moveon_admins from anon, authenticated;
grant select on public.moveon_admins to authenticated;
create policy own_admin_membership on public.moveon_admins for select to authenticated
  using (user_id = (select auth.uid()));

create function public.moveon_valid_stops(stops jsonb, origin text, destination text, departure_at timestamptz, arrival_at timestamptz)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare item jsonb; previous_time timestamptz := departure_at; arrival timestamptz; departure timestamptz; i integer := 0; n integer;
begin
  if jsonb_typeof(stops) <> 'array' then return false; end if;
  n := jsonb_array_length(stops);
  if n < 2 or n > 30 then return false; end if;
  for item in select value from jsonb_array_elements(stops) loop
    if jsonb_typeof(item) <> 'object' or coalesce(length(trim(item->>'name')),0) not between 1 and 150
      or coalesce(length(trim(item->>'city')),0) not between 1 and 100
      or jsonb_typeof(item->'locationNote') is distinct from 'string'
      or length(item->>'locationNote') > 500 then return false; end if;
    if coalesce(item->>'arrivalTime',item->>'departureTime','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$'
      or coalesce(item->>'departureTime',item->>'arrivalTime','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' then return false; end if;
    arrival := coalesce(item->>'arrivalTime',item->>'departureTime')::timestamptz;
    departure := coalesce(item->>'departureTime',item->>'arrivalTime')::timestamptz;
    if arrival < previous_time or departure < arrival or departure > arrival_at then return false; end if;
    if i = 0 and (item->>'city' <> origin or departure <> departure_at or item->>'departureTime' is null) then return false; end if;
    if i = n-1 and (item->>'city' <> destination or arrival <> arrival_at or item->>'arrivalTime' is null) then return false; end if;
    if item ? 'latitude' or item ? 'longitude' then
      if jsonb_typeof(item->'latitude') is distinct from 'number' or jsonb_typeof(item->'longitude') is distinct from 'number'
        or abs((item->>'latitude')::numeric) > 90 or abs((item->>'longitude')::numeric) > 180 then return false; end if;
    end if;
    previous_time := departure; i := i+1;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke execute on function public.moveon_valid_stops(jsonb,text,text,timestamptz,timestamptz) from public;
grant execute on function public.moveon_valid_stops(jsonb,text,text,timestamptz,timestamptz) to authenticated, service_role;

create table public.moveon_journeys (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null check (length(trim(provider_name)) between 1 and 150),
  mode text not null check (mode in ('coach','rail','shuttle')),
  origin text not null check (length(trim(origin)) between 1 and 100),
  destination text not null check (length(trim(destination)) between 1 and 100 and destination <> origin),
  departure_at timestamptz not null,
  arrival_at timestamptz not null check (arrival_at > departure_at),
  time_zone text not null default 'America/Toronto' check (time_zone = 'America/Toronto'),
  fare_cad numeric(8,2) check (fare_cad >= 0 and fare_cad <= 10000),
  stops jsonb not null,
  provider_url text check (provider_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
  published boolean not null default false,
  route_geometry jsonb,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  source_kind text not null default 'manual' check (source_kind in ('manual','import')),
  manual_override boolean not null default false,
  check (not published or (verified_at is not null and provider_url is not null)),
  check (public.moveon_valid_stops(stops, origin, destination, departure_at, arrival_at))
);
create index moveon_public_search on public.moveon_journeys(origin,destination,departure_at) where published;
create index moveon_admin_departures on public.moveon_journeys(departure_at desc,id);
alter table public.moveon_journeys enable row level security;
revoke all on public.moveon_journeys from anon,authenticated;
grant select on public.moveon_journeys to anon,authenticated;
grant insert(provider_name,mode,origin,destination,departure_at,arrival_at,time_zone,fare_cad,stops,provider_url,published,route_geometry,verified_at),
      update(provider_name,mode,origin,destination,departure_at,arrival_at,time_zone,fare_cad,stops,provider_url,published,route_geometry,verified_at)
  on public.moveon_journeys to authenticated;
grant all on public.moveon_journeys, public.moveon_admins to service_role;

create policy public_published_journeys on public.moveon_journeys for select to anon using (published);
create policy signed_in_read_journeys on public.moveon_journeys for select to authenticated
  using (published or exists(select 1 from public.moveon_admins where user_id = (select auth.uid()) and enabled));
create policy admin_insert_journeys on public.moveon_journeys for insert to authenticated
  with check (exists(select 1 from public.moveon_admins where user_id = (select auth.uid()) and enabled));
create policy admin_update_journeys on public.moveon_journeys for update to authenticated
  using (exists(select 1 from public.moveon_admins where user_id = (select auth.uid()) and enabled))
  with check (exists(select 1 from public.moveon_admins where user_id = (select auth.uid()) and enabled));

create function public.moveon_before_write() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  if current_user = 'authenticated' then
    if tg_op = 'UPDATE' and old.source_kind = 'import' then new.manual_override := true; end if;
    if new.verified_at is not null and (tg_op = 'INSERT' or new.verified_at is distinct from old.verified_at) then new.verified_at := new.updated_at; end if;
    if new.published and tg_op = 'UPDATE' and new.verified_at is not distinct from old.verified_at then
      raise exception 'Published edits require a fresh verification';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.moveon_before_write() from public,anon,authenticated;
create trigger moveon_journey_write before insert or update on public.moveon_journeys for each row execute function public.moveon_before_write();

create function public.search_moveon_journeys(p_origin text,p_destination text,p_date date,p_time time)
returns setof public.moveon_journeys language sql stable security invoker set search_path = '' as $$
  select * from public.moveon_journeys
  where published and origin=p_origin and destination=p_destination
    and departure_at >= p_date::timestamp at time zone 'America/Toronto'
    and departure_at < (p_date+1)::timestamp at time zone 'America/Toronto'
    and (departure_at at time zone 'America/Toronto')::time >= p_time
  order by departure_at,id;
$$;
create function public.moveon_cities() returns table(city text) language sql stable security invoker set search_path = '' as $$
  select origin from public.moveon_journeys where published and arrival_at > now()
  union select destination from public.moveon_journeys where published and arrival_at > now();
$$;
revoke execute on function public.search_moveon_journeys(text,text,date,time),public.moveon_cities() from public;
grant execute on function public.search_moveon_journeys(text,text,date,time),public.moveon_cities() to anon,authenticated,service_role;
commit;
