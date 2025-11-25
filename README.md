#### Executando migrations em produção (Render + Neon)

- NÃO rode comandos destrutivos em produção (ex.: `prisma migrate reset` ou scripts que executem `DROP TABLE`).
- Fluxo recomendado:
  - Local / CI: crie migrations com `npx prisma migrate dev` e commit nas migrations geradas.
  - Produção: aplique migrations com `npx prisma migrate deploy`.

Render + Neon (exemplo)
- No painel do Render, configure `DATABASE_URL` com a string de conexão do Neon e outras variáveis (JWT_SECRET, etc).
- Start command recomendado:
  sh -lc 'if [ "$MIGRATE" = "1" ]; then pnpm run migrate; fi && NODE_ENV=production tsx server/_core/index.ts'
- Deixe `MIGRATE=0` (ou não definida) por padrão para evitar executar migrations automaticamente em cada deploy.
- Para aplicar migrations durante um deploy controlado:
  1. Temporariamente, defina `MIGRATE=1` no painel do Render (ou configure a variável MIGRATE=1 no seu pipeline apenas para esse deploy).
  2. Faça o deploy — o start script executará migrations e então iniciará o servidor.
  3. Quando o deploy terminar com sucesso, volte `MIGRATE=0` (ou remova a variável).

Notas Neon/Prisma
- Use a string do Neon em `DATABASE_URL`.
- Se usar pooling/serverless do Neon, consulte as recomendações do Prisma/Neon para parâmetros de pool (connection settings).
- NÃO automatize seeding em produção; se precisar de seed, crie um script de seed que rode apenas quando `SEED=1` e execute manualmente.
