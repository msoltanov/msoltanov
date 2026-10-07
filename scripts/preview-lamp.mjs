const STORAGE_KEY = 'mekans-desk-lamp';
const WORKSPACE_IMAGE = 'img[data-seasonal-workspace], img[src*="/workshop-"]';

export function startPreviewLamp({
  window: browserWindow = globalThis.window,
  document = browserWindow?.document,
} = {}) {
  const button = document?.querySelector('#desk-lamp-toggle');
  const image = document?.querySelector(WORKSPACE_IMAGE);
  if (!button || !image) {
    return () => {};
  }

  let state = 'on';
  try {
    if (browserWindow.localStorage.getItem(STORAGE_KEY) === 'off') {
      state = 'off';
    }
  } catch {
    state = 'on';
  }

  const applyState = () => {
    const replaceVariant = (value) =>
      value.replace(
        /workshop(-mobile)?(?:-lamp-off)?-(dark|light)\.(gif|svg)/g,
        (original, layout = '', theme, extension) =>
          `workshop${layout}${state === 'off' ? '-lamp-off' : ''}-${theme}.${extension}`,
      );
    for (const source of image.closest('picture')?.querySelectorAll('source') ??
      []) {
      const value = source.getAttribute('srcset');
      if (typeof value === 'string') {
        source.setAttribute('srcset', replaceVariant(value));
      }
    }
    const src = image.getAttribute('src');
    if (typeof src === 'string') {
      image.setAttribute('src', replaceVariant(src));
    }
    button.setAttribute('aria-pressed', String(state === 'on'));
    button.setAttribute(
      'title',
      `Turn desk lamp ${state === 'on' ? 'off' : 'on'}`,
    );
  };

  const toggle = () => {
    state = state === 'on' ? 'off' : 'on';
    applyState();
    try {
      browserWindow.localStorage.setItem(STORAGE_KEY, state);
    } catch {
      return;
    }
  };

  applyState();
  button.addEventListener('click', toggle);
  return () => button.removeEventListener('click', toggle);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startPreviewLamp();
}
