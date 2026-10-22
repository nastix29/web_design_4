import { DOMES, DOMES_BY_ID, PRICE_MIN, PRICE_MAX } from './data.js';
import { loadBookings, saveBookings, clearBookings } from './storage.js';
import { todayISO, addDays, overlaps, formatRange, nightsBetween } from './dates.js';
import { skyForecast } from './moon.js';
import { SlopeMap } from './map.js';
import { DomeList } from './list.js';
import { BookingPanel } from './card.js';
import { BookingsView } from './bookings.js';
import { DateRangePicker } from './calendar.js';
import { showTicket, initTicket } from './print.js';
import { formatMoney, nightsWord } from './utils.js';

// ===== Состояние приложения =====
const saved = loadBookings();
const today = todayISO();

const state = {
  selectedId: null,
  editingId: null, // бронь, которую сейчас меняем
  dates: { checkIn: addDays(today, 1), checkOut: addDays(today, 3) },
  filters: { guests: 0, maxPrice: PRICE_MAX, telescope: false },
  sort: 'free',
  bookings: saved.bookings,
  seq: saved.seq,
};

// ===== Занятость по датам =====

/** Все занятые периоды купола: чужие (учебные) и мои. ignoreId — бронь, которую меняем. */
function busyRanges(domeId, ignoreId = null) {
  const dome = DOMES_BY_ID.get(domeId);
  const others = dome.busy.map(([from, to]) => ({ from: addDays(today, from), to: addDays(today, to), mine: false }));
  const mine = state.bookings
    .filter((b) => b.domeId === domeId && b.id !== ignoreId)
    .map((b) => ({ from: b.checkIn, to: b.checkOut, mine: true }));
  return [...others, ...mine];
}

/** Пересечение с занятым периодом → «24–26 окт», иначе null */
function conflictFor(domeId, checkIn, checkOut, ignoreId = null) {
  const hit = busyRanges(domeId, ignoreId).find((r) => overlaps(checkIn, checkOut, r.from, r.to));
  return hit ? formatRange(hit.from, hit.to) : null;
}

/** free | selected | busy | mine — для выбранных дат */
function statusOf(id) {
  const { checkIn, checkOut } = state.dates;
  const hits = busyRanges(id, state.editingId).filter((r) => overlaps(checkIn, checkOut, r.from, r.to));
  if (hits.some((r) => r.mine)) return 'mine';
  if (hits.length) return 'busy';
  if (state.selectedId === id) return 'selected';
  return 'free';
}

function matchesFilters(dome) {
  const { guests, maxPrice, telescope } = state.filters;
  return dome.capacity >= guests
    && dome.pricePerNight <= maxPrice
    && (!telescope || dome.telescope);
}

function visibleIds() {
  return new Set(DOMES.filter(matchesFilters).map((d) => d.id));
}

function freeCount() {
  return DOMES.filter((d) => ['free', 'selected'].includes(statusOf(d.id))).length;
}

// ===== Сообщения =====
const toast = document.querySelector('#toast');
let toastTimer = null;
function notify(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3400);
}

const banner = document.querySelector('#banner');
function showBanner(message) {
  banner.textContent = message;
  banner.hidden = false;
}

function persist() {
  const ok = saveBookings(state.bookings, state.seq);
  if (!ok) showBanner('Не удалось сохранить брони: браузер запрещает запись. После обновления страницы они пропадут.');
  return ok;
}

// ===== Диалог подтверждения (вместо confirm) =====
const dialog = document.querySelector('#confirm-dialog');
function ask({ title, text, ok, cancel }) {
  if (typeof dialog.showModal !== 'function') {
    return Promise.resolve(window.confirm(`${title}\n${text}`));
  }
  dialog.querySelector('#dialog-title').textContent = title;
  dialog.querySelector('#dialog-text').textContent = text;
  dialog.querySelector('#dialog-ok').textContent = ok;
  dialog.querySelector('#dialog-cancel').textContent = cancel;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
  });
}

// ===== Выбор купола =====
const layoutStacked = window.matchMedia('(max-width: 960px)');
const bookingRoot = document.querySelector('#booking');

/** На телефоне после выбора прокручиваем к карточке, если её не видно. */
function revealPanel() {
  if (!layoutStacked.matches) return;
  const rect = bookingRoot.getBoundingClientRect();
  if (rect.top < 0 || rect.top > window.innerHeight * 0.6) {
    bookingRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function select(id) {
  const dome = DOMES_BY_ID.get(id);
  if (!dome) return;
  const status = statusOf(id);

  if (status === 'busy') {
    notify(`«${dome.name}» занят на ${formatRange(state.dates.checkIn, state.dates.checkOut)} — выберите другой купол или даты`);
    return;
  }
  if (status === 'mine') {
    notify(`«${dome.name}» уже в ваших бронях на эти даты`);
    return;
  }
  if (!matchesFilters(dome)) return;
  if (status === 'selected' && !state.editingId) {
    revealPanel();
    return;
  }

  // Выбор другого купола прерывает изменение брони
  if (state.editingId) {
    state.editingId = null;
    notify('Изменение брони отменено');
  }

  state.selectedId = id;
  panel.showDome(dome, { guests: state.filters.guests || 2, dates: state.dates });
  render();
  revealPanel();
}

function clearSelection() {
  state.selectedId = null;
  state.editingId = null;
  panel.showEmpty(freeCount());
  render();
}

// ===== Даты =====
const picker = new DateRangePicker(document.querySelector('#calendar'));

/** forDome — календарь из карточки купола: занятые ночи этого купола выбрать нельзя.
 *  Общий календарь (в фильтрах) ничего не блокирует. */
async function pickDates(forDome = false) {
  const domeId = forDome ? state.selectedId : null;
  const dome = domeId ? DOMES_BY_ID.get(domeId) : null;
  const result = await picker.open({
    ...state.dates,
    busy: dome ? busyRanges(domeId, state.editingId) : [],
    domeName: dome?.name ?? '',
  });
  if (!result) return;
  setDates(result);
}

function setDates(dates) {
  state.dates = dates;

  // Выбранный купол занят на новые даты — сбрасываем (кроме режима изменения брони)
  if (state.selectedId && !state.editingId && statusOf(state.selectedId) !== 'selected') {
    const name = DOMES_BY_ID.get(state.selectedId).name;
    state.selectedId = null;
    panel.showEmpty(freeCount());
    notify(`«${name}» занят на эти даты — выберите другой купол`);
  } else {
    panel.setDates(dates);
  }
  render();
}

// ===== Бронь: создать / изменить / отменить =====
function confirmBooking({ domeId, editingId, guests, checkIn, checkOut, nights, extra, total }) {
  const conflict = conflictFor(domeId, checkIn, checkOut, editingId);
  if (conflict) {
    notify(`Купол занят ${conflict}`);
    return null;
  }

  const dome = DOMES_BY_ID.get(domeId);

  if (editingId) {
    const booking = state.bookings.find((b) => b.id === editingId);
    if (!booking) return null;
    Object.assign(booking, { guests, checkIn, checkOut, nights, extra, total });
    state.editingId = null;
    state.selectedId = null;
    persist();
    panel.showSuccess(booking, dome, { updated: true });
    render();
    notify(`Бронь ${booking.number} обновлена · ${formatMoney(total)}`);
    return booking;
  }

  if (state.selectedId !== domeId) return null; // повторное нажатие — дубликата не будет

  state.seq += 1;
  const booking = {
    id: `b-${Date.now()}-${state.seq}`,
    number: `ЗН-${String(state.seq).padStart(4, '0')}`,
    domeId,
    checkIn,
    checkOut,
    nights,
    guests,
    extra,
    total,
    createdAt: new Date().toISOString(),
  };
  state.bookings.push(booking);
  state.selectedId = null;
  persist();

  panel.showSuccess(booking, dome);
  render();
  notify(`Бронь ${booking.number} подтверждена · ${formatMoney(total)}`);
  return booking;
}

function editBooking(bookingId) {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return;
  const dome = DOMES_BY_ID.get(booking.domeId);

  // Купол должен быть виден на карте и в списке
  if (!matchesFilters(dome)) {
    filtersForm.reset();
    readFilters();
  }

  state.editingId = booking.id;
  state.selectedId = booking.domeId;
  state.dates = { checkIn: booking.checkIn, checkOut: booking.checkOut };
  panel.showDome(dome, { guests: booking.guests, dates: state.dates, extra: booking.extra, editing: booking });
  render();
  document.querySelector('#map').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cancelBooking(bookingId) {
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return;
  const dome = DOMES_BY_ID.get(booking.domeId);

  const yes = await ask({
    title: `Отменить «${dome.name}»?`,
    text: `Бронь ${booking.number} на ${formatRange(booking.checkIn, booking.checkOut)} будет удалена, купол снова станет свободным.`,
    ok: 'Отменить бронь',
    cancel: 'Оставить',
  });
  if (!yes) return;

  // Могли удалить, пока был открыт диалог
  if (!state.bookings.some((b) => b.id === bookingId)) return;
  state.bookings = state.bookings.filter((b) => b.id !== bookingId);
  if (state.editingId === bookingId) clearSelection();
  persist();
  render();
  notify(`Бронь ${booking.number} отменена — «${dome.name}» снова свободен`);
}

function printBooking(bookingOrId) {
  const booking = typeof bookingOrId === 'string'
    ? state.bookings.find((b) => b.id === bookingOrId)
    : bookingOrId;
  if (booking) showTicket(booking, DOMES_BY_ID.get(booking.domeId));
}

async function resetDemo() {
  const yes = await ask({
    title: 'Удалить все брони?',
    text: 'Все ваши учебные брони будут удалены, купола снова станут свободными.',
    ok: 'Удалить всё',
    cancel: 'Отмена',
  });
  if (!yes) return;

  state.bookings = [];
  state.seq = 0;
  state.selectedId = null;
  state.editingId = null;
  clearBookings();
  banner.hidden = true;
  panel.showEmpty(freeCount());
  render();
  notify('Демо сброшено');
}

// ===== Фильтры и сортировка =====
const filtersForm = document.querySelector('#filters');
const guestsSelect = filtersForm.elements.guests;
const priceRange = filtersForm.elements.maxPrice;
const telescopeBox = filtersForm.elements.telescope;
const priceOutput = document.querySelector('#price-output');
const foundOutput = document.querySelector('#found');
const datesButton = document.querySelector('#dates-button');
const sortSelect = document.querySelector('#sort');

priceRange.min = String(PRICE_MIN);
priceRange.max = String(PRICE_MAX);
priceRange.step = '500';
priceRange.defaultValue = String(PRICE_MAX); // к этому значению вернёт кнопка «Сбросить»
priceRange.value = String(PRICE_MAX);

function readFilters() {
  state.filters = {
    guests: Number(guestsSelect.value) || 0,
    maxPrice: Number(priceRange.value) || PRICE_MAX,
    telescope: telescopeBox.checked,
  };

  // Выбранный купол скрыт фильтром — сбрасываем выбор и говорим об этом
  if (state.selectedId && !matchesFilters(DOMES_BY_ID.get(state.selectedId))) {
    const name = DOMES_BY_ID.get(state.selectedId).name;
    state.selectedId = null;
    state.editingId = null;
    panel.showEmpty(freeCount());
    notify(`«${name}» не подходит под фильтр — выбор сброшен`);
  }
  render();
}

filtersForm.addEventListener('input', readFilters);
filtersForm.addEventListener('reset', () => setTimeout(readFilters)); // после сброса значений формы
filtersForm.addEventListener('submit', (event) => event.preventDefault());
datesButton.addEventListener('click', () => pickDates(false));

const SORTERS = {
  free: (a, b) => (statusRank(a) - statusRank(b)) || a.pricePerNight - b.pricePerNight,
  cheap: (a, b) => a.pricePerNight - b.pricePerNight,
  expensive: (a, b) => b.pricePerNight - a.pricePerNight,
  capacity: (a, b) => b.capacity - a.capacity || a.pricePerNight - b.pricePerNight,
};
function statusRank(dome) {
  return { selected: 0, free: 0, mine: 1, busy: 2 }[statusOf(dome.id)];
}
sortSelect.addEventListener('change', () => {
  state.sort = sortSelect.value;
  render();
});

// ===== Части страницы =====
const slopeMap = new SlopeMap({
  container: document.querySelector('#slope-map'),
  domes: DOMES,
  onSelect: select,
});

const domeList = new DomeList({
  container: document.querySelector('#dome-list'),
  emptyNote: document.querySelector('#list-empty'),
  domes: DOMES,
  onSelect: select,
});

const panel = new BookingPanel({
  root: bookingRoot,
  onConfirm: confirmBooking,
  onClear: clearSelection,
  onShowBookings: () => document.querySelector('#bookings').scrollIntoView({ behavior: 'smooth' }),
  onPickDates: () => pickDates(true),
  getConflict: conflictFor,
  onPrint: printBooking,
});

const bookingsView = new BookingsView({
  root: document.querySelector('#my-bookings'),
  onCancel: cancelBooking,
  onEdit: editBooking,
  onPrint: printBooking,
});

const navCount = document.querySelector('#nav-count');

function renderDatesButton() {
  const { checkIn, checkOut } = state.dates;
  const n = nightsBetween(checkIn, checkOut);
  const sky = skyForecast(checkIn, checkOut);
  datesButton.querySelector('.dates-btn__range').textContent = formatRange(checkIn, checkOut);
  datesButton.querySelector('.dates-btn__nights').textContent = `${n} ${nightsWord(n)}`;
  datesButton.querySelector('.dates-btn__moon').textContent = sky?.emoji ?? '';
  datesButton.setAttribute('aria-label', `Даты: ${formatRange(checkIn, checkOut)}, ${n} ${nightsWord(n)}. ${sky ? sky.title : ''}. Изменить`);
}

function render() {
  const visible = visibleIds();
  slopeMap.update({ statusOf, visibleIds: visible });
  domeList.reorder([...DOMES].sort(SORTERS[state.sort]).map((d) => d.id));
  domeList.update({ statusOf, visibleIds: visible });
  bookingsView.render(state.bookings, DOMES_BY_ID, state.editingId);
  panel.setFreeCount(freeCount());
  renderDatesButton();

  priceOutput.textContent = formatMoney(state.filters.maxPrice);
  foundOutput.textContent = `${visible.size} из ${DOMES.length}`;
  navCount.textContent = String(state.bookings.length);
  navCount.hidden = state.bookings.length === 0;
}

// ===== Запуск =====
document.querySelector('#reset-demo').addEventListener('click', resetDemo);
initTicket(notify);

if (saved.problem) showBanner(saved.problem);

panel.showEmpty(freeCount());
render();
window.zvStarted = true; // для подсказки о запуске в index.html
