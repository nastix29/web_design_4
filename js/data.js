// Все купола глэмпинга. Карта и список строятся по этому одному массиву.
// x, y — положение на схеме в процентах от ширины и высоты.
// busy — когда купол занят другими гостями (учебные данные):
//        пары [с какого дня, по какой день выезда], считая от сегодняшнего дня.

export const DOMES = [
  {
    id: 'd1',
    number: 1,
    photo: '1510312305653-8ed496efae75',
    name: 'Полярная',
    description: 'Самый высокий купол на склоне. Над кроватью — прозрачный свод, утром в окно заглядывают вершины.',
    capacity: 2,
    pricePerNight: 6900,
    view: 'горы',
    telescope: true,
    x: 17,
    y: 24,
    busy: [[12, 15]],
  },
  {
    id: 'd2',
    number: 2,
    photo: '1590092794015-bce5431c83f4',
    name: 'Кассиопея',
    description: 'Просторный купол для компании: две спальные зоны, печка и терраса для ночных разговоров.',
    capacity: 4,
    pricePerNight: 9800,
    view: 'горы',
    telescope: true,
    x: 37,
    y: 15,
    busy: [[0, 5], [9, 13], [20, 26]],
  },
  {
    id: 'd3',
    number: 3,
    photo: '1672659878782-5862ce1d70d1',
    name: 'Млечный путь',
    description: 'Купол у самой воды. В безветренную ночь звёзды отражаются в озере, как во втором небе.',
    capacity: 2,
    pricePerNight: 7500,
    view: 'озеро',
    telescope: false,
    x: 40,
    y: 68,
    busy: [[3, 6]],
  },
  {
    id: 'd4',
    number: 4,
    photo: '1762255097010-49e99eadd616',
    name: 'Орион',
    description: 'Самый большой купол: три спальни под общим сводом, кухня и панорама на хребет.',
    capacity: 6,
    pricePerNight: 13500,
    view: 'горы',
    telescope: false,
    x: 79,
    y: 42,
    busy: [[0, 3], [5, 12], [16, 19]],
  },
  {
    id: 'd5',
    number: 5,
    photo: '1554968756-e41553ee4eb9',
    name: 'Лира',
    description: 'Тихий купол над озером с гамаком на террасе. Отсюда лучше всего видно рассвет.',
    capacity: 3,
    pricePerNight: 8200,
    view: 'озеро',
    telescope: false,
    x: 25,
    y: 50,
    busy: [[18, 21]],
  },
  {
    id: 'd6',
    number: 6,
    photo: '1717308086506-4cbc0f4624ed',
    name: 'Андромеда',
    description: 'Купол с собственным телескопом и купелью на берегу. Для долгих ночей и больших созвездий.',
    capacity: 4,
    pricePerNight: 11200,
    view: 'озеро',
    telescope: true,
    x: 54,
    y: 86,
    busy: [[7, 9], [25, 28]],
  },
  {
    id: 'd7',
    number: 7,
    photo: '1506485406650-ec595b282037',
    name: 'Вега',
    description: 'Маленький купол в кедровом лесу. Пахнет смолой, слышно ручей, и совсем нет света от посёлка.',
    capacity: 2,
    pricePerNight: 5900,
    view: 'лес',
    telescope: false,
    x: 90,
    y: 60,
    busy: [],
  },
  {
    id: 'd8',
    number: 8,
    photo: '1649519605812-400ba1767985',
    name: 'Персей',
    description: 'Купол на тропе к обсерватории. Телескоп, звёздная карта на потолке и пледы на пятерых.',
    capacity: 5,
    pricePerNight: 12400,
    view: 'горы',
    telescope: true,
    x: 60,
    y: 27,
    busy: [[1, 3], [14, 17]],
  },
];

// Фото — Unsplash (бесплатная лицензия Unsplash). Ссылка строится по id снимка.
export function photoUrl(photoId, width = 1200) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=75`;
}

export const HERO_PHOTO = '1543894597-1bf562842844';
export const EMPTY_PHOTO = '1496947850313-7743325fa58c';

// Атмосферные снимки для галереи в карточке купола
const AMBIENT = [
  '1585866832779-67ba6777c9ec', // костёр под звёздами — Daniel Lerman
  '1504851149312-7a075b496cc7', // лагерь и звездопад — Jonathan Forage
  HERO_PHOTO,
  EMPTY_PHOTO,
];

/** Галерея купола: его фото + два атмосферных */
export function galleryOf(dome) {
  return [dome.photo, AMBIENT[dome.number % AMBIENT.length], AMBIENT[(dome.number + 1) % AMBIENT.length]];
}

export const DOMES_BY_ID = new Map(DOMES.map((dome) => [dome.id, dome]));

// Дополнительная услуга — одна на всю бронь
export const EXTRA = {
  label: 'Ночная экскурсия к телескопу',
  price: 1500,
};

// Цены: ночь с пятницы и с субботы дороже, длинное проживание — со скидкой
export const PRICING = {
  weekendMarkup: 0.2,
  longStayNights: 7,
  longStayDiscount: 0.1,
};

export const LIMITS = {
  nightsMin: 1,
  nightsMax: 30,
  guestsMin: 1,
  daysAhead: 365, // бронировать можно на год вперёд
};

const prices = DOMES.map((d) => d.pricePerNight);
export const PRICE_MIN = Math.floor(Math.min(...prices) / 500) * 500;
export const PRICE_MAX = Math.ceil(Math.max(...prices) / 500) * 500;
export const CAPACITY_MAX = Math.max(...DOMES.map((d) => d.capacity));
