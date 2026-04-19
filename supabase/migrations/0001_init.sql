-- ============================================================================
-- Gymnastik: initial schema
-- Magic-link auth (kan kompletteras med OAuth senare utan schema-ändringar).
-- Multi-tenant: clubs → teams/halls, med roller (admin/coach/member).
-- ============================================================================

-- ---------- helpers ----------------------------------------------------------

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enum-roller. Lägg till athlete/parent senare om det behövs.
do $$ begin
  create type public.member_role as enum ('admin', 'coach', 'member');
exception when duplicate_object then null; end $$;

-- ---------- profiles --------------------------------------------------------
-- En rad per auth.user. Innehåller display_name, färg, gymnast-style (jsonb)
-- och en unik 4-siffrig buddy_code som används av vännasystemet.

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  display_name   text not null default 'Gymnast',
  color          text not null default '#2563EB',
  buddy_code     char(4) unique,
  gymnast_style  jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Alla inloggade kan läsa profiler (för att visa vän-namn, invites osv).
create policy "profiles: authenticated read"
  on public.profiles for select
  to authenticated
  using (true);

-- Man får bara skriva sin egen profil.
create policy "profiles: own upsert"
  on public.profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "profiles: own update"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Skapa profil automatiskt när en user tillkommer.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Gymnast'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- friends ---------------------------------------------------------
-- Enkel symmetrisk vänrelation: en rad per riktning. En hjälpvy `friend_pairs`
-- gör det lätt att hämta alla vänner för en user.

create table if not exists public.friends (
  user_id        uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, friend_user_id),
  check (user_id <> friend_user_id)
);

alter table public.friends enable row level security;

create policy "friends: read own"
  on public.friends for select
  to authenticated
  using (user_id = auth.uid() or friend_user_id = auth.uid());

create policy "friends: insert own"
  on public.friends for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "friends: delete own"
  on public.friends for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------- clubs -----------------------------------------------------------

create table if not exists public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger clubs_updated_at
before update on public.clubs
for each row execute function public.set_updated_at();

-- ---------- club_members ----------------------------------------------------

create table if not exists public.club_members (
  club_id    uuid not null references public.clubs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members(user_id);

-- ---------- RLS: clubs + club_members (policies beror på varandra) ----------

alter table public.clubs         enable row level security;
alter table public.club_members  enable row level security;

-- Helper: är user medlem i club?
create or replace function public.is_club_member(p_club uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club and user_id = p_user
  );
$$;

-- Helper: är user admin i club?
create or replace function public.is_club_admin(p_club uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club and user_id = p_user and role = 'admin'
  );
$$;

-- clubs: medlemmar kan läsa, admin kan uppdatera, alla inloggade kan skapa.
create policy "clubs: member read"
  on public.clubs for select
  to authenticated
  using (public.is_club_member(id, auth.uid()));

create policy "clubs: any insert"
  on public.clubs for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "clubs: admin update"
  on public.clubs for update
  to authenticated
  using (public.is_club_admin(id, auth.uid()))
  with check (public.is_club_admin(id, auth.uid()));

create policy "clubs: admin delete"
  on public.clubs for delete
  to authenticated
  using (public.is_club_admin(id, auth.uid()));

-- club_members: medlemmar ser alla medlemmar i klubben, admin hanterar.
create policy "club_members: member read"
  on public.club_members for select
  to authenticated
  using (public.is_club_member(club_id, auth.uid()));

create policy "club_members: admin insert"
  on public.club_members for insert
  to authenticated
  with check (
    public.is_club_admin(club_id, auth.uid())
    or not exists (select 1 from public.club_members where club_id = club_members.club_id)
  );

create policy "club_members: admin update"
  on public.club_members for update
  to authenticated
  using (public.is_club_admin(club_id, auth.uid()))
  with check (public.is_club_admin(club_id, auth.uid()));

create policy "club_members: admin or self delete"
  on public.club_members for delete
  to authenticated
  using (public.is_club_admin(club_id, auth.uid()) or user_id = auth.uid());

-- När en klubb skapas → grundaren blir automatiskt admin.
create or replace function public.handle_new_club()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.club_members (club_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_club_created on public.clubs;
create trigger on_club_created
  after insert on public.clubs
  for each row execute function public.handle_new_club();

-- ---------- teams -----------------------------------------------------------

create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create index if not exists teams_club_idx on public.teams(club_id);

create table if not exists public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_idx on public.team_members(user_id);

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

create or replace function public.is_team_member(p_team uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = p_user
  );
$$;

create or replace function public.is_team_coach(p_team uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = p_user and role in ('admin', 'coach')
  );
$$;

-- teams: klubbmedlemmar ser alla lag i sin klubb. Klubb-admin + team-coach skriver.
create policy "teams: club member read"
  on public.teams for select
  to authenticated
  using (public.is_club_member(club_id, auth.uid()));

create policy "teams: club admin insert"
  on public.teams for insert
  to authenticated
  with check (public.is_club_admin(club_id, auth.uid()));

create policy "teams: admin/coach update"
  on public.teams for update
  to authenticated
  using (
    public.is_club_admin(club_id, auth.uid())
    or public.is_team_coach(id, auth.uid())
  );

create policy "teams: club admin delete"
  on public.teams for delete
  to authenticated
  using (public.is_club_admin(club_id, auth.uid()));

-- team_members
create policy "team_members: team member read"
  on public.team_members for select
  to authenticated
  using (public.is_team_member(team_id, auth.uid()));

create policy "team_members: club admin or team coach write"
  on public.team_members for all
  to authenticated
  using (
    public.is_team_coach(team_id, auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and public.is_club_admin(t.club_id, auth.uid())
    )
  )
  with check (
    public.is_team_coach(team_id, auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id
        and public.is_club_admin(t.club_id, auth.uid())
    )
  );

-- ---------- halls + equipment_inventory ------------------------------------

create table if not exists public.halls (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,
  width_m    numeric(6, 2) not null default 30,
  height_m   numeric(6, 2) not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger halls_updated_at
before update on public.halls
for each row execute function public.set_updated_at();

create index if not exists halls_club_idx on public.halls(club_id);

-- Per hall: hur många av varje redskapstyp som finns tillgängligt.
-- equipment_type_id är app-sidans string-ID (t.ex. "parallel_bars"), inte FK.
create table if not exists public.equipment_inventory (
  id                 uuid primary key default gen_random_uuid(),
  hall_id            uuid not null references public.halls(id) on delete cascade,
  equipment_type_id  text not null,
  quantity           integer not null default 1 check (quantity >= 0),
  notes              text,
  updated_at         timestamptz not null default now(),
  unique (hall_id, equipment_type_id)
);

create trigger equipment_inventory_updated_at
before update on public.equipment_inventory
for each row execute function public.set_updated_at();

alter table public.halls                enable row level security;
alter table public.equipment_inventory  enable row level security;

create policy "halls: club member read"
  on public.halls for select
  to authenticated
  using (public.is_club_member(club_id, auth.uid()));

create policy "halls: club admin write"
  on public.halls for all
  to authenticated
  using (public.is_club_admin(club_id, auth.uid()))
  with check (public.is_club_admin(club_id, auth.uid()));

create policy "inventory: club member read"
  on public.equipment_inventory for select
  to authenticated
  using (
    exists (
      select 1 from public.halls h
      where h.id = equipment_inventory.hall_id
        and public.is_club_member(h.club_id, auth.uid())
    )
  );

create policy "inventory: club admin/coach write"
  on public.equipment_inventory for all
  to authenticated
  using (
    exists (
      select 1 from public.halls h
      where h.id = equipment_inventory.hall_id
        and (
          public.is_club_admin(h.club_id, auth.uid())
          or exists (
            select 1 from public.club_members cm
            where cm.club_id = h.club_id
              and cm.user_id = auth.uid()
              and cm.role in ('admin', 'coach')
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.halls h
      where h.id = equipment_inventory.hall_id
        and (
          public.is_club_admin(h.club_id, auth.uid())
          or exists (
            select 1 from public.club_members cm
            where cm.club_id = h.club_id
              and cm.user_id = auth.uid()
              and cm.role in ('admin', 'coach')
          )
        )
    )
  );

-- RPC: flytta utrustning mellan hallar (måste vara samma klubb).
-- Mergar kvantiteter om målet redan har samma redskapstyp; raderar
-- källraden om hela kvantiteten flyttas.
create or replace function public.move_inventory(
  p_source_id  uuid,
  p_target_hall uuid,
  p_quantity   integer
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_source       public.equipment_inventory%rowtype;
  v_source_club  uuid;
  v_target_club  uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  select * into v_source from public.equipment_inventory where id = p_source_id for update;
  if not found then
    raise exception 'source inventory row not found';
  end if;
  if v_source.quantity < p_quantity then
    raise exception 'source has only % available', v_source.quantity;
  end if;

  select club_id into v_source_club from public.halls where id = v_source.hall_id;
  select club_id into v_target_club from public.halls where id = p_target_hall;
  if v_source_club is null or v_target_club is null or v_source_club <> v_target_club then
    raise exception 'halls must belong to the same club';
  end if;

  -- Måste vara admin eller coach i klubben.
  if not (
    public.is_club_admin(v_source_club, auth.uid())
    or exists (
      select 1 from public.club_members cm
      where cm.club_id = v_source_club and cm.user_id = auth.uid() and cm.role in ('admin', 'coach')
    )
  ) then
    raise exception 'not allowed';
  end if;

  -- Minska källa.
  if v_source.quantity = p_quantity then
    delete from public.equipment_inventory where id = p_source_id;
  else
    update public.equipment_inventory
      set quantity = quantity - p_quantity
      where id = p_source_id;
  end if;

  -- Öka / skapa mål.
  insert into public.equipment_inventory (hall_id, equipment_type_id, quantity)
  values (p_target_hall, v_source.equipment_type_id, p_quantity)
  on conflict (hall_id, equipment_type_id)
  do update set quantity = public.equipment_inventory.quantity + excluded.quantity;
end;
$$;

grant execute on function public.move_inventory(uuid, uuid, integer) to authenticated;

-- ---------- plans (pass) ----------------------------------------------------
-- Ett pass kan ägas av user, team eller club. Exactly-one-owner via CHECK.
-- Delning görs via tabellen `plan_shares` nedan — där kan samma pass delas
-- med hela klubben, valda lag, eller specifika personer (en rad per mål).

create table if not exists public.plans (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid references auth.users(id) on delete cascade,
  owner_team_id     uuid references public.teams(id) on delete cascade,
  owner_club_id     uuid references public.clubs(id) on delete cascade,
  name              text not null default 'Nytt pass',
  plan              jsonb not null default '{}'::jsonb,
  created_by        uuid not null references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (
    (owner_user_id is not null)::int
    + (owner_team_id is not null)::int
    + (owner_club_id is not null)::int = 1
  )
);

create trigger plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

create index if not exists plans_owner_user_idx on public.plans(owner_user_id);
create index if not exists plans_owner_team_idx on public.plans(owner_team_id);
create index if not exists plans_owner_club_idx on public.plans(owner_club_id);

-- ---------- plan_shares ------------------------------------------------------
-- En rad per delningsmål. Exactly-one-target via CHECK (club/team/user).
-- can_edit = false → bara läs; true → mål får redigera passet.

create table if not exists public.plan_shares (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  club_id     uuid references public.clubs(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  can_edit    boolean not null default false,
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (
    (club_id is not null)::int
    + (team_id is not null)::int
    + (user_id is not null)::int = 1
  )
);

create unique index if not exists plan_shares_club_uq
  on public.plan_shares(plan_id, club_id) where club_id is not null;
create unique index if not exists plan_shares_team_uq
  on public.plan_shares(plan_id, team_id) where team_id is not null;
create unique index if not exists plan_shares_user_uq
  on public.plan_shares(plan_id, user_id) where user_id is not null;

create index if not exists plan_shares_plan_idx on public.plan_shares(plan_id);

alter table public.plans       enable row level security;
alter table public.plan_shares enable row level security;

-- Helper: kan user redigera ett pass? (Ägare eller can_edit-share.)
create or replace function public.can_edit_plan(p_plan uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan
      and (
        p.owner_user_id = p_user
        or (p.owner_team_id is not null and public.is_team_coach(p.owner_team_id, p_user))
        or (p.owner_club_id is not null and public.is_club_admin(p.owner_club_id, p_user))
      )
  )
  or exists (
    select 1 from public.plan_shares s
    where s.plan_id = p_plan
      and s.can_edit = true
      and (
        s.user_id = p_user
        or (s.team_id is not null and public.is_team_member(s.team_id, p_user))
        or (s.club_id is not null and public.is_club_member(s.club_id, p_user))
      )
  );
$$;

-- Läsning: ägare + alla som passet är delat med (klubb/lag/user).
create policy "plans: visibility read"
  on public.plans for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or (owner_team_id is not null and public.is_team_member(owner_team_id, auth.uid()))
    or (owner_club_id is not null and public.is_club_member(owner_club_id, auth.uid()))
    or exists (
      select 1 from public.plan_shares s
      where s.plan_id = plans.id
        and (
          s.user_id = auth.uid()
          or (s.team_id is not null and public.is_team_member(s.team_id, auth.uid()))
          or (s.club_id is not null and public.is_club_member(s.club_id, auth.uid()))
        )
    )
  );

-- Skrivning: egna pass, team-coaches för team-pass, klubb-admins för club-pass,
-- plus alla som har can_edit-share.
create policy "plans: insert"
  on public.plans for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      owner_user_id = auth.uid()
      or (owner_team_id is not null and public.is_team_coach(owner_team_id, auth.uid()))
      or (owner_club_id is not null and public.is_club_admin(owner_club_id, auth.uid()))
    )
  );

create policy "plans: update"
  on public.plans for update
  to authenticated
  using (public.can_edit_plan(id, auth.uid()))
  with check (public.can_edit_plan(id, auth.uid()));

create policy "plans: delete"
  on public.plans for delete
  to authenticated
  using (
    owner_user_id = auth.uid()
    or (owner_team_id is not null and public.is_team_coach(owner_team_id, auth.uid()))
    or (owner_club_id is not null and public.is_club_admin(owner_club_id, auth.uid()))
  );

-- plan_shares RLS:
-- - Läsning: ägare ser alla shares på sitt pass, och mål ser sin egen share.
-- - Skrivning: bara användare som kan redigera passet.
create policy "plan_shares: read"
  on public.plan_shares for select
  to authenticated
  using (
    public.can_edit_plan(plan_id, auth.uid())
    or user_id = auth.uid()
    or (team_id is not null and public.is_team_member(team_id, auth.uid()))
    or (club_id is not null and public.is_club_member(club_id, auth.uid()))
  );

create policy "plan_shares: editor write"
  on public.plan_shares for all
  to authenticated
  using (public.can_edit_plan(plan_id, auth.uid()))
  with check (public.can_edit_plan(plan_id, auth.uid()) and created_by = auth.uid());

-- ---------- invites (klubb/lag-inbjudan via e-post) -------------------------
-- Ren tabell nu; UI-flödet skickas separat. Token är opaqe och förbrukas engångs.

create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid references public.clubs(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete cascade,
  email       text not null,
  role        public.member_role not null default 'member',
  token       text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  check ( (club_id is not null) or (team_id is not null) )
);

create index if not exists invites_email_idx on public.invites(lower(email));

alter table public.invites enable row level security;

create policy "invites: creator + target email read"
  on public.invites for select
  to authenticated
  using (
    created_by = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy "invites: admin/coach insert"
  on public.invites for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      (club_id is not null and public.is_club_admin(club_id, auth.uid()))
      or (team_id is not null and public.is_team_coach(team_id, auth.uid()))
    )
  );

create policy "invites: creator delete"
  on public.invites for delete
  to authenticated
  using (created_by = auth.uid());
