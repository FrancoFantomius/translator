import { t, onLanguageChange } from './i18.js';

// Theme Management: 'system' (default) | 'light' | 'dark'

const themeListeners = new Set();
let currentTheme = localStorage.getItem('app_theme') || 'system';
let globalNotify = null;

export function getTheme() {
  return currentTheme;
}

export function onThemeChange(callback) {
  themeListeners.add(callback);
  return () => themeListeners.delete(callback);
}

function updateThemeButtonUI() {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeTooltip = document.getElementById('theme-toggle-tooltip');
  if (themeToggleBtn) {
    if (currentTheme === 'system') {
      themeToggleBtn.icon = 'brightness_auto';
      themeToggleBtn.setAttribute('aria-label', t('header.themeAuto'));
      if (themeTooltip) themeTooltip.value = t('header.themeAuto');
    } else if (currentTheme === 'dark') {
      themeToggleBtn.icon = 'dark_mode';
      themeToggleBtn.setAttribute('aria-label', t('header.themeDark'));
      if (themeTooltip) themeTooltip.value = t('header.themeDark');
    } else {
      themeToggleBtn.icon = 'light_mode';
      themeToggleBtn.setAttribute('aria-label', t('header.themeLight'));
      if (themeTooltip) themeTooltip.value = t('header.themeLight');
    }
    themeToggleBtn.removeAttribute('title');
  }
}

export function setTheme(mode, showNotification = true) {
  currentTheme = mode;
  localStorage.setItem('app_theme', mode);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const isSystemDark = mediaQuery.matches;
  const effectiveDark = mode === 'system' ? isSystemDark : mode === 'dark';

  if (effectiveDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  updateThemeButtonUI();

  for (const listener of themeListeners) {
    try {
      listener(currentTheme);
    } catch {
      // ignore
    }
  }

  if (showNotification && globalNotify) {
    globalNotify(t('notifications.themeChanged'));
  }
}

export function initTheme(notify) {
  globalNotify = notify;
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Listen for OS system theme changes
  mediaQuery.addEventListener('change', () => {
    if (currentTheme === 'system') {
      setTheme('system', false);
    }
  });

  // Apply default/saved theme on load
  setTheme(currentTheme, false);

  onLanguageChange(() => {
    updateThemeButtonUI();
  });

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const cycle = {
        system: 'light',
        light: 'dark',
        dark: 'system'
      };
      const nextMode = cycle[currentTheme] || 'light';
      setTheme(nextMode, true);
    });
  }
}
