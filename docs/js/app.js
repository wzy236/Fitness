// ── Exercise Library ──
const EXERCISES = {
  '胸部':    ['杠铃平板卧推','杠铃上斜卧推','哑铃平板卧推','哑铃上斜卧推','哑铃飞鸟','绳索夹胸','俯卧撑','窄距俯卧撑'],
  '背部':    ['引体向上','高位下拉','坐姿划船','单臂哑铃划船','T杆划船','杠铃硬拉','绳索直臂下压','绳索面拉'],
  '肩部':    ['杠铃推举','哑铃肩推','哑铃侧平举','哑铃前平举','反向飞鸟','绳索侧平举','阿诺德推举'],
  '三头肌':  ['绳索下压','仰卧臂屈伸','绳索过头臂屈伸','窄距卧推','双杠臂屈伸'],
  '二头肌':  ['杠铃弯举','哑铃弯举','锤式弯举','集中弯举','绳索弯举','反握弯举'],
  '腿部':    ['杠铃深蹲','腿举','哈克深蹲','保加利亚分腿蹲','前蹲','箱式深蹲','腿屈伸'],
  '腘绳/臀': ['罗马尼亚硬拉','腿弯举','直腿硬拉','臀桥','山羊挺身','跪姿后踢腿'],
  '小腿':    ['站姿提踵','坐姿提踵'],
  '核心':    ['平板支撑','卷腹','俄罗斯转体','悬挂举腿','死虫式','鸟狗式','腹轮'],
  '有氧':    ['跑步机','固定单车','椭圆机','划船机','跳绳']
};

// ── State ──
let selectedExercises = [];
let currentPickerCat  = Object.keys(EXERCISES)[0];
let currentFilter     = 'all';

// ── Supabase API ──
function sbConfig() {
  return { url: localStorage.getItem('sbUrl') || '', key: localStorage.getItem('sbKey') || '' };
}
function sbHeaders(extra = {}) {
  const { key } = sbConfig();
  return { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}
async function sbGet(table, params = '') {
  const { url } = sbConfig();
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, { headers: sbHeaders() });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `${res.status}`); }
  return res.json();
}
async function sbPost(table, body) {
  const { url } = sbConfig();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `${res.status}`); }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  setTodayDates();
  updateHeaderDate();
  checkConfig();
  renderLibrary();
  renderPickerCategories();
  const { url, key } = sbConfig();
  if (url) document.getElementById('sb-url').value = url;
  if (key) document.getElementById('sb-key').value = key;
});

function setTodayDates() {
  const iso = new Date().toISOString().split('T')[0];
  document.getElementById('log-date').value = iso;
  document.getElementById('nut-date').value = iso;
  document.getElementById('body-date').value = iso;
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  document.getElementById('body-time').value = hhmm;
}
function updateHeaderDate() {
  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'short' });
}
function checkConfig() {
  const { url, key } = sbConfig();
  document.getElementById('no-config-banner').classList.toggle('show', !url || !key);
}

// ── Tab / Sub-tab Switching ──
function switchTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
}
function switchSubTab(name) {
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sub-section').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-sub="${name}"]`).classList.add('active');
  document.getElementById('sub-' + name).classList.add('active');
}

// ── Exercise Picker ──
function openExercisePicker() {
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('exercise-modal').classList.add('show');
  renderPickerList();
}
function closeExercisePicker() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('exercise-modal').classList.remove('show');
}
function renderPickerCategories() {
  document.getElementById('modal-cat-tabs').innerHTML = Object.keys(EXERCISES).map(cat => `
    <button class="cat-tab ${cat === currentPickerCat ? 'active' : ''}" onclick="selectPickerCat('${cat}')">${cat}</button>
  `).join('');
}
function selectPickerCat(cat) {
  currentPickerCat = cat;
  renderPickerCategories();
  renderPickerList();
}
function renderPickerList() {
  const selected = selectedExercises.map(e => e.name);
  document.getElementById('modal-exercise-list').innerHTML =
    (EXERCISES[currentPickerCat] || []).map(name => `
      <button class="modal-ex-btn ${selected.includes(name) ? 'selected' : ''}"
        onclick="toggleExercise('${name}', '${currentPickerCat}')">${name}</button>
    `).join('');
}
function toggleExercise(name, category) {
  const idx = selectedExercises.findIndex(e => e.name === name);
  if (idx >= 0) selectedExercises.splice(idx, 1);
  else selectedExercises.push({ name, category, sets: [{ reps: '', weight: '' }] });
  renderExerciseCards();
  renderPickerList();
}
function addCustomExercise() {
  const input = document.getElementById('custom-exercise-input');
  const name = input.value.trim();
  if (!name) return;
  if (!selectedExercises.find(e => e.name === name)) {
    selectedExercises.push({ name, category: '自定义', sets: [{ reps: '', weight: '' }] });
    renderExerciseCards();
  }
  input.value = '';
  showToast(`已添加「${name}」`, 'success');
}

// ── Exercise Cards ──
function renderExerciseCards() {
  document.getElementById('exercise-cards').innerHTML = selectedExercises.map((ex, ei) => `
    <div class="ex-card">
      <div class="ex-card-header">
        <span><span class="ex-card-name">${ex.name}</span><span class="ex-card-cat">${ex.category}</span></span>
        <button class="ex-card-remove" onclick="removeExercise(${ei})">✕</button>
      </div>
      <table class="sets-table">
        <thead><tr><th>组</th><th>次数</th><th>重量(kg)</th><th></th></tr></thead>
        <tbody>${ex.sets.map((s, si) => `
          <tr>
            <td class="set-num">${si + 1}</td>
            <td><input class="set-input" type="number" min="1" max="100" value="${s.reps}" placeholder="—"
              onchange="updateSet(${ei},${si},'reps',this.value)" /></td>
            <td><input class="set-input" type="number" min="0" step="0.5" value="${s.weight}" placeholder="—"
              onchange="updateSet(${ei},${si},'weight',this.value)" /></td>
            <td>${ex.sets.length > 1
              ? `<button class="remove-set-btn" onclick="removeSet(${ei},${si})">−</button>`
              : '<span style="display:inline-block;width:22px"></span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="ex-card-footer">
        <button class="add-set-btn" onclick="addSet(${ei})">＋ 添加组</button>
      </div>
    </div>`).join('');
}
function removeExercise(i) { selectedExercises.splice(i, 1); renderExerciseCards(); }
function addSet(i) { selectedExercises[i].sets.push({ reps: '', weight: '' }); renderExerciseCards(); }
function removeSet(ei, si) { selectedExercises[ei].sets.splice(si, 1); renderExerciseCards(); }
function updateSet(ei, si, field, val) { selectedExercises[ei].sets[si][field] = val; }

// ── Save Workout ──
async function saveWorkout() {
  if (!checkReady()) return;
  if (selectedExercises.length === 0) { showToast('请先添加动作', 'error'); return; }
  const btn = document.getElementById('workout-save-btn');
  setLoading(btn, true, '保存中…');
  try {
    await sbPost('workout_logs', {
      date:      document.getElementById('log-date').value,
      duration:  parseInt(document.getElementById('log-duration').value) || 0,
      notes:     document.getElementById('log-notes').value.trim(),
      exercises: selectedExercises.map(ex => ({
        name: ex.name, category: ex.category,
        sets: ex.sets.filter(s => s.reps || s.weight)
      }))
    });
    showToast('✓ 运动记录已保存', 'success');
    selectedExercises = []; renderExerciseCards();
    document.getElementById('log-notes').value = '';
    document.getElementById('log-duration').value = '';
    setTodayDates();
  } catch (e) { showToast('保存失败：' + e.message, 'error'); }
  finally { setLoading(btn, false, '保存运动记录'); }
}

// ── Nutrition Calc ──
function calcCalories() {
  const p = parseFloat(document.getElementById('nut-protein').value) || 0;
  const c = parseFloat(document.getElementById('nut-carbs').value) || 0;
  const f = parseFloat(document.getElementById('nut-fat').value) || 0;
  const kcal = Math.round(p * 4 + c * 4 + f * 9);
  const hint = document.getElementById('calc-hint');
  if (p || c || f) {
    hint.textContent = `预估热量：${kcal} kcal（蛋白质 ${p*4} + 碳水 ${c*4} + 脂肪 ${f*9}）`;
    if (!document.getElementById('nut-calories').value) {
      document.getElementById('nut-calories').placeholder = kcal;
    }
  } else {
    hint.textContent = '';
  }
}

// ── Save Nutrition ──
async function saveNutrition() {
  if (!checkReady()) return;
  const p = parseFloat(document.getElementById('nut-protein').value) || 0;
  const c = parseFloat(document.getElementById('nut-carbs').value) || 0;
  const f = parseFloat(document.getElementById('nut-fat').value) || 0;
  if (!p && !c && !f) { showToast('请填写至少一项营养数据', 'error'); return; }
  const kcalField = parseInt(document.getElementById('nut-calories').value);
  const kcalCalc  = Math.round(p * 4 + c * 4 + f * 9);
  const btn = document.getElementById('nutrition-save-btn');
  setLoading(btn, true, '保存中…');
  try {
    await sbPost('nutrition_logs', {
      date:     document.getElementById('nut-date').value,
      protein:  p, carbs: c, fat: f,
      calories: kcalField || kcalCalc,
      notes:    document.getElementById('nut-notes').value.trim()
    });
    showToast('✓ 营养记录已保存', 'success');
    ['nut-protein','nut-carbs','nut-fat','nut-calories','nut-notes'].forEach(id => {
      const el = document.getElementById(id);
      el.value = ''; if (el.placeholder && id !== 'nut-calories') el.placeholder = '0';
    });
    document.getElementById('calc-hint').textContent = '';
    setTodayDates();
  } catch (e) { showToast('保存失败：' + e.message, 'error'); }
  finally { setLoading(btn, false, '保存营养记录'); }
}

// ── Save Body Metrics ──
async function saveBodyMetrics() {
  if (!checkReady()) return;
  const w  = parseFloat(document.getElementById('body-weight').value);
  const bf = parseFloat(document.getElementById('body-fat').value);
  if (!w && !bf) { showToast('请填写体重或体脂率', 'error'); return; }
  const date = document.getElementById('body-date').value;
  const time = document.getElementById('body-time').value || '00:00';
  const btn = document.getElementById('body-save-btn');
  setLoading(btn, true, '保存中…');
  try {
    await sbPost('body_metrics', {
      measured_at: `${date}T${time}:00`,
      weight:   w   || null,
      body_fat: bf  || null,
      notes:    document.getElementById('body-notes').value.trim()
    });
    showToast('✓ 体测数据已保存', 'success');
    ['body-weight','body-fat','body-notes'].forEach(id => document.getElementById(id).value = '');
    setTodayDates();
  } catch (e) { showToast('保存失败：' + e.message, 'error'); }
  finally { setLoading(btn, false, '保存体测数据'); }
}

// ── History ──
let cachedHistory = { workout: [], nutrition: [], body: [] };

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  renderHistoryView();
}

async function loadHistory() {
  document.getElementById('history-list').innerHTML = '<div class="empty-state">加载中…</div>';
  try {
    const [workouts, nutrition, body] = await Promise.all([
      sbGet('workout_logs',  'select=*&order=date.desc,created_at.desc&limit=100'),
      sbGet('nutrition_logs','select=*&order=date.desc,created_at.desc&limit=100'),
      sbGet('body_metrics',  'select=*&order=measured_at.desc&limit=100')
    ]);
    cachedHistory = { workout: workouts, nutrition, body };
    renderHistoryView();
  } catch (e) {
    document.getElementById('history-list').innerHTML =
      `<div class="empty-state" style="color:#f87171">加载失败：${e.message}</div>`;
  }
}

function renderHistoryView() {
  const list = document.getElementById('history-list');
  let items = [];

  if (currentFilter === 'all' || currentFilter === 'workout') {
    items.push(...cachedHistory.workout.map(r => ({ ...r, _type: 'workout' })));
  }
  if (currentFilter === 'all' || currentFilter === 'nutrition') {
    items.push(...cachedHistory.nutrition.map(r => ({ ...r, _type: 'nutrition' })));
  }
  if (currentFilter === 'all' || currentFilter === 'body') {
    items.push(...cachedHistory.body.map(r => ({ ...r, _type: 'body' })));
  }

  // Sort by date/time descending
  items.sort((a, b) => {
    const da = a._type === 'body' ? a.measured_at : a.date + 'T' + (a.created_at || '');
    const db = b._type === 'body' ? b.measured_at : b.date + 'T' + (b.created_at || '');
    return db.localeCompare(da);
  });

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">没有记录，点刷新加载，或去「记录」tab 添加</div>';
    return;
  }
  list.innerHTML = items.map(renderCard).join('');
}

function renderCard(r) {
  if (r._type === 'workout') {
    const exLines = (r.exercises || []).map(ex => {
      const sets = (ex.sets || []).map(s =>
        `${s.reps || '?'}次${s.weight ? '×' + s.weight + 'kg' : ''}`).join(' / ');
      return `<div class="history-ex"><strong>${ex.name}</strong>${sets ? '：' + sets : ''}</div>`;
    }).join('');
    return `<div class="history-card">
      <div class="history-card-header">
        <span class="history-date">${r.date}</span>
        <span style="display:flex;gap:.4rem;align-items:center">
          <span class="history-type-badge">运动</span>
          <span class="history-meta">${r.duration ? r.duration + ' min' : ''}</span>
        </span>
      </div>
      <div class="history-body">
        ${exLines || '<span style="color:var(--muted);font-size:.83rem">无动作记录</span>'}
        ${r.notes ? `<div class="history-notes">${r.notes}</div>` : ''}
      </div>
    </div>`;
  }
  if (r._type === 'nutrition') {
    return `<div class="history-card type-nutrition">
      <div class="history-card-header">
        <span class="history-date">${r.date}</span>
        <span class="history-type-badge">营养</span>
      </div>
      <div class="history-body">
        <div class="macro-summary">
          <span class="macro-pill k">🔥 ${r.calories} kcal</span>
          <span class="macro-pill p">蛋白质 ${r.protein}g</span>
          <span class="macro-pill c">碳水 ${r.carbs}g</span>
          <span class="macro-pill f">脂肪 ${r.fat}g</span>
        </div>
        ${r.notes ? `<div class="history-notes">${r.notes}</div>` : ''}
      </div>
    </div>`;
  }
  if (r._type === 'body') {
    const dt = new Date(r.measured_at);
    const dateStr = dt.toLocaleDateString('zh-CN', { month:'2-digit', day:'2-digit' });
    const timeStr = dt.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' });
    return `<div class="history-card type-body">
      <div class="history-card-header">
        <span class="history-date">${dateStr} ${timeStr}</span>
        <span class="history-type-badge">体测</span>
      </div>
      <div class="history-body">
        <div class="metric-row">
          ${r.weight   ? `<span class="metric-val w">${r.weight}</span><span class="metric-label">kg</span>` : ''}
          ${r.body_fat ? `<span class="metric-val bf" style="margin-left:.5rem">${r.body_fat}</span><span class="metric-label">% 体脂</span>` : ''}
        </div>
        ${r.notes ? `<div class="history-notes">${r.notes}</div>` : ''}
      </div>
    </div>`;
  }
  return '';
}

// ── Export CSV ──
function exportCSV(type) {
  const data = cachedHistory[type];
  if (!data || data.length === 0) { showToast('没有可导出的数据，请先刷新历史', 'error'); return; }

  let csv = '';
  if (type === 'workout') {
    csv = 'date,duration_min,exercises,notes\n' +
      data.map(r => [
        r.date, r.duration,
        `"${JSON.stringify(r.exercises || []).replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ].join(',')).join('\n');
  }
  if (type === 'nutrition') {
    csv = 'date,calories,protein_g,carbs_g,fat_g,notes\n' +
      data.map(r => [r.date, r.calories, r.protein, r.carbs, r.fat,
        `"${(r.notes || '').replace(/"/g, '""')}"`].join(',')).join('\n');
  }
  if (type === 'body') {
    csv = 'measured_at,weight_kg,body_fat_pct,notes\n' +
      data.map(r => [r.measured_at, r.weight ?? '', r.body_fat ?? '',
        `"${(r.notes || '').replace(/"/g, '""')}"`].join(',')).join('\n');
  }

  const labels = { workout:'运动记录', nutrition:'营养记录', body:'体测数据' };
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${labels[type]}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast(`✓ ${labels[type]} CSV 已下载`, 'success');
}

// ── Copy for AI ──
async function copyForAI() {
  if (cachedHistory.workout.length + cachedHistory.nutrition.length + cachedHistory.body.length === 0) {
    try { await loadHistory(); } catch {}
  }

  const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' });
  let text = `我的近期健身数据：\n\n`;

  const workouts = [...cachedHistory.workout].slice(0, 14);
  if (workouts.length) {
    text += `【运动记录（最近 ${workouts.length} 条）】\n`;
    workouts.forEach(r => {
      text += `${r.date}${r.duration ? '，' + r.duration + ' 分钟' : ''}：\n`;
      (r.exercises || []).forEach(ex => {
        const sets = (ex.sets || []).map(s =>
          `${s.reps||'?'}次${s.weight ? '×' + s.weight + 'kg' : ''}`).join(' / ');
        text += `  - ${ex.name}（${ex.category}）：${sets || '已记录'}\n`;
      });
    });
    text += '\n';
  }

  const nutrition = [...cachedHistory.nutrition].slice(0, 7);
  if (nutrition.length) {
    text += `【营养摄入（最近 ${nutrition.length} 天）】\n`;
    nutrition.forEach(r => {
      text += `${r.date}：热量 ${r.calories}kcal，蛋白质 ${r.protein}g，碳水 ${r.carbs}g，脂肪 ${r.fat}g\n`;
    });
    text += '\n';
  }

  const body = [...cachedHistory.body].slice(0, 10);
  if (body.length) {
    text += `【体测数据（最近 ${body.length} 条）】\n`;
    body.forEach(r => {
      const t = new Date(r.measured_at).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      text += `${t}：${r.weight ? '体重 ' + r.weight + 'kg' : ''}${r.body_fat ? '，体脂 ' + r.body_fat + '%' : ''}\n`;
    });
    text += '\n';
  }

  text += `今天是 ${today}。\n请根据以上数据，分析我的训练和营养状况，建议我今天的训练内容和饮食注意事项。`;

  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  showToast('✓ 已复制，去 Claude.ai 粘贴', 'success');
}

// ── Library ──
function renderLibrary() {
  document.getElementById('library-list').innerHTML =
    Object.entries(EXERCISES).map(([cat, exs]) => `
      <div class="lib-category">
        <div class="lib-cat-name">${cat}</div>
        <div class="lib-exercises">${exs.map(ex => `<span class="lib-ex-tag">${ex}</span>`).join('')}</div>
      </div>`).join('');
}

// ── Settings ──
function saveSettings() {
  const url = document.getElementById('sb-url').value.trim().replace(/\/$/, '');
  const key = document.getElementById('sb-key').value.trim();
  if (!url || !key) { showStatus('URL 和 Key 都要填', 'err'); return; }
  localStorage.setItem('sbUrl', url); localStorage.setItem('sbKey', key);
  checkConfig(); showStatus('✓ 已保存', 'ok');
}
async function testConnection() {
  const url = document.getElementById('sb-url').value.trim().replace(/\/$/, '') || localStorage.getItem('sbUrl');
  const key = document.getElementById('sb-key').value.trim() || localStorage.getItem('sbKey');
  if (!url || !key) { showStatus('请先填写 URL 和 Key', 'err'); return; }
  localStorage.setItem('sbUrl', url); localStorage.setItem('sbKey', key);
  showStatus('测试中…', '');
  try {
    const data = await sbGet('workout_logs', 'select=count&limit=1');
    showStatus('✓ 连接成功！', 'ok'); checkConfig();
  } catch (e) { showStatus('连接失败：' + e.message, 'err'); }
}
function showStatus(msg, type) {
  const el = document.getElementById('settings-status');
  el.textContent = msg; el.className = 'settings-status ' + type;
}

// ── Helpers ──
function checkReady() {
  const { url, key } = sbConfig();
  if (!url || !key) { showToast('请先在设置里配置 Supabase', 'error'); return false; }
  return true;
}
function setLoading(btn, on, offText) {
  btn.disabled = on; if (!on) btn.textContent = offText;
}

// ── Toast ──
let _toastTimer;
function showToast(msg, type = '') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  clearTimeout(_toastTimer);
  t.textContent = msg; t.className = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add('show'));
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
