const STORAGE_KEY = 'mekans-desk-motion';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';
const MOTION_STATE = { SYSTEM: 'system', PLAYING: 'playing', PAUSED: 'paused' };

export function startPreviewMotion({
  window: browserWindow = globalThis.window,
  document = browserWindow?.document,
} = {}) {
  const button = document?.querySelector('#desk-motion-toggle');
  const sources =
    document?.querySelectorAll(
      'picture source[media*="prefers-reduced-motion"]',
    ) ?? [];
  if (!button || sources.length === 0) {
    return () => {};
  }

  const originalMedia = new Map(
    Array.from(sources, (source) => [source, source.getAttribute('media')]),
  );
  const mediaQuery = browserWindow?.matchMedia?.(REDUCED_MOTION_MEDIA);
  let state = MOTION_STATE.SYSTEM;
  try {
    const saved = browserWindow.localStorage.getItem(STORAGE_KEY);
    if ([MOTION_STATE.PLAYING, MOTION_STATE.PAUSED].includes(saved)) {
      state = saved;
    }
  } catch {
    state = MOTION_STATE.SYSTEM;
  }

  const persistState = () => {
    try {
      browserWindow.localStorage.setItem(STORAGE_KEY, state);
    } catch {
      return;
    }
  };
  const query = new URLSearchParams(browserWindow?.location?.search ?? '').get(
    'motion',
  );
  if (query === 'play' || query === 'pause') {
    state = query === 'play' ? MOTION_STATE.PLAYING : MOTION_STATE.PAUSED;
    persistState();
  }

  const isPlaying = () =>
    state === MOTION_STATE.PLAYING ||
    (state === MOTION_STATE.SYSTEM && !mediaQuery?.matches);
  const applyState = () => {
    const playing = isPlaying();
    for (const [source, original] of originalMedia) {
      const pausedMedia =
        original
          .split(/\s+and\s+/)
          .map((term) => term.trim())
          .filter((term) => term !== REDUCED_MOTION_MEDIA)
          .join(' and ') || 'all';
      source.setAttribute(
        'media',
        state === MOTION_STATE.SYSTEM
          ? original
          : playing
            ? 'not all'
            : pausedMedia,
      );
    }
    button.textContent = playing ? 'Pause animations' : 'Play animations';
    button.setAttribute('aria-pressed', String(playing));
  };
  const toggle = () => {
    state = isPlaying() ? MOTION_STATE.PAUSED : MOTION_STATE.PLAYING;
    applyState();
    persistState();
  };
  const onSystemChange = () => {
    if (state === MOTION_STATE.SYSTEM) {
      applyState();
    }
  };

  applyState();
  button.addEventListener('click', toggle);
  mediaQuery?.addEventListener('change', onSystemChange);
  return () => {
    button.removeEventListener('click', toggle);
    mediaQuery?.removeEventListener('change', onSystemChange);
    for (const [source, original] of originalMedia) {
      source.setAttribute('media', original);
    }
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  startPreviewMotion();
}
