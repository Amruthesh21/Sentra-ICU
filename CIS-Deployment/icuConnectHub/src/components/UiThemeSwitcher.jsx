import { useEffect, useRef, useState } from 'react';
import { useUiTheme } from '../context/UiThemeContext';

const THEME_ICONS = {
  classic: '◫',
  glass: '◇',
  clinical: '▤',
  soft: '◯',
};

export default function UiThemeSwitcher() {
  const { themeId, setTheme, themes } = useUiTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const current = themes.find((t) => t.id === themeId) || themes[0];

  return (
    <div className="ui-theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="ui-theme-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Change application UI style"
      >
        <span className="ui-theme-trigger-icon" aria-hidden>{THEME_ICONS[themeId] || '◫'}</span>
        <span className="ui-theme-trigger-label">UI</span>
      </button>

      {open && (
        <div className="ui-theme-panel" role="listbox" aria-label="Application UI style">
          <div className="ui-theme-panel-head">
            <strong>Application look</strong>
            <span>Same colors · different layout feel</span>
          </div>
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={t.id === themeId}
              className={`ui-theme-option${t.id === themeId ? ' active' : ''}`}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
            >
              <span className="ui-theme-option-icon">{THEME_ICONS[t.id]}</span>
              <span className="ui-theme-option-text">
                <span className="ui-theme-option-title">{t.label}</span>
                <span className="ui-theme-option-hint">{t.hint}</span>
              </span>
              {t.id === themeId && <span className="ui-theme-check">✓</span>}
            </button>
          ))}
          <p className="ui-theme-foot">Current: <strong>{current.label}</strong></p>
        </div>
      )}
    </div>
  );
}
