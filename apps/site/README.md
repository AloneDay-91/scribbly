# Site Scribbly

Site Next.js du monorepo. Il présente l’app et lit les releases GitHub.

```bash
npm run dev:site
```

Depuis la racine du dépôt. Le site écoute sur http://localhost:3001.

## Dokploy

Application Git, construction par Dockerfile.

- Dockerfile : `apps/site/Dockerfile`
- Contexte : `.`
- Port : `3000`
