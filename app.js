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
    analysisReport: { bg: '', problem: '', solution: '', images: [] },
    artifacts: { // Track specific deliverables (toggles)
        poster: false,
        leaflet: false,
        pamphlet_25: false,
        slides_25: false
    },
    schedule: [] // Loaded from CSV data
};

const STORAGE_KEY = 'pbl2_student_manager_data';

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
}

// --- View Controller ---
function initEventListeners() {
    // Navigation
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

    // Reports Iteration Selector
    const iterSelect = document.getElementById('work-report-iteration');
    for (let i = 1; i <= 25; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${i}回目`;
        iterSelect.appendChild(opt);
    }
    iterSelect.addEventListener('change', loadWorkReport);

    // Save Report
    document.getElementById('btn-save-report').addEventListener('click', saveWorkReport);

    // Image Upload
    document.getElementById('image-upload-zone').addEventListener('click', () => {
        document.getElementById('image-input').click();
    });
    document.getElementById('image-input').addEventListener('change', handleImageUpload);

    // Data Export/Import
    document.getElementById('btn-export-json').addEventListener('click', exportData);
    document.getElementById('btn-trigger-import').addEventListener('click', () => {
        document.getElementById('import-json-file').click();
    });
    document.getElementById('import-json-file').addEventListener('change', importData);
    document.getElementById('btn-reset-data').addEventListener('click', resetData);

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
        gantt: 'プロジェクト管理 (ガントチャート)',
        reports: '報告書・レポート作成',
        members: 'メンバー・テーマ設定',
        data: 'データ管理',
        mindmap: '思考整理 (Mind Map)'
    };
    document.getElementById('view-title').textContent = titles[viewId] || 'PBL2 Manager';

    if (viewId === 'mindmap' && typeof MindMapModule !== 'undefined') {
        MindMapModule.init();
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

        timelineHeader.appendChild(tick);
    }
    ganttTable.appendChild(timelineHeader);

    // --- NEW: Events Status Row ---
    const eventsLabel = document.createElement('div');
    eventsLabel.className = 'gantt-label event-row-label';
    eventsLabel.innerHTML = '<i data-lucide="calendar" style="width:14px; height:14px; vertical-align:middle; margin-right:5px; color:var(--accent)"></i> 授業イベント';
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
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <strong>${group.name}</strong>
                <button class="btn btn-sm" style="padding: 2px 8px; font-size: 11px; height: auto; background-color: ${group.color}; border-color: ${group.color}; color: white;" onclick="openTaskModal(-1, '${group.id}')">
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
            headerGrid.appendChild(cell);
        }
        ganttTable.appendChild(headerGrid);

        // Render Items in this Group (Deliverables)
        group.items.forEach(it => {
            const labelCell = document.createElement('div');
            labelCell.className = `gantt-label deliverable-label label-${group.id}`;
            labelCell.style.color = group.color;
            labelCell.innerHTML = `<i data-lucide="file-check-2" style="width:12px; height:12px; margin-right:6px;"></i> ${it.name}`;
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

                // Logic for different item types
                if (it.type === 'report') {
                    const iter = i - 2;
                    if (iter >= 1 && iter <= 25) {
                        const hasReport = state.reports[iter] && state.reports[iter].content;
                        const marker = document.createElement('div');
                        marker.className = `report-marker ${hasReport ? 'submitted' : 'pending'} category-effort`;
                        marker.title = `第${i}回 作業報告書: ${hasReport ? '提出済' : '未提出'}\nクリックで編集へ`;
                        marker.onclick = () => {
                            switchView('reports');
                            document.getElementById('work-report-iteration').value = iter;
                            loadWorkReport();
                        };
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
                                state.artifacts[itKey] = !state.artifacts[itKey];
                                saveState();
                                renderGantt();
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
            labelCell.textContent = task.name;
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
    if (index === -1) {
        title.textContent = 'タスク追加';
        nameInput.value = '';
        categorySelect.value = defaultCategory;
        startInput.value = 1;
        endInput.value = 1;
    } else {
        title.textContent = 'タスク編集';
        nameInput.value = task.name;
        categorySelect.value = task.category || 'effort';
        startInput.value = task.start;
        endInput.value = task.end;
        completedInput.checked = !!task.completed;
    }

    if (index === -1) {
        completedInput.checked = false;
    }

    modal.classList.add('active');
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

    const taskData = { name, category, start, end, assignees, completed };

    if (editingTaskIndex === -1) {
        state.tasks.push(taskData);
    } else {
        state.tasks[editingTaskIndex] = { ...state.tasks[editingTaskIndex], ...taskData };
    }

    saveState();
    closeModal();
    renderGantt();
}

// --- Reports Logic ---
let currentContributionKey = '';

function loadWorkReport() {
    const iter = document.getElementById('work-report-iteration').value;
    const data = state.reports[iter] || { content: '', images: [] };

    document.getElementById('work-report-content').value = data.content;
    renderImagePreviews(data.images);
}

function saveWorkReport() {
    const iter = document.getElementById('work-report-iteration').value;
    const content = document.getElementById('work-report-content').value;

    if (!state.reports[iter]) state.reports[iter] = { content: '', images: [] };
    state.reports[iter].content = content;

    saveState();
    alert(`${iter}回目の報告書を保存しました`);
    renderGantt(); // Update marker color
}

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

    // Use a composite string as "content" to trigger the "submitted" dot logic
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

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const iter = document.getElementById('work-report-iteration').value;
        if (!state.reports[iter]) state.reports[iter] = { content: '', images: [] };

        state.reports[iter].images.push(event.target.result);
        saveState();
        renderImagePreviews(state.reports[iter].images);
    };
    reader.readAsDataURL(file);
}

function renderImagePreviews(images) {
    const container = document.getElementById('image-preview-container');
    container.innerHTML = '';
    images.forEach((src, idx) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.innerHTML = `
            <img src="${src}">
            <button class="remove-btn" onclick="removeImage(${idx})">&times;</button>
        `;
        container.appendChild(div);
    });
}

window.removeImage = (idx) => {
    const iter = document.getElementById('work-report-iteration').value;
    state.reports[iter].images.splice(idx, 1);
    saveState();
    renderImagePreviews(state.reports[iter].images);
};

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
    // For demo, just show last saved report
    const iterations = Object.keys(state.reports).sort((a, b) => b - a);
    if (iterations.length > 0) {
        list.innerHTML = iterations.slice(0, 5).map(iter => `
            <li>
                <div class="activity-icon"><i data-lucide="check-circle"></i></div>
                <div class="activity-text">${iter}回目の報告書を更新しました</div>
            </li>
        `).join('');
        lucide.createIcons();
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
