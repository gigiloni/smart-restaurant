# Frontend-Design und Gerichtsbilder

Stand: 05.10.2026, Branch `dev/main-beta`.

## Vergleich mit den Frontend-Branches des Teams

Die Basis stammt aus `feature/EAD/startseite-warenkorb` und
`feature/SRE/speisekarte-backend-anbindung`. Dort gab es Startseiten-Styles,
die globalen Schrift-/Farbdefinitionen und das PrimeNG-Theme. Die CSS-Dateien
für Speisekarte und Warenkorb waren weitgehend leer. Bilder lagen bereits unter
`apps/gastro-ui/public/dishes`, wurden aber nicht zuverlässig anhand der tatsächlichen
Produktnamen zugeordnet; die Warenkorbansicht enthielt außerdem feste Zutaten.

Die erste Beta ergänzte funktionsfähige Layouts und einige direkt eingetragene
Farben. Die jetzige Überarbeitung ersetzt diese zusätzlichen Farben durch Tokens.

Beibehaltene Grundlagen:

| Token / Grundlage              | Wert                                 |
| ------------------------------ | ------------------------------------ |
| `--background`                 | `#212121`                            |
| `--light-accent`               | `#D9D9D9`                            |
| `--green-accent`               | `#02702C`                            |
| `--red-accent`                 | `#700204`                            |
| `--text`                       | `#FFFFFF`                            |
| Überschriften / Marken-Schrift | Cormorant Infant / Passions Conflict |
| Marke                          | Bestehende `Logo.svg` und `hero.jpg` |
| PrimeNG-Preset                 | `GastroTheme` auf Aura               |

Die gleichen Schriften werden jetzt als lokale WOFF2-Dateien unter `public/fonts`
ausgeliefert. Es sind die bisherigen Familien und Gewichtungen; ihre SIL-OFL-Lizenzen
sind beigefügt. Die deutsche/italienische Latin-Zeichenabdeckung bleibt vorhanden.
Die Oberfläche benötigt dadurch beim Aufruf keine Verbindung zu Google Fonts.

Zusätzliche Tokens in `apps/gastro-ui/src/styles.css` definieren Oberflächen,
Rahmen, gedämpften Text, Rundungen und Schatten. Farben werden mit `color-mix`
aus den vorhandenen Tokens abgeleitet. Komponenten referenzieren diese Tokens;
zusätzliche eigene Hex-Farben wurden entfernt. Die ursprünglichen Logo-Verlaufsfarben
sind weiterhin vorhanden. Das Layout muss sich unterscheiden, um die neuen Funktionen
darzustellen; die gestalterische Grundlage bleibt dieselbe.

## Überarbeitete Oberfläche

- PrimeNG-Warenkorb-Badge zeigt die Artikelanzahl einschließlich Mengen.
- Gerichtskarten mit Fotos, Preisen, Beschreibungen, aufklappbaren Rezeptzutaten
  und einer Markierung bereits ausgewählter Artikel.
- Kategorie-Tabs bleiben in einer festen Ansichtsfläche. Produkte scrollen innerhalb
  dieser Fläche, sodass Kategorien mit unterschiedlich vielen Produkten die Tabs und
  die seitliche Zusammenfassung nicht verschieben. Die Karten verwenden dieselben
  Rasterbreiten und Bildproportionen.
- Die drei Tabs sind gleich breit und mittig beschriftet. Die aktive Kategorie
  verwendet den bestehenden roten Akzent als Hintergrund.
- Die Tischauswahl verwendet PrimeNG Select mit Tastaturbedienung, Ladezustand
  und einem Dropdown im bestehenden dunklen Design. Das `GastroTheme` ergänzt
  dafür Select-Tokens aus den vorhandenen CSS-Variablen. Als Wert wird die
  Datenbank-ID gespeichert; angezeigt wird weiterhin die Tischnummer.
- Rechts steht auf Desktop eine Bestellzusammenfassung mit Positionen, Summen und
  Tisch. Auf der Speisekarte führt sie zur Prüfung im Warenkorb; dort wird die
  Bestellung verbindlich abgeschickt.
- Nach erfolgreicher Abgabe zeigt dasselbe Panel Bestellnummer, Tisch und bestellte
  Positionen. Diese Bestätigung bleibt während der Navigation im laufenden Frontend
  erhalten. Sie ist keine Live-Verfolgung und keine Zahlungsquittung.
- Mobil gibt es auf der Speisekarte eine kompakte Warenkorbleiste mit Anzahl und
  Summe. Im Warenkorb folgt die Zusammenfassung unter den Artikelkarten.
- Lade- und Fehlerzustände, Tastaturfokus und reduzierte Bewegung bleiben berücksichtigt.
- Scrollbars verwenden globale Tokens für Spur und Griff in `src/styles.css`.
  Das gilt automatisch für die Seite, scrollende Panels, Tabellen und PrimeNG-
  Dropdowns, auch bei horizontalem Überlauf. Standard-CSS und ein WebKit-Fallback
  decken verschiedene Browser ab; im Kontrastmodus werden Systemfarben verwendet.

## Bilder speichern

Für diese Beta sind Fotos lokale Frontend-Assets unter
`apps/gastro-ui/public/dishes`. Sie werden mit dem Frontend ausgeliefert. Die Zuordnung
in `services/product-images.ts` erfolgt anhand normalisierter Produktnamen, weil
Datenbank-IDs je Installation variieren können. Für alle 20 Seed-Produkte ist ein Foto
vorhanden; unbekannte neue Produkte und Ladefehler erhalten eine neutrale Illustration.
Die bisherigen Bilddateien wurden erhalten.

Für eine später vom Admin bearbeitbare Speisekarte empfiehlt sich:

1. Bilddateien in einem Datei-/Objektspeicher mit HTTP-Auslieferung ablegen.
2. Beim Produkt in der Datenbank Bild-URL oder Asset-Schlüssel und gegebenenfalls
   Urheber-/Lizenzinformationen speichern.
3. Die URL über die gemeinsamen Contracts ausliefern, statt Produktnamen zuzuordnen.

Binäre Fotos müssen dafür nicht in der relationalen Produktdatenbank gespeichert
werden. Ein Frontend-Asset ist für die feste Demo einfach; bei Admin-Uploads würde
es sonst für jedes neue Bild ein Frontend-Deployment erfordern.

Zutaten benötigen für die normale Speisekarte keine eigenen Bilder. Namen aus der
Rezept-API reichen dafür aus. Ein späterer eigener Zutatenkatalog kann Fotos erhalten,
falls sie für dessen Nutzer einen konkreten Zweck erfüllen.

## Quellen und Lizenzen

Die neuen Fotos stammen von Wikimedia Commons. Ihre einzelnen Lizenzen, Urheber,
Originalseiten und Download-Adressen stehen in
`apps/gastro-ui/public/dishes/image-credits.json`. Eine eigene Seite und Links
innerhalb der Oberfläche wurden auf Wunsch entfernt; die Quellen-Datei bleibt
als Asset unter `/dishes/image-credits.json` verfügbar. Es wurden CC BY, CC BY-SA, CC0 und als Public Domain
ausgewiesene Fotos ausgewählt. Die Bilddateien behalten die jeweilige Lizenz;
Vorschaubilder und der Ausschnitt bei der Darstellung sind vermerkt. Die übrige
Anwendung wird dadurch nicht unter die Bildlizenz gestellt.

Die Abbildungen sind Serviervorschläge, keine Fotos tatsächlich servierter Teller.
Für ein reales Restaurant sollten sie durch eigene Aufnahmen ersetzt werden.

Wikimedia-Anleitung zur Wiederverwendung:
https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia

## Prüfung

Produktionsbuild, Frontend-Lint und fünf Tests mit `pnpm test:frontend` wurden erfolgreich
ausgeführt. Der initiale Build umfasst 505,81 kB und überschreitet die bestehende
Warnschwelle von 500 kB um 5,81 kB; die Budget-Grenzen wurden nicht geändert.
Die Tests prüfen Warenkorbzustand, Cent-Berechnung sowie Bilder und
Quellen für alle Seed-Produkte. Zusätzlich wurde das gebaute Frontend in Chrome mit
lokalen API-Fixtures erfolgreich geprüft: bestehender
Bestellfluss, Kategorie-Positionen, Fotos, Badge, seitliche Bestätigung, mobile
Darstellung, PrimeNG-Tischauswahl und entfernte Bildnachweis-Links. Die Maße und Positionen der Kategoriefläche und der
Seitenleiste bleiben beim Umschalten gleich; es gab keine Browser-Laufzeitfehler.
Desktop- und Mobil-Screenshots wurden visuell geprüft.
Das globale Scrollbar-Styling wurde zusätzlich in Chrome an Viewport,
Speisekarten-Panel, PrimeNG-Dropdown und einem dynamisch eingefügten Container
mit horizontalem und vertikalem Überlauf geprüft. Scrollen, mobile Breite und
Systemfarben im Kontrastmodus funktionieren; es gab keine Laufzeitfehler.
Ein Backend-/PostgreSQL-Durchlauf gehört weiterhin
zur späteren Integrationsprüfung.
