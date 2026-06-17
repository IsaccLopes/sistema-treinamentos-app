# Sistema de Treinamentos ADM - versão pública segura

Esta versão é para repositório público no GitHub Pages.

Ela NÃO contém:

- data.js com matriz;
- CSVs;
- nomes reais;
- matrículas reais;
- planilha;
- dados da empresa.

A base fica somente no Supabase.

## Ordem correta

1. Rode `supabase/04_lgpd_seguro.sql` no SQL Editor do Supabase.
2. Crie o primeiro usuário em Supabase > Authentication > Users.
3. Vincule o UID desse usuário na tabela `usuarios_app` com perfil `gerencia`.
4. Publique no GitHub público somente:
   - index.html
   - style.css
   - app.js
   - README.md
5. Não publique a pasta `supabase` se não quiser. Ela é só instrução local.

## Login

O login é pelo Supabase Auth, usando e-mail e senha.

Por segurança, o app público não cria senha diretamente no navegador. Para novo técnico/gerência:

1. A gerência cadastra/vincula o acesso na tela Acessos.
2. O usuário precisa existir em Supabase Authentication.
3. O campo `auth_user_id` precisa estar vinculado ao UID do usuário.

Isso evita colocar `service_role` ou senha sensível no GitHub Pages.

## QR Code

O QR usa `qr_token`, não matrícula.

Exemplo:

`https://seuusuario.github.io/sistema-treinamentos-app/?qr=TOKEN`

Quem escaneia não acessa tabelas. O site chama uma RPC segura que retorna apenas os treinamentos daquele token.
