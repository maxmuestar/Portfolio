const page = document.body;
const root = document.documentElement;
const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-nav');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  accentIndex: 0,
  paletteOpen: false,
  modalOpen: false,
  paletteIndex: 0,
  lastScroll: 0,
  ticking: false,
  toastTimer: null,
};

const accents = [
  { orange: '#f36b3f', yellow: '#f6c453', rgb: '243, 107, 63' },
  { orange: '#64c7b2', yellow: '#d6eb83', rgb: '100, 199, 178' },
  { orange: '#e58acb', yellow: '#f4b267', rgb: '229, 138, 203' },
  { orange: '#82aaff', yellow: '#e2e8ff', rgb: '130, 170, 255' },
];

function setAccent(index) {
  state.accentIndex = (index + accents.length) % accents.length;
  const accent = accents[state.accentIndex];
  root.style.setProperty('--orange', accent.orange);
  root.style.setProperty('--yellow', accent.yellow);
  root.style.setProperty('--accent-rgb', accent.rgb);
  root.style.setProperty('--shadow-accent', `rgba(${accent.rgb}, .25)`);
  localStorage.setItem('max-accent', String(state.accentIndex));
}

function restoreAccent() {
  const savedAccent = Number(localStorage.getItem('max-accent'));
  if (Number.isInteger(savedAccent) && savedAccent >= 0) {
    setAccent(savedAccent);
  }
}

function showToast(message) {
  const toast = qs('.toast');
  if (!toast) return;
  qs('p', toast).textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

function closeMobileMenu() {
  navigation?.classList.remove('is-open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}

function setupMobileMenu() {
  if (!menuToggle || !navigation) return;
  menuToggle.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
  qsa('.main-nav a').forEach((link) => link.addEventListener('click', closeMobileMenu));
}

function setupRevealObserver() {
  const elements = qsa('.reveal');
  if (!('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  elements.forEach((element) => observer.observe(element));
}

function updateScrollUi() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  const progressBar = qs('.scroll-progress span');
  if (progressBar) progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
  const header = qs('.site-header');
  if (header) header.classList.toggle('is-scrolled', window.scrollY > 30);
  state.lastScroll = window.scrollY;
  state.ticking = false;
}

function setupScrollEffects() {
  updateScrollUi();
  window.addEventListener('scroll', () => {
    if (!state.ticking) {
      window.requestAnimationFrame(updateScrollUi);
      state.ticking = true;
    }
  }, { passive: true });
}

function setupCursor() {
  const dot = qs('.cursor-dot');
  const ring = qs('.cursor-ring');
  if (!dot || !ring || window.matchMedia('(pointer: coarse)').matches) return;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let ringX = pointerX;
  let ringY = pointerY;

  function moveRing() {
    ringX += (pointerX - ringX) * .18;
    ringY += (pointerY - ringY) * .18;
    ring.style.left = `${ringX}px`;
    ring.style.top = `${ringY}px`;
    window.requestAnimationFrame(moveRing);
  }

  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    dot.style.left = `${pointerX}px`;
    dot.style.top = `${pointerY}px`;
  }, { passive: true });

  window.addEventListener('pointerdown', () => ring.classList.add('is-clicking'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-clicking'));
  qsa('a, button, input, .project-card').forEach((element) => {
    element.addEventListener('mouseenter', () => ring.classList.add('is-hovering'));
    element.addEventListener('mouseleave', () => ring.classList.remove('is-hovering'));
  });
  moveRing();
}

function setupMagneticElements() {
  if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;
  qsa('.magnetic').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const bounds = element.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) * .16;
      const y = (event.clientY - bounds.top - bounds.height / 2) * .22;
      element.style.transform = `translate(${x}px, ${y}px)`;
    });
    element.addEventListener('pointerleave', () => {
      element.style.transform = '';
    });
  });
}

function setupTiltCards() {
  if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;
  qsa('[data-tilt-strength]').forEach((card) => {
    const strength = Number(card.dataset.tiltStrength) || 5;
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - .5) * strength;
      const y = ((event.clientY - bounds.top) / bounds.height - .5) * strength;
      card.style.setProperty('--tilt-y', `${x}deg`);
      card.style.setProperty('--tilt-x', `${-y}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-y', '0deg');
      card.style.setProperty('--tilt-x', '0deg');
    });
  });
}

function setupAmbientCanvas() {
  const canvas = qs('.ambient-canvas');
  if (!canvas || reduceMotion) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const particles = [];
  const pointer = { x: -1000, y: -1000 };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  function resize() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    createParticles();
  }

  function createParticles() {
    particles.length = 0;
    const count = Math.min(75, Math.max(28, Math.floor(width / 20)));
    for (let index = 0; index < count; index += 1) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + .35,
        speed: Math.random() * .16 + .04,
        angle: Math.random() * Math.PI * 2,
        alpha: Math.random() * .55 + .12,
      });
    }
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    particles.forEach((particle) => {
      const distanceX = pointer.x - particle.x;
      const distanceY = pointer.y - particle.y;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
      if (distance < 130) {
        particle.x -= distanceX / Math.max(distance, 1) * .18;
        particle.y -= distanceY / Math.max(distance, 1) * .18;
      }
      particle.angle += (Math.random() - .5) * .015;
      particle.x += Math.cos(particle.angle) * particle.speed;
      particle.y += Math.sin(particle.angle) * particle.speed;
      if (particle.x < -10) particle.x = width + 10;
      if (particle.x > width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = height + 10;
      if (particle.y > height + 10) particle.y = -10;
      context.beginPath();
      context.fillStyle = `rgba(${getComputedStyle(root).getPropertyValue('--accent-rgb')}, ${particle.alpha})`;
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    });
    window.requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, { passive: true });
  resize();
  draw();
}

function setupProjectFilters() {
  const buttons = qsa('.filter-button');
  const cards = qsa('.project-card[data-category]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      buttons.forEach((item) => item.classList.toggle('is-active', item === button));
      cards.forEach((card, index) => {
        const visible = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('is-hidden', !visible);
        if (visible) {
          card.style.animation = 'none';
          window.requestAnimationFrame(() => {
            card.style.animation = `card-pop .55s ${index * .08}s both`;
          });
        }
      });
      showToast(filter === 'all' ? 'Alle projecten zichtbaar.' : `${filter.toUpperCase()} projecten geselecteerd.`);
    });
  });
}

const projectData = {
  flux: {
    kicker: '01 / web development',
    title: 'Flux dashboard',
    description: 'Een rustig controlecentrum voor complexe data. Flux maakt dagelijkse signalen scanbaar met een interface die ruimte laat voor besluitvorming.',
    role: 'Frontend development',
    stack: 'HTML / CSS / JavaScript',
    status: 'Concept / live build',
  },
  atlas: {
    kicker: '02 / java application',
    title: 'Atlas API',
    description: 'Een schaalbare Java-basis die werk uit handen neemt. Atlas koppelt heldere domeinlogica aan endpoints die prettig zijn om mee te werken.',
    role: 'Backend development',
    stack: 'Java / REST / SQL',
    status: 'In development',
  },
};

function openProjectModal(projectName) {
  const data = projectData[projectName];
  const modal = qs('.project-modal');
  if (!data || !modal) return;
  qs('.modal-kicker', modal).textContent = data.kicker;
  qs('.modal-title', modal).textContent = data.title;
  qs('.modal-description', modal).textContent = data.description;
  qs('.modal-role', modal).textContent = data.role;
  qs('.modal-stack', modal).textContent = data.stack;
  qs('.modal-status', modal).textContent = data.status;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  state.modalOpen = true;
  page.classList.add('is-modal-open');
  qs('.modal-close', modal)?.focus();
}

function closeProjectModal() {
  const modal = qs('.project-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  state.modalOpen = false;
  page.classList.remove('is-modal-open');
}

function setupProjectModal() {
  qsa('.project-card[data-project]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      openProjectModal(card.dataset.project);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openProjectModal(card.dataset.project);
      }
    });
  });
  qs('.modal-close')?.addEventListener('click', closeProjectModal);
  qs('.modal-backdrop')?.addEventListener('click', closeProjectModal);
}

function openPalette() {
  const palette = qs('.command-palette');
  if (!palette) return;
  state.paletteOpen = true;
  state.paletteIndex = 0;
  palette.classList.add('is-open');
  palette.setAttribute('aria-hidden', 'false');
  page.classList.add('is-modal-open');
  const input = qs('.palette-search input');
  if (input) {
    input.value = '';
    input.focus();
  }
  updatePaletteFocus();
}

function closePalette() {
  const palette = qs('.command-palette');
  if (!palette) return;
  state.paletteOpen = false;
  palette.classList.remove('is-open');
  palette.setAttribute('aria-hidden', 'true');
  page.classList.remove('is-modal-open');
}

function updatePaletteFocus() {
  const commands = qsa('.palette-results button');
  commands.forEach((command, index) => command.classList.toggle('is-focused', index === state.paletteIndex));
}

function executeCommand(command) {
  const targets = { work: '#work', about: '#about', lab: '#lab', contact: '#contact' };
  if (command === 'theme') {
    setAccent(state.accentIndex + 1);
    showToast('Accentkleur aangepast.');
    closePalette();
    return;
  }
  if (targets[command]) {
    closePalette();
    document.querySelector(targets[command])?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }
}

function setupCommandPalette() {
  qsa('[data-command]').forEach((button) => button.addEventListener('click', () => executeCommand(button.dataset.command)));
  qs('.palette-backdrop')?.addEventListener('click', closePalette);
  qs('.palette-trigger')?.addEventListener('click', openPalette);
  qs('.palette-search input')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    qsa('.palette-results button').forEach((button) => {
      button.hidden = query && !button.textContent.toLowerCase().includes(query);
    });
  });
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      state.paletteOpen ? closePalette() : openPalette();
      return;
    }
    if (event.key === 'Escape') {
      closePalette();
      closeProjectModal();
      return;
    }
    if (state.paletteOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const commands = qsa('.palette-results button:not([hidden])');
      state.paletteIndex = (state.paletteIndex + direction + commands.length) % commands.length;
      updatePaletteFocus();
      return;
    }
    if (state.paletteOpen && event.key === 'Enter') {
      const command = qsa('.palette-results button')[state.paletteIndex];
      if (command) executeCommand(command.dataset.command);
    }
  });
}

function setupThemeControl() {
  qs('.theme-trigger')?.addEventListener('click', () => {
    setAccent(state.accentIndex + 1);
    showToast(`Accent ${state.accentIndex + 1} van ${accents.length} actief.`);
  });
}

function setupCounters() {
  const counters = qsa('[data-count]');
  if (!counters.length) return;
  const runCounter = (counter) => {
    const target = Number(counter.dataset.count);
    const duration = target > 50 ? 1200 : 800;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) {
    counters.forEach(runCounter);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        runCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .7 });
  counters.forEach((counter) => observer.observe(counter));
}

const terminalCommands = {
  help: ['Beschikbare commando\'s:', 'help     toon dit overzicht', 'about    wie is Max?', 'skills   huidige stack', 'clear    maak de terminal leeg'],
  about: ['Max bouwt interfaces die helder voelen en systemen die lang mee kunnen.', 'Focus: web, Java, interactie.'],
  skills: ['HTML .............. semantic structure', 'CSS ............... expressive motion', 'Java .............. reliable logic', 'JavaScript ........ curious interaction'],
};

function writeTerminalLine(text, className = '') {
  const output = qs('.terminal-output');
  if (!output) return;
  const line = document.createElement('p');
  line.textContent = text;
  if (className) line.className = className;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function setupTerminal() {
  const form = qs('.terminal-form');
  const input = qs('#terminal-input');
  const output = qs('.terminal-output');
  if (!form || !input || !output) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const command = input.value.trim().toLowerCase();
    if (!command) return;
    writeTerminalLine(`max@studio:~$ ${command}`);
    if (command === 'clear') {
      output.innerHTML = '';
    } else if (terminalCommands[command]) {
      terminalCommands[command].forEach((line) => writeTerminalLine(line, line.includes('Beschikbare') ? 'terminal-accent' : ''));
    } else {
      writeTerminalLine(`command not found: ${command}. Probeer 'help'.`, 'terminal-accent');
    }
    input.value = '';
  });
  qs('[data-terminal-clear]')?.addEventListener('click', () => {
    output.innerHTML = '';
    input.focus();
  });
  qs('[data-terminal]')?.addEventListener('click', () => input.focus());
}

function setupExperiments() {
  qsa('[data-experiment]').forEach((card) => {
    card.addEventListener('click', () => {
      const names = { colors: 'Color engine gestart.', type: 'Type playground geopend.', grid: 'Grid system geactiveerd.' };
      setAccent(state.accentIndex + 1);
      showToast(names[card.dataset.experiment] || 'Experiment gestart.');
      card.classList.add('is-fired');
      setTimeout(() => card.classList.remove('is-fired'), 650);
    });
  });
}

function setupSmartAnchors() {
  qsa('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      closeMobileMenu();
    });
  });
}

function setupPageEntry() {
  page.classList.add('is-ready');
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => page.classList.add('fonts-ready'));
  }
}

function boot() {
  restoreAccent();
  setupPageEntry();
  setupMobileMenu();
  setupRevealObserver();
  setupScrollEffects();
  setupCursor();
  setupMagneticElements();
  setupTiltCards();
  setupAmbientCanvas();
  setupProjectFilters();
  setupProjectModal();
  setupCommandPalette();
  setupKeyboardShortcuts();
  setupThemeControl();
  setupCounters();
  setupTerminal();
  setupExperiments();
  setupSmartAnchors();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
