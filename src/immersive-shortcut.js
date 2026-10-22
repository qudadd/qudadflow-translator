/* Shared shortcut format and a lightweight listener on already-authorized websites. */
(() => {
  if (globalThis.QFImmersiveShortcut) return;
  const DEFAULT = 'Shift+A', VERSION = 1;
  const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const keys = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`), 'Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Backspace', 'Backquote', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'];
  const names = new Map([...modifiers, ...keys].map(name => [name.toLowerCase(), name]));
  for (const [alias, name] of Object.entries({ control: 'Ctrl', cmd: 'Meta', command: 'Meta', win: 'Meta', option: 'Alt', spacebar: 'Space', '/': 'Slash', ',': 'Comma', '.': 'Period', '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote', '`': 'Backquote' })) names.set(alias, name);
  function parse(value) {
    if (value === '') return '';
    if (typeof value !== 'string') return null;
    const parts = value.split('+').map(part => names.get(part.trim().toLowerCase())), key = parts.pop();
    if (!keys.includes(key) || !parts.length && !/^F\d+$/.test(key) || new Set(parts).size !== parts.length || parts.some(part => !modifiers.includes(part))) return null;
    return [...modifiers.filter(part => parts.includes(part)), key].join('+');
  }
  function normalize(value) { return parse(value) ?? DEFAULT; }
  function resolve(preferences) {
    // 0.8.6 did not distinguish the old Ctrl+A default from an explicit choice.
    // Move that legacy value to the new default; subsequent choices are versioned.
    return preferences.immersiveShortcutVersion !== VERSION && preferences.immersiveShortcut === 'Ctrl+A' ? DEFAULT : normalize(preferences.immersiveShortcut);
  }
  function fromEvent(event) {
    const key = /^(?:Key[A-Z]|Digit[0-9])$/.test(event.code) ? event.code.replace(/^(Key|Digit)/, '') : event.code;
    if (!keys.includes(key) || event.getModifierState?.('AltGraph')) return '';
    return parse([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', key].filter(Boolean).join('+')) || '';
  }
  function editable(event) {
    return document.designMode === 'on' || event.composedPath().some(node => node?.nodeType === 1 && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) || node.matches('[role="textbox"],[role="searchbox"],[role="combobox"]')));
  }
  globalThis.QFImmersiveShortcut = Object.freeze({ DEFAULT, VERSION, parse, normalize, resolve, fromEvent });
  if (!/^https?:$/.test(globalThis.location?.protocol || '')) return;
  let shortcut = DEFAULT, allowed = false, refreshRevision = 0;
  async function refresh() {
    const revision = ++refreshRevision;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_IMMERSIVE_SHORTCUT' });
      if (revision === refreshRevision) { shortcut = normalize(result?.shortcut); allowed = Boolean(result?.allowed); }
    } catch { if (revision === refreshRevision) allowed = false; }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ('immersiveShortcut' in changes || 'immersiveShortcutVersion' in changes)) { allowed = false; refresh(); }
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'REFRESH_IMMERSIVE_SHORTCUT') return;
    allowed = false;
    refresh();
    sendResponse({ ok: true });
  });
  document.addEventListener('keydown', event => {
    if (!allowed || !shortcut || !event.isTrusted || event.defaultPrevented || event.repeat || event.isComposing || fromEvent(event) !== shortcut || editable(event)) return;
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: 'TRIGGER_IMMERSIVE_SHORTCUT' }).catch(() => { allowed = false; });
  }, true);
  refresh();
})();
