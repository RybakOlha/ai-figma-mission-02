'use strict';

(() => {
  const KEY = 'ai-figma-mission02-pair04-v1';
  const THEME_KEY = 'ai-figma-mission02-theme';
  const SCHEMA = 'ai-figma-mission02-pair04';
  const PREVIOUS_SCHEMA = 'ai-figma-mission02-pair03';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const blank = () => ({ values: {}, done: {}, decisions: [], previousPair: null, importedAt: null });
  let state = blank();

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function notice(message, error = false, selector = '#status') {
    const target = $(selector);
    if (!target) return;
    target.textContent = message;
    target.style.color = error ? '#b73b3b' : '';
  }

  function updateProgress() {
    const checks = $$('[data-check]');
    const count = checks.filter((input) => state.done[input.dataset.check]).length;
    $('#progressLabel').textContent = `${count} / ${checks.length}`;
    $('#progressBar').max = checks.length;
    $('#progressBar').value = count;
    $('#totalScore').textContent = ['scoreConsistency', 'scoreNavigation', 'scoreResponsive', 'scoreAudit']
      .reduce((sum, key) => sum + (Number(state.values[key]) || 0), 0);
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      $('#saveState').textContent = 'Збережено у цьому браузері';
    } catch {
      $('#saveState').textContent = 'Сховище недоступне — експортуй JSON';
    }
    updateProgress();
  }

  function render() {
    $$('[data-field]').forEach((input) => { input.value = state.values[input.dataset.field] ?? ''; });
    $$('[data-check]').forEach((input) => { input.checked = !!state.done[input.dataset.check]; });
    const previous = state.previousPair?.state;
    const preview = $('#pagesPreview');
    if (previous) {
      const urls = [
        ['Desktop', previous.values?.desktopUrl],
        ['Tablet', previous.values?.tabletUrl],
        ['Mobile', previous.values?.mobileUrl]
      ];
      preview.innerHTML = '<strong>Імпортовано результати Пари 03</strong><ul>' +
        urls.map(([label, url]) => `<li>${escapeHtml(label)}: ${escapeHtml(url || 'покликання не вказано')}</li>`).join('') +
        '</ul>';
    } else {
      preview.innerHTML = '<p class="muted">Імпортуй JSON Пари 03, щоб відновити результати попередньої роботи.</p>';
    }
    $('#decisionsList').innerHTML = state.decisions.map((item, index) => `
      <div class="decision-item">
        <strong>${index + 1}. ${escapeHtml(item.decision)}</strong>
        <p>${escapeHtml(item.reason)}</p>
        <small>${escapeHtml(item.at || '')}</small>
        <button type="button" data-delete="${index}">Видалити</button>
      </div>`).join('');
    updateProgress();
  }

  function validPrevious(data) {
    return data && data.schema === PREVIOUS_SCHEMA && data.version === 1 &&
      data.state && typeof data.state === 'object' &&
      data.state.values && typeof data.state.values === 'object' &&
      data.state.done && typeof data.state.done === 'object' &&
      Array.isArray(data.state.decisions);
  }

  function validCurrent(data) {
    return data && data.schema === SCHEMA && data.version === 1 &&
      data.state && typeof data.state === 'object' &&
      data.state.values && typeof data.state.values === 'object' &&
      data.state.done && typeof data.state.done === 'object' &&
      Array.isArray(data.state.decisions) &&
      (!data.state.previousPair || validPrevious(data.state.previousPair));
  }

  async function readJson(file) {
    if (!file || file.size > 3_000_000) throw new Error('Оберіть JSON-файл розміром до 3 МБ.');
    return JSON.parse(await file.text());
  }

  $('#importPair3').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (event) => {
    try {
      const data = await readJson(event.target.files[0]);
      if (!validPrevious(data)) throw new Error('Очікується JSON Пари 03, версія 1.');
      if (state.previousPair && !confirm('Замінити раніше імпортований JSON Пари 03? Записи Пари 04 залишаться.')) return;
      state.previousPair = data;
      state.importedAt = new Date().toISOString();
      const values = data.state.values;
      const mapping = {
        projectName: 'projectName', figmaUrl: 'figmaUrl',
        homeDesktopUrl: 'desktopUrl', homeTabletUrl: 'tabletUrl', homeMobileUrl: 'mobileUrl'
      };
      Object.entries(mapping).forEach(([current, previous]) => {
        if (!state.values[current]) state.values[current] = values[previous] || '';
      });
      save();
      render();
      notice('JSON Пари 03 імпортовано. Оригінальні дані збережено у складі нового стану.', false, '#importStatus');
    } catch (error) {
      notice(`Помилка імпорту: ${error.message}`, true, '#importStatus');
    } finally {
      event.target.value = '';
    }
  });

  $$('[data-field]').forEach((input) => input.addEventListener('input', () => {
    state.values[input.dataset.field] = input.value;
    save();
  }));
  $$('[data-check]').forEach((input) => input.addEventListener('change', () => {
    state.done[input.dataset.check] = input.checked;
    save();
  }));

  $('#addDecision').addEventListener('click', () => {
    const decision = state.values.decisionText?.trim();
    const reason = state.values.decisionReason?.trim();
    if (!decision || !reason) {
      notice('Заповни рішення та його підставу.', true);
      return;
    }
    state.decisions.push({ at: new Date().toISOString(), decision, reason });
    state.values.decisionText = '';
    state.values.decisionReason = '';
    save();
    render();
    notice('Рішення додано.');
  });

  $('#decisionsList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete]');
    if (!button || !confirm('Видалити цей запис?')) return;
    state.decisions.splice(Number(button.dataset.delete), 1);
    save();
    render();
  });

  $$('.copy-prompt').forEach((button) => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.prompt);
      button.textContent = 'Скопійовано';
      setTimeout(() => { button.textContent = 'Копіювати промпт'; }, 1400);
    } catch {
      notice('Не вдалося скопіювати. Виділи текст промпту вручну.', true);
    }
  }));

  $('#teacherBtn').addEventListener('click', () => {
    const notes = $('#teacherNotes');
    notes.hidden = !notes.hidden;
    $('#teacherBtn').setAttribute('aria-pressed', String(!notes.hidden));
  });

  try {
    if (localStorage.getItem(THEME_KEY) === 'dark') document.body.classList.add('dark');
  } catch { /* Theme still works without storage. */ }
  $('#themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    try { localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light'); }
    catch { /* Theme still works without storage. */ }
  });

  function download(filename, contents, mime) {
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filename(ext) {
    const project = (state.values.projectName || 'Project')
      .replace(/[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ_-]+/g, '_').slice(0, 45);
    return `Mission_02_Pair_04_${project}.${ext}`;
  }

  $('#exportJson').addEventListener('click', () => {
    download(filename('json'), JSON.stringify({
      schema: SCHEMA, version: 1, exportedAt: new Date().toISOString(), state
    }, null, 2), 'application/json');
    notice('JSON Пари 04 збережено.');
  });

  $('#exportTxt').addEventListener('click', () => {
    const v = state.values;
    const fields = [
      ['Назва проєкту', 'projectName'], ['Figma', 'figmaUrl'],
      ['Головна Desktop', 'homeDesktopUrl'], ['Головна Tablet', 'homeTabletUrl'],
      ['Головна Mobile', 'homeMobileUrl'], ['Друга сторінка', 'secondName'],
      ['Призначення другої сторінки', 'secondPurpose'], ['User Flow', 'userFlow'],
      ['Ієрархія інформації', 'contentHierarchy'],
      ['Візуальна спорідненість', 'visualConsistency'],
      ['План навігації', 'navigationPlan'],
      ['Друга Desktop', 'secondDesktopUrl'], ['Друга Tablet', 'secondTabletUrl'],
      ['Друга Mobile', 'secondMobileUrl'], ['Рішення з адаптації', 'responsiveDecisions'],
      ['Перевірка 320 px', 'check320'], ['Висновки ШІ', 'aiFeedback'],
      ['Прийнята рекомендація', 'aiAccepted'], ['Відхилена рекомендація', 'aiRejected'],
      ['Рефлексія', 'reflection'], ['Наступні кроки', 'nextSteps']
    ];
    const lines = [
      'МІСІЯ 02 · ПАРА 04 — ОДИН ПРОДУКТ, БАГАТО СТОРІНОК — ЗВІТ ДЛЯ MOODLE',
      `Дата експорту: ${new Date().toLocaleString('uk-UA')}`, '',
      ...fields.flatMap(([title, key]) => [title, v[key] || 'не зазначено', '']),
      'ЖУРНАЛ РІШЕНЬ',
      ...state.decisions.map((item, index) => `${index + 1}. ${item.decision} — ${item.reason}`),
      '', `Самооцінка: ${$('#totalScore').textContent}/12`,
      `Чекліст: ${$$('[data-check]').filter((item) => state.done[item.dataset.check]).length}/${$$('[data-check]').length}`,
      '', 'Учитель перевіряє реальні макети у Figma.'
    ];
    download(filename('txt'), lines.join('\n'), 'text/plain;charset=utf-8');
    notice('TXT-звіт сформовано.');
  });

  $('#restoreBtn').addEventListener('click', () => $('#restoreFile').click());
  $('#restoreFile').addEventListener('change', async (event) => {
    try {
      const data = await readJson(event.target.files[0]);
      if (!validCurrent(data)) throw new Error('Це не коректний JSON Пари 04.');
      if (!confirm('Замінити поточні дані Пари 04 даними з файлу?')) return;
      state = data.state;
      save();
      render();
      notice('JSON Пари 04 відновлено.');
    } catch (error) {
      notice(`Помилка відновлення: ${error.message}`, true);
    } finally {
      event.target.value = '';
    }
  });

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.values === 'object' && saved.done && Array.isArray(saved.decisions)) state = saved;
  } catch { /* Use a clean state if storage is corrupt or unavailable. */ }
  render();
})();
