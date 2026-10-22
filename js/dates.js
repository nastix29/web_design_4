// Работа с датами. Внутри приложения даты — строки 'YYYY-MM-DD' (без времени и часовых поясов).

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const pad = (n) => String(n).padStart(2, '0');

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' → Date (полдень, чтобы не было сдвигов из-за перевода часов) */
export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISO(fromISO(value)) === value;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, days) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

/** Сколько ночей между заездом и выездом */
export function nightsBetween(checkIn, checkOut) {
  return Math.round((fromISO(checkOut) - fromISO(checkIn)) / 86400000);
}

/** Пересекаются ли два периода [заезд, выезд). День выезда одного = день заезда другого — можно. */
export function overlaps(aIn, aOut, bIn, bOut) {
  return aIn < bOut && bIn < aOut;
}

/** Список ночей периода (дата каждой ночи = дата её вечера) */
export function eachNight(checkIn, checkOut) {
  const nights = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) nights.push(d);
  return nights;
}

/** «24 окт» */
export function formatShort(iso) {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** «24 октября» */
export function formatLong(iso) {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

/** «24–26 окт» или «30 окт – 2 ноя» */
export function formatRange(checkIn, checkOut) {
  const a = fromISO(checkIn);
  const b = fromISO(checkOut);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
  }
  return `${formatShort(checkIn)} – ${formatShort(checkOut)}`;
}

/** Пятница и суббота — ночи выходных */
export function isWeekendNight(iso) {
  const day = fromISO(iso).getDay();
  return day === 5 || day === 6;
}
