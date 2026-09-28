-- =============================================================
-- Comanda FH - cardápio de demonstração (padaria)
-- Coloca categorias e produtos de exemplo na empresa do e-mail abaixo.
-- Use na conta de demonstração. Pode rodar de novo: apaga o
-- cardápio de exemplo antigo e o movimento (contas/pedidos) antes.
-- =============================================================
do $$
declare
  v_email_dono text := 'demo@fhdigitalmarketing.com';
  -- ---------------------------------------------------------
  v_emp uuid;
  c_lanches uuid; c_salgados uuid; c_doces uuid; c_bebidas uuid; c_cafe uuid;
begin
  select ue.empresa_id into v_emp
    from usuarios_empresa ue join auth.users u on u.id = ue.user_id
   where lower(u.email) = lower(v_email_dono) and ue.papel = 'dono';
  if v_emp is null then raise exception 'Não achei empresa com dono %.', v_email_dono; end if;

  -- limpa movimento e cardápio
  delete from fechamentos where empresa_id = v_emp;
  delete from caixas where empresa_id = v_emp;
  delete from contas where empresa_id = v_emp;
  delete from chamados where empresa_id = v_emp;
  update comandas set status = 'livre', conta_id = null, perdida = false where empresa_id = v_emp;
  delete from produtos where empresa_id = v_emp;
  delete from categorias where empresa_id = v_emp;

  update empresas set usa_quilo = true, preco_quilo = 69.90, multa_comanda = 50 where id = v_emp;

  insert into categorias (empresa_id, nome, ordem) values (v_emp, 'Lanches', 1) returning id into c_lanches;
  insert into categorias (empresa_id, nome, ordem) values (v_emp, 'Salgados', 2) returning id into c_salgados;
  insert into categorias (empresa_id, nome, ordem) values (v_emp, 'Cafés', 3) returning id into c_cafe;
  insert into categorias (empresa_id, nome, ordem) values (v_emp, 'Bebidas', 4) returning id into c_bebidas;
  insert into categorias (empresa_id, nome, ordem) values (v_emp, 'Doces', 5) returning id into c_doces;

  insert into produtos (empresa_id, categoria_id, nome, descricao, preco, setor, ordem) values
    (v_emp, c_lanches, 'Pão na chapa', 'Pão francês com manteiga na chapa', 7.50, 'cozinha', 1),
    (v_emp, c_lanches, 'Misto quente', 'Presunto e muçarela no pão de forma', 14.90, 'cozinha', 2),
    (v_emp, c_lanches, 'X-Burguer', 'Hambúrguer, queijo, alface e tomate', 24.90, 'cozinha', 3),
    (v_emp, c_lanches, 'X-Bacon', 'Hambúrguer, queijo e bacon', 28.90, 'cozinha', 4),
    (v_emp, c_lanches, 'Omelete completo', 'Três ovos, queijo, presunto e tomate', 22.00, 'cozinha', 5),
    (v_emp, c_salgados, 'Coxinha', 'Frango com catupiry', 8.50, 'balcao', 1),
    (v_emp, c_salgados, 'Pão de queijo (porção)', '6 unidades', 12.00, 'cozinha', 2),
    (v_emp, c_salgados, 'Esfiha de carne', '', 7.00, 'balcao', 3),
    (v_emp, c_cafe, 'Café expresso', '', 6.00, 'balcao', 1),
    (v_emp, c_cafe, 'Café com leite', 'Na xícara grande', 8.00, 'balcao', 2),
    (v_emp, c_cafe, 'Cappuccino', '', 11.00, 'balcao', 3),
    (v_emp, c_bebidas, 'Suco de laranja 400ml', 'Natural', 12.00, 'balcao', 1),
    (v_emp, c_bebidas, 'Refrigerante lata', 'Coca, Guaraná ou Fanta', 7.00, 'balcao', 2),
    (v_emp, c_bebidas, 'Água sem gás', '500ml', 4.50, 'balcao', 3),
    (v_emp, c_doces, 'Bolo de cenoura (fatia)', 'Com cobertura de chocolate', 9.00, 'balcao', 1),
    (v_emp, c_doces, 'Sonho', 'Recheio de creme', 8.00, 'balcao', 2),
    (v_emp, c_doces, 'Pudim (fatia)', '', 10.00, 'balcao', 3);


  -- Fotos de exemplo (banco gratuito Pexels, uso comercial liberado)
  update produtos p set foto = 'https://images.pexels.com/photos/' || f.id || '/pexels-photo-' || f.id || '.jpeg?auto=compress&cs=tinysrgb&w=800'
    from (values
    ('Pão na chapa', 17086299),
    ('Misto quente', 17780276),
    ('X-Burguer', 2874989),
    ('X-Bacon', 2983098),
    ('Omelete completo', 10934498),
    ('Coxinha', 17409458),
    ('Café expresso', 9050518),
    ('Café com leite', 10738363),
    ('Cappuccino', 531874),
    ('Suco de laranja 400ml', 8679396),
    ('Refrigerante lata', 3407777),
    ('Água sem gás', 12478893),
    ('Bolo de cenoura (fatia)', 5742606),
    ('Sonho', 26950774),
    ('Pudim (fatia)', 34462833)
    ) as f(nome, id)
   where p.empresa_id = v_emp and p.nome = f.nome;

  if not exists (select 1 from mesas where empresa_id = v_emp) then
    insert into mesas (empresa_id, numero) select v_emp, g from generate_series(1, 10) g;
  end if;
  if not exists (select 1 from comandas where empresa_id = v_emp) then
    insert into comandas (empresa_id, numero, codigo, senha)
    select v_emp, g, upper(encode(extensions.gen_random_bytes(8), 'hex')), lpad((floor(random() * 1000))::int::text, 3, '0')
      from generate_series(1, 30) g;
  end if;
end $$;
