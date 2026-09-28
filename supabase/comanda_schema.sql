-- =============================================================
-- Comanda FH - FH Digital
-- Comandas individuais com QR, pedido pelo tablet da mesa,
-- cozinha ao vivo, garçom e caixa.
-- Cole tudo no SQL Editor do Supabase (projeto NOVO) e clique em "Run".
-- Pode rodar mais de uma vez sem erro.
-- =============================================================

create extension if not exists pgcrypto with schema extensions;

-- -------------------------------------------------------------
-- TABELAS
-- -------------------------------------------------------------

-- Cada restaurante/padaria cliente
create table if not exists public.empresas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  usa_quilo      boolean not null default false,       -- módulo "por quilo"
  preco_quilo    numeric(10,2) not null default 0 check (preco_quilo >= 0),
  multa_comanda  numeric(10,2) not null default 0 check (multa_comanda >= 0), -- comanda perdida
  ativa          boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Logins: dono, gerente e os aparelhos/funções
create table if not exists public.usuarios_empresa (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  papel       text not null check (papel in ('dono','gerente','caixa','cozinha','garcom','entrada','balanca','mesa')),
  nome        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_usuarios_empresa on public.usuarios_empresa (empresa_id);

create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nome        text not null,
  ordem       integer not null default 0,
  ativa       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.produtos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  categoria_id  uuid references public.categorias(id) on delete set null,
  nome          text not null,
  descricao     text not null default '',
  preco         numeric(10,2) not null check (preco >= 0),
  foto          text,                          -- caminho no Storage (bucket produtos)
  setor         text not null default 'cozinha' check (setor in ('cozinha','balcao')),
  disponivel    boolean not null default true, -- acabou hoje? desliga aqui
  ativo         boolean not null default true, -- "excluído" (some do cardápio, mantém histórico)
  ordem         integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_produtos_empresa on public.produtos (empresa_id);

create table if not exists public.mesas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  numero      integer not null check (numero between 1 and 9999),
  ativa       boolean not null default true,
  unique (empresa_id, numero)
);

-- Comanda física (cartão com QR). Reaproveitada a cada cliente.
create table if not exists public.comandas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  numero      integer not null check (numero between 1 and 99999),
  codigo      text not null unique,          -- vai no QR
  senha       text not null,                 -- 3 dígitos impressos (para digitar no tablet)
  status      text not null default 'livre' check (status in ('livre','aberta','bloqueada')),
  conta_id    uuid,                          -- conta em uso agora
  perdida     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (empresa_id, numero)
);

-- Uma "conta" = uma pessoa usando a comanda, da entrada até pagar
create table if not exists public.contas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  comanda_id      uuid not null references public.comandas(id) on delete cascade,
  comanda_numero  integer not null,
  status          text not null default 'aberta' check (status in ('aberta','fechada','cancelada')),
  mesa_numero     integer,                   -- última mesa em que pediu
  aberta_em       timestamptz not null default now(),
  aberta_por      uuid references auth.users(id) on delete set null,
  fechada_em      timestamptz,
  fechamento_id   uuid
);
create index if not exists idx_contas_empresa on public.contas (empresa_id, status, aberta_em desc);
create unique index if not exists uq_conta_aberta_por_comanda on public.contas (comanda_id) where status = 'aberta';

-- comanda -> conta em uso agora
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comandas_conta_fk') then
    alter table public.comandas add constraint comandas_conta_fk
      foreign key (conta_id) references public.contas(id) on delete set null;
  end if;
end $$;

-- Pedido enviado de uma vez (vira um cartão na cozinha)
create table if not exists public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  conta_id        uuid not null references public.contas(id) on delete cascade,
  comanda_numero  integer not null,
  mesa_numero     integer,
  setor           text not null default 'cozinha' check (setor in ('cozinha','balcao')),
  origem          text not null default 'mesa' check (origem in ('mesa','caixa','balanca','garcom')),
  status          text not null default 'novo' check (status in ('novo','preparando','pronto','entregue','cancelado')),
  criado_em       timestamptz not null default now(),
  preparando_em   timestamptz,
  pronto_em       timestamptz,
  entregue_em     timestamptz
);
create index if not exists idx_pedidos_empresa on public.pedidos (empresa_id, status, criado_em);

create table if not exists public.itens (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  conta_id          uuid not null references public.contas(id) on delete cascade,
  pedido_id         uuid references public.pedidos(id) on delete cascade,
  produto_id        uuid references public.produtos(id) on delete set null,
  tipo              text not null default 'produto' check (tipo in ('produto','quilo','avulso','multa')),
  descricao         text not null,
  quantidade        numeric(10,3) not null check (quantidade > 0),
  preco_unit        numeric(10,2) not null check (preco_unit >= 0),
  total             numeric(10,2) generated always as (round(quantidade * preco_unit, 2)) stored,
  observacao        text not null default '',
  cancelado         boolean not null default false,
  cancelado_motivo  text,
  cancelado_por     uuid references auth.users(id) on delete set null,
  criado_por        uuid references auth.users(id) on delete set null,
  criado_em         timestamptz not null default now()
);
create index if not exists idx_itens_conta on public.itens (conta_id);
create index if not exists idx_itens_pedido on public.itens (pedido_id);
create index if not exists idx_itens_empresa on public.itens (empresa_id, criado_em);

-- Pagamento de uma ou mais contas (grupo que paga junto)
create table if not exists public.fechamentos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  subtotal    numeric(10,2) not null,
  desconto    numeric(10,2) not null default 0,
  total       numeric(10,2) not null,
  criado_por  uuid references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_fechamentos_empresa on public.fechamentos (empresa_id, criado_em);

create table if not exists public.fechamento_pagamentos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  fechamento_id  uuid not null references public.fechamentos(id) on delete cascade,
  forma          text not null check (forma in ('pix','credito','debito','dinheiro')),
  valor          numeric(10,2) not null check (valor >= 0),  -- valor que ficou (sem o troco)
  recebido       numeric(10,2) not null default 0,
  troco          numeric(10,2) not null default 0
);
create index if not exists idx_fech_pag on public.fechamento_pagamentos (fechamento_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contas_fechamento_fk') then
    alter table public.contas add constraint contas_fechamento_fk
      foreign key (fechamento_id) references public.fechamentos(id) on delete set null;
  end if;
end $$;

-- "Chamar garçom" do tablet
create table if not exists public.chamados (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  mesa_numero   integer not null,
  criado_em     timestamptz not null default now(),
  atendido_em   timestamptz,
  atendido_por  uuid references auth.users(id) on delete set null
);
create unique index if not exists uq_chamado_aberto on public.chamados (empresa_id, mesa_numero) where atendido_em is null;

-- -------------------------------------------------------------
-- QUEM É QUEM
-- -------------------------------------------------------------
create or replace function public.minha_empresa()
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from usuarios_empresa where user_id = auth.uid() limit 1
$$;

create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from usuarios_empresa where user_id = auth.uid() limit 1
$$;

-- Garante o papel e devolve a empresa (erro se não puder)
create or replace function public._exigir(p_papeis text[])
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v usuarios_empresa;
begin
  select * into v from usuarios_empresa where user_id = auth.uid() limit 1;
  if v.id is null then raise exception 'Faça login novamente.'; end if;
  if not (v.papel = any(p_papeis)) then raise exception 'Este acesso não pode fazer isso.'; end if;
  if not exists (select 1 from empresas where id = v.empresa_id and ativa) then
    raise exception 'Empresa desativada. Fale com a FH Digital.';
  end if;
  return v.empresa_id;
end $$;

-- -------------------------------------------------------------
-- SEGURANÇA (RLS)
-- A equipe lê os dados da própria empresa. Gravações de comanda,
-- pedido e pagamento só pelas funções abaixo (que conferem tudo).
-- O tablet da mesa só enxerga cardápio e mesas.
-- -------------------------------------------------------------
alter table public.empresas               enable row level security;
alter table public.usuarios_empresa       enable row level security;
alter table public.categorias             enable row level security;
alter table public.produtos               enable row level security;
alter table public.mesas                  enable row level security;
alter table public.comandas               enable row level security;
alter table public.contas                 enable row level security;
alter table public.pedidos                enable row level security;
alter table public.itens                  enable row level security;
alter table public.fechamentos            enable row level security;
alter table public.fechamento_pagamentos  enable row level security;
alter table public.chamados               enable row level security;

drop policy if exists ler on public.empresas;
create policy ler on public.empresas for select to authenticated using (id = minha_empresa());

drop policy if exists ler on public.usuarios_empresa;
create policy ler on public.usuarios_empresa for select to authenticated
  using (user_id = auth.uid() or (empresa_id = minha_empresa() and meu_papel() in ('dono','gerente')));

-- Cardápio e mesas: todos leem; dono/gerente editam
do $$
declare t text;
begin
  foreach t in array array['categorias','produtos','mesas'] loop
    execute format('drop policy if exists ler on public.%I', t);
    execute format('create policy ler on public.%I for select to authenticated using (empresa_id = minha_empresa())', t);
    execute format('drop policy if exists editar on public.%I', t);
    execute format($p$create policy editar on public.%I for all to authenticated
      using (empresa_id = minha_empresa() and meu_papel() in ('dono','gerente'))
      with check (empresa_id = minha_empresa() and meu_papel() in ('dono','gerente'))$p$, t);
  end loop;

  foreach t in array array['comandas','contas','pedidos','itens','fechamentos','fechamento_pagamentos','chamados'] loop
    execute format('drop policy if exists ler on public.%I', t);
    execute format($p$create policy ler on public.%I for select to authenticated
      using (empresa_id = minha_empresa() and meu_papel() <> 'mesa')$p$, t);
  end loop;
end $$;

-- -------------------------------------------------------------
-- AUXILIARES
-- -------------------------------------------------------------

-- Acha a comanda pelo que foi lido/digitado:
--   QR (16 caracteres) | "47-381" (número-senha) | "47" (só número, equipe)
create or replace function public._achar_comanda(p_empresa uuid, p_leitura text, p_exigir_segredo boolean)
returns public.comandas language plpgsql stable security definer set search_path = public as $$
declare
  v text := upper(regexp_replace(coalesce(p_leitura, ''), '\s', '', 'g'));
  c comandas;
begin
  v := regexp_replace(v, '^CFH[-:]?', '');
  if v ~ '^[0-9A-F]{16}$' then
    select * into c from comandas where empresa_id = p_empresa and codigo = v;
  elsif v ~ '^[0-9]{1,5}-[0-9]{3}$' then
    select * into c from comandas
     where empresa_id = p_empresa and numero = split_part(v, '-', 1)::int and senha = split_part(v, '-', 2);
  elsif v ~ '^[0-9]{1,5}$' and not p_exigir_segredo then
    select * into c from comandas where empresa_id = p_empresa and numero = v::int;
  end if;
  if c.id is null then raise exception 'Comanda não encontrada.'; end if;
  return c;
end $$;

create or replace function public._total_conta(p_conta uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(total), 0) from itens where conta_id = p_conta and not cancelado
$$;

-- Resumo de uma conta (usado pelo tablet, caixa e entrada)
create or replace function public._resumo_conta(p_conta uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'conta_id', c.id,
    'comanda', c.comanda_numero,
    'status', c.status,
    'mesa', c.mesa_numero,
    'aberta_em', c.aberta_em,
    'total', _total_conta(c.id),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'descricao', i.descricao, 'quantidade', i.quantidade, 'preco_unit', i.preco_unit,
        'total', i.total, 'tipo', i.tipo, 'observacao', i.observacao, 'cancelado', i.cancelado,
        'status', coalesce(p.status, 'entregue'), 'criado_em', i.criado_em
      ) order by i.criado_em, i.descricao)
      from itens i left join pedidos p on p.id = i.pedido_id
      where i.conta_id = c.id), '[]'::jsonb)
  ) from contas c where c.id = p_conta
$$;

-- -------------------------------------------------------------
-- DONO / GERENTE
-- -------------------------------------------------------------

-- Gera N comandas novas (números seguidos)
create or replace function public.gerar_comandas(p_quantidade integer)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_emp uuid := _exigir(array['dono','gerente']);
  v_ini integer;
  i integer;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 500 then
    raise exception 'Escolha entre 1 e 500 comandas.';
  end if;
  select coalesce(max(numero), 0) into v_ini from comandas where empresa_id = v_emp;
  for i in 1..p_quantidade loop
    insert into comandas (empresa_id, numero, codigo, senha)
    values (v_emp, v_ini + i, upper(encode(gen_random_bytes(8), 'hex')), lpad((floor(random() * 1000))::int::text, 3, '0'));
  end loop;
  return v_ini + 1;
end $$;

-- Bloqueia (perdida/estragada) ou libera de novo
create or replace function public.bloquear_comanda(p_numero integer, p_bloquear boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['dono','gerente']);
  c comandas;
begin
  select * into c from comandas where empresa_id = v_emp and numero = p_numero for update;
  if c.id is null then raise exception 'Comanda não encontrada.'; end if;
  if p_bloquear then
    if c.status = 'aberta' then raise exception 'A comanda % está em uso. Feche a conta primeiro.', p_numero; end if;
    update comandas set status = 'bloqueada' where id = c.id;
  else
    if c.status = 'bloqueada' then update comandas set status = 'livre', perdida = false where id = c.id; end if;
  end if;
end $$;

create or replace function public.salvar_config(p_nome text, p_usa_quilo boolean, p_preco_quilo numeric, p_multa numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir(array['dono']);
begin
  if coalesce(trim(p_nome), '') = '' then raise exception 'Informe o nome.'; end if;
  if p_preco_quilo < 0 or p_multa < 0 then raise exception 'Valores não podem ser negativos.'; end if;
  update empresas set nome = trim(p_nome), usa_quilo = p_usa_quilo,
         preco_quilo = coalesce(p_preco_quilo, 0), multa_comanda = coalesce(p_multa, 0)
   where id = v_emp;
end $$;

-- -------------------------------------------------------------
-- ENTRADA
-- -------------------------------------------------------------
create or replace function public.abrir_comanda(p_leitura text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['entrada','caixa','dono','gerente']);
  c comandas;
  v_conta uuid;
begin
  c := _achar_comanda(v_emp, p_leitura, false);
  perform 1 from comandas where id = c.id for update;
  select * into c from comandas where id = c.id;
  if c.status = 'bloqueada' then raise exception 'Comanda % está bloqueada. Troque por outra.', c.numero; end if;
  if c.status = 'aberta' then raise exception 'Comanda % já está aberta (ainda não foi paga).', c.numero; end if;
  insert into contas (empresa_id, comanda_id, comanda_numero, aberta_por)
  values (v_emp, c.id, c.numero, auth.uid()) returning id into v_conta;
  update comandas set status = 'aberta', conta_id = v_conta where id = c.id;
  return jsonb_build_object('comanda', c.numero, 'conta_id', v_conta);
end $$;

-- Desfaz uma abertura por engano (só se não tiver nada lançado)
create or replace function public.cancelar_abertura(p_conta uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['entrada','caixa','dono','gerente']);
  ct contas;
begin
  select * into ct from contas where id = p_conta and empresa_id = v_emp for update;
  if ct.id is null or ct.status <> 'aberta' then raise exception 'Conta não está aberta.'; end if;
  if exists (select 1 from itens where conta_id = ct.id and not cancelado) then
    raise exception 'Essa comanda já tem consumo. Feche pelo caixa.';
  end if;
  update contas set status = 'cancelada', fechada_em = now() where id = ct.id;
  update comandas set status = 'livre', conta_id = null where id = ct.comanda_id;
end $$;

-- -------------------------------------------------------------
-- TABLET DA MESA / EQUIPE: ler comanda e pedir
-- -------------------------------------------------------------
-- Tentativas erradas de número+senha no tablet (trava chute)
create table if not exists public.tentativas_comanda (
  id       bigint generated always as identity primary key,
  user_id  uuid not null,
  em       timestamptz not null default now()
);
create index if not exists idx_tentativas on public.tentativas_comanda (user_id, em);
alter table public.tentativas_comanda enable row level security;

create or replace function public.ler_comanda(p_leitura text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['mesa','entrada','caixa','balanca','garcom','cozinha','dono','gerente']);
  v_papel text := meu_papel();
  c comandas;
begin
  if v_papel = 'mesa' then
    -- a trava vale só para o número digitado (o QR não dá para chutar)
    if upper(coalesce(p_leitura, '')) !~ '[0-9A-F]{16}'
       and (select count(*) from tentativas_comanda where user_id = auth.uid() and em > now() - interval '10 minutes') >= 8 then
      return jsonb_build_object('erro', 'Muitas tentativas erradas. Use o QR da comanda ou chame o garçom.');
    end if;
    begin
      c := _achar_comanda(v_emp, p_leitura, true);
    exception when others then
      -- guarda a tentativa (por isso devolve o erro em vez de estourar)
      insert into tentativas_comanda (user_id) values (auth.uid());
      delete from tentativas_comanda where em < now() - interval '1 day';
      return jsonb_build_object('erro', 'Comanda não encontrada. Confira o número e a senha.');
    end;
  else
    c := _achar_comanda(v_emp, p_leitura, false);
  end if;
  if c.status = 'bloqueada' then raise exception 'Comanda % está bloqueada. Procure o caixa.', c.numero; end if;
  if c.status <> 'aberta' or c.conta_id is null then
    raise exception 'Comanda % não foi aberta na entrada.', c.numero;
  end if;
  return _resumo_conta(c.conta_id);
end $$;

-- p_itens: [{"produto_id": "...", "quantidade": 2, "observacao": "sem cebola"}]
-- p_no_caixa: vendido no caixa (entra já entregue, não vai para a cozinha)
drop function if exists public.enviar_pedido(text, integer, jsonb);
create or replace function public.enviar_pedido(p_leitura text, p_mesa integer, p_itens jsonb, p_no_caixa boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['mesa','garcom','caixa','dono','gerente']);
  v_papel text := meu_papel();
  c comandas;
  x jsonb;
  pr produtos;
  v_qtd integer;
  v_pedido uuid;
  v_pedidos jsonb := '{}'::jsonb;
  v_origem text;
  v_status text;
  v_n integer := 0;
begin
  if v_papel = 'mesa' then
    -- mesma trava do ler_comanda para número digitado
    if upper(coalesce(p_leitura, '')) !~ '[0-9A-F]{16}'
       and (select count(*) from tentativas_comanda where user_id = auth.uid() and em > now() - interval '10 minutes') >= 8 then
      return jsonb_build_object('erro', 'Muitas tentativas erradas. Use o QR da comanda ou chame o garçom.');
    end if;
    begin
      c := _achar_comanda(v_emp, p_leitura, true);
    exception when others then
      insert into tentativas_comanda (user_id) values (auth.uid());
      return jsonb_build_object('erro', 'Comanda não encontrada. Confira o número e a senha.');
    end;
  else
    c := _achar_comanda(v_emp, p_leitura, false);
  end if;
  select * into c from comandas where id = c.id for update;
  if c.status <> 'aberta' or c.conta_id is null then
    raise exception 'Comanda % não está aberta.', c.numero;
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido está vazio.';
  end if;
  if jsonb_array_length(p_itens) > 40 then raise exception 'Pedido grande demais. Divida em partes.'; end if;
  if p_mesa is not null and not exists (select 1 from mesas where empresa_id = v_emp and numero = p_mesa and ativa) then
    raise exception 'Mesa % não cadastrada.', p_mesa;
  end if;
  -- trava contra pedidos em sequência (toque repetido)
  if (select count(*) from pedidos where conta_id = c.conta_id and criado_em > now() - interval '10 minutes') >= 12 then
    raise exception 'Muitos pedidos seguidos nesta comanda. Chame o garçom.';
  end if;

  -- no caixa o produto é entregue na hora (ex.: chocolate na saída)
  if coalesce(p_no_caixa, false) and v_papel in ('caixa','dono','gerente') then
    v_origem := 'caixa';
    v_status := 'entregue';
  else
    if v_papel = 'caixa' then raise exception 'No caixa, use “+ Produto”.'; end if;
    v_origem := case v_papel when 'mesa' then 'mesa' else 'garcom' end;
    v_status := 'novo';
  end if;

  for x in select * from jsonb_array_elements(p_itens) loop
    select * into pr from produtos
     where id = (x->>'produto_id')::uuid and empresa_id = v_emp and ativo;
    if pr.id is null then raise exception 'Produto não encontrado.'; end if;
    if not pr.disponivel then raise exception '% acabou. Tire do pedido.', pr.nome; end if;
    v_qtd := coalesce((x->>'quantidade')::integer, 1);
    if v_qtd < 1 or v_qtd > 50 then raise exception 'Quantidade inválida para %.', pr.nome; end if;

    v_pedido := (v_pedidos->>pr.setor)::uuid;
    if v_pedido is null then
      insert into pedidos (empresa_id, conta_id, comanda_numero, mesa_numero, setor, origem, status, entregue_em)
      values (v_emp, c.conta_id, c.numero, p_mesa, pr.setor, v_origem, v_status,
              case when v_status = 'entregue' then now() end)
      returning id into v_pedido;
      v_pedidos := v_pedidos || jsonb_build_object(pr.setor, v_pedido);
    end if;

    insert into itens (empresa_id, conta_id, pedido_id, produto_id, tipo, descricao, quantidade, preco_unit, observacao, criado_por)
    values (v_emp, c.conta_id, v_pedido, pr.id, 'produto', pr.nome, v_qtd, pr.preco,
            left(coalesce(trim(x->>'observacao'), ''), 140), auth.uid());
    v_n := v_n + 1;
  end loop;

  if p_mesa is not null then
    update contas set mesa_numero = p_mesa where id = c.conta_id;
  end if;

  return _resumo_conta(c.conta_id);
end $$;

create or replace function public.chamar_garcom(p_mesa integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir(array['mesa','dono','gerente']);
begin
  if not exists (select 1 from mesas where empresa_id = v_emp and numero = p_mesa and ativa) then
    raise exception 'Mesa % não cadastrada.', p_mesa;
  end if;
  insert into chamados (empresa_id, mesa_numero) values (v_emp, p_mesa)
  on conflict (empresa_id, mesa_numero) where atendido_em is null do nothing;
end $$;

create or replace function public.atender_chamado(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_emp uuid := _exigir(array['garcom','caixa','dono','gerente']);
begin
  update chamados set atendido_em = now(), atendido_por = auth.uid()
   where id = p_id and empresa_id = v_emp and atendido_em is null;
end $$;

-- -------------------------------------------------------------
-- COZINHA / GARÇOM
-- -------------------------------------------------------------
create or replace function public.mudar_pedido(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['cozinha','garcom','dono','gerente']);
  v_papel text := meu_papel();
  p pedidos;
begin
  select * into p from pedidos where id = p_id and empresa_id = v_emp for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  if p.status = 'cancelado' then raise exception 'Esse pedido foi cancelado.'; end if;

  if p_status = 'preparando' and p.status = 'novo' and v_papel in ('cozinha','dono','gerente') then
    update pedidos set status = 'preparando', preparando_em = now() where id = p.id;
  elsif p_status = 'pronto' and p.status in ('novo','preparando') and v_papel in ('cozinha','dono','gerente') then
    update pedidos set status = 'pronto', pronto_em = now(), preparando_em = coalesce(preparando_em, now()) where id = p.id;
  elsif p_status = 'entregue' and p.status in ('pronto','novo','preparando') and v_papel in ('garcom','dono','gerente')
        and (p.status = 'pronto' or p.setor = 'balcao' or v_papel <> 'garcom') then
    update pedidos set status = 'entregue', entregue_em = now(), pronto_em = coalesce(pronto_em, now()) where id = p.id;
  elsif p_status = 'preparando' and p.status = 'pronto' and v_papel in ('cozinha','dono','gerente') then
    -- "voltar": marcou pronto sem querer
    update pedidos set status = 'preparando', pronto_em = null where id = p.id;
  else
    raise exception 'Não dá para mudar de "%" para "%".', p.status, p_status;
  end if;
end $$;

-- -------------------------------------------------------------
-- CAIXA / BALANÇA
-- -------------------------------------------------------------

-- Lança peso (quilo) ou item avulso numa comanda aberta
create or replace function public.lancar_item(p_leitura text, p_tipo text, p_quantidade numeric, p_descricao text default null, p_preco numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['caixa','balanca','dono','gerente']);
  v_papel text := meu_papel();
  e empresas;
  c comandas;
begin
  select * into e from empresas where id = v_emp;
  c := _achar_comanda(v_emp, p_leitura, false);
  if c.status <> 'aberta' or c.conta_id is null then raise exception 'Comanda % não está aberta.', c.numero; end if;

  if p_tipo = 'quilo' then
    if not e.usa_quilo then raise exception 'O módulo por quilo está desligado.'; end if;
    if e.preco_quilo <= 0 then raise exception 'Cadastre o preço do quilo nas configurações.'; end if;
    if p_quantidade is null or p_quantidade < 0.005 or p_quantidade > 10 then
      raise exception 'Peso inválido. Digite em kg (ex.: 0,450).';
    end if;
    insert into itens (empresa_id, conta_id, tipo, descricao, quantidade, preco_unit, criado_por)
    values (v_emp, c.conta_id, 'quilo', 'Comida por quilo', round(p_quantidade, 3), e.preco_quilo, auth.uid());
  elsif p_tipo = 'avulso' then
    if v_papel = 'balanca' then raise exception 'A balança só lança peso.'; end if;
    if coalesce(trim(p_descricao), '') = '' then raise exception 'Descreva o item.'; end if;
    if p_preco is null or p_preco <= 0 or p_preco > 10000 then raise exception 'Valor inválido.'; end if;
    if p_quantidade is null or p_quantidade <= 0 or p_quantidade > 100 then raise exception 'Quantidade inválida.'; end if;
    insert into itens (empresa_id, conta_id, tipo, descricao, quantidade, preco_unit, criado_por)
    values (v_emp, c.conta_id, 'avulso', left(trim(p_descricao), 80), p_quantidade, round(p_preco, 2), auth.uid());
  else
    raise exception 'Tipo inválido.';
  end if;
  return _resumo_conta(c.conta_id);
end $$;

create or replace function public.cancelar_item(p_item uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['caixa','dono','gerente']);
  it itens;
begin
  select * into it from itens where id = p_item and empresa_id = v_emp for update;
  if it.id is null then raise exception 'Item não encontrado.'; end if;
  if it.cancelado then return; end if;
  if not exists (select 1 from contas where id = it.conta_id and status = 'aberta') then
    raise exception 'Essa conta já foi fechada.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo.'; end if;
  update itens set cancelado = true, cancelado_motivo = left(trim(p_motivo), 140), cancelado_por = auth.uid()
   where id = it.id;
  if it.tipo = 'multa' then
    update comandas set perdida = false where conta_id = it.conta_id;
  end if;
  -- se o pedido ficou sem itens, some da cozinha
  if it.pedido_id is not null and not exists (select 1 from itens where pedido_id = it.pedido_id and not cancelado) then
    update pedidos set status = 'cancelado' where id = it.pedido_id;
  end if;
end $$;

-- Cliente perdeu a comanda: cobra a multa e a comanda é bloqueada ao fechar
create or replace function public.comanda_perdida(p_conta uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['caixa','dono','gerente']);
  e empresas;
  ct contas;
begin
  select * into e from empresas where id = v_emp;
  select * into ct from contas where id = p_conta and empresa_id = v_emp and status = 'aberta' for update;
  if ct.id is null then raise exception 'Conta não está aberta.'; end if;
  if exists (select 1 from itens where conta_id = ct.id and tipo = 'multa' and not cancelado) then
    raise exception 'A multa já foi lançada.';
  end if;
  update comandas set perdida = true where id = ct.comanda_id;
  if e.multa_comanda > 0 then
    insert into itens (empresa_id, conta_id, tipo, descricao, quantidade, preco_unit, criado_por)
    values (v_emp, ct.id, 'multa', 'Comanda perdida', 1, e.multa_comanda, auth.uid());
  end if;
  return _resumo_conta(ct.id);
end $$;

-- Resumo para o caixa a partir da conta (lista de abertas)
create or replace function public.resumo_conta(p_conta uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid := _exigir(array['caixa','entrada','dono','gerente']);
begin
  if not exists (select 1 from contas where id = p_conta and empresa_id = v_emp) then
    raise exception 'Conta não encontrada.';
  end if;
  return _resumo_conta(p_conta);
end $$;

-- Fecha uma ou várias contas de uma vez
-- p_pagamentos: [{"forma": "pix", "valor": 30.00}, {"forma": "dinheiro", "valor": 50}]
-- Em dinheiro pode vir a mais: a diferença vira troco.
create or replace function public.fechar_contas(p_contas uuid[], p_pagamentos jsonb, p_desconto numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid := _exigir(array['caixa','dono','gerente']);
  v_sub numeric := 0;
  v_desc numeric := round(coalesce(p_desconto, 0), 2);
  v_total numeric;
  v_pago numeric := 0;
  v_dinheiro numeric := 0;
  v_troco numeric := 0;
  v_fech uuid;
  x jsonb;
  ct contas;
  v_forma text;
  v_valor numeric;
begin
  if p_contas is null or array_length(p_contas, 1) is null then raise exception 'Nenhuma comanda selecionada.'; end if;

  for ct in select * from contas where id = any(p_contas) order by comanda_numero for update loop
    if ct.empresa_id <> v_emp then raise exception 'Conta de outra empresa.'; end if;
    if ct.status <> 'aberta' then raise exception 'A comanda % já foi fechada.', ct.comanda_numero; end if;
    v_sub := v_sub + _total_conta(ct.id);
  end loop;
  if (select count(*) from contas where id = any(p_contas)) <> array_length(p_contas, 1) then
    raise exception 'Conta não encontrada.';
  end if;

  if v_desc < 0 or v_desc > v_sub then raise exception 'Desconto inválido.'; end if;
  v_total := v_sub - v_desc;

  if jsonb_typeof(coalesce(p_pagamentos, '[]'::jsonb)) <> 'array' then raise exception 'Pagamento inválido.'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) loop
    v_forma := x->>'forma';
    v_valor := round((x->>'valor')::numeric, 2);
    if v_forma not in ('pix','credito','debito','dinheiro') then raise exception 'Forma de pagamento inválida.'; end if;
    if v_valor is null or v_valor <= 0 then raise exception 'Valor de pagamento inválido.'; end if;
    v_pago := v_pago + v_valor;
    if v_forma = 'dinheiro' then v_dinheiro := v_dinheiro + v_valor; end if;
  end loop;

  if v_pago < v_total then
    raise exception 'Falta receber R$ %.', replace(to_char(v_total - v_pago, 'FM9999990.00'), '.', ',');
  end if;
  v_troco := v_pago - v_total;
  if v_troco > v_dinheiro then
    raise exception 'Valor a mais só pode ser em dinheiro (troco). Confira os valores.';
  end if;

  insert into fechamentos (empresa_id, subtotal, desconto, total, criado_por)
  values (v_emp, v_sub, v_desc, v_total, auth.uid()) returning id into v_fech;

  -- grava cada forma; o troco sai da parte em dinheiro
  for x in select * from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) loop
    v_forma := x->>'forma';
    v_valor := round((x->>'valor')::numeric, 2);
    if v_forma = 'dinheiro' and v_troco > 0 then
      insert into fechamento_pagamentos (empresa_id, fechamento_id, forma, valor, recebido, troco)
      values (v_emp, v_fech, v_forma, v_valor - least(v_troco, v_valor), v_valor, least(v_troco, v_valor));
      v_troco := v_troco - least(v_troco, v_valor);
    else
      insert into fechamento_pagamentos (empresa_id, fechamento_id, forma, valor, recebido)
      values (v_emp, v_fech, v_forma, v_valor, v_valor);
    end if;
  end loop;

  update contas set status = 'fechada', fechada_em = now(), fechamento_id = v_fech where id = any(p_contas);
  update comandas
     set status = case when perdida then 'bloqueada' else 'livre' end,
         conta_id = null
   where conta_id = any(p_contas);

  return jsonb_build_object('fechamento_id', v_fech, 'subtotal', v_sub, 'desconto', v_desc,
                            'total', v_total, 'troco', v_pago - v_total);
end $$;

-- -------------------------------------------------------------
-- RELATÓRIO DE VENDAS (dono/gerente)
-- -------------------------------------------------------------
create or replace function public.relatorio_vendas(p_inicio timestamptz, p_fim timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_emp uuid := _exigir(array['dono','gerente']);
begin
  return jsonb_build_object(
    'total', (select coalesce(sum(total), 0) from fechamentos where empresa_id = v_emp and criado_em >= p_inicio and criado_em < p_fim),
    'desconto', (select coalesce(sum(desconto), 0) from fechamentos where empresa_id = v_emp and criado_em >= p_inicio and criado_em < p_fim),
    'contas', (select count(*) from contas where empresa_id = v_emp and status = 'fechada' and fechada_em >= p_inicio and fechada_em < p_fim),
    'pagamentos', (select count(*) from fechamentos where empresa_id = v_emp and criado_em >= p_inicio and criado_em < p_fim),
    'por_forma', coalesce((
      select jsonb_object_agg(forma, soma) from (
        select fp.forma, sum(fp.valor) soma
          from fechamento_pagamentos fp join fechamentos f on f.id = fp.fechamento_id
         where f.empresa_id = v_emp and f.criado_em >= p_inicio and f.criado_em < p_fim
         group by fp.forma) q), '{}'::jsonb),
    'top', coalesce((
      select jsonb_agg(q order by q.valor desc) from (
        select i.descricao, i.tipo, sum(i.quantidade) quantidade, sum(i.total) valor
          from itens i join contas c on c.id = i.conta_id
         where i.empresa_id = v_emp and not i.cancelado and c.status = 'fechada'
           and c.fechada_em >= p_inicio and c.fechada_em < p_fim
         group by i.descricao, i.tipo
         order by sum(i.total) desc limit 15) q), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_object_agg(h, soma) from (
        select extract(hour from criado_em at time zone 'America/Sao_Paulo')::int h, sum(total) soma
          from fechamentos where empresa_id = v_emp and criado_em >= p_inicio and criado_em < p_fim
         group by 1) q), '{}'::jsonb),
    'cancelados', (select count(*) from itens i where i.empresa_id = v_emp and i.cancelado and i.criado_em >= p_inicio and i.criado_em < p_fim),
    'tempo_medio_cozinha_min', (select round(avg(extract(epoch from (pronto_em - criado_em)) / 60)::numeric, 1)
       from pedidos where empresa_id = v_emp and setor = 'cozinha' and pronto_em is not null and criado_em >= p_inicio and criado_em < p_fim)
  );
end $$;

-- -------------------------------------------------------------
-- PERMISSÕES DAS FUNÇÕES
-- -------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('minha_empresa','meu_papel','_exigir','_achar_comanda','_total_conta','_resumo_conta',
                         'gerar_comandas','bloquear_comanda','salvar_config','abrir_comanda','cancelar_abertura',
                         'ler_comanda','enviar_pedido','chamar_garcom','atender_chamado','mudar_pedido',
                         'lancar_item','cancelar_item','comanda_perdida','resumo_conta','fechar_contas','relatorio_vendas')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname like '\_%' escape '\' then
      execute format('revoke all on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------
-- TEMPO REAL (cozinha, garçom, caixa e painel atualizam sozinhos)
-- -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pedidos','itens','contas','comandas','chamados','produtos'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------
-- FOTOS DO CARDÁPIO (Storage)
-- Pasta = id da empresa. Qualquer um vê a foto; só dono/gerente envia.
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "produtos enviar" on storage.objects;
create policy "produtos enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = public.minha_empresa()::text
              and public.meu_papel() in ('dono','gerente'));
drop policy if exists "produtos trocar" on storage.objects;
create policy "produtos trocar" on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = public.minha_empresa()::text
         and public.meu_papel() in ('dono','gerente'));
drop policy if exists "produtos apagar" on storage.objects;
create policy "produtos apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = public.minha_empresa()::text
         and public.meu_papel() in ('dono','gerente'));
drop policy if exists "produtos ver" on storage.objects;
create policy "produtos ver" on storage.objects for select to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = public.minha_empresa()::text);
