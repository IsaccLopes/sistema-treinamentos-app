# Sistema de Treinamentos ADM - V2 LGPD

Versão pública sem base de dados no GitHub. Os dados ficam protegidos no Supabase.

## Novidades

- Percentual de aderência geral e por filtro/setor.
- Aderência por treinamento.
- Aderência por setor.
- Vencimentos em 30, 60 e 90 dias.
- Anexo em cadastro de novo treinamento.
- Anexo em reciclagem/integração.
- Histórico de lançamentos: integração, reciclagem, ajuste manual e não se aplica.
- Edição do vínculo colaborador x treinamento mantendo histórico.
- QR Code mais limpo para celular: mostra apenas em dia/atrasados/devendo.

## Ordem de atualização

1. No Supabase, rode `supabase/05_indicadores_anexos_historico.sql`.
2. No GitHub, substitua estes arquivos na raiz do repositório público:
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
3. Commit sugerido: `Adicionar indicadores e histórico de treinamentos`.
4. Abra o site e use Ctrl + F5.

Não suba CSV, matriz, planilha ou `data.js` neste repositório público.
