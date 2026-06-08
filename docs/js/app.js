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
let selectedExercises = []; // [{name, category, sets:[{reps,weight}]}]
let currentPickerCat = Object.keys(EXERCISES)[0];

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  updateHeaderDate();
  checkUrlConfig();
  renderLibrary();
  renderPickerCategories();
});

function setTodayDate() {
  const d = new Date();
  const iso = d.toISOString().split('T')[0];
  document.getElementById('log-date').value = iso;
}

function updateHeaderDate() {
  const d = new Date();
  document.getElementById('header-date').textContent =
    d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
}

function checkUrlConfig() {
  const token = localStorage.getItem('ghToken');
  const banner = document.getElementById('no-url-banner');
  banner.classList.toggle('show', !token);
}

// ── Tab Switching ──
function switchTab(name) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
}

// ── Exercise Picker Modal ──
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
  const container = document.getElementById('modal-cat-tabs');
  container.innerHTML = Object.keys(EXERCISES).map(cat => `
    <button class="cat-tab ${cat === currentPickerCat ? 'active' : ''}"
      onclick="selectPickerCat('${cat}')">${cat}</button>
  `).join('');
}

function selectPickerCat(cat) {
  currentPickerCat = cat;
  renderPickerCategories();
  renderPickerList();
}

function renderPickerList() {
  const list = document.getElementById('modal-exercise-list');
  const exs = EXERCISES[currentPickerCat] || [];
  const selectedNames = selectedExercises.map(e => e.name);
  list.innerHTML = exs.map(name => `
    <button class="modal-ex-btn ${selectedNames.includes(name) ? 'selected' : ''}"
      onclick="toggleExercise('${name}', '${currentPickerCat}')">
      ${name}
    </button>
  `).join('');
}

function toggleExercise(name, category) {
  const idx = selectedExercises.findIndex(e => e.name === name);
  if (idx >= 0) {
    selectedExercises.splice(idx, 1);
  } else {
    selectedExercises.push({ name, category, sets: [{ reps: '', weight: '' }] });
  }
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
  const container = document.getElementById('exercise-cards');
  if (selectedExercises.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = selectedExercises.map((ex, exIdx) => `
    <div class="ex-card" id="ex-card-${exIdx}">
      <div class="ex-card-header">
        <span>
          <span class="ex-card-name">${ex.name}</span>
          <span class="ex-card-cat">${ex.category}</span>
        </span>
        <button class="ex-card-remove" onclick="removeExercise(${exIdx})">✕</button>
      </div>
      <table class="sets-table">
        <thead><tr>
          <th>组</th><th>次数</th><th>重量(kg)</th><th></th>
        </tr></thead>
        <tbody>
          ${ex.sets.map((set, sIdx) => `
            <tr>
              <td class="set-num">${sIdx + 1}</td>
              <td><input class="set-input" type="number" min="1" max="100" placeholder="—"
                value="${set.reps}"
                onchange="updateSet(${exIdx}, ${sIdx}, 'reps', this.value)" /></td>
              <td><input class="set-input" type="number" min="0" step="0.5" placeholder="—"
                value="${set.weight}"
                onchange="updateSet(${exIdx}, ${sIdx}, 'weight', this.value)" /></td>
              <td>${ex.sets.length > 1
                ? `<button class="remove-set-btn" onclick="removeSet(${exIdx}, ${sIdx})">−</button>`
                : '<span style="display:inline-block;width:24px"></span>'
              }</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="ex-card-footer">
        <button class="add-set-btn" onclick="addSet(${exIdx})">＋ 添加组</button>
      </div>
    </div>
  `).join('');
}

function removeExercise(idx) {
  selectedExercises.splice(idx, 1);
  renderExerciseCards();
}

function addSet(exIdx) {
  selectedExercises[exIdx].sets.push({ reps: '', weight: '' });
  renderExerciseCards();
}

function removeSet(exIdx, sIdx) {
  selectedExercises[exIdx].sets.splice(sIdx, 1);
  renderExerciseCards();
}

function updateSet(exIdx, sIdx, field, value) {
  selectedExercises[exIdx].sets[sIdx][field] = value;
}

// ── GitHub API ──
const GH_OWNER = 'wzy236';
const GH_REPO  = 'Fitness';
const GH_FILE  = 'data/logs.json';
const GH_API   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;

function ghHeaders() {
  const token = localStorage.getItem('ghToken');
  return {
    'Accept': 'application/vnd.github+json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// UTF-8 safe base64 encode/decode
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(str) {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
}

async function ghReadLogs() {
  const res = await fetch(GH_API, { headers: ghHeaders() });
  if (res.status === 404) return { logs: [], sha: null };
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const file = await res.json();
  const logs = JSON.parse(b64decode(file.content));
  return { logs, sha: file.sha };
}

async function ghWriteLogs(logs, sha, commitMsg) {
  const body = {
    message: commitMsg,
    content: b64encode(JSON.stringify(logs, null, 2)),
    ...(sha ? { sha } : {})
  };
  const res = await fetch(GH_API, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
}

// ── Save Workout ──
async function saveWorkout() {
  const token = localStorage.getItem('ghToken');
  if (!token) { showToast('请先在设置里填写 GitHub Token', 'error'); return; }
  if (selectedExercises.length === 0) { showToast('请先添加至少一个动作', 'error'); return; }

  const saveBtn = document.querySelector('.save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中…';

  const entry = {
    date:      document.getElementById('log-date').value,
    duration:  parseInt(document.getElementById('log-duration').value) || 0,
    notes:     document.getElementById('log-notes').value.trim(),
    exercises: selectedExercises.map(ex => ({
      name:     ex.name,
      category: ex.category,
      sets:     ex.sets.filter(s => s.reps || s.weight)
    })),
    logged_at: new Date().toISOString()
  };

  try {
    const { logs, sha } = await ghReadLogs();
    logs.push(entry);
    await ghWriteLogs(logs, sha, `workout: ${entry.date}`);
    showToast('✓ 已保存到 GitHub', 'success');
    selectedExercises = [];
    renderExerciseCards();
    document.getElementById('log-notes').value = '';
    document.getElementById('log-duration').value = '';
    setTodayDate();
  } catch (err) {
    showToast('保存失败：' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '保存到 GitHub';
  }
}

// ── History ──
async function loadHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="empty-state">加载中…</div>';
  try {
    const { logs } = await ghReadLogs();
    renderHistory([...logs].reverse());
  } catch (err) {
    list.innerHTML = `<div class="empty-state" style="color:#f87171">加载失败：${err.message}</div>`;
  }
}

function renderHistory(logs) {
  const list = document.getElementById('history-list');
  if (logs.length === 0) {
    list.innerHTML = '<div class="empty-state">还没有记录，去「记录」tab 添加第一次训练吧</div>';
    return;
  }
  list.innerHTML = logs.map(log => {
    const exLines = (log.exercises || []).map(ex => {
      const setStr = (ex.sets || []).length
        ? ex.sets.map(s => `${s.reps || '?'}次${s.weight ? '×' + s.weight + 'kg' : ''}`).join(' / ')
        : '';
      return `<div class="history-ex"><strong>${ex.name}</strong>${setStr ? '：' + setStr : ''}</div>`;
    }).join('');
    return `
      <div class="history-card">
        <div class="history-card-header">
          <span class="history-date">${log.date}</span>
          <span class="history-meta">${log.duration ? log.duration + ' 分钟' : ''}</span>
        </div>
        <div class="history-body">
          ${exLines}
          ${log.notes ? `<div class="history-notes">${log.notes}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Copy for AI ──
async function copyForAI() {
  let logs = [];
  try {
    const data = await ghReadLogs();
    logs = [...data.logs].reverse().slice(0, 14);
  } catch {}

  if (logs.length === 0) { showToast('没有历史记录可复制', 'error'); return; }

  const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' });
  let text = `我的最近运动记录（共 ${logs.length} 条）：\n\n`;
  logs.forEach(log => {
    text += `【${log.date}${log.duration ? '，' + log.duration + ' 分钟' : ''}】\n`;
    (log.exercises || []).forEach(ex => {
      const setStr = (ex.sets || []).length
        ? ex.sets.map(s => `${s.reps || '?'}次${s.weight ? '×' + s.weight + 'kg' : ''}`).join(' / ')
        : '已记录';
      text += `  - ${ex.name}（${ex.category}）：${setStr}\n`;
    });
    if (log.notes) text += `  备注：${log.notes}\n`;
    text += '\n';
  });
  text += `今天是 ${today}。\n\n请根据我的训练历史，分析肌肉恢复情况，建议我今天训练哪个肌群，并给出具体的动作和组数建议。`;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  showToast('✓ 已复制！去 Claude.ai 粘贴即可', 'success');
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
  const token = document.getElementById('gh-token').value.trim();
  if (!token) { showStatus('请填写 GitHub Token', 'err'); return; }
  localStorage.setItem('ghToken', token);
  checkUrlConfig();
  showStatus('✓ 已保存', 'ok');
}

async function testConnection() {
  const token = document.getElementById('gh-token').value.trim() || localStorage.getItem('ghToken');
  if (!token) { showStatus('请先填写 GitHub Token', 'err'); return; }
  localStorage.setItem('ghToken', token);
  showStatus('测试中…', '');
  try {
    const { logs } = await ghReadLogs();
    showStatus(`✓ 连接成功，已有 ${logs.length} 条记录`, 'ok');
    checkUrlConfig();
  } catch (err) {
    showStatus('连接失败：' + err.message, 'err');
  }
}

function showStatus(msg, type) {
  const el = document.getElementById('settings-status');
  el.textContent = msg;
  el.className = 'settings-status ' + type;
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('ghToken');
  if (saved) document.getElementById('gh-token').value = saved;
});

// ── Toast ──
let toastTimer;
function showToast(msg, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
