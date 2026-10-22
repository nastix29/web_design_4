// Фаза луны без всяких API — по формуле синодического месяца.
// Точка отсчёта: новолуние 6 января 2000 года, 18:14 UTC.

import { fromISO, eachNight, formatLong } from './dates.js';

const SYNODIC_MONTH = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Возраст луны в днях (0 — новолуние, ~14.8 — полнолуние) на вечер даты */
export function moonAge(iso) {
  const evening = fromISO(iso);
  evening.setHours(22);
  const days = (evening.getTime() - KNOWN_NEW_MOON) / 86400000;
  return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
}

/** Освещённость диска: 0 — тёмная ночь, 1 — полная луна */
export function illumination(iso) {
  return (1 - Math.cos((2 * Math.PI * moonAge(iso)) / SYNODIC_MONTH)) / 2;
}

const PHASES = [
  { max: 1.85, emoji: '🌑', name: 'новолуние' },
  { max: 5.54, emoji: '🌒', name: 'растущий серп' },
  { max: 9.23, emoji: '🌓', name: 'первая четверть' },
  { max: 12.92, emoji: '🌔', name: 'растущая луна' },
  { max: 16.61, emoji: '🌕', name: 'полнолуние' },
  { max: 20.30, emoji: '🌖', name: 'убывающая луна' },
  { max: 23.99, emoji: '🌗', name: 'последняя четверть' },
  { max: 27.68, emoji: '🌘', name: 'убывающий серп' },
  { max: 30, emoji: '🌑', name: 'новолуние' },
];

export function phase(iso) {
  const age = moonAge(iso);
  return PHASES.find((p) => age < p.max);
}

/** Тёмная ночь — луны почти нет, звёзд видно больше всего */
export function isDarkNight(iso) {
  return illumination(iso) < 0.12;
}

/** День точного новолуния или полнолуния — для значка в календаре */
export function moonMarker(iso) {
  const age = moonAge(iso);
  if (age < 0.5 || age > SYNODIC_MONTH - 0.5) return '🌑';
  if (Math.abs(age - SYNODIC_MONTH / 2) < 0.5) return '🌕';
  return '';
}

/** Прогноз неба на период: значок, заголовок и короткий совет */
export function skyForecast(checkIn, checkOut) {
  const nights = eachNight(checkIn, checkOut);
  if (nights.length === 0) return null;

  const avg = nights.reduce((sum, n) => sum + illumination(n), 0) / nights.length;
  const darkest = nights.reduce((best, n) => (illumination(n) < illumination(best) ? n : best), nights[0]);
  const middle = phase(nights[Math.floor(nights.length / 2)]);

  if (avg < 0.15) {
    return { emoji: middle.emoji, level: 'great', title: 'Тёмные ночи', text: 'Луны почти не будет — Млечный путь видно невооружённым глазом.' };
  }
  if (avg < 0.5) {
    return { emoji: middle.emoji, level: 'good', title: 'Хорошее небо', text: `Самая тёмная ночь — ${formatLong(darkest)}.` };
  }
  return { emoji: middle.emoji, level: 'bright', title: 'Яркая луна', text: 'Звёзд будет меньше, зато светло гулять у озера.' };
}
