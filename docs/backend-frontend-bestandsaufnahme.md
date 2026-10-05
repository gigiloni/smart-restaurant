# Backend- und Frontend-Bestandsaufnahme

Stand: 05.10.2026. Repository: https://github.com/gigiloni/smart-restaurant

## Zugriff und Umfang

GitHub-Lesezugriff wurde mit `git ls-remote --heads origin` bestätigt. Anschließend wurden die Remote-Referenzen mit `git fetch origin --prune` aktualisiert. Es existieren zehn Remote-Branches. Lokal gespeicherte Referenzen auf inzwischen gelöschte Remote-Branches wurden dabei entfernt; auf GitHub wurde nichts gelöscht.

Verglichen wurden Branch-Historien, Backend-/Contracts-Unterschiede und vorhandene Frontend-Dateien. Die relevanten Controller, Services, Authentifizierung, Mitarbeiterverwaltung, Live-Schnittstellen und Frontend-Services wurden im Quellcode geprüft. Dies ist eine Bestandsaufnahme, kein vollständiger Code-Audit. Backend, Datenbank und Tests wurden hierfür nicht gestartet. Schreibzugriff auf GitHub wurde nicht geprüft.

Die lokale Arbeitskopie entspricht `origin/dev/main`, Commit `39e62d36c34a1c774fa7e6f22d01e707f29ead18`.

## Alle aktuellen Remote-Branches

Die Zahlen zählen Commits gegenüber `dev/main`; bei divergierten Branches sind sie keine Aussage über die Menge fehlender Funktionen.

| Branch | Hinter / voraus | Befund |
| --- | --- | --- |
| `dev/main` | 0 / 0 | Aktuelle Integrationsbasis mit Live-Backend, Gastzugang, Mitarbeiterverwaltung und öffentlichem API-Zugriff. Angular-Grundgerüst mit Startseite. |
| `dev/fix/frontend-reconciliation` | 1 / 0 | Bereits integriert; Backend und Contracts entsprechen `dev/main`. |
| `dev/test/backend-test-plan` | 0 / 1 | Zusätzlicher Testplan in `docs/backend-test-plan.md`. |
| `dev/test/backend-test-suite` | 0 / 3 | Unit-/Integrationstests, gemeinsame App-Konfiguration und Einschränkung der Mitarbeiterdaten in Bestellantworten auf öffentliche Felder. Noch nicht in `dev/main`. |
| `feat/login+rbac` | 41 / 0 | Älterer, vollständig in der Historie von `dev/main` enthaltener Auth-/Rollenstand. Keine Login-Oberfläche. |
| `feature/EAD/frontend` | 70 / 0 | Frühes Angular-/PrimeNG-Grundgerüst; in der Historie von `dev/main` enthalten. |
| `feature/EAD/startseite-warenkorb` | 4 / 17 | Speisekarte, Startseite, Warenkorb und HTTP-Services. Backend noch mit aktiver Zugriffskontrolle, vor den neuesten Änderungen auf `dev/main`. |
| `feature/SRE/speisekarte` | 44 / 14 | Älterer Speisekarten-/Warenkorbstand auf älterer Backend-Basis. |
| `feature/SRE/speisekarte-backend-anbindung` | 4 / 23 | Enthält den EAD-Warenkorbstand plus weitere Speisekarten-Anbindung, Produkttypfilter und gemeinsame Product-Typen. Backend-Zugriffskontrolle noch aktiv. |
| `main` | 69 / 0 | Älterer Backend-Grundstand; Live-, Gast- und Mitarbeiterfunktionen fehlen gegenüber `dev/main`. |

## Implementierte Backend-Funktionen auf dev/main

Alle folgenden Fachrouten haben den Präfix `/api`.

| Bereich | Implementierung | Benötigte Oberfläche |
| --- | --- | --- |
| Anmeldung | Better Auth: E-Mail/Passwort, Session-Abfrage, Abmelden, eigenes Passwort ändern. HTTP-only Cookies. Öffentliche Registrierung über die Auth-Routen-Whitelist gesperrt. | Login, Logout, Session-Wiederherstellung, Passwortänderung. |
| Mitarbeiter | Liste, Detail, Anlegen inklusive E-Mail/Passwort, Name/Rolle ändern, Löschen, Login für vorhandene Mitarbeiter anlegen, eigenes Profil. | Admin-Mitarbeiterliste und Formulare, eigenes Profil. |
| Rollen | `ADMIN`, `SERVICE`, `KITCHEN`, `BAR`; Rollenregeln in `AccessService` vorhanden. Schutz vor Löschen/Herabstufen des letzten aktiven Admins im Repository. | Navigation und Aktionen je Rolle; serverseitige Autorisierung wieder aktivieren. |
| Live-Bestellungen | `GET /live/snapshot`, SSE `/live/events?since=<cursor>`, Ereignislog in derselben Transaktion wie Änderungen, Replay, Wiederverbindung und `resync`. | Live-Board mit gemeinsamem Stream und zentralem Zustand. |
| Live-Sichten | Service/Admin sehen alle offenen Tischbesuche samt Bestellungen; Küche sieht FOOD/APPETIZER, Bar DRINK; Gäste ihren eigenen Besuch. Anonyme sehen derzeit ebenfalls alles. | Service-, Küchen-, Bar- und Gastansicht. |
| Bestellungen | Liste mit `take`/`skip`, Detail, Anlegen mit Positionen, Mitarbeiterzuordnung ändern, Löschen offener Bestellungen, `POST /orders/:id/close`. | Bestellliste, Details, Zuordnung, Abschluss. |
| Positionen | Anlegen, Lesen, Status ändern, Löschen. `OPEN → IN_PROGRESS → READY → SERVED`, zusätzlich `REMAKE`; begrenztes Zurücksetzen, Sprünge nur für Getränke. Übergangsregeln als gemeinsame Contracts-Funktionen. | Statusaktionen und erlaubte Ziele je Position. |
| Tischbesuche | Öffnen/Beitreten, offene Besuche auflisten, Details, Tischwechsel, `POST /table-sessions/:id/close`. | Tischübersicht, Umsetzen und Freigeben. |
| Gäste/QR | QR-Zugangsdaten pro Tisch, `POST /viewer/guest` setzt Gast-Cookie; `GET /viewer` liefert Mitarbeiter, Gast oder null. Gastbestellungen im eigenen Tischbesuch. | QR-Einstieg, Besuchskontext, Bestellung und Live-Status. |
| Stammdaten | CRUD für Tische, Produkte, Zutaten; Rezepte/Produkt-Zutaten; Produktabfrage nach IDs. | Admin-Verwaltung und Speisekarte. |
| API-Vertrag | Gemeinsame Zod-Schemas/TypeScript-Typen unter `contracts`, Swagger unter `/api/docs`, Request-Validierung und CORS-Konfiguration. | Services auf gemeinsamen DTOs aufbauen. |

Bestellabschluss bedeutet aktuell, die Bestellung als bezahlt zu markieren. Er setzt voraus, dass alle Positionen `SERVED` sind. Es ist keine Anbindung an einen Zahlungsanbieter. Ein Tischbesuch lässt sich erst schließen, wenn seine Bestellungen geschlossen sind. Geschlossene Bestellungen sind gegen Änderungen geschützt.

## Wichtige Integrationsbefunde

1. **Zugriffskontrolle auf dev/main deaktiviert.** Commit `b584bca` macht Fachrouten standardmäßig öffentlich, bis Login-Seiten existieren. `/employees/me` verlangt weiterhin Login. Mitarbeiter-Controller rufen die Admin-/Rollenregeln aktuell nicht auf. Rollenbasierte Live-Filter für angemeldete Nutzer bestehen weiterhin, ersetzen aber keine Autorisierung. Vor Nutzung eines geschützten Admin-Bereichs müssen Login-Anforderungen und Rollenprüfungen serverseitig wiederhergestellt werden. Die Frontend-Branches haben noch den früheren aktiven Schutz; ein Zusammenführen muss diesen Unterschied bewusst behandeln.

2. **Admin- und Live-UI fehlen in den aktuellen Branches.** Vorhanden sind Startseite, Speisekarte und ein Warenkorbansatz; keine gefundenen Seiten/Services für Anmeldung, Mitarbeiterverwaltung oder SSE-Live-Board.

3. **Frontend-API-Pfade stimmen teilweise nicht.** Auf `feature/SRE/speisekarte-backend-anbindung` sendet `OrderService` an `/orders`; richtig ist `/api/orders`. `ProductService.getProductsById()` sendet ein nacktes Array an `/products/getProductsById`; richtig ist `POST /api/products-by-id` mit `{ ids: [...] }` oder `GET /api/products?ids=...`. Der Angular-Proxy bedient nur `/api`. Die Produktliste und Tischliste verwenden bereits `/api/products` und `/api/tables`.

4. **Warenkorb enthält Testverhalten.** Der Konstruktor der Warenkorbseite überschreibt `sessionStorage.warenkorb` mit `[1,5,10]`. Das muss für einen echten Warenkorb entfernt und durch den tatsächlichen Zustand ersetzt werden. Die bloße Tischauswahl im bestehenden Frontend stellt außerdem noch keinen QR-Gastzugang her.

5. **Test-Branch enthält zusätzliche Änderungen.** `dev/test/backend-test-suite` bringt neben Tests einen Fix gegen die Ausgabe von `authUserId` in eingebetteten Bestell-Mitarbeiterdaten. Diese Änderungen sollten vor dem Frontend-Start geprüft und nach Validierung integriert werden. Vorhandene Tests wurden bei dieser Bestandsaufnahme nicht ausgeführt.

## Vorgeschlagene Reihenfolge für die nächste Implementierungsphase

1. `dev/main` als Backend-Basis verwenden; Test-Branch prüfen und die passenden Frontend-Änderungen aus `feature/SRE/speisekarte-backend-anbindung` übernehmen, statt dessen älteren Backend-Stand zur Basis zu machen.
2. API-Services und Warenkorb korrigieren; gemeinsame Contracts verwenden.
3. Login, Session-Verwaltung und rollenabhängige Navigation ergänzen; parallel Backend-Autorisierung wieder aktivieren und testen.
4. Admin-Mitarbeiterverwaltung einschließlich Kontoanlage und Rollenzuweisung umsetzen.
5. Live-Board für Service, Küche und Bar: Snapshot laden, genau einen SSE-Stream je Tab öffnen, vollständige Entitäten ersetzen, Löschereignisse anwenden und bei `resync` neu laden.
6. Gastfluss mit QR-Zugang, Warenkorb, Bestellabgabe und Live-Verfolgung; anschließend weitere Stammdatenoberflächen.

Diese Analyse führt noch keine Branches zusammen und implementiert noch kein Frontend.
