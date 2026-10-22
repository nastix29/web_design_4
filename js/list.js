import { photoUrl } from './data.js';
import { el, formatMoney, upToGuests, photo } from './utils.js';
import { STATUS } from './map.js';

// Метка на фото — только когда купол не просто свободен
const BADGE = {
  free: '',
  selected: 'Выбран',
  busy: 'Занят',
  mine: 'Ваша бронь',
};

/** Список куполов — фото-карточки. Те же данные и фильтры, что и на карте. */
export class DomeList {
  constructor({ container, emptyNote, domes, onSelect }) {
    this.container = container;
    this.emptyNote = emptyNote;
    this.onSelect = onSelect;
    this.items = new Map();

    for (const dome of domes) {
      const item = this._createItem(dome);
      this.items.set(dome.id, item);
      container.append(item.li);
    }

    container.addEventListener('click', (event) => {
      const button = event.target.closest('.dome-card');
      if (button) this.onSelect(button.dataset.id, 'list');
    });
  }

  _createItem(dome) {
    const li = el('li', 'dome-list__item');
    const button = el('button', 'dome-card');
    button.type = 'button';
    button.dataset.id = dome.id;

    const pic = photo(photoUrl(dome.photo, 700), '', 'dome-card__photo');
    const badge = el('span', 'dome-card__badge');
    pic.append(badge);

    const info = el('span', 'dome-card__info');
    const name = el('span', 'dome-card__name', dome.name);
    const price = el('span', 'dome-card__price', formatMoney(dome.pricePerNight));
    const meta = el('span', 'dome-card__meta', `${upToGuests(dome.capacity)} · ${dome.view}${dome.telescope ? ' · телескоп' : ''}`);
    info.append(name, price, meta);

    button.append(pic, info);
    li.append(button);
    return { li, button, badge, dome };
  }

  /** Порядок карточек (сортировка). Узлы переставляются, а не пересоздаются. */
  reorder(ids) {
    const current = [...this.container.children].map((li) => li.firstChild.dataset.id);
    if (current.join() === ids.join()) return; // порядок тот же — не трогаем (фокус не сбивается)
    for (const id of ids) this.container.append(this.items.get(id).li);
  }

  update({ statusOf, visibleIds }) {
    for (const [id, item] of this.items) {
      const status = statusOf(id);
      item.li.hidden = !visibleIds.has(id);
      item.button.className = `dome-card is-${status}`;
      item.badge.textContent = BADGE[status];
      item.badge.hidden = !BADGE[status];
      item.button.setAttribute('aria-pressed', String(status === 'selected'));
      item.button.setAttribute('aria-disabled', String(status === 'busy' || status === 'mine'));
      item.button.setAttribute(
        'aria-label',
        `${item.dome.name}, ${formatMoney(item.dome.pricePerNight)} за ночь, ${STATUS[status].text}`,
      );
    }
    this.emptyNote.hidden = visibleIds.size > 0;
  }
}
