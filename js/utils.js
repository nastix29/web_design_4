// Небольшие общие помощники

export function formatMoney(value) {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const nightsWord = (n) => plural(n, 'ночь', 'ночи', 'ночей');
export const guestsWord = (n) => plural(n, 'гость', 'гостя', 'гостей');
/** «до 2 гостей», «до 1 гостя» — после «до» нужен родительный падеж */
export const upToGuests = (n) => `до ${n} ${n % 10 === 1 && n % 100 !== 11 ? 'гостя' : 'гостей'}`;

export const pad = (n) => String(n).padStart(2, '0');

/** Создаёт элемент с классом и текстом (текст — только через textContent). */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Фото в обёртке. Если снимок не загрузился (нет сети, блокировка),
 * обёртка получает класс is-broken и показывает тёмный градиент вместо картинки.
 */
export function photo(src, alt, className = '') {
  const wrap = el('div', `photo ${className}`.trim());
  const img = document.createElement('img');
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => wrap.classList.add('is-broken'), { once: true });
  img.src = src;
  wrap.append(img);
  return wrap;
}

/**
 * Строгое чтение целого числа из поля.
 * '' → empty, '2.5' / '-1' / '1e2' → format, '3' → value 3.
 */
export function readInteger(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { error: 'empty' };
  if (!/^\d+$/.test(text)) return { error: 'format' };
  return { value: Number(text) };
}
