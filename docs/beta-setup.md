# Beta starten und prüfen

Die Umsetzung liegt ausschließlich auf `dev/main-beta`. Die Mitarbeiteroberfläche
ist Teil von `gastro-ui`; es gibt kein zusätzliches Microfrontend.

## Bestehende Datenbank aktualisieren

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Die neue Migration `20261005170000_ingredient_stock` ergänzt Einheiten,
Bestände und unveränderliche Rezeptbuchungen pro Position. Sie löscht keine
Bestellungen. Bestehende Zutaten starten mit `0 g`; gemessene Bestände und passende
Einheiten müssen in der Verwaltung eingerichtet werden. Solange Bestand 0 ist und
noch keine Bestandsbuchung existiert, kann die Einheit erstmals passend zu den
vorhandenen Rezeptmengen eingestellt werden. Danach ist die Einheit geschützt;
für einen späteren Einheitenwechsel eine neue Zutat anlegen und das Rezept ersetzen.
Altbestellungen erhalten keine erfundenen historischen
Buchungen und erzeugen deshalb keine Rückerstattung von nie gebuchten Mengen.

`backend/.env` muss `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` und
`FRONTEND_URL` passend zur lokalen Umgebung enthalten (siehe `.env.example`).
Die Frontend-Entwicklungsproxy-Konfiguration leitet `/api` an das Backend weiter.
Bei Auslieferung müssen Frontend und `/api` über denselben öffentlichen Ursprung
erreichbar sein; der Proxy muss SSE offenhalten und darf es nicht puffern.

Falls noch kein ADMIN mit Login existiert:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL='deine-admin-email@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD='eigenes-Passwort-mit-mindestens-12-Zeichen'
pnpm db:bootstrap-admin
```

Der Bootstrap verknüpft den vorhandenen Admin mit einem Login. Zugangsdaten werden
nicht ins Repository geschrieben. Für Demodaten kann **ausschließlich in einer
dafür vorgesehenen Entwicklungsdatenbank** `pnpm db:seed` verwendet werden; dieser
Befehl setzt Daten und Konten zurück. Der Seed enthält Beispielbestände und bucht
seine Beispielbestellungen gegen diese Mengen.

## Routen und Bedienung

- `/anmelden`: Mitarbeiterlogin; ohne „Angemeldet bleiben“ wird ein Session-Cookie verwendet.
- `/mitarbeiter`: Live-Board für ADMIN/SERVICE, Speisen für KITCHEN, Getränke für BAR.
- `/mitarbeiter/personal`: ADMIN legt Konten an, ändert Namen/Rollen und aktiviert
  vorhandene Mitarbeiter ohne Login. Der letzte aktive Admin bleibt geschützt.
- `/mitarbeiter/produkte`: ADMIN pflegt Produkte, Preise und Rezepte pro Portion.
- `/mitarbeiter/zutaten`: ADMIN pflegt Zutaten, Einheiten und Bestand. Gleichzeitiger
  Verbrauch verhindert das Überschreiben einer inzwischen veralteten Bestandskorrektur.
- `/mitarbeiter/konto`: eigenes Passwort ändern; andere Sitzungen werden widerrufen.
- `/gastzugang?tableId=…&token=…`: einmaliger QR-Einstieg; danach wird der QR-Token
  aus der aktuellen URL entfernt und ein HttpOnly-Cookie verwendet.
- `/bestellungen`: Gastübersicht des aktiven Tischbesuchs, einschließlich bezahlter
  Bestellungen. Nach Tischfreigabe endet der Zugriff auf diesen Besuch.

Service/ADMIN können im Live-Board „Bestellung aufnehmen & Tischzugang“ öffnen,
einen Tisch auswählen und dessen QR-Code anzeigen/herunterladen. Beim Testen den
Gastlink in einem separaten Browserprofil öffnen, damit der Mitarbeiterlogin
nicht Vorrang vor dem Gastzugang hat. Für einen echten Smartphone-Scan muss die
Website über eine vom Telefon erreichbare Adresse laufen; `localhost` bezeichnet
auf dem Telefon das Telefon selbst.

Ein SSE-Dienst pro Tab lädt einen konsistenten Snapshot, verarbeitet Änderungen,
verbindet nach Unterbrechungen erneut und lädt bei Resync einen frischen Snapshot.
Bestandsereignisse `inventory.updated` und Snapshot-`ingredients` werden nur ADMIN
geliefert. Ein Identitäts-/Rollenwechsel beendet die bisherige Verbindung und leert
die bisherigen Live-Daten. Auth-Cookies bleiben außerhalb von Web Storage; dort
stehen lediglich Warenkorb-IDs/Mengen sowie eine nicht berechtigende Zuordnung
zum bisherigen Nutzer/Tischbesuch.

## Verifikation

```powershell
pnpm nx build gastro-ui
pnpm nx build backend
pnpm nx lint gastro-ui
pnpm test:frontend
```

`backend/tests/beta.integration.mjs` prüft echte REST-/SSE-/Bestandsabläufe. Nur
gegen ein separat gestartetes, migriertes und mit Bootstrap-ADMIN versehenes
Testbackend ausführen: Der Test legt Daten einschließlich Buchungshistorie an.
Er erwartet einen frischen Seed (Admin-ID 1 und freie Test-Tischnummern 10001/10002).

```powershell
$env:TEST_API_URL='http://localhost:4320'
$env:TEST_FRONTEND_ORIGIN='http://localhost:4319'
$env:TEST_ADMIN_EMAIL='test-admin@example.test'
$env:TEST_ADMIN_PASSWORD='dein-test-admin-passwort'
$env:BETA_INTEGRATION_ALLOW_WRITES='yes'
pnpm test:beta
```

Abgedeckt: öffentliche Speisekarte, private APIs/Origin-Prüfung, alle Rollen,
Gast-Isolation/Reload, SSE-Filter, Bestandsabzug, echte Neuzubereitung, idempotente
Statuswiederholung, Storno trotz Rezeptänderung, keine Rückbuchung nach Beginn,
atomarer Fehler bei fehlenden Zutaten, parallele Bestellungen ohne Überverkauf,
bezahlte Gastübersicht bis Tischfreigabe sowie Passwortwechsel/Logout.

Am 05.10.2026 bestanden beide Produktionsbuilds, Frontend-Lint, gezieltes
Backend-/Contracts-Lint sowie 10 Frontend- und 10 Backend-Integrationstests.
Zusätzlich mit Chrome und echtem Testbackend geprüft: Adminformulare und Rollenwahl,
QR-Erzeugung, Warenkorb-/Gast-Reload, Live-Status, bezahlte Übersicht bis Freigabe,
SSE nach Offline-Intervall, Logout, Rollenwechsel und Desktop-/Mobilansichten.
Das initiale Frontend-Bundle liegt bei etwa 526 kB und überschreitet die unveränderte
500-kB-Warnschwelle. Die erst bei QR-Anzeige geladene `qrcode`-Bibliothek erzeugt
CommonJS-Warnungen; der Build ist erfolgreich. Die Fehlerbudgets wurden nicht erhöht.
