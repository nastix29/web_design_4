import { DOMES_BY_ID, LIMITS } from './data.js';
import { isISODate, nightsBetween, overlaps } from './dates.js';

// Один ключ приложения. Остальной localStorage не трогаем.
// v2 — брони с датами (v1 хранила только число ночей и больше не читается).
const STORAGE_KEY = 'zvezdnaya-noch:v2';

/** Проверка одной брони из сохранения. Битую запись отбрасываем. */
function isValidBooking(b) {
  if (!b || typeof b !== 'object') return false;
  const dome = DOMES_BY_ID.get(b.domeId);
  if (!dome) return false;
  if (!isISODate(b.checkIn) || !isISODate(b.checkOut)) return false;
  const nights = nightsBetween(b.checkIn, b.checkOut);
  return nights >= LIMITS.nightsMin && nights <= LIMITS.nightsMax
    && typeof b.id === 'string'
    && typeof b.number === 'string'
    && Number.isInteger(b.guests) && b.guests >= LIMITS.guestsMin && b.guests <= dome.capacity
    && Number.isFinite(b.total) && b.total > 0
    && typeof b.createdAt === 'string';
}

/**
 * Загрузка броней.
 * Возвращает { bookings, seq, problem } — problem: текст для пользователя или null.
 */
export function loadBookings() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('localStorage недоступен:', error);
    return { bookings: [], seq: 0, problem: 'Браузер запрещает сохранение — брони пропадут после обновления страницы.' };
  }

  if (raw === null) return { bookings: [], seq: 0, problem: null };

  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.bookings)) throw new Error('Неверный формат');

    // Две брони одного купола на пересекающиеся даты — оставляем первую
    const bookings = [];
    for (const b of data.bookings) {
      if (!isValidBooking(b)) continue;
      const clash = bookings.some((x) => x.domeId === b.domeId && overlaps(x.checkIn, x.checkOut, b.checkIn, b.checkOut));
      if (!clash) bookings.push({ ...b, extra: Boolean(b.extra), nights: nightsBetween(b.checkIn, b.checkOut) });
    }

    const seq = Number.isInteger(data.seq) && data.seq >= 0 ? data.seq : bookings.length;
    const problem = bookings.length < data.bookings.length
      ? 'Часть сохранённых броней была повреждена и не загрузилась.'
      : null;
    return { bookings, seq, problem };
  } catch (error) {
    console.warn('Сохранение повреждено:', error);
    return { bookings: [], seq: 0, problem: 'Сохранённые брони повреждены — начинаем с чистого листа.' };
  }
}

/** Сохранение. true — получилось, false — нет (ошибку не бросает). */
export function saveBookings(bookings, seq) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bookings, seq }));
    return true;
  } catch (error) {
    console.warn('Не удалось сохранить:', error);
    return false;
  }
}

/** Сброс демо: удаляем только свой ключ. */
export function clearBookings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('Не удалось очистить:', error);
    return false;
  }
}
