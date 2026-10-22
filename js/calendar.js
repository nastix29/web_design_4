import { LIMITS } from './data.js';
import {
  MONTHS, WEEKDAYS, todayISO, addDays, fromISO, toISO, eachNight,
  nightsBetween, formatShort, formatLong,
} from './dates.js';
import { isDarkNight, moonMarker, skyForecast } from './moon.js';
import { el, nightsWord } from './utils.js';

/**
 * Календарь выбора дат (заезд → выезд) в диалоговом окне.
 * Показывает тёмные ночи (луны почти нет), новолуние/полнолуние
 * и занятые ночи выбранного купола — их нельзя захватить.
 */
export class DateRangePicker {
  constructor(dialog) {
    this.dialog = dialog;
    this.resolve = null;
    this._build();

    this.grid.addEventListener('click', (event) => {
      const day = event.target.closest('[data-date]');
      if (day && !day.disabled) this._pick(day.dataset.date);
    });
    this.grid.addEventListener('pointerover', (event) => {
      const day = event.target.closest('[data-date]');
      if (day && this.start && !this.end) {
        this.hover = day.dataset.date;
        this._paint();
      }
    });
    this.prevBtn.addEventListener('click', () => this._shiftMonth(-1));
    this.nextBtn.addEventListener('click', () => this._shiftMonth(1));
    this.doneBtn.addEventListener('click', () => this._finish({ checkIn: this.start, checkOut: this.end }));
    this.cancelBtn.addEventListener('click', () => this._finish(null));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this._finish(null);
    });
    // Клик по затемнённому фону закрывает окно
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) this._finish(null);
    });
  }

  _build() {
    const head = el('div', 'cal__head');
    this.title = el('h3', 'cal__title', 'Когда приедете?');
    this.subtitle = el('p', 'cal__sub');
    head.append(this.title, this.subtitle);

    const nav = el('div', 'cal__nav');
    this.prevBtn = el('button', 'cal__arrow', '‹');
    this.prevBtn.type = 'button';
    this.prevBtn.setAttribute('aria-label', 'Предыдущий месяц');
    this.monthLabel = el('p', 'cal__month');
    this.monthLabel.setAttribute('aria-live', 'polite');
    this.nextBtn = el('button', 'cal__arrow', '›');
    this.nextBtn.type = 'button';
    this.nextBtn.setAttribute('aria-label', 'Следующий месяц');
    nav.append(this.prevBtn, this.monthLabel, this.nextBtn);

    const weekdays = el('div', 'cal__weekdays');
    weekdays.setAttribute('aria-hidden', 'true');
    for (const w of WEEKDAYS) weekdays.append(el('span', '', w));

    this.grid = el('div', 'cal__grid');

    const legend = el('p', 'cal__legend');
    legend.append(el('i', 'cal__dot'), ' тёмная ночь — лучше видно звёзды');

    this.rangeText = el('p', 'cal__range');
    this.sky = el('p', 'cal__sky');

    const actions = el('div', 'cal__actions');
    this.cancelBtn = el('button', 'btn btn--ghost', 'Отмена');
    this.cancelBtn.type = 'button';
    this.doneBtn = el('button', 'btn btn--primary', 'Готово');
    this.doneBtn.type = 'button';
    actions.append(this.cancelBtn, this.doneBtn);

    const foot = el('div', 'cal__foot');
    foot.append(this.rangeText, this.sky, actions);

    this.dialog.replaceChildren(head, nav, weekdays, this.grid, legend, foot);
  }

  /** Открыть календарь. Возвращает Promise с { checkIn, checkOut } или null. */
  open({ checkIn, checkOut, busy = [], domeName = '' }) {
    this.today = todayISO();
    this.maxDate = addDays(this.today, LIMITS.daysAhead);
    this.busyNights = new Set(busy.flatMap((r) => eachNight(r.from, r.to)));
    this.start = checkIn;
    this.end = checkOut;
    this.hover = null;

    this.subtitle.textContent = domeName
      ? `Зачёркнуты ночи, когда «${domeName}» занят.`
      : 'Выберите день заезда, затем день выезда.';

    const base = fromISO(checkIn || this.today);
    this.view = new Date(base.getFullYear(), base.getMonth(), 1, 12);
    this._renderMonth();

    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');

    this.grid.querySelector('.is-start:not([disabled])')?.focus()
      ?? this.grid.querySelector('button:not([disabled])')?.focus();

    return new Promise((resolve) => { this.resolve = resolve; });
  }

  _finish(result) {
    if (!this.resolve) return;
    if (this.dialog.open) this.dialog.close();
    const resolve = this.resolve;
    this.resolve = null;
    resolve(result);
  }

  _shiftMonth(step) {
    this.view = new Date(this.view.getFullYear(), this.view.getMonth() + step, 1, 12);
    this._renderMonth();
  }

  _renderMonth() {
    const year = this.view.getFullYear();
    const month = this.view.getMonth();
    this.monthLabel.textContent = `${MONTHS[month]} ${year}`;

    const firstISO = toISO(this.view);
    const offset = (this.view.getDay() + 6) % 7; // неделя с понедельника
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.prevBtn.disabled = firstISO <= this.today.slice(0, 8) + '01';
    this.nextBtn.disabled = toISO(new Date(year, month + 1, 1, 12)) > this.maxDate;

    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push(el('span', 'cal__blank'));
    for (let d = 1; d <= daysInMonth; d += 1) {
      const iso = toISO(new Date(year, month, d, 12));
      const button = el('button', 'cal__day');
      button.type = 'button';
      button.dataset.date = iso;
      button.append(el('span', 'cal__num', String(d)));
      const marker = moonMarker(iso);
      if (marker) button.append(el('span', 'cal__moon', marker));
      else if (isDarkNight(iso)) button.append(el('i', 'cal__dot'));
      cells.push(button);
    }
    this.grid.replaceChildren(...cells);
    this._paint();
  }

  /** Последний возможный день выезда для выбранного заезда */
  _limitEnd() {
    let limit = addDays(this.start, LIMITS.nightsMax);
    if (limit > this.maxDate) limit = this.maxDate;
    for (let d = this.start; d < limit; d = addDays(d, 1)) {
      if (this.busyNights.has(d)) return d; // выезд утром того дня, когда купол занят
    }
    return limit;
  }

  _paint() {
    const choosingEnd = Boolean(this.start && !this.end);
    const limit = choosingEnd ? this._limitEnd() : null;
    const rangeEnd = this.end || (choosingEnd && this.hover > this.start && this.hover <= limit ? this.hover : null);

    for (const button of this.grid.querySelectorAll('[data-date]')) {
      const iso = button.dataset.date;
      const busy = this.busyNights.has(iso);
      let disabled = iso < this.today || iso > this.maxDate;
      if (!disabled) {
        if (choosingEnd && iso > this.start) disabled = iso > limit;
        else disabled = busy; // заехать в занятую ночь нельзя
      }

      button.disabled = disabled;
      button.classList.toggle('is-today', iso === this.today);
      button.classList.toggle('is-busy', busy);
      button.classList.toggle('is-start', iso === this.start);
      button.classList.toggle('is-end', iso === rangeEnd);
      button.classList.toggle('is-range', Boolean(rangeEnd) && iso > this.start && iso < rangeEnd);

      const notes = [];
      if (iso === this.start) notes.push('заезд');
      if (iso === this.end) notes.push('выезд');
      if (busy) notes.push('занято');
      if (moonMarker(iso) === '🌑') notes.push('новолуние');
      else if (moonMarker(iso) === '🌕') notes.push('полнолуние');
      else if (isDarkNight(iso)) notes.push('тёмная ночь');
      button.setAttribute('aria-label', [formatLong(iso), ...notes].join(', '));
      button.setAttribute('aria-pressed', String(iso === this.start || iso === this.end));
    }

    // Подпись внизу
    if (this.start && this.end) {
      const n = nightsBetween(this.start, this.end);
      this.rangeText.textContent = `${formatShort(this.start)} → ${formatShort(this.end)} · ${n} ${nightsWord(n)}`;
      const sky = skyForecast(this.start, this.end);
      this.sky.textContent = `${sky.emoji} ${sky.title}. ${sky.text}`;
      this.sky.dataset.level = sky.level;
    } else if (this.start) {
      this.rangeText.textContent = `Заезд ${formatShort(this.start)} → выберите день выезда`;
      this.sky.textContent = '';
    } else {
      this.rangeText.textContent = 'Выберите день заезда';
      this.sky.textContent = '';
    }
    this.doneBtn.disabled = !(this.start && this.end);
  }

  _pick(iso) {
    if (!this.start || this.end || iso <= this.start) {
      this.start = iso;
      this.end = null;
    } else {
      this.end = iso;
    }
    this.hover = null;
    this._paint();
    if (this.end) this.doneBtn.focus();
  }
}
