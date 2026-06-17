# Sistema de Treinamentos ADM - V3 LGPD

Versão pública sem base de dados no GitHub. Os dados ficam protegidos no Supabase.

## Arquivos para subir no GitHub

Suba somente estes arquivos na raiz do repositório público:

- `index.html`
- `style.css`
- `app.js`
- `README.md`

Não suba CSV, planilha, `data.js` ou pasta `supabase`.

## Novidades V3

- Botões rápidos: Vencidos, Até 30 dias, 31 a 60 dias, 61 a 90 dias e Devendo.
- Dashboard visual de vencimentos por faixa.
- Resumo para cobrança da área respeitando filtros.
- Percentual de aderência geral e por filtro/setor/treinamento.
- Aderência por treinamento e por setor.
- Anexos em treinamento novo, reciclagem, integração e ajuste manual.
- Histórico de lançamentos: integração, reciclagem, ajuste manual e não se aplica.
- Edição de vínculo colaborador x treinamento mantendo histórico.
- QR Code somente leitura, sem mostrar itens não aplicáveis.

## Supabase

Antes de usar recursos de anexos e histórico, rode os SQLs da pasta `supabase` no SQL Editor.
