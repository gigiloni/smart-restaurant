// Local demo assets, keyed by name because database IDs can vary.
const images = [
  {
    name: 'Bruschetta al Pomodoro',
    src: '/dishes/bruschetta.jpg',
  },
  {
    name: 'Caprese di Bufala',
    src: '/dishes/caprese.jpg',
  },
  {
    name: 'Prosciutto e Melone',
    src: '/dishes/prosciutto-melone.jpg',
  },
  {
    name: 'Carpaccio di Bresaola',
    src: '/dishes/bresaola.jpg',
  },
  {
    name: 'Spaghetti alla Carbonara',
    src: '/dishes/carbonara.jpg',
  },
  {
    name: 'Spaghetti alle Vongole',
    src: '/dishes/vongole.jpg',
  },
  {
    name: 'Tagliatelle al Ragu',
    src: '/dishes/tagliatelle-ragu.jpg',
  },
  {
    name: 'Risotto allo Zafferano',
    src: '/dishes/risotto.jpg',
  },
  {
    name: 'Pizza Margherita',
    src: '/dishes/margherita.jpg',
  },
  {
    name: 'Pizza Diavola',
    src: '/dishes/diavola.jpg',
  },
  {
    name: 'Melanzane alla Parmigiana',
    src: '/dishes/parmigiana.jpg',
  },
  {
    name: 'Saltimbocca alla Romana',
    src: '/dishes/saltimbocca.jpg',
  },
  {
    name: 'Tiramisu',
    src: '/dishes/tiramisu.jpg',
  },
  {
    name: 'Panna Cotta',
    src: '/dishes/panna-cotta-plain.jpg',
  },
  {
    name: 'Acqua Minerale 0,75L',
    src: '/dishes/water.jpg',
  },
  {
    name: 'Chianti Classico',
    src: '/dishes/chianti.jpg',
  },
  {
    name: 'Aperol Spritz',
    src: '/dishes/spritz.jpg',
  },
  {
    name: 'Birra Moretti 0,33L',
    src: '/dishes/beer.jpg',
  },
  {
    name: 'Espresso',
    src: '/dishes/espresso.jpg',
  },
  {
    name: 'Limonata',
    src: '/dishes/lemonade.jpg',
  },
];
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const aliases: Record<string, string> = {
  bruschetta: 'bruschetta al pomodoro',
  tagliatelle: 'tagliatelle al ragu',
  wasser: 'acqua minerale 0,75l',
};
export function imageForProduct(name: string): string {
  const key = normalize(name);
  return (
    images.find((image) => normalize(image.name) === (aliases[key] ?? key))?.src ??
    '/dishes/placeholder.svg'
  );
}
