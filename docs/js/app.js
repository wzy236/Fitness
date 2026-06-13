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
let selectedExercises   = [];
let currentPickerCat    = Object.keys(EXERCISES)[0];
let currentFilter       = 'all';
let pickerContext        = 'log'; // 'log' | 'edit' | 'plan'
let editingExercises    = [];
let editState           = null;   // { type, id }
let planEditorExercises = [];
let _dSrc = null; // drag source: {type:'ex'|'set', ei, si?}
let foodLibrary  = [];   // food items from DB/localStorage
let nutFoodItems = [];   // foods added to current nutrition log session
let _editingFoodId = null;
let _selectedFood  = null; // food selected from dropdown in nutrition picker
let todayNutrition   = [];
let editNutFoodItems = [];
let _editSelectedFood = null;

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
async function sbDeleteWhere(table, params) {
  const { url } = sbConfig();
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
    method: 'DELETE', headers: sbHeaders()
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `${res.status}`); }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  setTodayDates();
  updateHeaderDate();
  checkConfig();
  _initTouchDrag();
  plansCache = getPlans();
  renderPickerCategories();
  loadFoodLibrary();
  const { url, key } = sbConfig();
  if (url) document.getElementById('sb-url').value = url;
  if (key) document.getElementById('sb-key').value = key;
  const ghToken = localStorage.getItem('ghToken');
  if (ghToken) document.getElementById('gh-token').value = ghToken;
  document.addEventListener('click', e => {
    if (!e.target.closest('.food-search-wrap')) {
      const dd = document.getElementById('food-search-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });
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
  if (name === 'foods') loadFoodLibrary();
  if (name === 'nutrition') loadTodayNutrition();
}

// ── Today Nutrition ──
async function loadTodayNutrition() {
  const { url, key } = sbConfig();
  if (!url || !key) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    const data = await sbGet('nutrition_logs', `select=*&date=eq.${today}&order=created_at.asc`);
    todayNutrition = data;
    const ids = new Set(data.map(r => r.id));
    cachedHistory.nutrition = [
      ...data,
      ...(cachedHistory.nutrition || []).filter(r => !ids.has(r.id))
    ];
    renderTodayNutrition();
  } catch(e) { /* silent */ }
}

function renderTodayNutrition() {
  const container = document.getElementById('today-nutrition-summary');
  if (!container) return;
  if (!todayNutrition.length) { container.style.display = 'none'; return; }
  container.style.display = '';
  let tp = 0, tc = 0, tf = 0, tk = 0;
  const entries = todayNutrition.map(r => {
    tp += +r.protein; tc += +r.carbs; tf += +r.fat; tk += +r.calories;
    const timeStr = new Date(r.created_at).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'});
    const foods = Array.isArray(r.food_items) && r.food_items.length
      ? `<div class="today-food-tags">${r.food_items.map(fi => `<span class="today-food-tag">${fi.name} ${Math.round(fi.grams)}g</span>`).join('')}</div>`
      : '';
    return `<div class="today-nut-entry">
      <div class="today-nut-meta">
        <span class="today-nut-time">${timeStr}</span>
        <span class="today-nut-macros">🔥${r.calories}kcal &middot; 蛋${r.protein}g &middot; 碳${r.carbs}g &middot; 脂${r.fat}g</span>
        <span class="today-nut-actions">${actionBtns('nutrition', r.id)}</span>
      </div>
      ${foods}
      ${r.notes ? `<div class="today-nut-notes">${r.notes}</div>` : ''}
    </div>`;
  }).join('');
  tp = Math.round(tp*10)/10; tc = Math.round(tc*10)/10; tf = Math.round(tf*10)/10;
  container.innerHTML = `
    <div class="today-nut-header"><span class="field-label" style="font-size:.78rem;margin-bottom:0">今日营养记录</span></div>
    ${entries}
    <div class="today-nut-total">
      <span class="today-nut-total-label">今日合计</span>
      <span class="today-nut-pill k">🔥 ${tk} kcal</span>
      <span class="today-nut-pill p">蛋白 ${tp}g</span>
      <span class="today-nut-pill c">碳水 ${tc}g</span>
      <span class="today-nut-pill f">脂肪 ${tf}g</span>
    </div>`;
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
  const arr = pickerContext === 'edit' ? editingExercises
            : pickerContext === 'plan' ? planEditorExercises
            : selectedExercises;
  const selected = arr.map(e => e.name);
  document.getElementById('modal-exercise-list').innerHTML =
    (EXERCISES[currentPickerCat] || []).map(name => `
      <button class="modal-ex-btn ${selected.includes(name) ? 'selected' : ''}"
        onclick="toggleExercise('${name}', '${currentPickerCat}')">${name}</button>
    `).join('');
}
function toggleExercise(name, category) {
  const isPlan = pickerContext === 'plan';
  const arr = pickerContext === 'edit' ? editingExercises
            : isPlan ? planEditorExercises
            : selectedExercises;
  const idx = arr.findIndex(e => e.name === name);
  if (idx >= 0) arr.splice(idx, 1);
  else {
    if (isPlan) arr.push({ name, category, rest: '', target: '', target_sets: [{ reps: '', weight: '' }] });
    else arr.push({ name, category, sets: [{ reps: '', weight: '' }] });
  }
  if (pickerContext === 'edit') renderEditExCards();
  else if (isPlan) renderPlanEditorExCards();
  else renderExerciseCards();
  renderPickerList();
}
function addCustomExercise() {
  const input = document.getElementById('custom-exercise-input');
  const name = input.value.trim();
  if (!name) return;
  const isPlan = pickerContext === 'plan';
  const arr = pickerContext === 'edit' ? editingExercises
            : isPlan ? planEditorExercises
            : selectedExercises;
  if (!arr.find(e => e.name === name)) {
    if (isPlan) arr.push({ name, category: '自定义', rest: '', target: '', target_sets: [{ reps: '', weight: '' }] });
    else arr.push({ name, category: '自定义', sets: [{ reps: '', weight: '' }] });
    if (pickerContext === 'edit') renderEditExCards();
    else if (isPlan) renderPlanEditorExCards();
    else renderExerciseCards();
  }
  input.value = '';
  showToast(`已添加「${name}」`, 'success');
}

// ── Drag and Drop ──
function _exDragStart(e, ei) {
  if (['INPUT','BUTTON','TEXTAREA','SELECT'].includes(e.target.tagName)) { e.preventDefault(); return; }
  if (e.target.closest?.('tr[data-si]')) return; // set-row drag handles itself
  _dSrc = { type: 'ex', ei };
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.currentTarget.classList.add('drag-dragging'), 0);
}
function _exDragOver(e, ei) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.ex-card').forEach((c, i) => c.classList.toggle('drag-over', i === ei && _dSrc?.type === 'ex' && _dSrc.ei !== ei));
}
function _exDrop(e, ei) {
  e.preventDefault();
  document.querySelectorAll('.ex-card').forEach(c => c.classList.remove('drag-over', 'drag-dragging'));
  if (!_dSrc || _dSrc.type !== 'ex' || _dSrc.ei === ei) return;
  const [item] = selectedExercises.splice(_dSrc.ei, 1);
  selectedExercises.splice(ei, 0, item);
  renderExerciseCards();
}
function _setDragStart(e, ei, si) {
  if (['INPUT','BUTTON'].includes(e.target.tagName)) { e.preventDefault(); return; }
  e.stopPropagation(); // prevent ex-card's dragstart from overwriting _dSrc
  _dSrc = { type: 'set', ei, si };
  e.dataTransfer.effectAllowed = 'move';
}
function _setDragOver(e, ei, si) {
  e.preventDefault();
  if (_dSrc?.type !== 'set' || _dSrc.ei !== ei) return;
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll(`tr[data-ei="${ei}"]`).forEach((r, i) => r.classList.toggle('drag-over-row', i === si && _dSrc.si !== si));
}
function _setDrop(e, ei, si) {
  e.preventDefault();
  document.querySelectorAll('tr[data-si]').forEach(r => r.classList.remove('drag-over-row'));
  if (!_dSrc || _dSrc.type !== 'set' || _dSrc.ei !== ei || _dSrc.si === si) return;
  const [item] = selectedExercises[ei].sets.splice(_dSrc.si, 1);
  selectedExercises[ei].sets.splice(si, 0, item);
  renderExerciseCards();
}
function _clearDrag() {
  _dSrc = null;
  document.querySelectorAll('.ex-card').forEach(c => c.classList.remove('drag-over', 'drag-dragging'));
  document.querySelectorAll('tr[data-si]').forEach(r => r.classList.remove('drag-over-row'));
}

function _initTouchDrag() {
  const container = document.getElementById('exercise-cards');
  let ghost = null, td = null;

  container.addEventListener('touchstart', e => {
    const h = e.target.closest('.drag-handle, .set-drag-h');
    if (!h) return;
    e.preventDefault();
    const row  = h.closest('tr[data-si]');
    const card = h.closest('.ex-card');
    const el   = row || card;
    if (!el) return;
    const t = e.touches[0];
    const r = el.getBoundingClientRect();
    if (row) {
      // <tr> can't render as fixed on its own — wrap in a table
      ghost = document.createElement('table');
      ghost.className = 'sets-table';
      const tb = document.createElement('tbody');
      tb.appendChild(el.cloneNode(true));
      ghost.appendChild(tb);
    } else {
      ghost = el.cloneNode(true);
    }
    Object.assign(ghost.style, {
      position: 'fixed', top: r.top + 'px', left: r.left + 'px', width: r.width + 'px',
      opacity: '.82', zIndex: '500', pointerEvents: 'none',
      boxShadow: '0 8px 32px rgba(0,0,0,.45)', borderRadius: '.7rem', transition: 'none',
      background: 'var(--card)',
    });
    document.body.appendChild(ghost);
    el.style.opacity = '.25';
    td = { el, startY: t.clientY, startTop: r.top, type: row ? 'set' : 'ex',
           ei: +(row || card).dataset.ei, si: row ? +row.dataset.si : -1 };
  }, { passive: false });

  container.addEventListener('touchmove', e => {
    if (!td) return;
    e.preventDefault();
    ghost.style.top = (td.startTop + e.touches[0].clientY - td.startY) + 'px';
  }, { passive: false });

  container.addEventListener('touchend', e => {
    if (!td) return;
    ghost.remove(); ghost = null;
    td.el.style.opacity = '';
    const t = e.changedTouches[0];
    if (td.type === 'ex') {
      const target = document.elementFromPoint(t.clientX, t.clientY)?.closest('.ex-card[data-ei]');
      if (target && +target.dataset.ei !== td.ei) {
        const [item] = selectedExercises.splice(td.ei, 1);
        selectedExercises.splice(+target.dataset.ei, 0, item);
        renderExerciseCards();
      }
    } else {
      const target = document.elementFromPoint(t.clientX, t.clientY)?.closest('tr[data-si]');
      if (target && +target.dataset.ei === td.ei && +target.dataset.si !== td.si) {
        const [item] = selectedExercises[td.ei].sets.splice(td.si, 1);
        selectedExercises[td.ei].sets.splice(+target.dataset.si, 0, item);
        renderExerciseCards();
      }
    }
    td = null;
  }, { passive: false });
}

// ── Exercise Cards ──
function renderExerciseCards() {
  document.getElementById('exercise-cards').innerHTML = selectedExercises.map((ex, ei) => `
    <div class="ex-card" data-ei="${ei}" draggable="true"
         ondragstart="_exDragStart(event,${ei})" ondragover="_exDragOver(event,${ei})" ondrop="_exDrop(event,${ei})" ondragend="_clearDrag()">
      <div class="ex-card-header">
        <span class="drag-handle" title="拖拽排序">⠿</span>
        <span><span class="ex-card-name">${ex.name}</span><span class="ex-card-cat">${ex.category}</span></span>
        <button class="ex-card-remove" onclick="removeExercise(${ei})">✕</button>
      </div>
      ${ex.plan_sets || ex.plan_rest || ex.plan_weights || ex.plan_target ? `
      <div class="ex-plan-hint">
        ${ex.plan_sets    ? `<span class="ex-plan-chip">📋 ${ex.plan_sets}</span>` : ''}
        ${ex.plan_rest    ? `<span class="ex-plan-chip rest">⏱ ${ex.plan_rest}</span>` : ''}
        ${ex.plan_weights ? `<span class="ex-plan-chip weight">⚖ 目标 ${ex.plan_weights}</span>` : ''}
        ${ex.plan_target  ? `<span class="ex-plan-chip target">🎯 ${ex.plan_target}</span>` : ''}
      </div>` : ''}
      <table class="sets-table">
        <thead><tr><th class="drag-th"></th><th>组</th><th>次数</th><th>重量(lb)</th><th></th></tr></thead>
        <tbody>${ex.sets.map((s, si) => `
          <tr data-ei="${ei}" data-si="${si}" draggable="true"
              ondragstart="_setDragStart(event,${ei},${si})" ondragover="_setDragOver(event,${ei},${si})" ondrop="_setDrop(event,${ei},${si})" ondragend="_clearDrag()">
            <td class="set-drag-h">⠿</td>
            <td class="set-num">${si + 1}</td>
            <td><input class="set-input" type="number" min="1" max="100" value="${s.reps}" placeholder="${ex.plan_reps || '—'}"
              onchange="updateSet(${ei},${si},'reps',this.value)" /></td>
            <td>
              <input class="set-input" type="number" min="0" step="0.5" value="${s.weight}" placeholder="${s.plan_weight || '—'}"
                onchange="updateSet(${ei},${si},'weight',this.value)" />
              ${s.plan_weight ? `<span class="set-plan-w">${s.plan_weight}</span>` : ''}
            </td>
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

// ── Food Library ──
async function loadFoodLibrary() {
  const { url, key } = sbConfig();
  if (url && key) {
    try {
      const rows = await sbGet('food_library', 'select=*&order=name.asc');
      foodLibrary = rows;
      localStorage.setItem('food_library', JSON.stringify(rows));
    } catch {
      foodLibrary = JSON.parse(localStorage.getItem('food_library') || '[]');
    }
  } else {
    foodLibrary = JSON.parse(localStorage.getItem('food_library') || '[]');
  }
  renderFoodLibrary();
}

function renderFoodLibrary() {
  const el = document.getElementById('food-lib-list');
  if (!el) return;
  const q = (document.getElementById('food-lib-search')?.value || '').toLowerCase().trim();
  const list = q ? foodLibrary.filter(f => f.name.toLowerCase().includes(q)) : foodLibrary;
  if (!list.length) {
    el.innerHTML = `<div class="plan-empty">${q ? '没有匹配的食物' : '还没有食物，点「＋ 新增」添加第一个'}</div>`;
    return;
  }
  el.innerHTML = list.map(f => {
    const cal = Math.round((+f.protein) * 4 + (+f.carbs) * 4 + (+f.fat) * 9);
    return `<div class="food-card">
      <div style="flex:1;min-width:0">
        <div class="food-card-name">${f.name}</div>
        <div class="food-card-macros">每100g · 蛋白 ${f.protein}g · 碳水 ${f.carbs}g · 脂肪 ${f.fat}g · ${cal}kcal</div>
        ${f.unit_name ? `<div class="food-card-unit">1${f.unit_name} ≈ ${f.unit_grams}g</div>` : ''}
      </div>
      <div class="food-card-actions">
        <button class="food-edit-btn" onclick="openFoodEditor(${f.id})">编辑</button>
        <button class="food-del-btn"  onclick="deleteFoodItem(${f.id})">删除</button>
      </div>
    </div>`;
  }).join('');
}

function openFoodEditor(id = null) {
  _editingFoodId = id;
  const f = id ? foodLibrary.find(x => x.id === id) : null;
  document.getElementById('food-editor-title').textContent = id ? '编辑食物' : '新增食物';
  document.getElementById('food-editor-name').value        = f?.name        || '';
  document.getElementById('food-editor-protein').value     = f?.protein     != null ? f.protein : '';
  document.getElementById('food-editor-carbs').value       = f?.carbs       != null ? f.carbs   : '';
  document.getElementById('food-editor-fat').value         = f?.fat         != null ? f.fat     : '';
  document.getElementById('food-editor-unit-name').value   = f?.unit_name   || '';
  document.getElementById('food-editor-unit-grams').value  = f?.unit_grams  != null ? f.unit_grams : '';
  document.getElementById('food-editor-cal-hint').textContent = '';
  const btn = document.getElementById('food-editor-save-btn');
  btn.disabled = false; btn.textContent = '保存食物';
  document.getElementById('food-editor-overlay').classList.add('show');
  document.getElementById('food-editor-modal').classList.add('show');
}

function closeFoodEditor() {
  document.getElementById('food-editor-overlay').classList.remove('show');
  document.getElementById('food-editor-modal').classList.remove('show');
  _editingFoodId = null;
}

function updateFoodEditorCal() {
  const p = parseFloat(document.getElementById('food-editor-protein').value) || 0;
  const c = parseFloat(document.getElementById('food-editor-carbs').value)   || 0;
  const f = parseFloat(document.getElementById('food-editor-fat').value)     || 0;
  const hint = document.getElementById('food-editor-cal-hint');
  hint.textContent = (p || c || f) ? `预估热量：${Math.round(p*4 + c*4 + f*9)} kcal / 100g` : '';
}

async function saveFoodFromEditor() {
  const name = document.getElementById('food-editor-name').value.trim();
  if (!name) { showToast('请输入食物名称', 'error'); return; }
  const protein   = parseFloat(document.getElementById('food-editor-protein').value) || 0;
  const carbs     = parseFloat(document.getElementById('food-editor-carbs').value)   || 0;
  const fat       = parseFloat(document.getElementById('food-editor-fat').value)     || 0;
  const unitName  = document.getElementById('food-editor-unit-name').value.trim();
  const unitGrams = parseFloat(document.getElementById('food-editor-unit-grams').value) || null;
  const calories  = Math.round(protein * 4 + carbs * 4 + fat * 9);
  const body = { name, protein, carbs, fat, calories, unit_name: unitName, unit_grams: unitGrams };

  const btn = document.getElementById('food-editor-save-btn');
  btn.disabled = true; btn.textContent = '保存中…';
  const { url, key } = sbConfig();
  try {
    if (_editingFoodId) {
      if (url && key) await sbPatch('food_library', _editingFoodId, body);
      const idx = foodLibrary.findIndex(x => x.id === _editingFoodId);
      if (idx >= 0) foodLibrary[idx] = { ...foodLibrary[idx], ...body };
    } else {
      if (url && key) {
        const rows = await sbPostReturn('food_library', body);
        if (rows?.[0]) foodLibrary.push(rows[0]);
      } else {
        foodLibrary.push({ ...body, id: Date.now() });
      }
    }
    localStorage.setItem('food_library', JSON.stringify(foodLibrary));
    showToast(`✓ 已保存「${name}」`, 'success');
    closeFoodEditor();
    renderFoodLibrary();
  } catch (e) {
    showToast('保存失败：' + e.message, 'error');
    btn.disabled = false; btn.textContent = '保存食物';
  }
}

async function deleteFoodItem(id) {
  const food = foodLibrary.find(x => x.id === id);
  if (!food || !confirm(`确定删除「${food.name}」吗？`)) return;
  const { url, key } = sbConfig();
  if (url && key) {
    try { await sbDelete('food_library', id); }
    catch (e) { showToast('删除失败：' + e.message, 'error'); return; }
  }
  foodLibrary = foodLibrary.filter(x => x.id !== id);
  localStorage.setItem('food_library', JSON.stringify(foodLibrary));
  renderFoodLibrary();
  showToast(`✓ 已删除「${food.name}」`, 'success');
}

// ── Food Picker (Nutrition Log) ──
function onFoodSearchInput(q) {
  const dd = document.getElementById('food-search-dropdown');
  if (!q.trim()) { dd.style.display = 'none'; _selectedFood = null; return; }
  const matches = foodLibrary.filter(f => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  if (!matches.length) { dd.style.display = 'none'; return; }
  dd.style.display = 'block';
  dd.innerHTML = matches.map(f => {
    const cal = Math.round((+f.protein)*4 + (+f.carbs)*4 + (+f.fat)*9);
    return `<div class="food-dropdown-item" onclick="selectFoodFromDropdown(${f.id})">
      <div class="food-dropdown-name">${f.name}</div>
      <div class="food-dropdown-macros">每100g · 蛋白 ${f.protein}g · 碳水 ${f.carbs}g · 脂 ${f.fat}g · ${cal}kcal${f.unit_name ? ` · 1${f.unit_name}=${f.unit_grams}g` : ''}</div>
    </div>`;
  }).join('');
}

function selectFoodFromDropdown(id) {
  _selectedFood = foodLibrary.find(x => x.id === id);
  if (!_selectedFood) return;
  document.getElementById('food-search-input').value = _selectedFood.name;
  document.getElementById('food-search-dropdown').style.display = 'none';
  const unitSel = document.getElementById('food-amount-unit');
  unitSel.innerHTML = '<option value="g">克</option>';
  if (_selectedFood.unit_name && _selectedFood.unit_grams) {
    unitSel.innerHTML += `<option value="u">${_selectedFood.unit_name}</option>`;
  }
  document.getElementById('food-amount-input').focus();
}

function addFoodToLog() {
  if (!_selectedFood) { showToast('请先搜索并选择食物', 'error'); return; }
  const amtVal = parseFloat(document.getElementById('food-amount-input').value);
  if (!amtVal || amtVal <= 0) { showToast('请输入有效的数量', 'error'); return; }
  const unit = document.getElementById('food-amount-unit').value;
  const grams = unit === 'u' ? amtVal * _selectedFood.unit_grams : amtVal;
  nutFoodItems.push({ food: { ..._selectedFood }, grams, displayAmt: amtVal, displayUnit: unit === 'u' ? _selectedFood.unit_name : 'g' });
  _selectedFood = null;
  document.getElementById('food-search-input').value = '';
  document.getElementById('food-amount-input').value = '';
  document.getElementById('food-amount-unit').innerHTML = '<option value="g">克</option>';
  document.getElementById('food-search-dropdown').style.display = 'none';
  renderNutFoodList();
  recalcNutritionFromFoods();
}

function removeNutFood(i) {
  nutFoodItems.splice(i, 1);
  renderNutFoodList();
  recalcNutritionFromFoods();
}

function renderNutFoodList() {
  const el = document.getElementById('nut-food-list');
  if (!el) return;
  if (!nutFoodItems.length) { el.innerHTML = ''; return; }
  let tp = 0, tc = 0, tf = 0;
  const rows = nutFoodItems.map((item, i) => {
    const r = item.grams / 100;
    const p = Math.round(item.food.protein * r * 10) / 10;
    const c = Math.round(item.food.carbs   * r * 10) / 10;
    const f = Math.round(item.food.fat     * r * 10) / 10;
    const k = Math.round(p*4 + c*4 + f*9);
    tp += p; tc += c; tf += f;
    const amtStr = item.displayUnit === 'g' ? `${item.grams}g` : `${item.displayAmt}${item.displayUnit}(${Math.round(item.grams)}g)`;
    return `<tr>
      <td class="nut-food-name-td"><span style="font-weight:600">${item.food.name}</span><br><span style="font-size:.7rem;color:var(--muted)">${amtStr}</span></td>
      <td>${p}</td><td>${c}</td><td>${f}</td><td>${k}</td>
      <td><button class="nut-food-remove" onclick="removeNutFood(${i})">✕</button></td>
    </tr>`;
  });
  tp = Math.round(tp*10)/10; tc = Math.round(tc*10)/10; tf = Math.round(tf*10)/10;
  const tk = Math.round(tp*4 + tc*4 + tf*9);
  el.innerHTML = `<table class="nut-food-table">
    <thead><tr><th style="text-align:left">食物</th><th>蛋白(g)</th><th>碳水(g)</th><th>脂肪(g)</th><th>热量</th><th></th></tr></thead>
    <tbody>${rows.join('')}
    <tr class="nut-food-total-row">
      <td style="text-align:left">合计</td>
      <td>${tp}</td><td>${tc}</td><td>${tf}</td><td>${tk}kcal</td><td></td>
    </tr></tbody>
  </table>`;
}

function recalcNutritionFromFoods() {
  if (!nutFoodItems.length) return;
  let tp = 0, tc = 0, tf = 0;
  nutFoodItems.forEach(item => {
    const r = item.grams / 100;
    tp += item.food.protein * r;
    tc += item.food.carbs   * r;
    tf += item.food.fat     * r;
  });
  document.getElementById('nut-protein').value = Math.round(tp * 10) / 10 || '';
  document.getElementById('nut-carbs').value   = Math.round(tc * 10) / 10 || '';
  document.getElementById('nut-fat').value     = Math.round(tf * 10) / 10 || '';
  calcCalories();
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
      date:       document.getElementById('nut-date').value,
      protein:    p, carbs: c, fat: f,
      calories:   kcalField || kcalCalc,
      notes:      document.getElementById('nut-notes').value.trim(),
      food_items: nutFoodItems.map(item => ({ name: item.food.name, grams: item.grams, protein: Math.round(item.food.protein * item.grams / 100 * 10)/10, carbs: Math.round(item.food.carbs * item.grams / 100 * 10)/10, fat: Math.round(item.food.fat * item.grams / 100 * 10)/10 }))
    });
    showToast('✓ 营养记录已保存', 'success');
    nutFoodItems = [];
    renderNutFoodList();
    ['nut-protein','nut-carbs','nut-fat','nut-calories','nut-notes'].forEach(id => {
      const el = document.getElementById(id);
      el.value = ''; if (el.placeholder && id !== 'nut-calories') el.placeholder = '0';
    });
    document.getElementById('calc-hint').textContent = '';
    setTodayDates();
    loadTodayNutrition();
  } catch (e) { showToast('保存失败：' + e.message, 'error'); }
  finally { setLoading(btn, false, '保存营养记录'); }
}

// ── Save Body Metrics ──
async function saveBodyMetrics() {
  if (!checkReady()) return;
  const w     = parseFloat(document.getElementById('body-weight').value);
  const bf    = parseFloat(document.getElementById('body-fat').value);
  const waist = parseFloat(document.getElementById('body-waist').value);
  const hip   = parseFloat(document.getElementById('body-hip').value);
  if (!w && !bf && !waist && !hip) { showToast('请至少填写一项体测数据', 'error'); return; }
  const date = document.getElementById('body-date').value;
  const time = document.getElementById('body-time').value || '00:00';
  const btn = document.getElementById('body-save-btn');
  setLoading(btn, true, '保存中…');
  try {
    await sbPost('body_metrics', {
      measured_at: `${date}T${time}:00`,
      weight:   w     || null,
      body_fat: bf    || null,
      waist:    waist || null,
      hip:      hip   || null,
      notes:    document.getElementById('body-notes').value.trim()
    });
    showToast('✓ 体测数据已保存', 'success');
    ['body-weight','body-fat','body-waist','body-hip','body-notes'].forEach(id => document.getElementById(id).value = '');
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
        `${s.reps || '?'}次${s.weight ? '×' + s.weight + 'lb' : ''}`).join(' / ');
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
        ${Array.isArray(r.food_items) && r.food_items.length ? `<div class="history-food-items">${r.food_items.map(fi => `<span class="history-food-tag">${fi.name} ${Math.round(fi.grams)}g</span>`).join('')}</div>` : ''}
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
          ${r.waist    ? `<span class="metric-val" style="margin-left:.5rem;color:var(--purple)">${r.waist}</span><span class="metric-label">cm 腰</span>` : ''}
          ${r.hip      ? `<span class="metric-val" style="margin-left:.5rem;color:var(--blue)">${r.hip}</span><span class="metric-label">cm 臀</span>` : ''}
        </div>
        ${r.notes ? `<div class="history-notes">${r.notes}</div>` : ''}
      </div>
    </div>`;
  }
  return '';
}

// ── Export CSV ──
function _filterByRange(data, type) {
  const from = document.getElementById('export-from')?.value;
  const to   = document.getElementById('export-to')?.value;
  if (!from && !to) return data;
  return data.filter(r => {
    const d = type === 'body' ? (r.measured_at || '').slice(0, 10) : r.date;
    return (!from || d >= from) && (!to || d <= to);
  });
}
function setExportRange7() {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  document.getElementById('export-from').value = from;
  document.getElementById('export-to').value   = to;
}
async function copyHistoryJSON() {
  if (!cachedHistory.workout.length && !cachedHistory.nutrition.length && !cachedHistory.body.length) {
    try { await loadHistory(); } catch {}
  }
  const result = {};
  ['workout', 'nutrition', 'body'].forEach(t => { result[t] = _filterByRange(cachedHistory[t] || [], t); });
  try {
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    showToast('✓ JSON 已复制到剪贴板', 'success');
  } catch { showToast('复制失败，请检查浏览器权限', 'error'); }
}
function exportCSV(type) {
  const all = cachedHistory[type];
  if (!all || all.length === 0) { showToast('没有可导出的数据，请先刷新历史', 'error'); return; }
  const data = _filterByRange(all, type);
  if (data.length === 0) { showToast('该日期范围内没有数据', 'error'); return; }

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
    csv = 'measured_at,weight_kg,body_fat_pct,waist_cm,hip_cm,notes\n' +
      data.map(r => [r.measured_at, r.weight ?? '', r.body_fat ?? '', r.waist ?? '', r.hip ?? '',
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
          `${s.reps||'?'}次${s.weight ? '×' + s.weight + 'lb' : ''}`).join(' / ');
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
      text += `${t}：${r.weight ? '体重 ' + r.weight + 'kg' : ''}${r.body_fat ? '，体脂 ' + r.body_fat + '%' : ''}${r.waist ? '，腰围 ' + r.waist + 'cm' : ''}${r.hip ? '，臀围 ' + r.hip + 'cm' : ''}\n`;
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
    if (type === 'nutrition') { todayNutrition = todayNutrition.filter(r => r.id !== id); renderTodayNutrition(); }
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
  if (type === 'nutrition') {
    editNutFoodItems = (record.food_items || []).map(fi => ({...fi}));
    renderEditFoodList();
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
      <div>
        <label class="field-label">食物明细</label>
        <div id="edit-food-list" class="edit-food-list"></div>
        <div class="food-picker-row" style="margin-top:.5rem">
          <div class="food-search-wrap" style="flex:0 0 100%">
            <input type="text" id="edit-food-search" class="field-input" placeholder="从食物库搜索添加…"
                   oninput="onEditFoodSearch(this.value)" autocomplete="off" />
            <div id="edit-food-dropdown" class="food-search-dropdown" style="display:none"></div>
          </div>
          <input type="number" id="edit-food-amount" class="field-input food-amount-input" placeholder="克数" min="0.1" step="0.1" />
          <select id="edit-food-unit" class="field-input food-unit-select"><option value="g">克</option></select>
          <button class="import-plan-btn food-add-btn" onclick="addFoodToEdit()">添加</button>
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
        <div class="metric-card">
          <label class="field-label">腰围</label>
          <div class="macro-input-wrap"><input type="number" id="edit-waist" class="macro-input" value="${r.waist ?? ''}" step="0.1" /><span class="macro-unit">cm</span></div>
        </div>
        <div class="metric-card">
          <label class="field-label">臀围</label>
          <div class="macro-input-wrap"><input type="number" id="edit-hip" class="macro-input" value="${r.hip ?? ''}" step="0.1" /><span class="macro-unit">cm</span></div>
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
        <thead><tr><th>组</th><th>次数</th><th>重量(lb)</th><th></th></tr></thead>
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

// ── Edit Nutrition Food Items ──
function renderEditFoodList() {
  const el = document.getElementById('edit-food-list');
  if (!el) return;
  if (!editNutFoodItems.length) { el.innerHTML = ''; return; }
  el.innerHTML = editNutFoodItems.map((fi, i) => {
    const macroStr = `蛋${fi.protein}g 碳${fi.carbs}g 脂${fi.fat}g`;
    return `<div class="edit-food-item">
      <span class="edit-food-name">${fi.name}</span>
      <span class="edit-food-grams">${Math.round(fi.grams)}g</span>
      <span class="edit-food-macros">${macroStr}</span>
      <button class="edit-food-remove" onclick="removeEditNutFood(${i})">✕</button>
    </div>`;
  }).join('');
}

function removeEditNutFood(i) {
  editNutFoodItems.splice(i, 1);
  renderEditFoodList();
  recalcEditNutMacros();
}

function recalcEditNutMacros() {
  if (!editNutFoodItems.length) return;
  let tp = 0, tc = 0, tf = 0;
  editNutFoodItems.forEach(fi => { tp += +fi.protein; tc += +fi.carbs; tf += +fi.fat; });
  const pEl = document.getElementById('edit-protein');
  const cEl = document.getElementById('edit-carbs');
  const fEl = document.getElementById('edit-fat');
  const kEl = document.getElementById('edit-calories');
  if (pEl) pEl.value = Math.round(tp * 10) / 10 || '';
  if (cEl) cEl.value = Math.round(tc * 10) / 10 || '';
  if (fEl) fEl.value = Math.round(tf * 10) / 10 || '';
  if (kEl) kEl.value = Math.round(tp * 4 + tc * 4 + tf * 9) || '';
}

function onEditFoodSearch(q) {
  const dd = document.getElementById('edit-food-dropdown');
  if (!q.trim()) { dd.style.display = 'none'; _editSelectedFood = null; return; }
  const matches = foodLibrary.filter(f => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  if (!matches.length) { dd.style.display = 'none'; return; }
  dd.style.display = 'block';
  dd.innerHTML = matches.map(f => {
    const cal = Math.round((+f.protein)*4 + (+f.carbs)*4 + (+f.fat)*9);
    return `<div class="food-dropdown-item" onclick="selectFoodForEdit(${f.id})">
      <div class="food-dropdown-name">${f.name}</div>
      <div class="food-dropdown-macros">每100g · 蛋白 ${f.protein}g · 碳水 ${f.carbs}g · 脂 ${f.fat}g · ${cal}kcal${f.unit_name ? ` · 1${f.unit_name}=${f.unit_grams}g` : ''}</div>
    </div>`;
  }).join('');
}

function selectFoodForEdit(id) {
  _editSelectedFood = foodLibrary.find(x => x.id === id);
  if (!_editSelectedFood) return;
  document.getElementById('edit-food-search').value = _editSelectedFood.name;
  document.getElementById('edit-food-dropdown').style.display = 'none';
  document.getElementById('edit-food-amount').focus();
}

function addFoodToEdit() {
  if (!_editSelectedFood) { showToast('请先搜索并选择食物', 'error'); return; }
  const amtVal = parseFloat(document.getElementById('edit-food-amount').value);
  if (!amtVal || amtVal <= 0) { showToast('请输入有效的克数', 'error'); return; }
  const grams = amtVal;
  const r = grams / 100;
  editNutFoodItems.push({
    name:    _editSelectedFood.name,
    grams:   grams,
    protein: Math.round(_editSelectedFood.protein * r * 10) / 10,
    carbs:   Math.round(_editSelectedFood.carbs   * r * 10) / 10,
    fat:     Math.round(_editSelectedFood.fat     * r * 10) / 10
  });
  _editSelectedFood = null;
  document.getElementById('edit-food-search').value = '';
  document.getElementById('edit-food-amount').value = '';
  document.getElementById('edit-food-dropdown').style.display = 'none';
  renderEditFoodList();
  recalcEditNutMacros();
}

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
        date:       document.getElementById('edit-nut-date').value,
        protein:    parseFloat(document.getElementById('edit-protein').value) || 0,
        carbs:      parseFloat(document.getElementById('edit-carbs').value) || 0,
        fat:        parseFloat(document.getElementById('edit-fat').value) || 0,
        calories:   parseInt(document.getElementById('edit-calories').value) || 0,
        notes:      document.getElementById('edit-nut-notes').value.trim(),
        food_items: editNutFoodItems
      };
    } else if (type === 'body') {
      const date = document.getElementById('edit-body-date').value;
      const time = document.getElementById('edit-body-time').value || '00:00';
      payload = {
        measured_at: `${date}T${time}:00`,
        weight:   parseFloat(document.getElementById('edit-weight').value) || null,
        body_fat: parseFloat(document.getElementById('edit-bf').value) || null,
        waist:    parseFloat(document.getElementById('edit-waist').value) || null,
        hip:      parseFloat(document.getElementById('edit-hip').value) || null,
        notes:    document.getElementById('edit-body-notes').value.trim()
      };
    }

    await sbPatch(table, id, payload);

    // Update cache
    const idx = cachedHistory[type].findIndex(r => r.id === id);
    if (idx >= 0) cachedHistory[type][idx] = { ...cachedHistory[type][idx], ...payload };
    renderHistoryView();
    if (type === 'nutrition') {
      const tidx = todayNutrition.findIndex(r => r.id === id);
      if (tidx >= 0) todayNutrition[tidx] = { ...todayNutrition[tidx], ...payload };
      renderTodayNutrition();
    }
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
  if (ex.target_sets && ex.target_sets.length > 0) {
    const firstReps = ex.target_sets[0].reps ? String(ex.target_sets[0].reps) : '';
    const setsLabel = ex.target_sets.length + '组' + (firstReps ? ' × ' + firstReps : '');

    // Build a compact weight reference string for the hint bar
    const weights = ex.target_sets.map(s => s.weight).filter(w => w !== '' && w != null);
    let planWeights = null;
    if (weights.length > 0) {
      const unique = [...new Set(weights.map(String))];
      planWeights = unique.length === 1
        ? unique[0] + ' lb'
        : weights.map(String).join(' / ') + ' lb';
    }

    return {
      name: ex.name, category: '计划',
      sets: ex.target_sets.map(s => ({ reps: '', weight: s.weight || '', plan_weight: s.weight || '' })),
      plan_sets: setsLabel, plan_rest: ex.rest || null,
      plan_target: ex.target || null, plan_reps: firstReps,
      plan_weights: planWeights,
    };
  }
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
    sets: Array.from({ length: count }, () => ({ reps: '', weight: '', plan_weight: '' })),
    plan_sets: planSets, plan_rest: planRest, plan_target: planTarget, plan_reps: reps,
    plan_weights: null,
  };
}

function dbPlanToInternal(row) {
  const warmup = (row.plan_warmup || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(w => ({ name: w.name, duration: w.duration, speed: w.speed, note: w.note }));
  const exercises = (row.plan_exercises || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(ex => {
      const target_sets = (ex.plan_sets || [])
        .filter(s => !s.is_warmup)
        .sort((a, b) => a.set_number - b.set_number)
        .map(s => ({ reps: s.reps || '', weight: s.weight_lb != null ? String(s.weight_lb) : '' }));
      const obj = {
        name: ex.name, category: ex.category || '', tag: ex.tag || '',
        rest: ex.rest_time || '', target: ex.target || '', warning: ex.warning || '',
        notes: ex.notes || [], warmup_sets: ex.warmup_sets || [], conditions: ex.conditions || [],
      };
      if (target_sets.length > 0) obj.target_sets = target_sets;
      return obj;
    });
  return { _id: row.id, name: row.name, description: row.description || '', warmup, exercises };
}

async function _savePlanToDb(plan, isEdit, editId) {
  const { url, key } = sbConfig();
  if (!url || !key) return null;

  let planId;
  if (isEdit) {
    await sbPatch('training_plans', editId, { name: plan.name, description: plan.description || '', updated_at: new Date().toISOString() });
    await sbDeleteWhere('plan_warmup',   `plan_id=eq.${editId}`);
    await sbDeleteWhere('plan_exercises', `plan_id=eq.${editId}`);
    planId = editId;
  } else {
    const rows = await sbPostReturn('training_plans', { name: plan.name, description: plan.description || '' });
    planId = rows[0].id;
  }

  if (plan.warmup && plan.warmup.length > 0) {
    await sbPost('plan_warmup', plan.warmup.map((w, i) => ({
      plan_id: planId, sort_order: i,
      name: w.name || '', duration: w.duration || '', speed: w.speed || '', note: w.note || ''
    })));
  }

  for (let i = 0; i < (plan.exercises || []).length; i++) {
    const ex = plan.exercises[i];
    const exRows = await sbPostReturn('plan_exercises', {
      plan_id: planId, sort_order: i,
      name: ex.name || '', category: ex.category || '', tag: ex.tag || '',
      rest_time: ex.rest || '', target: ex.target || '', warning: ex.warning || '',
      notes: ex.notes || [], warmup_sets: ex.warmup_sets || [], conditions: ex.conditions || []
    });
    const exId = exRows[0].id;
    if (ex.target_sets && ex.target_sets.length > 0) {
      await sbPost('plan_sets', ex.target_sets.map((s, si) => ({
        exercise_id: exId, set_number: si + 1,
        reps: s.reps || '',
        weight_lb: s.weight !== '' && s.weight != null ? Number(s.weight) : null,
        is_warmup: false
      })));
    }
  }

  return planId;
}

async function renderPlanList() {
  const el = document.getElementById('plan-list');
  if (!el) return;
  const { url, key } = sbConfig();
  if (url && key) {
    el.innerHTML = '<div class="plan-empty" style="padding:1rem">加载中…</div>';
    try {
      const rows = await sbGet('training_plans', 'select=*,plan_warmup(*),plan_exercises(*,plan_sets(*))&order=created_at.asc');
      plansCache = rows.map(dbPlanToInternal);
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
      if (ex.target_sets && ex.target_sets.length > 0) {
        html += `<table class="sets-table plan-sets-table"><thead><tr><th>组</th><th>次数</th><th>重量(lb)</th></tr></thead><tbody>` +
          ex.target_sets.map((s, si) =>
            `<tr><td class="set-num">${si+1}</td><td>${s.reps||'—'}</td><td>${s.weight||'—'}</td></tr>`
          ).join('') + `</tbody></table>`;
        if (ex.rest) html += `<div class="plan-ex-meta"><span class="plan-meta-item">⏱ ${ex.rest}</span></div>`;
      } else if (ex.conditions && ex.conditions.length > 0) {
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

function exportCurrentPlan() {
  if (currentPlanIdx === null) return;
  const plan = plansCache[currentPlanIdx];
  const clean = { ...plan };
  delete clean._id;
  const json = JSON.stringify(clean, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (plan.name || 'plan') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function editCurrentPlan() {
  if (currentPlanIdx === null) return;
  openPlanEditor(currentPlanIdx);
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

// ── Plan Editor ──
let _planEditorBase = null;

function _planExToEditorEx(ex) {
  if (ex.target_sets && ex.target_sets.length > 0) {
    return {
      name: ex.name, category: ex.category || '计划',
      rest: ex.rest || '', target: ex.target || '',
      target_sets: ex.target_sets.map(s => ({ reps: s.reps || '', weight: s.weight || '' })),
    };
  }
  const { count, reps } = _parsePlanSets(ex.sets);
  return {
    name: ex.name, category: ex.category || '计划',
    rest: ex.rest || (ex.conditions?.[0]?.rest) || '',
    target: ex.target || '',
    target_sets: Array.from({ length: count }, () => ({ reps, weight: '' })),
  };
}

function openPlanEditor(idx) {
  if (idx !== null && idx !== undefined) {
    const plan = plansCache[idx];
    currentPlanIdx = idx;
    _editingPlanId = plan._id || null;
    _planEditorBase = { ...plan };
    document.getElementById('plan-editor-name').value = plan.name || '';
    planEditorExercises = (plan.exercises || []).map(_planExToEditorEx);
  } else {
    _editingPlanId = null;
    _planEditorBase = null;
    document.getElementById('plan-editor-name').value = '';
    planEditorExercises = [];
  }
  renderPlanEditorExCards();
  document.getElementById('plan-list-view').style.display = 'none';
  document.getElementById('plan-detail-view').style.display = 'none';
  document.getElementById('plan-editor-view').style.display = 'block';
}

function closePlanEditor() {
  const wasEditing = !!_editingPlanId && currentPlanIdx !== null;
  document.getElementById('plan-editor-view').style.display = 'none';
  if (wasEditing) {
    document.getElementById('plan-detail-view').style.display = 'block';
    const plan = plansCache[currentPlanIdx];
    if (plan) document.getElementById('plan-detail-content').innerHTML = renderPlanDetailHTML(plan);
  } else {
    showPlanList();
  }
  _editingPlanId = null;
  _planEditorBase = null;
}

function renderPlanEditorExCards() {
  const container = document.getElementById('plan-editor-exercises');
  if (!container) return;
  if (planEditorExercises.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = planEditorExercises.map((ex, ei) => `
    <div class="ex-card">
      <div class="ex-card-header">
        <span><span class="ex-card-name">${ex.name}</span><span class="ex-card-cat">${ex.category}</span></span>
        <button class="ex-card-remove" onclick="removePlanEditorEx(${ei})">✕</button>
      </div>
      <div class="plan-editor-ex-meta">
        <div class="plan-editor-field">
          <span class="plan-editor-label">休息时间</span>
          <input class="plan-editor-meta-input" type="text" value="${ex.rest}" placeholder="90秒"
            oninput="updatePlanEditorMeta(${ei},'rest',this.value)" />
        </div>
        <div class="plan-editor-field">
          <span class="plan-editor-label">目标提示</span>
          <input class="plan-editor-meta-input" type="text" value="${ex.target}" placeholder="RIR 1-2…"
            oninput="updatePlanEditorMeta(${ei},'target',this.value)" />
        </div>
      </div>
      <table class="sets-table">
        <thead><tr><th>组</th><th>次数范围</th><th>重量(lb)</th><th></th></tr></thead>
        <tbody>${ex.target_sets.map((s, si) => `
          <tr>
            <td class="set-num">${si + 1}</td>
            <td><input class="set-input" type="text" value="${s.reps}" placeholder="8-12"
              oninput="updatePlanEditorSet(${ei},${si},'reps',this.value)" /></td>
            <td><input class="set-input" type="number" min="0" step="0.5" value="${s.weight}" placeholder="—"
              oninput="updatePlanEditorSet(${ei},${si},'weight',this.value)" /></td>
            <td>${ex.target_sets.length > 1
              ? `<button class="remove-set-btn" onclick="removePlanEditorSet(${ei},${si})">−</button>`
              : '<span style="display:inline-block;width:22px"></span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="ex-card-footer">
        <button class="add-set-btn" onclick="addPlanEditorSet(${ei})">＋ 添加组</button>
      </div>
    </div>`).join('');
}

function removePlanEditorEx(ei) { planEditorExercises.splice(ei, 1); renderPlanEditorExCards(); }
function addPlanEditorSet(ei) { planEditorExercises[ei].target_sets.push({ reps: '', weight: '' }); renderPlanEditorExCards(); }
function removePlanEditorSet(ei, si) { planEditorExercises[ei].target_sets.splice(si, 1); renderPlanEditorExCards(); }
function updatePlanEditorSet(ei, si, field, val) { planEditorExercises[ei].target_sets[si][field] = val; }
function updatePlanEditorMeta(ei, field, val) { planEditorExercises[ei][field] = val; }

async function savePlanFromEditor() {
  const name = document.getElementById('plan-editor-name').value.trim();
  if (!name) { showToast('请输入计划名称', 'error'); return; }
  if (planEditorExercises.length === 0) { showToast('请至少添加一个动作', 'error'); return; }

  const isEdit = !!_editingPlanId;
  const plan = {
    ...(_planEditorBase || {}),
    name,
    exercises: planEditorExercises.map(ex => {
      const obj = { name: ex.name, category: ex.category, target_sets: ex.target_sets };
      if (ex.rest)   obj.rest   = ex.rest;
      if (ex.target) obj.target = ex.target;
      return obj;
    }),
  };
  delete plan._id;

  const btn = document.getElementById('plan-editor-save-btn');
  btn.disabled = true; btn.textContent = '保存中…';

  try {
    const planId = await _savePlanToDb(plan, isEdit, _editingPlanId);
    if (isEdit) {
      const idx = plansCache.findIndex(p => p._id === _editingPlanId);
      if (idx >= 0) plansCache[idx] = { ...plan, _id: _editingPlanId };
    } else {
      plansCache.push({ ...plan, _id: planId });
    }
    localStorage.setItem('training_plans', JSON.stringify(plansCache));
    showToast(`✓ 已${isEdit ? '保存' : '创建'}「${name}」`, 'success');
    closePlanEditor();
    _renderPlanListUI();
  } catch (e) {
    showToast('保存失败：' + e.message, 'error');
    btn.disabled = false; btn.textContent = isEdit ? '保存计划' : '创建计划';
  }
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

  try {
    const planId = await _savePlanToDb(plan, isEdit, _editingPlanId);
    if (isEdit) {
      const idx = plansCache.findIndex(p => p._id === _editingPlanId);
      if (idx >= 0) plansCache[idx] = { ...plan, _id: _editingPlanId };
    } else {
      plansCache.push({ ...plan, _id: planId });
    }
    localStorage.setItem('training_plans', JSON.stringify(plansCache));
    showToast(`✓ 已${isEdit ? '更新' : '导入'}「${plan.name}」`, 'success');
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
