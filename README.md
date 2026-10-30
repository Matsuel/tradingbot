# Bot de trading BTC / ETH

Bot de **paper trading** : 10 000 $ fictifs, cours réels (yahoo-finance2), aucun ordre réel passé.

## Stratégie

Bougies 15 min, sur `BTC-USD` et `ETH-USD` :

- **Long** si EMA20 > EMA50 et RSI14 < 70 ; **short** si EMA20 < EMA50 et RSI14 > 30.
- Stop-loss à 2×ATR14, take-profit à 3×ATR14.
- Sortie anticipée si la tendance EMA s'inverse.
- Taille : 1 % du capital risqué au stop, plafonnée à 25 % du capital par position.
- Frais : 0,1 % à l'entrée et à la sortie.

Paramètres dans `src/lib/strategy.ts`.

## Fonctionnement

`GET /api/tick` exécute un cycle (sorties, entrées, journal, snapshot de la valeur du portefeuille).
Un cron externe l'appelle toutes les 15 min : une fonction Vercel ne peut pas tourner en boucle.
Le cash et la valeur du portefeuille sont recalculés à partir de la table `positions`.

## Déploiement

1. Pousser le projet sur GitHub, puis l'importer dans Vercel.
2. Vercel > projet > **Storage** > créer une base **Neon** et la lier au projet (ajoute `DATABASE_URL`).
3. Vercel > **Settings > Environment Variables** : ajouter `CRON_SECRET` (générer avec `openssl rand -hex 32`).
4. Redéployer : le build applique les migrations de `drizzle/` (`drizzle-kit migrate`), donc les tables sont créées automatiquement.
5. Sur [cron-job.org](https://cron-job.org) : créer un job
   - URL : `https://<ton-projet>.vercel.app/api/tick`
   - Planification : toutes les 15 minutes
   - Header : `Authorization: Bearer <CRON_SECRET>`

## Développement

```bash
bun install
bun dev         # dashboard sur http://localhost:3000
bun test        # tests de la stratégie
bun run db:generate   # après une modif de src/db/schema.ts : crée la migration à commiter
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/tick   # lancer un tick à la main
```
