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

-- ---------- plans (pass) ----------------------------------------------------
-- Ett pass kan ägas av user, team eller club. Exactly-one-owner via CHECK.
-- `visible_to_club` låter en tränare dela team-pass med hela klubben.

create table if not exists public.plans (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid references auth.users(id) on delete cascade,
  owner_team_id     uuid references public.teams(id) on delete cascade,
  owner_club_id     uuid references public.clubs(id) on delete cascade,
  name              text not null default 'Nytt pass',
  plan              jsonb not null default '{}'::jsonb,
  visible_to_club   boolean not null default false,
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

alter table public.plans enable row level security;

-- Läsning: ägare, team-medlemmar (för team-pass), klubb-medlemmar
-- (för club-pass eller visible_to_club på team-pass).
create policy "plans: visibility read"
  on public.plans for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or (owner_team_id is not null and public.is_team_member(owner_team_id, auth.uid()))
    or (owner_club_id is not null and public.is_club_member(owner_club_id, auth.uid()))
    or (
      visible_to_club
      and owner_team_id is not null
      and exists (
        select 1 from public.teams t
        where t.id = plans.owner_team_id
          and public.is_club_member(t.club_id, auth.uid())
      )
    )
  );

-- Skrivning: egna pass, team-coaches för team-pass, klubb-admins för club-pass.
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
  using (
    owner_user_id = auth.uid()
    or (owner_team_id is not null and public.is_team_coach(owner_team_id, auth.uid()))
    or (owner_club_id is not null and public.is_club_admin(owner_club_id, auth.uid()))
  )
  with check (
    owner_user_id = auth.uid()
    or (owner_team_id is not null and public.is_team_coach(owner_team_id, auth.uid()))
    or (owner_club_id is not null and public.is_club_admin(owner_club_id, auth.uid()))
  );

create policy "plans: delete"
  on public.plans for delete
  to authenticated
  using (
    owner_user_id = auth.uid()
    or (owner_team_id is not null and public.is_team_coach(owner_team_id, auth.uid()))
    or (owner_club_id is not null and public.is_club_admin(owner_club_id, auth.uid()))
  );

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
