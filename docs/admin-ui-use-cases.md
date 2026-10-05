# Mitarbeiteroberfläche, Gastbestellungen und Live-Zustand

Stand: 05.10.2026, Branch `dev/main-beta`. Die beschriebenen Login-, Gast-,
Mitarbeiter- und Verwaltungsansichten sowie Bestandsbuchungen sind implementiert.
Das globale Scrollbar-Styling gilt auch für die neuen Formulare und Tabellen.
T02 (eigene Tisch-Stammdatenverwaltung) bleibt außerhalb dieser ersten Oberfläche.

## Architektur

Die Mitarbeiteroberfläche bleibt in `gastro-ui`. Ein eigenes Mitarbeiterlayout
unter `/mitarbeiter` lädt seine Unterrouten erst bei Bedarf. Gastansichten,
Mitarbeiteransichten und Login verwenden dieselben CSS-Tokens, das bestehende
PrimeNG-Preset, Contracts und gemeinsame Auth-/Live-Dienste. Küche, Bar, Service
und Verwaltung erhalten passende Navigation und Aktionen innerhalb dieses Bereichs.

Für das bestehende Projekt sind keine unabhängigen Frontend-Deployments oder
separaten Entwicklungsteams vorgegeben. Ein Microfrontend würde zusätzlich die
gemeinsame Session, Zustandsverteilung, Abhängigkeiten und Auslieferung koordinieren
müssen. Falls später getrennte Deployments nötig werden, lassen sich diese
Feature-Grenzen zuerst in Nx-Libraries beziehungsweise eine zweite App auslagern.

Angular-Routen und ausgeblendete Aktionen helfen bei der Bedienung. Der Backend-
Zugriff muss dieselben Rechte für direkte REST-Anfragen und SSE durchsetzen.

## Bestätigte Entscheidungen

- `ADMIN` ist die höchste Rolle. Es wird keine separate `SUPER_ADMIN`-Rolle ergänzt.
- `ADMIN` darf Mitarbeiter mit allen vorhandenen Rollen anlegen.
- Die Rollen bleiben `ADMIN`, `SERVICE`, `KITCHEN`, `BAR`.
- Küche und Koch entsprechen beide `KITCHEN`.
- Küche sieht relevante offene Bestellungen mit Vorspeisen und Hauptgerichten;
  Bar sieht relevante offene Bestellungen mit Getränken. Beide bearbeiten nur
  Positionen ihrer Station. Es gibt für sie keine allgemeine Übersicht aller Tische.
- Vor Implementierung werden die Use Cases aufgeführt und fachliche Unsicherheiten geklärt.
- Kunden verwenden für Bestellung und Live-Übersicht verpflichtend den Tisch-QR-Code.
  Die Speisekarte bleibt ohne Anmeldung lesbar; ein Demo-Modus ist nicht vorgesehen.
- Zutaten haben eine Einheit (g, ml oder Stück). Bestand sinkt beim verbindlichen
  Bestellen; negative Bestände sind unzulässig. Storno vor Zubereitung bucht zurück;
  tatsächliche Neuzubereitung verbraucht erneut.

## Use Cases

| ID  | Nutzer               | Ablauf und Ergebnis                                                                                                                                                                      | Backend / offene Ergänzung                                                                                                                                                                                                                                             |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Mitarbeiter          | Mit E-Mail und Passwort anmelden; danach die zur Rolle passende Startansicht öffnen. Fehlermeldungen bei ungültigen Zugangsdaten.                                                        | Better Auth: `POST /api/auth/sign-in/email`; anschließend Viewer und Profil laden.                                                                                                                                                                                     |
| A02 | Mitarbeiter          | Seite neu laden oder direkt eine Mitarbeiterroute öffnen: Session prüfen, Rolle vom Server beziehen, passende Navigation zeigen.                                                         | `GET /api/auth/get-session`, `/api/viewer`, `/api/employees/me`.                                                                                                                                                                                                       |
| A03 | Mitarbeiter          | Abmelden oder abgelaufene Session: Mitarbeiterzustand und SSE-Verbindung beenden; zur Anmeldung mit interner Rücksprungroute führen.                                                     | `POST /api/auth/sign-out`; 401-/403-Behandlung im Frontend.                                                                                                                                                                                                            |
| A04 | Mitarbeiter          | Eigenes Passwort mit bisherigem und neuem Passwort ändern.                                                                                                                               | `POST /api/auth/change-password`; 12–128 Zeichen entsprechend Backend-Konfiguration.                                                                                                                                                                                   |
| G01 | Gast                 | Speisekarte lesen, Warenkorb im Browser führen und einen Tischbesuch betreten.                                                                                                           | Produkte öffentlich lesbar; QR-Einstieg über `POST /api/viewer/guest` setzt den Gast-Cookie. QR-Zugang ist für Bestellung und Live-Übersicht verpflichtend.                                                                                                            |
| G02 | Gast                 | Bestellung verbindlich abgeben und anschließend Bestellnummer, Positionen, Summe und Status des eigenen Tischbesuchs sehen. Weitere Bestellungen desselben Besuchs erscheinen ebenfalls. | `POST /api/orders`, `GET /api/live/snapshot` und SSE. Gastdaten sind an die Tischsession gebunden, nicht nur an eine frei eingegebene Tisch-ID.                                                                                                                        |
| G03 | Gast                 | Tischwechsel live sehen; nach Freigabe des Tisches „Besuch beendet“ anzeigen und den Zugriff auf den nächsten Besuch verhindern.                                                         | `session.moved` und `session.closed`; Gast-Cookie ist nach Session-Schließung ungültig.                                                                                                                                                                                |
| S01 | SERVICE, ADMIN       | Alle aktiven Tischbesuche und Bestellungen live sehen; nach Tisch und Bestell-/Positionsstatus filtern und Details öffnen.                                                               | Snapshot und SSE liefern alle offenen Tischsessions einschließlich bereits bezahlter Bestellungen in diesen Sessions.                                                                                                                                                  |
| S02 | SERVICE, ADMIN       | Für einen Tisch eine Bestellung aufnehmen, Positionen hinzufügen/entfernen und eine offene Bestellung einem Mitarbeiter zuordnen beziehungsweise die Zuordnung aufheben.                 | Orders-/Order-Items-REST vorhanden. SERVICE darf unzugeordnete beziehungsweise eigene Bestellungen verändern; ADMIN alle. Die Zugriffsfunktionen sind innerhalb der gesperrten Bestellung aktiv.                                                                       |
| S03 | SERVICE, ADMIN       | Fertige Positionen als serviert markieren; bei Reklamation Neuzubereitung anfordern; zulässige Korrekturen anbieten.                                                                     | `PATCH /api/orders/:orderId/items/:id`; Statusfolge plus Rollenrecht bestimmen erlaubte Aktionen.                                                                                                                                                                      |
| S04 | SERVICE, ADMIN       | Bestellung als bezahlt abschließen; Tischbesuch auf einen freien Tisch verschieben oder nach Bezahlung aller Bestellungen beenden.                                                       | Order-/Table-Session-Endpunkte vorhanden. Bezahlen erst nach `SERVED` für alle Positionen; Freigabe erst nach Schließung aller Bestellungen. Das ist kein Online-Zahlungsanbieter.                                                                                     |
| S05 | SERVICE, ADMIN       | Offene Bestellung oder einzelne Position stornieren; Konflikte mit inzwischen verändertem Zustand anzeigen.                                                                              | Löschen ist vorhanden; bezahlte Bestellungen bleiben unveränderbar. Rückbuchung erfolgt nur vor begonnener Zubereitung.                                                                                                                                                |
| K01 | KITCHEN              | Offene Bestellungen mit Vorspeisen/Hauptgerichten als Live-Arbeitsliste sehen, gruppiert nach Tisch und Bestellung.                                                                      | Bestehendes Backend filtert Snapshot und Events auf `APPETIZER` / `FOOD`.                                                                                                                                                                                              |
| K02 | KITCHEN              | Zubereitung beginnen, als fertig markieren und Neuzubereitung bearbeiten; nur erlaubte Statuswechsel anbieten.                                                                           | Vorhandene Statusfolge `OPEN → IN_PROGRESS → READY`; Rückschritte und `REMAKE → IN_PROGRESS` entsprechend Contracts. Küche darf nicht als serviert markieren.                                                                                                          |
| B01 | BAR                  | Live-Arbeitsliste und Vorbereitung ausschließlich für Getränke; zulässige Vorwärtssprünge für Getränke anbieten.                                                                         | Bestehendes Backend filtert auf `DRINK`; Übergänge verwenden dieselben Contracts. Servieren bleibt SERVICE/ADMIN.                                                                                                                                                      |
| M01 | ADMIN                | Mitarbeiterliste lesen; Mitarbeiter mit Vorname, Nachname, Rolle, E-Mail und Startpasswort anlegen.                                                                                      | `GET/POST /api/employees`; alle vier Rollen verfügbar; E-Mail eindeutig, Passwort 12–128 Zeichen.                                                                                                                                                                      |
| M02 | ADMIN                | Namen und Rolle ändern; bestehendem Mitarbeiter ohne Login ein Konto zuweisen; Mitarbeiter löschen, soweit erlaubt.                                                                      | `PATCH/DELETE /api/employees/:id`, `POST /api/employees/:id/account`. Letzter aktiver ADMIN darf nicht gelöscht/herabgestuft werden; Mitarbeiter mit Bestellreferenzen sind nicht löschbar. Es gibt bislang keine separate Deaktivierung oder Admin-Passwortreset-API. |
| P01 | ADMIN                | Produkte lesen, erstellen und bearbeiten: Name, Beschreibung, Preis, Kategorie und Rezept mit Zutatenmengen.                                                                             | `GET/POST/PATCH /api/products`; Rezept wird bei Übermittlung vollständig ersetzt, jede Zutat darf nur einmal vorkommen. Neue Bilder verwenden vorerst den vorhandenen Platzhalter.                                                                                     |
| P02 | ADMIN                | Produkt löschen und verständlich anzeigen, wenn Bestellungen es weiterhin referenzieren.                                                                                                 | `DELETE /api/products/:id`; Referenzen verhindern das Löschen. Archivierung und Bild-Upload existieren derzeit nicht.                                                                                                                                                  |
| I01 | ADMIN                | Zutaten lesen, erstellen, umbenennen und löschen, soweit kein Rezept sie verwendet.                                                                                                      | `GET/POST/PATCH/DELETE /api/ingredients` vorhanden.                                                                                                                                                                                                                    |
| I02 | ADMIN                | Zutatenbestand und Einheit erfassen, Wareneingang beziehungsweise Korrektur durchführen; aktuellen Bestand anzeigen.                                                                     | `Ingredient` enthält Einheit und Bestand; ADMIN ändert den Bestand mit optionaler Prüfung des erwarteten alten Bestands (`expectedStock`).                                                                                                                             |
| I03 | Bestellprozess       | Rezeptmengen pro bestellter Portion vom Bestand abziehen und fehlende Zutaten konsistent behandeln. Storno/Neuzubereitung ändern Bestand nach den bestätigten Regeln.                    | Atomare Buchungen mit gesperrten Zutaten, Buchungshistorie, Rückbuchung vor Zubereitung und zusätzlichem Verbrauch bei tatsächlicher Neuzubereitung.                                                                                                                   |
| L01 | Gast und Mitarbeiter | Live-Zustand in allen angemeldeten Ansichten gemeinsam nutzen; Verbindungszustand anzeigen, ohne für jedes Panel eine zusätzliche Verbindung zu öffnen.                                  | Snapshot plus eine `EventSource`-Verbindung pro laufender App/Identität. Berechtigte Daten bleiben durch Backend-Scope begrenzt.                                                                                                                                       |
| L02 | Gast und Mitarbeiter | Nach Verbindungsabbruch fehlende Änderungen nachholen; bei `resync` frischen Snapshot laden; Rolle/Identität gewechselt: bisherigen Zustand verwerfen und neu verbinden.                 | Cursor, `Last-Event-ID`, `ready`, `resync` und rollenbezogene Filter sind vorhanden. Ausgefilterte Ereignisse können ID-Lücken erzeugen; das Frontend darf daraus keinen Fehler ableiten.                                                                              |
| L03 | ADMIN                | Änderungen am Bestand auch in anderen geöffneten Verwaltungsansichten zeitnah sehen.                                                                                                     | `inventory.updated` liefert Zutaten- und Bestandsänderungen ausschließlich an ADMIN; der Snapshot enthält für ADMIN die aktuellen Zutaten.                                                                                                                             |
| T01 | ADMIN / SERVICE      | Tisch-QR-Inhalt für den Gastzugang abrufen.                                                                                                                                              | `GET /api/tables/:id/qr-code` ist auf SERVICE/ADMIN begrenzt; die Oberfläche erzeugt einen herunterladbaren QR-Code für den Tischzugang.                                                                                                                               |
| T02 | ADMIN                | Optional Tische erstellen, Tischnummer/Sitzplätze ändern und unreferenzierte Tische löschen.                                                                                             | Table-CRUD ist vorhanden, aber nicht ausdrücklich als erste Admin-Ansicht beauftragt. Kann nach den Kernansichten ergänzt werden.                                                                                                                                      |

## Session und Zugriffsschutz

Auth- und Gast-Cookies bleiben die serverseitig geprüfte Identität. Passwort und
Session-Token gehören nicht in LocalStorage oder SessionStorage. Der bestehende
Warenkorb speichert dort weiterhin nur fachlichen Warenkorbzustand im aktuellen Tab.
Viewer/Rolle werden im Arbeitsspeicher gehalten und nach Neuladen vom Backend bezogen.

HTTP-Anfragen und SSE senden die Cookies mit. Ein 401 führt zur passenden erneuten
Anmeldung beziehungsweise zum QR-Einstieg; ein 403 zeigt fehlende Berechtigung. Beim
Logout, Identitätswechsel, Rollenwechsel oder Besuchsende werden berechtigte Daten
und die bisherige Live-Verbindung verworfen. Ein Verbindungsfehler allein wird nicht
mit einem abgelaufenen Login gleichgesetzt: der Viewer muss geprüft werden.

`AuthGuard` schützt Mitarbeiter, Zutaten, Tischbesuche, Bestellungen und SSE.
Rollen werden aus dem Backend bezogen; `AccessService` prüft Besitzer und Statusrechte
innerhalb der gesperrten Bestellung. REST und SSE begrenzen Gäste auf ihren
Tischbesuch und Küche/Bar auf die relevanten Positionen. Die Speisekarte und
Tisch-Stammdaten bleiben öffentlich lesbar; die freie Tischauswahl erteilt keinen
Gastzugang. Bestandsdaten werden nur an ADMIN geliefert.

Ein QR-Scan eröffnet den Zugang einmalig. Neuladen stellt ihn über das HttpOnly-
Cookie wieder her. Absenden leert nur den Warenkorb; Bestellungen werden aus der
Datenbank geladen und bleiben einschließlich „Bezahlt“ bis zum Ende des Tischbesuchs
sichtbar. Das Gast-Cookie gilt höchstens 12 Stunden und wird durch erneuten Scan
erneuert. Beim Freigeben des Tischbesuchs endet es sofort.

## Festgelegte Gast- und Bestandsregeln

1. Gastbestellungen und Live-Übersicht benötigen den Tisch-QR-Code. Der Gastzugang
   gilt für den aktuellen Tischbesuch; freie Tischauswahl allein erteilt keinen Zugriff.
2. Pro Zutat wird g, ml oder Stück festgelegt. Rezeptmenge und Bestand verwenden
   dieselbe Einheit. Fehlender Bestand verhindert die gesamte Bestellung; es werden
   keine negativen Bestände und keine teilweise angelegten Bestellungen erzeugt.
3. Die Bestandsbuchung erfolgt beim verbindlichen Bestellen, auch für später vom
   Service hinzugefügte Positionen. Storno vor Zubereitung bucht zurück, nach
   begonnener Zubereitung nicht. Bereits verbrauchte Zutaten bleiben verbraucht.
4. Zusätzlicher REMAKE-Verbrauch erfolgt bei `REMAKE → IN_PROGRESS`, also beim
   tatsächlichen Beginn der Ersatzportion. Die bloße Reklamation verbraucht noch
   nichts: der Gast kann die Position anschließend akzeptieren (`REMAKE → SERVED`).
5. Die gebuchten Zutatenmengen werden zur Position festgehalten, sodass spätere
   Rezeptänderungen keine falsche Rückbuchung verursachen. Statuskorrekturen und
   wiederholte Buchungen für denselben Vorgang dürfen den Bestand nicht doppelt ändern.

Die technischen Formular-, Layout- und Routingdetails können auf dieser Grundlage
ohne zusätzliche fachliche Vorgaben umgesetzt werden. Die abgefragten Entscheidungen
wurden vom Nutzer bestätigt.

## Umsetzung und Prüfung

1. Login-/Viewer-Service, Mitarbeiterlayout und Routenschutz; Backend-Rechte gemeinsam
   mit Gastzugang aktivieren, um die bisherigen 401-Probleme nicht erneut auszulösen.
2. Gemeinsamer Snapshot-/SSE-Zustand; Gastübersicht, Serviceübersicht, Küche und Bar.
3. Mitarbeiterverwaltung sowie Produkt-/Rezept-/Zutatenverwaltung.
4. Bestandserweiterung mit Migration, atomaren Buchungen und Live-Aktualisierung nach
   den bestätigten Bestandsregeln.

Für diese Funktionen sind echte Integrationsprüfungen nötig: Login/Logout/Reload,
direkte unberechtigte REST-Anfragen, Gast-Isolation zwischen Tischbesuchen,
alle Rollen-/Statuskombinationen, SSE-Reconnect/Resync/Rollenwechsel, parallele
Bestellungen und Bestand sowie Konflikte bei gelöschten/referenzierten Datensätzen.
Reine Browser-Fixtures reichen nicht, um Backend-RBAC oder Bestand zu bestätigen.

## Geprüfte Grundlagen

- `backend/prisma/schema.prisma`: Rollen, Tischsessions, Zutaten und Rezeptmengen.
- `backend/src/auth/access.service.ts`, `access-metadata.ts`, `auth.guard.ts`:
  aktivierte Rechte und Anforderungen.
- `backend/src/main.ts`, `auth/auth.service.ts`, `viewer/viewer.controller.ts`:
  vorhandene Login-Endpunkte und Gastzugang.
- Controller/Services unter `employees`, `products`, `ingredients`, `tables`,
  `table-sessions`, `orders`, `order-items`: vorhandene Operationen und Konfliktfälle.
- `backend/src/live/live-scope.ts`, `live-stream.ts`, `live.service.ts` sowie
  `contracts/src/lib/live` / `order-events`: Live-Protokoll und Sichtbarkeit.
- `contracts/src/lib/order-items/order-item-transitions.ts`: erlaubte Statusfolge.
- [Angular: Routen und Lazy Loading](https://angular.dev/guide/routing/define-routes).
- [Angular: Guards ersetzen keine Backend-Autorisierung](https://angular.dev/guide/routing/route-guards).
- [MDN: Scrollbar-Farben und Fallback](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-color).
