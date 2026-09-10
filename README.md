# HunterZone

Une app de chat IRL.

## Prérequis

- Node.js (version 18 ou supérieure recommandée)
- Un projet [Supabase](https://supabase.com) pour la base de données

## Installation

```bash
npm install
```

## Configuration

Créer un fichier `.env.local` à la racine du projet avec les variables suivantes, nécessaires au fonctionnement de la base de données Supabase :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Lancer le projet en développement

```bash
npm run dev
```

L'application est ensuite accessible sur [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm run start
```

## Version prod

La version de production est accessible sur [https://hunterzone.gettheflow.fr](https://hunterzone.gettheflow.fr).
