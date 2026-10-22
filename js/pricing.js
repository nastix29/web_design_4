import { EXTRA, LIMITS, PRICING } from './data.js';
import { eachNight, isWeekendNight, nightsBetween, isISODate } from './dates.js';
import { readInteger, upToGuests, nightsWord, formatMoney } from './utils.js';

/** Цена одной ночи: в пятницу и субботу дороже */
export function nightPrice(dome, iso) {
  return isWeekendNight(iso)
    ? Math.round(dome.pricePerNight * (1 + PRICING.weekendMarkup))
    : dome.pricePerNight;
}

/**
 * Проверка и расчёт брони.
 * conflict — занятый период, если даты пересекаются с чужой бронью (проверяет main.js).
 * Возвращает { valid, errors, lines[], total, guests, nights }.
 */
export function calculate(dome, { guestsRaw, checkIn, checkOut, extra, conflict }) {
  const errors = {};

  const guests = readInteger(guestsRaw);
  if (guests.error === 'empty') errors.guests = 'Укажите число гостей';
  else if (guests.error) errors.guests = 'Введите целое число';
  else if (guests.value < LIMITS.guestsMin) errors.guests = 'Минимум 1 гость';
  else if (guests.value > dome.capacity) errors.guests = `В этом куполе ${upToGuests(dome.capacity)}`;

  let nights = 0;
  if (!isISODate(checkIn) || !isISODate(checkOut)) {
    errors.dates = 'Выберите даты заезда и выезда';
  } else {
    nights = nightsBetween(checkIn, checkOut);
    if (nights < LIMITS.nightsMin) errors.dates = 'Минимум 1 ночь';
    else if (nights > LIMITS.nightsMax) errors.dates = `Не больше ${LIMITS.nightsMax} ночей`;
    else if (conflict) errors.dates = `Купол занят ${conflict}. Выберите другие даты`;
  }

  if (Object.keys(errors).length) return { valid: false, errors };

  // Ночи по ценам
  const list = eachNight(checkIn, checkOut);
  const weekend = list.filter(isWeekendNight);
  const weekdayCount = list.length - weekend.length;

  const lines = [];
  let stay = 0;
  if (weekdayCount) {
    const sum = weekdayCount * dome.pricePerNight;
    stay += sum;
    lines.push({ label: `${weekdayCount} ${nightsWord(weekdayCount)} × ${formatMoney(dome.pricePerNight)}`, value: sum });
  }
  if (weekend.length) {
    const price = nightPrice(dome, weekend[0]);
    const sum = weekend.length * price;
    stay += sum;
    lines.push({ label: `${weekend.length} ${nightsWord(weekend.length)} выходных × ${formatMoney(price)}`, value: sum });
  }

  let discount = 0;
  if (nights >= PRICING.longStayNights) {
    discount = Math.round(stay * PRICING.longStayDiscount);
    lines.push({ label: `Скидка от ${PRICING.longStayNights} ночей −${PRICING.longStayDiscount * 100}%`, value: -discount, accent: true });
  }

  if (extra) lines.push({ label: EXTRA.label, value: EXTRA.price });

  const total = stay - discount + (extra ? EXTRA.price : 0);
  return { valid: true, errors, lines, total, guests: guests.value, nights };
}
