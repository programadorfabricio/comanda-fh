# Comanda FH — comandas com QR, pedido na mesa, cozinha e caixa

Next.js 16 + Supabase + Vercel. Um produto da FH Digital.

## Como funciona

1. **Entrada**: o cliente pega uma comanda (cartão com QR). A entrada lê e a comanda fica aberta.
2. **Mesa**: no tablet, o cliente mostra o QR (ou digita número + senha), escolhe no cardápio e envia.
3. **Cozinha / Balcão**: o pedido aparece na hora, com bip. Marca "Começar" e "Pronto".
4. **Garçom**: no celular aparece "Mesa 5 — pronto para levar" e os chamados das mesas.
5. **Balança** (opcional, por quilo): lê a comanda e lança o peso do prato.
6. **Caixa**: lê a comanda (ou várias, para pagar junto), recebe em Pix/cartão/dinheiro (pode dividir), calcula o troco e libera a comanda.
7. **Dono**: painel ao vivo, vendas por período, cardápio com fotos, comandas, mesas, equipe e configurações.

## Telas

| Rota                 | Quem usa             | O que faz                                                        |
|----------------------|----------------------|------------------------------------------------------------------|
| `/login`             | todos                | Dono entra com e-mail; equipe e tablets com o usuário criado     |
| `/painel`            | dono, gerente        | Vendido hoje, pessoas dentro, cozinha, mais vendidos             |
| `/vendas`            | dono, gerente        | Relatório por período, formas de pagamento, por hora, pagamentos |
| `/cardapio`          | dono, gerente        | Categorias, produtos, fotos, "Acabou"                            |
| `/comandas`          | dono, gerente        | Criar, imprimir (10 por A4), bloquear/liberar                    |
| `/mesas`             | dono, gerente        | Números das mesas                                                |
| `/equipe`            | dono                 | Logins de cada função/aparelho                                   |
| `/config`            | dono                 | Nome, por quilo + preço do kg, multa por comanda perdida         |
| `/entrada`           | entrada              | Abre a comanda (leitor USB/Bluetooth, câmera ou número)          |
| `/mesa`              | tablet de mesa       | Cardápio do cliente                                              |
| `/cozinha`           | cozinha / balcão     | Pedidos ao vivo (filtro Cozinha/Balcão)                          |
| `/garcom`            | garçom               | Prontos para levar + chamados ("minhas mesas")                   |
| `/balanca`           | balança              | Lança o peso (só com por quilo ligado)                           |
| `/caixa`             | caixa                | Fecha a conta                                                    |

O dono abre qualquer tela pelo menu **Telas** (bom para demonstrar tudo num só aparelho).

## Opções por estabelecimento (Configurações)

- **Sem entrada:** para lugares sem catraca/porteiro. A comanda abre sozinha no primeiro pedido do tablet (ou do garçom).
- **Garçom lança pedido:** botão "Lançar pedido" no celular do garçom (escolhe a mesa, digita a comanda, escolhe os itens).
- **Taxa de serviço:** % sobre o consumo (não incide sobre multa). O caixa vê marcada e desmarca se o cliente não quiser.
- **Por quilo** e **multa por comanda perdida**.

## Caixa (turno)

O caixa só recebe com o turno aberto: abre com o troco inicial, registra sangria/reforço e, no fim,
fecha contando o dinheiro da gaveta. O sistema mostra quanto deveria ter e se sobrou ou faltou.
O histórico de turnos aparece em **Vendas**.

## Colocar no ar (primeira vez)

1. **Supabase**: crie um projeto novo (`comanda-fh`). No SQL Editor, rode `supabase/comanda_schema.sql`.
2. Em **Authentication > Sign In / Providers**, desligue **"Allow new users to sign up"** (só a FH cria logins).
3. **GitHub**: suba esta pasta num repositório novo (`comanda-fh`). O `.env.local` **não** vai (já está no `.gitignore`).
4. **Vercel**: importe o repositório e cadastre as variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase > Project Settings > API Keys)
   - `SUPABASE_SECRET_KEY` como **Secret** (só na Vercel; nunca no chat nem no GitHub). Ela é usada só para o dono criar os logins da equipe.

## Cadastrar um cliente

1. Supabase > Authentication > Users > **Add user** (e-mail do dono + senha, marque *Auto Confirm User*).
2. Rode `supabase/nova_empresa.sql` preenchendo e-mail, nome, quantas mesas e quantas comandas.
3. O dono entra, cadastra o cardápio, imprime as comandas e cria os logins em **Equipe**.
4. Em cada tablet de mesa: entre com o login de "Tablet de mesa" e escolha o número da mesa.
   Para trocar depois: toque 5 vezes rápido no nome do restaurante na tela inicial (pede a senha).

Para a conta de demonstração, depois do passo 2 rode `supabase/demo_cardapio.sql` (cardápio de padaria,
por quilo ligado). Rodar de novo limpa o movimento, bom antes de cada apresentação.

## Rodar no PC

```
npm install
npm run dev
```

Crie um `.env.local` a partir do `.env.example`. A câmera só funciona em `localhost` ou `https`.

## Segurança

- Comanda, pedido e pagamento só são gravados pelas funções do banco (conferem papel, empresa e preço).
  O preço vem sempre do cadastro, nunca do tablet.
- O tablet da mesa só enxerga cardápio e mesas; a conta só aparece com o QR ou número + senha da comanda.
  Oito senhas erradas em 10 minutos travam a digitação por um tempo (o QR continua funcionando).
- Item cancelado fica registrado com motivo e quem cancelou. Conta fechada não muda mais.

## Próximos passos (fase 2)

- Integração com catraca (liberar a saída só com a comanda paga)
- Maquininha integrada (TEF / Stone / PagSeguro)
- Abertura e fechamento de caixa com sangria e conferência da gaveta
- Impressão do pedido na cozinha (impressora térmica)
- Exportar vendas para Excel
