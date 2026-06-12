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
let pickerContext      = 'log'; // 'log' | 'edit'
let editingExercises  = [];
let editState         = null;  // { type, id }

// ── Supabase API ──
function sbConfig() {
  const cfg = window.SITE_CONFIG || {};
  return {
    url: cfg.sbUrl || localStorage.getItem('sbUrl') || '',
    key: cfg.sbKey || localStorage.getItem('sbKey') || ''
  };
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
async function sbPatch(table, id, body) {
  const { url } = sbConfig();
  const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: sbHeaders({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `${res.status}`); }
}
async function sbDelete(table, id) {
  const { url } = sbConfig();
  const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE', headers: sbHeaders()
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `${res.status}`); }
}
async function sbPostReturn(table, body) {
  const { url } = sbConfig();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `${res.status}`); }
  return res.json();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  setTodayDates();
  updateHeaderDate();
  checkConfig();
  plansCache = getPlans();
  renderPickerCategories();
  const { url, key } = sbConfig();
  if (url) document.getElementById('sb-url').value = url;
  if (key) document.getElementById('sb-key').value = key;
  const ghToken = localStorage.getItem('ghToken');
  if (ghToken) document.getElementById('gh-token').value = ghToken;
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
  if (name === 'history') {
    const { url, key } = sbConfig();
    if (url && key) loadHistory();
  }
  if (name === 'plans') {
    showPlanList();
    renderPlanList();
  }
}
function switchSubTab(name) {
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sub-section').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-sub="${name}"]`).classList.add('active');
  document.getElementById('sub-' + name).classList.add('active');
}

// ── Exercise Picker ──
function openExercisePicker(context = 'log') {
  pickerContext = context;
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
  const arr = pickerContext === 'edit' ? editingExercises : selectedExercises;
  const selected = arr.map(e => e.name);
  document.getElementById('modal-exercise-list').innerHTML =
    (EXERCISES[currentPickerCat] || []).map(name => `
      <button class="modal-ex-btn ${selected.includes(name) ? 'selected' : ''}"
        onclick="toggleExercise('${name}', '${currentPickerCat}')">${name}</button>
    `).join('');
}
function toggleExercise(name, category) {
  const arr = pickerContext === 'edit' ? editingExercises : selectedExercises;
  const idx = arr.findIndex(e => e.name === name);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push({ name, category, sets: [{ reps: '', weight: '' }] });
  if (pickerContext === 'edit') renderEditExCards();
  else renderExerciseCards();
  renderPickerList();
}
function addCustomExercise() {
  const input = document.getElementById('custom-exercise-input');
  const name = input.value.trim();
  if (!name) return;
  const arr = pickerContext === 'edit' ? editingExercises : selectedExercises;
  if (!arr.find(e => e.name === name)) {
    arr.push({ name, category: '自定义', sets: [{ reps: '', weight: '' }] });
    if (pickerContext === 'edit') renderEditExCards();
    else renderExerciseCards();
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
      ${ex.plan_sets || ex.plan_rest || ex.plan_target ? `
      <div class="ex-plan-hint">
        ${ex.plan_sets   ? `<span class="ex-plan-chip">📋 ${ex.plan_sets}</span>` : ''}
        ${ex.plan_rest   ? `<span class="ex-plan-chip rest">⏱ ${ex.plan_rest}</span>` : ''}
        ${ex.plan_target ? `<span class="ex-plan-chip target">🎯 ${ex.plan_target}</span>` : ''}
      </div>` : ''}
      <table class="sets-table">
        <thead><tr><th>组</th><th>次数</th><th>重量(kg)</th><th></th></tr></thead>
        <tbody>${ex.sets.map((s, si) => `
          <tr>
            <td class="set-num">${si + 1}</td>
            <td><input class="set-input" type="number" min="1" max="100" value="${s.reps}" placeholder="${ex.plan_reps || '—'}"
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

function actionBtns(type, id) {
  return `<span class="card-actions">
    <button class="card-action-btn" title="编辑" onclick="openEditModal('${type}',${id})">✏️</button>
    <button class="card-action-btn del" title="删除" onclick="deleteRecord('${type}',${id})">🗑️</button>
  </span>`;
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
        <span style="display:flex;gap:.3rem;align-items:center">
          <span class="history-type-badge">运动</span>
          <span class="history-meta">${r.duration ? r.duration + ' min' : ''}</span>
          ${actionBtns('workout', r.id)}
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
        <span style="display:flex;gap:.3rem;align-items:center">
          <span class="history-type-badge">营养</span>
          ${actionBtns('nutrition', r.id)}
        </span>
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
        <span style="display:flex;gap:.3rem;align-items:center">
          <span class="history-type-badge">体测</span>
          ${actionBtns('body', r.id)}
        </span>
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

// ── Delete Record ──
async function deleteRecord(type, id) {
  if (!confirm('确定要删除这条记录吗？')) return;
  const tableMap = { workout: 'workout_logs', nutrition: 'nutrition_logs', body: 'body_metrics' };
  try {
    await sbDelete(tableMap[type], id);
    cachedHistory[type] = cachedHistory[type].filter(r => r.id !== id);
    renderHistoryView();
    showToast('✓ 已删除', 'success');
  } catch (e) { showToast('删除失败：' + e.message, 'error'); }
}

// ── Edit Modal ──
function openEditModal(type, id) {
  const tableMap = { workout: 'workout_logs', nutrition: 'nutrition_logs', body: 'body_metrics' };
  const record = cachedHistory[type].find(r => r.id === id);
  if (!record) { showToast('记录未找到，请先刷新历史', 'error'); return; }

  editState = { type, id, table: tableMap[type] };

  const titles = { workout: '✏️ 编辑运动记录', nutrition: '✏️ 编辑营养记录', body: '✏️ 编辑体测数据' };
  document.getElementById('edit-modal-title').textContent = titles[type];
  document.getElementById('edit-modal-body').innerHTML = buildEditForm(type, record);

  if (type === 'workout') {
    editingExercises = JSON.parse(JSON.stringify(record.exercises || []));
    renderEditExCards();
  }

  document.getElementById('edit-overlay').classList.add('show');
  document.getElementById('edit-modal').classList.add('show');
}

function buildEditForm(type, r) {
  if (type === 'workout') {
    return `
      <div class="row-2">
        <div><label class="field-label">日期</label>
          <input type="date" id="edit-date" class="field-input" value="${r.date}" /></div>
        <div><label class="field-label">时长（分钟）</label>
          <input type="number" id="edit-duration" class="field-input" value="${r.duration || ''}" placeholder="60" /></div>
      </div>
      <div id="edit-ex-cards"></div>
      <button class="add-exercise-btn" style="margin-top:.25rem" onclick="openExercisePicker('edit')">＋ 添加动作</button>
      <div><label class="field-label">备注</label>
        <textarea id="edit-notes" class="field-textarea">${r.notes || ''}</textarea></div>`;
  }
  if (type === 'nutrition') {
    return `
      <div><label class="field-label">日期</label>
        <input type="date" id="edit-nut-date" class="field-input" value="${r.date}" /></div>
      <div class="macro-grid">
        <div class="macro-card protein">
          <label class="field-label">蛋白质</label>
          <div class="macro-input-wrap"><input type="number" id="edit-protein" class="macro-input" value="${r.protein}" step="0.1" /><span class="macro-unit">g</span></div>
        </div>
        <div class="macro-card carbs">
          <label class="field-label">碳水</label>
          <div class="macro-input-wrap"><input type="number" id="edit-carbs" class="macro-input" value="${r.carbs}" step="0.1" /><span class="macro-unit">g</span></div>
        </div>
        <div class="macro-card fat">
          <label class="field-label">脂肪</label>
          <div class="macro-input-wrap"><input type="number" id="edit-fat" class="macro-input" value="${r.fat}" step="0.1" /><span class="macro-unit">g</span></div>
        </div>
        <div class="macro-card calories">
          <label class="field-label">热量</label>
          <div class="macro-input-wrap"><input type="number" id="edit-calories" class="macro-input" value="${r.calories}" /><span class="macro-unit">kcal</span></div>
        </div>
      </div>
      <div><label class="field-label">备注</label>
        <textarea id="edit-nut-notes" class="field-textarea">${r.notes || ''}</textarea></div>`;
  }
  if (type === 'body') {
    const dt = new Date(r.measured_at);
    const dateVal = dt.toISOString().split('T')[0];
    const timeVal = dt.toTimeString().slice(0, 5);
    return `
      <div class="row-2">
        <div><label class="field-label">日期</label>
          <input type="date" id="edit-body-date" class="field-input" value="${dateVal}" /></div>
        <div><label class="field-label">时间</label>
          <input type="time" id="edit-body-time" class="field-input" value="${timeVal}" /></div>
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <label class="field-label">体重</label>
          <div class="macro-input-wrap"><input type="number" id="edit-weight" class="macro-input" value="${r.weight ?? ''}" step="0.1" /><span class="macro-unit">kg</span></div>
        </div>
        <div class="metric-card">
          <label class="field-label">体脂率</label>
          <div class="macro-input-wrap"><input type="number" id="edit-bf" class="macro-input" value="${r.body_fat ?? ''}" step="0.1" /><span class="macro-unit">%</span></div>
        </div>
      </div>
      <div><label class="field-label">备注</label>
        <textarea id="edit-body-notes" class="field-textarea">${r.notes || ''}</textarea></div>`;
  }
}

function closeEditModal() {
  document.getElementById('edit-overlay').classList.remove('show');
  document.getElementById('edit-modal').classList.remove('show');
  editState = null; editingExercises = [];
}

// ── Edit Exercise Cards ──
function renderEditExCards() {
  const container = document.getElementById('edit-ex-cards');
  if (!container) return;
  container.innerHTML = editingExercises.map((ex, ei) => `
    <div class="ex-card">
      <div class="ex-card-header">
        <span><span class="ex-card-name">${ex.name}</span><span class="ex-card-cat">${ex.category}</span></span>
        <button class="ex-card-remove" onclick="removeEditEx(${ei})">✕</button>
      </div>
      <table class="sets-table">
        <thead><tr><th>组</th><th>次数</th><th>重量(kg)</th><th></th></tr></thead>
        <tbody>${ex.sets.map((s, si) => `
          <tr>
            <td class="set-num">${si + 1}</td>
            <td><input class="set-input" type="number" value="${s.reps}" placeholder="—"
              onchange="updateEditSet(${ei},${si},'reps',this.value)" /></td>
            <td><input class="set-input" type="number" step="0.5" value="${s.weight}" placeholder="—"
              onchange="updateEditSet(${ei},${si},'weight',this.value)" /></td>
            <td>${ex.sets.length > 1
              ? `<button class="remove-set-btn" onclick="removeEditSet(${ei},${si})">−</button>`
              : '<span style="display:inline-block;width:22px"></span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="ex-card-footer">
        <button class="add-set-btn" onclick="addEditSet(${ei})">＋ 添加组</button>
      </div>
    </div>`).join('');
}
function removeEditEx(i) { editingExercises.splice(i, 1); renderEditExCards(); }
function addEditSet(i) { editingExercises[i].sets.push({ reps: '', weight: '' }); renderEditExCards(); }
function removeEditSet(ei, si) { editingExercises[ei].sets.splice(si, 1); renderEditExCards(); }
function updateEditSet(ei, si, field, val) { editingExercises[ei].sets[si][field] = val; }

// ── Submit Edit ──
async function submitEdit() {
  if (!editState) return;
  const { type, id, table } = editState;
  const btn = document.getElementById('edit-save-btn');
  btn.disabled = true; btn.textContent = '保存中…';

  try {
    let payload = {};
    if (type === 'workout') {
      payload = {
        date:      document.getElementById('edit-date').value,
        duration:  parseInt(document.getElementById('edit-duration').value) || 0,
        notes:     document.getElementById('edit-notes').value.trim(),
        exercises: editingExercises.map(ex => ({
          name: ex.name, category: ex.category,
          sets: ex.sets.filter(s => s.reps || s.weight)
        }))
      };
    } else if (type === 'nutrition') {
      payload = {
        date:     document.getElementById('edit-nut-date').value,
        protein:  parseFloat(document.getElementById('edit-protein').value) || 0,
        carbs:    parseFloat(document.getElementById('edit-carbs').value) || 0,
        fat:      parseFloat(document.getElementById('edit-fat').value) || 0,
        calories: parseInt(document.getElementById('edit-calories').value) || 0,
        notes:    document.getElementById('edit-nut-notes').value.trim()
      };
    } else if (type === 'body') {
      const date = document.getElementById('edit-body-date').value;
      const time = document.getElementById('edit-body-time').value || '00:00';
      payload = {
        measured_at: `${date}T${time}:00`,
        weight:   parseFloat(document.getElementById('edit-weight').value) || null,
        body_fat: parseFloat(document.getElementById('edit-bf').value) || null,
        notes:    document.getElementById('edit-body-notes').value.trim()
      };
    }

    await sbPatch(table, id, payload);

    // Update cache
    const idx = cachedHistory[type].findIndex(r => r.id === id);
    if (idx >= 0) cachedHistory[type][idx] = { ...cachedHistory[type][idx], ...payload };
    renderHistoryView();
    closeEditModal();
    showToast('✓ 修改已保存', 'success');
  } catch (e) {
    showToast('保存失败：' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '保存修改';
  }
}

// ── Settings ──
function saveSettings() {
  const url = document.getElementById('sb-url').value.trim().replace(/\/$/, '');
  const key = document.getElementById('sb-key').value.trim();
  if (!url || !key) { showStatus('URL 和 Key 都要填', 'err'); return; }
  localStorage.setItem('sbUrl', url); localStorage.setItem('sbKey', key);
  checkConfig(); showStatus('✓ 已保存', 'ok');
}
async function saveToGit() {
  const url = document.getElementById('sb-url').value.trim().replace(/\/$/, '') || localStorage.getItem('sbUrl');
  const key = document.getElementById('sb-key').value.trim() || localStorage.getItem('sbKey');
  const token = document.getElementById('gh-token').value.trim();
  if (!url || !key) { showStatus('请先填写 Supabase URL 和 Key', 'err'); return; }
  if (!token) { showStatus('请填写 GitHub Token', 'err'); return; }

  const btn = document.querySelector('.save-git-btn');
  btn.disabled = true; btn.textContent = '保存中…';
  showStatus('正在写入仓库…', '');

  const content = `window.SITE_CONFIG = {\n  sbUrl: '${url}',\n  sbKey: '${key}'\n};\n`;
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const apiUrl  = 'https://api.github.com/repos/wzy236/Fitness/contents/docs/js/config.js';
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };

  try {
    // Get current SHA (file may already exist)
    const existing = await fetch(apiUrl, { headers });
    const sha = existing.ok ? (await existing.json()).sha : undefined;

    const res = await fetch(apiUrl, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: 'config: update supabase credentials', content: encoded, ...(sha ? { sha } : {}) })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message); }

    localStorage.setItem('ghToken', token);
    localStorage.setItem('sbUrl', url);
    localStorage.setItem('sbKey', key);
    checkConfig();
    showStatus('✓ 已保存到仓库！GitHub Pages 约 1 分钟后自动更新，之后所有设备无需重新配置', 'ok');
  } catch (e) {
    showStatus('保存失败：' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '☁️ 保存到仓库';
  }
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

// ── Plans ──
let currentPlanIdx = null;
let plansCache     = [];
let _editingPlanId = null;

function getPlans() { return JSON.parse(localStorage.getItem('training_plans') || '[]'); }

function _parsePlanSets(str) {
  if (!str) return { count: 1, reps: '' };
  const m = str.match(/(\d+)\s*组\s*[×xX]\s*(\d[\d\-~～]*)/);
  if (m) return { count: Math.min(parseInt(m[1]), 8), reps: m[2] };
  return { count: 1, reps: '' };
}

function _planExToLogEx(ex) {
  let planSets   = ex.sets   || null;
  let planRest   = ex.rest   || null;
  let planTarget = ex.target || null;
  if (!planSets && ex.conditions && ex.conditions.length > 0) {
    planSets = ex.conditions[0].sets || null;
    planRest = planRest || ex.conditions[0].rest || null;
  }
  const { count, reps } = _parsePlanSets(planSets);
  return {
    name: ex.name, category: '计划',
    sets: Array.from({ length: count }, () => ({ reps: '', weight: '' })),
    plan_sets: planSets, plan_rest: planRest, plan_target: planTarget, plan_reps: reps,
  };
}

async function renderPlanList() {
  const el = document.getElementById('plan-list');
  if (!el) return;
  const { url, key } = sbConfig();
  if (url && key) {
    el.innerHTML = '<div class="plan-empty" style="padding:1rem">加载中…</div>';
    try {
      const rows = await sbGet('training_plans', 'select=*&order=created_at.asc');
      plansCache = rows.map(r => ({ ...r.plan_data, _id: r.id, name: r.name }));
      localStorage.setItem('training_plans', JSON.stringify(plansCache));
    } catch { plansCache = getPlans(); }
  } else {
    plansCache = getPlans();
  }
  _renderPlanListUI();
}

function _renderPlanListUI() {
  const el = document.getElementById('plan-list');
  if (!el) return;
  if (plansCache.length === 0) {
    el.innerHTML = '<div class="plan-empty">还没有计划<br>点右上角「＋ 导入 JSON」添加第一个训练计划</div>';
    return;
  }
  el.innerHTML = plansCache.map((plan, i) => {
    const exCount = (plan.exercises || []).length;
    const wmCount = (plan.warmup || []).length;
    const meta = [exCount + ' 个动作', wmCount ? wmCount + ' 个热身' : null].filter(Boolean).join(' · ');
    return `<div class="plan-card" onclick="showPlanDetail(${i})">
      <div>
        <div class="plan-card-name">${plan.name}</div>
        <div class="plan-card-meta">${meta}</div>
      </div>
      <span class="plan-card-arrow">›</span>
    </div>`;
  }).join('');
}

function showPlanDetail(idx) {
  currentPlanIdx = idx;
  const plan = plansCache[idx];
  if (!plan) return;
  document.getElementById('plan-list-view').style.display = 'none';
  document.getElementById('plan-detail-view').style.display = 'block';
  document.getElementById('plan-detail-content').innerHTML = renderPlanDetailHTML(plan);
}

function showPlanList() {
  currentPlanIdx = null;
  document.getElementById('plan-list-view').style.display = '';
  document.getElementById('plan-detail-view').style.display = 'none';
}

function renderPlanDetailHTML(plan) {
  let html = `<h2 class="plan-detail-name">${plan.name}</h2>`;

  if (plan.warmup && plan.warmup.length > 0) {
    html += `<div class="plan-section"><div class="plan-section-title">🔥 热身</div>`;
    plan.warmup.forEach(w => {
      html += `<div class="warmup-item"><div class="warmup-name">${w.name}</div><div>`;
      if (w.duration) html += `<span class="warmup-meta">${w.duration}</span>`;
      if (w.speed)    html += `<span class="warmup-meta">${w.speed}</span>`;
      html += `</div>`;
      if (w.note) html += `<div class="warmup-note">${w.note}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (plan.exercises && plan.exercises.length > 0) {
    html += `<div class="plan-section"><div class="plan-section-title">🏋️ 训练动作</div>`;
    plan.exercises.forEach((ex, i) => {
      html += `<div class="plan-ex-block">
        <div class="plan-ex-header">
          <span class="plan-ex-num">${i + 1}</span>
          <span class="plan-ex-name">${ex.name}</span>
          ${ex.tag ? `<span class="plan-ex-tag">${ex.tag}</span>` : ''}
        </div>`;
      if (ex.warning) html += `<div class="plan-warning">⚠️ ${ex.warning}</div>`;
      if (ex.warmup_sets && ex.warmup_sets.length > 0) {
        html += `<div class="plan-warmup-sets"><span class="plan-detail-label">热身组</span>` +
          ex.warmup_sets.map(s => `<span class="plan-warmup-set-tag">${s}</span>`).join('') + `</div>`;
      }
      if (ex.conditions && ex.conditions.length > 0) {
        ex.conditions.forEach(cond => {
          html += `<div class="plan-condition"><div class="plan-condition-if">${cond.if}</div>`;
          if (cond.alt && cond.alt.length > 0)
            html += `<div class="plan-condition-alt">→ 换做：${cond.alt.join(' / ')}</div>`;
          const bits = [];
          if (cond.sets) bits.push(`<span class="plan-meta-item">📋 ${cond.sets}</span>`);
          if (cond.rest) bits.push(`<span class="plan-meta-item">⏱ ${cond.rest}</span>`);
          if (bits.length) html += `<div class="plan-condition-sets">${bits.join('')}</div>`;
          html += `</div>`;
        });
      } else {
        const bits = [];
        if (ex.sets)    bits.push(`<span class="plan-meta-item">📋 ${ex.sets}</span>`);
        if (ex.rest)    bits.push(`<span class="plan-meta-item">⏱ ${ex.rest}</span>`);
        if (ex.purpose) bits.push(`<span class="plan-meta-item purpose">🎯 ${ex.purpose}</span>`);
        if (bits.length) html += `<div class="plan-ex-meta">${bits.join('')}</div>`;
      }
      if (ex.target) html += `<div class="plan-target">目标：${ex.target}</div>`;
      if (ex.notes && ex.notes.length > 0)
        html += `<ul class="plan-notes">${ex.notes.map(n => `<li>${n}</li>`).join('')}</ul>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  return html;
}

async function deleteCurrentPlan() {
  if (currentPlanIdx === null) return;
  const plan = plansCache[currentPlanIdx];
  if (!confirm(`确定删除「${plan.name}」吗？`)) return;
  const { url, key } = sbConfig();
  if (url && key && plan._id) {
    try { await sbDelete('training_plans', plan._id); }
    catch (e) { showToast('删除失败：' + e.message, 'error'); return; }
  }
  plansCache.splice(currentPlanIdx, 1);
  localStorage.setItem('training_plans', JSON.stringify(plansCache));
  showPlanList();
  _renderPlanListUI();
  showToast(`✓ 已删除「${plan.name}」`, 'success');
}

function editCurrentPlan() {
  if (currentPlanIdx === null) return;
  const plan = plansCache[currentPlanIdx];
  if (!plan) return;
  _editingPlanId = plan._id || null;
  const display = Object.fromEntries(Object.entries(plan).filter(([k]) => !k.startsWith('_')));
  document.getElementById('import-json').value = JSON.stringify(display, null, 2);
  document.getElementById('import-modal-title').textContent = '编辑训练计划';
  document.querySelector('#import-modal .save-btn').textContent = '保存修改';
  document.getElementById('import-overlay').classList.add('show');
  document.getElementById('import-modal').classList.add('show');
}

function usePlanToday() {
  if (currentPlanIdx === null) return;
  const plan = plansCache[currentPlanIdx];
  if (!plan) return;
  selectedExercises = (plan.exercises || []).map(_planExToLogEx);
  renderExerciseCards();
  _setPlanQuickBar(plan.name);
  switchTab('log');
  switchSubTab('workout');
  showToast(`✓ 已加载「${plan.name}」，共 ${selectedExercises.length} 个动作`, 'success');
}

// ── Import Modal ──
function openImportModal() {
  _editingPlanId = null;
  document.getElementById('import-json').value = '';
  document.getElementById('import-modal-title').textContent = '导入训练计划';
  document.querySelector('#import-modal .save-btn').textContent = '导入计划';
  document.getElementById('import-overlay').classList.add('show');
  document.getElementById('import-modal').classList.add('show');
}
function closeImportModal() {
  document.getElementById('import-overlay').classList.remove('show');
  document.getElementById('import-modal').classList.remove('show');
  _editingPlanId = null;
  document.getElementById('import-modal-title').textContent = '导入训练计划';
  document.querySelector('#import-modal .save-btn').textContent = '导入计划';
}
async function confirmImport() {
  const raw = document.getElementById('import-json').value.trim();
  if (!raw) { showToast('请粘贴 JSON 内容', 'error'); return; }
  let plan;
  try { plan = JSON.parse(raw); } catch { showToast('JSON 格式错误，请检查后重试', 'error'); return; }
  if (!plan.name) { showToast('计划缺少 name 字段', 'error'); return; }
  if (!Array.isArray(plan.exercises)) { showToast('计划缺少 exercises 数组', 'error'); return; }

  const isEdit = !!_editingPlanId;
  const btn = document.querySelector('#import-modal .save-btn');
  btn.disabled = true; btn.textContent = '保存中…';

  const { url, key } = sbConfig();
  try {
    if (isEdit) {
      if (url && key) await sbPatch('training_plans', _editingPlanId, { name: plan.name, plan_data: plan });
      const idx = plansCache.findIndex(p => p._id === _editingPlanId);
      if (idx >= 0) plansCache[idx] = { ...plan, _id: _editingPlanId };
      localStorage.setItem('training_plans', JSON.stringify(plansCache));
      showToast(`✓ 已更新「${plan.name}」`, 'success');
    } else {
      if (url && key) {
        const rows = await sbPostReturn('training_plans', { name: plan.name, plan_data: plan });
        if (rows && rows[0]) plan._id = rows[0].id;
      }
      plansCache.push(plan);
      localStorage.setItem('training_plans', JSON.stringify(plansCache));
      showToast(`✓ 已导入「${plan.name}」`, 'success');
    }
    closeImportModal();
    _renderPlanListUI();
  } catch (e) {
    showToast((isEdit ? '更新' : '导入') + '失败：' + e.message, 'error');
    btn.disabled = false; btn.textContent = isEdit ? '保存修改' : '导入计划';
  }
}

const EXAMPLE_PLAN = {"name":"背日","warmup":[{"name":"跑步机快走","duration":"5分钟","speed":"5.5-6 km/h","note":"微微出汗即可"}],"exercises":[{"name":"高位下拉","tag":"主动作","warmup_sets":["工作重量50% × 12","工作重量70% × 8"],"sets":"4组 × 8-12次","rest":"90秒","target":"最后一组还能剩1-2次力竭余量（RIR 1-2）"},{"name":"杠铃划船","warning":"先做空杆测试","conditions":[{"if":"如果下背完全没感觉","sets":"3组 × 8-10次","rest":"2分钟"},{"if":"如果下背还有酸紧","alt":["胸托划船","坐姿划船"],"sets":"3组 × 8-12次"}]},{"name":"坐姿划船","sets":"2组 × 10-12次","rest":"90秒","notes":["胸挺起来","肩胛骨主动后缩","不要后仰借力"]},{"name":"面拉","sets":"3组 × 12-15次","rest":"60秒","target":"拉向鼻子或眼睛高度","purpose":"后三角、菱形肌、肩袖"},{"name":"哑铃弯举","sets":"3组 × 10-15次","rest":"60秒"}]};

function fillExamplePlan() {
  document.getElementById('import-json').value = JSON.stringify(EXAMPLE_PLAN, null, 2);
}

// ── Plan Picker Modal ──
async function openPlanPickerModal() {
  if (plansCache.length === 0) {
    const { url, key } = sbConfig();
    if (url && key) {
      try {
        const rows = await sbGet('training_plans', 'select=*&order=created_at.asc');
        plansCache = rows.map(r => ({ ...r.plan_data, _id: r.id, name: r.name }));
        localStorage.setItem('training_plans', JSON.stringify(plansCache));
      } catch { plansCache = getPlans(); }
    } else { plansCache = getPlans(); }
  }
  if (plansCache.length === 0) { showToast('还没有计划，去「计划」tab 导入', 'error'); return; }
  document.getElementById('plan-picker-list').innerHTML = plansCache.map((plan, i) => {
    const exCount = (plan.exercises || []).length;
    return `<div class="plan-picker-item" onclick="selectPlanFromPicker(${i})">
      <div>
        <div class="plan-picker-item-name">${plan.name}</div>
        <div class="plan-picker-item-meta">${exCount} 个动作</div>
      </div>
      <span style="color:var(--muted);font-size:1.1rem">›</span>
    </div>`;
  }).join('');
  document.getElementById('plan-picker-overlay').classList.add('show');
  document.getElementById('plan-picker-modal').classList.add('show');
}
function closePlanPickerModal() {
  document.getElementById('plan-picker-overlay').classList.remove('show');
  document.getElementById('plan-picker-modal').classList.remove('show');
}
function selectPlanFromPicker(idx) {
  const plan = plansCache[idx];
  if (!plan) return;
  selectedExercises = (plan.exercises || []).map(_planExToLogEx);
  renderExerciseCards();
  _setPlanQuickBar(plan.name);
  closePlanPickerModal();
  showToast(`✓ 已加载「${plan.name}」`, 'success');
}
function _setPlanQuickBar(name) {
  const btn = document.getElementById('plan-quick-btn');
  const clr = document.getElementById('plan-quick-clear');
  if (btn) btn.textContent = name;
  if (clr) clr.style.display = '';
}
function clearSelectedPlan() {
  const btn = document.getElementById('plan-quick-btn');
  const clr = document.getElementById('plan-quick-clear');
  if (btn) btn.textContent = '选择今日计划…';
  if (clr) clr.style.display = 'none';
  selectedExercises = [];
  renderExerciseCards();
  showToast('已清空计划和动作', 'success');
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
