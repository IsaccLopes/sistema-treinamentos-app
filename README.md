# Sistema de Treinamentos ADM - V5 Portal do Gestor

Versão pública sem base de dados no GitHub. Os dados ficam protegidos no Supabase.

## Novidades da V5

- Perfil novo: `gestor`.
- Gestor vê somente a própria área, definida em `usuarios_app.area_responsavel`.
- Portal do gestor com painel, aderência, vencidos, 30/60/90 dias e consulta dos colaboradores da área.
- Gestor não edita treinamentos, não acessa Base, Atualizar, QR Code, Agenda, Acessos nem Auditoria completa.
- Exportação do gestor sai somente com dados da área dele.

## Arquivos para subir no GitHub

Substitua/suba na raiz:

- `index.html`
- `style.css`
- `app.js`
- `README.md`
- `manifest.json`
- `service-worker.js`
- `icon-192.png`
- `icon-512.png`

Não suba a pasta `supabase` no GitHub público se não quiser. Ela é só para pegar o SQL.

## SQL obrigatório

Antes de testar o gestor, rode no Supabase:

`supabase/07_portal_gestor_area.sql`

## Como cadastrar gestor

1. Supabase > Authentication > Users > Add user.
2. Copie o User UID.
3. No sistema, aba Acessos, escolha perfil `Gestor de área` e informe a área exatamente igual ao setor da base.

Exemplo de área:

- `LABORATORIO`
- `MANUTENÇÃO MECÂNICA`
- `ENVASE`
- `RECEBIMENTO`


## V5.1 - Gestor multiáreas

- Perfil `gestor` na tela Acessos.
- Campo `Área(s) do gestor)` aceita várias áreas separadas por vírgula.
- Exemplo: `LABORATORIO, RECEBIMENTO, MANUTENÇÃO ELÉTRICA`.
- Gestor continua vendo somente Painel e Consulta, mas pode filtrar entre as áreas liberadas.
- Rode `supabase/08_portal_gestor_multiareas.sql` no Supabase.


## V5.2 - Correção Portal do Gestor

- Gestor só vê Painel e Consulta.
- Gestor não vê Base, Atualizar, QR Code, Acessos e Auditoria.
- Gestor não exporta Excel.
- Gestor não edita vínculo, colaborador ou treinamento.
- Painel do gestor sem filtros, focado em acompanhamento por área.
- Suporte a múltiplas áreas separadas por vírgula.
- Comparação de áreas ignora maiúsculas/minúsculas e acentos.
- Login trata duplicidade de cadastro por e-mail/UID, priorizando gerência > gestor > técnico.
