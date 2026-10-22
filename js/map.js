import { el, pad, formatMoney, upToGuests } from './utils.js';

// Подписи состояний: не только цвет, но и значок + текст
export const STATUS = {
  free: { icon: null, text: 'свободен' },
  selected: { icon: '✓', text: 'выбран' },
  busy: { icon: '✕', text: 'занят' },
  mine: { icon: '★', text: 'ваша бронь' },
};

// Статичная схема склона. Это наша собственная разметка, поэтому innerHTML безопасен.
const SCENE = `
<svg class="slope__svg" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="sl-ground" cx="62%" cy="30%" r="85%">
      <stop offset="0" stop-color="#1d0e09"/>
      <stop offset="0.55" stop-color="#100806"/>
      <stop offset="1" stop-color="#060303"/>
    </radialGradient>
    <linearGradient id="sl-lake" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14203a"/>
      <stop offset="1" stop-color="#070b16"/>
    </linearGradient>
    <radialGradient id="sl-fire">
      <stop offset="0" stop-color="#ffd5a9" stop-opacity="0.95"/>
      <stop offset="0.25" stop-color="#e89154" stop-opacity="0.7"/>
      <stop offset="0.6" stop-color="#852616" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#2a0001" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sl-obs">
      <stop offset="0" stop-color="#da7134" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#da7134" stop-opacity="0"/>
    </radialGradient>
    <pattern id="sl-trees" width="28" height="26" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="8" r="4" fill="#2d2a1c"/>
      <circle cx="20" cy="18" r="5" fill="#252316"/>
      <circle cx="21" cy="5" r="2.6" fill="#353122"/>
    </pattern>
  </defs>

  <rect width="1000" height="700" fill="url(#sl-ground)"/>

  <!-- Горизонтали вокруг вершины — тонкие «орбиты» -->
  <g fill="none" stroke="#da7134" stroke-width="1.1" transform="rotate(-14 870 100)">
    <ellipse cx="870" cy="100" rx="80" ry="50" stroke-opacity="0.32"/>
    <ellipse cx="870" cy="100" rx="160" ry="105" stroke-opacity="0.24"/>
    <ellipse cx="870" cy="100" rx="250" ry="170" stroke-opacity="0.18"/>
    <ellipse cx="870" cy="100" rx="350" ry="245" stroke-opacity="0.14"/>
    <ellipse cx="870" cy="100" rx="460" ry="330" stroke-opacity="0.11"/>
    <ellipse cx="870" cy="100" rx="580" ry="425" stroke-opacity="0.08"/>
    <ellipse cx="870" cy="100" rx="710" ry="530" stroke-opacity="0.06"/>
  </g>

  <!-- Леса -->
  <path d="M0 0 H230 C210 50 160 90 100 110 C60 122 25 120 0 112 Z" fill="url(#sl-trees)" opacity="0.9"/>
  <path d="M830 330 C880 300 975 300 1000 320 V520 C950 505 880 492 845 462 C805 428 795 368 830 330 Z" fill="url(#sl-trees)"/>
  <path d="M720 700 C760 655 870 640 1000 680 V700 Z" fill="url(#sl-trees)" opacity="0.8"/>

  <!-- Озеро -->
  <path d="M70 520 C58 452 150 410 242 428 C334 448 382 520 352 590 C322 660 212 682 140 652 C92 632 76 572 70 520 Z"
        fill="url(#sl-lake)" stroke="#ffd5a9" stroke-opacity="0.22" stroke-width="1.5"/>
  <path d="M95 522 C92 470 160 440 236 452" fill="none" stroke="#ffd5a9" stroke-opacity="0.12" stroke-width="1"/>
  <g fill="#ffd5a9">
    <circle cx="150" cy="500" r="1.6" opacity="0.7"/>
    <circle cx="220" cy="470" r="1.1" opacity="0.6"/>
    <circle cx="290" cy="530" r="1.4" opacity="0.5"/>
    <circle cx="180" cy="600" r="1.2" opacity="0.6"/>
    <circle cx="260" cy="610" r="1" opacity="0.5"/>
    <circle cx="120" cy="560" r="1" opacity="0.4"/>
  </g>
  <ellipse cx="230" cy="560" rx="26" ry="6" fill="#ffd5a9" opacity="0.18"/>

  <!-- Дорога от въезда к костровой -->
  <path d="M1015 650 C880 610 780 560 700 480 C640 420 580 380 505 362"
        fill="none" stroke="#24130e" stroke-width="28" stroke-linecap="round"/>
  <path d="M1015 650 C880 610 780 560 700 480 C640 420 580 380 505 362"
        fill="none" stroke="#ffd5a9" stroke-opacity="0.22" stroke-width="2" stroke-dasharray="12 14"/>

  <!-- Тропа к обсерватории -->
  <path d="M500 360 C560 300 640 262 720 205 C780 162 822 132 866 104"
        fill="none" stroke="#ffd5a9" stroke-opacity="0.5" stroke-width="2.4" stroke-dasharray="1 10" stroke-linecap="round"/>
  <!-- Кольцевая тропа у костровой -->
  <circle cx="500" cy="360" r="78" fill="none" stroke="#ffd5a9" stroke-opacity="0.16" stroke-dasharray="2 8" stroke-linecap="round"/>

  <!-- Обсерватория -->
  <circle cx="868" cy="100" r="70" fill="url(#sl-obs)"/>
  <circle cx="868" cy="100" r="24" fill="#1c0e0a" stroke="#ffd5a9" stroke-opacity="0.65" stroke-width="1.5"/>
  <path d="M852 106 A16 16 0 0 1 884 106 Z" fill="#da7134" opacity="0.85"/>
  <path d="M866 92 L884 82" stroke="#ffd5a9" stroke-width="2.4" stroke-linecap="round"/>

  <!-- Костровая -->
  <circle class="slope__fire" cx="500" cy="360" r="62" fill="url(#sl-fire)"/>
  <circle cx="500" cy="360" r="5" fill="#ffd5a9"/>

</svg>`;

/** Схема склона: картинка + кнопки-купола поверх неё. */
export class SlopeMap {
  constructor({ container, domes, onSelect }) {
    this.container = container;
    this.onSelect = onSelect;
    this.pins = new Map();

    container.innerHTML = SCENE;

    this.layer = el('div', 'slope__pins');
    for (const dome of domes) {
      const pin = this._createPin(dome);
      this.pins.set(dome.id, pin);
      this.layer.append(pin.button);
    }

    this.emptyNote = el('p', 'slope__empty', 'Под эти фильтры купола не нашлись');
    this.emptyNote.hidden = true;

    container.append(this.layer, this.emptyNote);

    // Один обработчик на все купола
    this.layer.addEventListener('click', (event) => {
      const button = event.target.closest('.pin');
      if (button) this.onSelect(button.dataset.id, 'map');
    });
  }

  _createPin(dome) {
    const button = el('button', 'pin');
    button.type = 'button';
    button.dataset.id = dome.id;
    button.style.left = `${dome.x}%`;
    button.style.top = `${dome.y}%`;
    // Подпись справа/слева, чтобы не вылезать за край карты
    if (dome.x > 82) button.classList.add('pin--label-left');

    const halo = el('span', 'pin__halo');
    halo.setAttribute('aria-hidden', 'true');
    const dot = el('span', 'pin__dot');
    dot.setAttribute('aria-hidden', 'true');
    const icon = el('span', 'pin__icon');
    dot.append(icon);

    const label = el('span', 'pin__label');
    label.setAttribute('aria-hidden', 'true');
    label.textContent = dome.name;

    button.append(halo, dot, label);
    return { button, icon, dome };
  }

  /** Обновление состояний без пересоздания кнопок (фокус не теряется). */
  update({ statusOf, visibleIds }) {
    for (const [id, pin] of this.pins) {
      const status = statusOf(id);
      const visible = visibleIds.has(id);
      const info = STATUS[status];
      const { button, dome } = pin;

      button.className = `pin is-${status}${visible ? '' : ' is-filtered'}${dome.x > 82 ? ' pin--label-left' : ''}`;
      pin.icon.textContent = info.icon ?? '';

      const unavailable = status === 'busy' || status === 'mine';
      button.setAttribute('aria-disabled', String(unavailable || !visible));
      button.setAttribute('aria-pressed', String(status === 'selected'));
      button.tabIndex = visible ? 0 : -1;
      if (visible) button.removeAttribute('aria-hidden');
      else button.setAttribute('aria-hidden', 'true');

      button.setAttribute(
        'aria-label',
        `Купол ${pad(dome.number)} «${dome.name}»: ${upToGuests(dome.capacity)}, ` +
        `${formatMoney(dome.pricePerNight)} за ночь, ${info.text}`,
      );
    }
    this.emptyNote.hidden = visibleIds.size > 0;
  }

  focus(id) {
    this.pins.get(id)?.button.focus();
  }
}
