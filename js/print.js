import { formatLong, formatRange } from './dates.js';
import { skyForecast } from './moon.js';
import { el, formatMoney, nightsWord, guestsWord } from './utils.js';

/**
 * Талон брони. Сначала показывается на экране в окне —
 * так он виден всегда, даже если браузер не умеет печатать
 * (например, встроенный просмотр в редакторе).
 * Кнопка «Распечатать или PDF» открывает окно печати,
 * а стили @media print оставляют на листе только талон.
 */

const dialog = document.querySelector('#ticket-dialog');
const box = document.querySelector('#print-ticket');
let notify = () => {};

function stopPrinting() {
  document.body.classList.remove('is-printing');
}

dialog.addEventListener('click', (event) => {
  const action = event.target.closest('[data-ticket]')?.dataset.ticket;
  if (action === 'close' || event.target === dialog) dialog.close();
  if (action === 'print') {
    document.body.classList.add('is-printing');
    try {
      window.print();
    } catch (error) {
      console.warn('Печать недоступна:', error);
      notify('Этот браузер не умеет печатать. Откройте сайт в Chrome, Safari или Firefox.');
      stopPrinting();
    }
  }
});
window.addEventListener('afterprint', stopPrinting);
dialog.addEventListener('close', stopPrinting);

/** notifyFn — как показать сообщение пользователю (подсказка внизу экрана) */
export function initTicket(notifyFn) {
  notify = notifyFn;
}

export function showTicket(booking, dome) {
  const sky = skyForecast(booking.checkIn, booking.checkOut);

  const rows = [
    ['Купол', `«${dome.name}»`],
    ['Заезд', formatLong(booking.checkIn)],
    ['Выезд', formatLong(booking.checkOut)],
    ['Ночей', `${booking.nights} ${nightsWord(booking.nights)}`],
    ['Гостей', `${booking.guests} ${guestsWord(booking.guests)}`],
  ];
  if (booking.extra) rows.push(['Экскурсия', 'ночная, к телескопу']);
  if (sky) rows.push(['Небо', `${sky.emoji} ${sky.title.toLowerCase()}`]);

  const list = el('dl', 'pt__rows');
  for (const [k, v] of rows) {
    const row = el('div', 'pt__row');
    row.append(el('dt', '', k), el('dd', '', v));
    list.append(row);
  }

  const number = el('h3', 'pt__number', booking.number);
  number.id = 'pt-number';

  box.replaceChildren(
    el('p', 'pt__brand', 'Звёздная ночь'),
    number,
    el('p', 'pt__dates', formatRange(booking.checkIn, booking.checkOut)),
    list,
    el('p', 'pt__total', formatMoney(booking.total)),
    el('p', 'pt__note', 'Учебное демо: бронирования сохраняются только в этом браузере. Реальная бронь не оформляется.'),
  );

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  dialog.querySelector('[data-ticket="print"]').focus();
}
