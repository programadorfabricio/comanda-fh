-- =============================================================
-- Comanda FH - cadastrar um cliente novo
-- 1) Authentication > Users > Add user > Create new user
--    (e-mail do dono + senha, marque "Auto Confirm User")
-- 2) Preencha as 4 linhas abaixo e clique em "Run"
-- =============================================================
do $$
declare
  v_email_dono  text    := 'dono@exemplo.com';     -- e-mail criado no passo 1
  v_nome        text    := 'Padaria Exemplo';      -- nome do estabelecimento
  v_mesas       integer := 10;                     -- quantas mesas (1, 2, 3...)
  v_comandas    integer := 50;                     -- quantas comandas imprimir
  -- ---------------------------------------------------------
  v_user uuid;
  v_emp  uuid;
  i      integer;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(v_email_dono));
  if v_user is null then raise exception 'Crie primeiro o usuário % em Authentication > Users.', v_email_dono; end if;
  if exists (select 1 from usuarios_empresa where user_id = v_user) then
    raise exception 'Esse e-mail já está ligado a uma empresa.';
  end if;

  insert into empresas (nome) values (v_nome) returning id into v_emp;
  insert into usuarios_empresa (user_id, empresa_id, papel, nome) values (v_user, v_emp, 'dono', 'Dono');

  for i in 1..v_mesas loop
    insert into mesas (empresa_id, numero) values (v_emp, i);
  end loop;

  for i in 1..v_comandas loop
    insert into comandas (empresa_id, numero, codigo, senha)
    values (v_emp, i, upper(encode(extensions.gen_random_bytes(8), 'hex')), lpad((floor(random() * 1000))::int::text, 3, '0'));
  end loop;

  raise notice 'Pronto: % criada com % mesas e % comandas.', v_nome, v_mesas, v_comandas;
end $$;
