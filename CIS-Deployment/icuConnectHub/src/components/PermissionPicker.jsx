import { useMemo } from 'react';
import { ALL_ASSIGNABLE_KEYS, PERMISSION_GROUPS } from '../constants/permissionsCatalog';

export default function PermissionPicker({ value = [], onChange, disabled = false }) {
  const selected = useMemo(() => new Set(value), [value]);

  const allSelected = ALL_ASSIGNABLE_KEYS.length > 0
    && ALL_ASSIGNABLE_KEYS.every((k) => selected.has(k));

  function setSelected(nextSet) {
    onChange(ALL_ASSIGNABLE_KEYS.filter((k) => nextSet.has(k)));
  }

  function toggle(key) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function toggleGroup(group) {
    const keys = group.permissions.map((p) => p.key);
    const next = new Set(selected);
    const allOn = keys.every((k) => next.has(k));
    keys.forEach((k) => {
      if (allOn) next.delete(k);
      else next.add(k);
    });
    setSelected(next);
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...ALL_ASSIGNABLE_KEYS]);
    }
  }

  return (
    <div className="permission-picker">
      <div className="permission-picker-toolbar">
        <span className="permission-picker-count">
          {selected.size} of {ALL_ASSIGNABLE_KEYS.length} selected
        </span>
        <button
          type="button"
          className="permission-picker-select-all"
          onClick={toggleAll}
          disabled={disabled}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <div className="permission-picker-groups">
        {PERMISSION_GROUPS.map((group) => {
          const keys = group.permissions.map((p) => p.key);
          const groupAll = keys.every((k) => selected.has(k));
          const groupSome = keys.some((k) => selected.has(k));

          return (
            <section key={group.id} className="permission-picker-group">
              <div className="permission-picker-group-head">
                <h4>{group.title}</h4>
                <button
                  type="button"
                  className="permission-picker-group-toggle"
                  onClick={() => toggleGroup(group)}
                  disabled={disabled}
                >
                  {groupAll ? 'Clear section' : groupSome ? 'Select section' : 'Select section'}
                </button>
              </div>
              <ul className="permission-picker-list">
                {group.permissions.map((perm) => (
                  <li key={perm.key}>
                    <label className={`permission-picker-item${selected.has(perm.key) ? ' is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(perm.key)}
                        onChange={() => toggle(perm.key)}
                        disabled={disabled}
                      />
                      <span className="permission-picker-item-text">
                        <strong>{perm.label}</strong>
                        <small>{perm.hint}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
