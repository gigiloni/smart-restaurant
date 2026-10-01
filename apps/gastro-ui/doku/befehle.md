# Befehle

## Pages

nx g @nx/angular:component apps/gastro-ui/src/app/pages/speisekarte/speisekarte --skipTests

## Components

nx g @nx/angular:component apps/gastro-ui/src/app/components/speisekarte/kategorie/vorspeisen/vorspeisen --skipTests

nx g @nx/angular:component apps/gastro-ui/src/app/components/speisekarte/kategorie/hauptgaenge/hauptgaenge --skipTests

nx g @nx/angular:component apps/gastro-ui/src/app/components/speisekarte/kategorie/getraenke/getraenke --skipTests

## Prettier

npx prettier --write "apps/gastro-ui/**/*.{ts,html,scss,json}"
