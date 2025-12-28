-- Schema Supabase (Postgres) para o app SSVP
-- Execute no Supabase: SQL Editor -> New query -> Run

-- Extensão para funções utilitárias (se já existir, não faz nada)
create extension if not exists pgcrypto;

-- =========================
-- TABELA: families
-- =========================
create table if not exists public.families (
  id text primary key,
  user_id uuid not null default auth.uid(),

  ficha text,
  "dataCadastro" text,
  "nomeAssistido" text,
  "estadoCivil" text,
  nascimento text,
  idade integer,
  endereco text,
  bairro text,
  telefone text,
  whatsapp boolean,
  cpf text,
  rg text,
  filhos boolean,
  "filhosCount" integer,
  "moradoresCount" integer,
  renda text,
  comorbidade text,
  "situacaoImovel" text,
  observacao text,
  status text,

  created_at timestamptz not null default now()
);

create unique index if not exists families_id_user_id_uq on public.families (id, user_id);
create index if not exists families_user_id_idx on public.families (user_id);

-- =========================
-- TABELA: members
-- =========================
create table if not exists public.members (
  id text primary key,
  user_id uuid not null default auth.uid(),

  "familyId" text not null,
  nome text,
  parentesco text,
  nascimento text,
  idade integer,
  ocupacao text,
  "observacaoOcupacao" text,
  renda text,
  comorbidade text,
  escolaridade text,
  trabalho text,

  created_at timestamptz not null default now(),

  constraint members_family_fk
    foreign key ("familyId", user_id)
    references public.families (id, user_id)
    on delete cascade
);

create index if not exists members_user_id_idx on public.members (user_id);
create index if not exists members_family_id_idx on public.members ("familyId");

-- =========================
-- TABELA: visits
-- =========================
create table if not exists public.visits (
  id text primary key,
  user_id uuid not null default auth.uid(),

  "familyId" text not null,
  data text,
  vicentinos text[] not null default '{}'::text[],
  relato text,
  motivo text,
  "necessidadesIdentificadas" text[] not null default '{}'::text[],

  created_at timestamptz not null default now(),

  constraint visits_family_fk
    foreign key ("familyId", user_id)
    references public.families (id, user_id)
    on delete cascade
);

create index if not exists visits_user_id_idx on public.visits (user_id);
create index if not exists visits_family_id_idx on public.visits ("familyId");
create index if not exists visits_data_idx on public.visits (data);

-- =========================
-- TABELA: deliveries
-- =========================
create table if not exists public.deliveries (
  id text primary key,
  user_id uuid not null default auth.uid(),

  "familyId" text not null,
  data text,
  tipo text,
  responsavel text,
  observacoes text,
  status text,
  "retiradoPor" text,
  "retiradoPorDetalhe" text,

  created_at timestamptz not null default now(),

  constraint deliveries_family_fk
    foreign key ("familyId", user_id)
    references public.families (id, user_id)
    on delete cascade
);

create index if not exists deliveries_user_id_idx on public.deliveries (user_id);
create index if not exists deliveries_family_id_idx on public.deliveries ("familyId");
create index if not exists deliveries_data_idx on public.deliveries (data);

-- =========================
-- RLS (Row Level Security)
-- =========================
alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.visits enable row level security;
alter table public.deliveries enable row level security;

-- Families policies
drop policy if exists "families_select_own" on public.families;
create policy "families_select_own"
on public.families for select
using (user_id = auth.uid());

drop policy if exists "families_insert_own" on public.families;
create policy "families_insert_own"
on public.families for insert
with check (user_id = auth.uid());

drop policy if exists "families_update_own" on public.families;
create policy "families_update_own"
on public.families for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "families_delete_own" on public.families;
create policy "families_delete_own"
on public.families for delete
using (user_id = auth.uid());

-- Members policies
drop policy if exists "members_select_own" on public.members;
create policy "members_select_own"
on public.members for select
using (user_id = auth.uid());

drop policy if exists "members_insert_own" on public.members;
create policy "members_insert_own"
on public.members for insert
with check (user_id = auth.uid());

drop policy if exists "members_update_own" on public.members;
create policy "members_update_own"
on public.members for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "members_delete_own" on public.members;
create policy "members_delete_own"
on public.members for delete
using (user_id = auth.uid());

-- Visits policies
drop policy if exists "visits_select_own" on public.visits;
create policy "visits_select_own"
on public.visits for select
using (user_id = auth.uid());

drop policy if exists "visits_insert_own" on public.visits;
create policy "visits_insert_own"
on public.visits for insert
with check (user_id = auth.uid());

drop policy if exists "visits_update_own" on public.visits;
create policy "visits_update_own"
on public.visits for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "visits_delete_own" on public.visits;
create policy "visits_delete_own"
on public.visits for delete
using (user_id = auth.uid());

-- Deliveries policies
drop policy if exists "deliveries_select_own" on public.deliveries;
create policy "deliveries_select_own"
on public.deliveries for select
using (user_id = auth.uid());

drop policy if exists "deliveries_insert_own" on public.deliveries;
create policy "deliveries_insert_own"
on public.deliveries for insert
with check (user_id = auth.uid());

drop policy if exists "deliveries_update_own" on public.deliveries;
create policy "deliveries_update_own"
on public.deliveries for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "deliveries_delete_own" on public.deliveries;
create policy "deliveries_delete_own"
on public.deliveries for delete
using (user_id = auth.uid());



