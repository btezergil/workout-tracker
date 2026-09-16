(() => {
  'use strict';

  const HISTORY_KEY = 'workout_history';

  function updateWorkoutCounts() {
    if (typeof WORKOUTS !== 'object' || !WORKOUTS) return;
    document.querySelectorAll('#screen-home .split-card[onclick^="openWorkout("]').forEach(card => {
      const match = card.getAttribute('onclick')?.match(/openWorkout\('([^']+)'\)/);
      if (!match) return;
      const workout = WORKOUTS[match[1]];
      if (!workout?.groups) return;
      const count = workout.groups.reduce((sum, group) => sum + (group.exercises?.length || 0), 0);
      const meta = card.querySelector('.split-meta');
      if (!meta || !count) return;
      meta.textContent = meta.textContent.replace(/\b\d+\s+(exercises?|exercise pairs|moves?)\b/i, `${count} exercises`);
    });
  }

  function readHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  }

  function isValidRecord(record) {
    return record && typeof record === 'object' &&
      (typeof record.id === 'number' || typeof record.id === 'string') &&
      typeof record.workoutId === 'string' &&
      typeof record.workoutName === 'string' &&
      Array.isArray(record.exercises);
  }

  async function exportHistory() {
    const history = readHistory();
    const payload = JSON.stringify(history, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `workout-history-${date}.json`;
    const file = new File([payload], filename, { type: 'application/json' });

    try {
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: 'Workout history backup' });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importHistory(file) {
    let imported;
    try {
      imported = JSON.parse(await file.text());
    } catch {
      alert('Could not read this file as JSON.');
      return;
    }

    if (!Array.isArray(imported) || !imported.every(isValidRecord)) {
      alert('This does not look like a valid workout history export. Nothing was changed.');
      return;
    }

    const existing = readHistory();
    const existingIds = new Set(existing.map(record => String(record.id)));
    const additions = imported.filter(record => !existingIds.has(String(record.id)));

    if (!confirm(`Import ${imported.length} sessions? ${additions.length} are new. Existing sessions will be kept and duplicates skipped.`)) return;

    const merged = [...existing, ...additions].sort((a, b) => Number(b.id) - Number(a.id));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
    if (typeof renderHistory === 'function') renderHistory();
    alert(`Import complete. Added ${additions.length} session${additions.length === 1 ? '' : 's'}.`);
  }

  function installHistoryTransferUI() {
    const topbar = document.querySelector('#screen-history .topbar');
    if (!topbar || document.getElementById('history-transfer-actions')) return;

    const clear = topbar.querySelector('.topbar-action');
    if (!clear) return;

    const actions = document.createElement('div');
    actions.id = 'history-transfer-actions';
    actions.className = 'history-transfer-actions';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'history-transfer-btn';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', exportHistory);

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'history-transfer-btn';
    importBtn.textContent = 'Import';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) await importHistory(file);
      input.value = '';
    });
    importBtn.addEventListener('click', () => input.click());

    clear.remove();
    clear.classList.add('history-clear-btn');
    actions.append(exportBtn, importBtn, clear, input);
    topbar.appendChild(actions);
  }

  function installStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #screen-workout { height: 100dvh; min-height: 0; overflow: hidden; }
      #screen-workout .topbar { flex-shrink: 0; }
      #screen-workout .timer-bar {
        position: sticky;
        top: 0;
        z-index: 9;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(0,0,0,.28);
      }
      #screen-workout .scroll-area { min-height: 0; }
      .history-transfer-actions { display: flex; align-items: center; gap: 10px; }
      .history-transfer-btn, .history-clear-btn {
        appearance: none;
        border: 0;
        background: none;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        padding: 5px 0;
      }
      .history-transfer-btn { color: var(--push); }
      .history-clear-btn { color: #cc4444; }
      @media (max-width: 380px) {
        .history-transfer-actions { gap: 8px; }
        .history-transfer-btn, .history-clear-btn { font-size: 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    installStyles();
    installHistoryTransferUI();
    updateWorkoutCounts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
