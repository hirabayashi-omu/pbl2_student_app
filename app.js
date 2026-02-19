// PBL2 Student Manager - app.js

// --- State Management ---
let state = {
    themeName: '',
    groupSymbol: '', // A, B, C...
    groupName: '',   // Catchy name
    teamsUrl: '',    // URL to Teams chat/channel
    members: [],
    tasks: [],
    reports: {}, // { iteration: { content: '', images: [] } }
    artifactSettings: {}, // { key: { slides: [{src, hotspots: [{rect, authorIdx}]}] } }
    analysisReport: { bg: '', problem: '', solution: '', images: [] },
    artifacts: { // Track specific deliverables (toggles)
        poster: false,
        leaflet: false,
        pamphlet_25: false,
        slides_25: false
    },
    schedule: [], // Loaded from CSV data
    sidebarCollapsed: false
};

const STORAGE_KEY = 'pbl2_student_manager_data';

// --- Artifact Detail Selection State ---
let currentArtifactKey = null;
let currentSlideIndex = -1;
let isDrawingHotspot = false;
let hotspotStartPos = { x: 0, y: 0 };

const MEMBER_ROLES = [
    { title: 'プロジェクトリーダー', desc: 'プロジェクトの取りまとめ' },
    { title: 'マーケティング', desc: '市場調査・競合などの現状分析、データの分析・可視化' },
    { title: 'エンジニアリング', desc: '技術開発・仕様の決定、設計書の作成、モックアップ具体化' },
    { title: 'プロモーション', desc: '製品サービスの情報発信、マーケティング資料のデザイン作成' }
];

const BASE_COURSES = [
    'エネルギー機械',
    'プロダクトデザイン',
    'エレクトロニクス',
    '知能情報'
];

// Pre-parsed schedule data from CSV (2026 example)
const DEFAULT_SCHEDULE = [
    { id: 1, date: '2026-04-15', label: 'ガイダンス（1回目・水1）' },
    { id: 2, date: '2026-04-22', label: '企業テーマ説明（2回目・水2）' },
    { id: 3, date: '2026-04-29', label: 'グループ活動：分担決定（3回目・水3）' },
    { id: 4, date: '2026-05-13', label: 'グループ活動（4回目・水4）' },
    { id: 5, date: '2026-05-20', label: 'グループ活動（5回目・水5）' },
    { id: 6, date: '2026-05-27', label: 'グループ活動（6回目・水6）' },
    { id: 7, date: '2026-06-03', label: 'グループ活動（7回目・水7）' },
    { id: 8, date: '2026-06-17', label: 'グループ活動（9回目・水9）' },
    { id: 9, date: '2026-06-24', label: 'グループ活動（10回目・水10）' },
    { id: 10, date: '2026-07-01', label: 'グループ活動（11回目・水11）' },
    { id: 11, date: '2026-07-08', label: 'グループ活動（12回目・水12）' },
    { id: 12, date: '2026-07-15', label: 'グループ活動（13回目・水13）' },
    { id: 13, date: '2026-07-22', label: '中間発表（夏休み前・14回目・水14）' },
    { id: 14, date: '2026-09-16', label: '後期活動開始（15回目・水15）' },
    { id: 15, date: '2026-09-30', label: '工学祭等調整（1回目・水1）' },
    { id: 16, date: '2026-10-07', label: 'グループ活動（2回目・水2）' },
    { id: 17, date: '2026-10-14', label: 'グループ活動（3回目・水3）' },
    { id: 18, date: '2026-10-21', label: 'グループ活動（4回目・水4）' },
    { id: 19, date: '2026-10-28', label: 'グループ活動（5回目・水5）' },
    { id: 20, date: '2026-11-04', label: 'グループ活動（6回目・水6）' },
    { id: 21, date: '2026-11-18', label: 'グループ活動（7回目・水7）' },
    { id: 22, date: '2026-12-02', label: 'グループ活動（9回目・水9）' },
    { id: 23, date: '2026-12-09', label: 'グループ活動（10回目・水10）' },
    { id: 24, date: '2026-12-16', label: 'グループ活動（11回目・水11）' },
    { id: 25, date: '2026-12-23', label: 'グループ活動（12回目・水12）' },
    { id: 26, date: '2027-01-06', label: '最終発表（13回目・水13）' },
    { id: 27, date: '2027-01-13', label: '最終発表（14回目・水14）' },
    { id: 28, date: '2027-02-03', label: '予備日（15回目・水15）' }
];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    lucide.createIcons();
    initEventListeners();
    renderAll();
});

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
    } else {
        state.schedule = DEFAULT_SCHEDULE;
    }
    // Sync UI with state
    updateDisplayInfo();

    // Restore sidebar state
    if (state.sidebarCollapsed) {
        document.querySelector('.sidebar').classList.add('collapsed');
    } else {
        document.querySelector('.sidebar').classList.remove('collapsed');
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateDisplayInfo();
}

function updateDisplayInfo() {
    document.getElementById('display-theme-name').textContent = state.themeName || '未設定のテーマ';
    document.getElementById('gantt-theme-display').textContent = state.themeName || '未設定のテーマ';

    const combinedGroupName = state.groupSymbol ? `グループ ${state.groupSymbol}${state.groupName ? ': ' + state.groupName : ''}` : (state.groupName || '未設定のグループ');
    document.getElementById('display-group-name').textContent = combinedGroupName;
    document.getElementById('gantt-group-display').textContent = combinedGroupName;

    document.getElementById('input-theme-name').value = state.themeName || '';
    document.getElementById('select-group-symbol').value = state.groupSymbol || '';
    document.getElementById('input-group-name').value = state.groupName || '';

    // Dynamic Teams Group Chat Link (includes all members)
    const teamsBtn = document.getElementById('btn-group-teams');
    const memberEmails = state.members
        .filter(m => m.emailLocal)
        .map(m => `${m.emailLocal}@st.omu.ac.jp`);

    if (memberEmails.length > 0) {
        state.teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${memberEmails.join(',')}`;
        teamsBtn.style.display = 'flex';
        teamsBtn.title = `全員 (${memberEmails.length}名) とチャット`;
        teamsBtn.onclick = () => window.open(state.teamsUrl, '_blank');
    } else {
        state.teamsUrl = '';
        teamsBtn.style.display = 'none';
    }

    // Reports progress
    const completedReports = Object.keys(state.reports).length;
    document.getElementById('completed-reports-count').textContent = completedReports;
    const progressPercent = (completedReports / 25) * 100;
    document.getElementById('reports-progress').style.width = `${progressPercent}%`;

    // Tasks progress
    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const taskRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    document.getElementById('task-completion-rate').textContent = taskRate;
    document.getElementById('tasks-progress').style.width = `${taskRate}%`;

    // Artifacts progress
    const artifactKeys = ['poster', 'leaflet', 'pamphlet_25', 'slides_25'];
    const completedArtifacts = artifactKeys.filter(k => state.artifacts[k]).length;
    const artifactDisplay = document.getElementById('completed-artifacts-count');
    if (artifactDisplay) {
        artifactDisplay.textContent = completedArtifacts;
        const artPercent = (completedArtifacts / artifactKeys.length) * 100;
        document.getElementById('artifacts-progress').style.width = `${artPercent}%`;
    }
}

// --- View Controller ---
function initEventListeners() {
    // Navigation
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('collapsed');
        state.sidebarCollapsed = sidebar.classList.contains('collapsed');
        saveState();
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.getAttribute('data-view');
            switchView(viewId);
        });
    });

    // Theme/Group Setup
    document.getElementById('input-theme-name').addEventListener('input', (e) => {
        state.themeName = e.target.value;
        saveState();
    });
    document.getElementById('select-group-symbol').addEventListener('change', (e) => {
        state.groupSymbol = e.target.value;
        saveState();
    });
    document.getElementById('input-group-name').addEventListener('input', (e) => {
        state.groupName = e.target.value;
        saveState();
    });

    // Members
    document.getElementById('btn-add-member').addEventListener('click', addMemberRow);

    // Task Modal
    document.getElementById('btn-add-task').addEventListener('click', () => openTaskModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => closeModal());
    document.getElementById('btn-save-task').addEventListener('click', saveTask);

    // Work Report Form (new full implementation)
    initWorkReportForm();

    // Data Export/Import
    document.getElementById('btn-export-json').addEventListener('click', exportData);
    document.getElementById('btn-trigger-import').addEventListener('click', () => {
        document.getElementById('import-json-file').click();
    });
    document.getElementById('import-json-file').addEventListener('change', importData);
    document.getElementById('btn-reset-data').addEventListener('click', resetData);

    // Artifact Detail Modal
    document.getElementById('btn-close-artifact-modal').addEventListener('click', closeArtifactModal);
    document.getElementById('btn-save-artifact-data').addEventListener('click', saveArtifactData);
    document.getElementById('btn-add-artifact-slide').addEventListener('click', () => document.getElementById('artifact-slide-input').click());
    document.getElementById('artifact-slide-input').addEventListener('change', handleArtifactSlideUpload);
    initHotspotLogic();

    // Report Tabs switching
    document.querySelectorAll('.report-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const reportId = tab.getAttribute('data-report');
            switchTab(reportId);
        });
    });

    // Save Analysis & Contribution
    document.getElementById('btn-save-analysis').addEventListener('click', saveAnalysisReport);
    document.getElementById('btn-save-contribution').addEventListener('click', saveContributionSurvey);

    // General Save
    document.getElementById('btn-save-all').addEventListener('click', () => {
        saveState();
        alert('データを保存しました');
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if (n.getAttribute('data-view') === viewId) n.classList.add('active');
    });

    const titles = {
        dashboard: 'ダッシュボード',
        gantt: 'プロジェクト管理',
        reports: '報告書・レポート作成',
        members: 'メンバー・テーマ設定',
        data: 'データ管理',
        mindmap: '思考整理 (Mind Map)'
    };
    document.getElementById('view-title').textContent = titles[viewId] || 'PBL2 Manager';

    if (viewId === 'mindmap' && typeof MindMapModule !== 'undefined') {
        // Load global mindmap
        const savedGlobal = localStorage.getItem('mindmap_data_v1');
        MindMapModule.init();
        if (!savedGlobal) {
            // First time - initialize with theme name and center it
            MindMapModule.loadData(null, state.themeName || 'プロジェクトテーマ');
        }
    }
    if (viewId === 'gantt') renderGantt();
    if (viewId === 'members') renderMemberList();
    if (viewId === 'reports') {
        const currentTab = document.querySelector('.report-tab.active').getAttribute('data-report');
        if (currentTab === 'work-report') loadWorkReport();
        else if (currentTab === 'analysis-report') loadAnalysisReport();
        else if (currentTab === 'contribution') loadContributionSurvey();
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.report-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-report') === tabId);
    });
    document.querySelectorAll('.report-content').forEach(c => {
        c.classList.toggle('active', c.id === `report-${tabId}`);
    });

    if (tabId === 'work-report') loadWorkReport();
    else if (tabId === 'analysis-report') loadAnalysisReport();
    else if (tabId === 'contribution') loadContributionSurvey();
}

// --- Member Logic ---
function renderMemberList() {
    const listContainer = document.getElementById('member-list-container');
    listContainer.innerHTML = '';

    state.members.forEach((member, index) => {
        const card = document.createElement('div');
        card.className = 'member-card card';

        const roleOptions = MEMBER_ROLES.map(role =>
            `<option value="${role.title}" ${member.role === role.title ? 'selected' : ''}>${role.title}</option>`
        ).join('');

        const courseOptions = BASE_COURSES.map(course =>
            `<option value="${course}" ${member.course === course ? 'selected' : ''}>${course}</option>`
        ).join('');

        const fullName = `${member.lastName || ''} ${member.firstName || ''}`.trim();
        const teamsLink = member.emailLocal ? `https://teams.microsoft.com/l/chat/0/0?users=${member.emailLocal}@st.omu.ac.jp` : null;

        card.innerHTML = `
            <div class="member-card-header">
                <div class="member-badges">
                    <span class="badge badge-course">${member.course || '未設定'}</span>
                    <span class="badge badge-role">${member.role || '未設定'}</span>
                </div>
                <div class="header-actions">
                    ${teamsLink ? `
                        <a href="${teamsLink}" target="_blank" class="btn-icon teams-link" title="Teamsでチャット">
                            <i data-lucide="messages-square"></i>
                        </a>
                    ` : ''}
                    <button class="btn-icon text-danger" style="background:none; border:none; cursor:pointer;" onclick="removeMember(${index})">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                </div>
            </div>
            <div class="member-card-body">
                <div class="form-row">
                    <div class="form-group">
                        <label>姓</label>
                        <input type="text" value="${member.lastName || ''}" onchange="updateMember(${index}, 'lastName', this.value)" placeholder="姓">
                    </div>
                    <div class="form-group">
                        <label>名</label>
                        <input type="text" value="${member.firstName || ''}" onchange="updateMember(${index}, 'firstName', this.value)" placeholder="名">
                    </div>
                </div>
                <div class="form-group">
                    <label>メールアドレス</label>
                    <div class="email-input-group">
                        <input type="text" value="${member.emailLocal || ''}" onchange="updateMember(${index}, 'emailLocal', this.value)" placeholder="学籍番号など">
                        <div class="email-suffix">@st.omu.ac.jp</div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>基盤コース</label>
                        <select onchange="updateMember(${index}, 'course', this.value)">
                            <option value="">選択してください</option>
                            ${courseOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>担当役割</label>
                        <select onchange="updateMember(${index}, 'role', this.value)">
                            <option value="">選択してください</option>
                            ${roleOptions}
                        </select>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
    lucide.createIcons();
}

function addMemberRow() {
    state.members.push({ lastName: '', firstName: '', email: '', course: '', role: '' });
    renderMemberList();
    renderRoleGuide();
    saveState();
}

function renderRoleGuide() {
    const container = document.getElementById('role-guide-list');
    if (!container) return;

    container.innerHTML = MEMBER_ROLES.map(role => {
        const isPL = role.title === 'プロジェクトリーダー';

        // If PL, include all members. Otherwise, only members with that role.
        const targetMembers = isPL
            ? state.members.filter(m => m.emailLocal)
            : state.members.filter(m => m.role === role.title && m.emailLocal);

        const emails = targetMembers.map(m => `${m.emailLocal}@st.omu.ac.jp`);

        const teamsLink = emails.length > 0
            ? `https://teams.microsoft.com/l/chat/0/0?users=${emails.join(',')}`
            : null;

        return `
            <div class="role-definition-row">
                <div class="role-cell role-title-cell">
                    <span class="badge badge-role">${role.title}</span>
                </div>
                <div class="role-cell role-desc-cell">${role.desc}</div>
                <div class="role-cell role-action-cell">
                    ${teamsLink ? `
                        <a href="${teamsLink}" target="_blank" class="btn btn-secondary btn-sm teams-sub-link">
                            <i data-lucide="messages-square"></i> ${isPL ? 'メンバー全員とチャット' : `${role.title}班とチャット`}
                        </a>
                    ` : '<span class="text-dim" style="font-size:11px;">(メンバー未登録)</span>'}
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

window.updateMember = (index, key, value) => {
    state.members[index][key] = value;
    saveState();
    renderMemberList();
    updateDisplayInfo();
};

window.removeMember = (index) => {
    state.members.splice(index, 1);
    renderMemberList();
    saveState();
};

// --- Gantt Logic ---
function renderGantt() {
    const container = document.getElementById('gantt-chart');
    container.innerHTML = '';

    const ganttTable = document.createElement('div');
    ganttTable.className = 'gantt-table';

    // Highlight today logic
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let currentIteration = -1;
    for (let i = 0; i < DEFAULT_SCHEDULE.length; i++) {
        if (DEFAULT_SCHEDULE[i].date <= todayStr) {
            currentIteration = DEFAULT_SCHEDULE[i].id;
        } else {
            break;
        }
    }

    // Header
    const labelHeader = document.createElement('div');
    labelHeader.className = 'gantt-header-col';
    labelHeader.textContent = 'タスク名';
    ganttTable.appendChild(labelHeader);

    const timelineHeader = document.createElement('div');
    timelineHeader.className = 'gantt-timeline-col';
    for (let i = 1; i <= 28; i++) {
        const tick = document.createElement('div');
        tick.className = 'gantt-tick';

        // Get date from schedule
        const event = DEFAULT_SCHEDULE[i - 1];
        const dateStr = event ? event.date.substring(5).replace('-', '/') : ''; // Get MM/DD

        let content = `<span class="tick-num">${i}</span>`;
        if (dateStr) content += `<span class="tick-date">${dateStr}</span>`;

        if (i === 1) content = '<span class="semester-label">前期</span>' + content;
        else if (i === 14) content = '<span class="semester-label">後期</span>' + content;

        // Add Exam labels
        if (i === 7 || i === 20) content = '<span class="semester-label exam-label">中間試験</span>' + content;
        else if (i === 12) content = '<span class="semester-label exam-label">前期末試験</span>' + content;
        else if (i === 27) content = '<span class="semester-label exam-label">学年末試験</span>' + content;

        tick.innerHTML = content;

        // Semantic Borders for Exams and Semesters
        if (i === 13) tick.classList.add('semester-border');
        if (i === 12) tick.classList.add('exam-border-final');
        if (i === 7 || i === 20) tick.classList.add('exam-border-mid');
        if (i === 27) tick.classList.add('exam-border-final');
        if (i === 27) tick.classList.add('exam-border-final', 'exam-year-end');

        if (i === currentIteration) tick.classList.add('is-today');

        timelineHeader.appendChild(tick);
    }
    ganttTable.appendChild(timelineHeader);

    // --- NEW: Events Status Row ---
    const eventsLabel = document.createElement('div');
    eventsLabel.className = 'gantt-label event-row-label';
    eventsLabel.innerHTML = `
        <i data-lucide="calendar" style="width:14px; height:14px; margin-right:8px; color:var(--accent); flex-shrink:0;"></i>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">授業イベント</span>
    `;
    ganttTable.appendChild(eventsLabel);

    const eventsGrid = document.createElement('div');
    eventsGrid.className = 'gantt-grid event-row-grid';
    for (let i = 1; i <= 28; i++) {
        const cell = document.createElement('div');
        cell.className = 'gantt-cell';

        // Find if this session (i) has a special event in DEFAULT_SCHEDULE
        // DEFAULT_SCHEDULE has 28 entries, we map them carefully
        const event = DEFAULT_SCHEDULE[i - 1];
        if (event) {
            const marker = document.createElement('div');
            marker.className = 'event-marker';
            // Show short label if it's special
            let shortLabel = '';
            if (event.label.includes('ガイダンス')) shortLabel = 'ガイダンス';
            else if (event.label.includes('企業テーマ')) shortLabel = 'テーマ説明';
            else if (event.label.includes('中間発表')) shortLabel = '中間発表';
            else if (event.label.includes('最終発表')) shortLabel = '最終発表';
            else if (event.label.includes('予備日')) shortLabel = '予備日';
            else if (event.label.includes('分担決定')) shortLabel = '分担決定';

            // Explicit logic for specified sessions
            if (i === 26 || i === 27) shortLabel = '最終発表';
            if (i === 28) shortLabel = '予備日';

            if (shortLabel) {
                marker.classList.add('special-event');
                // Split into 2 lines for better fit in 40px cells
                let displayLabel = shortLabel;
                if (shortLabel.length >= 4) {
                    if (shortLabel.includes('発表')) displayLabel = shortLabel.replace('発表', '<br>発表');
                    else if (shortLabel.includes('説明')) displayLabel = shortLabel.replace('説明', '<br>説明');
                    else if (shortLabel.includes('決定')) displayLabel = shortLabel.replace('決定', '<br>決定');
                    else {
                        const mid = Math.floor(shortLabel.length / 2);
                        displayLabel = shortLabel.substring(0, mid) + '<br>' + shortLabel.substring(mid);
                    }
                }
                marker.innerHTML = `<span>${displayLabel}</span>`;
            }
            cell.appendChild(marker);
        }
        if (i === 13) cell.classList.add('semester-border');
        if (i === 12) cell.classList.add('exam-border-final');
        if (i === 7 || i === 20) cell.classList.add('exam-border-mid');
        if (i === 27) cell.classList.add('exam-border-final');
        eventsGrid.appendChild(cell);
    }
    ganttTable.appendChild(eventsGrid);

    // --- NEW: Categorized Deliverables ---
    const deliverableGroups = [
        {
            id: 'effort',
            name: '取り組み',
            color: '#ef4444', // Red
            items: [
                { name: '作業報告書提出', type: 'report', key: 'work-reports' },
                { name: '課題設定レポート', type: 'analysis', key: 'analysis', target: 13 },
                { name: '貢献度調査', type: 'contribution', key: 'contribution', targets: [13, 26, 27] }
            ]
        },
        {
            id: 'presentation',
            name: '発表成果',
            color: '#f59e0b', // Orange
            items: [
                { name: '事業企画ポスター', type: 'toggle', key: 'poster', target: 12 },
                { name: '事業企画リーフレット', type: 'toggle', key: 'leaflet', target: 12 },
                { name: '相互評価シート', type: 'individual', key: 'mutual', targets: [13, 26, 27] },
                { name: '振り返りシート', type: 'individual', key: 'reflection', targets: [13, 26, 27] },
                { name: '製品・サービスパンフレット', type: 'toggle', key: 'pamphlet_25', target: 25 },
                { name: '最終プレゼンスライド', type: 'toggle', key: 'slides_25', target: 25 }
            ]
        }
    ];

    deliverableGroups.forEach(group => {
        // Render Category Header
        const headerLabel = document.createElement('div');
        headerLabel.className = 'gantt-label category-header-label';
        headerLabel.style.color = group.color;
        headerLabel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; height: 100%;">
                <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${group.name}</strong>
                <button class="btn btn-sm" style="padding: 2px 6px; font-size: 10px; height: 22px; background-color: ${group.color}; border-color: ${group.color}; color: white; display: flex; align-items: center; flex-shrink:0;" onclick="openTaskModal(-1, '${group.id}')">
                    <i data-lucide="plus" style="width:12px; height:12px; margin-right:4px;"></i>タスク
                </button>
            </div>
        `;
        ganttTable.appendChild(headerLabel);

        const headerGrid = document.createElement('div');
        headerGrid.className = 'gantt-grid category-header-grid';
        for (let i = 1; i <= 28; i++) {
            const cell = document.createElement('div');
            cell.className = 'gantt-cell';
            if (i === 13) cell.classList.add('semester-border');
            if (i === 12) cell.classList.add('exam-border-final');
            if (i === 7 || i === 20) cell.classList.add('exam-border-mid');
            if (i === 27) cell.classList.add('exam-border-final');
            if (i === currentIteration) cell.classList.add('is-today');
            headerGrid.appendChild(cell);
        }
        ganttTable.appendChild(headerGrid);

        // Render Items in this Group (Deliverables)
        group.items.forEach(it => {
            const labelCell = document.createElement('div');
            labelCell.className = `gantt-label deliverable-label label-${group.id}`;
            labelCell.style.color = group.color;
            labelCell.innerHTML = `
                <i data-lucide="file-check-2" style="width:14px; height:14px; margin-right:8px; flex-shrink:0;"></i>
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${it.name}</span>
            `;
            ganttTable.appendChild(labelCell);

            const gridCell = document.createElement('div');
            gridCell.className = 'gantt-grid';

            for (let i = 1; i <= 28; i++) {
                const cell = document.createElement('div');
                cell.className = 'gantt-cell';
                if (i === 13) cell.classList.add('semester-border');
                if (i === 12) cell.classList.add('exam-border-final');
                if (i === 7 || i === 20) cell.classList.add('exam-border-mid');
                if (i === 27) cell.classList.add('exam-border-final');
                if (i === currentIteration) cell.classList.add('is-today');

                // Logic for different item types
                if (it.type === 'report') {
                    const iter = i; // iter = actual session number (matches DEFAULT_SCHEDULE id)
                    if (iter >= 3) { // Reports start from session 3 (sessions 1-2 have no reports)
                        const hasReport = state.reports[iter] && state.reports[iter].content;
                        const marker = document.createElement('div');
                        marker.className = `report-marker ${hasReport ? 'submitted' : 'pending'} category-effort`;
                        marker.title = `第${iter}回 作業報告書: ${hasReport ? '提出済' : '未提出'}\nクリックで編集へ`;
                        marker.onclick = () => openWorkReport(iter);
                        cell.appendChild(marker);
                    }
                } else {
                    const isTarget = it.target === i || (it.targets && it.targets.includes(i));
                    if (isTarget) {
                        const itKey = it.targets ? `${it.key}_${i}` : it.key;
                        let isSubmitted = false;
                        if (it.type === 'toggle') isSubmitted = state.artifacts[itKey];
                        else isSubmitted = !!(state.reports[itKey] && state.reports[itKey].content);

                        const marker = document.createElement('div');
                        const catClass = group.id === 'effort' ? 'category-effort' : 'category-presentation';
                        marker.className = `report-marker ${isSubmitted ? 'submitted' : 'pending'} ${catClass}`;
                        marker.title = `${it.name} (${i}回目): ${isSubmitted ? '提出済' : '未提出'}\nクリックで編集・登録`;
                        marker.onclick = () => {
                            if (it.type === 'toggle') {
                                if (it.key === 'poster') {
                                    // Special interactive modal for poster
                                    openArtifactModal(itKey, it.name);
                                } else {
                                    // Simple toggle for others (leaflet, etc.)
                                    state.artifacts[itKey] = !state.artifacts[itKey];
                                    saveState();
                                    renderGantt();
                                }
                            } else {
                                switchView('reports');
                                if (it.type === 'analysis') switchTab('analysis-report');
                                else {
                                    switchTab('contribution');
                                    currentContributionKey = itKey;
                                    document.getElementById('contribution-label').textContent = `${it.name} (${i}回目) の内容`;
                                    loadContributionSurvey();
                                }
                            }
                        };
                        cell.appendChild(marker);
                    }
                }
                gridCell.appendChild(cell);
            }
            ganttTable.appendChild(gridCell);
        });

        // Render User-added Tasks for this Category
        const groupTasks = state.tasks.filter(t => {
            if (group.id === 'effort') return !t.category || t.category === 'effort';
            return t.category === group.id;
        });

        groupTasks.forEach(task => {
            const taskIndex = state.tasks.indexOf(task);
            const labelCell = document.createElement('div');
            labelCell.className = `gantt-label user-task-label label-${group.id}`;
            labelCell.style.color = group.color;
            labelCell.innerHTML = `
                <span class="task-name-text" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${task.name}">${task.name}</span>
                <button class="btn-delete-task" title="削除" onclick="event.stopPropagation(); deleteTask(${taskIndex});">
                    <i data-lucide="x" style="width:12px; height:12px;"></i>
                </button>
            `;
            ganttTable.appendChild(labelCell);

            const gridCell = document.createElement('div');
            gridCell.className = 'gantt-grid';

            for (let i = 1; i <= 28; i++) {
                const cell = document.createElement('div');
                cell.className = 'gantt-cell';
                if (i === 13) cell.classList.add('semester-border');
                if (i === 12) cell.classList.add('exam-border-final');
                if (i === 7 || i === 20) cell.classList.add('exam-border-mid');
                if (i === 27) cell.classList.add('exam-border-final');
                if (i === currentIteration) cell.classList.add('is-today');
                gridCell.appendChild(cell);
            }

            const bar = document.createElement('div');
            bar.className = 'gantt-task-bar';
            bar.style.backgroundColor = group.color; // Match category color
            bar.style.boxShadow = `0 0 10px ${group.color}44`;

            const start = task.start || 1;
            const end = task.end || start;
            const width = (end - start + 1) * 40;
            const left = (start - 1) * 40;

            bar.style.left = `${left}px`;
            bar.style.width = `${width}px`;

            if (task.completed) {
                bar.classList.add('is-completed');
            }

            const getLastName = (fullName) => fullName ? fullName.split(' ')[0] : '';
            const displayAssignees = Array.isArray(task.assignees)
                ? task.assignees.map(getLastName).join(', ')
                : getLastName(task.assignee);

            bar.innerHTML = task.completed
                ? `<i data-lucide="check-circle-2" style="width:14px; height:14px; margin-right:4px;"></i> ${displayAssignees}`
                : displayAssignees;

            bar.onclick = () => openTaskModal(taskIndex);

            gridCell.appendChild(bar);
            ganttTable.appendChild(gridCell);
        });
    });


    container.appendChild(ganttTable);
    lucide.createIcons();
}

// --- Task Modal ---
let editingTaskIndex = -1;

function openTaskModal(index = -1, defaultCategory = 'effort') {
    editingTaskIndex = index;
    const modal = document.getElementById('modal-task');
    const title = document.getElementById('task-modal-title');
    const nameInput = document.getElementById('task-name');
    const categorySelect = document.getElementById('task-category');
    const startInput = document.getElementById('task-start');
    const endInput = document.getElementById('task-end');
    const assigneesContainer = document.getElementById('task-assignees-container');
    const completedInput = document.getElementById('task-completed');

    let task = index !== -1 ? state.tasks[index] : null;
    const currentAssignees = task ? (Array.isArray(task.assignees) ? task.assignees : (task.assignee ? [task.assignee] : [])) : [];

    // Populate assignees checkboxes
    assigneesContainer.innerHTML = '';
    state.members.forEach((m, idx) => {
        const fullName = `${m.lastName || ''} ${m.firstName || ''}`.trim();
        if (fullName) {
            const roleInfo = MEMBER_ROLES.find(r => r.title === m.role);
            const roleLabel = roleInfo ? roleInfo.title : (m.role || '役割未定');

            const item = document.createElement('div');
            item.className = 'checkbox-item';

            const isChecked = currentAssignees.includes(fullName);

            item.innerHTML = `
                <input type="checkbox" id="assignee-${idx}" value="${fullName}" data-role="${m.role || ''}" ${isChecked ? 'checked' : ''}>
                <label for="assignee-${idx}">${m.lastName || '未設定'} <span style="font-size:11px; color:var(--text-dim);">(${roleLabel})</span></label>
            `;
            assigneesContainer.appendChild(item);
        }
    });

    // Populate process flow author checkboxes
    buildTaskFlowAuthorChecks(task);
    const flowSection = document.getElementById('task-process-flow-section');
    const modalContent = modal.querySelector('.modal-content');

    if (index === -1) {
        title.textContent = 'タスク追加';
        nameInput.value = '';
        categorySelect.value = defaultCategory;
        startInput.value = 1;
        endInput.value = 1;
        completedInput.checked = false;
        flowSection.style.display = 'block';
        modalContent.classList.add('large');

        // Initialize embedded mind map for new task
        if (typeof MindMapModule !== 'undefined') {
            setTimeout(() => {
                const container = document.getElementById('task-flow-editor');
                if (container) {
                    console.log('openTaskModal: init + loadData starting');
                    MindMapModule.init(container);
                    // Use task name if already entered, otherwise a placeholder
                    const taskName = nameInput.value.trim() || 'タスク名を入力してください';
                    MindMapModule.loadData(null, taskName);
                    // Auto-add first child node (as if user pressed Add Child)
                    setTimeout(() => {
                        console.log('openTaskModal: addChildToRoot');
                        MindMapModule.addChildToRoot();
                    }, 400);
                } else {
                    console.warn('Task modal editor container not found yet.');
                }
            }, 250);
        }
    } else {
        title.textContent = 'タスク編集';
        nameInput.value = task.name;
        categorySelect.value = task.category || 'effort';
        startInput.value = task.start;
        endInput.value = task.end;
        completedInput.checked = !!task.completed;
        flowSection.style.display = 'block';
        modalContent.classList.add('large');

        // Initialize embedded mind map
        if (typeof MindMapModule !== 'undefined') {
            setTimeout(() => {
                const container = document.getElementById('task-flow-editor');
                if (container) {
                    MindMapModule.init(container);
                    MindMapModule.loadData(task.processFlow, task.name);
                }
            }, 250);
        }
    }

    // Link task name input to mind map root node in real-time
    nameInput.oninput = (e) => {
        if (typeof MindMapModule !== 'undefined') {
            const val = e.target.value.trim();
            MindMapModule.setRootText(val || 'タスク名を入力してください');
        }
    };

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();
}

function bulkSelectAssignees(type) {
    const checkboxes = document.querySelectorAll('#task-assignees-container input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const role = cb.getAttribute('data-role');
        if (type === 'all') {
            cb.checked = true;
        } else if (type === 'none') {
            cb.checked = false;
        } else {
            if (role === type) {
                cb.checked = true;
            }
        }
    });
}

function closeModal() {
    document.getElementById('modal-task').classList.remove('active');
    // Reset mind map context to global to prevent stale element references
    if (typeof MindMapModule !== 'undefined') {
        MindMapModule.resetToGlobal();
    }
}

function saveTask() {
    const name = document.getElementById('task-name').value;
    const category = document.getElementById('task-category').value;
    const start = parseInt(document.getElementById('task-start').value);
    const end = parseInt(document.getElementById('task-end').value);
    const completed = document.getElementById('task-completed').checked;

    // Collect all checked assignees
    const checkboxes = document.querySelectorAll('#task-assignees-container input[type="checkbox"]:checked');
    const assignees = Array.from(checkboxes).map(cb => cb.value);

    if (!name) return alert('タスク名を入力してください');

    let processFlow = null;
    if (typeof MindMapModule !== 'undefined' && document.getElementById('task-process-flow-section').style.display !== 'none') {
        processFlow = MindMapModule.exportData();
        // Include authors in processFlow object
        const authorChecks = document.querySelectorAll('#task-flow-authors input:checked');
        processFlow.authors = Array.from(authorChecks).map(el => parseInt(el.dataset.idx));
    }

    const taskData = { name, category, start, end, assignees, completed, processFlow };

    if (editingTaskIndex === -1) {
        state.tasks.push(taskData);
    } else {
        state.tasks[editingTaskIndex] = { ...state.tasks[editingTaskIndex], ...taskData };
    }

    saveState();
    closeModal();
    renderGantt();
}

/** 削除タスク */
function deleteTask(index) {
    if (confirm('このタスクを削除しますか？')) {
        state.tasks.splice(index, 1);
        saveState();
        renderGantt();
    }
}

/* ================================================================
   ARTIFACT DETAIL MANAGEMENT - Slide Attribution
   ================================================================ */

/** Open the detailed artifact setup modal (e.g. for Poster) */
function openArtifactModal(key, name) {
    currentArtifactKey = key;
    currentSlideIndex = -1;
    document.getElementById('artifact-modal-title').textContent = `${name} 詳細設定`;

    // Initialize data if not exists
    if (!state.artifactSettings) state.artifactSettings = {};
    if (!state.artifactSettings[key]) {
        state.artifactSettings[key] = { slides: [] };
    }

    renderArtifactSlides();
    renderArtifactMemberList();

    // Reset viewer
    document.getElementById('hotspot-container').style.display = 'none';
    document.getElementById('viewer-placeholder').style.display = 'block';

    document.getElementById('modal-artifact-detail').classList.add('active');
    if (window.lucide) lucide.createIcons();
}

/** Close the artifact modal */
function closeArtifactModal() {
    document.getElementById('modal-artifact-detail').classList.remove('active');
}

/** Populate member radio list in artifact modal */
function renderArtifactMemberList() {
    const container = document.getElementById('artifact-member-list');
    if (!container) return;
    container.innerHTML = '';

    state.members.forEach((m, i) => {
        const fullName = `${m.lastName || ''} ${m.firstName || ''}`.trim();
        if (!fullName) return;

        const label = document.createElement('label');
        label.className = 'wr-author-item';
        label.style.fontSize = '0.8rem';
        label.innerHTML = `
            <input type="radio" name="artifact-member" value="${i}" ${i === 0 ? 'checked' : ''}>
            <span>${m.lastName || 'メンバー'}</span>
        `;
        container.appendChild(label);
    });
}

/** Handle multiple image or PDF uploads for artifact slides */
async function handleArtifactSlideUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const key = currentArtifactKey;

    for (const file of Array.from(files)) {
        if (file.type === 'application/pdf') {
            await processPdfFile(file, key);
        } else {
            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    state.artifactSettings[key].slides.push({
                        src: ev.target.result,
                        hotspots: []
                    });
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
    }

    renderArtifactSlides();
    e.target.value = ''; // Reset input
}

/** Extract each page of a PDF as a high-res base64 image */
async function processPdfFile(file, artifactKey) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            state.artifactSettings[artifactKey].slides.push({
                src: canvas.toDataURL('image/jpeg', 0.8),
                hotspots: []
            });
        }
    } catch (err) {
        console.error('PDF Processing Error:', err);
        alert('PDFの読み込み中にエラーが発生しました。');
    }
}

/** Render slide thumbnail list in sidebar */
function renderArtifactSlides() {
    const list = document.getElementById('artifact-slide-list');
    if (!list) return;
    list.innerHTML = '';
    const slides = state.artifactSettings[currentArtifactKey].slides;

    slides.forEach((slide, idx) => {
        const item = document.createElement('div');
        item.className = 'slide-item';
        item.innerHTML = `
            <div class="slide-thumb ${idx === currentSlideIndex ? 'active' : ''}" onclick="selectArtifactSlide(${idx})">
                <img src="${slide.src}" alt="">
                <span class="slide-num-badge">${idx + 1}</span>
            </div>
            <button class="btn-remove-slide" onclick="removeArtifactSlide(${idx})"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
        `;
        list.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
}

/** Select a slide to view/edit hotspots */
function selectArtifactSlide(idx) {
    currentSlideIndex = idx;
    renderArtifactSlides();

    const slide = state.artifactSettings[currentArtifactKey].slides[idx];
    const img = document.getElementById('artifact-current-image');
    const container = document.getElementById('hotspot-container');
    const placeholder = document.getElementById('viewer-placeholder');

    img.src = slide.src;
    container.style.display = 'block';
    placeholder.style.display = 'none';

    renderHotspots();
}

/** Remove a slide from the artifact */
function removeArtifactSlide(idx) {
    if (!confirm('このスライドを削除しますか？設定した担当範囲も消去されます。')) return;
    state.artifactSettings[currentArtifactKey].slides.splice(idx, 1);
    if (currentSlideIndex === idx) {
        currentSlideIndex = -1;
        document.getElementById('hotspot-container').style.display = 'none';
        document.getElementById('viewer-placeholder').style.display = 'block';
    } else if (currentSlideIndex > idx) {
        currentSlideIndex--;
    }
    renderArtifactSlides();
}

/** Set up mousedown/move/up listeners for rectangle drawing */
function initHotspotLogic() {
    const container = document.getElementById('hotspot-container');
    const drawingRect = document.getElementById('drawing-rect');

    container.addEventListener('mousedown', (e) => {
        if (currentSlideIndex === -1) return;
        const rect = container.getBoundingClientRect();
        isDrawingHotspot = true;
        hotspotStartPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        drawingRect.style.left = hotspotStartPos.x + 'px';
        drawingRect.style.top = hotspotStartPos.y + 'px';
        drawingRect.style.width = '0px';
        drawingRect.style.height = '0px';
        drawingRect.style.display = 'block';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDrawingHotspot) return;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const left = Math.min(hotspotStartPos.x, currentX);
        const top = Math.min(hotspotStartPos.y, currentY);
        const width = Math.abs(currentX - hotspotStartPos.x);
        const height = Math.abs(currentY - hotspotStartPos.y);

        drawingRect.style.left = left + 'px';
        drawingRect.style.top = top + 'px';
        drawingRect.style.width = width + 'px';
        drawingRect.style.height = height + 'px';
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDrawingHotspot) return;
        isDrawingHotspot = false;
        drawingRect.style.display = 'none';

        const rect = container.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        const x1 = Math.min(hotspotStartPos.x, endX);
        const y1 = Math.min(hotspotStartPos.y, endY);
        const w = Math.abs(endX - hotspotStartPos.x);
        const h = Math.abs(endY - hotspotStartPos.y);

        if (w < 10 || h < 10) return; // Ignore tiny rects

        // Convert to Percentages for responsiveness
        const px = (x1 / rect.width) * 100;
        const py = (y1 / rect.height) * 100;
        const pw = (w / rect.width) * 100;
        const ph = (h / rect.height) * 100;

        // Get currently selected author from radio
        const selectedRadio = document.querySelector('input[name="artifact-member"]:checked');
        const authorIdx = selectedRadio ? parseInt(selectedRadio.value) : 0;

        state.artifactSettings[currentArtifactKey].slides[currentSlideIndex].hotspots.push({
            rect: { x: px, y: py, w: pw, h: ph },
            authorIdx: authorIdx
        });

        renderHotspots();
    });
}

/** Draw all hotspots on the current slide */
function renderHotspots() {
    const overlay = document.getElementById('hotspot-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    if (currentSlideIndex === -1) return;

    const slide = state.artifactSettings[currentArtifactKey].slides[currentSlideIndex];
    slide.hotspots.forEach((hs, idx) => {
        const div = document.createElement('div');
        div.className = 'hotspot-rect';
        div.style.left = hs.rect.x + '%';
        div.style.top = hs.rect.y + '%';
        div.style.width = hs.rect.w + '%';
        div.style.height = hs.rect.h + '%';

        const author = state.members[hs.authorIdx];
        const name = author ? (author.lastName || '担当') : '担当';

        div.innerHTML = `
            <span class="hotspot-author-tag">${name}</span>
            <button class="hotspot-delete-btn" onclick="deleteHotspot(${idx})"><i data-lucide="x" style="width:10px;height:10px;"></i></button>
        `;
        overlay.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

/** Delete a specific hotspot from current slide */
function deleteHotspot(idx) {
    if (currentSlideIndex === -1) return;
    state.artifactSettings[currentArtifactKey].slides[currentSlideIndex].hotspots.splice(idx, 1);
    renderHotspots();
}

/** Save detailed artifact data and mark as submitted on Gantt */
function saveArtifactData() {
    // If there's at least one slide with data, mark as submitted
    const data = state.artifactSettings[currentArtifactKey];
    const hasData = data && data.slides && data.slides.length > 0;

    state.artifacts[currentArtifactKey] = hasData;
    if (hasData) {
        if (!state.artifactSettings[currentArtifactKey]) state.artifactSettings[currentArtifactKey] = {};
        state.artifactSettings[currentArtifactKey].updatedAt = new Date().toISOString();
    }
    saveState();
    closeArtifactModal();
    renderGantt();
    updateDisplayInfo();
    renderRecentActivity();
    alert('設定を保存しました。ガントチャートのマークが登録済み（チェック付）になります。');
}

function buildTaskFlowAuthorChecks(task) {
    const container = document.getElementById('task-flow-authors');
    if (!container) return;
    container.innerHTML = '';

    const selectedAuthors = (task && task.processFlow && task.processFlow.authors) ? task.processFlow.authors : [];

    state.members.forEach((m, i) => {
        const fullName = `${m.lastName || ''} ${m.firstName || ''}`.trim();
        if (!fullName) return; // Skip empty members

        const isChecked = selectedAuthors.includes(i);

        const label = document.createElement('label');
        label.className = 'checkbox-item';
        // Adjust for small header area
        label.style.padding = '4px 8px';
        label.style.fontSize = '0.75rem';
        label.style.background = 'rgba(255,255,255,0.03)';

        label.innerHTML = `
            <input type="checkbox" data-idx="${i}" ${isChecked ? 'checked' : ''}>
            <span>${m.lastName || 'メンバー'}</span>
        `;
        container.appendChild(label);
    });
}


// --- Reports Logic ---
let currentContributionKey = '';

/* ================================================================
   WORK REPORT - Full Implementation
   ================================================================ */

/** Called from Gantt marker onclick — iter is the DEFAULT_SCHEDULE session id (e.g. 5 → 第5回) */
function openWorkReport(iter) {
    switchView('reports');
    switchTab('work-report');
    const sel = document.getElementById('work-report-iteration');
    if (sel) {
        const val = String(iter);
        const opt = Array.from(sel.options).find(o => o.value === val);
        if (opt) sel.value = val;
        else if (sel.options.length > 0) sel.value = sel.options[0].value;
    }
    loadWorkReport();
}

function initWorkReportForm() {
    const iterSelect = document.getElementById('work-report-iteration');
    if (!iterSelect) return;

    // Build option list from DEFAULT_SCHEDULE
    iterSelect.innerHTML = '';
    DEFAULT_SCHEDULE.forEach(s => {
        if (s.id >= 3) {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `第${s.id}回`;
            iterSelect.appendChild(opt);
        }
    });

    iterSelect.addEventListener('change', loadWorkReport);

    // Draft save buttons (top & bottom)
    document.getElementById('btn-draft-report')?.addEventListener('click', saveDraftWorkReport);
    document.getElementById('btn-draft-report-bottom')?.addEventListener('click', saveDraftWorkReport);

    // Submit buttons (top & bottom)
    document.getElementById('btn-submit-report')?.addEventListener('click', submitWorkReport);
    document.getElementById('btn-submit-report-bottom')?.addEventListener('click', submitWorkReport);

    // Preview button
    document.getElementById('btn-preview-report')?.addEventListener('click', previewWorkReport);

    // Unlock button (hidden in banner)
    document.getElementById('wr-unlock-btn')?.addEventListener('click', unlockWorkReport);

    // Image upload zones
    const achUpload = document.getElementById('wr-achievement-upload-zone');
    const achInput = document.getElementById('wr-achievement-image-input');
    if (achUpload && achInput) {
        achUpload.addEventListener('click', () => achInput.click());
        achUpload.addEventListener('dragover', e => { e.preventDefault(); achUpload.style.borderColor = 'var(--primary)'; });
        achUpload.addEventListener('dragleave', () => { achUpload.style.borderColor = ''; });
        achUpload.addEventListener('drop', e => { e.preventDefault(); achUpload.style.borderColor = ''; handleWrImageFiles(e.dataTransfer.files, 'achievement'); });
        achInput.addEventListener('change', e => handleWrImageFiles(e.target.files, 'achievement'));
    }

    // Char counters
    setupWrCounter('wr-achievement-text', 'wr-achievement-count', 'wr-achievement-status', 200, 300);
    setupWrCounter('wr-challenge-text', 'wr-challenge-count', 'wr-challenge-status', 200, 300);

    // Build member comm table
    buildCommTable();

    // Load first available session
    loadWorkReport();
}

function setupWrCounter(textareaId, countId, statusId, min, max) {
    const ta = document.getElementById(textareaId);
    const countEl = document.getElementById(countId);
    const statusEl = document.getElementById(statusId);
    if (!ta || !countEl || !statusEl) return;

    const update = () => {
        const len = ta.value.length;
        countEl.textContent = len;
        statusEl.className = 'wr-count-status';
        if (len === 0) {
            statusEl.textContent = '';
        } else if (len < min * 0.8) {
            statusEl.classList.add('low'); statusEl.textContent = '不足';
        } else if (len >= min && len <= max) {
            statusEl.classList.add('ok'); statusEl.textContent = '✓ 適正';
        } else if (len < min) {
            statusEl.classList.add('low'); statusEl.textContent = 'もう少し';
        } else {
            statusEl.classList.add('over'); statusEl.textContent = '超過';
        }
    };
    ta.addEventListener('input', () => {
        update();
        updateContentTime();
        saveDraftWorkReport();
    });
    ta.addEventListener('change', update);
}

function buildCommTable() {
    const tbody = document.getElementById('wr-comm-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const iter = getWrIter();
    const data = state.reports[iter] || {};
    const commTimes = data.communicationTimes || [];

    MEMBER_ROLES.forEach((role, i) => {
        const member = state.members.find(m => m.role === role.title) || {};
        const name = member.lastName ? `${member.lastName}` : '―';
        const savedComm = data.communications?.[i] || '';
        const savedTime = commTimes[i] ? formattedTimestamp(commTimes[i]) : '―';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="wr-role-label">${role.title}</span></td>
            <td><span class="wr-member-name">${name}</span></td>
            <td><input class="wr-comm-input" type="text" maxlength="100"
                data-role-idx="${i}"
                placeholder="${role.title}からの伝達事項（100字以内）"
                value="${savedComm}"></td>
            <td class="wr-comm-updated-col" id="wr-comm-time-${i}">${savedTime}</td>
        `;

        const input = tr.querySelector('.wr-comm-input');
        input.addEventListener('input', () => {
            const now = new Date().toISOString();
            if (!state.reports[iter]) state.reports[iter] = {};
            if (!state.reports[iter].communicationTimes) state.reports[iter].communicationTimes = [];
            state.reports[iter].communicationTimes[i] = now;
            document.getElementById(`wr-comm-time-${i}`).textContent = formattedTimestamp(now);
            // Also save on input to be "proactive"
            saveDraftWorkReport();
        });

        tbody.appendChild(tr);
    });
}

function buildAuthorChecks() {
    const container = document.getElementById('wr-author-checks');
    if (!container) return;
    container.innerHTML = '';

    const iter = getWrIter();
    const data = state.reports[iter] || {};
    const selectedAuthors = data.authors || [];

    state.members.forEach((m, i) => {
        const name = m.lastName || `メンバー${i + 1}`;
        const isChecked = selectedAuthors.includes(i);

        const label = document.createElement('label');
        label.className = 'wr-author-item';
        label.innerHTML = `
            <input type="checkbox" data-idx="${i}" ${isChecked ? 'checked' : ''}>
            <span>${name}</span>
        `;

        label.querySelector('input').addEventListener('change', () => {
            updateContentTime();
            saveDraftWorkReport();
        });

        container.appendChild(label);
    });
}

function formattedTimestamp(iso) {
    if (!iso) return '―';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function updateContentTime() {
    const iter = getWrIter();
    const now = new Date().toISOString();
    if (!state.reports[iter]) state.reports[iter] = {};
    state.reports[iter].contentUpdatedAt = now;
    const el = document.getElementById('wr-content-updated');
    if (el) el.textContent = formattedTimestamp(now);
}

function buildTaskCheckboxes() {
    const container = document.getElementById('wr-task-checkboxes');
    if (!container) return;
    container.innerHTML = '';

    if (!state.tasks || state.tasks.length === 0) {
        container.innerHTML = '<p class="wr-hint">タスクが登録されていません（ガントチャートで追加してください）</p>';
        return;
    }

    const currentData = getWrCurrent();
    const selectedIds = currentData?.selectedTasks || [];

    // Group tasks by category
    const groups = [
        { id: 'effort', label: '取り組みタスク', color: '#6366f1', tasks: state.tasks.filter(t => !t.category || t.category === 'effort') },
        { id: 'presentation', label: '発表・成果タスク', color: '#f59e0b', tasks: state.tasks.filter(t => t.category === 'presentation') }
    ];

    groups.forEach(group => {
        if (group.tasks.length === 0) return;

        // Group header
        const header = document.createElement('div');
        header.className = 'wr-task-group-header';
        header.style.cssText = `color:${group.color}; border-color:${group.color}33;`;
        header.innerHTML = `<span style="background:${group.color}22;border:1px solid ${group.color}44;padding:.15rem .6rem;border-radius:99px;font-size:.75rem;font-weight:700;">${group.label}</span>`;
        container.appendChild(header);

        // Task checkboxes in this group
        const groupGrid = document.createElement('div');
        groupGrid.className = 'wr-task-subgrid';

        group.tasks.forEach(task => {
            const taskIndex = state.tasks.indexOf(task);
            const isSelected = selectedIds.includes(String(taskIndex)) || selectedIds.includes(task.name);

            const label = document.createElement('label');
            label.className = 'wr-task-item' + (isSelected ? ' selected' : '');
            label.innerHTML = `
                <input type="checkbox" value="${taskIndex}" ${isSelected ? 'checked' : ''}>
                <span class="wr-task-item-text">${task.name}</span>
            `;
            const cb = label.querySelector('input');
            cb.addEventListener('change', () => {
                label.classList.toggle('selected', cb.checked);
                renderProcessFlows();
                const iter = getWrIter();
                if (!state.reports[iter]) state.reports[iter] = {};
                state.reports[iter].selectedTasks = getSelectedTaskIds();
                saveState();
            });
            groupGrid.appendChild(label);
        });
        container.appendChild(groupGrid);
    });
}

function getSelectedTaskIds() {
    return Array.from(document.querySelectorAll('#wr-task-checkboxes input[type=checkbox]:checked'))
        .map(cb => cb.value);
}

function renderProcessFlows() {
    const gallery = document.getElementById('wr-process-flows');
    if (!gallery) return;
    const selectedIdxs = getSelectedTaskIds();

    if (selectedIdxs.length === 0) {
        gallery.innerHTML = '<div class="wr-no-flow">タスクを選択するとプロセスフローが表示されます</div>';
        return;
    }

    gallery.innerHTML = '';
    selectedIdxs.forEach(taskIdx => {
        const task = state.tasks[parseInt(taskIdx)];
        if (!task) return;

        const item = document.createElement('div');
        item.className = 'wr-process-flow-item';

        const pf = task.processFlow;
        if (pf && pf.root) {
            // Render mind map data as SVG tree
            const svg = buildMindMapSvg(pf);
            item.innerHTML = `<div class="wr-process-flow-label">${task.name}</div>`;
            item.appendChild(svg);
        } else {
            item.innerHTML = `
                <div class="wr-process-flow-label">${task.name}</div>
                <div class="wr-no-flow" style="padding:1rem;">プロセスフロー未登録<br><small>タスクを編集してマインドマップを保存してください</small></div>
            `;
        }
        gallery.appendChild(item);
    });
}

/**
 * Render a simplified SVG tree from mind map JSON data.
 * Shows root + children only (depth 1-2) to fit in the card.
 */
function buildMindMapSvg(pf) {
    const root = pf.root;
    const W = 520, ROW_H = 36, PADDING = 16;
    const rootX = 20, rootY = 28;
    const childX = 150;

    // Collect all nodes breadth-first (max depth 2)
    function collectNodes(node, depth, parentY) {
        const entries = [];
        if (!node) return entries;
        entries.push({ text: node.text || '', depth, parentY, id: node.id });
        if (node.children && depth < 2) {
            node.children.forEach(child => {
                entries.push(...collectNodes(child, depth + 1, parentY));
            });
        }
        return entries;
    }

    const children = root.children || [];
    const totalRows = Math.max(children.length, 1);
    const H = Math.max(totalRows * ROW_H + PADDING * 2, 80);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.cssText = 'background:#0f172a;border-radius:0 0 8px 8px;display:block;';

    // Helper: truncate text
    const trunc = (t, max) => (t && t.length > max) ? t.slice(0, max) + '…' : (t || '');

    // Root node
    const rootCY = H / 2;
    const rootRect = document.createElementNS(ns, 'rect');
    rootRect.setAttribute('x', rootX); rootRect.setAttribute('y', rootCY - 14);
    rootRect.setAttribute('width', 110); rootRect.setAttribute('height', 28);
    rootRect.setAttribute('rx', 8); rootRect.setAttribute('fill', '#6366f1');
    svg.appendChild(rootRect);

    const rootText = document.createElementNS(ns, 'text');
    rootText.setAttribute('x', rootX + 55); rootText.setAttribute('y', rootCY + 5);
    rootText.setAttribute('text-anchor', 'middle'); rootText.setAttribute('fill', '#fff');
    rootText.setAttribute('font-size', '11'); rootText.setAttribute('font-weight', '700');
    rootText.textContent = trunc(root.text, 10);
    svg.appendChild(rootText);

    // Children
    children.forEach((child, i) => {
        const cy = PADDING + i * ROW_H + ROW_H / 2;
        // Connector line
        const line = document.createElementNS(ns, 'path');
        line.setAttribute('d', `M ${rootX + 110} ${rootCY} C ${childX - 20} ${rootCY}, ${childX - 20} ${cy}, ${childX} ${cy}`);
        line.setAttribute('stroke', '#6366f155'); line.setAttribute('stroke-width', '1.5');
        line.setAttribute('fill', 'none');
        svg.appendChild(line);

        // Child node box
        const crect = document.createElementNS(ns, 'rect');
        crect.setAttribute('x', childX); crect.setAttribute('y', cy - 13);
        crect.setAttribute('width', 140); crect.setAttribute('height', 26);
        crect.setAttribute('rx', 6); crect.setAttribute('fill', '#1e293b');
        crect.setAttribute('stroke', '#334155'); crect.setAttribute('stroke-width', '1');
        svg.appendChild(crect);

        const ctext = document.createElementNS(ns, 'text');
        ctext.setAttribute('x', childX + 70); ctext.setAttribute('y', cy + 4);
        ctext.setAttribute('text-anchor', 'middle'); ctext.setAttribute('fill', '#e2e8f0');
        ctext.setAttribute('font-size', '10');
        ctext.textContent = trunc(child.text, 14);
        svg.appendChild(ctext);

        // Grandchildren (first 2)
        const grandX = childX + 155;
        (child.children || []).slice(0, 3).forEach((gc, gi) => {
            const gcy = cy + (gi - ((child.children.slice(0, 3).length - 1) / 2)) * 22;
            const gline = document.createElementNS(ns, 'line');
            gline.setAttribute('x1', childX + 140); gline.setAttribute('y1', cy);
            gline.setAttribute('x2', grandX); gline.setAttribute('y2', gcy);
            gline.setAttribute('stroke', '#33415588'); gline.setAttribute('stroke-width', '1');
            svg.appendChild(gline);

            const grect = document.createElementNS(ns, 'rect');
            grect.setAttribute('x', grandX); grect.setAttribute('y', gcy - 11);
            grect.setAttribute('width', 130); grect.setAttribute('height', 22);
            grect.setAttribute('rx', 5); grect.setAttribute('fill', '#0f172a');
            grect.setAttribute('stroke', '#1e293b'); grect.setAttribute('stroke-width', '1');
            svg.appendChild(grect);

            const gtext = document.createElementNS(ns, 'text');
            gtext.setAttribute('x', grandX + 65); gtext.setAttribute('y', gcy + 4);
            gtext.setAttribute('text-anchor', 'middle'); gtext.setAttribute('fill', '#94a3b8');
            gtext.setAttribute('font-size', '9');
            gtext.textContent = trunc(gc.text, 16);
            svg.appendChild(gtext);
        });
    });

    return svg;
}

/**
 * Print-friendly variant of buildMindMapSvg.
 * White background, dark text, suitable for PDF/print output.
 */
function buildMindMapSvgForPrint(pf) {
    const root = pf.root;
    const W = 700, ROW_H = 38, PADDING = 18;
    const rootX = 16, childX = 160, grandX = 340;

    const children = root.children || [];
    // Count total rows needed (children + their grandchildren offsets)
    let totalRows = Math.max(children.length, 1);
    children.forEach(c => { if ((c.children || []).length > 1) totalRows += (c.children.length - 1) * 0.6; });
    const H = Math.max(Math.ceil(totalRows) * ROW_H + PADDING * 2, 80);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('style', 'background:#fff;display:block;');

    const trunc = (t, max) => (t && t.length > max) ? t.slice(0, max) + '…' : (t || '');

    const mk = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    };

    const rootCY = H / 2;

    // Root node (indigo fill, white text)
    svg.appendChild(mk('rect', { x: rootX, y: rootCY - 15, width: 124, height: 30, rx: 8, fill: '#4f46e5' }));
    const rootTxt = mk('text', { x: rootX + 62, y: rootCY + 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': '11', 'font-weight': '700', 'font-family': 'sans-serif' });
    rootTxt.textContent = trunc(root.text, 12);
    svg.appendChild(rootTxt);

    // Children
    let rowOffset = 0;
    children.forEach((child, i) => {
        const grandChildren = (child.children || []).slice(0, 4);
        const gcCount = Math.max(grandChildren.length, 1);
        const childCY = PADDING + (rowOffset + (gcCount - 1) / 2) * ROW_H + ROW_H / 2;

        // Connector: root → child
        svg.appendChild(mk('path', {
            d: `M ${rootX + 124} ${rootCY} C ${childX - 25} ${rootCY}, ${childX - 25} ${childCY}, ${childX} ${childCY}`,
            stroke: '#6366f1', 'stroke-width': '1.5', fill: 'none', 'stroke-opacity': '0.5'
        }));

        // Child box (light indigo bg, dark border)
        svg.appendChild(mk('rect', { x: childX, y: childCY - 14, width: 160, height: 28, rx: 6, fill: '#ede9fe', stroke: '#7c3aed', 'stroke-width': '1' }));
        const ctxt = mk('text', { x: childX + 80, y: childCY + 5, 'text-anchor': 'middle', fill: '#3730a3', 'font-size': '10', 'font-weight': '600', 'font-family': 'sans-serif' });
        ctxt.textContent = trunc(child.text, 18);
        svg.appendChild(ctxt);

        // Grandchildren
        grandChildren.forEach((gc, gi) => {
            const gcy = PADDING + (rowOffset + gi) * ROW_H + ROW_H / 2;
            svg.appendChild(mk('line', { x1: childX + 160, y1: childCY, x2: grandX, y2: gcy, stroke: '#a78bfa', 'stroke-width': '1', 'stroke-opacity': '0.6' }));
            svg.appendChild(mk('rect', { x: grandX, y: gcy - 12, width: 160, height: 24, rx: 5, fill: '#f5f3ff', stroke: '#c4b5fd', 'stroke-width': '1' }));
            const gtxt = mk('text', { x: grandX + 80, y: gcy + 4, 'text-anchor': 'middle', fill: '#4c1d95', 'font-size': '9', 'font-family': 'sans-serif' });
            gtxt.textContent = trunc(gc.text, 20);
            svg.appendChild(gtxt);
        });

        rowOffset += gcCount;
    });

    return svg;
}

function getWrIter() {
    return document.getElementById('work-report-iteration')?.value || '3';
}

function getWrCurrent() {
    return state.reports[getWrIter()] || null;
}

function updateWrHeader() {
    const iter = parseInt(getWrIter());
    const session = DEFAULT_SCHEDULE.find(s => s.id === iter);

    // Header card fields
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '―'; };
    setEl('wr-group-symbol', state.groupSymbol);
    setEl('wr-group-name', state.groupName || state.themeName);
    setEl('wr-iter-label', session ? `第${session.id}回` : `第${iter}回`);
    setEl('wr-iter-date', session ? formatDate(session.date) : '―');

    // Session info bar
    const infoEl = document.getElementById('wr-session-info');
    if (infoEl && session) {
        infoEl.textContent = `📅 ${formatDate(session.date)} ― ${session.label}`;
    } else if (infoEl) {
        infoEl.textContent = `第${iter}回`;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '―';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function loadWorkReport() {
    const iter = getWrIter();
    const data = state.reports[iter] || {};

    updateWrHeader();
    buildTaskCheckboxes();
    renderProcessFlows();
    buildAuthorChecks();
    buildCommTable();

    const ach = document.getElementById('wr-achievement-text');
    const chal = document.getElementById('wr-challenge-text');
    if (ach) { ach.value = data.achievement || ''; ach.dispatchEvent(new Event('input')); }
    if (chal) { chal.value = data.challenge || ''; chal.dispatchEvent(new Event('input')); }

    // Restore Content Updated UI
    const timeEl = document.getElementById('wr-content-updated');
    if (timeEl) timeEl.textContent = formattedTimestamp(data.contentUpdatedAt);

    renderWrImages('wr-achievement-images', data.achievementImages || [], 'achievement');
    applyWrLockState(data.submitted || false, data.submittedAt || null);
}

/** Apply or remove the locked state on the form */
function applyWrLockState(isLocked, submittedAt) {
    const body = document.querySelector('.wr-form-body');
    const banner = document.getElementById('wr-submitted-banner');
    const atEl = document.getElementById('wr-submitted-at');

    if (!body) return;

    if (isLocked) {
        body.classList.add('locked');
        if (banner) banner.style.display = 'flex';
        if (atEl && submittedAt) {
            const d = new Date(submittedAt);
            atEl.textContent = `提出日時: ${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
    } else {
        body.classList.remove('locked');
        if (banner) banner.style.display = 'none';
    }
    if (window.lucide) lucide.createIcons();
}

/** Collect current form data into report object (shared by draft and submit) */
function collectWrFormData() {
    const ach = document.getElementById('wr-achievement-text')?.value || '';
    const chal = document.getElementById('wr-challenge-text')?.value || '';
    const comms = Array.from(document.querySelectorAll('.wr-comm-input')).map(el => el.value);
    const authors = Array.from(document.querySelectorAll('#wr-author-checks input:checked')).map(el => parseInt(el.dataset.idx));
    return { ach, chal, comms, authors };
}

/** 一時保存 — saves without locking */
function saveDraftWorkReport() {
    const iter = getWrIter();
    if (!state.reports[iter]) state.reports[iter] = {};
    if (state.reports[iter].submitted) {
        alert('この回の報告書は提出済みです。内容を変更することはできません。');
        return;
    }

    const { ach, chal, comms, authors } = collectWrFormData();
    Object.assign(state.reports[iter], {
        achievement: ach, challenge: chal, communications: comms,
        authors: authors,
        selectedTasks: getSelectedTaskIds(),
        content: `${ach}\n${chal}`.trim(),
        savedAt: new Date().toISOString()
    });
    saveState();

    // Visual flash on draft button
    ['btn-draft-report', 'btn-draft-report-bottom'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const orig = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check"></i> 保存しました';
        btn.style.background = 'rgba(16,185,129,0.6)';
        if (window.lucide) lucide.createIcons();
        setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; if (window.lucide) lucide.createIcons(); }, 1800);
    });

    renderGantt();
}

/** 提出解除 — Admin unlock with password */
function unlockWorkReport() {
    const pw = prompt('提出済みロックを解除するには管理パスワードを入力してください:');
    if (pw === '9784563046378') {
        const iter = getWrIter();
        if (state.reports[iter]) {
            state.reports[iter].submitted = false;
            // Also update legacy field just in case
            state.reports[iter].content = (state.reports[iter].achievement || '') + '\n' + (state.reports[iter].challenge || '');
            saveState();
            loadWorkReport();
            renderGantt();
            alert('第' + iter + '回の提出状態を解除しました。内容の編集が可能です。');
        }
    } else if (pw !== null) {
        alert('パスワードが正しくありません。');
    }
}

/** 提出 — confirms, locks, downloads PDF + JSON backup */
function submitWorkReport() {
    const iter = getWrIter();
    if (state.reports[iter]?.submitted) {
        alert('すでに提出済みです。');
        return;
    }

    const session = DEFAULT_SCHEDULE.find(s => s.id === parseInt(iter));
    const sessionLabel = session ? `第${session.id}回 (${formatDate(session.date)})` : `第${iter}回`;

    // Content check
    const { ach, chal, comms } = collectWrFormData();
    const achLen = ach.trim().length;
    const chalLen = chal.trim().length;
    const warnings = [];
    if (achLen < 160) warnings.push(`「できたこと」が不足しています（${achLen}字 / 基準200字）`);
    if (chalLen < 160) warnings.push(`「新たな課題」が不足しています（${chalLen}字 / 基準200字）`);
    if (comms.every(c => !c.trim())) warnings.push('伝達事項が未入力です');

    let confirmMsg = `【${sessionLabel}】の作業報告書を提出します。\n\n提出後は内容を変更できなくなります。\n`;
    if (warnings.length > 0) {
        confirmMsg += `\n⚠ 以下の注意点があります:\n${warnings.map(w => '  • ' + w).join('\n')}\n`;
    }
    confirmMsg += '\n提出してよろしいですか？';

    if (!confirm(confirmMsg)) return;

    // Save final data
    if (!state.reports[iter]) state.reports[iter] = {};
    Object.assign(state.reports[iter], {
        achievement: ach, challenge: chal, communications: comms,
        selectedTasks: getSelectedTaskIds(),
        content: `${ach}\n${chal}`.trim(),
        submitted: true,
        submittedAt: new Date().toISOString()
    });
    saveState();

    // Lock the form immediately
    applyWrLockState(true, state.reports[iter].submittedAt);
    renderGantt();

    // Download JSON backup
    const filename = `pbl2_report_${state.groupSymbol || 'G'}_${state.groupName || 'team'}_第${iter}回_${new Date().toISOString().slice(0, 10)}.json`;
    const backup = {
        exportedAt: new Date().toISOString(),
        groupSymbol: state.groupSymbol,
        groupName: state.groupName,
        themeName: state.themeName,
        members: state.members,
        session: session,
        report: state.reports[iter],
        tasks: (state.reports[iter].selectedTasks || []).map(idx => state.tasks[parseInt(idx)]).filter(Boolean)
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

    // Open print/PDF preview
    setTimeout(() => previewWorkReport(true), 500);
}

/** プレビュー — opens a print-ready window */
function previewWorkReport(forSubmit = false) {
    const iter = getWrIter();
    const data = state.reports[iter] || {};
    const session = DEFAULT_SCHEDULE.find(s => s.id === parseInt(iter));

    const selectedTasks = (data.selectedTasks || [])
        .map(idx => state.tasks[parseInt(idx)])
        .filter(Boolean);

    const authorsHtml = (data.authors || []).map(idx => {
        const m = state.members[idx];
        return m ? `<span style="display:inline-block;background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;padding:.1rem .4rem;margin-right:.4rem;font-size:.85rem;">${m.lastName || ''}</span>` : '';
    }).join('');

    const commsHtml = MEMBER_ROLES.map((role, i) => {
        const member = state.members.find(m => m.role === role.title) || {};
        const name = member.lastName || '―';
        const comm = (data.communications || [])[i] || '';
        const time = (data.communicationTimes || [])[i] ? formattedTimestamp((data.communicationTimes || [])[i]) : '';

        return `<tr>
          <td style="font-weight:600;white-space:nowrap;padding:.5rem .75rem;border:1px solid #ddd;">${role.title}</td>
          <td style="padding:.5rem .75rem;border:1px solid #ddd;">${name}</td>
          <td style="padding:.5rem .75rem;border:1px solid #ddd;">${comm || '<span style="color:#aaa">未記入</span>'}</td>
          <td style="padding:.5rem .75rem;border:1px solid #ddd;font-size:8pt;color:#666;text-align:center;">${time}</td>
        </tr>`;
    }).join('');

    const imagesHtml = (data.achievementImages || []).map(src =>
        `<img src="${src}" style="max-width:48%;border-radius:6px;border:1px solid #ddd;margin:.25rem;">`
    ).join('');

    const taskList = selectedTasks.map(t => `<span style="display:inline-block;background:#e8e8ff;border:1px solid #9999ff;border-radius:4px;padding:.15rem .5rem;margin:.2rem;font-size:.85rem;">${t.name}</span>`).join('');

    // Build process flow SVG strings for each selected task
    const serializer = new XMLSerializer();
    const processFlowsHtml = selectedTasks.map(task => {
        const pf = task.processFlow;
        let svgHtml = '';
        const pfAuthorsHtml = (pf && pf.authors || []).map(idx => {
            const m = state.members[idx];
            return m ? `<span style="display:inline-block;background:#f9fafb;border:1px solid #e5e7eb;border-radius:3px;padding:0 .3rem;margin-right:.3rem;font-size:8pt;color:#6b7280;">${m.lastName || ''}</span>` : '';
        }).join('');

        if (pf && pf.root) {
            const svgEl = buildMindMapSvgForPrint(pf);
            svgHtml = serializer.serializeToString(svgEl);
        } else {
            svgHtml = `<p style="color:#aaa;font-size:9pt;padding:.3rem 0;">プロセスフロー未登録</p>`;
        }
        return `
        <div style="margin-bottom:1rem;border:1px solid #e0e0ff;border-radius:6px;overflow:hidden;break-inside:avoid;">
          <div style="background:#e8e8ff;padding:.3rem .7rem;font-size:9pt;font-weight:700;color:#3730a3;border-bottom:1px solid #c7c7ef;display:flex;justify-content:space-between;align-items:center;">
            <span>${task.name}</span>
            <div style="font-weight:400;">${pfAuthorsHtml}</div>
          </div>
          <div style="padding:.5rem;background:#fff;">${svgHtml}</div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>作業報告書 第${iter}回 — ${state.groupName || ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif; margin: 0; padding: 2cm; color: #1a1a1a; font-size: 11pt; line-height: 1.6; }
  h1 { font-size: 18pt; text-align: center; border-bottom: 3px double #333; padding-bottom: .5rem; margin-bottom: 1.5rem; }
  .meta { display: flex; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.5rem; padding: .75rem 1rem; background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { font-size: 8pt; text-transform: uppercase; color: #666; font-weight: 700; letter-spacing: .05em; }
  .meta-value { font-size: 12pt; font-weight: 700; }
  h2 { font-size: 12pt; border-left: 4px solid #6366f1; padding-left: .6rem; margin: 1.5rem 0 .5rem; }
  .section { margin-bottom: 1.5rem; }
  .sub-label { display: inline-block; font-size: 9pt; font-weight: 700; padding: .1rem .5rem; border-radius: 3px; margin-bottom: .3rem; }
  .sub-label.ach { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
  .sub-label.chal { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .text-box { border: 1px solid #ccc; border-radius: 4px; padding: .6rem .8rem; min-height: 5rem; white-space: pre-wrap; font-size: 10.5pt; background: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th { background: #e8e8ff; padding: .5rem .75rem; border: 1px solid #ddd; font-size: 9pt; text-align: left; }
  .images { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
  .footer { margin-top: 2rem; padding-top: .5rem; border-top: 1px solid #ccc; font-size: 8pt; color: #888; text-align: right; }
  .submitted-stamp { display: inline-block; border: 3px solid #059669; color: #059669; border-radius: 6px; padding: .2rem .8rem; font-size: 11pt; font-weight: 700; transform: rotate(-5deg); margin-left: 1rem; vertical-align: middle; }
  @media print {
    body { padding: 1.5cm; }
    @page { margin: 1.5cm; size: A4; }
    button { display: none !important; }
  }
</style>
</head>
<body>
  <div style="text-align:right; margin-bottom: .5rem;">
    <button onclick="window.print()" style="padding:.4rem 1.2rem;background:#6366f1;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:10pt;">
      🖨 PDFとして保存 / 印刷
    </button>
  </div>
  <h1>応用専門PBL2　作業報告書
    ${data.submitted ? '<span class="submitted-stamp">提出済</span>' : ''}
  </h1>
  <div class="meta">
    <div class="meta-item"><span class="meta-label">チーム記号</span><span class="meta-value">${state.groupSymbol || '―'}</span></div>
    <div class="meta-item"><span class="meta-label">チーム名</span><span class="meta-value">${state.groupName || state.themeName || '―'}</span></div>
    <div class="meta-item"><span class="meta-label">実施回</span><span class="meta-value">第${iter}回</span></div>
    <div class="meta-item"><span class="meta-label">実施日</span><span class="meta-value">${session ? formatDate(session.date) : '―'}</span></div>
    ${data.submittedAt ? `<div class="meta-item"><span class="meta-label">提出日時</span><span class="meta-value" style="font-size:10pt;">${new Date(data.submittedAt).toLocaleString('ja-JP')}</span></div>` : ''}
  </div>

  <div class="section">
    <h2>① 今週実施したタスクのプロセスフロー</h2>
    ${processFlowsHtml || '<p style="color:#aaa;font-size:9pt;">タスクが未選択またはプロセスフローが未登録です</p>'}
  </div>

  <div class="section">
    <h2>② 実施内容</h2>
    <div style="margin-bottom:.5rem;">
      <span style="font-size:9pt;font-weight:700;color:#666;">記入者:</span> ${authorsHtml || '―'}
      ${data.contentUpdatedAt ? `<span style="margin-left:1rem;font-size:8pt;color:#999;">最終更新: ${formattedTimestamp(data.contentUpdatedAt)}</span>` : ''}
    </div>
    <p><span class="sub-label ach">✓ できたこと</span></p>
    ${imagesHtml ? `<div class="images">${imagesHtml}</div>` : ''}
    <div class="text-box">${data.achievement || '（未記入）'}</div>
    <p style="margin-top:1rem;"><span class="sub-label chal">⚠ 新たな課題</span></p>
    <div class="text-box">${data.challenge || '（未記入）'}</div>
  </div>

  <div class="section">
    <h2>③ 各メンバーからの伝達事項</h2>
    <table>
      <thead><tr><th>役名</th><th>担当者</th><th>伝達事項</th><th style="width:80px;">最終更新</th></tr></thead>
      <tbody>${commsHtml}</tbody>
    </table>
  </div>

  <div class="footer">
    生成日時: ${new Date().toLocaleString('ja-JP')} ／ PBL2 Student Manager
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) { alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。'); return; }
    win.document.write(html);
    win.document.close();
    if (forSubmit) {
        win.onload = () => win.print();
    }
}



function handleWrImageFiles(files, section) {
    const iter = getWrIter();
    if (!state.reports[iter]) state.reports[iter] = {};
    if (!state.reports[iter].achievementImages) state.reports[iter].achievementImages = [];

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            state.reports[iter].achievementImages.push(e.target.result);
            saveState();
            renderWrImages('wr-achievement-images', state.reports[iter].achievementImages, 'achievement');
        };
        reader.readAsDataURL(file);
    });
}

function renderWrImages(containerId, images, section) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    images.forEach((src, idx) => {
        const div = document.createElement('div');
        div.className = 'wr-img-item';
        div.innerHTML = `
            <img src="${src}" alt="画像${idx + 1}">
            <button class="wr-img-remove" onclick="removeWrImage('${section}', ${idx})" title="削除">✕</button>
        `;
        container.appendChild(div);
    });
}

window.removeWrImage = (section, idx) => {
    const iter = getWrIter();
    if (state.reports[iter]?.achievementImages) {
        state.reports[iter].achievementImages.splice(idx, 1);
        saveState();
        renderWrImages('wr-achievement-images', state.reports[iter].achievementImages, 'achievement');
    }
};

function loadAnalysisReport() {
    const data = state.reports['analysis'] || { bg: '', problem: '', solution: '' };
    document.getElementById('analysis-theme-title').value = state.themeName || '';
    document.getElementById('analysis-group-name').value = state.groupName || '';
    document.getElementById('analysis-bg').value = data.bg || '';
    document.getElementById('analysis-problem').value = data.problem || '';
    document.getElementById('analysis-solution').value = data.solution || '';
}

function saveAnalysisReport() {
    const bg = document.getElementById('analysis-bg').value;
    const problem = document.getElementById('analysis-problem').value;
    const solution = document.getElementById('analysis-solution').value;
    const content = `${bg}\n${problem}\n${solution}`.trim();
    state.reports['analysis'] = { bg, problem, solution, content };
    saveState();
    alert('課題設定レポートを保存しました');
    renderGantt();
}

function loadContributionSurvey() {
    if (!currentContributionKey) return;
    const data = state.reports[currentContributionKey] || { content: '' };
    document.getElementById('contribution-content').value = data.content;
}

function saveContributionSurvey() {
    if (!currentContributionKey) return;
    const content = document.getElementById('contribution-content').value;
    state.reports[currentContributionKey] = { content };
    saveState();
    alert('保存しました');
    renderGantt();
}

// Legacy handlers kept for HTML compatibility
function handleImageUpload(e) {
    handleWrImageFiles(e.target.files, 'achievement');
}
window.removeImage = (idx) => removeWrImage('achievement', idx);



// --- Data Export/Import ---
function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pbl2_data_${state.groupName || 'student'}.json`;
    a.click();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            state = imported;
            saveState();
            location.reload();
        } catch (err) {
            alert('ファイルの読み込みに失敗しました');
        }
    };
    reader.readAsDataURL(file);
}

function resetData() {
    if (confirm('すべてのデータをリセットしますか？')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

// --- Dashboard Stats ---
function renderAll() {
    updateDisplayInfo();
    renderRecentActivity();
    renderUpcomingSchedule();
    renderRoleGuide();
}

function renderRecentActivity() {
    const list = document.getElementById('recent-activity-list');
    const activities = [];

    // Reports
    Object.keys(state.reports).forEach(iter => {
        const r = state.reports[iter];
        if (r.submittedAt) {
            activities.push({
                date: new Date(r.submittedAt),
                text: `第${iter}回 作業報告書を提出しました`,
                icon: 'check-circle'
            });
        } else if (r.updatedAt) {
            activities.push({
                date: new Date(r.updatedAt),
                text: `第${iter}回 報告書の下書きを保存しました`,
                icon: 'edit'
            });
        }
    });

    // Artifacts
    const artifactNames = {
        poster: '事業企画ポスター',
        leaflet: '事業企画リーフレット',
        pamphlet_25: '製品パンフレット',
        slides_25: '最終プレゼンスライド'
    };

    Object.keys(state.artifactSettings || {}).forEach(key => {
        const setting = state.artifactSettings[key];
        if (setting && setting.updatedAt) {
            activities.push({
                date: new Date(setting.updatedAt),
                text: `成果物 [${artifactNames[key] || key}] を更新しました`,
                icon: 'file-up'
            });
        }
    });

    // Sort by date (newest first)
    activities.sort((a, b) => b.date - a.date);

    if (activities.length > 0) {
        list.innerHTML = activities.slice(0, 5).map(act => `
            <li>
                <div class="activity-icon"><i data-lucide="${act.icon}"></i></div>
                <div class="activity-text">${act.text}</div>
            </li>
        `).join('');
        if (window.lucide) lucide.createIcons();
    } else {
        list.innerHTML = '<li class="empty-msg">活動はまだありません</li>';
    }
}

function renderUpcomingSchedule() {
    const list = document.getElementById('upcoming-schedule-list');
    const now = new Date();
    const upcoming = DEFAULT_SCHEDULE.filter(s => new Date(s.date) >= now).slice(0, 3);

    if (upcoming.length > 0) {
        list.innerHTML = upcoming.map(s => `
            <li>
                <div class="schedule-date">${s.date}</div>
                <div class="schedule-label">${s.label}</div>
            </li>
        `).join('');

        document.getElementById('next-event-name').textContent = upcoming[0].label;
        document.getElementById('next-event-date').textContent = upcoming[0].date;
    }
}
