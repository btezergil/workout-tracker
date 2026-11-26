const movementLibrary = (() => {
  'use strict';

  const storageKey = 'workout_movements_v1';
  const movesByGroup = {
    Chest: [
      'Barbell bench press', 'Decline machine chest press', 'Incline dumbbell press',
      'Incline machine chest press', 'Low-to-high cable fly', 'Machine chest press',
      'Pec deck fly', 'Plate-loaded chest press'
    ],
    Shoulders: [
      'Cable face pull', 'Cable lateral raise', 'Lateral raise', 'Reverse pec deck fly',
      'Seated dumbbell shoulder press', 'Seated machine shoulder press', 'Shoulder press'
    ],
    Back: [
      'Assisted pull-up', 'Chest-supported machine row', 'Dumbbell shrug',
      'Incline-bench I-Y-T raise', 'Lat pulldown', 'Pull-up (unassisted)',
      'Seated cable row', 'Single-arm row', 'Straight-arm cable pulldown'
    ],
    Biceps: [
      'Bayesian cable curl', 'Dumbbell hammer curl', 'EZ-bar curl', 'Preacher curl'
    ],
    Triceps: [
      'Cable pushdown', 'Overhead cable triceps extension', 'Parallel-bar dip',
      'Rope triceps pushdown', 'Single-arm cable pushdown'
    ],
    Forearms: ['Dead hang', 'Dumbbell forearm pronation / supination', 'Straight-bar finger curl', 'Wrist roller'],
    Abs: ['Abdominal crunch machine', 'Hanging leg raise', 'Plank'],
    Legs: ['Barbell back squat', 'Dumbbell reverse lunge', 'Dumbbell Romanian deadlift']
  };
  const moveDetails = {
    'Assisted pull-up': { assisted: true },
    'Dead hang': { unit: 'sec', noLoad: 'Bodyweight' },
    'Hanging leg raise': { noLoad: 'Bodyweight' },
    'Incline-bench I-Y-T raise': { unit: 'cycles', noLoad: 'Unweighted' },
    'Parallel-bar dip': { noLoad: 'Bodyweight' },
    'Pec deck fly': { alias: 'Pec fly' },
    Plank: { unit: 'sec', noLoad: 'Bodyweight' },
    'Pull-up (unassisted)': { noLoad: 'Bodyweight' },
    'Reverse pec deck fly': { id: 'Reverse pec deck', alias: 'Reverse pec deck' }
  };
  const categories = Object.keys(movesByGroup);
  const seeds = categories.flatMap(category => movesByGroup[category].map(name => ({
    id: name, name, category, unit: 'reps', ...moveDetails[name]
  })));
  const seedsByName = new Map(seeds.map(move => [move.name, move]));
  for (const move of seeds) {
    if (move.alias) seedsByName.set(move.alias, move);
  }

  const list = document.getElementById('movement-list');
  const search = document.getElementById('movement-search');
  const filter = document.getElementById('movement-category');
  const status = document.getElementById('movement-status');
  const addButton = document.getElementById('movement-add');
  const backButton = document.getElementById('movement-back');
  const dialog = document.getElementById('movement-dialog');
  const form = document.getElementById('movement-editor');
  const fields = form.elements;
  const removeButton = document.getElementById('movement-remove');
  const error = document.getElementById('movement-error');
  let moves = [];
  let editing = null;
  let workoutScroll = 0;

  function readEntries() {
    try {
      const entries = JSON.parse(localStorage.getItem(storageKey));
      return entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {};
    } catch {
      return {};
    }
  }

  function numberOrNull(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function betterRecord(candidate, previous) {
    if (!candidate) return previous;
    if (!previous) return candidate;
    const difference = (candidate.kg ?? 0) - (previous.kg ?? 0);
    return difference > 0 || (difference === 0 && (candidate.count ?? 0) > (previous.count ?? 0))
      ? candidate : previous;
  }

  function customMoves(entries) {
    return Object.entries(entries)
      .filter(([id, entry]) => id.startsWith('custom-') && entry?.name && categories.includes(entry.category))
      .map(([id, entry]) => ({ ...entry, id, custom: true, noLoad: 'Unweighted' }));
  }

  function choices(category) {
    return [...seeds, ...customMoves(readEntries())]
      .filter(move => move.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function workoutStats(custom) {
    const movesById = new Map([...seeds, ...custom].map(move => [move.id, move]));
    const stats = new Map();
    // getHistory is already sorted by when the workout was performed.
    for (const workout of getHistory()) {
      if (typeof workout?.workoutId !== 'string' || !workout.workoutId.startsWith('gym-') ||
          !Array.isArray(workout.exercises)) continue;
      for (const exercise of workout.exercises) {
        const move = movesById.get(exercise?.movementId) ?? seedsByName.get(exercise?.name);
        if (!move || !Array.isArray(exercise.sets)) continue;
        const summary = stats.get(move.id) ?? { latest: null, pr: null };
        // Use the last completed set with a known load in the latest session.
        for (let i = exercise.sets.length - 1; i >= 0; i--) {
          const set = exercise.sets[i];
          if (!set || set.done === false) continue;
          const count = numberOrNull(set.reps);
          let kg = numberOrNull(set.kg);
          if (kg === null && move.noLoad && count > 0) kg = 0;
          if (kg === null || (move.assisted && kg >= 0)) continue;
          summary.latest ??= { kg, count: count > 0 ? count : null };
          if (count > 0) summary.pr = betterRecord({ kg, count }, summary.pr);
        }
        stats.set(move.id, summary);
      }
    }
    return stats;
  }

  function refresh() {
    const entries = readEntries();
    const custom = customMoves(entries);
    const stats = workoutStats(custom);
    moves = [
      ...seeds.map(move => ({ ...move, ...entries[move.id], history: stats.get(move.id) })),
      ...custom.map(move => ({ ...move, history: stats.get(move.id) }))
    ].sort((a, b) => a.name.localeCompare(b.name));
    renderList();
  }

  function loadText(kg, move) {
    if (kg === null || kg === undefined) return '—';
    if (kg < 0) return `${-kg} kg assist`;
    if (kg === 0 && move.noLoad) return move.noLoad;
    return `${kg} kg`;
  }

  function workingText(move) {
    const latest = move.history?.latest;
    const kg = move.workingKg ?? latest?.kg ?? null;
    const load = loadText(kg, move);
    if (move.unit !== 'sec') return load;
    const seconds = move.workingSeconds ?? (latest?.kg === kg ? latest.count : null);
    if (seconds === null) return load;
    return kg === null ? `${seconds} sec` : `${load} × ${seconds} sec`;
  }

  function recordText(record, move) {
    if (!record) return '—';
    const { kg, count } = record;
    if (count === null) return loadText(kg, move);
    const unit = move.unit === 'sec' ? 'sec' : move.unit === 'cycles' ? 'cycles' : count === 1 ? 'rep' : 'reps';
    const amount = `${count} ${unit}`;
    return kg === null || (kg === 0 && move.noLoad) ? amount : `${loadText(kg, move)} × ${amount}`;
  }

  function renderList() {
    const query = search.value.trim().toLowerCase();
    const groups = filter.value ? [filter.value] : categories;
    const template = document.getElementById('movement-card-template');
    list.replaceChildren();
    for (const category of groups) {
      const matches = moves.filter(move => move.category === category &&
        [move.name, move.alias, move.setup].some(value => value?.toLowerCase().includes(query)));
      if (query && !matches.length) continue;
      const group = document.createElement('section');
      group.className = 'movement-group';
      const heading = document.createElement('h2');
      heading.textContent = category;
      group.append(heading);
      if (!matches.length) {
        const empty = document.createElement('p');
        empty.className = 'movement-help';
        empty.textContent = 'No moves yet.';
        group.append(empty);
      }
      for (const move of matches) {
        const card = template.content.firstElementChild.cloneNode(true);
        card.dataset.movement = move.id;
        card.querySelector('.movement-card-name').textContent = move.name;
        const note = card.querySelector('.movement-note');
        note.textContent = move.setup ?? '';
        note.hidden = !move.setup;
        card.querySelector('.movement-working-label').textContent = move.unit === 'sec' ? 'Working set' : 'Working weight';
        card.querySelector('.movement-weight').textContent = workingText(move);
        card.querySelector('.movement-pr').textContent = recordText(betterRecord(move.pr, move.history?.pr), move);
        card.onclick = () => edit(move);
        group.append(card);
      }
      list.append(group);
    }
    if (!list.childElementCount) {
      const empty = document.createElement('p');
      empty.className = 'movement-help';
      empty.textContent = 'No matching movements.';
      list.append(empty);
    }
  }

  function setTrackingFields(unit) {
    const timed = unit === 'sec';
    fields.workingSeconds.disabled = !timed;
    fields.workingSeconds.parentElement.hidden = !timed;
    document.getElementById('movement-count-label').textContent =
      timed ? 'PR seconds' : unit === 'cycles' ? 'PR cycles' : 'PR reps';
  }

  function edit(move) {
    editing = move;
    form.reset();
    error.textContent = '';
    const customFields = document.getElementById('movement-custom-fields');
    const isSeed = Boolean(move && !move.custom);
    customFields.hidden = customFields.disabled = isSeed;
    removeButton.hidden = !move?.custom;
    document.getElementById('movement-editor-title').textContent = move?.name ?? 'Add movement';
    fields.moveName.value = move?.name ?? '';
    fields.category.value = move?.category ?? filter.value;
    fields.unit.value = move?.unit === 'sec' ? 'sec' : 'reps';
    fields.setup.value = move?.setup ?? '';
    fields.workingKg.value = move?.workingKg ?? '';
    fields.workingKg.placeholder = isSeed ? 'Use last logged load' : '';
    fields.workingSeconds.value = move?.workingSeconds ?? '';
    fields.prKg.value = move?.pr?.kg ?? '';
    fields.prCount.value = move?.pr?.count ?? '';
    setTrackingFields(move?.unit ?? 'reps');
    const latest = move?.history?.latest;
    document.getElementById('movement-history-summary').textContent = latest
      ? `Last logged ${recordText(latest, move)} · Best logged set ${recordText(move.history.pr, move)}` : '';
    dialog.showModal();
  }

  function save(event) {
    event.preventDefault();
    const isCustom = !editing || editing.custom;
    const entry = {
      setup: fields.setup.value.trim(),
      workingKg: numberOrNull(fields.workingKg.value),
      pr: null
    };
    if (!fields.workingSeconds.disabled) entry.workingSeconds = numberOrNull(fields.workingSeconds.value);
    const kg = numberOrNull(fields.prKg.value);
    const count = numberOrNull(fields.prCount.value);
    if (kg !== null || count !== null) entry.pr = { kg, count };
    if (editing?.assisted && ((entry.workingKg !== null && entry.workingKg >= 0) ||
        (entry.pr && (kg === null || kg >= 0)))) {
      error.textContent = 'Enter a negative weight for this assisted movement.';
      return;
    }
    if (isCustom) {
      entry.name = fields.moveName.value.trim();
      entry.category = fields.category.value;
      entry.unit = fields.unit.value;
      const name = entry.name.toLowerCase();
      if (!name || moves.some(move => move.id !== editing?.id &&
          [move.name, move.alias].some(value => value?.toLowerCase() === name))) {
        error.textContent = name ? 'This name is already in use. Include the machine or setup in the name.' : 'Enter a movement name.';
        fields.moveName.focus();
        return;
      }
    }

    const id = editing?.id ?? `custom-${crypto.randomUUID()}`;
    const entries = readEntries();
    entries[id] = entry;
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      error.textContent = 'The movement could not be saved. Your entries are still here.';
      return;
    }

    if (isCustom) {
      search.value = '';
      filter.value = entry.category;
    }
    dialog.close();
    refresh();
    const savedCard = [...list.querySelectorAll('.movement-card')].find(card => card.dataset.movement === id);
    (savedCard ?? search).focus();
    status.textContent = `${entry.name ?? editing.name} saved.`;
  }

  function remove() {
    if (!editing?.custom || !confirm(`Remove ${editing.name}?`)) return;
    const entries = readEntries();
    delete entries[editing.id];
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      error.textContent = 'The movement could not be removed.';
      return;
    }
    dialog.close();
    refresh();
    addButton.focus();
    status.textContent = `${editing.name} removed.`;
  }

  function open(fromWorkout) {
    backButton.hidden = !fromWorkout;
    status.textContent = '';
    refresh();
    window.scrollTo(0, 0);
  }

  function openFromWorkout() {
    workoutScroll = document.getElementById('workout-content').scrollTop;
    showScreen('movements', { hideNav: true });
    backButton.focus();
  }

  function returnToWorkout() {
    showScreen('workout');
    document.getElementById('workout-content').scrollTop = workoutScroll;
    document.getElementById('workout-movements').focus({ preventScroll: true });
  }

  filter.append(new Option('All groups', ''), ...categories.map(category => new Option(category)));
  fields.category.append(new Option('Choose a group', ''), ...categories.map(category => new Option(category)));
  search.addEventListener('input', renderList);
  filter.addEventListener('change', renderList);
  addButton.addEventListener('click', () => edit(null));
  document.getElementById('movement-cancel').addEventListener('click', () => dialog.close());
  fields.unit.addEventListener('change', () => setTrackingFields(fields.unit.value));
  form.addEventListener('input', () => { error.textContent = ''; });
  form.addEventListener('submit', save);
  removeButton.addEventListener('click', remove);

  return { choices, open, openFromWorkout, returnToWorkout };
})();
