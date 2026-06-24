# Sistema de Treinamentos ADM - V4 Gestão Completa

Versão pública sem dados reais no GitHub. Dados ficam no Supabase.

## Novidades V4

- Aba Atualizar mostra os nomes dos colaboradores selecionados.
- Grupos de treinamentos: exemplo Gestão, Operação, Laboratório.
- Aplicar grupo ao colaborador e marcar demais treinamentos como Não se aplica, mantendo histórico.
- Editar periodicidade dos treinamentos já cadastrados.
- Ver anexos ao abrir a ficha do colaborador.
- Exportar Excel completo com colaboradores, treinamentos, situação atual, matriz, histórico, auditoria, agenda, grupos e usuários.
- Lugar para adicionar treinamento novo continua na aba Base.

## Antes de usar

Rode no Supabase SQL Editor:

`supabase/06_grupos_exportacao_periodicidade.sql`

Se ainda não rodou a versão anterior, rode também:

`supabase/05_indicadores_anexos_historico.sql`

## No GitHub público

Suba apenas:

- index.html
- style.css
- app.js
- README.md
- manifest.json
- service-worker.js
- icon-192.png
- icon-512.png

Não suba CSV, planilha nem data.js.
