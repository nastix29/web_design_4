import { photoUrl } from './data.js';
import { formatRange, todayISO } from './dates.js';
import { el, formatMoney, nightsWord, guestsWord, plural, photo } from './utils.js';

/** Раздел «Мои брони»: список, общий итог, изменить / талон / отменить. */
export class BookingsView {
  constructor({ root, onCancel, onEdit, onPrint }) {
    this.root = root;

    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-booking-action]');
      if (!button) return;
      const id = button.dataset.id;
      const action = button.dataset.bookingAction;
      if (action === 'cancel') onCancel(id);
      if (action === 'edit') onEdit(id);
      if (action === 'print') onPrint(id);
    });
  }

  _action(action, text, booking, dome, label) {
    const button = el('button', 'link-btn', text);
    button.type = 'button';
    button.dataset.bookingAction = action;
    button.dataset.id = booking.id;
    button.setAttribute('aria-label', `${label} бронь ${booking.number}, купол «${dome.name}»`);
    return button;
  }

  render(bookings, domesById, editingId = null) {
    if (bookings.length === 0) {
      this.root.replaceChildren(el('p', 'bookings__empty', 'Пока пусто. Самая тёмная ночь ещё впереди.'));
      return;
    }

    const today = todayISO();
    const list = el('ul', 'tickets');

    // Ближайшие заезды сверху
    const sorted = [...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.number.localeCompare(b.number));
    for (const booking of sorted) {
      const dome = domesById.get(booking.domeId);
      const past = booking.checkOut <= today;
      const li = el('li', `ticket-card${booking.id === editingId ? ' is-editing' : ''}${past ? ' is-past' : ''}`);

      const pic = photo(photoUrl(dome.photo, 400), '', 'ticket-card__photo');

      const info = el('div', 'ticket-card__info');
      const name = el('p', 'ticket-card__name', dome.name);
      const when = el('p', 'ticket-card__dates', `${formatRange(booking.checkIn, booking.checkOut)} · ${booking.nights} ${nightsWord(booking.nights)}${past ? ' · прошла' : ''}`);
      const parts = [`${booking.guests} ${guestsWord(booking.guests)}`];
      if (booking.extra) parts.push('экскурсия');
      parts.push(`бронь ${booking.number}`);
      const meta = el('p', 'ticket-card__meta', parts.join(' · '));
      info.append(name, when, meta);

      const total = el('p', 'ticket-card__total', formatMoney(booking.total));

      const actions = el('div', 'ticket-card__actions');
      if (!past) actions.append(this._action('edit', 'Изменить', booking, dome, 'Изменить'));
      actions.append(
        this._action('print', 'Талон', booking, dome, 'Распечатать талон:'),
        this._action('cancel', 'Отменить', booking, dome, 'Отменить'),
      );

      li.append(pic, info, total, actions);
      list.append(li);
    }

    // Общий итог по всем броням
    const count = bookings.length;
    const nights = bookings.reduce((sum, b) => sum + b.nights, 0);
    const sum = bookings.reduce((s, b) => s + b.total, 0);

    const summary = el('div', 'bookings__total');
    const label = el('p', 'bookings__total-label', 'Итого');
    label.append(el('span', '', `${count} ${plural(count, 'бронь', 'брони', 'броней')} · ${nights} ${nightsWord(nights)}`));
    summary.append(label, el('p', 'bookings__total-sum', formatMoney(sum)));

    this.root.replaceChildren(list, summary);
  }
}
