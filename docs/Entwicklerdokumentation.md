# Entwicklerdokumentation – Smart Restaurant

## Überblick

Smart Restaurant ist ein digitales Bestell- und Verwaltungssystem für eine Gaststätte. Das Projekt besteht aus der Angular-Anwendung `apps/gastro-ui`, der REST-API `backend` (NestJS/Fastify) und gemeinsamen Zod-Verträgen in `contracts`. Die Daten liegen in PostgreSQL; Prisma verwaltet das Schema und die Migrationen. Nx startet die Projekte im pnpm-Workspace.

## Lokal starten

Voraussetzungen: Node.js 24 oder neuer, pnpm 11 und Docker mit Docker Compose. Die folgenden Befehle im Projektverzeichnis ausführen:

```powershell
pnpm install --frozen-lockfile
```

Falls `backend/.env` noch nicht existiert, die Vorlage kopieren:

```powershell
Copy-Item backend/.env.example backend/.env
```

In `backend/.env` einen eigenen Wert mit mindestens 32 Zeichen für `BETTER_AUTH_SECRET` eintragen. `DATABASE_URL` muss zu den PostgreSQL-Werten derselben Datei passen. Anschließend Datenbank, bestehende Migrationen und Anwendung starten:

```powershell
docker compose -p smart-restaurant --env-file ./backend/.env up -d
pnpm db:migrate
pnpm dev
```

`pnpm dev` erzeugt den Prisma Client und startet Frontend sowie Backend. Das Frontend ist unter <http://localhost:4200> erreichbar, die interaktive API-Dokumentation unter <http://localhost:3000/api/docs>. Für Beispieldaten und das erste Admin-Konto siehe [README](../README.md#load-the-sample-data) und [README: Admin-Zugang](../README.md#create-the-first-admin-login).

## Orientierung und weitere Dokumentation

- Start-, Build- und Qualitätsskripte: [`package.json`](../package.json); Nx-Konfiguration: [`nx.json`](../nx.json), [`apps/gastro-ui/project.json`](../apps/gastro-ui/project.json), [`backend/project.json`](../backend/project.json) und [`contracts/project.json`](../contracts/project.json).
- Datenbankschema und Migrationen: [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) und [`backend/prisma/migrations`](../backend/prisma/migrations).
- API-Endpunkte, Eingabeformate und Rollenrechte: <http://localhost:3000/api/docs> bei laufendem Backend; fachlicher Überblick: [README](../README.md#api-resources).
- Offizielle Anleitungen: [pnpm-Installation](https://pnpm.io/installation), [Nx-Aufgaben ausführen](https://nx.dev/docs/features/run-tasks) und [Prisma CLI, Version 7](https://docs.prisma.io/docs/cli/v7/migrate).
