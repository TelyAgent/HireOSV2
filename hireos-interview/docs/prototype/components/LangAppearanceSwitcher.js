// Shared top-bar control: language toggle (中/EN) + appearance (theme/accent/text size) toggle & panel.
// Loaded via <x-import from="./components/LangAppearanceSwitcher.js" component="LangAppearanceSwitcher" .../>
function cssToStyle(css) {
  var out = {};
  (css || '').split(';').forEach(function (decl) {
    var i = decl.indexOf(':');
    if (i < 0) return;
    var prop = decl.slice(0, i).trim();
    var val = decl.slice(i + 1).trim();
    if (!prop) return;
    if (prop.indexOf('--') === 0) { out[prop] = val; return; }
    out[prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = val;
  });
  return out;
}

function LangAppearanceSwitcher(props) {
  var e = React.createElement;
  var t = props.t || {};

  var langButton = e('button', {
    onClick: props.onToggleLang,
    style: cssToStyle('height:32px;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:var(--surface);cursor:pointer;font-size:12.5px;color:var(--ink-2);font-weight:600')
  }, props.langLabel);

  var appearanceButton = e('button', {
    onClick: props.onToggleAppearance,
    style: cssToStyle('height:32px;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:var(--surface);cursor:pointer;font-size:12.5px;color:var(--ink-2);display:flex;align-items:center;gap:6px')
  },
    e('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      e('circle', { cx: 12, cy: 12, r: 4 }),
      e('path', { d: 'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' })
    ),
    t.appearance
  );

  var panel = !props.showAppearance ? null : e('div', {
    role: 'dialog',
    'aria-label': t.appearance,
    style: cssToStyle('position:fixed;top:96px;right:20px;width:min(280px,calc(100vw - 32px));background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.22);z-index:71;padding:16px')
  },
    e('div', { style: cssToStyle('font-size:13px;font-weight:700') }, t.appearance),
    e('div', { style: cssToStyle('margin-top:12px;font-size:11px;font-weight:600;color:var(--ink-3);letter-spacing:.04em') }, t.theme),
    e('div', { style: cssToStyle('margin-top:7px;display:grid;grid-template-columns:repeat(2,1fr);gap:7px') },
      (props.themeOptions || []).map(function (opt, i) {
        return e('button', { key: i, onClick: opt.pick, style: cssToStyle(opt.style) }, opt.label);
      })
    ),
    e('div', { style: cssToStyle('margin-top:14px;font-size:11px;font-weight:600;color:var(--ink-3);letter-spacing:.04em') }, t.accentColor),
    e('div', { style: cssToStyle('margin-top:7px;display:flex;gap:9px') },
      (props.accentOptions || []).map(function (opt, i) {
        return e('button', { key: i, 'aria-label': opt.label, onClick: opt.pick, style: cssToStyle(opt.style) });
      })
    ),
    e('div', { style: cssToStyle('margin-top:14px;font-size:11px;font-weight:600;color:var(--ink-3);letter-spacing:.04em') }, t.textSize),
    e('div', { style: cssToStyle('margin-top:7px;display:grid;grid-template-columns:repeat(3,1fr);gap:7px') },
      (props.textSizeOptions || []).map(function (opt, i) {
        return e('button', { key: i, onClick: opt.pick, style: cssToStyle(opt.style) }, opt.label);
      })
    ),
    e('button', {
      onClick: props.onResetPrefs,
      style: cssToStyle('margin-top:15px;width:100%;height:32px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--ink-2);font-size:12px;cursor:pointer')
    }, t.resetDefaults)
  );

  return e(React.Fragment, null, langButton, appearanceButton, panel);
}

module.exports = { LangAppearanceSwitcher: LangAppearanceSwitcher };
