import { EXTRA, EMPTY_PHOTO, photoUrl, galleryOf } from './data.js';
import { formatRange, nightsBetween, isISODate } from './dates.js';
import { skyForecast } from './moon.js';
import { calculate } from './pricing.js';
import { el, formatMoney, nightsWord, upToGuests, readInteger, photo } from './utils.js';

const DEMO_NOTE = 'Учебное демо: бронирования сохраняются только в этом браузере';

/**
 * Панель рядом с картой: пусто → выбранный купол с формой → бронь создана.
 * Та же форма работает для изменения существующей брони.
 */
export class BookingPanel {
  constructor({ root, onConfirm, onClear, onShowBookings, onPickDates, getConflict, onPrint }) {
    this.root = root;
    this.onConfirm = onConfirm;
    this.onClear = onClear;
    this.onShowBookings = onShowBookings;
    this.onPickDates = onPickDates;
    this.getConflict = getConflict;
    this.onPrint = onPrint;
    this.dome = null;
    this.submitting = false;

    // Одни обработчики на всю панель — содержимое меняется, а слушатели нет
    root.addEventListener('click', (event) => this._handleClick(event));
    root.addEventListener('input', () => this._recalculate(true));
    root.addEventListener('change', (event) => {
      if (event.target.name === 'extra') this._recalculate(false);
    });
    root.addEventListener('submit', (event) => {
      event.preventDefault();
      this._submit();
    });
  }

  // ===== 1. Ничего не выбрано =====
  showEmpty(freeCount) {
    this.dome = null;
    this.mode = 'empty';
    this.freeCount = freeCount;

    const pic = photo(photoUrl(EMPTY_PHOTO, 900), '', 'booking__photo booking__photo--empty');
    const body = el('div', 'booking__body booking__body--empty');
    const title = el('h3', 'booking__title', 'Выберите купол');
    this.freeNote = el('p', 'booking__text');
    this._updateFreeNote();
    body.append(title, this.freeNote);

    this.root.replaceChildren(pic, body);
  }

  setFreeCount(freeCount) {
    this.freeCount = freeCount;
    if (this.mode === 'empty') this._updateFreeNote();
  }

  _updateFreeNote() {
    this.freeNote.textContent = this.freeCount
      ? `Нажмите на огонёк на карте или на фото ниже. На ваши даты свободно ${this.freeCount} из 8.`
      : 'На эти даты всё занято. Попробуйте другие даты.';
  }

  // ===== 2. Купол выбран — форма =====
  /**
   * editing — бронь, которую меняем (или null для новой).
   */
  showDome(dome, { guests = 2, dates, extra = false, editing = null }) {
    this.dome = dome;
    this.mode = 'form';
    this.editing = editing;
    this.submitting = false;
    this.dates = dates;

    const gallery = this._gallery(dome);
    const body = el('div', 'booking__body');

    if (editing) body.append(el('p', 'booking__editing', `Изменение брони ${editing.number}`));

    const head = el('div', 'booking__head');
    const title = el('h3', 'booking__title', dome.name);
    const price = el('p', 'booking__price');
    price.append('от ', el('strong', '', formatMoney(dome.pricePerNight)), ' / ночь');
    head.append(title, price);

    const text = el('p', 'booking__text', dome.description);
    const meta = el('p', 'booking__meta', `${upToGuests(dome.capacity)} · вид на ${dome.view}${dome.telescope ? ' · телескоп' : ''}`);

    // Форма
    const form = el('form', 'form');
    form.noValidate = true;

    // Даты — кнопка, открывающая календарь
    const datesField = el('div', 'field');
    datesField.append(el('span', 'field__label', 'Даты'));
    this.datesBtn = el('button', 'dates-btn');
    this.datesBtn.type = 'button';
    this.datesBtn.dataset.action = 'dates';
    this.datesError = el('p', 'field__error');
    this.datesError.id = 'field-dates-error';
    this.datesError.setAttribute('aria-live', 'polite');
    this.datesBtn.setAttribute('aria-describedby', this.datesError.id);
    datesField.append(this.datesBtn, this.datesError);

    const startGuests = Math.min(Math.max(guests, 1), dome.capacity);
    const fields = el('div', 'form__row');
    fields.append(datesField, this._stepper('guests', 'Гостей', startGuests, 1, dome.capacity));

    const extraLabel = el('label', 'check');
    const extraInput = el('input');
    extraInput.type = 'checkbox';
    extraInput.name = 'extra';
    extraInput.checked = extra;
    const extraBox = el('span', 'check__box');
    extraBox.setAttribute('aria-hidden', 'true');
    const extraText = el('span', 'check__text');
    extraText.append(el('span', '', EXTRA.label), el('span', 'check__price', `+${formatMoney(EXTRA.price)}`));
    extraLabel.append(extraInput, extraBox, extraText);

    this.sky = el('p', 'sky');

    this.summary = el('dl', 'summary');
    this.summary.setAttribute('aria-live', 'polite');

    this.confirmBtn = el('button', 'btn btn--primary btn--wide', editing ? 'Сохранить изменения' : 'Забронировать');
    this.confirmBtn.type = 'submit';

    const foot = el('div', 'booking__foot');
    const clear = el('button', 'link-btn', editing ? 'Не менять бронь' : 'Снять выбор');
    clear.type = 'button';
    clear.dataset.action = 'clear';
    foot.append(el('p', 'demo-note', DEMO_NOTE), clear);

    form.append(fields, extraLabel, this.sky, this.summary, this.confirmBtn);
    body.append(head, text, meta, form, foot);

    this.root.replaceChildren(gallery, body);
    this.form = form;
    this.touched = new Set();
    this._renderDates();
    this._recalculate(false);
  }

  /** Новые даты из календаря */
  setDates(dates) {
    this.dates = dates;
    if (this.mode !== 'form') return;
    this.touched.add('dates');
    this._renderDates();
    this._recalculate(false);
  }

  _renderDates() {
    const { checkIn, checkOut } = this.dates;
    this.datesBtn.textContent = '';
    if (isISODate(checkIn) && isISODate(checkOut)) {
      const n = nightsBetween(checkIn, checkOut);
      this.datesBtn.append(el('strong', '', formatRange(checkIn, checkOut)), el('span', '', ` · ${n} ${nightsWord(n)}`));
      this.datesBtn.setAttribute('aria-label', `Даты: ${formatRange(checkIn, checkOut)}, ${n} ${nightsWord(n)}. Изменить`);
    } else {
      this.datesBtn.append(el('strong', '', 'Выбрать даты'));
    }
  }

  // ===== Галерея =====
  _gallery(dome) {
    const ids = galleryOf(dome);
    const wrap = el('div', 'gallery');
    const track = el('div', 'gallery__track');
    ids.forEach((id, i) => {
      const slide = photo(photoUrl(id, 900), i === 0 ? `Купол «${dome.name}»` : `Ночь в глэмпинге, фото ${i + 1}`, 'gallery__slide');
      track.append(slide);
    });

    const prev = el('button', 'gallery__arrow gallery__arrow--prev', '‹');
    prev.type = 'button';
    prev.dataset.slide = '-1';
    prev.setAttribute('aria-label', 'Предыдущее фото');
    const next = el('button', 'gallery__arrow gallery__arrow--next', '›');
    next.type = 'button';
    next.dataset.slide = '1';
    next.setAttribute('aria-label', 'Следующее фото');

    const dots = el('div', 'gallery__dots');
    dots.setAttribute('aria-hidden', 'true');
    ids.forEach(() => dots.append(el('i')));

    wrap.append(track, prev, next, dots);
    this.slide = 0;
    this.galleryEl = { wrap, track, dots, count: ids.length };
    this._showSlide(0);
    return wrap;
  }

  _showSlide(index) {
    const g = this.galleryEl;
    this.slide = (index + g.count) % g.count;
    g.track.style.transform = `translateX(-${this.slide * 100}%)`;
    [...g.dots.children].forEach((dot, i) => dot.classList.toggle('is-active', i === this.slide));
    [...g.track.children].forEach((s, i) => s.setAttribute('aria-hidden', String(i !== this.slide)));
  }

  _stepper(name, label, value, min, max) {
    const id = `field-${name}`;
    const wrap = el('div', 'field');

    const labelEl = el('label', 'field__label', label);
    labelEl.htmlFor = id;

    const row = el('div', 'stepper');
    const minus = el('button', 'stepper__btn', '−');
    minus.type = 'button';
    minus.dataset.step = '-1';
    minus.dataset.target = name;
    minus.setAttribute('aria-label', `${label}: меньше`);

    const input = el('input', 'stepper__input');
    input.id = id;
    input.name = name;
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(value);
    input.setAttribute('aria-describedby', `${id}-error`);

    const plus = el('button', 'stepper__btn', '+');
    plus.type = 'button';
    plus.dataset.step = '1';
    plus.dataset.target = name;
    plus.setAttribute('aria-label', `${label}: больше`);

    row.append(minus, input, plus);

    const error = el('p', 'field__error');
    error.id = `${id}-error`;
    error.setAttribute('aria-live', 'polite');

    wrap.append(labelEl, row, error);
    return wrap;
  }

  _handleClick(event) {
    const slideBtn = event.target.closest('[data-slide]');
    if (slideBtn) {
      this._showSlide(this.slide + Number(slideBtn.dataset.slide));
      return;
    }

    const stepBtn = event.target.closest('[data-step]');
    if (stepBtn && this.mode === 'form') {
      const input = this.form.elements[stepBtn.dataset.target];
      const current = readInteger(input.value);
      const base = current.error ? Number(input.min) : current.value;
      const next = Math.min(Number(input.max), Math.max(Number(input.min), base + Number(stepBtn.dataset.step)));
      input.value = String(next);
      this.touched.add(input.name);
      this._recalculate(false);
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'clear' || action === 'another') this.onClear();
    if (action === 'bookings') this.onShowBookings();
    if (action === 'dates') this.onPickDates();
    if (action === 'print' && this.lastBooking) this.onPrint(this.lastBooking);
  }

  _result() {
    const f = this.form.elements;
    const { checkIn, checkOut } = this.dates;
    const conflict = isISODate(checkIn) && isISODate(checkOut)
      ? this.getConflict(this.dome.id, checkIn, checkOut, this.editing?.id)
      : null;
    return calculate(this.dome, {
      guestsRaw: f.guests.value,
      checkIn,
      checkOut,
      extra: f.extra.checked,
      conflict,
    });
  }

  /** Пересчёт суммы. Ошибки показываем у полей, которые уже трогали. */
  _recalculate(fromTyping) {
    if (this.mode !== 'form') return;
    if (fromTyping && document.activeElement?.name) this.touched.add(document.activeElement.name);

    const result = this._result();
    this._showErrors(result.errors, false);
    this._renderSummary(result);
    this._renderSky();
  }

  _showErrors(errors, showAll) {
    const input = this.form.elements.guests;
    const guestsError = this.form.querySelector('#field-guests-error');
    const guestsMsg = (showAll || this.touched.has('guests')) ? errors.guests ?? '' : '';
    guestsError.textContent = guestsMsg;
    input.setAttribute('aria-invalid', String(Boolean(guestsMsg)));
    input.closest('.field').classList.toggle('is-invalid', Boolean(guestsMsg));

    // Конфликт дат показываем сразу — это важная информация, а не опечатка
    const datesMsg = (showAll || this.touched.has('dates') || errors.dates?.startsWith('Купол')) ? errors.dates ?? '' : '';
    this.datesError.textContent = datesMsg;
    this.datesBtn.classList.toggle('is-invalid', Boolean(datesMsg));
  }

  _renderSky() {
    const { checkIn, checkOut } = this.dates;
    const ok = isISODate(checkIn) && isISODate(checkOut) && checkOut > checkIn;
    const sky = ok ? skyForecast(checkIn, checkOut) : null;
    this.sky.hidden = !sky;
    if (!sky) return;
    this.sky.textContent = '';
    this.sky.dataset.level = sky.level;
    this.sky.append(el('span', 'sky__emoji', sky.emoji), el('strong', '', sky.title), ` ${sky.text}`);
  }

  _renderSummary(result) {
    this.summary.replaceChildren();

    if (result.valid) {
      for (const line of result.lines) {
        const row = el('div', `summary__row${line.accent ? ' summary__row--accent' : ''}`);
        row.append(el('dt', '', line.label), el('dd', '', line.value < 0 ? `−${formatMoney(-line.value)}` : formatMoney(line.value)));
        this.summary.append(row);
      }
    }

    const total = el('div', 'summary__row summary__total');
    total.append(el('dt', '', 'Итого'), el('dd', '', result.valid ? formatMoney(result.total) : '—'));
    this.summary.append(total);
  }

  _submit() {
    if (this.mode !== 'form' || this.submitting) return; // защита от двойного нажатия

    const result = this._result();
    if (!result.valid) {
      this._showErrors(result.errors, true);
      this._renderSummary(result);
      if (result.errors.guests) this.form.elements.guests.focus();
      else this.datesBtn.focus();
      return;
    }

    this.submitting = true;
    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = 'Оформляем…';

    const booking = this.onConfirm({
      domeId: this.dome.id,
      editingId: this.editing?.id ?? null,
      guests: result.guests,
      checkIn: this.dates.checkIn,
      checkOut: this.dates.checkOut,
      nights: result.nights,
      extra: this.form.elements.extra.checked,
      total: result.total,
    });

    if (!booking) {
      this.submitting = false;
      this.confirmBtn.disabled = false;
      this.confirmBtn.textContent = this.editing ? 'Сохранить изменения' : 'Забронировать';
    }
  }

  // ===== 3. Бронь создана или изменена =====
  showSuccess(booking, dome, { updated = false } = {}) {
    this.dome = null;
    this.mode = 'success';
    this.lastBooking = booking;

    const pic = photo(photoUrl(dome.photo, 900), `Купол «${dome.name}»`, 'booking__photo');
    const body = el('div', 'booking__body');

    const title = el('h3', 'booking__title', updated ? 'Бронь обновлена' : 'До встречи под звёздами');
    const text = el('p', 'booking__text', updated
      ? `Новые условия для «${dome.name}» сохранены.`
      : `«${dome.name}» ваш. Изменить или отменить бронь можно ниже, в «Моих бронях».`);

    const ticket = el('dl', 'ticket');
    const rows = [
      ['Бронь', booking.number],
      ['Даты', formatRange(booking.checkIn, booking.checkOut)],
      ['Ночей', String(booking.nights)],
      ['Гостей', String(booking.guests)],
    ];
    if (booking.extra) rows.push(['Экскурсия', 'да']);
    rows.push(['Сумма', formatMoney(booking.total)]);
    for (const [k, v] of rows) {
      const row = el('div', 'ticket__row');
      row.append(el('dt', '', k), el('dd', '', v));
      ticket.append(row);
    }

    const actions = el('div', 'booking__actions');
    const another = el('button', 'btn btn--primary', 'Выбрать ещё');
    another.type = 'button';
    another.dataset.action = 'another';
    const print = el('button', 'btn btn--ghost', 'Талон');
    print.type = 'button';
    print.dataset.action = 'print';
    const toList = el('button', 'btn btn--ghost', 'Мои брони');
    toList.type = 'button';
    toList.dataset.action = 'bookings';
    actions.append(another, print, toList);

    body.append(title, text, ticket, actions, el('p', 'demo-note', DEMO_NOTE));
    this.root.replaceChildren(pic, body);
    another.focus({ preventScroll: true });
  }
}
