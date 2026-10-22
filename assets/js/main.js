// 1) Акцентный цвет: ?accent=blue | yellow | lilac — для сравнения вариантов палитры.
// 2) Клетка: десктоп — холст 1464px, масштабируется под ширину окна; на узких экранах
//    ширина контента кратна клетке. Блоки с линиями доравниваются до целых клеток,
//    чтобы каждая линия и край совпадали с линией клетки.
// 3) Анимации: заголовки появляются по словам, большие стрелки рисуются линией,
//    линии клетки подсвечиваются вокруг курсора.
(function () {
  var root = document.documentElement;
  var accent = new URLSearchParams(location.search).get('accent');
  if (accent === 'yellow' || accent === 'lilac') root.dataset.accent = accent;

  // Анимации — только если в системе не включено «Уменьшить движение» и это не печать в PDF
  var animate = !matchMedia('(prefers-reduced-motion: reduce)').matches && !root.dataset.print;
  if (animate) root.classList.add('js-anim');

  var C = 24, CANVAS = 1464, FLUID_MAX = 1199;
  var HMIN = 792;   // главная: минимальная высота первого экрана (33 клетки) — его содержимое в неё помещается

  // Элементы, чей верхний край (линия, край картинки или карточки) должен лечь на клетку
  var TOP = [
    '.head', '.comps', '.comp', '.tools__rows', '.trow', '.tools__combo', '.flow', '.flow__node', '.flow__arrow',
    '.cards', '.card', '.card__media', '.card__ba > div', '.timeline', '.timeline > div',
    '.contact__list', '.citem', '.contact__foot', '.case__blocks', '.cblock', '.case__meta', '.case__meta > div',
    '.result-list li', '.proof__grid', '.stack', '.shot', '.shot__frame', '.scheme', '.scheme__fan', '.scheme__targets',
    '.case__next', '.hero__bottom', '.hero__photo img', '.arrow', '.about__lead', '.grid'
  ].join(',');
  // Элементы, чья высота должна быть кратна клетке (нижний край тоже на линии)
  var HEIGHT = [
    '.head', '.comps', '.comp', '.trow', '.tools__combo', '.cards', '.card', '.card__media', '.timeline > div',
    '.contact__list', '.citem', '.cblock', '.case__meta', '.case__meta > div', '.result-list li',
    '.shot__frame', '.scheme', '.scheme__targets', '.stack', '.proof__grid', '.hero__bottom', '.case__blocks', '.grid'
  ].join(',');

  var touched = [];
  function remember(el) {
    if (!el.__snap) { el.__snap = el.getAttribute('style') || ''; touched.push(el); }
  }
  function reset() {
    touched.forEach(function (el) { el.setAttribute('style', el.__snap); delete el.__snap; });
    touched = [];
  }
  function mod(v) { var m = v % C; return m < 0 ? m + C : m; }
  function off(v) { var m = mod(v); return m > 0.5 && m < C - 0.5 ? m : 0; }

  function zoom() { return parseFloat(root.style.getPropertyValue('--z')) || 1; }
  function fixTop(el, base) {
    var m = off((el.getBoundingClientRect().top - base) / zoom());
    if (!m) return;
    remember(el);
    var cs = getComputedStyle(el);
    var mt = parseFloat(cs.marginTop) || 0;
    // сдвиг на 1–2px (округление шрифта) поднимаем, а не опускаем на целую клетку
    el.style.marginTop = (m <= 2 ? mt - m : mt + C - m) + 'px';
    // элемент прижат к низу и не сдвинулся — поднимаем его отступом снизу
    if (off((el.getBoundingClientRect().top - base) / zoom())) {
      el.style.marginTop = mt + 'px';
      el.style.marginBottom = ((parseFloat(cs.marginBottom) || 0) + m) + 'px';
    }
  }
  function fixHeight(el) {
    var h = el.getBoundingClientRect().height / zoom();
    if (Math.abs(h - Math.round(h / C) * C) < 0.01) return;
    remember(el);
    var r = Math.round(h / C) * C;
    if (Math.abs(h - r) <= 2) el.style.height = r + 'px';   // доли пикселя от метрик шрифта — до ровной клетки
    else el.style.minHeight = Math.ceil(h / C) * C + 'px';
  }
  function fixNodeWidth(el) {
    // узел шириной 24n+1 с отрицательным полем: обе вертикальные границы — по линиям клетки
    var w = el.getBoundingClientRect().width / zoom();
    remember(el);
    el.style.width = Math.ceil((w - 1) / C) * C + 1 + 'px';
    el.style.marginRight = '-1px';
  }

  // Телефон: заголовок, в который не влезает длинное слово, уменьшаем до ширины колонки
  function fitHeading(h) {
    if (h.scrollWidth <= h.clientWidth + 1) return;
    remember(h);
    var f = parseFloat(getComputedStyle(h).fontSize);
    while (h.scrollWidth > h.clientWidth + 1 && f > 24) { f -= 1; h.style.setProperty('--f', f + 'px'); }
  }

  // Логотип в карточке — по центру поля, но с шагом в целую клетку (на телефоне центрирует CSS)
  function centerLogos() {
    if (!document.body.classList.contains('is-canvas')) return;
    document.querySelectorAll('.card__logo, .card__art').forEach(function (logo) {
      var media = logo.parentElement;
      remember(logo);
      logo.style.marginTop = '0px';
      var top = (logo.getBoundingClientRect().top - media.getBoundingClientRect().top) / zoom();
      var free = (media.getBoundingClientRect().height - logo.getBoundingClientRect().height) / zoom() - top;
      logo.style.marginTop = Math.max(0, Math.floor(free / 2 / C)) * C + 'px';
    });
  }

  function walk(el, base) {
    if (el.matches(TOP)) fixTop(el, base);
    // схема в рамке стоит точно по центру рамки — внутри неё по клетке не доравниваем
    if (!el.matches('.shot__frame--scheme')) for (var i = 0; i < el.children.length; i++) walk(el.children[i], base);
    if (el.matches(HEIGHT)) fixHeight(el);
  }

  function snap() {
    var vw = root.clientWidth;
    var canvas = vw > FLUID_MAX || matchMedia('print').matches;
    reset();
    document.body.classList.toggle('is-canvas', canvas);
    root.style.setProperty('--z', '1');
    if (!canvas) {
      var w = Math.floor((vw - 32) / C) * C;
      root.style.setProperty('--pad', (vw - w) / 2 + 'px');
    } else {
      root.style.removeProperty('--pad');
    }
    if (!canvas) root.style.removeProperty('--gx');
    document.querySelectorAll('.flow__node').forEach(fixNodeWidth);
    if (!canvas) document.querySelectorAll('.h1, .h2').forEach(fitHeading);
    var z = 1;
    if (canvas) {
      // Первый экран — на высоту окна; в печати (PDF) страница фиксированная: 1464 × 912.
      var print = matchMedia('print').matches || root.dataset.print;
      var vh = window.innerHeight;
      // Главная: первый экран должен целиком поместиться в окно, поэтому масштаб учитывает и высоту.
      // Страницы кейсов — длинные, без экрана «на всю высоту»: всегда на всю ширину окна.
      var isCase = !!document.body.dataset.case;
      var z0 = isCase ? Math.min(vw / CANVAS, 1.4) : Math.min(vw / CANVAS, vh / HMIN, 1.4);
      // Высота экрана — целое число клеток: сетка идёт сквозь весь сайт без стыков.
      // Масштаб квантуется так, чтобы клетка на экране была ровно целым числом
      // физических пикселей (24 · z · dpr — целое). Иначе браузер рисует фон-сетку
      // с округлённым шагом, и к низу страницы клетки уезжают от линий и текста.
      var dpr = window.devicePixelRatio || 1;
      z = print ? 1 : Math.floor(z0 * C * dpr) / (C * dpr);
      // масштаб применяется до выравнивания: все замеры ниже — уже в масштабе
      root.style.setProperty('--z', String(z));
      var cells = Math.round(vh / (z * C));
      root.style.setProperty('--gx', ((vw / z - CANVAS) / 2 + C) + 'px');
      // На главной на всю высоту окна только первый экран; в PDF каждый блок — страница 912.
      var full = print ? '.screen' : (isCase ? null : '.hero');
      if (full) document.querySelectorAll(full).forEach(function (s) {
        remember(s);
        s.style.paddingBottom = '48px';
        s.style.height = (print ? 912 : cells * C) + 'px';
      });
    }
    centerLogos();
    document.querySelectorAll('.screen').forEach(function (s) {
      for (var pass = 0; pass < 3; pass++) {
        var base = s.getBoundingClientRect().top;
        for (var i = 0; i < s.children.length; i++) walk(s.children[i], base);
      }
      if (!s.style.height) {
        // высота блока — всегда целое число клеток, даже если текст дал доли пикселя
        remember(s);
        var h = s.getBoundingClientRect().height / zoom();
        s.style.height = (Math.abs(h - Math.round(h / C) * C) <= 2 ? Math.round(h / C) : Math.ceil(h / C)) * C + 'px';
      }
    });
    root.dataset.snapped = '1';
  }

  // Закреплённое меню: копия шапки первого экрана. При прокрутке вниз прячется, при прокрутке
  // вверх выезжает сверху синей полосой. Сама шапка остаётся в сетке; как только она снова
  // показалась вверху страницы, полоса уезжает.
  function stickyHead() {
    var head = document.querySelector('.head');
    if (!head) return;
    var bar = document.createElement('div');
    bar.className = 'head-bar';
    bar.setAttribute('aria-hidden', 'true');   // для экранных дикторов и клавиатуры есть сама шапка
    var copy = head.cloneNode(true);
    // без отступов, которые snap() поставил самой шапке: копия раскладывается заново
    [copy].concat([].slice.call(copy.querySelectorAll('[style]'))).forEach(function (el) { el.removeAttribute('style'); });
    copy.querySelectorAll('a').forEach(function (a) { a.tabIndex = -1; });
    bar.appendChild(copy);
    document.body.appendChild(bar);

    var lastY = window.scrollY, ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY;
      if (head.getBoundingClientRect().bottom > 0) {       // шапка видна — полоса не нужна
        bar.classList.remove('is-shown');
        lastY = y;
        return;
      }
      if (y < lastY - 4) bar.classList.add('is-shown');      // вверх
      else if (y > lastY + 4) bar.classList.remove('is-shown'); // вниз
      else return;
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
  }

  // Заголовки по словам: каждое слово — в строчном .aw со своей задержкой.
  // .aw не inline-block, поэтому переносы строк те же, что без анимации.
  function splitWords(h) {
    var walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT), nodes = [], n, i = 0;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      var frag = document.createDocumentFragment();
      t.textContent.split(/( +)/).forEach(function (p) {
        if (!p) return;
        if (/^ +$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        var w = document.createElement('span');
        w.className = 'aw';
        w.textContent = p;
        w.style.setProperty('--d', (i++ * 0.07).toFixed(2) + 's');
        frag.appendChild(w);
      });
      t.parentNode.replaceChild(frag, t);
    });
  }

  // Заголовки и большие стрелки запускаются, когда появляются на экране
  function reveal() {
    var targets = document.querySelectorAll('.h1, .h2, .arrow');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }

  // Клетка за курсором: копия сетки ярче, видна кругом вокруг курсора; клетка под ним закрашена.
  // Только там, где есть мышь.
  function gridGlow() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var glow = document.createElement('div'), cell = document.createElement('div');
    glow.className = 'grid-glow';
    glow.setAttribute('aria-hidden', 'true');
    cell.className = 'grid-glow__cell';
    glow.appendChild(cell);
    document.body.insertBefore(glow, document.body.firstChild);
    var x = 0, y = 0, raf = 0;
    function move() {
      raf = 0;
      // внутри body, увеличенного через zoom, координаты делим на масштаб
      var z = document.body.classList.contains('is-canvas') ? zoom() : 1;
      var px = x / z, py = y / z;
      var gx = parseFloat(getComputedStyle(glow).backgroundPositionX) || 0;
      glow.style.setProperty('--mx', px + 'px');
      glow.style.setProperty('--my', py + 'px');
      cell.style.left = Math.floor((px - gx) / C) * C + gx + 'px';
      cell.style.top = Math.floor(py / C) * C + 'px';
      glow.classList.add('is-on');
    }
    document.addEventListener('mousemove', function (e) {
      x = e.pageX; y = e.pageY;
      if (!raf) raf = requestAnimationFrame(move);
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { glow.classList.remove('is-on'); });
  }

  // Раскрывающиеся блоки: список цен (первые три услуги и кнопка «Смотреть все услуги»)
  // и вопросы-ответы (details, открыт только один ответ).
  // Высота экрана после раскрытия меняется — заново выравниваем по клетке.
  var relayoutTimer;
  function relayout() { clearTimeout(relayoutTimer); relayoutTimer = setTimeout(snap, 20); }
  function toggles() {
    document.querySelectorAll('.prices__more').forEach(function (btn) {
      var sec = btn.closest('.screen');
      var label = btn.querySelector('.u-link');
      var all = sec.querySelectorAll('.price').length;
      function set(open, quiet) {
        sec.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        label.textContent = open ? 'Свернуть' : 'Смотреть все услуги (' + all + ')';
        if (!quiet) relayout();
      }
      sec.classList.add('is-collapsible');
      set(false, true);
      btn.addEventListener('click', function () {
        var open = !sec.classList.contains('is-open');
        set(open);
        // свернули — возвращаемся к началу списка, чтобы не оказаться ниже блока
        if (!open) setTimeout(function () { sec.scrollIntoView({ block: 'start' }); }, 40);
      });
    });
    document.addEventListener('toggle', function (e) {   // details не всплывает — ловим на перехвате
      var item = e.target;
      if (item.matches && item.matches('.faq__item') && item.open) {
        document.querySelectorAll('.faq__item[open]').forEach(function (d) { if (d !== item) d.open = false; });
      }
      relayout();
    }, true);
  }

  var mode = null, t;
  function onResize() {
    var vw = root.clientWidth;
    var m = vw > FLUID_MAX ? 'canvas' : 'fluid';
    clearTimeout(t); t = setTimeout(function () { mode = m; snap(); }, 120);
  }

  function start() {
    mode = root.clientWidth > FLUID_MAX ? 'canvas' : 'fluid';
    // слова разбиваем до выравнивания: snap() меряет уже итоговые заголовки
    if (animate) document.querySelectorAll('.h1, .h2').forEach(splitWords);
    toggles();
    snap();
    stickyHead();
    if (animate) {
      reveal();
      gridGlow();
      root.classList.add('anim-go');
    }
    window.addEventListener('resize', onResize);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(start);
  });
})();
