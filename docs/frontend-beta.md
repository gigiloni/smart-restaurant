# Frontend Beta

Branch: `dev/main-beta`, Basis: `dev/main` (`39e62d3`).

Die bestehenden Branches `feature/EAD/startseite-warenkorb` und
`feature/SRE/speisekarte-backend-anbindung` wurden mit Merge-Commits integriert.
Der Mergekonflikt in der Startseite wurde zunächst mit der neueren
Speisekarten-Version aufgelöst und anschließend im Beta-Branch korrigiert.
Backend und Contracts entsprechen weiterhin dem Ausgangsstand von `dev/main`.

## Funktionsumfang

- Startseite mit API-Tischauswahl, Wiederherstellung des Tischs und korrekter Navigation.
- Speisekarte mit Vorspeisen, Hauptgängen und Getränken, Beschreibungen, echten
  Rezeptzutaten und Preisen aus `/api/products`; ein gemeinsamer Produktzustand
  verhindert drei parallele Kategorie-Abfragen.
- Warenkorb mit Hinzufügen, Mengenänderung, Entfernen, Stück-/Positionspreisen
  und Gesamtsumme. Anzeige deutscher Euro-Beträge; Rechnung in ganzzahligen Cent.
- Bestellabgabe an `POST /api/orders`. Mengen werden entsprechend dem bestehenden
  Backend-Vertrag als einzelne Positionen übertragen. Die Tisch-ID wird übertragen,
  nicht die sichtbare Tischnummer.
- Bestätigung mit Bestellnummer und Tisch; erst eine erfolgreiche Antwort leert
  den Warenkorb. Während des Sendens sind Änderungen und erneute Abgabe gesperrt.
- Lade-, Leer- und Fehlerzustände, erneutes Laden, Behandlung nicht mehr verfügbarer
  Produkte und fehlender Tische, mobile Darstellung und Tastaturbedienbarkeit.
- Seiten werden separat geladen, um das initiale Bundle unter dem vorhandenen
  500-kB-Warnbudget zu halten.

## Zustand und Speicherung

`CartService` hält den Zustand mit Angular Signals. `sessionStorage` enthält unter
`sr.cart.v1` ausschließlich `{ version: 1, lines: [{ productId, quantity }] }`.
Namen und Preise werden nicht gespeichert, sondern aus der API bezogen und beim
Öffnen des Warenkorbs neu geladen. Beschädigte, doppelte oder ungültige gespeicherte
Positionen werden verworfen. Die Grenzen sind 99 Stück je Produkt und 200 Artikel
insgesamt. Bei gesperrtem Browser-Speicher funktioniert der Zustand im Arbeitsspeicher;
die Oberfläche weist auf fehlende Reload-Persistenz hin, sobald Speichern fehlschlägt.

Die Tischauswahl wird unter `sr.table.v1` als ID gespeichert und beim Laden gegen die
aktuelle Tischliste geprüft. Ein Entwurf benötigt keine Datenbank. Erst eine
abgeschickte Bestellung wird im Backend gespeichert. Der Zustand gilt für den
Browser-Tab und wird normalerweise beim Schließen des Tabs verworfen; er wird nicht
zwischen Geräten synchronisiert.

Die aktuelle Tischauswahl ist der bestehende öffentliche Beta-Ablauf. Sie stellt
keinen QR-Gastzugang her. QR-/Gastidentität muss mit der nächsten Auth-Phase integriert
werden, damit Kundenbestellungen auch mit eingeschalteter Zugriffskontrolle funktionieren.
Backend-Autorisierung bleibt in dieser Phase unverändert deaktiviert.

Es gibt keine automatische Wiederholung fehlgeschlagener Bestellabgaben. Bei einem
Verbindungsfehler oder Serverfehler könnte die Bestellung bereits gespeichert sein;
die Oberfläche fordert deshalb dazu auf, vor einer erneuten Abgabe beim Service
nachzufragen. Der bestehende Backend-Vertrag hat keinen Idempotenzschlüssel.

## Start und Prüfung

Voraussetzungen und Datenbankstart siehe `README.md`.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Frontend: `http://localhost:4200`; der Angular-Proxy leitet `/api` zum Backend auf
Port 3000 weiter.

```powershell
pnpm nx build gastro-ui
pnpm nx lint gastro-ui
pnpm test:cart
```

Am 05.10.2026 erfolgreich geprüft:

- Angular-Produktionsbuild einschließlich Contracts; initiales Bundle ca. 453 kB.
- Frontend-Lint und Git-Diff ohne Whitespace-Fehler.
- Drei Node-Tests zu Reload-Daten, ungültigem Speicherzustand und Cent-Berechnung.
- Headless-Edge-Browserprüfung des gebauten Frontends mit lokalen API-Fixtures:
  Kategorien, Hinzufügen, Mengenänderung, Entfernen, Gesamtsummen, Reload,
  Tisch-ID gegenüber Tischnummer, fehlgeschlagene und erfolgreiche Bestellabgabe,
  Sendesperre, nicht mehr verfügbare Produkte, ungültiger Speicher, API-Retry,
  fehlender Tisch und mobiles Layout. Keine Browser-Laufzeitfehler.
- Desktop- und Mobil-Screenshots visuell geprüft.

Ein vollständiger Durchlauf gegen ein laufendes Backend mit PostgreSQL wurde nicht
ausgeführt. Admin UI, Live-Bestellübersicht und RBAC-Aktivierung sind die nächste Phase.
