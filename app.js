// PBL2 Student Manager - app.js

const DEFAULT_DELIVERABLE_TARGETS = {
    workReportStart: 3,
    analysis: 13,
    contribution: [13, 26, 27],
    poster: 12,
    leaflet: 12,
    mutual: [13, 26, 27],
    reflection: [13, 26, 27],
    pamphlet: 25,
    slides: 25
};

/** Master list for syncing Gantt and Deliverables folders (Aliases) */
const DELIVERABLE_MASTER_LIST = [
    { id: 'reports', name: '作業報告書提出', icon: 'file-text', color: '#6366f1', group: 'effort', viewId: 'reports', tabId: 'work-report', desc: '活動報告書 (第3回〜)' },
    { id: 'assignment', name: '課題設定レポート', icon: 'clipboard-list', color: '#10b981', group: 'effort', viewId: 'reports', tabId: 'analysis-report', desc: 'テーマ設定・課題定義' },
    { id: 'contribution', name: '貢献度調査', icon: 'users-2', color: '#ec4899', group: 'effort', viewId: 'reports', tabId: 'contribution', desc: 'メンバー相互評価' },
    { id: 'poster', name: '事業企画ポスター', icon: 'file-text', color: '#3b82f6', group: 'presentation', viewId: 'deliverables', artifactKey: 'poster', desc: '（中間発表用）' },
    { id: 'leaflet', name: '事業企画リーフレット', icon: 'book-open', color: '#10b981', group: 'presentation', viewId: 'deliverables', artifactKey: 'leaflet', desc: '（中間発表用）' },
    { id: 'group_eval', name: '相互評価シート', icon: 'vibrate', color: '#8b5cf6', group: 'presentation', viewId: 'reports', tabId: 'mutual', desc: 'グループ相互評価' },
    { id: 'feedback', name: '振り返りシート', icon: 'refresh-ccw', color: '#0ea5e9', group: 'presentation', viewId: 'reports', tabId: 'reflection', desc: '発表フィードバック' },
    { id: 'pamphlet', name: '製品・サービスパンフレット', icon: 'layout', color: '#f59e0b', group: 'presentation', viewId: 'deliverables', artifactKey: 'pamphlet', desc: '（最終発表用）' },
    { id: 'slides', name: '最終プレゼンスライド', icon: 'presentation', color: '#ef4444', group: 'presentation', viewId: 'deliverables', artifactKey: 'slides', desc: '（最終発表用）' }
];

function gotoDeliverable(id, iteration = null) {
    const item = DELIVERABLE_MASTER_LIST.find(d => d.id === id);
    if (!item) return;

    if (item.viewId === 'reports') {
        const iterSuffix = iteration ? `_${iteration}` : '_13';
        if (id === 'contribution') {
            currentContributionKey = `${id}${iterSuffix}`;
        } else if (id === 'group_eval') {
            currentMutualKey = `${id}${iterSuffix}`;
        } else if (id === 'feedback') {
            currentReflectionKey = `${id}${iterSuffix}`;
        }

        switchView('reports');
        if (item.tabId) switchTab(item.tabId);
    } else if (item.viewId === 'deliverables') {
        if (item.artifactKey) {
            switchView('deliverables');
            renderDeliverables('presentation');
            openArtifactEditor(item.artifactKey, item.name);
        } else {
            switchView('deliverables');
            renderDeliverables(id);
        }
    }
}

// --- State Management ---
let state = {
    themeName: '',
    companyName: '', // NEW
    groupSymbol: '', // A, B, C...
    groupName: '',   // Catchy name
    groupLogo: '',   // DataURL for team logo
    teamsUrl: '',    // URL to Teams chat/channel
    members: [],
    isConfigLocked: false, // NEW: Locks teacher settings (theme, company, schedule, profs, names)
    membersLocked: false, // Legacy: overall member list lock
    tasks: [],
    reports: {}, // { iteration: { content: '', images: [] } }
    presentationSchedules: {}, // NEW: { iteration: [ { teamName, theme }, ... ] }
    artifactSettings: {}, // { key: { slides: [{src, hotspots: [{rect, authorIdx}]}] } }
    analysisReport: { bg: '', problem: '', solution: '', images: [] },
    artifacts: { // Track specific deliverables (toggles)
        poster: false,
        leaflet: false,
        pamphlet_25: false,
        slides_25: false
    },
    schedule: [], // Loaded from CSV data
    sidebarCollapsed: false,
    messages: [
        {
            id: 'setup-guide-1',
            topicId: 'from_teacher',
            senderName: 'システム',
            senderRole: '案内',
            content: '【アプリの準備手順①】\n初めに、サイドメニューの「データ管理」から「ステップ1: データの初期化（リセット）」を行ってください。',
            timestamp: Date.now(),
            color: '#4f46e5',
            readBy: []
        },
        {
            id: 'setup-guide-2',
            topicId: 'from_teacher',
            senderName: 'システム',
            senderRole: '案内',
            content: '【アプリの準備手順②】\n次に、教員より配布された初期設定ファイル（202X_企業名_グループ.json）を「ステップ2: 初期設定ファイルの読み込み」から取り込んでください。これによって、年度・テーマ・グループメンバ・スケジュールが自動設定されます。',
            timestamp: Date.now() + 1000,
            color: '#4f46e5',
            readBy: []
        }
    ],
    topics: [ // { id, name, createdBy, timestamp }
        { id: 'general', name: '全般', createdBy: 'system', timestamp: 0 },
        { id: 'from_teacher', name: '教員より', createdBy: 'system', timestamp: 0 }
    ],
    lastMessagesCheckTime: 0, // Timestamp when user last viewed the message board
    currentTopicId: 'from_teacher',
    supervisingInstructors: [
        { lastName: '', firstName: '', emailLocal: '' },
        { lastName: '', firstName: '', emailLocal: '' }
    ],
    bookmarks: [],
    deliverableTargets: DEFAULT_DELIVERABLE_TARGETS,
    bmc: {}, // { sectionId: [ { id, text, color, image, order } ] }
    polls: [], // { id, title, options: [{id, text, votes: [memberIdx]}], status: 'active/closed', type: 'single/multiple' }
    currentPollId: null
};

let currentReflectionKey = null;
let currentContributionKey = null;
let currentMutualKey = null;


// --- Mention State ---
let mentionState = {
    isActive: false,
    query: '',
    cursorPos: 0,
    selectedIndex: 0,
    filteredMembers: []
};
let pendingAttachments = [];



const STORAGE_KEY = 'pbl2_student_manager_data';

// --- Artifact Detail Selection State ---
let currentArtifactKey = null;
let currentSlideIndex = -1;
let isDrawingHotspot = false;
let hotspotStartPos = { x: 0, y: 0 };
let artifactZoom = 1.0;
let artifactEditorMode = 'draw'; // 'draw' or 'drag'
let isPanningViewer = false;
let panStartScroll = { left: 0, top: 0 };
let panStartMouse = { x: 0, y: 0 };

/** Mode toggle for viewer */
function setArtifactMode(mode) {
    artifactEditorMode = mode;
    const drawBtn = document.getElementById('btn-mode-draw');
    const dragBtn = document.getElementById('btn-mode-drag');
    const container = document.getElementById('hotspot-container');

    if (drawBtn) drawBtn.classList.toggle('active', mode === 'draw');
    if (dragBtn) dragBtn.classList.toggle('active', mode === 'drag');

    if (container) {
        container.style.cursor = mode === 'draw' ? 'crosshair' : 'grab';
    }
}

/** Zoom controls for artifact viewer */
function changeArtifactZoom(delta) {
    artifactZoom = Math.max(0.5, Math.min(3.0, artifactZoom + delta));
    applyArtifactZoomUI();
}

function resetArtifactZoom() {
    artifactZoom = 1.0;
    applyArtifactZoomUI();
}

function applyArtifactZoomUI() {
    const container = document.getElementById('hotspot-container');
    const zoomText = document.getElementById('artifact-zoom-level');
    if (container) {
        const zoomValue = Math.round(artifactZoom * 100);
        // Force dimensions to trigger overflow in the parent .artifact-main
        container.style.width = zoomValue + '%';
        container.style.minWidth = zoomValue + '%';
        container.style.maxWidth = 'none';

        if (zoomText) {
            zoomText.textContent = zoomValue + '%';
        }
    }
}

// --- Poll Creation Modal State ---
let pollCreationMode = 'text'; // 'text' or 'calendar'
let miniCalendarYear = new Date().getFullYear();
let miniCalendarMonth = new Date().getMonth();
let selectedDates = []; // Array of ISO date strings

const MEMBER_ROLES = [
    { title: 'プロジェクトリーダー', desc: 'プロジェクトの取りまとめ' },
    { title: 'マーケティング', desc: '市場調査・競合などの現状分析、データの収集・可視化' },
    { title: 'エンジニアリング', desc: '技術開発・仕様の決定、設計書の作成、モックアップの具体化' },
    { title: 'プロモーション', desc: '製品サービスの情報発信、マーケティング資料のデザイン作成' }
];

const BASE_COURSES = [
    'エネルギー機械',
    'プロダクトデザイン',
    'エレクトロニクス',
    '知能情報'
];

const AVATAR_COLORS = [
    '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'
];

// Pre-parsed schedule data from CSV (2026 example)
const DEFAULT_SCHEDULE = [
    { id: 1, date: '2026-04-15', label: 'ガイダンス（1回目・水1）' },
    { id: 2, date: '2026-04-22', label: '企業テーマ説明（2回目・水2）' },
    { id: 3, date: '2026-04-29', label: 'グループ活動（3回目・水3）' },
    { id: 4, date: '2026-05-13', label: 'グループ活動（4回目・水4）' },
    { id: 5, date: '2026-05-20', label: 'グループ活動（5回目・水5）' },
    { id: 6, date: '2026-05-27', label: 'グループ活動（6回目・水6）' },
    { id: 7, date: '2026-06-03', label: 'グループ活動・中間発表（7回目・水7）' },
    { id: 8, date: '2026-06-17', label: 'グループ活動（8回目・水8）' },
    { id: 9, date: '2026-06-24', label: 'グループ活動（9回目・水9）' },
    { id: 10, date: '2026-07-01', label: 'グループ活動（10回目・水10）' },
    { id: 11, date: '2026-07-08', label: 'グループ活動（11回目・水11）' },
    { id: 12, date: '2026-07-15', label: 'グループ活動（12回目・水12）' },
    { id: 13, date: '2026-07-22', label: '中間発表（夏休み前の14回目・水14）' },
    { id: 14, date: '2026-09-16', label: '後期活動開始（15回目・水15）' },
    { id: 15, date: '2026-09-30', label: 'グループ活動（1回目・水1）' },
    { id: 16, date: '2026-10-07', label: 'グループ活動（2回目・水2）' },
    { id: 17, date: '2026-10-14', label: 'グループ活動（3回目・水3）' },
    { id: 18, date: '2026-10-21', label: 'グループ活動（4回目・水4）' },
    { id: 19, date: '2026-10-28', label: 'グループ活動（5回目・水5）' },
    { id: 20, date: '2026-11-04', label: 'グループ活動（6回目・水6）' },
    { id: 21, date: '2026-11-18', label: 'グループ活動（7回目・水7）' },
    { id: 22, date: '2026-12-02', label: 'グループ活動（8回目・水8）' },
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

// function loadState() { ... } replaced by new implementation with migration logic


function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

        // Hide warning if save succeeds
        const warn = document.getElementById('storage-quota-warning');
        if (warn) warn.style.display = 'none';
        updateDisplayInfo();
        updateMessageNotification();
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            showQuotaWarning();
        }
        return false;
    }
}

function showQuotaWarning() {
    // Check if we already show it
    if (document.getElementById('storage-quota-warning')) {
        document.getElementById('storage-quota-warning').style.display = 'block';
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'storage-quota-warning';
    banner.style = 'background:#ef4444; color:white; padding:10px 20px; text-align:center; font-weight:bold; position:fixed; top:0; left:0; right:0; z-index:9999; display:flex; align-items:center; justify-content:center; gap:10px; cursor:pointer;';
    banner.innerHTML = `
        <i data-lucide="alert-triangle"></i>
        <span>ブラウザの保存容量制限を超えました。最新の変更が保存されていません！</span>
        <button onclick="this.parentElement.style.display='none'" style="background:rgba(0,0,0,0.2); border:none; color:white; padding:2px 8px; border-radius:4px; font-size:12px; cursor:pointer;">閉じる</button>
    `;
    banner.onclick = () => {
        switchView('data');
        alert('対策：\n1. 不要な添付ファイル付きメッセージを削除する\n2. 「データ管理」から書き出し（バックアップ）を行い、一度リセットする');
    };
    document.body.prepend(banner);
    if (window.lucide) lucide.createIcons();

    alert('⚠️ 保存容量（localStorage）がいっぱいです！\n送信しようとした内容や変更が保存されませんでした。\n\n「データ管理」から「一括圧縮」を試すか、不要なデータを整理してください。');
}

/** Image Lightbox functionality */
function openLightbox(src) {
    let lightbox = document.getElementById('image-lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'image-lightbox';
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <img id="lightbox-img" src="" alt="">
                <button class="lightbox-close" onclick="closeLightbox()">×</button>
            </div>
        `;
        lightbox.onclick = (e) => {
            if (e.target.id === 'image-lightbox') closeLightbox();
        };
        document.body.appendChild(lightbox);
    }
    const img = document.getElementById('lightbox-img');
    img.src = src;
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scroll
}

window.closeLightbox = () => {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) lightbox.style.display = 'none';
    document.body.style.overflow = '';
};

/**
 * Resizes and compresses an image (base64) to keep localStorage usage low.
 * @param {string} dataUrl - The source image as DataURL.
 * @param {number} maxWidth - Maximum width.
 * @param {number} maxHeight - Maximum height.
 * @param {number} quality - JPEG quality (0 to 1).
 * @returns {Promise<string>} - The compressed DataURL.
 */
function compressImage(dataUrl, maxWidth = 800, maxHeight = 800, quality = 0.25) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onerror = () => resolve(dataUrl); // Fallback to original
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
            } else {
                // If already small, still re-encode to JPEG to potentially save space if it was a PNG
                // but if quality loss is a concern, we could return dataUrl directly.
                // Re-encoding is safer for storage.
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = dataUrl;
    });
}

function updateDisplayInfo() {
    const displayTheme = document.getElementById('display-theme-name');
    if (!displayTheme) return; // Prevent errors if UI not ready

    const companyPrefix = state.companyName ? `[${state.companyName}] ` : '';
    displayTheme.textContent = companyPrefix + (state.themeName || '未設定のテーマ名');

    const ganttTheme = document.getElementById('gantt-theme-display');
    if (ganttTheme) ganttTheme.textContent = state.themeName || '未設定のテーマ名';

    const combinedGroupName = state.groupSymbol ? `グループ${state.groupSymbol}${state.groupName ? ': ' + state.groupName : ''}` : (state.groupName || '未設定のグループ名');
    const groupDisplay = document.getElementById('display-group-name');
    if (groupDisplay) groupDisplay.textContent = combinedGroupName;

    const ganttGroup = document.getElementById('gantt-group-display');
    if (ganttGroup) ganttGroup.textContent = combinedGroupName;

    // --- Dashboard Unread Count Card ---
    const unreadEl = document.getElementById('dashboard-unread-count');
    if (unreadEl) {
        unreadEl.textContent = getUnreadMessageCount();
    }

    // Update sidebar badges too
    updateMessageNotification();

    // --- Config Locking UI ---
    const lockBadge = document.getElementById('config-lock-badge');
    if (lockBadge) {
        lockBadge.style.display = state.isConfigLocked ? 'block' : 'none';
        lockBadge.title = 'クリックしてロック解除（パスワード：pbl2）';
        lockBadge.style.cursor = 'pointer';
        lockBadge.onclick = unlockConfigWithPassword;
    }

    const lockedInputs = [
        'input-company-name', 'input-theme-name', 'select-group-symbol',
        'prof-1-last', 'prof-1-first', 'prof-1-email',
        'prof-2-last', 'prof-2-first', 'prof-2-email'
    ];
    lockedInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.readOnly = state.isConfigLocked;
            if (el.tagName === 'SELECT') el.disabled = state.isConfigLocked;
            // Add visual cue
            el.style.opacity = state.isConfigLocked ? '0.7' : '1';
        }
    });

    // Theme/Company Name inputs
    document.getElementById('input-company-name').value = state.companyName || '';
    document.getElementById('input-theme-name').value = state.themeName || '';
    document.getElementById('select-group-symbol').value = state.groupSymbol || '';
    document.getElementById('input-group-name').value = state.groupName || '';

    // --- Logo Logic (Sidebar & Gantt) ---
    const updateLogo = (imgId, placeholderId, isSidebar = false) => {
        const logoImg = document.getElementById(imgId);
        const logoPlaceholder = document.getElementById(placeholderId);

        if (!logoImg || !logoPlaceholder) return;

        if (state.groupLogo) {
            // Show Image
            logoImg.src = state.groupLogo;
            logoImg.style.display = 'block';
            logoPlaceholder.style.display = 'none';
        } else {
            // Show Placeholder
            logoImg.style.display = 'none';
            logoPlaceholder.style.display = 'flex';

            // Symbol Logic: "未設定の場合単色塗りでグループ記号"
            if (state.groupSymbol) {
                logoPlaceholder.style.background = '#4f46e5'; // Primary color (solid)
                logoPlaceholder.innerText = state.groupSymbol;
                logoPlaceholder.style.fontSize = '24px';
            } else {
                // Default Icon view
                logoPlaceholder.style.background = 'rgba(255,255,255,0.1)';
                logoPlaceholder.innerHTML = isSidebar
                    ? `<i data-lucide="image-plus" style="width:20px;height:20px;opacity:0.5;"></i>`
                    : `<i data-lucide="image" style="width:20px;height:20px;opacity:0.5;"></i>`;
                if (window.lucide) {
                    lucide.createIcons({
                        root: logoPlaceholder
                    });
                }
            }
        }
    };

    updateLogo('team-logo-img', 'team-logo-placeholder', true);
    updateLogo('gantt-team-logo', 'gantt-team-logo-placeholder', false);

    const btnDelLogo = document.getElementById('btn-delete-team-logo');
    if (btnDelLogo) {
        btnDelLogo.style.display = state.groupLogo ? 'flex' : 'none';
        if (state.groupLogo && window.lucide) {
            lucide.createIcons({
                root: btnDelLogo
            });
        }
    }


    // Theme/Company Name inputs set above

    // Supervising Instructors
    if (state.supervisingInstructors) {
        state.supervisingInstructors.forEach((prof, idx) => {
            const i = idx + 1;
            const lastEl = document.getElementById(`prof-${i}-last`);
            const firstEl = document.getElementById(`prof-${i}-first`);
            const emailEl = document.getElementById(`prof-${i}-email`);
            const teamsEl = document.getElementById(`prof-${i}-teams`);

            if (lastEl) lastEl.value = prof.lastName || '';
            if (firstEl) firstEl.value = prof.firstName || '';
            if (emailEl) emailEl.value = prof.emailLocal || '';

            if (teamsEl) {
                if (prof.emailLocal) {
                    teamsEl.href = `https://teams.microsoft.com/l/chat/0/0?users=${prof.emailLocal}@omu.ac.jp`;
                    teamsEl.style.display = 'flex';
                } else {
                    teamsEl.style.display = 'none';
                }
            }
        });
    }

    // Dynamic Teams Group Chat Link (includes all members)
    const teamsBtn = document.getElementById('btn-group-teams');
    const memberEmails = state.members
        .filter(m => m.emailLocal)
        .map(m => `${m.emailLocal}@st.omu.ac.jp`);

    if (teamsBtn) {
        if (memberEmails.length > 0) {
            state.teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${memberEmails.join(',')}`;
            teamsBtn.style.display = 'flex';
            teamsBtn.title = `全員 (${memberEmails.length}名) とチャット`;
            teamsBtn.onclick = () => window.open(state.teamsUrl, '_blank');
        } else {
            state.teamsUrl = '';
            teamsBtn.style.display = 'none';
        }
    }

    // Reports progress (only submitted work reports)
    const completedReports = Object.entries(state.reports).filter(([key, r]) => {
        return !isNaN(key) && r.submitted; // Only count numbered work reports (sessions)
    }).length;
    document.getElementById('completed-reports-count').textContent = completedReports;
    const progressPercent = (completedReports / 26) * 100; // There are 26 possible reports (sessions 3-28)
    document.getElementById('reports-progress').style.width = `${progressPercent}%`;

    // Tasks progress
    const totalTasks = state.tasks.length;
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const taskRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    document.getElementById('task-completion-rate').textContent = taskRate;
    document.getElementById('tasks-progress').style.width = `${taskRate}%`;

    // Artifacts progress (only final submitted)
    const artifactKeys = ['poster', 'leaflet', 'pamphlet_25', 'slides_25'];
    const completedArtifacts = artifactKeys.filter(k => {
        return state.artifactSettings && state.artifactSettings[k] && state.artifactSettings[k].submitted;
    }).length;
    const artifactDisplay = document.getElementById('completed-artifacts-count');
    if (artifactDisplay) {
        artifactDisplay.textContent = completedArtifacts;
        const artPercent = (completedArtifacts / artifactKeys.length) * 100;
        document.getElementById('artifacts-progress').style.width = `${artPercent}%`;
    }

    // --- Storage Usage Update ---
    updateStorageUsage();

    // --- Header Graphs Update ---
    renderHeaderGraphs();
}

function updateStorageUsage() {
    const bar = document.getElementById('storage-usage-bar');
    const text = document.getElementById('storage-usage-text');
    if (!bar || !text) return;

    try {
        const json = JSON.stringify(state);
        const charCount = json.length;
        const quota = 5 * 1024 * 1024; // 5M characters is a standard limit for PC browsers

        let percent = Math.min(100, Math.round((charCount / quota) * 100));

        bar.style.width = `${percent}%`;
        text.textContent = `${percent}%`;

        // Change color based on usage
        if (percent > 90) bar.style.background = '#ef4444'; // Red
        else if (percent > 70) bar.style.background = '#f59e0b'; // Amber
        else bar.style.background = 'var(--primary)'; // Normal

        const container = document.getElementById('storage-usage-container');
        if (container) {
            const sizeMB = (charCount / (1024 * 1024)).toFixed(1);
            container.title = `現在の使用量: 約${sizeMB}M文字 / ブラウザ制限: 約5M文字`;
        }
    } catch (e) {
        console.error('Usage calculation failed:', e);
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
    document.getElementById('input-company-name').addEventListener('input', (e) => {
        if (state.isConfigLocked) { e.target.value = state.companyName; return; }
        state.companyName = e.target.value;
        saveState();
    });
    document.getElementById('input-theme-name').addEventListener('input', (e) => {
        if (state.isConfigLocked) { e.target.value = state.themeName; return; }
        state.themeName = e.target.value;
        saveState();
    });
    document.getElementById('select-group-symbol').addEventListener('change', (e) => {
        if (state.isConfigLocked) { e.target.value = state.groupSymbol; return; }
        state.groupSymbol = e.target.value;
        saveState();
    });

    // Team Logo Upload
    const logoWrapper = document.getElementById('team-logo-wrapper');
    const logoInput = document.getElementById('team-logo-input');
    if (logoWrapper && logoInput) {
        logoWrapper.addEventListener('click', (e) => {
            logoInput.value = ''; // Reset to allow same file selection
            logoInput.click();
        });
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (rev) => {
                    // Compress logo image
                    state.groupLogo = await compressImage(rev.target.result, 600, 600, 0.8);
                    saveState();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const btnDelLogo = document.getElementById('btn-delete-team-logo');
    if (btnDelLogo) {
        btnDelLogo.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('チームロゴを削除しますか？')) {
                state.groupLogo = '';
                saveState();
                if (logoInput) logoInput.value = '';
            }
        });
    }
    document.getElementById('input-group-name').addEventListener('input', (e) => {
        state.groupName = e.target.value;
        saveState();
    });

    // Supervising Instructors listeners
    document.getElementById('prof-1-last').addEventListener('input', (e) => {
        state.supervisingInstructors[0].lastName = e.target.value;
        saveState();
    });
    document.getElementById('prof-1-first').addEventListener('input', (e) => {
        state.supervisingInstructors[0].firstName = e.target.value;
        saveState();
    });
    document.getElementById('prof-2-last').addEventListener('input', (e) => {
        state.supervisingInstructors[1].lastName = e.target.value;
        saveState();
    });
    document.getElementById('prof-2-first').addEventListener('input', (e) => {
        state.supervisingInstructors[1].firstName = e.target.value;
        saveState();
    });
    document.getElementById('prof-1-email').addEventListener('input', (e) => {
        state.supervisingInstructors[0].emailLocal = e.target.value;
        saveState();
    });
    document.getElementById('prof-2-email').addEventListener('input', (e) => {
        state.supervisingInstructors[1].emailLocal = e.target.value;
        saveState();
    });

    // Members
    document.getElementById('btn-add-member').addEventListener('click', addMemberRow);
    document.getElementById('btn-lock-members').addEventListener('click', toggleMembersLock);

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

    // Initial Setup Import
    document.getElementById('btn-trigger-initial-import')?.addEventListener('click', () => {
        document.getElementById('import-initial-json').click();
    });
    document.getElementById('import-initial-json')?.addEventListener('change', importInitialSetup);

    // Artifact Detail Modal
    document.getElementById('btn-close-artifact-modal').addEventListener('click', closeArtifactModal);
    document.getElementById('btn-draft-artifact-data').addEventListener('click', saveArtifactData);
    document.getElementById('btn-submit-artifact-data').addEventListener('click', submitArtifactData);
    document.getElementById('artifact-unlock-btn').addEventListener('click', unlockArtifactData);
    document.getElementById('btn-add-artifact-slide').addEventListener('click', () => document.getElementById('artifact-slide-input').click());
    document.getElementById('artifact-slide-input').addEventListener('change', handleArtifactSlideUpload);
    document.getElementById('btn-clear-all-slides').addEventListener('click', clearAllArtifactSlides);
    document.getElementById('btn-compress-all-images').addEventListener('click', compressAllExistingImages);
    initHotspotLogic();
    initArtifactRichEditor();
    document.getElementById('btn-export-artifact-script').addEventListener('click', exportArtifactScript);
    document.getElementById('btn-clear-presenters').addEventListener('click', clearSlidePresenters);
    document.getElementById('btn-clear-hotspots').addEventListener('click', clearSlideHotspots);
    document.getElementById('btn-clear-all-hotspots').addEventListener('click', clearAllSlidesAssignments);

    // Polls
    document.getElementById('btn-create-poll-mode')?.addEventListener('click', () => showPollCreateForm());
    document.getElementById('btn-add-poll-option')?.addEventListener('click', addPollOptionInput);
    document.getElementById('btn-save-poll')?.addEventListener('click', saveNewPoll);
    document.getElementById('btn-cancel-poll')?.addEventListener('click', hidePollCreateForm);


    // Save Analysis & Contribution
    document.getElementById('btn-save-analysis').addEventListener('click', () => saveAnalysisReport(false));
    document.getElementById('btn-submit-analysis').addEventListener('click', () => saveAnalysisReport(true));
    document.getElementById('btn-save-contribution-draft')?.addEventListener('click', () => saveContributionSurvey(false));
    document.getElementById('btn-submit-contribution')?.addEventListener('click', () => saveContributionSurvey(true));

    // General Save
    document.getElementById('btn-save-all').addEventListener('click', () => {
        saveState();
        alert('データを保存しました');
    });

    // Message Board
    document.getElementById('btn-send-message').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Mention Input Handler
    document.getElementById('message-input').addEventListener('input', handleMentionInput);
    document.getElementById('message-input').addEventListener('keydown', handleMentionKeydown);

    // Message Topics
    document.getElementById('btn-add-topic').addEventListener('click', createNewTopic);

    // Mutual schedule import (Mid-term)
    const btnMidtermImport = document.getElementById('btn-trigger-midterm-import');
    const inputMidtermJson = document.getElementById('import-midterm-json');
    if (btnMidtermImport && inputMidtermJson) {
        btnMidtermImport.onclick = () => inputMidtermJson.click();
        inputMidtermJson.onchange = (e) => handlePresentationScheduleImport(e, ["13"]);
    }

    // Mutual schedule import (Final)
    const btnFinalImport = document.getElementById('btn-trigger-final-import');
    const inputFinalJson = document.getElementById('import-final-json');
    if (btnFinalImport && inputFinalJson) {
        btnFinalImport.onclick = () => inputFinalJson.click();
        inputFinalJson.onchange = (e) => handlePresentationScheduleImport(e, ["26", "27"]);
    }

    // Attachments
    document.getElementById('btn-attach-file').addEventListener('click', () => {
        document.getElementById('message-file-input').click();
    });
    document.getElementById('message-file-input').addEventListener('change', handleFileSelect);

    // Bookmarks - Handled via direct table interaction
}

/** ヘッダーのアバター表示を更新 */
function updateHeaderAvatars(mode) {
    const container = document.getElementById('header-avatars');
    if (!container) return;
    container.innerHTML = '';

    const membersToShow = [];
    if (mode === 'group') {
        // 全メンバー
        (state.members || []).forEach(m => membersToShow.push(m));
    } else if (mode === 'individual') {
        // 自分のみ
        const self = (state.members || []).find(m => m.isSelf);
        if (self) membersToShow.push(self);
    }

    membersToShow.forEach(m => {
        const div = document.createElement('div');
        div.className = 'header-avatar';
        div.title = `${m.lastName || ''}${m.firstName || ''}`;

        if (m.avatarImage) {
            const img = document.createElement('img');
            img.src = m.avatarImage;
            div.appendChild(img);
        } else {
            const initial = (m.lastName || '?')[0];
            div.textContent = initial;
            // Use avatar color or default
            const colorIdx = Math.abs(m.id || 0) % AVATAR_COLORS.length;
            div.style.backgroundColor = AVATAR_COLORS[colorIdx];
        }
        container.appendChild(div);
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    // Clear avatars for non-report views. For reports, switchTab will call updateHeaderAvatars.
    if (viewId !== 'reports') {
        const avatarsContainer = document.getElementById('header-avatars');
        if (avatarsContainer) avatarsContainer.innerHTML = '';
    }


    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if (n.getAttribute('data-view') === viewId) n.classList.add('active');
    });

    // Handle nav-group active state
    document.querySelectorAll('.nav-group').forEach(group => {
        const hasActiveItem = group.querySelector(`.nav-item[data-view="${viewId}"]`);
        group.classList.toggle('active', !!hasActiveItem);
    });

    const titles = {
        dashboard: 'ダッシュボード',
        gantt: 'プロジェクト管理',
        reports: '作業報告書作成',
        members: 'メンバー・テーマ設定',
        data: 'データ管理',
        mindmap: 'マインドマップ',
        messages: 'メンバー伝言板',
        bookmarks: 'ブックマーク・参考ソース',
        polls: '投票・日程調整',
        deliverables: '提出物フォルダ',
        teamwork: 'チームワーク形成',
        'tech-core': '技術コア開発',
        bmc: 'ビジネス分析'
    };
    document.getElementById('view-title').textContent = titles[viewId] || 'PBL2 Manager';

    if (viewId === 'polls') {
        renderPollList();
        renderActivePoll();
    }
    if (viewId === 'mindmap' && typeof MindMapModule !== 'undefined') {
        const savedGlobal = localStorage.getItem('mindmap_data_v1');
        MindMapModule.resetToGlobal();
        if (!savedGlobal) {
            MindMapModule.loadData(null, state.themeName || 'プロジェクトテーマ');
        } else {
            MindMapModule.init();
        }
    }
    if (viewId === 'gantt') renderGantt();
    if (viewId === 'members') { renderMemberList(); renderRoleGuide(); }
    if (viewId === 'deliverables') renderDeliverables('root');

    if (viewId === 'reports') {
        const activeTab = document.querySelector('.report-tab.active');
        if (activeTab) {
            const currentTab = activeTab.getAttribute('data-report');
            if (currentTab === 'work-report') loadWorkReport();
            else if (currentTab === 'analysis-report') loadAnalysisReport();
            else if (currentTab === 'contribution') loadContributionSurvey();
        } else {
            // Fallback for when tabs are removed: check which content is currently active
            if (document.getElementById('report-contribution').classList.contains('active')) {
                loadContributionSurvey();
            } else if (document.getElementById('report-analysis-report').classList.contains('active')) {
                loadAnalysisReport();
            } else {
                loadWorkReport();
            }
        }
    }
    if (viewId === 'messages') {
        state.lastMessagesCheckTime = Date.now();
        // Maybe default to 'general' if currentTopicId is invalid
        if (!state.currentTopicId) state.currentTopicId = 'general';
        if (!state.topics) state.topics = [{ id: 'general', name: '全般', createdBy: 'system', timestamp: 0 }];

        const topic = state.topics.find(t => t.id === state.currentTopicId);
        if (topic) {
            const titleEl = document.getElementById('current-topic-name');
            if (titleEl) titleEl.textContent = topic.name;
        }

        markMessagesAsRead();
        saveState();
        updateMessageNotification();
        renderTopics();
        renderMessages(); // This will render messages for currentTopicId
        scrollToBottomMessages();
    }

    if (viewId === 'bookmarks') {
        renderBookmarks();
    }
    if (viewId === 'teamwork') {
        renderTeamwork();
    }
    if (viewId === 'tech-core') {
        initTechCanvas();
    }
    if (viewId === 'bmc') {
        renderBMC();
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.report-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-report') === tabId);
    });
    document.querySelectorAll('.report-content').forEach(c => {
        c.classList.toggle('active', c.id === `report-${tabId}`);
    });

    const viewTitle = document.getElementById('view-title');
    if (tabId === 'work-report') {
        loadWorkReport();
        updateHeaderAvatars('group');
    } else if (tabId === 'analysis-report') {
        if (viewTitle) viewTitle.textContent = '課題設定レポート';
        loadAnalysisReport();
        updateHeaderAvatars('group');
    } else if (tabId === 'contribution') {
        if (viewTitle) viewTitle.textContent = '貢献度調査';
        if (!currentContributionKey) {
            currentContributionKey = 'contribution_13'; // Default fallback
        }
        loadContributionSurvey();
        updateHeaderAvatars('individual');
    } else if (tabId === 'reflection') {
        if (viewTitle) viewTitle.textContent = '振り返りシート';
        if (!currentReflectionKey) {
            currentReflectionKey = 'feedback_13'; // Default fallback
        }
        loadReflectionSheet();
        updateHeaderAvatars('individual');
    } else if (tabId === 'mutual') {
        if (viewTitle) viewTitle.textContent = '相互評価シート';
        if (!currentMutualKey) {
            currentMutualKey = 'group_eval_13'; // Default fallback
        }
        loadMutualEvaluation();
        updateHeaderAvatars('individual');
    }
}

function toggleMembersLock() {
    if (state.membersLocked || state.isConfigLocked) {
        // Unlocking requirements
        unlockConfigWithPassword();
    } else {
        // Locking
        if (confirm('メンバー登録を固定しますか？固定すると編集ができなくなります。')) {
            state.membersLocked = true;
        }
    }
    saveState();
    renderMemberList();
    updateLockUI();
}

/** 初期設定項目のロック解除（パスワード入力） */
function unlockConfigWithPassword() {
    const pass = prompt('ロックを解除するには管理者用パスワードを入力してください (パスワード: pbl2)');
    if (pass === 'pbl2') {
        state.isConfigLocked = false;
        state.membersLocked = false;
        saveState();
        updateDisplayInfo();
        renderMemberList();
        updateLockUI();
        alert('編集ロックを解除しました。');
    } else if (pass !== null) {
        alert('パスワードが正しくありません。');
    }
}

function updateLockUI() {
    const btnText = document.getElementById('lock-btn-text');
    const btnIcon = document.querySelector('#btn-lock-members i');
    const lockBtn = document.getElementById('btn-lock-members');
    const addBtn = document.getElementById('btn-add-member');

    if (state.membersLocked) {
        if (btnText) btnText.textContent = '解除する';
        if (btnIcon) {
            btnIcon.setAttribute('data-lucide', 'lock');
            if (window.lucide) lucide.createIcons();
        }
        lockBtn.classList.replace('btn-secondary', 'btn-primary');
        addBtn.style.display = 'none';
    } else {
        if (btnText) btnText.textContent = '固定する';
        if (btnIcon) {
            btnIcon.setAttribute('data-lucide', 'unlock');
            if (window.lucide) lucide.createIcons();
        }
        lockBtn.classList.replace('btn-primary', 'btn-secondary');
        addBtn.style.display = 'flex';
    }
}

// --- Member Logic ---
function renderMemberList() {
    const listContainer = document.getElementById('member-list-container');
    listContainer.innerHTML = '';

    updateLockUI();

    const anySelf = state.members.some(m => m.isSelf);

    state.members.forEach((member, index) => {
        const card = document.createElement('div');
        card.className = 'member-card card';
        if (member.isSelf) {
            card.style.cssText = 'border: 2px solid var(--primary); box-shadow: 0 0 0 3px var(--primary-glow);';
        }

        const roleOptions = MEMBER_ROLES.map(role =>
            `<option value="${role.title}" ${member.role === role.title ? 'selected' : ''}>${role.title}</option>`
        ).join('');

        const courseOptions = BASE_COURSES.map(course =>
            `<option value="${course}" ${member.course === course ? 'selected' : ''}>${course}</option>`
        ).join('');

        const fullName = `${member.lastName || ''}${member.firstName || ''}`.trim();
        const initials = fullName ? fullName.slice(0, 1) : '?';
        const avatarColor = member.avatarColor || AVATAR_COLORS[index % AVATAR_COLORS.length];
        const teamsLink = member.emailLocal ? `https://teams.microsoft.com/l/chat/0/0?users=${member.emailLocal}@st.omu.ac.jp` : null;
        const hasImage = !!member.avatarImage;

        // Avatar inner: photo or initials
        const avatarInner = hasImage
            ? `<img src="${member.avatarImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`
            : initials;
        const avatarBg = hasImage ? 'transparent' : avatarColor;
        const avatarShadow = hasImage ? '0 2px 8px rgba(0,0,0,0.3)' : `0 2px 8px ${avatarColor}55`;

        const deleteBtn = hasImage ? `<button onclick="removeAvatarImage(${index}); event.stopPropagation();" style="position:absolute; top:-2px; right:-2px; width:18px; height:18px; border-radius:50%; background:#ef4444; color:white; border:2px solid var(--bg-card); display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10; padding:0;"><i data-lucide="x" style="width:10px;height:10px;"></i></button>` : '';

        const isLocked = state.membersLocked;

        const canEditAvatar = member.isSelf || (!(isLocked || state.isConfigLocked) && !anySelf);

        card.innerHTML = `
            <input type="file" id="avatar-input-${index}" name="avatarInput" aria-label="アバターアップロード" accept="image/*" style="display:none" onchange="setAvatarImage(${index}, this)">
            <div class="member-card-smart ${isLocked ? 'locked' : ''} ${anySelf && !member.isSelf ? 'avatar-readonly' : ''}">
                <div class="smart-row-top">
                    <div class="smart-avatar-container" ${canEditAvatar ? `onclick="document.getElementById('avatar-input-${index}').click()" oncontextmenu="clearAvatarImage(${index}); return false;"` : ''}>
                        <div class="smart-avatar" style="background:${avatarBg};">
                            ${avatarInner}
                            ${canEditAvatar ? `
                            <div class="smart-avatar-hover">
                                <i data-lucide="camera" style="width:10px;height:10px;color:white;"></i>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="smart-identity-area">
                        <div class="smart-name-line">
                            <div class="smart-name-inputs">
                                <input type="text" value="${member.lastName || ''}" onchange="updateMember(${index}, 'lastName', this.value)" aria-label="苗字" placeholder="姓" class="smart-name-input" ${(isLocked || state.isConfigLocked) ? 'readonly' : ''}>
                                <input type="text" value="${member.firstName || ''}" onchange="updateMember(${index}, 'firstName', this.value)" aria-label="名前" placeholder="名" class="smart-name-input" ${(isLocked || state.isConfigLocked) ? 'readonly' : ''}>
                            </div>
                            <div class="smart-actions-mini">
                                ${teamsLink ? `<a href="${teamsLink}" target="_blank" class="mini-btn teams"><i data-lucide="messages-square"></i></a>` : ''}
                                ${!(isLocked || state.isConfigLocked) ? `<button class="mini-btn delete" onclick="removeMember(${index})"><i data-lucide="trash-2"></i></button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="smart-row-middle">
                    <div class="smart-email-field">
                        <div class="smart-self-indicator ${member.isSelf ? 'active' : ''}" onclick="setSelf(${index})" title="${member.isSelf ? '解除' : '自分として設定'}">
                            ${member.isSelf ? '自分' : 'メンバー'}
                        </div>
                        <input type="text" value="${member.emailLocal || ''}" onchange="updateMember(${index}, 'emailLocal', this.value)" aria-label="学籍番号(ID部分)" placeholder="学籍番号" style="margin-left: 4px;">
                        <span class="email-domain">@st.omu.ac.jp</span>
                    </div>
                </div>

                <div class="smart-row-bottom">
                    <select class="smart-select" onchange="updateMember(${index}, 'course', this.value)" aria-label="コース選択" ${(isLocked || state.isConfigLocked) ? 'disabled' : ''}>
                        <option value="">コース選択</option>
                        ${courseOptions}
                    </select>
                    <select class="smart-select" onchange="updateMember(${index}, 'role', this.value)" aria-label="役割選択" ${isLocked ? 'disabled' : ''}>
                        <option value="">役割選択</option>
                        ${roleOptions}
                    </select>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
    lucide.createIcons();
}

/** Mark one member as 'self', clear others */
function setSelf(index) {
    state.members.forEach((m, i) => m.isSelf = (i === index) ? !m.isSelf : false);
    saveState();
    renderMemberList();
    updateMessageNotification(); // Update badges when "Self" identity changes
}

/** Cycle avatar color (used as fallback) */
function cycleAvatarColor(index) {
    const AVATAR_COLORS = [
        '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
        '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'
    ];
    const current = state.members[index].avatarColor || AVATAR_COLORS[index % AVATAR_COLORS.length];
    const currentIdx = AVATAR_COLORS.indexOf(current);
    state.members[index].avatarColor = AVATAR_COLORS[(currentIdx + 1) % AVATAR_COLORS.length];
    saveState();
    renderMemberList();
}

/** Set avatar image from file input (base64) */
function setAvatarImage(index, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        state.members[index].avatarImage = await compressImage(e.target.result, 300, 300, 0.4);
        saveState();
        renderMemberList();
    };
    reader.readAsDataURL(file);
}

/** Remove avatar image on right-click */
function clearAvatarImage(index) {
    state.members[index].avatarImage = null;
    saveState();
    renderMemberList();
}

function addMemberRow() {
    if (state.membersLocked) {
        alert('メンバー登録は固定されています。解除してから操作してください。');
        return;
    }
    state.members.push({
        id: generateId(),
        lastName: '',
        firstName: '',
        emailLocal: '',
        course: '',
        role: '',
        isSelf: false,
        updatedAt: new Date().toISOString()
    });
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

        const emails = targetMembers.map(m => `${m.emailLocal} @st.omu.ac.jp`);

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
    // Config lock only blocks lastName/firstName. role/email/isSelf should be free.
    const isName = (key === 'lastName' || key === 'firstName');
    if (state.isConfigLocked && isName) return;
    if (state.membersLocked && isName) return;

    state.members[index][key] = value;
    state.members[index].updatedAt = new Date().toISOString();
    saveState();
    renderMemberList();
    updateDisplayInfo();
};

window.removeMember = (index) => {
    if (state.membersLocked) return;
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
    const schedule = state.schedule || DEFAULT_SCHEDULE;
    for (let i = 0; i < schedule.length; i++) {
        if (schedule[i].date <= todayStr) {
            currentIteration = schedule[i].id;
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
        const event = (state.schedule || DEFAULT_SCHEDULE)[i - 1];
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

        // Find if this session (i) has a special event in schedule
        // state.schedule (or DEFAULT_SCHEDULE) has 28 entries, we map them carefully
        const event = (state.schedule || DEFAULT_SCHEDULE)[i - 1];
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
            else if (event.label.includes('テーマ決定')) shortLabel = 'テーマ決定';

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
    const targets = state.deliverableTargets || DEFAULT_DELIVERABLE_TARGETS;

    const deliverableGroups = [
        { id: 'effort', name: '取り組み', color: '#ef4444', items: DELIVERABLE_MASTER_LIST.filter(d => d.group === 'effort') },
        { id: 'presentation', name: '発表成果', color: '#f59e0b', items: DELIVERABLE_MASTER_LIST.filter(d => d.group === 'presentation') }
    ];

    deliverableGroups.forEach(group => {
        // Category Header
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
        headerGrid.className = 'gantt-grid bg-white/5';
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

        group.items.forEach(item => {
            const labelCell = document.createElement('div');
            labelCell.className = 'gantt-label deliverable-label task-link';
            labelCell.style.borderLeftColor = group.color;
            labelCell.title = `${item.name}を開く`;
            labelCell.innerHTML = `
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</span>
                <i data-lucide="external-link" style="width:10px; height:10px; opacity:0.3; margin-left:4px;"></i>
            `;
            labelCell.onclick = () => gotoDeliverable(item.id);
            ganttTable.appendChild(labelCell);

            const gridCell = document.createElement('div');
            gridCell.className = 'gantt-grid';

            // Target mapping
            const targetKeyMap = {
                reports: 'report',
                assignment: 'analysis',
                contribution: 'contribution',
                poster: 'poster',
                leaflet: 'leaflet',
                group_eval: 'mutual',
                feedback: 'reflection',
                pamphlet: 'pamphlet',
                slides: 'slides'
            };
            const targetKey = targetKeyMap[item.id];
            const itemTargets = targetKey === 'report' ? null : targets[targetKey];

            for (let i = 1; i <= 28; i++) {
                const cell = document.createElement('div');
                cell.className = 'gantt-cell';
                if (i === 13) cell.classList.add('semester-border');
                if (i === 12) cell.classList.add('exam-border-final');
                if (i === 7 || i === 20) cell.classList.add('exam-border-mid');
                if (i === 27) cell.classList.add('exam-border-final');
                if (i === currentIteration) cell.classList.add('is-today');

                if (item.id === 'reports') {
                    if (i >= targets.workReportStart) {
                        const r = state.reports[i];
                        const isSub = !!r?.submitted;
                        const hasD = !!r?.content && !isSub;
                        const marker = document.createElement('div');
                        marker.className = `report-marker ${isSub ? 'submitted' : (hasD ? 'draft' : 'pending')} category-effort`;
                        if (isSub) marker.innerHTML = '<i data-lucide="check"></i>';
                        else if (hasD) marker.innerHTML = '<span class="dot-icon">●</span>';
                        marker.title = `第${i}回 報告書: ${isSub ? '提出済' : (hasD ? '下書き' : '未作成')}`;
                        marker.onclick = (e) => { e.stopPropagation(); switchView('reports'); switchTab('work-report'); openWorkReport(i); };
                        cell.appendChild(marker);
                    }
                } else if (itemTargets) {
                    const isTarget = Array.isArray(itemTargets) ? itemTargets.includes(i) : itemTargets === i;
                    if (isTarget) {
                        const storageKey = Array.isArray(itemTargets) ? `${item.id}_${i}` : (item.tabId || item.id);
                        let isSub = false;
                        let hasD = false;

                        if (item.artifactKey) {
                            const sets = state.artifactSettings?.[item.artifactKey];
                            isSub = !!sets?.submitted;
                            hasD = !isSub && !!sets?.slides?.length;
                        } else if (item.tabId) {
                            if (['contribution', 'mutual'].includes(item.tabId)) {
                                const rg = state.reports[storageKey];
                                const mc = (state.members || []).length;
                                if (rg && mc > 0) {
                                    let subCount = 0; let startCount = 0;
                                    (state.members || []).forEach(m => {
                                        const ur = rg[m.id];
                                        if (ur) {
                                            if (ur.submitted) subCount++;
                                            if (ur.content || (ur.ratings && Object.keys(ur.ratings).length)) startCount++;
                                        }
                                    });
                                    isSub = subCount >= mc;
                                    hasD = !isSub && startCount > 0;
                                }
                            } else {
                                const r = state.reports[item.tabId];
                                isSub = !!r?.submitted;
                                hasD = !isSub && !!r?.content;
                            }
                        }

                        const marker = document.createElement('div');
                        const catClass = group.id === 'effort' ? 'category-effort' : 'category-presentation';
                        marker.className = `report-marker ${isSub ? 'submitted' : (hasD ? 'draft' : 'pending')} ${catClass}`;
                        if (isSub) marker.innerHTML = '<i data-lucide="check"></i>';
                        else if (hasD) marker.innerHTML = '<span class="dot-icon">●</span>';
                        marker.onclick = (e) => { e.stopPropagation(); gotoDeliverable(item.id, i); };
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
            labelCell.onclick = () => openTaskModal(taskIndex);
            labelCell.ondblclick = () => openTaskModal(taskIndex);
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

            const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
            const makeAvatarHtml = (fullName, memberIdx) => {
                const m = state.members.find(mb => `${mb.lastName || ''} ${mb.firstName || ''} `.trim() === fullName)
                    || state.members[memberIdx];
                if (!m) return `<span style="font-size:10px;">${fullName.split(' ')[0]}</span>`;
                const idx = state.members.indexOf(m);
                const color = m.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const initial = (m.lastName || '?').slice(0, 1);
                const inner = m.avatarImage
                    ? `<img src="${m.avatarImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`
                    : `<span style="font-size:9px;font-weight:700;color:white;line-height:1;">${initial}</span>`;
                return `<div title="${fullName}" style="
                        width: 22px; height: 22px; border-radius: 50%;
                        background:${m.avatarImage ? 'transparent' : color};
                        display: inline-flex; align-items: center; justify-content: center;
                        border: 2px solid rgba(255, 255, 255, 0.3);
                        overflow: hidden; flex-shrink: 0; margin-left: -6px;
                        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
                        ">${inner}</div>`;
            };

            const assigneeList = Array.isArray(task.assignees) ? task.assignees : (task.assignee ? [task.assignee] : []);
            const avatarHtml = assigneeList.length > 0
                ? `<div style="display:flex;align-items:center;gap:0;margin-left:6px;">${assigneeList.map((n, i) => makeAvatarHtml(n, i)).join('')}</div>`
                : '';

            bar.innerHTML = task.completed
                ? `<i data-lucide="check-circle-2" style="width:13px;height:13px;flex-shrink:0;"></i>${avatarHtml}`
                : avatarHtml;
            bar.style.display = 'flex';
            bar.style.alignItems = 'center';
            bar.style.gap = '2px';
            bar.style.paddingLeft = '6px';

            bar.onclick = () => openTaskModal(taskIndex);
            bar.ondblclick = () => openTaskModal(taskIndex);

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
            const roleLabel = roleInfo ? roleInfo.title : (m.role || '役割未設定');

            const item = document.createElement('div');
            item.className = 'checkbox-item';

            const isChecked = currentAssignees.includes(fullName);

            item.innerHTML = `
                <input type="checkbox" id="assignee-${idx}" name="assignee" value="${fullName}" data-role="${m.role || ''}" ${isChecked ? 'checked' : ''}>
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
                    MindMapModule.init(container);
                    // Use task name if already entered, otherwise a placeholder
                    const taskName = nameInput.value.trim() || 'タスク名を入力してください';
                    MindMapModule.loadData(null, taskName);
                    // Auto-add first child node (as if user pressed Add Child)
                    setTimeout(() => {
                        MindMapModule.addChildToRoot();
                    }, 400);
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
                    // Pass assigned members to mind map for context menu filtering
                    const currentTask = state.tasks[editingTaskIndex];
                    let assigneeIndices = [];
                    if (currentTask) {
                        if (Array.isArray(currentTask.assignees)) {
                            // Map names back to indices
                            assigneeIndices = currentTask.assignees.map(name => {
                                return state.members.findIndex(m =>
                                    `${m.lastName || ''} ${m.firstName || ''} `.trim() === name
                                );
                            }).filter(i => i !== -1);
                        } else if (currentTask.assignee) {
                            const idx = state.members.findIndex(m =>
                                `${m.lastName || ''} ${m.firstName || ''} `.trim() === currentTask.assignee
                            );
                            if (idx !== -1) assigneeIndices.push(idx);
                        }
                    }
                    if (MindMapModule.setAssigneeFilter) {
                        MindMapModule.setAssigneeFilter(assigneeIndices);
                    }

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

// --- Utility: ID Generator ---
function generateId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

function migrateData(data) {
    if (!data) return data;
    const now = new Date().toISOString();

    // Ensure state object structure
    if (!data.tasks) data.tasks = [];
    if (!data.reports) data.reports = {};
    if (!data.artifactSettings) data.artifactSettings = {};
    if (data.schedule === undefined || (data.schedule && data.schedule.length === 0)) {
        // Only fallback if we don't have an empty array (meaning it was just reset)
        // Actually, if we want it to stay empty, we should check if it was initialized.
        // For now, let's just trust state.schedule being [] means empty.
    }
    if (data.isConfigLocked === undefined) data.isConfigLocked = false;
    if (data.companyName === undefined) data.companyName = '';
    if (data.deliverableTargets === undefined) data.deliverableTargets = DEFAULT_DELIVERABLE_TARGETS;
    if (data.polls === undefined) data.polls = [];
    if (data.currentPollId === undefined) data.currentPollId = null;

    // Tasks
    if (Array.isArray(data.tasks)) {
        data.tasks.forEach(t => {
            if (!t.uuid) t.uuid = generateId();
            if (!t.updatedAt) t.updatedAt = now;
        });
    }
    // Members
    if (Array.isArray(data.members)) {
        data.members.forEach(m => {
            if (!m.id) m.id = generateId();
            if (!m.updatedAt) m.updatedAt = now;
        });
    }
    // Reports
    if (data.reports) {
        Object.keys(data.reports).forEach(key => {
            if (data.reports[key] && !data.reports[key].updatedAt) {
                data.reports[key].updatedAt = now;
            }
        });
    }
    // Supervising Instructors
    if (!data.supervisingInstructors || !Array.isArray(data.supervisingInstructors)) {
        data.supervisingInstructors = [
            { lastName: '', firstName: '', emailLocal: '' },
            { lastName: '', firstName: '', emailLocal: '' }
        ];
    } else {
        // Ensure it has 2 entries and fields
        while (data.supervisingInstructors.length < 2) {
            data.supervisingInstructors.push({ lastName: '', firstName: '', emailLocal: '' });
        }
        data.supervisingInstructors.forEach(p => {
            if (p.emailLocal === undefined) p.emailLocal = '';
        });
    }

    return data;
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            state = JSON.parse(saved);
            state = migrateData(state); // Ensure IDs exist
        } catch (e) {
            console.error('State load error', e);
            state.schedule = DEFAULT_SCHEDULE;
        }
    } else {
        state.schedule = DEFAULT_SCHEDULE;
        state = migrateData(state);
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

// ... (in updateDisplayInfo etc)

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

    const now = new Date().toISOString();
    // Preserve existing UUID or generate new
    let uuid = generateId();
    let createdAt = now;

    if (editingTaskIndex !== -1) {
        const existing = state.tasks[editingTaskIndex];
        uuid = existing.uuid || uuid;
        createdAt = existing.createdAt || now;
    }

    const taskData = {
        name, category, start, end, assignees, completed, processFlow,
        uuid,
        updatedAt: now,
        createdAt
    };

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
    // Redirect to the new Board View instead of opening a modal
    switchView('deliverables');
    renderArtifactBoard();
    openArtifactEditor(key, name);
}

function openArtifactEditor(key, name) {
    currentArtifactKey = key;
    currentSlideIndex = -1;

    // Show Editor, hide board and folder content
    document.getElementById('deliverables-content').style.display = 'none';
    document.getElementById('deliverables-board').style.display = 'none';
    document.getElementById('deliverables-editor').style.display = 'flex';

    document.getElementById('board-editor-title').textContent = `${name} 詳細編集`;

    const editorTopBar = document.getElementById('board-editor-top-bar');
    const modalHeaderInner = document.querySelector('#modal-artifact-detail .modal-header > div');
    if (modalHeaderInner && !editorTopBar.contains(modalHeaderInner)) {
        editorTopBar.appendChild(modalHeaderInner);
        // Hide redundant title in the moved header
        const oldTitle = modalHeaderInner.querySelector('h3');
        if (oldTitle) oldTitle.style.display = 'none';
    }

    const editorContent = document.getElementById('board-editor-content');
    const modalContent = document.querySelector('#modal-artifact-detail .artifact-detail-grid');

    if (modalContent && !editorContent.contains(modalContent)) {
        editorContent.appendChild(modalContent);
    }

    if (!state.artifactSettings) state.artifactSettings = {};
    if (!state.artifactSettings[key]) {
        state.artifactSettings[key] = { slides: [], submitted: false };
    }
    const data = state.artifactSettings[key];

    renderArtifactSlides();
    renderArtifactMemberList();

    // For current slide's presenters
    renderArtifactPresenterChecks();
    renderContributorChart();

    // Reset viewer
    document.getElementById('hotspot-container').style.display = 'none';
    document.getElementById('presenters-section').style.display = 'none';
    document.getElementById('viewer-placeholder').style.display = 'block';

    applyArtifactLockState(data.submitted, data.submittedAt);

    document.getElementById('btn-board-draft-artifact').onclick = () => {
        saveArtifactData();
        showDeliverablesBoard();
    };
    document.getElementById('btn-board-submit-artifact').onclick = () => {
        submitArtifactData();
        showDeliverablesBoard();
    };
    document.getElementById('btn-board-close-editor').onclick = () => {
        showDeliverablesBoard();
    };

    if (window.lucide) window.lucide.createIcons();
}

function showDeliverablesBoard() {
    document.getElementById('deliverables-editor').style.display = 'none';
    document.getElementById('deliverables-board').style.display = 'flex';
    document.getElementById('deliverables-content').style.display = 'none';
    renderArtifactBoard();
}

function renderArtifactBoard() {
    const board = document.getElementById('deliverables-board');
    const grid = document.getElementById('artifact-board-grid');
    if (!board || !grid) return;

    grid.innerHTML = '';

    const ARTIFACT_DEFS = [
        { key: 'poster', name: '事業企画ポスター（中間発表）', icon: 'image', color: '#4f46e5', desc: 'A1サイズ・縦' },
        { key: 'leaflet', name: '事業企画リーフレット（中間発表）', icon: 'file-text', color: '#0ea5e9', desc: 'A4三つ折り・両面' },
        { key: 'pamphlet_25', name: '製品・サービスパンフレット（最終発表）', icon: 'book-open', color: '#10b981', desc: 'A4・4P構成' },
        { key: 'slides_25', name: '最終プレゼンスライド（最終発表）', icon: 'presentation', color: '#f59e0b', desc: '10〜15枚程度' }
    ];

    ARTIFACT_DEFS.forEach(def => {
        const data = state.artifactSettings?.[def.key] || { slides: [], submitted: false };
        const slides = Array.isArray(data.slides) ? data.slides : [];
        const hasDraft = slides.length > 0;
        const isSubmitted = !!data.submitted;

        const card = document.createElement('div');
        card.className = 'artifact-board-card';

        const statusLabel = isSubmitted ? '提出済' : (hasDraft ? '作成中' : '未着手');
        const statusClass = isSubmitted ? 'status-submitted' : (hasDraft ? 'status-draft' : 'status-pending');

        // Presenters preview
        let presenterAvatarsHTML = '';
        if (hasDraft) {
            const allPresenters = new Set();
            slides.forEach(s => {
                if (s && Array.isArray(s.presenters)) {
                    s.presenters.forEach(p => {
                        if (p !== undefined && p !== null) allPresenters.add(p);
                    });
                }
            });
            Array.from(allPresenters).slice(0, 3).forEach(pId => {
                const m = state.members && state.members[pId];
                if (m) {
                    const initial = (m.lastName || '?').charAt(0);
                    presenterAvatarsHTML += `<div class="mini-avatar" title="${escapeHtml(m.lastName || '')}">${escapeHtml(initial)}</div>`;
                }
            });
            if (allPresenters.size > 3) {
                presenterAvatarsHTML += `<div class="mini-avatar" style="background:#555">+${allPresenters.size - 3}</div>`;
            }
        }

        const previewImg = (hasDraft && slides[0].src) ? slides[0].src : '';

        card.innerHTML = `
            <div class="card-status-badge ${statusClass}">${statusLabel}</div>
            <div class="card-main-info">
                <div class="card-icon-box" style="background: ${def.color}22; color: ${def.color}">
                    <i data-lucide="${def.icon}"></i>
                </div>
                <div class="card-title-group">
                    <h3 style="font-size: 1.05rem; margin:0;">${escapeHtml(def.name)}</h3>
                    <p style="font-size: 0.75rem; color: var(--text-dim); margin:0;">${escapeHtml(def.desc)}</p>
                </div>
            </div>
            <div class="thumbnail-preview" onclick="openArtifactEditor('${def.key}', '${escapeHtml(def.name)}')" style="cursor:pointer;">
                ${previewImg ? `<img src="${previewImg}" alt="Preview" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">` : `
                    <div class="thumbnail-empty">
                        <i data-lucide="image-plus" style="width:24px; height:24px; opacity:0.3;"></i>
                        <span>構成案を追加</span>
                    </div>
                `}
            </div>
            <div class="card-meta">
                <div style="display:flex; align-items:center;">
                    <span style="opacity:0.6; font-size: 0.8rem;">担当:</span>
                    <div class="presenter-avatars">${presenterAvatarsHTML || '<span style="margin-left:5px; opacity:0.4;">--</span>'}</div>
                </div>
                <div style="opacity:0.6; font-size: 0.8rem;">${slides.length} 枚</div>
            </div>
            <button class="btn-card-action" onclick="openArtifactEditor('${def.key}', '${escapeHtml(def.name)}')" style="width:100%;">
                <i data-lucide="edit-3"></i> 詳細設定・構成
            </button>
        `;

        grid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
}

/** Open the detailed artifact setup modal (e.g. for Poster) */
// This function is now replaced by openArtifactEditor, but keeping it for context if needed.
// function openArtifactModal(key, name) {
//     currentArtifactKey = key;
//     currentSlideIndex = -1;
//     document.getElementById('artifact-modal-title').textContent = `${name} 詳細設定`;

//     // Initialize data if not exists
//     if (!state.artifactSettings) state.artifactSettings = {};
//     if (!state.artifactSettings[key]) {
//         state.artifactSettings[key] = { slides: [], submitted: false };
//     }
//     const data = state.artifactSettings[key];

//     renderArtifactSlides();
//     renderArtifactMemberList();

//     // Reset viewer
//     document.getElementById('hotspot-container').style.display = 'none';
//     document.getElementById('presenters-section').style.display = 'none';
//     document.getElementById('viewer-placeholder').style.display = 'block';

//     // Apply Locking
//     applyArtifactLockState(data.submitted, data.submittedAt);

//     document.getElementById('modal-artifact-detail').classList.add('active');
//     renderContributorChart();
//     if (window.lucide) lucide.createIcons();
// }

/** Apply or remove the locked state on the artifact modal */
function applyArtifactLockState(isLocked, submittedAt) {
    // This function now applies to the editor view, not a modal
    const editor = document.getElementById('deliverables-editor');
    const banner = document.getElementById('artifact-submitted-banner');
    const atEl = document.getElementById('artifact-submitted-at');
    const footerBtns = document.getElementById('artifact-modal-footer-btns'); // These buttons are now in the editor footer

    // Controls to disable
    const controls = [
        document.getElementById('btn-add-artifact-slide'),
        document.getElementById('btn-draft-artifact-data'), // This is the old modal draft button
        document.getElementById('btn-submit-artifact-data'), // This is the old modal submit button
        document.getElementById('btn-clear-hotspots'),
        document.getElementById('btn-clear-all-hotspots'),
        document.getElementById('btn-board-draft-artifact'), // New editor draft button
        document.getElementById('btn-board-submit-artifact') // New editor submit button
    ];

    if (isLocked) {
        editor.classList.add('locked');
        if (banner) banner.style.display = 'flex';
        if (atEl && submittedAt) {
            atEl.textContent = `提出日時: ${new Date(submittedAt).toLocaleString('ja-JP')}`;
        }
        controls.forEach(c => { if (c) c.style.display = 'none'; });
        // Enable Rich Editor readonly if possible, or just overlay
        const scriptArea = document.getElementById('artifact-presentation-script');
        if (scriptArea) scriptArea.contentEditable = "false";
    } else {
        editor.classList.remove('locked');
        if (banner) banner.style.display = 'none';
        controls.forEach(c => { if (c) c.style.display = 'flex'; });
        // Restore buttons that were 'flex' originally
        const addSlideBtn = document.getElementById('btn-add-artifact-slide');
        if (addSlideBtn) addSlideBtn.style.display = 'block';
        const scriptArea = document.getElementById('artifact-presentation-script');
        if (scriptArea) scriptArea.contentEditable = "true";
    }
}

/** Close the artifact modal */
function closeArtifactModal() {
    // This function is now replaced by showDeliverablesBoard()
    // document.getElementById('modal-artifact-detail').classList.remove('active');
    showDeliverablesBoard();
}

/** Clear all presenter assignments for the current slide */
function clearSlidePresenters() {
    if (currentSlideIndex === -1) {
        alert('スライドを選択してください。'); return;
    }
    if (!confirm('このスライドの発表担当者を全員クリアしますか？')) return;
    const slide = state.artifactSettings[currentArtifactKey].slides[currentSlideIndex];
    slide.presenters = [];
    renderArtifactPresenterChecks();
    renderArtifactSlides();
    renderContributorChart();
}

/** Clear all hotspot assignments for the current slide */
function clearSlideHotspots() {
    if (currentSlideIndex === -1) {
        alert('スライドを選択してください。'); return;
    }
    if (!confirm('このスライドの作成担当者（矩形）を全てクリアしますか？')) return;
    const slide = state.artifactSettings[currentArtifactKey].slides[currentSlideIndex];
    slide.hotspots = [];
    renderHotspots();
    renderContributorChart();
}

/** Clear ALL slides' hotspots AND presenters for the current artifact */
function clearAllSlidesAssignments() {
    if (!currentArtifactKey) return;
    if (!confirm('全スライドの発表担当者・作成担当者（矩形）を全てクリアしますか？\nこの操作は取り消せません。')) return;
    const slides = state.artifactSettings[currentArtifactKey].slides || [];
    slides.forEach(slide => {
        slide.hotspots = [];
        slide.presenters = [];
    });
    renderArtifactPresenterChecks();
    renderArtifactSlides();
    renderContributorChart();
    renderHotspots();
}

/** Remove all slides from the current artifact */
function clearAllArtifactSlides() {
    if (!state.artifactSettings[currentArtifactKey] || !state.artifactSettings[currentArtifactKey].slides) return;
    if (state.artifactSettings[currentArtifactKey].slides.length === 0) return;

    if (!confirm('この提出物のすべてのスライドと担当設定を完全に削除しますか？\n(削除後、元に戻すことはできません)')) return;

    state.artifactSettings[currentArtifactKey].slides = [];
    currentSlideIndex = -1;

    saveState();
    renderArtifactSlides();
    renderContributorChart();

    // Reset viewer
    const img = document.getElementById('artifact-current-image');
    const container = document.getElementById('hotspot-container');
    const placeholder = document.getElementById('viewer-placeholder');
    if (img) img.src = '';
    if (container) container.style.display = 'none';
    const presSection = document.getElementById('presenters-section');
    if (presSection) presSection.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
}

/** Shared: build a small avatar circle for a member by index */
function memberAvatarHtml(memberIndex, size = 22) {
    const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
    const m = state.members[memberIndex];
    if (!m) return '';
    const color = m.avatarColor || AVATAR_COLORS[memberIndex % AVATAR_COLORS.length];
    const initial = (m.lastName || '?').slice(0, 1);
    const inner = m.avatarImage
        ? `<img src="${m.avatarImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`
        : `<span style="font-size:${Math.floor(size * 0.42)}px;font-weight:700;color:white;line-height:1;">${initial}</span>`;
    return `<div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${m.avatarImage ? '#00000022' : color};
        display:inline-flex;align-items:center;justify-content:center;
        overflow:hidden;flex-shrink:0;
        box-shadow:0 1px 4px rgba(0,0,0,0.35);
    ">${inner}</div>`;
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
        label.htmlFor = 'artifact-member-' + i;
        label.style.fontSize = '0.8rem';
        label.innerHTML = `
            <input type="radio" id="artifact-member-${i}" name="artifact-member" value="${i}" ${i === 0 ? 'checked' : ''}>
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
                reader.onload = async (ev) => {
                    const compressed = await compressImage(ev.target.result, 800, 800, 0.3);
                    state.artifactSettings[key].slides.push({
                        src: compressed,
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
            const viewport = page.getViewport({ scale: 1.2 }); // More aggressive compression

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            state.artifactSettings[artifactKey].slides.push({
                src: canvas.toDataURL('image/jpeg', 0.3), // High JPEG compression
                hotspots: []
            });
        }
    } catch (err) {
        console.error('PDF Processing Error:', err);
        alert('PDFの読み込み中にエラーが発生しました。');
    }
}

/** Export presentation scripts as a printable document */
function exportArtifactScript() {
    if (!currentArtifactKey) return;
    const settings = state.artifactSettings[currentArtifactKey];
    if (!settings || !settings.slides || settings.slides.length === 0) {
        alert('スライドがありません。');
        return;
    }

    const artifactName = (() => {
        // Try to find the artifact name
        for (const phase of Object.values(state.phases || {})) {
            for (const task of Object.values(phase.tasks || {})) {
                if (task.artifacts) {
                    for (const art of task.artifacts) {
                        if (art.key === currentArtifactKey) return art.name || '提出物';
                    }
                }
            }
        }
        return '提出物';
    })();

    const slidePages = settings.slides.map((slide, idx) => {
        const num = idx + 1;
        const script = slide.script || '';
        // Presenters
        const presenterNames = (slide.presenters || []).map(pIdx => {
            const m = state.members[pIdx];
            return m ? ((m.lastName || '') + (m.firstName || '')) : '';
        }).filter(Boolean).join('・');
        // Hotspot labels
        const hotspotItems = (slide.hotspots || []).map(hs => {
            const author = state.members[hs.authorIdx];
            const aName = author ? ((author.lastName || '') + (author.firstName || '')) : '不明';
            const label = hs.text ? `「${hs.text}」` : '';
            return `<li>${aName}${label}</li>`;
        }).join('');

        return `
        <div class="slide-page">
            <div class="slide-header">
                <span class="slide-num">スライド ${num}</span>
                ${presenterNames ? `<span class="presenter-names">発表者: ${presenterNames}</span>` : ''}
            </div>
            <div class="slide-image-wrap">
                <img src="${slide.src}" alt="スライド ${num}">
                ${hotspotItems ? `<ul class="hotspot-list">${hotspotItems}</ul>` : ''}
            </div>
            <div class="script-area">
                <div class="script-label"><i>🎤 発表内容・原稿</i></div>
                <div class="script-body">${script || '<span class="empty">（原稿未入力）</span>'}</div>
            </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>原稿出力 - ${artifactName}</title>
<style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic Pro', 'Meiryo', sans-serif;
        background: #fff;
        color: #111;
        font-size: 12pt;
        line-height: 1.7;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    h1.doc-title {
        text-align: center;
        font-size: 18pt;
        margin-bottom: 6mm;
        padding-bottom: 4mm;
        border-bottom: 2px solid #333;
        color: #222;
    }
    .slide-page {
        page-break-after: always;
        padding-bottom: 8mm;
    }
    .slide-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4mm;
        padding: 2mm 3mm;
        background: #f0f0f0;
        border-left: 4px solid #4f46e5;
        border-radius: 2px;
    }
    .slide-num {
        font-weight: 700;
        font-size: 13pt;
        color: #222;
    }
    .presenter-names {
        font-size: 10pt;
        color: #444;
    }
    .slide-image-wrap {
        text-align: center;
        margin-bottom: 5mm;
    }
    .slide-image-wrap img {
        max-width: 100%;
        max-height: 110mm;
        object-fit: contain;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .hotspot-list {
        list-style: disc;
        text-align: left;
        display: inline-block;
        margin-top: 2mm;
        padding-left: 1em;
        font-size: 9pt;
        color: #555;
    }
    .script-area {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 4mm 5mm;
        min-height: 40mm;
        background: #fafafa;
    }
    .script-label {
        font-size: 9pt;
        color: #888;
        margin-bottom: 2mm;
        border-bottom: 1px solid #eee;
        padding-bottom: 1mm;
    }
    .script-body {
        color: #111;
        font-size: 11pt;
        line-height: 1.9;
    }
    .script-body b, strong { color: #000; }
    .script-body em, i { color: #333; }
    .empty { color: #aaa; font-style: italic; }
    @media print {
        body { background: #fff !important; color: #000 !important; }
        .script-area { background: #fafafa !important; }
        .slide-header { background: #f0f0f0 !important; }
    }
</style>
</head>
<body>
<h1 class="doc-title">📋 ${artifactName} - 原稿</h1>
${slidePages}
<script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const screenW = window.screen.width;
    const screenH = window.screen.height;
    const winW = Math.min(950, screenW - 100);
    const winH = Math.min(900, screenH - 100);
    const left = Math.floor((screenW - winW) / 2);
    const top = Math.floor((screenH - winH) / 2);
    const win = window.open('', '_blank',
        `width=${winW},height=${winH},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no`);
    win.document.write(html);
    win.document.close();
}

/** Render contributor ratio bar chart in the modal footer */
function renderContributorChart() {
    const container = document.getElementById('artifact-contributor-chart');
    if (!container) return;
    if (!currentArtifactKey || !state.artifactSettings || !state.artifactSettings[currentArtifactKey]) {
        container.innerHTML = '';
        return;
    }

    const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
    const slides = state.artifactSettings[currentArtifactKey].slides || [];

    // ── 発表老E合（スライドE出演回数ベEスEE──
    const presMap = {};
    slides.forEach(slide => {
        (slide.presenters || []).forEach(idx => {
            presMap[idx] = (presMap[idx] || 0) + 1;
        });
    });
    const presTotal = Object.values(presMap).reduce((s, v) => s + v, 0);

    // ── 作成担当割合（ホットスポット面積ベース）──
    const areaMap = {};
    slides.forEach(slide => {
        (slide.hotspots || []).forEach(hs => {
            const idx = hs.authorIdx;
            const area = (hs.rect.w * hs.rect.h) / 10000;
            areaMap[idx] = (areaMap[idx] || 0) + area;
        });
    });
    const areaTotal = Object.values(areaMap).reduce((s, v) => s + v, 0);

    function buildChart(map, total, label, emptyMsg) {
        if (total === 0) {
            return `
            <div style="font-size:10px; color:var(--text-dim); font-weight:600; margin-bottom:4px;">${label}</div>
            <div style="font-size:10px; color:var(--text-dim); font-style:italic;">${emptyMsg}</div>`;
        }
        const segs = Object.entries(map).map(([idx, val]) => {
            const member = state.members[parseInt(idx)];
            const name = member ? (member.lastName || `M${idx}`) : `M${idx}`;
            const pct = Math.round((val / total) * 100);
            const color = COLORS[parseInt(idx) % COLORS.length];
            return { name, pct, color };
        }).sort((a, b) => b.pct - a.pct);

        const bars = segs.map(s =>
            `<div title="${s.name}: ${s.pct}%" style="flex:${s.pct}; background:${s.color}; height:100%; min-width:4px;"></div>`
        ).join('');
        const legend = segs.map(s =>
            `<span style="display:inline-flex; align-items:center; gap:3px; font-size:10px; color:var(--text-dim); white-space:nowrap;">
                <span style="width:7px;height:7px;border-radius:2px;background:${s.color};display:inline-block;"></span>
                ${s.name} ${s.pct}%
            </span>`
        ).join('');

        return `
        <div style="font-size:10px; color:var(--text-dim); font-weight:600; margin-bottom:4px;">${label}</div>
        <div style="display:flex; height:10px; border-radius:5px; overflow:hidden; margin-bottom:4px; gap:1px;">${bars}</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">${legend}</div>`;
    }

    const presChart = buildChart(presMap, presTotal, '🎤 発表担当割合', '未割り当て');
    const areaChart = buildChart(areaMap, areaTotal, '✏️ 作成担当割合', '未割り当て');

    container.innerHTML = `
        <div style="display:flex; gap:12px; width:100%;">
            <div style="flex:1; min-width:0; padding:6px 8px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px;">
                ${presChart}
            </div>
            <div style="flex:1; min-width:0; padding:6px 8px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px;">
                ${areaChart}
            </div>
        </div>
    `;

    // Also update global header stats
    renderHeaderGraphs();
}

/** Render tiny contributor graphs in the application header */
function renderHeaderGraphs() {
    const statsContainer = document.getElementById('header-stats');
    if (!statsContainer) return;

    if (!currentArtifactKey) {
        statsContainer.style.display = 'none';
        return;
    }

    // Use currentArtifactKey to get the stats for the currently opened artifact
    const artifactData = state.artifactSettings ? state.artifactSettings[currentArtifactKey] : null;
    if (!artifactData || !artifactData.slides || artifactData.slides.length === 0) {
        statsContainer.innerHTML = '';
        statsContainer.style.display = 'none';
        return;
    }
    statsContainer.style.display = 'flex';
    statsContainer.style.gap = '2rem';

    const slides = artifactData.slides;

    // 1. Presentation Ratio
    const presMap = {};
    slides.forEach(slide => {
        (slide.presenters || []).forEach(idx => {
            presMap[idx] = (presMap[idx] || 0) + 1;
        });
    });
    const presTotal = Object.values(presMap).reduce((s, v) => s + v, 0);

    // 2. Creation Ratio
    const areaMap = {};
    slides.forEach(slide => {
        (slide.hotspots || []).forEach(hs => {
            const idx = hs.authorIdx;
            const area = (hs.rect.w * hs.rect.h) / 10000;
            areaMap[idx] = (areaMap[idx] || 0) + area;
        });
    });
    const areaTotal = Object.values(areaMap).reduce((s, v) => s + v, 0);

    const buildChart = (map, total, label) => {
        if (total === 0) return '';
        const memberColors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];

        const segs = Object.keys(map)
            .sort((a, b) => parseInt(a) - parseInt(b)) // sort by id for legend
            .map(idxKey => {
                const val = map[idxKey];
                const idx = parseInt(idxKey);
                const color = memberColors[idx % memberColors.length];
                const pct = Math.round((val / total) * 100);
                const member = state.members[idx];
                const name = member ? (member.lastName || `M${idx}`) : `M${idx}`;
                return { name, pct, color, idx };
            }).filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct);

        const bars = Object.keys(map)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(idxKey => {
                const val = map[idxKey];
                const idx = parseInt(idxKey);
                const pct = (val / total) * 100;
                const color = memberColors[idx % memberColors.length];
                const member = state.members[idx];
                const name = member ? (member.lastName || `M${idx}`) : `M${idx}`;
                return `<div title="${name}: ${Math.round(pct)}%" style="flex:${pct}; background:${color}; height:100%;"></div>`;
            }).join('');

        const legend = segs.map(s =>
            `<span style="display:inline-flex; align-items:center; gap:3px; font-size:10px; color:var(--text-dim); white-space:nowrap;">
                <span style="width:8px;height:8px;border-radius:2px;background:${s.color};display:inline-block;"></span>
                ${s.name} ${s.pct}%
            </span>`
        ).join('');

        return `
        <div style="display:flex; flex-direction:column; gap:6px; min-width: 140px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size: 11px; font-weight:600; color:var(--text-main); white-space:nowrap;">${label}</span>
                <div style="flex:1; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; display:flex; overflow:hidden; gap:1px; width: 120px;">
                    ${bars}
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; line-height:1;">
                ${legend}
            </div>
        </div>`;
    };

    const presHtml = buildChart(presMap, presTotal, '🎤 発表担当');
    const creationHtml = buildChart(areaMap, areaTotal, '🎨 制作担当');

    statsContainer.innerHTML = `
        ${presHtml}
        ${creationHtml}
    `;
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

        const presenterAvatars = (slide.presenters || []).map(pIdx => memberAvatarHtml(pIdx, 20)).join('');
        const presentersHtml = presenterAvatars
            ? `<div class="slide-presenters-tag" style="display:flex;align-items:center;gap:2px;padding:2px 4px;">
                <i data-lucide="mic" style="width:9px;height:9px;flex-shrink:0;"></i>
                <div style="display:flex;gap:-4px;">${presenterAvatars}</div>
               </div>`
            : '';

        item.innerHTML = `
            <div class="slide-thumb ${idx === currentSlideIndex ? 'active' : ''}" onclick="selectArtifactSlide(${idx})">
                <img src="${slide.src}" alt="">
                <span class="slide-num-badge">${idx + 1}</span>
                ${presentersHtml}
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
    resetArtifactZoom(); // Reset zoom when switching slides
    renderArtifactSlides();

    const slide = state.artifactSettings[currentArtifactKey].slides[idx];
    const img = document.getElementById('artifact-current-image');
    const container = document.getElementById('hotspot-container');
    const placeholder = document.getElementById('viewer-placeholder');

    img.src = slide.src;
    container.style.display = 'block';
    document.getElementById('presenters-section').style.display = 'flex';
    placeholder.style.display = 'none';

    renderHotspots();
    renderArtifactPresenterChecks();

    // Load script content (Rich Text Support)
    const scriptArea = document.getElementById('artifact-presentation-script');
    scriptArea.innerHTML = slide.script || '';
    scriptArea.oninput = () => {
        slide.script = scriptArea.innerHTML;
    };
}

/** Render presenter checkboxes for current slide */
function renderArtifactPresenterChecks() {
    const container = document.getElementById('artifact-presenter-checks');
    if (!container || currentSlideIndex === -1) return;
    container.innerHTML = '';

    const slide = state.artifactSettings[currentArtifactKey].slides[currentSlideIndex];
    if (!slide.presenters) slide.presenters = [];

    state.members.forEach((m, i) => {
        const fullName = `${m.lastName || ''} ${m.firstName || ''}`.trim();
        if (!fullName) return;

        const isChecked = slide.presenters.includes(i);
        const label = document.createElement('label');
        label.className = 'wr-author-item';
        label.htmlFor = 'artifact-presenter-' + i;
        label.innerHTML = `
            <input type="checkbox" id="artifact-presenter-${i}" name="artifactPresenter" ${isChecked ? 'checked' : ''}>
            <span>${fullName}</span>
        `;
        const input = label.querySelector('input');
        input.onchange = () => {
            if (input.checked) {
                if (!slide.presenters.includes(i)) slide.presenters.push(i);
            } else {
                slide.presenters = slide.presenters.filter(idx => idx !== i);
            }
            renderArtifactSlides(); // Refresh thumbnails to show presenters
            renderContributorChart();
        };
        container.appendChild(label);
    });
}

/** Remove a slide from the artifact */
function removeArtifactSlide(idx) {
    if (!confirm('このスライドを削除しますか？設定した担当者等も消去されます。')) return;
    state.artifactSettings[currentArtifactKey].slides.splice(idx, 1);
    if (currentSlideIndex === idx) {
        currentSlideIndex = -1;
        document.getElementById('hotspot-container').style.display = 'none';
        document.getElementById('presenters-section').style.display = 'none';
        document.getElementById('viewer-placeholder').style.display = 'block';
    } else if (currentSlideIndex > idx) {
        currentSlideIndex--;
    }
    renderArtifactSlides();
}

/** Set up mousedown/move/up listeners for rectangle drawing */
function initHotspotLogic() {
    const viewer = document.getElementById('artifact-viewer');
    const container = document.getElementById('hotspot-container');
    const drawingRect = document.getElementById('drawing-rect');

    container.addEventListener('mousedown', (e) => {
        if (currentSlideIndex === -1) return;
        const rect = container.getBoundingClientRect();

        if (artifactEditorMode === 'drag') {
            isPanningViewer = true;
            container.style.cursor = 'grabbing';
            panStartScroll = { left: viewer.scrollLeft, top: viewer.scrollTop };
            panStartMouse = { x: e.clientX, y: e.clientY };
        } else {
            isDrawingHotspot = true;
            // Coordinates relative to the container as it is right now (with zoom)
            hotspotStartPos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            drawingRect.style.left = hotspotStartPos.x + 'px';
            drawingRect.style.top = hotspotStartPos.y + 'px';
            drawingRect.style.width = '0px';
            drawingRect.style.height = '0px';
            drawingRect.style.display = 'block';
        }

        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanningViewer) {
            const dx = e.clientX - panStartMouse.x;
            const dy = e.clientY - panStartMouse.y;
            viewer.scrollLeft = panStartScroll.left - dx;
            viewer.scrollTop = panStartScroll.top - dy;
            return;
        }

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
        if (isPanningViewer) {
            isPanningViewer = false;
            container.style.cursor = 'grab';
            return;
        }

        if (!isDrawingHotspot) return;
        isDrawingHotspot = false;
        drawingRect.style.display = 'none';

        const rect = container.getBoundingClientRect();
        // Constrain mouse coordinates to container boundaries
        const endX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const endY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

        const x1 = Math.min(hotspotStartPos.x, endX);
        const y1 = Math.min(hotspotStartPos.y, endY);
        const x2 = Math.max(hotspotStartPos.x, endX);
        const y2 = Math.max(hotspotStartPos.y, endY);

        const w = x2 - x1;
        const h = y2 - y1;

        if (w < 10 || h < 10) return; // Ignore tiny rects

        // Convert to Percentages relative to the current container size
        // Since hotspots use %, this works regardless of current zoom
        const px = (x1 / rect.width) * 100;
        const py = (y1 / rect.height) * 100;
        const pw = (w / rect.width) * 100;
        const ph = (h / rect.height) * 100;

        // Get currently selected author from radio
        const selectedRadio = document.querySelector('input[name="artifact-member"]:checked');
        const authorIdx = selectedRadio ? parseInt(selectedRadio.value) : 0;

        const currentSlide = state.artifactSettings[currentArtifactKey].slides[currentSlideIndex];
        if (!currentSlide.hotspots) currentSlide.hotspots = [];

        currentSlide.hotspots.push({
            rect: { x: px, y: py, w: pw, h: ph },
            authorIdx: authorIdx
        });

        renderHotspots();
    });
}

/** Initialize Rich Editor Toolbar for Artifacts */
function initArtifactRichEditor() {
    document.querySelectorAll('.editor-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const command = btn.getAttribute('data-command');
            document.execCommand(command, false, null);
            document.getElementById('artifact-presentation-script').focus();
        });
    });

    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            const color = swatch.getAttribute('data-color');
            document.execCommand('foreColor', false, color);
            document.getElementById('artifact-presentation-script').focus();
        });
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

        div.innerHTML = `
            <div style="position:absolute;top:-12px;left:-12px;z-index:2;pointer-events:none;">
                ${memberAvatarHtml(hs.authorIdx, 24)}
            </div>
            <div class="hotspot-label">${hs.text || ''}</div>
            <button class="hotspot-delete-btn" onclick="deleteHotspot(${idx})"><i data-lucide="x" style="width:10px;height:10px;"></i></button>
        `;

        div.ondblclick = (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.id = `hotspot-input-${idx}`;
            input.setAttribute('aria-label', '箇所の説明を入力');
            input.type = 'text';
            input.className = 'hotspot-input';
            input.value = hs.text || '';
            div.innerHTML = '';
            div.appendChild(input);
            input.focus();

            input.onblur = () => {
                hs.text = input.value;
                renderHotspots();
            };
            input.onkeydown = (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    input.blur();
                }
            };
        };

        overlay.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
    renderContributorChart();
}

/** Delete a specific hotspot from current slide */
function deleteHotspot(idx) {
    if (currentSlideIndex === -1) return;
    state.artifactSettings[currentArtifactKey].slides[currentSlideIndex].hotspots.splice(idx, 1);
    renderHotspots();
    renderContributorChart();
}

/** Save detailed artifact data as draft */
function saveArtifactData() {
    if (!currentArtifactKey) return;
    const data = state.artifactSettings[currentArtifactKey];
    if (data && data.submitted) {
        alert('この提出物はすでに提出済みです。');
        return;
    }

    const hasData = data && data.slides && data.slides.length > 0;
    state.artifacts[currentArtifactKey] = hasData; // Keep legacy flag for Gantt marking

    if (hasData) {
        data.updatedAt = new Date().toISOString();
    }
    saveState();

    // Visual feedback
    const btn = document.getElementById('btn-board-draft-artifact'); // Updated to new button ID
    const orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check"></i> 保存しました';
    btn.style.background = '#059669';
    if (window.lucide) lucide.createIcons();
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; if (window.lucide) lucide.createIcons(); }, 1500);

    renderGantt();
    updateDisplayInfo();
}

/** Final Submit for Artifacts */
function submitArtifactData() {
    if (!currentArtifactKey) return;
    const data = state.artifactSettings[currentArtifactKey];

    if (!data || !data.slides || data.slides.length === 0) {
        alert('スライドやポスターが登録されていません。');
        return;
    }

    if (!confirm('この提出物を「最終提出」しますか？\n提出後の編集はできなくなります（解除にはパスワードが必要です）。')) return;

    data.submitted = true;
    data.submittedAt = new Date().toISOString();
    data.updatedAt = data.submittedAt;
    state.artifacts[currentArtifactKey] = true;

    saveState();
    applyArtifactLockState(true, data.submittedAt);
    renderGantt();
    updateDisplayInfo();
    renderRecentActivity();
    alert('最終提出が完了しました。');
}

/** Unlock Locked Artifact (Secret Operation) */
function unlockArtifactData() {
    const pw = prompt('提出済みロックを解除するには管理者パスワードを入力してください:');
    if (pw === '9784563046378') {
        if (currentArtifactKey && state.artifactSettings[currentArtifactKey]) {
            state.artifactSettings[currentArtifactKey].submitted = false;
            saveState();
            applyArtifactLockState(false);
            renderGantt();
            alert('提出状態を解除しました。内容の編集が可能です。');
        }
    } else if (pw !== null) {
        alert('パスワードが正しくありません。');
    }
}

function buildTaskFlowAuthorChecks(task) {
    const container = document.getElementById('task-flow-authors');
    if (!container) return;
    container.innerHTML = '';

    const selectedAuthors = (task && task.processFlow && task.processFlow.authors) ? task.processFlow.authors : [];

    state.members.forEach((m, i) => {
        const fullName = `${m.lastName || ''} ${m.firstName || ''}`.trim();
        if (!fullName) return; // Skip empty members

        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.htmlFor = 'task-flow-author-' + i;
        // Adjust for small header area
        label.style.padding = '4px 8px';
        label.style.fontSize = '0.75rem';
        label.style.background = 'rgba(255,255,255,0.03)';

        const isChecked = selectedAuthors.includes(fullName);
        label.innerHTML = `
            <input type="checkbox" id="task-flow-author-${i}" name="taskFlowAuthor" data-idx="${i}" ${isChecked ? 'checked' : ''}>
            <span>${m.lastName || 'メンバー'}</span>
        `;
        container.appendChild(label);
    });
}


// --- Reports Logic ---


/* ================================================================
   WORK REPORT - Full Implementation
   ================================================================ */

/** Called from Gantt marker onclick  Eiter is the DEFAULT_SCHEDULE session id (e.g. 5 ↁE第5囁E */
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

    // Build option list from schedule
    iterSelect.innerHTML = '';
    const schedule = (state.schedule && state.schedule.length > 0) ? state.schedule : [];
    const startIter = state.deliverableTargets?.workReportStart || 3;
    schedule.forEach(s => {
        if (s.id >= startIter) {
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
            statusEl.classList.add('ok'); statusEl.textContent = '✁E適正';
        } else if (len < min) {
            statusEl.classList.add('low'); statusEl.textContent = 'もう少し';
        } else {
            statusEl.classList.add('over'); statusEl.textContent = '趁E';
        }
    };
    ta.addEventListener('input', () => {
        update();
        updateContentTime();
        saveDraftWorkReport(true);
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
        const name = member.lastName ? `${member.lastName}` : '-';
        const savedComm = data.communications?.[i] || '';
        const savedTime = commTimes[i] ? formattedTimestamp(commTimes[i]) : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="wr-role-label">${role.title}</span></td>
            <td><span class="wr-member-name">${name}</span></td>
            <td><input class="wr-comm-input" type="text" name="commInput${i}" aria-label="${role.title}からの伝達事項" maxlength="100"
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
            saveDraftWorkReport(true);
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
            saveDraftWorkReport(true);
        });

        container.appendChild(label);
    });
}

function formattedTimestamp(iso) {
    if (!iso) return '-';
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
        container.innerHTML = '<p class="wr-hint">タスクが登録されてぁEせんEガントチャートで追加してくださいEE/p>';
        return;
    }

    const currentData = getWrCurrent();
    const selectedIds = currentData?.selectedTasks || [];

    // Group tasks by category
    const groups = [
        { id: 'effort', label: '取り絁Eタスク', color: '#6366f1', tasks: state.tasks.filter(t => !t.category || t.category === 'effort') },
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
            label.htmlFor = 'wr-task-' + taskIndex;
            label.innerHTML = `
                <input type="checkbox" id="wr-task-${taskIndex}" name="wrTask" value="${taskIndex}" ${isSelected ? 'checked' : ''}>
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
        gallery.innerHTML = '<div class="wr-no-flow">タスクを選択するとプロセスフローが表示されまぁE/div>';
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
                <div class="wr-no-flow" style="padding:1rem;">プロセスフロー未登録<br><small>タスクを編雁EてマインドEチEEを保存してください</small></div>
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

    // Helper: Add assignees
    const addAssignees = (node, rectX, rectY, rectW) => {
        if (!node.assignees || node.assignees.length === 0) return;
        const group = document.createElementNS(ns, 'g');
        const startX = rectX + rectW - 6;
        const startY = rectY - 6;

        node.assignees.forEach((idx, i) => {
            const m = state.members[idx];
            if (!m) return;
            const x = startX - (i * 12); // Stack from right
            const y = startY;
            const r = 9;

            const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
            const color = m.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length];

            // White border circle
            const bg = document.createElementNS(ns, 'circle');
            bg.setAttribute('cx', x); bg.setAttribute('cy', y); bg.setAttribute('r', r);
            bg.setAttribute('fill', m.avatarImage ? '#fff' : color);
            bg.setAttribute('stroke', '#fff'); bg.setAttribute('stroke-width', '1.5');
            group.appendChild(bg);

            if (m.avatarImage) {
                // Clip path for image
                const clipId = `clip-${node.id}-${i}-${Math.random().toString(36).substr(2, 5)}`;
                const defs = document.createElementNS(ns, 'defs');
                const clipPath = document.createElementNS(ns, 'clipPath');
                clipPath.id = clipId;
                const clipCircle = document.createElementNS(ns, 'circle');
                clipCircle.setAttribute('cx', x); clipCircle.setAttribute('cy', y); clipCircle.setAttribute('r', r);
                clipPath.appendChild(clipCircle);
                defs.appendChild(clipPath);
                group.appendChild(defs);

                const img = document.createElementNS(ns, 'image');
                img.setAttribute('x', x - r); img.setAttribute('y', y - r);
                img.setAttribute('width', r * 2); img.setAttribute('height', r * 2);
                img.setAttribute('href', m.avatarImage);
                img.setAttribute('clip-path', `url(#${clipId})`);
                img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
                group.appendChild(img);
            } else {
                const txt = document.createElementNS(ns, 'text');
                txt.setAttribute('x', x); txt.setAttribute('y', y + 3);
                txt.setAttribute('text-anchor', 'middle');
                txt.setAttribute('fill', '#fff');
                txt.setAttribute('font-size', '9px');
                txt.setAttribute('font-weight', 'bold');
                txt.textContent = (m.lastName || '?').slice(0, 1);
                group.appendChild(txt);
            }
        });
        svg.appendChild(group);
    };

    // Map to store node center coordinates for relations
    const nodeCoords = {}; // { id: {x, y} }

    // Root node
    const rootCY = H / 2;
    const rootRect = document.createElementNS(ns, 'rect');
    rootRect.setAttribute('x', rootX); rootRect.setAttribute('y', rootCY - 14);
    rootRect.setAttribute('width', 110); rootRect.setAttribute('height', 28);
    rootRect.setAttribute('rx', 8); rootRect.setAttribute('fill', '#6366f1');
    svg.appendChild(rootRect);
    addAssignees(root, rootX, rootCY - 14, 110);

    const rootText = document.createElementNS(ns, 'text');
    rootText.setAttribute('x', rootX + 55); rootText.setAttribute('y', rootCY + 5);
    rootText.setAttribute('text-anchor', 'middle'); rootText.setAttribute('fill', '#fff');
    rootText.setAttribute('font-size', '11'); rootText.setAttribute('font-weight', '700');
    rootText.textContent = trunc(root.text, 10);
    svg.appendChild(rootText);

    nodeCoords[root.id] = { x: rootX, y: rootCY - 14, w: 110, h: 28 };

    // Children
    children.forEach((child, i) => {
        const cy = PADDING + i * ROW_H + ROW_H / 2;
        // Connector
        const line = document.createElementNS(ns, 'path');
        line.setAttribute('d', `M ${rootX + 110} ${rootCY} C ${childX - 20} ${rootCY}, ${childX - 20} ${cy}, ${childX} ${cy}`);
        line.setAttribute('stroke', '#6366f155'); line.setAttribute('stroke-width', '1.5');
        line.setAttribute('fill', 'none');
        svg.appendChild(line);

        // Child node
        const crect = document.createElementNS(ns, 'rect');
        crect.setAttribute('x', childX); crect.setAttribute('y', cy - 13);
        crect.setAttribute('width', 140); crect.setAttribute('height', 26);
        crect.setAttribute('rx', 6); crect.setAttribute('fill', '#1e293b');
        crect.setAttribute('stroke', '#334155'); crect.setAttribute('stroke-width', '1');
        svg.appendChild(crect);
        addAssignees(child, childX, cy - 13, 140);

        const ctext = document.createElementNS(ns, 'text');
        ctext.setAttribute('x', childX + 70); ctext.setAttribute('y', cy + 4);
        ctext.setAttribute('text-anchor', 'middle'); ctext.setAttribute('fill', '#e2e8f0');
        ctext.setAttribute('font-size', '10');
        ctext.textContent = trunc(child.text, 14);
        svg.appendChild(ctext);

        nodeCoords[child.id] = { x: childX, y: cy - 13, w: 140, h: 26 };

        // Grandchildren
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
            addAssignees(gc, grandX, gcy - 11, 130);

            const gtext = document.createElementNS(ns, 'text');
            gtext.setAttribute('x', grandX + 65); gtext.setAttribute('y', gcy + 4);
            gtext.setAttribute('text-anchor', 'middle'); gtext.setAttribute('fill', '#94a3b8');
            gtext.setAttribute('font-size', '9');
            gtext.textContent = trunc(gc.text, 16);
            svg.appendChild(gtext);

            nodeCoords[gc.id] = { x: grandX, y: gcy - 11, w: 130, h: 22 };
        });
    });

    // Render relations (simple dashed lines without arrowheads)
    const traverseAndDrawRelations = (n) => {
        if (n.relations && n.relations.length > 0) {
            n.relations.forEach(r => {
                const targetId = (typeof r === 'string') ? r : r.id;
                const src = nodeCoords[n.id];
                const dst = nodeCoords[targetId];

                if (src && dst) {
                    const rPath = document.createElementNS(ns, 'path');
                    // From Right of Source to Left of Target
                    const startX = src.x + src.w;
                    const startY = src.y + src.h / 2;
                    const endX = dst.x;
                    const endY = dst.y + dst.h / 2;

                    const midX = (startX + endX) / 2;
                    // Adjust curve height based on vertical distance
                    const cY = Math.min(startY, endY) - 20;

                    rPath.setAttribute('d', `M ${startX} ${startY} Q ${midX} ${cY} ${endX} ${endY}`);
                    rPath.setAttribute('stroke', '#f59e0b');
                    rPath.setAttribute('stroke-width', '1.5');
                    rPath.setAttribute('stroke-dasharray', '3,3');
                    rPath.setAttribute('fill', 'none');
                    svg.appendChild(rPath);
                }
            });
        }
        if (n.children) n.children.forEach(traverseAndDrawRelations);
    };
    traverseAndDrawRelations(root);

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
    const nodeCoords = {};

    const children = root.children || [];
    // Count total rows needed (children + their grandchildren offsets)
    let rowOffset = 0;
    children.forEach(c => {
        const gcCount = (c.children || []).slice(0, 4).length;
        rowOffset += Math.max(gcCount, 1);
    });
    const totalRows = Math.max(rowOffset, 1);
    const H = Math.max(totalRows * ROW_H + PADDING * 2, 80);

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

    // Helper: Add assignees (similar logic but adjusted for print)
    const addAssignees = (node, rectX, rectY, rectW) => {
        if (!node.assignees || node.assignees.length === 0) return;
        const group = document.createElementNS(ns, 'g');
        const startX = rectX + rectW - 6;
        const startY = rectY - 6;

        node.assignees.forEach((idx, i) => {
            const m = state.members[idx];
            if (!m) return;
            const x = startX - (i * 12);
            const y = startY;
            const r = 9;
            const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
            const color = m.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length];

            const bg = mk('circle', { cx: x, cy: y, r: r, fill: m.avatarImage ? '#fff' : color, stroke: '#fff', 'stroke-width': '1.5' });
            group.appendChild(bg);

            if (m.avatarImage) {
                const clipId = `clip-p-${node.id}-${i}-${Math.random().toString(36).substr(2, 5)}`;
                const defs = mk('defs', {});
                const clipPath = mk('clipPath', { id: clipId });
                const clipCircle = mk('circle', { cx: x, cy: y, r: r });
                clipPath.appendChild(clipCircle);
                defs.appendChild(clipPath);
                group.appendChild(defs);

                const img = mk('image', { x: x, y: y, width: r * 2, height: r * 2, href: m.avatarImage, 'clip-path': `url(#${clipId})`, preserveAspectRatio: 'xMidYMid slice' });
                group.appendChild(img);
            } else {
                const txt = mk('text', { x: x, y: y + 3, 'text-anchor': 'middle', fill: '#fff', 'font-size': '9', 'font-weight': 'bold', 'font-family': 'sans-serif' });
                txt.textContent = (m.lastName || '?').slice(0, 1);
                group.appendChild(txt);
            }
        });
        svg.appendChild(group);
    };

    // Map to store node center coordinates for relations - already declared at top of function if added properly,
    // but looking at previous step, it was added at line 2379.
    // Let's just ensure we use the one instance.
    const rootCY = H / 2;

    // Root node (indigo fill, white text)
    svg.appendChild(mk('rect', { x: rootX, y: rootCY - 15, width: 124, height: 30, rx: 8, fill: '#4f46e5' }));
    addAssignees(root, rootX, rootCY - 15, 124);
    const rootTxt = mk('text', { x: rootX + 62, y: rootCY + 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': '11', 'font-weight': '700', 'font-family': 'sans-serif' });
    rootTxt.textContent = trunc(root.text, 12);
    svg.appendChild(rootTxt);

    nodeCoords[root.id] = { x: rootX, y: rootCY - 15, w: 124, h: 30 };

    // Children
    rowOffset = 0; // Reset for actual positioning
    children.forEach((child, i) => {
        const grandChildren = (child.children || []).slice(0, 4);
        const gcCount = Math.max(grandChildren.length, 1);
        const childCY = PADDING + (rowOffset + (gcCount - 1) / 2) * ROW_H + ROW_H / 2;

        // Connector: root ↁEchild
        svg.appendChild(mk('path', {
            d: `M ${rootX + 124} ${rootCY} C ${childX - 25} ${rootCY}, ${childX - 25} ${childCY}, ${childX} ${childCY}`,
            stroke: '#6366f1', 'stroke-width': '1.5', fill: 'none', 'stroke-opacity': '0.5'
        }));

        // Child node box
        const crect = mk('rect', { x: childX, y: childCY - 14, width: 155, height: 28, rx: 6, fill: '#f8fafc', stroke: '#cbd5e1', 'stroke-width': '1' });
        svg.appendChild(crect);
        addAssignees(child, childX, childCY - 14, 155);

        const ctext = mk('text', { x: childX + 77, y: childCY + 5, 'text-anchor': 'middle', fill: '#1e293b', 'font-size': '10', 'font-family': 'sans-serif' });
        ctext.textContent = trunc(child.text, 16);
        svg.appendChild(ctext);

        nodeCoords[child.id] = { x: childX, y: childCY - 14, w: 155, h: 28 };

        // Grandchildren (limit to 4)
        const grandX = childX + 170; // Adjusted grandX for print
        grandChildren.forEach((gc, gi) => {
            const gcy = childCY + (gi - (grandChildren.length - 1) / 2) * 24;

            svg.appendChild(mk('line', { x1: childX + 155, y1: childCY, x2: grandX, y2: gcy, stroke: '#cbd5e1', 'stroke-width': '1' }));

            const grect = mk('rect', { x: grandX, y: gcy - 11, width: 140, height: 22, rx: 5, fill: '#fff', stroke: '#cbd5e1', 'stroke-width': '1' });
            svg.appendChild(grect);
            addAssignees(gc, grandX, gcy - 11, 140);

            const gtext = mk('text', { x: grandX + 70, y: gcy + 4, 'text-anchor': 'middle', fill: '#64748b', 'font-size': '9', 'font-family': 'sans-serif' });
            gtext.textContent = trunc(gc.text, 20);
            svg.appendChild(gtext);

            nodeCoords[gc.id] = { x: grandX, y: gcy - 11, w: 140, h: 22 };
        });

        rowOffset += gcCount;
    });

    // Render relations (simple dashed lines without arrowheads)
    const traverseAndDrawRelations = (n) => {
        if (n.relations && n.relations.length > 0) {
            n.relations.forEach(r => {
                const targetId = (typeof r === 'string') ? r : r.id;
                const src = nodeCoords[n.id];
                const dst = nodeCoords[targetId];

                if (src && dst) {
                    const startX = src.x + src.w;
                    const startY = src.y + src.h / 2;
                    const endX = dst.x;
                    const endY = dst.y + dst.h / 2;
                    const midX = (startX + endX) / 2;
                    const cY = Math.min(startY, endY) - 20;

                    const rPath = mk('path', {
                        d: `M ${startX} ${startY} Q ${midX} ${cY} ${endX} ${endY}`,
                        stroke: '#f59e0b',
                        'stroke-width': '1.5',
                        'stroke-dasharray': '3,3',
                        fill: 'none'
                    });
                    svg.appendChild(rPath);
                }
            });
        }
        if (n.children) n.children.forEach(traverseAndDrawRelations);
    };
    traverseAndDrawRelations(root);

    return svg;
}

function getWrIter() {
    const val = document.getElementById('work-report-iteration')?.value;
    return val || ''; // No default '3'
}

function getWrCurrent() {
    return state.reports[getWrIter()] || null;
}

function updateWrHeader() {
    const iter = parseInt(getWrIter());
    const schedule = (state.schedule && state.schedule.length > 0) ? state.schedule : [];
    const session = schedule.find(s => s.id === iter);

    // Header card fields
    const setEl = (id, val) => {
        const el = document.getElementById(id); if (el) el.textContent = val || '-';
    };
    setEl('wr-group-symbol', state.groupSymbol);
    setEl('wr-group-name', state.groupName || state.themeName);
    const iterLabel = session ? `第${session.id}回` : `第${iter}回`;
    setEl('wr-iter-label', iterLabel);
    setEl('wr-iter-date', session ? formatDate(session.date) : '-');

    // Also update main view title to be more specific
    const viewTitle = document.getElementById('view-title');
    if (viewTitle) {
        viewTitle.textContent = `${iterLabel} 作業報告書作成`;
    }

    // Session info bar
    const infoEl = document.getElementById('wr-session-info');
    if (infoEl) {
        if (session) {
            infoEl.textContent = `📅 ${formatDate(session.date)} - ${session.label}`;
        } else {
            infoEl.textContent = 'スケジュールが設定されていません。初期設定ファイルを読み込んでください。';
        }
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
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

/** 一時保存 saves without locking */
function saveDraftWorkReport(silent = false) {
    // If event object is passed (from click listener), treat as not silent
    if (silent && silent.type) silent = false;

    const iter = getWrIter();
    if (!state.reports[iter]) state.reports[iter] = {};
    if (state.reports[iter].submitted) {
        if (!silent) alert('この回の報告書は提出済みです。内容を変更することはできません。');
        return;
    }

    const { ach, chal, comms, authors } = collectWrFormData();
    Object.assign(state.reports[iter], {
        achievement: ach, challenge: chal, communications: comms,
        authors: authors,
        selectedTasks: getSelectedTaskIds(),
        content: `${ach}\n${chal}`.trim(),
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

/** 提出解除 Admin unlock with password */
function unlockWorkReport() {
    const pw = prompt('提出済みロックを解除するには管理者パスワードを入力してください:');
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

/** 提出 confirms, locks, downloads PDF + JSON backup */
function submitWorkReport() {
    const iter = getWrIter();
    if (state.reports[iter]?.submitted) {
        alert('すでに提出済みです。');
        return;
    }

    const session = DEFAULT_SCHEDULE.find(s => s.id === parseInt(iter));
    const sessionLabel = session ? `第${session.id}回(${formatDate(session.date)})` : `第${iter}回`;

    // Content check
    const { ach, chal, comms } = collectWrFormData();
    const achLen = ach.trim().length;
    const chalLen = chal.trim().length;
    const warnings = [];
    if (achLen < 160) warnings.push(`「できたこと」が不足しています！(${achLen}文字 / 基準400字）`);
    if (chalLen < 160) warnings.push(`「新たな課題」が不足しています！(${chalLen}文字 / 基準400字）`);
    if (comms.every(c => !c.trim())) warnings.push('伝達事項が未入力です。');

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
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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

/** プレビュー opens a print-ready window */
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
        const name = member.lastName || '-';
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
<title>作業報告書 第${iter}回 - ${state.groupName || ''}</title>
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
    <div class="meta-item"><span class="meta-label">チーム記号</span><span class="meta-value">${state.groupSymbol || '-'}</span></div>
    <div class="meta-item"><span class="meta-label">チーム名</span><span class="meta-value">${state.groupName || state.themeName || '-'}</span></div>
    <div class="meta-item"><span class="meta-label">実施回</span><span class="meta-value">第${iter}回</span></div>
    <div class="meta-item"><span class="meta-label">実施日</span><span class="meta-value">${session ? formatDate(session.date) : '-'}</span></div>
    ${data.submittedAt ? `<div class="meta-item"><span class="meta-label">提出日時</span><span class="meta-value" style="font-size:10pt;">${new Date(data.submittedAt).toLocaleString('ja-JP')}</span></div>` : ''}
  </div>

  <div class="section">
    <h2>① 今週実施したタスクのプロセスフロー</h2>
    ${processFlowsHtml || '<p style="color:#aaa;font-size:9pt;">タスクが未選択またはプロセスフローが未登録です</p>'}
  </div>

  <div class="section">
    <h2>② 実施内容</h2>
    <div style="margin-bottom:.5rem;">
      <span style="font-size:9pt;font-weight:700;color:#666;">記入者:</span> ${authorsHtml || '-'}
      ${data.contentUpdatedAt ? `<span style="margin-left:1rem;font-size:8pt;color:#999;">最終更新: ${formattedTimestamp(data.contentUpdatedAt)}</span>` : ''}
    </div>
    <p><span class="sub-label ach">「できたこと」</span></p>
    ${imagesHtml ? `<div class="images">${imagesHtml}</div>` : ''}
    <div class="text-box">${data.achievement || '（未記入）'}</div>
    <p style="margin-top:1rem;"><span class="sub-label chal">⚠ 新たな課題</span></p>
    <div class="text-box">${data.challenge || '（未記入）'}</div>
  </div>

  <div class="section">
    <h2>③ 各メンバーからの伝達事項</h2>
    <table>
      <thead>
        <tr>
          <th>役割</th>
          <th>担当者</th>
          <th>伝達事項</th>
          <th style="width:80px;">最終更新</th>
        </tr>
      </thead>
      <tbody>${commsHtml}</tbody>
    </table>
  </div>

  <div class="footer">
    生成日時: ${new Date().toLocaleString('ja-JP')} - PBL2 Student Manager
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

/** Batch compression for all existing images in state */
async function compressAllExistingImages() {
    if (!confirm('既存のすべての画像データを一括で再圧縮しますか？\nこれには数分かかる場合があり、完了まで画面が固まることがありますが正常な動作です。\n容量不足を解消するために非常に有効です。')) return;

    try {
        const btn = document.getElementById('btn-compress-all-images');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader"></i> 圧縮中...';
        if (window.lucide) lucide.createIcons();

        let count = 0;

        // 1. Team Logo
        if (state.groupLogo) {
            state.groupLogo = await compressImage(state.groupLogo, 600, 600, 0.8);
            count++;
        }

        // 2. Work Report Images
        if (state.reports) {
            for (const key in state.reports) {
                const report = state.reports[key];
                if (report.achievementImages && report.achievementImages.length > 0) {
                    for (let i = 0; i < report.achievementImages.length; i++) {
                        report.achievementImages[i] = await compressImage(report.achievementImages[i], 640, 640, 0.2);
                        count++;
                    }
                }
            }
        }

        // 3. Artifact Slides
        if (state.artifactSettings) {
            for (const key in state.artifactSettings) {
                const setting = state.artifactSettings[key];
                if (setting.slides && setting.slides.length > 0) {
                    for (let i = 0; i < setting.slides.length; i++) {
                        setting.slides[i].src = await compressImage(setting.slides[i].src, 800, 800, 0.3);
                        count++;
                    }
                }
            }
        }

        // 4. Chat Messages
        if (state.messages) {
            for (const msg of state.messages) {
                if (msg.attachments && msg.attachments.length > 0) {
                    for (const att of msg.attachments) {
                        if (att.type === 'image' && att.data) {
                            att.data = await compressImage(att.data, 640, 640, 0.2);
                            count++;
                        }
                    }
                }
            }
        }

        // 5. Member Avatars
        if (state.members) {
            for (const member of state.members) {
                if (member.avatarImage) {
                    member.avatarImage = await compressImage(member.avatarImage, 250, 250, 0.3);
                    count++;
                }
            }
        }

        saveState();
        alert(`${count}個の画像を再圧縮しました。保存容量がさらに改善されました！`);

        btn.innerHTML = originalText;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
        renderAll();

    } catch (e) {
        console.error('Batch compression failed:', e);
        alert('圧縮中にエラーが発生しました。');
    }
}



function handleWrImageFiles(files, section) {
    const iter = getWrIter();
    if (!state.reports[iter]) state.reports[iter] = {};
    if (!state.reports[iter].achievementImages) state.reports[iter].achievementImages = [];

    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const compressed = await compressImage(e.target.result, 640, 640, 0.2);
            state.reports[iter].achievementImages.push(compressed);
            saveState();
            renderWrImages('wr-achievement-images', state.reports[iter].achievementImages, 'achievement');
        };
        reader.readAsDataURL(file);
    });
}

// Remove avatar for specific member
function removeAvatarImage(index) {
    if (confirm('画像を削除しますか？')) {
        state.members[index].avatarImage = null;
        saveState();
        renderMemberList();
    }
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
            <button class="wr-img-remove" onclick="removeWrImage('${section}', ${idx})" title="削除">×</button>
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
    const data = state.reports['analysis'] || { bg: '', problem: '', solution: '', submitted: false };
    document.getElementById('analysis-theme-title').value = state.themeName || '';
    document.getElementById('analysis-group-name').value = state.groupName || '';
    document.getElementById('analysis-bg').value = data.bg || '';
    document.getElementById('analysis-problem').value = data.problem || '';
    document.getElementById('analysis-solution').value = data.solution || '';

    // Handle lock state
    const isSubmitted = data.submitted || false;
    const editor = document.querySelector('.analysis-report-editor');
    const banner = document.getElementById('analysis-submitted-banner');

    if (editor) {
        editor.querySelectorAll('input, textarea, button:not([onclick*="switchView"])').forEach(el => {
            el.disabled = isSubmitted;
        });
        if (banner) banner.style.display = isSubmitted ? 'block' : 'none';
        if (isSubmitted && window.lucide) lucide.createIcons();
    }
}

function saveAnalysisReport(isSubmit = false) {
    if (isSubmit) {
        if (!confirm('最終提出すると、以降は修正できなくなります（教員への申し出が必要）。よろしいですか？')) return;
    }

    const bg = document.getElementById('analysis-bg').value;
    const problem = document.getElementById('analysis-problem').value;
    const solution = document.getElementById('analysis-solution').value;
    const content = `${bg}\n${problem}\n${solution}`.trim();

    state.reports['analysis'] = {
        bg,
        problem,
        solution,
        content,
        submitted: isSubmit,
        updatedAt: new Date().toISOString()
    };
    saveState();

    if (isSubmit) {
        alert('課題設定レポートを最終提出しました。');
        loadAnalysisReport();
    } else {
        const btn = document.getElementById('btn-save-analysis');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> 保存済み';
            if (window.lucide) lucide.createIcons();
            setTimeout(() => { btn.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 1500);
        }
    }
    renderGantt();
}
/*
alert('課題設定レポEトを保存しました');


*/
const CONTRIBUTION_ROLES = [
    '発表プレゼンテーション',
    '質問対応',
    '資料作成（プレゼン資料）',
    '資料作成（配布資料）'
];

function loadContributionSurvey() {
    if (!currentContributionKey) return;

    const self = (state.members || []).find(m => m.isSelf);
    let data = { ratings: {}, roles: {}, submitted: false };

    const reportData = state.reports[currentContributionKey];
    if (reportData) {
        // Detect if the data is in the old flat format or the new partitioned (map) format
        const isNewFormat = Object.keys(reportData).some(key =>
            key !== 'ratings' && key !== 'roles' && key !== 'submitted' && key !== 'updatedAt' && key !== 'content'
        );

        if (self && reportData[self.id]) {
            // New structure: keyed by member ID
            data = reportData[self.id];
        } else if (!isNewFormat && (reportData.ratings || reportData.roles || reportData.submitted !== undefined)) {
            // Legacy support: ONLY fallback to root data if NO member-specific keys are found.
            data = reportData;
        }
    }

    // Set Title and Description based on currentContributionKey
    const titleEl = document.getElementById('contribution-title');
    const descEl = document.getElementById('contribution-desc');
    const ratingContainer = document.getElementById('contribution-member-ratings');

    // Add Identity indicator
    const existingBadge = document.getElementById('contribution-self-badge');
    if (existingBadge) existingBadge.remove();

    if (self) {
        const badge = document.createElement('div');
        badge.id = 'contribution-self-badge';
        badge.style = "background: var(--primary); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 1rem;";
        badge.innerHTML = `<i data-lucide="user" style="width:12px; height:12px;"></i> 評価者: ${self.lastName}${self.firstName} さん として入力中`;
        titleEl.parentElement.insertBefore(badge, titleEl.nextSibling);
    }

    // Default visibility
    if (ratingContainer) ratingContainer.style.display = 'flex';

    if (currentContributionKey.includes('reflection')) {
        if (titleEl) titleEl.textContent = '振り返りシート';
        if (descEl) descEl.textContent = '今回の活動を振り返り、自己評価や学んだことを自由に記入してください。';
        if (ratingContainer) ratingContainer.style.display = 'none'; // Hide ratings for reflection
    } else if (currentContributionKey.includes('mutual')) {
        if (titleEl) titleEl.textContent = '相互評価シート';
        if (descEl) descEl.textContent = 'グループ内の他メンバーの貢献度と役割を評価してください。';
    } else if (currentContributionKey.includes('contribution_13')) {
        if (titleEl) titleEl.textContent = '【中間発表】 貢献度調査・相互評価';
        if (descEl) descEl.textContent = '中間発表までの、自分以外のメンバーの貢献度と役割を評価してください。';
    } else if (currentContributionKey.includes('contribution_26') || currentContributionKey.includes('contribution_27')) {
        if (titleEl) titleEl.textContent = '【最終発表】 貢献度調査・相互評価';
        if (descEl) descEl.textContent = '最終発表までの、自分以外のメンバーの貢献度と役割を評価してください。';
    }

    // Render member ratings
    if (!ratingContainer) return;
    ratingContainer.innerHTML = '';

    const otherMembers = (state.members || []).filter(m => !m.isSelf);

    if (otherMembers.length === 0) {
        ratingContainer.innerHTML = `
            <div style="text-align:center; padding: 2rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed var(--border); grid-column: 1 / -1;">
                <i data-lucide="users" style="width:40px; height:40px; color:var(--text-dim); margin-bottom:1rem; opacity:0.3;"></i>
                <p class="empty-msg" style="color:var(--text-dim);">評価対象のメンバーがいません。<br><small>「メンバー・テーマ」画面で自分の名前を「自分」として登録してください。</small></p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    otherMembers.forEach(member => {
        const rating = data.ratings ? data.ratings[member.id] || 0 : 0;
        const memberRoles = data.roles ? data.roles[member.id] || [] : [];

        // Check if this member has submitted THEIR contribution survey
        const hasMemberSubmitted = reportData && reportData[member.id] && reportData[member.id].submitted;

        const row = document.createElement('div');
        row.className = 'contribution-member-row';

        let avatarHtml = '';
        if (member.avatarImage) {
            avatarHtml = `<img src="${member.avatarImage}" class="contribution-member-avatar">`;
        } else {
            const initial = (member.lastName || '?').charAt(0);
            const color = AVATAR_COLORS[state.members.indexOf(member) % AVATAR_COLORS.length];
            avatarHtml = `<div class="contribution-member-avatar" style="background:${color}22; color:${color}; border: 1px solid ${color}44;">${initial}</div>`;
        }

        const submissionBadge = hasMemberSubmitted
            ? `<span style="background:rgba(16, 185, 129, 0.1); color:#10b981; border:1px solid rgba(16, 185, 129, 0.2); font-size:10px; padding:1px 6px; border-radius:4px; font-weight:600; margin-left:8px;"><i data-lucide="check" style="width:10px; height:10px; vertical-align:middle; margin-right:2px;"></i>提出済み</span>`
            : '';

        row.innerHTML = `
            <div class="contribution-member-info">
                ${avatarHtml}
                <div class="contribution-member-name-wrap">
                    <div style="display:flex; align-items:center;">
                        <span class="contribution-member-name">${member.lastName || ''} ${member.firstName || ''}</span>
                        ${submissionBadge}
                    </div>
                    <span class="contribution-member-role">${member.role || '役割未設定'}</span>
                </div>
            </div>
            
            <div class="contribution-member-scoring" style="width:100%;">
                <p style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.5rem; text-align: center;">当日までの貢献度</p>
                <div class="rating-stars" data-member-id="${member.id}">
                    ${[1, 2, 3, 4, 5].map(num => `
                        <button class="rating-star-btn ${rating === num ? 'active' : ''}" onclick="setContributionRating('${member.id}', ${num})">
                            <i data-lucide="star"></i> ${num}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="contribution-member-roles" style="width:100%; border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 0.5rem;">
                <p style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.8rem; text-align: center;">当日までの役割（複数選択可）</p>
                <div class="role-grid" data-member-id="${member.id}" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${CONTRIBUTION_ROLES.map(roleName => `
                        <label class="checkbox-item" style="cursor:pointer; display:flex; align-items:center; gap:0.75rem; padding: 0.4rem 0.75rem; background: rgba(255,255,255,0.02); border-radius: 6px; transition: var(--transition);">
                            <input type="checkbox" name="role_${member.id}" value="${roleName}" ${memberRoles.includes(roleName) ? 'checked' : ''} style="width:16px; height:16px;">
                            <span style="font-size:0.85rem;">${roleName}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
        ratingContainer.appendChild(row);
    });

    if (window.lucide) lucide.createIcons();

    // Disable controls if submitted
    const isSubmitted = data.submitted;
    const container = document.querySelector('.contribution-editor');
    if (container) {
        if (isSubmitted) {
            container.querySelectorAll('button:not([onclick*="switchView"]), input[type="checkbox"]').forEach(el => el.disabled = true);
            // Show unlock banner if it doesn't exist
            if (!document.getElementById('contribution-unlock-banner')) {
                const banner = document.createElement('div');
                banner.id = 'contribution-unlock-banner';
                banner.className = 'wr-status-banner submitted mt-2';
                banner.innerHTML = `
                    <div class="wr-status-info">
                        <i data-lucide="lock"></i>
                        <span>提出済みのため編集できません。修正が必要な場合は教員に申し出てください。</span>
                    </div>
                    <button class="btn btn-sm btn-outline-light" onclick="unlockContributionSurvey()">教員用ロック解除</button>
                `;
                container.insertBefore(banner, container.querySelector('.contribution-member-grid'));
                if (window.lucide) lucide.createIcons();
            }
        } else {
            container.querySelectorAll('button, input[type="checkbox"]').forEach(el => el.disabled = false);
            const banner = document.getElementById('contribution-unlock-banner');
            if (banner) banner.remove();
        }
    }
}

window.setContributionRating = (memberId, rating) => {
    const parent = document.querySelector(`.rating-stars[data-member-id="${memberId}"]`);
    if (!parent) return;

    const buttons = parent.querySelectorAll('.rating-star-btn');
    buttons.forEach((btn, idx) => {
        if ((idx + 1) === rating) btn.classList.add('active');
        else btn.classList.remove('active');
    });
};

function saveContributionSurvey(isSubmit = false) {
    if (!currentContributionKey) return;

    // Check if current user has already submitted
    const self = (state.members || []).find(m => m.isSelf);
    const reportData = state.reports[currentContributionKey];
    if (self && reportData && reportData[self.id]?.submitted) {
        alert('提出済みの調査は編集できません。');
        return;
    }

    const ratings = {};
    const roles = {};

    document.querySelectorAll('.rating-stars').forEach(el => {
        const memberId = el.getAttribute('data-member-id');
        const activeBtn = el.querySelector('.rating-star-btn.active');
        if (activeBtn) {
            const buttons = Array.from(el.querySelectorAll('.rating-star-btn'));
            const index = buttons.indexOf(activeBtn);
            if (index !== -1) {
                ratings[memberId] = index + 1;
            }
        }
    });

    document.querySelectorAll('.role-grid').forEach(el => {
        const memberId = el.getAttribute('data-member-id');
        const selected = Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        roles[memberId] = selected;
    });

    const otherMembers = (state.members || []).filter(m => !m.isSelf);

    if (isSubmit) {
        if (otherMembers.length > 0 && Object.keys(ratings).length < otherMembers.length) {
            if (!confirm('まだ評価していないメンバーがいます。このまま提出してよろしいですか？')) return;
        }
        if (!confirm('提出すると内容を変更できなくなります。よろしいですか？')) return;
    }

    if (!self) {
        alert('「自分」の設定が行われていないため、保存できません。メンバー画面で自分を選択してください。');
        return;
    }

    // Initialize the report structure if it's new or old
    const reportRoot = state.reports[currentContributionKey];
    if (!reportRoot || reportRoot.ratings || reportRoot.submitted !== undefined) {
        // If it was old flat structure, or empty, start fresh as a map
        state.reports[currentContributionKey] = {};
    }

    state.reports[currentContributionKey][self.id] = {
        ratings,
        roles,
        submitted: isSubmit,
        updatedAt: new Date().toISOString()
    };
    saveState();

    if (isSubmit) {
        alert('調査内容を提出しました。ガントチャートに戻ります。');
        renderGantt();
        switchView('gantt');
    } else {
        const btn = document.getElementById('btn-save-contribution-draft');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> 保存しました';
            if (window.lucide) lucide.createIcons();
            setTimeout(() => { btn.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 1500);
        }
        renderGantt();
    }
}

/** 教員用パスワード解除 for Contribution Survey */
window.unlockContributionSurvey = () => {
    const pw = prompt('提出済みロックを解除するには管理者パスワードを入力してください:');
    if (pw === '9784563046378') {
        const self = (state.members || []).find(m => m.isSelf);
        const reportGroup = state.reports[currentContributionKey];

        if (reportGroup) {
            if (self && reportGroup[self.id]) {
                reportGroup[self.id].submitted = false;
                alert(`${self.lastName}${self.firstName}さんのロックを解除しました。`);
            } else if (reportGroup.submitted !== undefined) {
                // Legacy support
                reportGroup.submitted = false;
                alert('ロックを解除しました。');
            } else {
                alert('解除対象のデータが見つかりません。');
                return;
            }
            saveState();
            loadContributionSurvey();
            renderGantt();
        }
    } else if (pw !== null) {
        alert('パスワードが正しくありません。');
    }
};

/** 振り返りシート関連の機能 */
window.loadReflectionSheet = () => {
    if (!currentReflectionKey) return;

    const data = state.reports[currentReflectionKey] || {
        feedbackEntries: [{ content: '', presentation: '' }],
        futurePlans: '',
        submitted: false
    };

    const themeInput = document.getElementById('reflection-theme');
    const groupInput = document.getElementById('reflection-group');
    if (themeInput) themeInput.value = state.themeName || '';
    if (groupInput) groupInput.value = state.groupName || '';

    // Populate Authors checkboxes
    const authorContainer = document.getElementById('reflection-author-checks');
    if (authorContainer) {
        authorContainer.innerHTML = '';
        state.members.forEach((m, idx) => {
            const name = `${m.lastName || ''}${m.firstName || ''}`;
            const isChecked = Array.isArray(data.author) ? data.author.includes(name) : (data.author === name);

            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `
                <input type="checkbox" name="reflection-author" value="${name}" ${isChecked ? 'checked' : ''}>
                <span>${m.lastName || 'メンバー'}</span>
            `;
            authorContainer.appendChild(label);
        });
    }

    // Populate feedback list
    const feedbackList = document.getElementById('reflection-feedback-list');
    if (feedbackList) {
        feedbackList.innerHTML = '';
        const entries = data.feedbackEntries && data.feedbackEntries.length > 0
            ? data.feedbackEntries
            : [{ content: '', presentation: '' }];
        entries.forEach((entry, idx) => {
            addReflectionFeedbackEntry(entry.content, entry.presentation, idx);
        });
    }

    const futurePlansEl = document.getElementById('reflection-future-plans');
    if (futurePlansEl) {
        futurePlansEl.value = data.futurePlans || '';
        updateCharCount('reflection-future-plans', 'reflection-future-count');
    }

    // Handle submitted status
    const isSubmitted = data.submitted;
    const container = document.querySelector('.reflection-editor');
    if (container) {
        container.querySelectorAll('input, select, textarea, button:not([onclick*="switchView"])').forEach(el => {
            el.disabled = isSubmitted;
        });

        // Remove existing banner if any
        const existingBanner = document.getElementById('reflection-submitted-banner');
        if (existingBanner) existingBanner.remove();

        if (isSubmitted) {
            const banner = document.createElement('div');
            banner.id = 'reflection-submitted-banner';
            banner.className = 'wr-status-banner submitted mb-1';
            banner.style = "margin-bottom: 1rem;";
            banner.innerHTML = `
                <div class="wr-status-info" style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="lock"></i>
                    <span>提出済みのため編集できません。修正が必要な場合は教員に申し出てください。</span>
                </div>
            `;
            container.insertBefore(banner, container.firstChild);
            if (window.lucide) lucide.createIcons();
        }
    }
};

window.addReflectionFeedbackEntry = (content = '', presentation = '', index = -1) => {
    const list = document.getElementById('reflection-feedback-list');
    if (!list) return;
    const idx = index !== -1 ? index : list.querySelectorAll('.reflection-entry').length;

    const div = document.createElement('div');
    div.className = 'reflection-entry card mb-1';
    div.style = "background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 1rem;";

    const contentId = `reflection-content-${idx}`;
    const presentationId = `reflection-presentation-${idx}`;
    const contentCountId = `reflection-content-count-${idx}`;
    const presentationCountId = `reflection-presentation-count-${idx}`;

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <strong style="font-size: 0.8rem; color: var(--accent);">指摘 ${idx + 1}</strong>
            ${idx > 0 ? `<button class="btn-icon" style="color: var(--danger); padding: 4px;" onclick="removeReflectionFeedbackEntry(${idx})" title="削除"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>` : ''}
        </div>
        <div class="form-group mb-1">
            <label style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 4px; display:block;">〔内容面〕</label>
            <div class="wr-textarea-wrap">
                <textarea id="${contentId}" class="wr-textarea reflection-content-input" rows="2" style="min-height: 60px;"
                    placeholder="内容に関する指摘内容" oninput="updateCharCount('${contentId}', '${contentCountId}')">${content}</textarea>
                <div class="wr-char-counter"><span id="${contentCountId}">0</span> 文字</div>
            </div>
        </div>
        <div class="form-group">
            <label style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 4px; display:block;">〔発表の仕方〕</label>
            <div class="wr-textarea-wrap">
                <textarea id="${presentationId}" class="wr-textarea reflection-presentation-input" rows="2" style="min-height: 60px;"
                    placeholder="発表の仕方に関する指摘内容" oninput="updateCharCount('${presentationId}', '${presentationCountId}')">${presentation}</textarea>
                <div class="wr-char-counter"><span id="${presentationCountId}">0</span> 文字</div>
            </div>
        </div>
    `;
    list.appendChild(div);
    if (window.lucide) lucide.createIcons();

    // Initial counts
    updateCharCount(contentId, contentCountId);
    updateCharCount(presentationId, presentationCountId);
};


window.removeReflectionFeedbackEntry = (idx) => {
    const list = document.getElementById('reflection-feedback-list');
    const entries = list.querySelectorAll('.reflection-entry');
    if (entries[idx]) {
        entries[idx].remove();
        // Renumber remaining entries
        list.querySelectorAll('.reflection-entry').forEach((el, i) => {
            el.querySelector('strong').textContent = `指摘 ${i + 1}`;
            const delBtn = el.querySelector('button[onclick*="removeReflectionFeedbackEntry"]');
            if (i > 0) {
                if (delBtn) delBtn.setAttribute('onclick', `removeReflectionFeedbackEntry(${i})`);
            }
        });
    }
};

window.saveReflectionSheet = (isSubmit = false) => {
    if (!currentReflectionKey) return;

    if (isSubmit && !confirm('提出すると修正できなくなります。\nよろしいですか？')) return;

    const checkedAuthors = Array.from(document.querySelectorAll('input[name="reflection-author"]:checked')).map(el => el.value);
    const feedbackEntries = [];
    document.querySelectorAll('.reflection-entry').forEach(el => {
        const content = el.querySelector('.reflection-content-input').value;
        const presentation = el.querySelector('.reflection-presentation-input').value;
        feedbackEntries.push({ content, presentation });
    });
    const futurePlans = document.getElementById('reflection-future-plans').value;

    state.reports[currentReflectionKey] = {
        author: checkedAuthors, // Save as array
        feedbackEntries,
        futurePlans,
        submitted: isSubmit,
        updatedAt: new Date().toISOString()
    };
    saveState();

    if (isSubmit) {
        alert('振り返りシートを提出しました。ガントチャートに戻ります。');
        renderGantt();
        switchView('gantt');
    } else {
        const btn = document.getElementById('btn-save-reflection-draft');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> 保存しました';
            if (window.lucide) lucide.createIcons();
            setTimeout(() => { btn.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 1500);
        }
        renderGantt();
    }
};

function updateCharCount(id, countId) {
    const el = document.getElementById(id);
    const countEl = document.getElementById(countId);
    if (el && countEl) {
        countEl.textContent = el.value.length;
    }
}


// Legacy handlers kept for HTML compatibility
function handleImageUpload(e) {
    handleWrImageFiles(e.target.files, 'achievement');
}
window.removeImage = (idx) => removeWrImage('achievement', idx);



// --- Data Export/Import ---
function exportData() {
    const dataStr = JSON.stringify(state, null, 2);

    const now = new Date();
    const dateStr = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') + '_' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0');

    const groupPart = state.groupSymbol ? `Group-${state.groupSymbol}` : 'NoGroup';
    const themePart = (state.themeName || 'NoTheme').substring(0, 8).replace(/[<>:"/\\|?*]/g, '_');
    const filename = `pbl2_backup_${dateStr}_${groupPart}_${themePart}.json`;

    downloadJson(dataStr, filename);
}

/** 教員配布用の初期設定ファイルを書き出す */
function exportTeacherSetup() {
    const year = new Date().getFullYear();
    const company = (state.companyName || 'Unknown').replace(/[<>:"/\\|?*]/g, '_');
    const symbol = state.groupSymbol || 'X';
    const filename = `${year}_${company}_${symbol}.json`;

    const setupData = {
        type: 'pbl2_initial_setup',
        year: year,
        companyName: state.companyName,
        themeName: state.themeName,
        groupSymbol: state.groupSymbol,
        supervisingInstructors: state.supervisingInstructors,
        members: (state.members || []).map(m => ({
            lastName: m.lastName,
            firstName: m.firstName,
            course: m.course
            // role and emailLocal are intentionally omitted
        })),
        schedule: state.schedule || DEFAULT_SCHEDULE
    };

    const dataStr = JSON.stringify(setupData, null, 2);
    downloadJson(dataStr, filename);
}

function downloadJson(dataStr, filename) {
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            let imported = JSON.parse(event.target.result);
            // Ensure imported data has IDs/timestamps
            imported = migrateData(imported);

            const doMerge = confirm(
                'インポート方式を選択してください:\n' +
                '[OK] = マージ（統合）\n' +
                '  - IDが同じデータは新しい方を採用\n' +
                '  - 新しいデータは追加\n' +
                '[キャンセル] = 上書き（現在のデータを消して置き換え）'
            );

            // 1. Preserve Self Info (always needed for restore context)
            const selfMember = (state.members || []).find(m => m.isSelf);
            const selfKey = selfMember
                ? (selfMember.emailLocal || `${selfMember.lastName || ''}${selfMember.firstName || ''}`)
                : null;

            if (doMerge) {
                // --- MERGE LOGIC ---

                // A. Tasks Merge
                if (imported.tasks && Array.isArray(imported.tasks)) {
                    imported.tasks.forEach(remoteTask => {
                        const localIndex = state.tasks.findIndex(t => t.uuid === remoteTask.uuid);

                        if (localIndex === -1) {
                            // New Task: Add
                            state.tasks.push(remoteTask);
                        } else {
                            // Existing Task: Update if remote is newer
                            const localTask = state.tasks[localIndex];
                            const localTime = new Date(localTask.updatedAt || 0).getTime();
                            const remoteTime = new Date(remoteTask.updatedAt || 0).getTime();

                            if (remoteTime > localTime) {
                                state.tasks[localIndex] = remoteTask;
                            }
                        }
                    });
                }

                // B. Members Merge (By ID preferred)
                if (imported.members && Array.isArray(imported.members)) {
                    imported.members.forEach(remoteMem => {
                        const rId = remoteMem.id;
                        const rKey = remoteMem.emailLocal || `${remoteMem.lastName || ''}${remoteMem.firstName || ''}`;

                        let localIndex = -1;
                        if (rId) {
                            localIndex = state.members.findIndex(m => m.id === rId);
                        }

                        // Fallback to name/email if ID not found or missing
                        if (localIndex === -1 && rKey) {
                            localIndex = state.members.findIndex(m =>
                                (m.emailLocal || `${m.lastName || ''}${m.firstName || ''}`) === rKey
                            );
                        }

                        if (localIndex === -1) {
                            // New Member: Add
                            state.members.push(remoteMem);
                        } else {
                            // Existing Member: Update if remote is newer
                            const localMem = state.members[localIndex];
                            const localTime = new Date(localMem.updatedAt || 0).getTime();
                            const remoteTime = new Date(remoteMem.updatedAt || 0).getTime();

                            if (remoteTime > localTime) {
                                const wasSelf = localMem.isSelf;
                                state.members[localIndex] = { ...remoteMem, isSelf: wasSelf };
                            } else {
                                // Even if older, maybe fill in missing avatar
                                if (remoteMem.avatarImage && !localMem.avatarImage) {
                                    localMem.avatarImage = remoteMem.avatarImage;
                                }
                            }
                        }
                    });
                }

                // C. Reports Merge (Work Reports & Analysis Report)
                if (imported.reports) {
                    if (!state.reports) state.reports = {};
                    Object.keys(imported.reports).forEach(key => {
                        // Skip contribution-related reports during merge to prevent overwriting/seeing others' data
                        if (key.startsWith('contribution_') || key.includes('mutual') || key.includes('reflection')) return;

                        const remoteRep = imported.reports[key];
                        const localRep = state.reports[key];

                        // Skip if remote is invalid (though unlikely)
                        if (!remoteRep) return;

                        if (!localRep) {
                            // New: Add
                            state.reports[key] = remoteRep;
                        } else {
                            // Existing: Update if remote is newer
                            const localTime = new Date(localRep.updatedAt || 0).getTime();
                            const remoteTime = new Date(remoteRep.updatedAt || 0).getTime();

                            if (remoteTime > localTime) {
                                state.reports[key] = remoteRep;
                            }
                        }
                    });
                }

                // D. Artifact Settings (Safe Merge)
                // If local has no slides for a type, allow import to fill it.
                // If local has slides, keep local (User is working on it).
                if (imported.artifactSettings) {
                    if (!state.artifactSettings) state.artifactSettings = {};
                    Object.keys(imported.artifactSettings).forEach(key => {
                        const localSet = state.artifactSettings[key];
                        const remoteSet = imported.artifactSettings[key];

                        if (remoteSet && remoteSet.slides && remoteSet.slides.length > 0) {
                            if (!localSet || !localSet.slides || localSet.slides.length === 0) {
                                state.artifactSettings[key] = remoteSet;
                            }
                        }
                    });
                }

                // E. Artifact Progress Flags (Union)
                if (imported.artifacts) {
                    Object.keys(imported.artifacts).forEach(key => {
                        if (imported.artifacts[key]) state.artifacts[key] = true;
                    });
                }

                // F. Other Settings Merge (Theme, Group, etc)
                // Or user might want to keep local settings. Let's update only if local is empty or remote is explicitly newer?
                // For simplicity, let's assume team settings sync is desired.
                if (imported.themeName) state.themeName = imported.themeName;
                if (imported.groupName) state.groupName = imported.groupName;
                if (imported.groupSymbol) state.groupSymbol = imported.groupSymbol;
                if (imported.groupLogo) state.groupLogo = imported.groupLogo;

            } else {
                // --- OVERWRITE LOGIC ---
                // Preserve local mutual evaluations so they aren't lost
                const localContributionReports = {};
                if (state.reports) {
                    Object.keys(state.reports).forEach(key => {
                        if (key.startsWith('contribution_') || key.includes('mutual') || key.includes('reflection')) {
                            localContributionReports[key] = state.reports[key];
                        }
                    });
                }

                // Merge messages so we don't lose existing board data
                const existingMessages = state.messages ? [...state.messages] : [];
                state = migrateData(imported);

                // Restore messages if import has none
                if ((!state.messages || state.messages.length === 0) && existingMessages.length > 0) {
                    state.messages = existingMessages;
                }

                // Restore local mutual evaluations
                if (!state.reports) state.reports = {};
                Object.assign(state.reports, localContributionReports);
                // Ensure required defaults
                if (!state.members) state.members = [];
                if (!state.tasks) state.tasks = [];
                if (!state.reports) state.reports = {};
                if (!state.artifacts) state.artifacts = {};
                if (!state.artifactSettings) state.artifactSettings = {};
                if (!state.messages) state.messages = [];
                if (!state.topics) state.topics = [{ id: 'general', name: '全般', createdBy: 'system', timestamp: 0 }];
                if (!state.currentTopicId) state.currentTopicId = 'general';
            }

            // 3. Post-Merge/Overwrite Self Restoration Logic
            // (Ensure local user remains "Self" and keeps their own avatar if better)
            if (selfMember && selfKey && Array.isArray(state.members)) {
                state.members.forEach(m => {
                    const mKey = m.emailLocal || `${m.lastName || ''}${m.firstName || ''}`;
                    if (mKey === selfKey) {
                        m.isSelf = true;
                        // If overwrite cleared avatar, restore it
                        if (!m.avatarImage && selfMember.avatarImage) {
                            m.avatarImage = selfMember.avatarImage;
                        }
                    } else {
                        m.isSelf = false;
                    }
                });
            }

            saveState();
            location.reload();
        } catch (err) {
            alert('ファイルの読み込みに失敗しました: ' + err.message);
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function resetData() {
    if (!confirm('本当にすべてのデータをリセットしますか？\n活動ログやメッセージ、報告書を含むすべてのデータが消去され、初期状態に戻ります。\n(※この操作は取り消せません)')) return;

    // Force clear everything from localStorage to avoid any legacy contamination
    localStorage.removeItem(STORAGE_KEY);

    // Reset state to clean defaults with tutorial messages
    state = {
        themeName: '',
        companyName: '',
        groupSymbol: '',
        groupName: '',
        groupLogo: '',
        teamsUrl: '',
        members: [],
        isConfigLocked: false,
        membersLocked: false,
        tasks: [],
        reports: {},
        artifactSettings: {},
        analysisReport: { bg: '', problem: '', solution: '', images: [] },
        artifacts: {
            poster: false,
            leaflet: false,
            pamphlet_25: false,
            slides_25: false
        },
        schedule: [], // Start empty, wait for import
        sidebarCollapsed: false,
        messages: [
            {
                id: generateId(),
                topicId: 'from_teacher',
                senderName: 'システム',
                senderRole: '案内',
                content: '【アプリの準備手順】\n1. まず、この「データ管理」画面で「ステップ1: データの初期化（リセット）」を行ってください（完了済み）。\n2. 次に、教員より配布された初期設定ファイル（202X_企業名_グループ.json）を「ステップ2: 初期設定ファイルの読み込み」ボタンから読み込んでください。',
                timestamp: Date.now(),
                color: '#4f46e5',
                readBy: []
            },
            {
                id: generateId(),
                topicId: 'from_teacher',
                senderName: 'システム',
                senderRole: '案内',
                content: '初期設定ファイルの取り込みが完了すると、年度・テーマ・ガントチャートのスケジュール・メンバー名が自動的に設定されます。',
                timestamp: Date.now() + 1000,
                color: '#4f46e5',
                readBy: []
            }
        ],
        topics: [
            { id: 'general', name: '全般', createdBy: 'system', timestamp: 0 },
            { id: 'from_teacher', name: '教員より', createdBy: 'system', timestamp: 0 }
        ],
        lastMessagesCheckTime: 0,
        currentTopicId: 'from_teacher', // Show tutorial messages immediately
        supervisingInstructors: [
            { lastName: '', firstName: '', emailLocal: '' },
            { lastName: '', firstName: '', emailLocal: '' }
        ],
        bookmarks: [],
        deliverableTargets: DEFAULT_DELIVERABLE_TARGETS
    };

    saveState();
    alert('データを完全に消去しました。\n次に、教員より配布された初期設定ファイルを読み込んでください。');
    location.reload();
}

/** 初期設定のインポート（教員配布用ファイル） */
async function importInitialSetup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (imported.type !== 'pbl2_initial_setup') {
                if (!confirm('このファイルは正規の初期設定ファイルではない可能性があります。続行しますか？')) return;
            }

            if (!confirm('初期設定を取り込みますか？\n現在のすべてのデータ（メッセージ、タスク、報告書など）がリセットされ、新しい設定で上書きされます。\n（※一度リセットすると元に戻せません）')) return;

            // Reset state with imported core data
            const now = new Date().toISOString();
            state = {
                themeName: imported.themeName || '',
                companyName: imported.companyName || '',
                groupSymbol: imported.groupSymbol || '',
                groupName: '', // Student group decides this
                groupLogo: '',
                teamsUrl: '',
                members: (imported.members || []).map(m => ({
                    ...m,
                    id: generateId(),
                    updatedAt: now,
                    isSelf: false,
                    emailLocal: '',
                    role: '' // Student group decides this
                })),
                supervisingInstructors: imported.supervisingInstructors || [
                    { lastName: '', firstName: '', emailLocal: '' },
                    { lastName: '', firstName: '', emailLocal: '' }
                ],
                schedule: imported.schedule || DEFAULT_SCHEDULE,
                tasks: [],
                reports: {},
                messages: [
                    {
                        id: generateId(),
                        topicId: 'from_teacher',
                        senderName: 'システム',
                        senderRole: '完了案内',
                        content: '【設定完了】初期設定の取り込みが完了しました。\n\n【次のステップ】\n1. メンバー表から自分の名前を探し、「自分」ボタンをオンにしてください。\n2. 自分の学籍番号（メールID）を入力してください。\n3. リーダーやエンジニアなどの詳細な役割を話し合って決定し、選択してください。',
                        timestamp: Date.now(),
                        color: '#10b981',
                        readBy: []
                    }
                ],
                topics: [
                    { id: 'general', name: '全般', createdBy: 'system', timestamp: 0 },
                    { id: 'from_teacher', name: '教員より', createdBy: 'system', timestamp: 0 }
                ],
                artifactSettings: {},
                analysisReport: { bg: '', problem: '', solution: '', images: [] },
                artifacts: {
                    poster: false,
                    leaflet: false,
                    pamphlet_25: false,
                    slides_25: false
                },
                sidebarCollapsed: false,
                lastMessagesCheckTime: 0,
                currentTopicId: 'general',
                isConfigLocked: true, // LOCK the configuration upon import
                membersLocked: false, // Don't lock the whole list, just names (via isConfigLocked)
                bookmarks: [],
                deliverableTargets: imported.deliverableTargets || DEFAULT_DELIVERABLE_TARGETS
            };

            saveState();
            alert('初期設定を読み込みました。アプリを再起動します。');
            location.reload();
        } catch (err) {
            console.error(err);
            alert('ファイルの解読に失敗しました。JSON形式が正しいか確認してください。');
        }
    };
    reader.readAsText(file);
}

// --- Dashboard Stats ---
function renderAll() {
    updateDisplayInfo();
    renderRecentActivity();
    renderUpcomingSchedule();
    renderRoleGuide();
    updateMessageNotification(); // Ensure sidebar badge is updated on load
    if (typeof updatePollNotification === 'function') updatePollNotification();
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
                text: `第${iter}回作業報告書を提出しました`,
                icon: 'check-circle'
            });
        } else if (r.updatedAt) {
            activities.push({
                date: new Date(r.updatedAt),
                text: `第${iter}回の報告書の下書きを保存しました`,
                icon: 'edit'
            });
        }
    });

    // Artifacts
    const artifactNames = {
        poster: '事業企画ポスター（中間発表）',
        leaflet: '事業企画リーフレット（中間発表）',
        pamphlet_25: '製品・サービスパンフレット（最終発表）',
        slides_25: '最終プレゼンスライド（最終発表）'
    };

    Object.keys(state.artifactSettings || {}).forEach(key => {
        const setting = state.artifactSettings[key];
        if (setting && setting.updatedAt) {
            activities.push({
                date: new Date(setting.updatedAt),
                text: `提出物 [${artifactNames[key] || key}] を更新しました`,
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
        list.innerHTML = '<li class="empty-msg">活動Eまだありません</li>';
    }
}

function renderUpcomingSchedule() {
    const list = document.getElementById('upcoming-schedule-list');
    const now = new Date();
    const schedule = (state.schedule && state.schedule.length > 0) ? state.schedule : [];
    const upcoming = schedule.filter(s => new Date(s.date) >= now).slice(0, 3);

    if (upcoming.length > 0) {
        list.innerHTML = upcoming.map(s => `
            <li>
                <div class="schedule-date">${s.date}</div>
                <div class="schedule-label">${s.label}</div>
            </li>
        `).join('');

        document.getElementById('next-event-name').textContent = upcoming[0].label;
        document.getElementById('next-event-date').textContent = upcoming[0].date;
    } else {
        list.innerHTML = '<li class="empty-msg">今後の予定はありません（初期設定待ち）</li>';
        document.getElementById('next-event-name').textContent = '未設定';
        document.getElementById('next-event-date').textContent = '-';
    }
}

/* --- Message Board Functions --- */

/** Render attachment thumbnails inside a message bubble (returns HTML string) */
function renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    const html = attachments.map(att => {
        if (att.type === 'image') {
            return `<img src="${att.data}" class="message-thumbnail" alt="${escapeHtml(att.name || '')}" onclick="openLightbox('${att.data}')">`;
        } else {
            return `<a href="${att.data}" class="message-file-link" target="_blank" download="${escapeHtml(att.name || 'file')}">
                <i data-lucide="file"></i>
                <span>${escapeHtml(att.name || 'ファイル')}</span>
            </a>`;
        }
    }).join('');
    return `<div class="message-attachments">${html}</div>`;
}

function renderMessages() {
    const list = document.getElementById('messages-list');
    if (!list) return;

    list.innerHTML = '';

    const currentTopicId = state.currentTopicId || 'general';
    const filteredMessages = state.messages ? state.messages.filter(m => (m.topicId || 'general') === currentTopicId) : [];

    if (filteredMessages.length === 0) {
        list.innerHTML = `
            <div class="empty-messages">
                <i data-lucide="message-square-dashed" style="width:48px;height:48px;color:var(--primary);filter:drop-shadow(0 0 10px var(--primary-glow));"></i>
                <p>この話題にはまだメッセージはありません</p>
                <p style="font-size:0.8rem;">最初のメッセージを投稿しましょう</p>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    const selfMember = state.members ? state.members.find(m => m.isSelf) : null;
    const selfKey = selfMember ? (selfMember.emailLocal || ((selfMember.lastName || '') + (selfMember.firstName || ''))) : 'guest';

    let lastSenderKey = null;

    let lastTimestamp = null;
    let lastDate = null;

    filteredMessages.forEach(msg => {
        const dateObj = new Date(msg.timestamp);
        const dateStr = dateObj.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });

        if (dateStr !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'message-date-separator';
            sep.innerHTML = `<span>${dateStr}</span>`;
            list.appendChild(sep);
            lastDate = dateStr;
            lastSenderKey = null; // Reset grouping on new date
        }

        const isMe = selfKey && (msg.senderKey === selfKey);
        // LINE-style grouping: same sender within 1 minute
        const isGrouped = (msg.senderKey === lastSenderKey) && (Math.abs(msg.timestamp - lastTimestamp) < 60000);

        const div = document.createElement('div');
        div.className = `message-item ${isMe ? 'self' : ''} ${isGrouped ? 'is-grouped' : ''}`;

        const timeStr = dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        const initials = msg.senderName ? msg.senderName.charAt(0) : '?';
        const senderMember = state.members ? state.members.find(m => (m.emailLocal || (m.lastName + (m.firstName || ''))) === msg.senderKey) : null;
        const senderIndex = senderMember ? state.members.indexOf(senderMember) : -1;

        const senderColor = senderMember
            ? (senderMember.avatarColor || AVATAR_COLORS[senderIndex % AVATAR_COLORS.length])
            : (msg.avatarColor || '#64748b');

        const avatarSrc = senderMember ? senderMember.avatarImage : (msg.avatarData || null);
        const avatarBg = senderMember ? (senderMember.avatarImage ? 'transparent' : senderColor) : senderColor;
        const avatarInner = avatarSrc ? `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;display:block;">` : initials;

        const readBy = msg.readBy || [];
        const readCount = readBy.length;
        const readByMembers = [];
        const readByNames = [];
        if (readCount > 0 && state.members) {
            readBy.forEach(readerKey => {
                const m = state.members.find(mem => (mem.emailLocal || ((mem.lastName || '') + (mem.firstName || ''))) === readerKey);
                if (m) {
                    readByMembers.push(m);
                    readByNames.push((m.lastName || '') + (m.firstName || ''));
                }
            });
        }

        const readTooltip = readByNames.length > 0 ? `既読: ${readByNames.join(', ')}` : '未読';

        const readChipsHtml = readByMembers.map(m => {
            const initialsChar = m.lastName ? m.lastName.charAt(0) : '?';
            const readerColor = m.avatarColor || AVATAR_COLORS[state.members.indexOf(m) % AVATAR_COLORS.length];
            const readerAvatar = m.avatarImage
                ? `<img src="${m.avatarImage}" class="reader-avatar-icon">`
                : `<div class="reader-avatar-icon" style="background:${readerColor}">${initialsChar}</div>`;
            return `<div class="read-chip">${readerAvatar}<span class="reader-name">${m.lastName || ''}</span></div>`;
        }).join('');

        const readLabel = readCount > 0
            ? `<div class="message-read-status" onclick="toggleReadParticipants(event, '${msg.id}')">既読 ${readCount}</div><div id="read-list-${msg.id}" class="read-participants-popup">${readChipsHtml}</div>`
            : '';


        const reactionsHtml = msg.reactions ? Object.entries(msg.reactions).map(([emoji, users]) => {
            const hasReacted = selfKey && users.includes(selfKey);
            const userNames = users.map(uKey => {
                const m = state.members.find(mem => (mem.emailLocal || ((mem.lastName || '') + (mem.firstName || ''))) === uKey);
                return m ? `${m.lastName || ''}${m.firstName || ''}` : uKey;
            }).join(', ');
            return `<div class="reaction-badge ${hasReacted ? 'active' : ''}" onclick="addReaction('${msg.id}', '${emoji}')" title="${emoji}: ${userNames}">${emoji} ${users.length}</div>`;
        }).join('') : '';

        const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;

        div.innerHTML = `<div class="message-avatar" style="background:${avatarBg};" title="${msg.senderName}">${avatarInner}</div><div class="message-content-wrapper">${!isGrouped ? `<div class="message-meta"><span>${msg.senderName}</span></div>` : ''}<div class="message-bubble-row"><div class="message-bubble">${formatMessageContent(msg.content)}${renderAttachments(msg.attachments)}${isMe ? `<button class="btn-delete-msg" onclick="deleteMessage('${msg.id}')" title="削除">×</button>` : ''}</div><div class="message-read-status-wrapper">${isMe ? readLabel : ''}<span class="message-time">${timeStr}</span></div></div>${hasReactions ? `<div class="message-reactions-wrapper"><div class="message-reactions">${reactionsHtml}</div><button class="btn-add-reaction" onclick="toggleReactionPicker(event, '${msg.id}')" title="リアクションを追加"><i data-lucide="smile-plus" style="width:14px; height:14px;"></i></button></div>` : `<div class="message-reactions-wrapper only-button"><button class="btn-add-reaction" onclick="toggleReactionPicker(event, '${msg.id}')" title="リアクションを追加"><i data-lucide="smile-plus" style="width:14px; height:14px;"></i></button></div>`}</div>`;



        list.appendChild(div);

        lastSenderKey = msg.senderKey;
        lastTimestamp = msg.timestamp;
    });
    if (window.lucide) lucide.createIcons();
}


function markMessagesAsRead() {
    if (!state.messages) return;

    const selfMember = state.members.find(m => m.isSelf);
    const selfKey = selfMember
        ? (selfMember.emailLocal || ((selfMember.lastName || '') + (selfMember.firstName || '')))
        : 'guest';

    let updated = false;
    // Mark only visible messages in current topic as read? Or all?
    // Let's mark ALL unread messages as read when opening board, regardless of topic,
    // OR just messages in the current topic when viewing it.
    // LINE style: Opening a chat room marks messages in THAT room as read.
    // Here we have "Topics" which act like rooms. So mark only current topic messages.

    const currentTopicId = state.currentTopicId || 'general';

    state.messages.forEach(msg => {
        if ((msg.topicId || 'general') !== currentTopicId) return;

        // If I am the sender, I don't "read" it ensuring I don't increment my own count?
        // Usually chat apps count sender as "read" implicitly or just ignore.
        // Let's ignore sender reading their own message for the count display purposes,
        // OR add to readBy safely.
        // To behave like LINE: Sender sees "Read X" for OTHERS.
        // Receiver sees nothing special effectively.

        if (msg.senderKey === selfKey) return; // Don't mark my own messages as read by me (redundant)

        if (!msg.readBy) msg.readBy = [];
        if (!msg.readBy.includes(selfKey)) {
            msg.readBy.push(selfKey);
            updated = true;
        }
    });

    if (updated) {
        updateMessageNotification();
    }
}

function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    const content = input.value.trim();

    // Allow empty text if there are attachments
    if (!content && pendingAttachments.length === 0) return;

    // Find self member - if none set, prompt but allow anonymous send
    const selfMember = state.members ? state.members.find(m => m.isSelf) : null;
    if (!selfMember) {
        const proceed = confirm(
            'メンバー設定で「自分」がまだ選択されていません。\n' +
            '「ゲスト」として送信しますか？（OK）\n' +
            '「キャンセル」でメンバー設定へ移動します。'
        );
        if (!proceed) {
            switchView('members');
            return;
        }
    }

    const senderName = selfMember
        ? ((selfMember.lastName || '') + ' ' + (selfMember.firstName || '')).trim()
        : 'ゲスト';
    const senderKey = selfMember
        ? (selfMember.emailLocal || `${selfMember.lastName || ''}${selfMember.firstName || ''}`)
        : 'guest_' + Date.now();

    const senderIndex = selfMember ? state.members.indexOf(selfMember) : -1;
    const defaultColor = senderIndex !== -1 ? AVATAR_COLORS[senderIndex % AVATAR_COLORS.length] : '#64748b';

    const newMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        senderKey: senderKey,
        senderName: senderName || 'ゲスト',
        senderRole: selfMember ? selfMember.role : '',
        avatarColor: selfMember ? (selfMember.avatarColor || defaultColor) : '#64748b',
        avatarData: selfMember ? selfMember.avatarImage : null,
        content: content,
        timestamp: new Date().toISOString(),
        readBy: [],
        topicId: state.currentTopicId || 'general',
        attachments: pendingAttachments.slice() // shallow copy
    };

    const originalMessages = state.messages ? [...state.messages] : [];
    if (!state.messages) state.messages = [];
    state.messages.push(newMessage);

    // Reset inputs
    input.value = '';
    pendingAttachments = [];
    renderAttachmentPreviews();

    // Update check time so I don't notify myself
    state.lastMessagesCheckTime = Date.now();

    // Try to save
    if (!saveState()) {
        // Rollback on failure
        state.messages = originalMessages;
        renderMessages();
        return;
    }

    renderMessages();
    updateMessageNotification(); // Ensure badge is updated after sending
    scrollToBottomMessages();
}

function scrollToBottomMessages() {
    const list = document.getElementById('messages-list');
    if (list) list.scrollTop = list.scrollHeight;
}

/**
 * Returns total unread messages for 'Self' across all active topics.
 */
function getUnreadMessageCount() {
    if (!state.messages || state.messages.length === 0) return 0;

    const selfMember = state.members.find(m => m.isSelf);
    const selfKey = selfMember ? (selfMember.emailLocal || ((selfMember.lastName || '') + (selfMember.firstName || ''))) : 'guest';

    const activeTopicIds = new Set((state.topics || []).map(t => t.id));
    activeTopicIds.add('general');
    activeTopicIds.add('from_teacher');

    return state.messages.filter(m => {
        const tId = m.topicId || 'general';
        if (!activeTopicIds.has(tId)) return false;

        const isMe = (m.senderKey === selfKey);
        const hasRead = m.readBy && m.readBy.includes(selfKey);
        return !isMe && !hasRead;
    }).length;
}

function updateMessageNotification() {
    const badge = document.getElementById('msg-badge');
    if (!badge) return;

    const unreadCount = getUnreadMessageCount();

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    // Always update the topic list badges too if it's currently rendered
    if (document.getElementById('topic-list')) {
        renderTopics();
    }
}

function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

function formatMessageContent(content) {
    let escaped = escapeHtml(content);
    // Linkify URLs - improved to handle ending punctuation and style
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    escaped = escaped.replace(urlPattern, '<a href="$1" class="message-link" target="_blank" rel="noopener noreferrer">$1</a>');

    // Highlight Mentions (@Name)
    // Matches @FollowedByNonWhitespace
    // We should ideally match against known member names, but simple highlighting is often enough.
    // To match actual members:
    if (state.members) {
        state.members.forEach(m => {
            const name = (m.lastName || '') + (m.firstName || '');
            if (!name) return;
            // Case insensitive replace
            const regex = new RegExp(`@${name}`, 'gi');
            escaped = escaped.replace(regex, `<span class="mention-highlight">@${name}</span>`);
        });
    }

    // Also highlight generic @... if not caught above?
    // escaped = escaped.replace(/(@[^\s<]+)/g, '<span class="mention-highlight">$1</span>');

    return escaped;
}

/* --- Mention Logic --- */
function handleMentionInput(e) {
    const input = e.target;
    const val = input.value;
    const cursorPos = input.selectionStart;

    // Check if we are potentially typing a mention
    // Look for @ before cursor
    const lastAtPos = val.lastIndexOf('@', cursorPos - 1);

    if (lastAtPos !== -1) {
        // text between @ and cursor
        const query = val.substring(lastAtPos + 1, cursorPos);

        // Ensure no spaces (simple mention rule)
        if (!/\s/.test(query)) {
            startMention(query, lastAtPos);
            return;
        }
    }

    closeMention();
}

function handleMentionKeydown(e) {
    if (!mentionState.isActive) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        mentionState.selectedIndex = (mentionState.selectedIndex + 1) % mentionState.filteredMembers.length;
        renderMentionSuggestions();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        mentionState.selectedIndex = (mentionState.selectedIndex - 1 + mentionState.filteredMembers.length) % mentionState.filteredMembers.length;
        renderMentionSuggestions();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionState.filteredMembers[mentionState.selectedIndex]);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
    }
}

function startMention(query, atIndex) {
    mentionState.isActive = true;
    mentionState.query = query;
    mentionState.cursorPos = atIndex;

    // Filter members
    const lowerQ = query.toLowerCase();
    mentionState.filteredMembers = state.members.filter(m => {
        const full = ((m.lastName || '') + (m.firstName || '')).toLowerCase();
        return full.includes(lowerQ);
    });

    if (mentionState.filteredMembers.length === 0) {
        closeMention();
        return;
    }

    mentionState.selectedIndex = 0;
    renderMentionSuggestions();
}

function closeMention() {
    mentionState.isActive = false;
    const box = document.getElementById('mention-suggestions');
    if (box) {
        box.classList.remove('active');
        box.style.display = 'none';
    }
}

function renderMentionSuggestions() {
    const box = document.getElementById('mention-suggestions');
    if (!box) return;

    box.innerHTML = '';
    box.classList.add('active');
    box.style.display = 'flex';

    mentionState.filteredMembers.forEach((m, idx) => {
        const div = document.createElement('div');
        div.className = `mention-item ${idx === mentionState.selectedIndex ? 'selected' : ''}`;

        const initial = (m.lastName || '?').charAt(0);
        const color = m.avatarColor || '#64748b';
        const name = (m.lastName || '') + (m.firstName || '');

        div.innerHTML = `
                                                <div class="mention-avatar" style="background:${color};">${initial}</div>
                                                <span>${name}</span>
                                                <span style="font-size:0.75rem;color:var(--text-dim);margin-left:auto;">${m.role || ''}</span>
                                                `;

        div.onmousedown = (e) => {
            e.preventDefault(); // Prevent blur
            selectMention(m);
        };

        box.appendChild(div);
    });
}

function selectMention(member) {
    if (!member) return;

    const input = document.getElementById('message-input');
    const val = input.value;
    const name = (member.lastName || '') + (member.firstName || '');

    // Replace @query with @name + space
    const before = val.substring(0, mentionState.cursorPos);
    // Find end of current word/query
    // actually, handleMentionInput logic assumes we are at the end of query cursor
    // But if user moved cursor back, we might need adjustments.
    // For simplicity: replace from @ to cursor.

    // We used handleMentionInput which tracks query from lastAtPos to SelectionStart.
    // So we replace that range.

    const after = val.substring(input.selectionStart);

    const newValue = before + '@' + name + ' ' + after;

    input.value = newValue;

    // Move cursor
    const newCursorPos = before.length + name.length + 2; // @ + name + space
    input.setSelectionRange(newCursorPos, newCursorPos);
    input.focus();

    closeMention();
}

/* --- Topic Management --- */
function renderTopics() {
    const list = document.getElementById('topic-list');
    if (!list) return;

    list.innerHTML = '';

    if (!state.topics) {
        state.topics = [
            { id: 'general', name: '全般', createdBy: 'system', timestamp: 0 },
            { id: 'from_teacher', name: '教員より', createdBy: 'system', timestamp: 0 }
        ];
    }

    // Ensure 'from_teacher' exists if legacy state
    if (!state.topics.some(t => t.id === 'from_teacher')) {
        state.topics.push({ id: 'from_teacher', name: '教員より', createdBy: 'system', timestamp: 0 });
    }

    // Sort: Fixed topics first (general, then from_teacher), then others by timestamp
    const fixedOrder = ['general', 'from_teacher'];

    const fixedTopics = state.topics.filter(t => fixedOrder.includes(t.id));
    // Sort fixed topics by fixedOrder
    fixedTopics.sort((a, b) => fixedOrder.indexOf(a.id) - fixedOrder.indexOf(b.id));

    const userTopics = state.topics.filter(t => !fixedOrder.includes(t.id));
    userTopics.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Render Function
    const renderItem = (topic) => {
        const isActive = (state.currentTopicId || 'general') === topic.id;

        // Count unread
        const selfMember = state.members ? state.members.find(m => m.isSelf) : null;
        const selfKey = selfMember ? (selfMember.emailLocal || ((selfMember.lastName || '') + (selfMember.firstName || ''))) : 'guest';

        const unread = (state.messages || []).filter(m => {
            return (m.topicId || 'general') === topic.id &&
                m.senderKey !== selfKey &&
                (!m.readBy || !m.readBy.includes(selfKey));
        }).length;

        const div = document.createElement('div');
        div.className = `topic-item ${isActive ? 'active' : ''}`;
        div.onclick = () => switchTopic(topic.id);

        // Specific icon or style for fixed topics?
        const isFixed = fixedOrder.includes(topic.id);
        const deleteBtn = !isFixed && isActive ? `<button class="btn-delete-topic" onclick="deleteTopic('${topic.id}', event)" title="削除">×</button>` : '';

        div.innerHTML = `
                                                    <span class="topic-name">${isFixed ? (topic.id === 'from_teacher' ? '<i data-lucide="graduation-cap" style="width:14px;height:14px;vertical-align:middle;"></i> ' : '# ') : '# '}${escapeHtml(topic.name)}</span>
                                                    ${unread > 0 ? `<span class="topic-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
                                                    ${deleteBtn}
                                                    `;
        list.appendChild(div);
    };

    // Render Fixed Topics
    fixedTopics.forEach(renderItem);

    // Render Divider if user topics exist
    if (userTopics.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'topic-divider';
        divider.innerText = '個別話題';
        list.appendChild(divider);
    }

    // Render User Topics
    userTopics.forEach(renderItem);

    if (window.lucide) lucide.createIcons();
}

function switchTopic(topicId) {
    if (state.currentTopicId === topicId) return;

    state.currentTopicId = topicId;

    const topic = state.topics.find(t => t.id === topicId);
    if (topic) {
        const titleEl = document.getElementById('current-topic-name');
        if (titleEl) titleEl.textContent = topic.name;
    }

    // Mark messages in new topic as read
    markMessagesAsRead();
    saveState();

    updateMessageNotification();
    renderTopics();
    renderMessages();
    scrollToBottomMessages();
}


function createNewTopic() {
    const name = prompt('新しい話題の名称を入力してください:');
    if (!name || !name.trim()) return;

    const id = 'topic_' + Date.now().toString(36);
    const newTopic = {
        id: id,
        name: name.trim(),
        createdBy: 'user', // could store user ID
        timestamp: Date.now()
    };

    if (!state.topics) state.topics = [];
    state.topics.push(newTopic);

    switchTopic(id);
}

function deleteTopic(topicId, e) {
    e.stopPropagation();
    if (!confirm('この話題を削除しますか？\n（含まれるメッセージは表示されなくなりますが、データ上は残ります）')) return;

    state.topics = state.topics.filter(t => t.id !== topicId);

    // If deleted current, switch to general
    if (state.currentTopicId === topicId) {
        switchTopic('general');
    } else {
        updateMessageNotification(); // Overall count changes if topic with unread is deleted
    }
    saveState();
}


/* --- Message Reaction Logic --- */
window.toggleReactionPicker = (e, msgId) => {
    e.stopPropagation();
    const existing = document.querySelector('.reaction-picker');
    if (existing) {
        const same = existing.dataset.msgId === msgId;
        existing.remove();
        if (same) return;
    }

    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.dataset.msgId = msgId;

    const emojis = ['👍', '✔️', '😆', '😮', '😢', '🙏'];
    emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.className = 'emoji-option';
        span.innerText = emoji;
        span.onclick = (e) => {
            e.stopPropagation();
            addReaction(msgId, emoji);
            picker.remove();
        };
        picker.appendChild(span);
    });

    e.currentTarget.parentElement.appendChild(picker);

    // Close picker when clicking elsewhere
    const closePicker = () => {
        picker.remove();
        document.removeEventListener('click', closePicker);
    };
    setTimeout(() => document.addEventListener('click', closePicker), 10);
};

window.toggleReadParticipants = (e, msgId) => {
    e.stopPropagation();
    const popup = document.getElementById(`read-list-${msgId}`);
    if (!popup) return;

    // Close other popups first
    document.querySelectorAll('.read-participants-popup.active').forEach(p => {
        if (p !== popup) p.classList.remove('active');
    });

    popup.classList.toggle('active');

    if (popup.classList.contains('active')) {
        const close = () => {
            popup.classList.remove('active');
            document.removeEventListener('click', close);
        };
        setTimeout(() => document.addEventListener('click', close), 10);
    }
};


window.addReaction = (msgId, emoji) => {
    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    const selfMember = state.members.find(m => m.isSelf);
    const selfKey = selfMember ? (selfMember.emailLocal || ((selfMember.lastName || '') + (selfMember.firstName || ''))) : 'guest';

    const index = msg.reactions[emoji].indexOf(selfKey);
    if (index === -1) {
        msg.reactions[emoji].push(selfKey);
    } else {
        msg.reactions[emoji].splice(index, 1);
        if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    }

    saveState();
    renderMessages();
};

function deleteMessage(msgId) {
    if (!confirm('このメッセージを削除しますか？')) return;

    // Safety check: ensure I am the sender (although UI hides button, user could call directly)
    const selfMember = state.members.find(m => m.isSelf);
    const selfKey = selfMember ? (selfMember.emailLocal || (selfMember.lastName + selfMember.firstName)) : null;

    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return;

    if (msg.senderKey !== selfKey) {
        alert('自分のメッセージ以外は削除できません');
        return;
    }

    state.messages = state.messages.filter(m => m.id !== msgId);
    saveState();
    renderMessages();
    updateMessageNotification(); // Update badge after deletion
}

/* --- Attachment Logic --- */
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    let processedCount = 0;

    files.forEach(file => {
        const sizeMB = file.size / 1024 / 1024;
        const isImage = file.type.startsWith('image/');

        // Warning for large non-image files (risky for localStorage)
        if (!isImage && sizeMB > 3) {
            alert(`❌ ファイル「${file.name}」(${sizeMB.toFixed(1)}MB) は大きすぎます。\n画像以外のファイルは3MB以下にしてください。`);
            processedCount++;
            return;
        }

        const reader = new FileReader();
        reader.onload = async (ev) => {
            let dataUrl = ev.target.result;
            const type = isImage ? 'image' : 'file';

            if (type === 'image') {
                // Tiered aggressive compression as requested (quality-degradation is OK)
                let targetMax = 800;
                let q = 0.25;

                if (sizeMB > 10) {
                    targetMax = 480; q = 0.08;
                } else if (sizeMB > 5) {
                    targetMax = 640; q = 0.12;
                } else if (sizeMB > 2) {
                    targetMax = 800; q = 0.18;
                }

                dataUrl = await compressImage(dataUrl, targetMax, targetMax, q);
            }

            pendingAttachments.push({
                name: file.name,
                type: type,
                data: dataUrl,
                size: file.size
            });

            processedCount++;
            if (processedCount === files.length) {
                renderAttachmentPreviews();
                // Clear input
                document.getElementById('message-file-input').value = '';
            }
        };
        reader.readAsDataURL(file);
    });
}

function removeAttachment(index) {
    pendingAttachments.splice(index, 1);
    renderAttachmentPreviews();
}

function renderAttachmentPreviews() {
    const container = document.getElementById('attachment-preview-area');
    if (!container) return; // Guard clause

    if (pendingAttachments.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = pendingAttachments.map((att, idx) => {
        let thumbContent = '';
        if (att.type === 'image') {
            thumbContent = `<img src="${att.data}" alt="Preview" onclick="window.open('${att.data}')">`;
        } else {
            thumbContent = `<div style="color:var(--text-dim);"><i data-lucide="file"></i></div>`;
        }

        return `
            <div class="attachment-preview-item" title="${escapeHtml(att.name)}">
                ${thumbContent}
                <button class="btn-remove-attachment" onclick="removeAttachment(${idx})" title="削除">
                    <i data-lucide="x" style="width:10px; height:10px;"></i>
                </button>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// Alias so old callers of renderAttachmentPreview() (without 's') still work
function renderAttachmentPreview() { renderAttachmentPreviews(); }

/* --- Deliverables Folder Management --- */
function renderDeliverables(folderId = 'root') {
    const container = document.getElementById('deliverables-content');
    const breadcrumb = document.getElementById('deliverables-breadcrumb');
    const board = document.getElementById('deliverables-board');
    const editor = document.getElementById('deliverables-editor');

    if (!container) return;

    // Reset visibility and clear content
    container.innerHTML = '';
    container.style.display = 'grid'; // Ensure grid layout for root and reports

    if (board) board.style.display = 'none';
    if (editor) editor.style.display = 'none';

    const breadcrumbElement = document.getElementById('deliverables-breadcrumb');
    if (breadcrumbElement) {
        breadcrumbElement.innerHTML = '';
        breadcrumbElement.style.display = 'flex'; // Ensure breadcrumb is visible
    }
    if (folderId === 'root') {
        if (breadcrumbElement) breadcrumbElement.innerHTML = '<span class="breadcrumb-item active"><i data-lucide="package" style="width:14px;height:14px;"></i> 提出物ルート</span>';
    } else {
        const folderLabels = {
            reports: { label: '活動報告書', icon: 'file-text' },
            assignment: { label: '課題設定レポート', icon: 'clipboard-list' },
            presentation: { label: '発表用資料', icon: 'presentation' },
            contribution: { label: '貢献度調査', icon: 'users-2' },
            group_eval: { label: '相互評価シート', icon: 'vibrate' },
            feedback: { label: '振り返りシート', icon: 'refresh-ccw' }
        };
        const folderCtx = folderLabels[folderId] || { label: 'フォルダ', icon: 'folder' };

        if (breadcrumbElement) breadcrumbElement.innerHTML = `
            <span class="breadcrumb-item" onclick="renderDeliverables('root')" style="cursor:pointer">
                <i data-lucide="package" style="width:14px;height:14px;"></i> 提出物ルート
            </span>
            <span class="breadcrumb-item active">
                <i data-lucide="${folderCtx.icon}" style="width:14px;height:14px;"></i> ${folderCtx.label}
            </span>
        `;
    }

    if (folderId === 'root') {
        const rootFolders = DELIVERABLE_MASTER_LIST;

        rootFolders.forEach(f => {
            const item = createDeliverableItem(f.name, f.icon, f.desc, f.color);
            item.onclick = () => {
                const multiFolders = ['reports', 'contribution', 'group_eval', 'feedback'];
                if (multiFolders.includes(f.id)) {
                    renderDeliverables(f.id);
                } else {
                    gotoDeliverable(f.id);
                }
            };
            container.appendChild(item);
        });
    } else if (folderId === 'presentation') {
        // Show the Board View instead of the grid items
        container.style.display = 'none';
        document.getElementById('deliverables-board').style.display = 'flex';
        renderArtifactBoard();
    } else if (folderId === 'reports') {
        const startIter = state.deliverableTargets?.workReportStart || 3;
        const currentSchedule = (state.schedule && state.schedule.length > 0) ? state.schedule : DEFAULT_SCHEDULE;
        currentSchedule.forEach(s => {
            if (s.id < startIter) return;
            const r = state.reports[s.id];
            const isSubmitted = r && r.submitted;
            const statusLabel = isSubmitted ? '提出済み' : (r && r.content ? '下書き' : '未作成');
            const statusColor = isSubmitted ? 'var(--success)' : (r && r.content ? 'var(--warning)' : 'var(--text-dim)');

            const item = createDeliverableItem(
                `第${s.id}回 実施報告書`,
                'file-text',
                `${s.date} | ${statusLabel}`,
                statusColor,
                isSubmitted
            );
            item.onclick = () => {
                switchView('reports');
                switchTab('work-report');
                if (isSubmitted) {
                    openWorkReport(s.id);
                    setTimeout(() => previewWorkReport(), 100);
                } else {
                    openWorkReport(s.id);
                }
            };
            container.appendChild(item);
        });
    } else if (['contribution', 'group_eval', 'feedback'].includes(folderId)) {
        const mapping = {
            contribution: { key: 'contribution', label: '貢献度調査', icon: 'users-2', color: '#ec4899', onceSuffix: 'まで' },
            group_eval: { key: 'mutual', label: '相互評価シート', icon: 'vibrate', color: '#8b5cf6', onceSuffix: '' },
            feedback: { key: 'reflection', label: '振り返りシート', icon: 'refresh-ccw', color: '#0ea5e9', onceSuffix: '' }
        };
        const ctx = mapping[folderId];
        const targets = (state.deliverableTargets || DEFAULT_DELIVERABLE_TARGETS)[ctx.key] || [];

        targets.forEach(iter => {
            const storageKey = `${folderId}_${iter}`;
            const r = state.reports[storageKey];
            let isSub = false;
            let hasD = false;

            if (['contribution', 'group_eval'].includes(folderId)) {
                const members = state.members || [];
                if (r && members.length > 0) {
                    let subCount = 0; let startCount = 0;
                    members.forEach(m => {
                        const ur = r[m.id];
                        if (ur) {
                            if (ur.submitted) subCount++;
                            if (ur.updatedAt || ur.evaluations) startCount++;
                        }
                    });
                    isSub = subCount >= members.length;
                    hasD = !isSub && startCount > 0;
                }
            } else {
                isSub = !!r?.submitted;
                hasD = !isSub && !!r?.content;
            }

            const statusLabel = isSub ? '提出済み' : (hasD ? '下書き' : '未作成');
            const statusColor = isSub ? 'var(--success)' : (hasD ? 'var(--warning)' : 'var(--text-dim)');
            const iterLabel = iter === 13 ? `中間発表${ctx.onceSuffix}` : `最終発表${ctx.onceSuffix}`;

            const item = createDeliverableItem(
                `${ctx.label}（${iterLabel}）`,
                ctx.icon,
                statusLabel,
                statusColor,
                isSub
            );
            item.onclick = () => gotoDeliverable(folderId, iter);
            container.appendChild(item);
        });
    } else if (folderId === 'assignment') {
        const ctx = { tab: 'analysis-report', label: '課題設定レポート', icon: 'clipboard-list', color: '#10b981' };
        const isSub = !!state.reports[ctx.tab]?.submitted;
        const statusLabel = isSub ? '提出済み' : (state.reports[ctx.tab]?.content ? '作成中' : '未作成');

        const item = createDeliverableItem(ctx.label, ctx.icon, statusLabel, ctx.color, isSub);
        item.onclick = () => { switchView('reports'); switchTab(ctx.tab); };
        container.appendChild(item);
    }

    if (window.lucide) lucide.createIcons();
}


function createDeliverableItem(name, icon, desc, color, isCompleted = false) {
    const div = document.createElement('div');
    div.className = `deliverable-item ${isCompleted ? 'completed' : ''}`;
    div.innerHTML = `
        <div class="deliverable-icon" style="color: ${color}; background: ${color}15;">
            <i data-lucide="${icon}"></i>
        </div>
        <div class="deliverable-info">
            <div class="deliverable-name">${escapeHtml(name)}</div>
            <div class="deliverable-desc">${escapeHtml(desc)}</div>
        </div>
        ${isCompleted ? '<div class="deliverable-check"><i data-lucide="check"></i></div>' : ''}
    `;
    return div;
}





/* --- Bookmark Logic --- */

// Helper to fetch page title via public CORS proxy
async function fetchPageTitle(url) {
    if (!url || !url.startsWith('http')) return "";
    try {
        // Use allorigins.win as a proxy
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (!response.ok) return "";
        const data = await response.json();
        if (!data || !data.contents) return "";
        const html = data.contents;
        // Basic Title regex
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (match && match[1]) {
            return match[1].trim()
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'");
        }
        return "";
    } catch (e) {
        console.error("Title fetch failed:", e);
        return "";
    }
}

function renderBookmarks() {
    const tbody = document.getElementById('bookmark-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!state.bookmarks) state.bookmarks = [];

    state.bookmarks.forEach((bm, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <a href="${bm.url}" target="_blank" class="bookmark-link-btn" title="リンクを開く">
                        <i data-lucide="external-link" style="width:14px;height:14px;"></i> ${escapeHtml(bm.url.length > 30 ? bm.url.substring(0, 30) + '...' : bm.url)}
                    </a>
                    <input type="url" value="${bm.url}" onchange="updateBookmarkField(${index}, 'url', this.value, true)" class="table-input" style="font-size: 0.75rem;" placeholder="https://...">
                </div>
            </td>
            <td>
                <input type="text" id="bm-title-${index}" value="${escapeHtml(bm.title || "")}" onchange="updateBookmarkField(${index}, 'title', this.value)" class="table-input" placeholder="タイトル">
            </td>
            <td>
                <textarea onchange="updateBookmarkField(${index}, 'description', this.value)" class="table-input" rows="1" placeholder="メモ">${escapeHtml(bm.description || "")}</textarea>
            </td>
            <td style="font-size: 0.8rem;">
                <div style="font-weight:600;">${escapeHtml(bm.recorderName || "不明")}</div>
                <div style="color:var(--text-dim); font-size:10px;">${escapeHtml(bm.role || "")}</div>
            </td>
            <td style="font-size: 0.8rem; color: var(--text-dim);">
                ${bm.date || "--"}
            </td>
            <td>
                <button class="mini-btn delete" onclick="deleteBookmark(${index})" title="削除">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Reset Footer Data
    const self = state.members.find(m => m.isSelf);
    const recorderInfo = document.getElementById('new-bm-recorder-info');
    if (recorderInfo) {
        if (self) {
            recorderInfo.innerHTML = `<div style="font-weight:600;">${escapeHtml((self.lastName || '') + (self.firstName || ''))}</div><div style="font-size:10px;">${escapeHtml(self.role || "")}</div>`;
        } else {
            recorderInfo.innerText = "自分未設定";
        }
    }
    const dateInfo = document.getElementById('new-bm-date');
    if (dateInfo) {
        dateInfo.innerText = new Date().toISOString().split('T')[0];
    }

    // Add event listener to new URL field for auto-title (only if not already added)
    const newUrlInput = document.getElementById('new-bm-url');
    if (newUrlInput && !newUrlInput.dataset.listenerAdded) {
        newUrlInput.addEventListener('blur', async () => {
            const url = newUrlInput.value.trim();
            if (url && url.startsWith('http')) {
                newUrlInput.classList.add('loading');
                const titleInput = document.getElementById('new-bm-title');
                if (titleInput && !titleInput.value) {
                    titleInput.placeholder = "タイトル取得中...";
                    const title = await fetchPageTitle(url);
                    if (title) {
                        titleInput.value = title;
                    }
                    titleInput.placeholder = "自動取得されます";
                }
                newUrlInput.classList.add('success-flash'); // Visual cue
                setTimeout(() => newUrlInput.classList.remove('success-flash'), 1000);
                newUrlInput.classList.remove('loading');
            }
        });
        newUrlInput.dataset.listenerAdded = "true";
    }

    if (window.lucide) lucide.createIcons();
}

window.addNewBookmark = async () => {
    const urlInput = document.getElementById('new-bm-url');
    const titleInput = document.getElementById('new-bm-title');
    const descInput = document.getElementById('new-bm-desc');

    const url = urlInput.value.trim();
    let title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (!url) {
        alert('URLを入力してください');
        return;
    }

    const self = state.members.find(m => m.isSelf);
    const recorderName = self ? ((self.lastName || '') + (self.firstName || '')).trim() : 'ゲスト';
    const role = self ? (self.role || '') : '';

    const newBm = {
        url: url,
        title: title || url, // Default to URL if title not yet fetched
        description: description,
        recorderName: recorderName,
        role: role,
        date: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
    };

    if (!state.bookmarks) state.bookmarks = [];
    state.bookmarks.push(newBm);

    // If title was empty, and wasn't manually entered, try fetching
    if (!title) {
        fetchPageTitle(url).then(fetchedTitle => {
            if (fetchedTitle) {
                newBm.title = fetchedTitle;
                saveState();
                renderBookmarks();
            }
        });
    }

    urlInput.value = '';
    titleInput.value = '';
    descInput.value = '';

    saveState();
    renderBookmarks();
};

window.updateBookmarkField = async (index, field, value, triggerAutoTitle = false) => {
    if (!state.bookmarks[index]) return;

    state.bookmarks[index][field] = value;
    state.bookmarks[index].updatedAt = new Date().toISOString();

    if (triggerAutoTitle && field === 'url' && value.startsWith('http')) {
        const title = await fetchPageTitle(value);
        if (title) {
            state.bookmarks[index].title = title;
            renderBookmarks();
        }
    }

    saveState();
};

window.deleteBookmark = (index) => {
    if (confirm('このブックマークを削除しますか？')) {
        state.bookmarks.splice(index, 1);
        saveState();
        renderBookmarks();
    }
};

// --- TEAMWORK LOGIC ---
window.renderTeamwork = () => {
    if (!state.teamwork) state.teamwork = { intro: '', members: {} };

    // Intro
    const introEl = document.getElementById('team-intro-content');
    if (introEl) introEl.innerHTML = state.teamwork.intro || 'チームの理念や目標を入力してください...';

    // Members
    const grid = document.getElementById('teamwork-members-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // We use state.members to get the list of members
    const members = state.members || [];
    members.forEach((m, index) => {
        const profile = state.teamwork.members[m.id] || { strengths: '', interests: '', goals: '', photo: '' };

        const fullName = `${m.lastName || ''}${m.firstName || ''}`.trim() || m.name || 'メンバー';
        const initials = fullName ? fullName.slice(0, 1) : '?';
        const avatarColor = m.avatarColor || AVATAR_COLORS[index % AVATAR_COLORS.length];
        const teamworkPhoto = profile.photo || m.avatarImage;
        const hasEffectiveImage = !!teamworkPhoto;
        const avatarInner = hasEffectiveImage
            ? `<img src="${teamworkPhoto}">`
            : initials;
        const avatarBg = hasEffectiveImage ? 'transparent' : avatarColor;

        const card = document.createElement('div');
        card.className = 'member-card';
        card.innerHTML = `
            <div class="member-card-header">
                <div class="member-photo-wrap" onclick="triggerMemberPhotoUpload('${m.id}')" style="background:${avatarBg};">
                    ${avatarInner}
                </div>
                <div>
                    <div class="member-name">${fullName}</div>
                    <div class="member-role">${m.role || 'メンバー'}</div>
                    <div class="member-course">${m.course || 'コース未設定'}</div>
                </div>
            </div>
            
            <div class="member-info-section">
                <div class="member-info-label"><i data-lucide="zap"></i> 強み・得意なこと</div>
                <div class="member-info-content" contenteditable="true" onblur="saveMemberProfile('${m.id}', 'strengths', this.innerHTML)">
                    ${profile.strengths || '自分の得意なスキルや性格的な強みを書きましょう'}
                </div>
            </div>

            <div class="member-info-section">
                <div class="member-info-label"><i data-lucide="heart"></i> 興味・関心</div>
                <div class="member-info-content" contenteditable="true" onblur="saveMemberProfile('${m.id}', 'interests', this.innerHTML)">
                    ${profile.interests || 'このテーマに関する興味や、個人的な関心事'}
                </div>
            </div>

            <div class="member-info-section">
                <div class="member-info-label"><i data-lucide="target"></i> してみたいこと</div>
                <div class="member-info-content" contenteditable="true" onblur="saveMemberProfile('${m.id}', 'goals', this.innerHTML)">
                    ${profile.goals || 'このプロジェクトで挑戦したい役割や学びたいこと'}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.saveTeamworkData = (key, val) => {
    if (!state.teamwork) state.teamwork = { intro: '', members: {} };
    state.teamwork[key] = val;
    saveState();
};

window.saveMemberProfile = (memberId, field, val) => {
    if (!state.teamwork) state.teamwork = { intro: '', members: {} };
    if (!state.teamwork.members[memberId]) state.teamwork.members[memberId] = {};
    state.teamwork.members[memberId][field] = val;
    saveState();
};

window.triggerMemberPhotoUpload = (memberId) => {
    const input = document.getElementById('member-photo-input');
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (re) => {
                const compressed = await compressImage(re.target.result, 200, 200, 0.5);
                if (!state.teamwork.members[memberId]) state.teamwork.members[memberId] = {};
                state.teamwork.members[memberId].photo = compressed;
                saveState();
                renderTeamwork();
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
};

// --- TECH CORE CANVAS LOGIC ---
let techCanvasState = {
    canvas: null,
    ctx: null,
    currentTool: 'select',
    strokeColor: '#3b82f6',
    fillColor: '#ffffff',
    noFill: true,
    lineWidth: 2,
    lineDash: 'solid',
    fontSize: 16,
    isBold: false,
    isItalic: false,
    shapes: [],
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentShape: null,
    textEditor: null,
    polylinePoints: [],
    copiedShape: null,
    undoStack: [],
    redoStack: [],
    isResizing: false,
    resizeHandle: null,
    isDraggingPoint: false,
    activePointIndex: -1,
    selectedShapes: [],
    isSelecting: false,
    selectionRect: null
};

window.initTechCanvas = () => {
    const canvas = document.getElementById('tech-core-canvas');
    if (!canvas) return;

    techCanvasState.canvas = canvas;
    techCanvasState.ctx = canvas.getContext('2d');

    const wrapper = canvas.parentElement;
    canvas.width = wrapper.offsetWidth;
    canvas.height = wrapper.offsetHeight;

    if (!state.techCore) state.techCore = { shapes: [] };
    techCanvasState.shapes = state.techCore.shapes;
    techCanvasState.undoStack = [JSON.stringify(techCanvasState.shapes)];
    techCanvasState.redoStack = [];

    // UI Listeners
    const toolBtns = document.querySelectorAll('.canvas-tool-btn, .canvas-tool-btn-sm');
    toolBtns.forEach(btn => {
        btn.onclick = (e) => {
            if (btn.id === 'shape-selector-btn') {
                e.stopPropagation();
                document.getElementById('shape-dropdown').classList.toggle('active');
                return;
            }
            if (btn.id === 'btn-text-bold') {
                techCanvasState.isBold = !techCanvasState.isBold;
                btn.classList.toggle('active', techCanvasState.isBold);
                return;
            }
            if (btn.id === 'btn-text-italic') {
                techCanvasState.isItalic = !techCanvasState.isItalic;
                btn.classList.toggle('active', techCanvasState.isItalic);
                return;
            }

            if (btn.classList.contains('canvas-tool-btn-sm')) return;

            toolBtns.forEach(b => {
                if (!b.classList.contains('canvas-tool-btn-sm')) b.classList.remove('active');
            });
            btn.classList.add('active');
            techCanvasState.currentTool = btn.getAttribute('data-tool');

            // Toggle text styles visibility
            document.querySelector('.text-only-style').style.display = (techCanvasState.currentTool === 'text') ? 'flex' : 'none';
        };
    });

    document.getElementById('btn-image-upload').onclick = () => {
        document.getElementById('canvas-image-input').click();
    };

    document.getElementById('canvas-image-input').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 300;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = (h / w) * maxDim; w = maxDim; }
                    else { w = (w / h) * maxDim; h = maxDim; }
                }
                techCanvasState.shapes.push({
                    type: 'image',
                    x1: 50, y1: 50, x2: 50 + w, y2: 50 + h,
                    data: event.target.result
                });
                saveTechCanvas();
                drawTechCanvas();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset
    };

    // Shape dropdown selection
    document.querySelectorAll('#shape-dropdown .menu-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const tool = item.getAttribute('data-tool');
            techCanvasState.currentTool = tool;

            toolBtns.forEach(b => b.classList.remove('active'));
            document.getElementById('shape-selector-btn').classList.add('active');
            document.getElementById('shape-dropdown').classList.remove('active');

            document.querySelector('.text-only-style').style.display = 'none';
        };
    });

    document.addEventListener('click', () => {
        const dropdown = document.getElementById('shape-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    });

    // Style listeners
    const strokePicker = document.getElementById('canvas-stroke-color');
    strokePicker.oninput = (e) => {
        techCanvasState.strokeColor = e.target.value;
        if (techCanvasState.selectedShapes.length > 0) {
            techCanvasState.selectedShapes.forEach(s => s.strokeColor = e.target.value);
            saveTechCanvas(false);
            drawTechCanvas();
        }
    };
    strokePicker.onchange = () => saveTechCanvas(true);

    const fillPicker = document.getElementById('canvas-fill-color');
    fillPicker.oninput = (e) => {
        techCanvasState.fillColor = e.target.value;
        if (techCanvasState.selectedShapes.length > 0) {
            techCanvasState.selectedShapes.forEach(s => {
                s.fillColor = e.target.value;
            });
            techCanvasState.noFill = false;
            document.getElementById('canvas-no-fill').checked = false;
            saveTechCanvas(false);
            drawTechCanvas();
        }
    };
    fillPicker.onchange = () => saveTechCanvas(true);
    document.getElementById('canvas-no-fill').onchange = (e) => {
        techCanvasState.noFill = e.target.checked;
        if (techCanvasState.selectedShapes.length > 0) {
            techCanvasState.selectedShapes.forEach(s => {
                s.fillColor = e.target.checked ? null : techCanvasState.fillColor;
            });
            saveTechCanvas();
            drawTechCanvas();
        }
    };
    document.getElementById('canvas-line-width').onchange = (e) => {
        techCanvasState.lineWidth = parseInt(e.target.value);
        if (techCanvasState.selectedShapes.length > 0) {
            techCanvasState.selectedShapes.forEach(s => s.lineWidth = techCanvasState.lineWidth);
            saveTechCanvas();
            drawTechCanvas();
        }
    };
    document.getElementById('canvas-line-dash').onchange = (e) => {
        techCanvasState.lineDash = e.target.value;
        if (techCanvasState.selectedShapes.length > 0) {
            techCanvasState.selectedShapes.forEach(s => s.lineDash = e.target.value);
            saveTechCanvas();
            drawTechCanvas();
        }
    };
    document.getElementById('canvas-font-size').onchange = (e) => {
        techCanvasState.fontSize = parseInt(e.target.value);
        if (techCanvasState.selectedShapes.length > 0) {
            techCanvasState.selectedShapes.forEach(s => {
                if (s.type === 'text') s.fontSize = techCanvasState.fontSize;
            });
            saveTechCanvas();
            drawTechCanvas();
        }
    };

    // Edit actions buttons
    document.getElementById('btn-copy').onclick = (e) => { e.stopPropagation(); copySelectedShape(); };
    document.getElementById('btn-paste').onclick = (e) => { e.stopPropagation(); pasteShape(); };
    document.getElementById('btn-duplicate').onclick = (e) => { e.stopPropagation(); duplicateSelectedShape(); };
    document.getElementById('btn-delete').onclick = (e) => { e.stopPropagation(); deleteSelectedShape(); };
    document.getElementById('btn-undo').onclick = (e) => { e.stopPropagation(); undoAction(); };
    document.getElementById('btn-redo').onclick = (e) => { e.stopPropagation(); redoAction(); };

    // Canvas Events
    canvas.oncontextmenu = (e) => {
        if (techCanvasState.currentTool === 'polyline') e.preventDefault();
    };

    canvas.ondblclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const clickedShape = [...techCanvasState.shapes].reverse().find(s => isPointInShape(x, y, s));
        if (clickedShape && clickedShape.type === 'text') {
            startTextEditing(clickedShape.x1, clickedShape.y1, clickedShape);
        }
    };

    canvas.onmousedown = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);

        if (techCanvasState.currentTool === 'polyline') {
            if (e.button === 0) { // Left click
                techCanvasState.polylinePoints.push({ x, y });
            } else if (e.button === 2) { // Right click
                if (techCanvasState.polylinePoints.length > 1) {
                    techCanvasState.shapes.push({
                        type: 'polyline',
                        points: [...techCanvasState.polylinePoints],
                        strokeColor: techCanvasState.strokeColor,
                        lineWidth: techCanvasState.lineWidth,
                        lineDash: techCanvasState.lineDash
                    });
                    techCanvasState.polylinePoints = [];
                    saveTechCanvas();
                }
            }
            drawTechCanvas();
            return;
        }

        if (techCanvasState.textEditor) finishTextEditing();

        // Check for resize handles or polyline points if something is selected
        if (techCanvasState.currentTool === 'select' && techCanvasState.selectedShapes.length === 1) {
            const s = techCanvasState.selectedShapes[0];
            // Polyline points
            if (s.type === 'polyline') {
                for (let i = 0; i < s.points.length; i++) {
                    const p = s.points[i];
                    if (Math.abs(x - p.x) < 12 && Math.abs(y - p.y) < 12) {
                        techCanvasState.isDraggingPoint = true;
                        techCanvasState.activePointIndex = i;
                        techCanvasState.startX = x;
                        techCanvasState.startY = y;
                        return;
                    }
                }
            }

            // Resize handles
            const handles = getResizeHandles(s);
            for (const h of handles) {
                if (Math.abs(x - h.x) < 12 && Math.abs(y - h.y) < 12) {
                    techCanvasState.isResizing = true;
                    techCanvasState.resizeHandle = h.type;
                    techCanvasState.startX = x;
                    techCanvasState.startY = y;
                    return;
                }
            }
        }

        techCanvasState.startX = x;
        techCanvasState.startY = y;

        if (techCanvasState.currentTool === 'select') {
            const clickedShape = [...techCanvasState.shapes].reverse().find(s => isPointInShape(x, y, s));
            if (clickedShape) {
                if (e.shiftKey) {
                    if (techCanvasState.selectedShapes.includes(clickedShape)) {
                        techCanvasState.selectedShapes = techCanvasState.selectedShapes.filter(s => s !== clickedShape);
                    } else {
                        techCanvasState.selectedShapes.push(clickedShape);
                    }
                } else if (!techCanvasState.selectedShapes.includes(clickedShape)) {
                    techCanvasState.selectedShapes = [clickedShape];
                }
                techCanvasState.isDrawing = true; // For moving
                syncToolbarUI(clickedShape);
                drawTechCanvas();
            } else {
                if (!e.shiftKey) techCanvasState.selectedShapes = [];
                techCanvasState.isSelecting = true;
                techCanvasState.selectionRect = { x1: x, y1: y, x2: x, y2: y };
                drawTechCanvas();
            }
        } else if (techCanvasState.currentTool === 'text') {
            startTextEditing(x, y);
            techCanvasState.isDrawing = false;
        } else {
            techCanvasState.isDrawing = true;
            techCanvasState.currentShape = {
                type: techCanvasState.currentTool,
                x1: x, y1: y, x2: x, y2: y,
                strokeColor: techCanvasState.strokeColor,
                fillColor: techCanvasState.noFill ? null : techCanvasState.fillColor,
                lineWidth: techCanvasState.lineWidth,
                lineDash: techCanvasState.lineDash,
                fontSize: techCanvasState.fontSize,
                isBold: techCanvasState.isBold,
                isItalic: techCanvasState.isItalic,
                text: ''
            };
        }
    };

    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (techCanvasState.isResizing && techCanvasState.selectedShapes.length === 1) {
            const s = techCanvasState.selectedShapes[0];
            const handle = techCanvasState.resizeHandle;
            if (handle.includes('n')) s.y1 = y;
            if (handle.includes('s')) s.y2 = y;
            if (handle.includes('w')) s.x1 = x;
            if (handle.includes('e')) s.x2 = x;
            drawTechCanvas();
            return;
        }

        if (techCanvasState.isDraggingPoint && techCanvasState.selectedShapes.length === 1) {
            const p = techCanvasState.selectedShapes[0].points[techCanvasState.activePointIndex];
            p.x = x;
            p.y = y;
            drawTechCanvas();
            return;
        }

        if (!techCanvasState.isDrawing) return;

        if (techCanvasState.currentTool === 'select' && techCanvasState.selectedShapes.length > 0) {
            const dx = x - techCanvasState.startX;
            const dy = y - techCanvasState.startY;
            techCanvasState.selectedShapes.forEach(s => {
                if (s.points) {
                    s.points.forEach(p => { p.x += dx; p.y += dy; });
                } else {
                    s.x1 += dx; s.y1 += dy;
                    if (s.x2 !== undefined) { s.x2 += dx; s.y2 += dy; }
                }
            });
            techCanvasState.startX = x;
            techCanvasState.startY = y;
        } else if (techCanvasState.currentShape) {
            techCanvasState.currentShape.x2 = x;
            techCanvasState.currentShape.y2 = y;
        }
        drawTechCanvas();
    };

    canvas.onmouseup = () => {
        if (techCanvasState.isResizing || techCanvasState.isDraggingPoint) {
            saveTechCanvas();
        }
        if (techCanvasState.isSelecting) {
            const r = techCanvasState.selectionRect;
            const xMin = Math.min(r.x1, r.x2);
            const xMax = Math.max(r.x1, r.x2);
            const yMin = Math.min(r.y1, r.y2);
            const yMax = Math.max(r.y1, r.y2);

            const newlySelected = techCanvasState.shapes.filter(s => {
                const sx1 = Math.min(s.x1, s.x2 || s.x1);
                const sx2 = Math.max(s.x1, s.x2 || s.x1);
                const sy1 = Math.min(s.y1, s.y2 || s.y1);
                const sy2 = Math.max(s.y1, s.y2 || s.y1);
                return sx1 < xMax && sx2 > xMin && sy1 < yMax && sy2 > yMin;
            });
            techCanvasState.selectedShapes = newlySelected;
            techCanvasState.isSelecting = false;
            techCanvasState.selectionRect = null;
            drawTechCanvas();
        }
        techCanvasState.isResizing = false;
        techCanvasState.isDraggingPoint = false;

        if (techCanvasState.currentShape) {
            techCanvasState.shapes.push(techCanvasState.currentShape);
            techCanvasState.currentShape = null;
            saveTechCanvas();
        }
        techCanvasState.isDrawing = false;
        drawTechCanvas();
    };

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const view = document.getElementById('view-tech-core');
        if (!view || !view.classList.contains('active')) return;
        if (techCanvasState.textEditor) return;

        const isCtrl = e.ctrlKey || e.metaKey;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedShape();
        }
        if (isCtrl && e.key === 'c') {
            copySelectedShape();
        }
        if (isCtrl && e.key === 'v') {
            pasteShape();
        }
        if (isCtrl && e.key === 'd') {
            e.preventDefault();
            duplicateSelectedShape();
        }
        if (isCtrl && e.key === 'z') {
            e.preventDefault();
            undoAction();
        }
        if (isCtrl && e.key === 'y') {
            e.preventDefault();
            redoAction();
        }
    });

    drawTechCanvas();
};

function undoAction() {
    if (techCanvasState.undoStack.length > 1) {
        techCanvasState.redoStack.push(techCanvasState.undoStack.pop());
        const snapshot = techCanvasState.undoStack[techCanvasState.undoStack.length - 1];
        techCanvasState.shapes = JSON.parse(snapshot);
        saveTechCanvas(false);
        drawTechCanvas();
    }
}

function redoAction() {
    if (techCanvasState.redoStack.length > 0) {
        const snapshot = techCanvasState.redoStack.pop();
        techCanvasState.undoStack.push(snapshot);
        techCanvasState.shapes = JSON.parse(snapshot);
        saveTechCanvas(false);
        drawTechCanvas();
    }
}

function deleteSelectedShape() {
    if (techCanvasState.selectedShapes.length > 0) {
        techCanvasState.shapes = techCanvasState.shapes.filter(s => !techCanvasState.selectedShapes.includes(s));
        techCanvasState.selectedShapes = [];
        saveTechCanvas();
        drawTechCanvas();
    }
}

function copySelectedShape() {
    if (techCanvasState.selectedShapes.length > 0) {
        techCanvasState.copiedShapes = JSON.parse(JSON.stringify(techCanvasState.selectedShapes));
    }
}

function pasteShape() {
    if (techCanvasState.copiedShapes && techCanvasState.copiedShapes.length > 0) {
        const newShapes = JSON.parse(JSON.stringify(techCanvasState.copiedShapes));
        newShapes.forEach(ns => {
            ns.x1 += 20; ns.y1 += 20;
            if (ns.x2 !== undefined) { ns.x2 += 20; ns.y2 += 20; }
            if (ns.points) {
                ns.points.forEach(p => { p.x += 20; p.y += 20; });
            }
            techCanvasState.shapes.push(ns);
        });
        techCanvasState.selectedShapes = newShapes;
        saveTechCanvas();
        drawTechCanvas();
    }
}

function duplicateSelectedShape() {
    if (techCanvasState.selectedShapes.length > 0) {
        const newShapes = JSON.parse(JSON.stringify(techCanvasState.selectedShapes));
        newShapes.forEach(ns => {
            ns.x1 += 20; ns.y1 += 20;
            if (ns.x2 !== undefined) { ns.x2 += 20; ns.y2 += 20; }
            if (ns.points) {
                ns.points.forEach(p => { p.x += 20; p.y += 20; });
            }
            techCanvasState.shapes.push(ns);
        });
        techCanvasState.selectedShapes = newShapes;
        saveTechCanvas();
        drawTechCanvas();
    }
}

function isPointInShape(x, y, s) {
    if (s.type === 'rect' || s.type === 'rounded-rect' || s.type === 'text') {
        const x1 = Math.min(s.x1, s.x2 || s.x1 + 100);
        const x2 = Math.max(s.x1, s.x2 || s.x1 + 100);
        const y1 = Math.min(s.y1, s.y2 || s.y1 + 20);
        const y2 = Math.max(s.y1, s.y2 || s.y1 + 20);
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    }
    if (s.type === 'circle') {
        const rx = Math.abs(s.x2 - s.x1) / 2;
        const ry = Math.abs(s.y2 - s.y1) / 2;
        if (rx === 0 || ry === 0) return false;
        const cx = (s.x1 + s.x2) / 2;
        const cy = (s.y1 + s.y2) / 2;
        return (Math.pow(x - cx, 2) / Math.pow(rx, 2)) + (Math.pow(y - cy, 2) / Math.pow(ry, 2)) <= 1;
    }
    if (s.type === 'line' || s.type === 'arrow') {
        const dist = distToSegment({ x, y }, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 });
        return dist < 10;
    }
    if (s.type === 'polyline') {
        for (let i = 0; i < s.points.length - 1; i++) {
            const dist = distToSegment({ x, y }, s.points[i], s.points[i + 1]);
            if (dist < 10) return true;
        }
    }
    if (s.type === 'triangle' || s.type === 'diamond' || s.type === 'image') {
        // Simple bounding box check for hit detection
        const x1 = Math.min(s.x1, s.x2);
        const x2 = Math.max(s.x1, s.x2);
        const y1 = Math.min(s.y1, s.y2);
        const y2 = Math.max(s.y1, s.y2);
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    }
    return false;
}

function distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 == 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
}

function startTextEditing(x, y, existingShape = null) {
    const wrapper = document.getElementById('tech-canvas-wrapper');
    const textarea = document.createElement('textarea');
    textarea.className = 'canvas-text-editor';
    textarea.style.left = x + 'px';
    textarea.style.top = y + 'px';

    const fsize = existingShape ? existingShape.fontSize : techCanvasState.fontSize;
    const isBold = existingShape ? existingShape.isBold : techCanvasState.isBold;
    const isItalic = existingShape ? existingShape.isItalic : techCanvasState.isItalic;
    const color = existingShape ? existingShape.strokeColor : techCanvasState.strokeColor;

    textarea.style.fontSize = fsize + 'px';
    textarea.style.fontWeight = isBold ? 'bold' : 'normal';
    textarea.style.fontStyle = isItalic ? 'italic' : 'normal';
    textarea.style.color = color;
    textarea.style.width = '200px';
    textarea.style.height = (fsize * 2) + 'px';
    textarea.value = existingShape ? existingShape.text : '';

    wrapper.appendChild(textarea);
    textarea.focus();

    techCanvasState.textEditor = {
        el: textarea,
        x: x,
        y: y,
        editingShape: existingShape
    };

    textarea.onmousedown = (e) => e.stopPropagation();
    textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finishTextEditing();
        }
        if (e.key === 'Escape') {
            finishTextEditing();
        }
    };
}

function finishTextEditing() {
    if (!techCanvasState.textEditor) return;
    const { el, x, y, editingShape } = techCanvasState.textEditor;
    const text = el.value.trim();

    if (text) {
        if (editingShape) {
            editingShape.text = text;
            editingShape.strokeColor = techCanvasState.strokeColor;
            editingShape.fontSize = techCanvasState.fontSize;
            editingShape.isBold = techCanvasState.isBold;
            editingShape.isItalic = techCanvasState.isItalic;
        } else {
            techCanvasState.shapes.push({
                type: 'text',
                x1: x, y1: y,
                strokeColor: techCanvasState.strokeColor,
                fontSize: techCanvasState.fontSize,
                isBold: techCanvasState.isBold,
                isItalic: techCanvasState.isItalic,
                text: text
            });
        }
        saveTechCanvas();
        drawTechCanvas();
    }
    el.remove();
    techCanvasState.textEditor = null;
}

function drawArrow(ctx, x1, y1, x2, y2, color, width) {
    const headlen = 10;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

function drawTechCanvas() {
    const { ctx, canvas, shapes, currentShape } = techCanvasState;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let i = 0; i < canvas.width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for (let i = 0; i < canvas.height; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

    if (techCanvasState.isSelecting && techCanvasState.selectionRect) {
        const r = techCanvasState.selectionRect;
        ctx.strokeStyle = '#3b82f6';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
    }

    // Drawing Polyline in progress
    if (techCanvasState.polylinePoints.length > 0) {
        ctx.strokeStyle = techCanvasState.strokeColor;
        ctx.lineWidth = techCanvasState.lineWidth;
        const dash = techCanvasState.lineDash === 'dashed' ? [10, 5] : (techCanvasState.lineDash === 'dotted' ? [2, 4] : []);
        ctx.setLineDash(dash);
        ctx.beginPath();
        techCanvasState.polylinePoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // Final point handles
        techCanvasState.polylinePoints.forEach(p => {
            ctx.fillStyle = '#fff';
            ctx.setLineDash([]);
            ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
            ctx.strokeRect(p.x - 3, p.y - 3, 6, 6);
        });
    }

    const renderShape = (s) => {
        ctx.strokeStyle = s.strokeColor || '#3b82f6';
        ctx.fillStyle = s.fillColor || 'transparent';
        ctx.lineWidth = s.lineWidth || 2;

        const dash = s.lineDash === 'dashed' ? [10, 5] : (s.lineDash === 'dotted' ? [2, 4] : []);
        ctx.setLineDash(dash);

        if (s.type === 'rect') {
            if (s.fillColor) ctx.fillRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
            ctx.strokeRect(s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
        } else if (s.type === 'rounded-rect') {
            const r = 10;
            const w = s.x2 - s.x1;
            const h = s.y2 - s.y1;
            ctx.beginPath();
            ctx.moveTo(s.x1 + r, s.y1);
            ctx.lineTo(s.x1 + w - r, s.y1);
            ctx.quadraticCurveTo(s.x1 + w, s.y1, s.x1 + w, s.y1 + r);
            ctx.lineTo(s.x1 + w, s.y1 + h - r);
            ctx.quadraticCurveTo(s.x1 + w, s.y1 + h, s.x1 + w - r, s.y1 + h);
            ctx.lineTo(s.x1 + r, s.y1 + h);
            ctx.quadraticCurveTo(s.x1, s.y1 + h, s.x1, s.y1 + h - r);
            ctx.lineTo(s.x1, s.y1 + r);
            ctx.quadraticCurveTo(s.x1, s.y1, s.x1 + r, s.y1);
            ctx.closePath();
            if (s.fillColor) ctx.fill();
            ctx.stroke();
        } else if (s.type === 'circle') {
            const rx = Math.abs(s.x2 - s.x1) / 2;
            const ry = Math.abs(s.y2 - s.y1) / 2;
            const cx = (s.x1 + s.x2) / 2;
            const cy = (s.y1 + s.y2) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            if (s.fillColor) ctx.fill();
            ctx.stroke();
        } else if (s.type === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(s.x1 + (s.x2 - s.x1) / 2, s.y1);
            ctx.lineTo(s.x1, s.y2);
            ctx.lineTo(s.x2, s.y2);
            ctx.closePath();
            if (s.fillColor) ctx.fill();
            ctx.stroke();
        } else if (s.type === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(s.x1 + (s.x2 - s.x1) / 2, s.y1);
            ctx.lineTo(s.x2, s.y1 + (s.y2 - s.y1) / 2);
            ctx.lineTo(s.x1 + (s.x2 - s.x1) / 2, s.y2);
            ctx.lineTo(s.x1, s.y1 + (s.y2 - s.y1) / 2);
            ctx.closePath();
            if (s.fillColor) ctx.fill();
            ctx.stroke();
        } else if (s.type === 'arrow') {
            drawArrow(ctx, s.x1, s.y1, s.x2, s.y2, s.strokeColor, s.lineWidth);
        } else if (s.type === 'line') {
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
            ctx.stroke();
        } else if (s.type === 'text') {
            ctx.setLineDash([]);
            const fontStyle = (s.isItalic ? 'italic ' : '') + (s.isBold ? 'bold ' : '');
            ctx.font = `${fontStyle}${s.fontSize || 16}px sans-serif`;
            ctx.fillStyle = s.strokeColor;
            ctx.fillText(s.text, s.x1, s.y1 + (s.fontSize || 16));
        } else if (s.type === 'polyline') {
            ctx.beginPath();
            s.points.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        } else if (s.type === 'image') {
            const img = new Image();
            img.src = s.data;
            if (img.complete) {
                ctx.drawImage(img, s.x1, s.y1, s.x2 - s.x1, s.y2 - s.y1);
            } else {
                img.onload = () => drawTechCanvas();
            }
        }
    };

    shapes.forEach(renderShape);
    if (currentShape) renderShape(currentShape);

    // Selection handles
    if (techCanvasState.selectedShapes.length > 0) {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;

        techCanvasState.selectedShapes.forEach(s => {
            if (s.type === 'polyline') {
                s.points.forEach((p, i) => {
                    ctx.fillStyle = (i === techCanvasState.activePointIndex && techCanvasState.isDraggingPoint && techCanvasState.selectedShapes.length === 1) ? '#3b82f6' : '#fff';
                    ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
                    ctx.strokeRect(p.x - 4, p.y - 4, 8, 8);
                });
            } else if (s.type !== 'text') {
                // Resize handles only if exactly one shape selected
                if (techCanvasState.selectedShapes.length === 1) {
                    const handles = getResizeHandles(s);
                    handles.forEach(h => {
                        ctx.fillStyle = techCanvasState.resizeHandle === h.type && techCanvasState.isResizing ? '#3b82f6' : '#fff';
                        ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
                        ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
                    });
                }
                // Bounding box
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(Math.min(s.x1, s.x2) - 2, Math.min(s.y1, s.y2) - 2, Math.abs(s.x2 - s.x1) + 4, Math.abs(s.y2 - s.y1) + 4);
            } else if (s.type === 'text') {
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(s.x1 - 2, s.y1 - 2, 100, (s.fontSize || 16) * 1.5);
            }
        });
    }
}

function getResizeHandles(s) {
    const xMin = Math.min(s.x1, s.x2);
    const xMax = Math.max(s.x1, s.x2);
    const yMin = Math.min(s.y1, s.y2);
    const yMax = Math.max(s.y1, s.y2);
    const midX = (xMin + xMax) / 2;
    const midY = (yMin + yMax) / 2;

    return [
        { x: xMin, y: yMin, type: 'nw' },
        { x: midX, y: yMin, type: 'n' },
        { x: xMax, y: yMin, type: 'ne' },
        { x: xMax, y: midY, type: 'e' },
        { x: xMax, y: yMax, type: 'se' },
        { x: midX, y: yMax, type: 's' },
        { x: xMin, y: yMax, type: 'sw' },
        { x: xMin, y: midY, type: 'w' }
    ];
}

function syncToolbarUI(s) {
    if (s.strokeColor) {
        techCanvasState.strokeColor = s.strokeColor;
        document.getElementById('canvas-stroke-color').value = s.strokeColor;
    }
    if (s.fillColor !== undefined) {
        if (s.fillColor === null) {
            techCanvasState.noFill = true;
            document.getElementById('canvas-no-fill').checked = true;
        } else {
            techCanvasState.noFill = false;
            techCanvasState.fillColor = s.fillColor;
            document.getElementById('canvas-fill-color').value = s.fillColor;
            document.getElementById('canvas-no-fill').checked = false;
        }
    }
    if (s.lineWidth) {
        techCanvasState.lineWidth = s.lineWidth;
        document.getElementById('canvas-line-width').value = s.lineWidth;
    }
    if (s.lineDash) {
        techCanvasState.lineDash = s.lineDash;
        document.getElementById('canvas-line-dash').value = s.lineDash;
    }
    if (s.fontSize) {
        techCanvasState.fontSize = s.fontSize;
        document.getElementById('canvas-font-size').value = s.fontSize;
    }
}

function drawArrow(ctx, fromx, fromy, tox, toy, color, lineWidth) {
    const headlen = 10;
    const angle = Math.atan2(toy - fromy, tox - fromx);
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2;
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function saveTechCanvas(shouldRecord = true) {
    if (!state.techCore) state.techCore = { shapes: [] };
    state.techCore.shapes = techCanvasState.shapes;
    if (shouldRecord) {
        techCanvasState.undoStack.push(JSON.stringify(techCanvasState.shapes));
        techCanvasState.redoStack = [];
        // Limit history to 50 steps
        if (techCanvasState.undoStack.length > 50) techCanvasState.undoStack.shift();
    }
    saveState();
}

window.clearTechCanvas = () => {
    if (confirm('キャンバスをクリアしますか？')) {
        techCanvasState.shapes = [];
        techCanvasState.polylinePoints = [];
        techCanvasState.selectedShapes = [];
        saveTechCanvas();
        drawTechCanvas();
    }
};

// --- BUSINESS MODEL CANVAS (BMC) LOGIC ---
let bmcState = {
    activeSection: null,
    activeStickyId: null,
    draggedSticky: null,
    draggedSection: null
};

window.renderBMC = () => {
    if (!state.bmc) state.bmc = {};

    // Load title
    const titleInput = document.getElementById('bmc-title-input');
    if (titleInput) titleInput.value = state.bmc.title || '';

    const bmcSections = ['KP', 'KA', 'KR', 'VP', 'CR', 'CH', 'CS', 'COST', 'REV'];
    const w51hSections = ['5W_WHO', '5W_WHAT', '5W_WHEN', '5W_WHERE', '5W_WHY', '5W_HOW'];
    const c3Sections = ['3C_CUSTOMER', '3C_COMPETITOR', '3C_COMPANY'];

    const allSections = [...bmcSections, ...w51hSections, ...c3Sections];

    allSections.forEach(sid => {
        const area = document.getElementById(`bmc-area-${sid}`);
        if (!area) return;
        area.innerHTML = '';

        const stickies = state.bmc[sid] || [];
        stickies.sort((a, b) => (a.order || 0) - (b.order || 0));

        stickies.forEach(s => {
            // Ensure compatibility with old data format
            if (!s.content && s.text) s.content = s.text;
            const stickyEl = createStickyElement(sid, s);
            area.appendChild(stickyEl);
        });

        // Event for section context menu
        const sectionEl = document.querySelector(`.bmc-section[data-section="${sid}"]`);
        if (sectionEl) {
            sectionEl.oncontextmenu = (e) => showBMCContextMenu(e, sid);
        }

        // Drop Zone
        area.ondragover = (e) => {
            e.preventDefault();
            area.classList.add('drag-over');
        };
        area.ondragleave = () => area.classList.remove('drag-over');
        area.ondrop = (e) => handleBMCDrop(e, sid);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.switchAnalysisTab = (tabId) => {
    // Hide all panes
    document.querySelectorAll('.analysis-tab-pane').forEach(p => p.classList.remove('active'));
    // Show target pane
    const targetPane = document.getElementById(`analysis-tab-${tabId}`);
    if (targetPane) targetPane.classList.add('active');

    // Update tab status
    document.querySelectorAll('.analysis-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-analysis-tab') === tabId);
    });

    // Update description text
    const descriptions = {
        bmc: 'ビジネスの全体像を「価値提案・顧客・収益」など9つの視点で可視化し、事業の仕組みを定義します。',
        '5w1h': '「誰が・何を・いつ・どこで・なぜ・どのように」の基本要素を整理し、計画の具体化や状況把握に活用します。',
        '3c': '「顧客(Customer)・競合(Competitor)・自社(Company)」の3点から、市場環境と自社の勝ち筋を分析します。'
    };
    const descEl = document.getElementById('analysis-tab-description');
    if (descEl) descEl.textContent = descriptions[tabId] || '';
};

window.saveBMCTitle = (val) => {
    if (!state.bmc) state.bmc = {};
    state.bmc.title = val;
    saveState();
};

function createStickyElement(sectionId, s) {
    const el = document.createElement('div');
    el.className = 'bmc-sticky';
    el.draggable = true;
    el.style.backgroundColor = s.color || '#fef3c7';
    el.id = `sticky-${s.id}`;

    let imgHtml = s.image ? `<div class="bmc-sticky-img-wrap"><img src="${s.image}" class="bmc-sticky-img"></div>` : '';

    el.innerHTML = `
        <div class="bmc-sticky-text" contenteditable="true" onblur="handleStickyTextBlur('${sectionId}', '${s.id}', this)">${s.content || s.text || ''}</div>
        ${imgHtml}
    `;

    el.oncontextmenu = (e) => {
        e.stopPropagation();
        showStickyContextMenu(e, sectionId, s.id);
    };

    el.ondragstart = (e) => {
        bmcState.draggedSticky = s;
        bmcState.draggedSection = sectionId;
        el.classList.add('dragging');
        e.dataTransfer.setData('text/plain', s.id);
    };

    el.ondragend = () => {
        el.classList.remove('dragging');
    };

    return el;
}

function handleStickyTextBlur(sectionId, stickyId, el) {
    const newHtml = el.innerHTML.trim();
    const newText = el.innerText.trim();
    if (!state.bmc[sectionId]) return;
    const s = state.bmc[sectionId].find(item => item.id === stickyId);
    if (s) {
        s.content = newHtml;
        s.text = newText;
        saveState();
    }
}

// --- Text Formatting Functions ---
window.formatDoc = (e, cmd, val) => {
    e.preventDefault(); // Prevent button from taking focus and losing selection
    document.execCommand(cmd, false, val);

    // Find the active sticky text area to trigger an immediate save
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;
        const stickyTextBody = node.closest('.bmc-sticky-text');
        if (stickyTextBody) {
            // Finding the parent sticky element to get the IDs
            const stickyEl = stickyTextBody.closest('.bmc-sticky');
            const sectionEl = stickyTextBody.closest('.bmc-section');
            if (stickyEl && sectionEl) {
                const sectionId = sectionEl.getAttribute('data-section');
                const stickyId = stickyEl.id.replace('sticky-', '');
                handleStickyTextBlur(sectionId, stickyId, stickyTextBody);
            }
        }
    }
};

document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const toolbar = document.getElementById('bmc-format-toolbar');
    if (!toolbar) return;

    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        // Find if the selection is inside a .bmc-sticky-text element
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;

        const stickyTextBody = node.closest('.bmc-sticky-text');

        if (stickyTextBody) {
            const rect = range.getBoundingClientRect();
            // Only show if the selection has some height (visible)
            if (rect.width > 0 && rect.height > 0) {
                toolbar.style.display = 'flex';
                // Center toolbar above selection
                const left = rect.left + rect.width / 2 - toolbar.offsetWidth / 2;
                const top = rect.top - toolbar.offsetHeight - 10;

                toolbar.style.left = Math.max(10, left) + 'px'; // Prevent going off-screen left
                toolbar.style.top = top + 'px';
                return;
            }
        }
    }
    toolbar.style.display = 'none';
});

function handleBMCDrop(e, targetSectionId) {
    e.preventDefault();
    const area = document.getElementById(`bmc-area-${targetSectionId}`);
    if (area) area.classList.remove('drag-over');

    if (!bmcState.draggedSticky) return;

    const sourceSection = bmcState.draggedSection;
    const stickyData = bmcState.draggedSticky;
    const isCopy = e.ctrlKey || e.metaKey;

    if (isCopy) {
        // Clone
        const newId = 's' + Date.now() + Math.random().toString(36).substr(2, 5);
        const copy = JSON.parse(JSON.stringify(stickyData));
        copy.id = newId;
        copy.order = (state.bmc[targetSectionId]?.length || 0);
        if (!state.bmc[targetSectionId]) state.bmc[targetSectionId] = [];
        state.bmc[targetSectionId].push(copy);
    } else {
        // Move
        if (sourceSection === targetSectionId) return;

        // Remove from source (safe handling for empty state)
        if (state.bmc[sourceSection]) {
            state.bmc[sourceSection] = state.bmc[sourceSection].filter(i => i.id !== stickyData.id);
        }

        // Add to target
        if (!state.bmc[targetSectionId]) state.bmc[targetSectionId] = [];
        stickyData.order = state.bmc[targetSectionId].length;
        state.bmc[targetSectionId].push(stickyData);
    }

    saveState();
    renderBMC();
    bmcState.draggedSticky = null;
    bmcState.draggedSection = null;
}

// --- Context Menus ---
function showBMCContextMenu(e, sectionId) {
    e.preventDefault();
    const menu = document.getElementById('bmc-context-menu');
    menu.style.display = 'block';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';

    bmcState.activeSection = sectionId;

    const closer = () => {
        menu.style.display = 'none';
        document.removeEventListener('click', closer);
    };
    setTimeout(() => document.addEventListener('click', closer), 10);
}

function showStickyContextMenu(e, sectionId, stickyId) {
    e.preventDefault();
    const menu = document.getElementById('sticky-context-menu');
    menu.style.display = 'block';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';

    bmcState.activeSection = sectionId;
    bmcState.activeStickyId = stickyId;

    // Toggle remove image button visibility
    const s = state.bmc[sectionId].find(item => item.id === stickyId);
    const removeBtn = document.getElementById('sticky-menu-remove-image');
    if (removeBtn) {
        removeBtn.style.display = s && s.image ? 'flex' : 'none';
    }

    const closer = () => {
        menu.style.display = 'none';
        document.removeEventListener('click', closer);
    };
    setTimeout(() => document.addEventListener('click', closer), 10);
}

// Menu Actions
document.getElementById('sticky-menu-remove-image').onclick = () => {
    const sid = bmcState.activeSection;
    const id = bmcState.activeStickyId;
    const s = state.bmc[sid].find(item => item.id === id);
    if (s) {
        delete s.image;
        saveState();
        renderBMC();
    }
};

// Menu Actions
document.getElementById('bmc-menu-add').onclick = () => {
    const sid = bmcState.activeSection;
    const newId = 's' + Date.now();
    if (!state.bmc[sid]) state.bmc[sid] = [];
    state.bmc[sid].push({
        id: newId,
        text: '新しいアイデア',
        color: '#fef3c7',
        order: state.bmc[sid].length
    });
    saveState();
    renderBMC();
};

document.getElementById('bmc-menu-clear').onclick = () => {
    if (confirm('このセクションの付箋をすべて削除してもよろしいですか？')) {
        state.bmc[bmcState.activeSection] = [];
        saveState();
        renderBMC();
    }
};

document.getElementById('sticky-menu-delete').onclick = () => {
    const sid = bmcState.activeSection;
    const id = bmcState.activeStickyId;
    state.bmc[sid] = state.bmc[sid].filter(s => s.id !== id);
    saveState();
    renderBMC();
};

document.getElementById('sticky-menu-up').onclick = () => {
    const sid = bmcState.activeSection;
    const id = bmcState.activeStickyId;
    const list = state.bmc[sid];
    const idx = list.findIndex(s => s.id === id);
    if (idx > 0) {
        [list[idx], list[idx - 1]] = [list[idx - 1], list[idx]];
        list.forEach((s, i) => s.order = i);
        saveState();
        renderBMC();
    }
};

document.getElementById('sticky-menu-down').onclick = () => {
    const sid = bmcState.activeSection;
    const id = bmcState.activeStickyId;
    const list = state.bmc[sid];
    const idx = list.findIndex(s => s.id === id);
    if (idx >= 0 && idx < list.length - 1) {
        [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
        list.forEach((s, i) => s.order = i);
        saveState();
        renderBMC();
    }
};

document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.onclick = () => {
        const color = sw.getAttribute('data-color');
        const sid = bmcState.activeSection;
        const id = bmcState.activeStickyId;
        const s = state.bmc[sid].find(item => item.id === id);
        if (s) {
            s.color = color;
            saveState();
            renderBMC();
        }
    };
});

document.getElementById('sticky-menu-image').onclick = () => {
    document.getElementById('sticky-image-input').click();
};

document.getElementById('sticky-image-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (re) => {
        const compressed = await compressImage(re.target.result, 600, 600, 0.3);
        const sid = bmcState.activeSection;
        const id = bmcState.activeStickyId;
        const s = state.bmc[sid].find(item => item.id === id);
        if (s) {
            s.image = compressed;
            saveState();
            renderBMC();
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
};

window.exportAnalysisJSON = () => {
    if (!state.bmc) {
        alert('保存するデータがありません。');
        return;
    }
    const dataStr = JSON.stringify(state.bmc, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const title = state.bmc.title || 'business_analysis';
    a.download = `${title}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.importAnalysisJSON = (input) => {
    const file = input.files[0];
    if (!file) return;

    if (!confirm('既存の分析データが上書きされます。よろしいですか？')) {
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            state.bmc = imported;
            saveState();
            renderBMC();
            alert('分析データを読み込みました。');
        } catch (err) {
            alert('ファイルの形式が正しくありません。');
        }
    };
    reader.readAsText(file);
    input.value = '';
};

window.exportAnalysisPDF = () => {
    const activePane = document.querySelector('.analysis-tab-pane.active');
    const boardEl = activePane ? activePane.querySelector('.bmc-board, .w51h-board, .c3-board') : null;

    if (!activePane || !boardEl) {
        alert('出力するボードが見つかりません。');
        return;
    }

    const tabId = activePane.id.replace('analysis-tab-', '');

    const title = document.getElementById('bmc-title-input').value || 'Business Analysis';
    const contentHtml = boardEl.outerHTML;

    const previewWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!previewWindow) {
        alert('ポップアップがブロックされました。ブラウザの設定で許可してください。');
        return;
    }

    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>【印刷プレビュー】${title}</title>
            <link rel="stylesheet" href="styles.css">
            <link rel="stylesheet" href="bmc_styles.css">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
                
                @page { 
                    size: landscape; 
                    margin: 5mm; 
                }

                html, body {
                    margin: 0;
                    padding: 0;
                    background: #f1f5f9 !important;
                    font-family: 'Noto Sans JP', sans-serif;
                    overflow-x: hidden;
                }
                
                .preview-toolbar {
                    position: sticky;
                    top: 0;
                    background: #1e293b;
                    color: white;
                    padding: 10px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 1000;
                }

                .print-btn {
                    padding: 10px 24px;
                    background: #10b981;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 15px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .bmc-paper {
                    background: white;
                    width: 290mm;
                    margin: 10px auto;
                    padding: 10px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    min-height: 190mm;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                }

                .bmc-board, .w51h-board, .c3-board { 
                    width: 100% !important;
                    min-width: 0 !important;
                    height: auto !important;
                    background: #cbd5e1 !important; 
                    border: 1.5px solid #334155 !important;
                    gap: 1px !important;
                    display: grid !important;
                    flex: 1;
                }

                .bmc-section { 
                    background: white !important; 
                    padding: 6px 8px !important;
                    min-height: 80px !important;
                }

                .bmc-section-header i, .bmc-help-tip { display: none !important; }
                .bmc-section-header span { font-size: 9pt !important; color: #334155 !important; }

                .bmc-sticky { 
                    box-shadow: none !important;
                    border: 1px solid rgba(0,0,0,0.1) !important;
                    padding: 5px !important;
                    font-size: 8.5pt !important;
                    margin-bottom: 3px !important;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .bmc-sticky-img { max-height: 60px !important; }

                @media print {
                    @page { margin: 0; }
                    .preview-toolbar { display: none !important; }
                    body, html { background: white !important; overflow: visible !important; }
                    .bmc-paper { 
                        margin: 0 !important; 
                        padding: 8mm !important; 
                        box-shadow: none !important; 
                        width: 100vw !important; 
                        height: 100vh !important;
                        min-height: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    .bmc-board, .w51h-board, .c3-board { 
                        flex: 1 !important;
                        min-height: 0 !important;
                        height: 100% !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="preview-toolbar">
                <div>
                    <h2 style="margin:0; font-size: 1rem;">${tabId.toUpperCase()} 印刷プレビュー</h2>
                </div>
                <button class="print-btn" onclick="window.print()">
                    🖨️ PDF保存 / 印刷を実行
                </button>
            </div>
            
            <div class="bmc-paper">
                <h1 style="margin: 0 0 8px 0; font-size: 1.2rem; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 2px;">
                    ${title}
                </h1>
                ${contentHtml}
            </div>


            <script>
                document.querySelectorAll('.bmc-help-tip, .bmc-format-toolbar').forEach(el => el.remove());
                document.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
                // Adjust layout for print
                const board = document.querySelector('.bmc-board, .w51h-board, .c3-board');
                if (board) board.style.height = 'auto';
            </script>
        </body>
        </html>
    `);
    previewWindow.document.close();
};



window.exportBMCAsImage = () => {
    exportAnalysisPDF();
};

window.clearActiveAnalysis = () => {
    const activeTabBtn = document.querySelector('.analysis-tab.active');
    const tabId = activeTabBtn ? activeTabBtn.getAttribute('data-analysis-tab') : 'bmc';

    let sectionsToClear = [];
    let label = "";

    if (tabId === 'bmc') {
        sectionsToClear = ['KP', 'KA', 'KR', 'VP', 'CR', 'CH', 'CS', 'COST', 'REV'];
        label = "BMC（ビジネスモデルキャンバス）";
    } else if (tabId === '5w1h') {
        sectionsToClear = ['5W_WHO', '5W_WHAT', '5W_WHEN', '5W_WHERE', '5W_WHY', '5W_HOW'];
        label = "5W1H分析";
    } else if (tabId === '3c') {
        sectionsToClear = ['3C_CUSTOMER', '3C_COMPETITOR', '3C_COMPANY'];
        label = "3C分析";
    }

    if (sectionsToClear.length === 0) return;

    if (!confirm(`${label}のすべての付箋を削除してもよろしいですか？`)) {
        return;
    }

    if (!state.bmc) state.bmc = {};
    sectionsToClear.forEach(sid => {
        state.bmc[sid] = [];
    });

    saveState();
    renderBMC();
};



window.loadTutorial = (brandId) => {
    if (!brandId) return;

    const brandNames = {
        mcdonalds: "マクドナルド",
        muji: "無印良品",
        ikea: "IKEA",
        daiso: "ダイソー",
        gshock: "Casio G-shock",
        pixel: "Google Pixel",
        applewatch: "Apple Watch"
    };

    if (!confirm(`${brandNames[brandId]}のビジネス分析例を読み込みます。現在の入力内容は上書きされますがよろしいですか？`)) {
        document.querySelector('.bmc-toolbar select').value = brandId;
        return;
    }

    const tutorials = {
        mcdonalds: {
            title: "マクドナルド（日本）のビジネス分析例",
            KP: [
                { id: Date.now() + 1, content: "原材料サプライヤー（農業・畜産）", color: "#fef3c7" },
                { id: Date.now() + 2, content: "不動産オーナー（立地提供）", color: "#fef3c7" },
                { id: Date.now() + 3, content: "フランチャイズ加盟店", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 4, content: "店舗運営・クイックサービス", color: "#dcfce7" },
                { id: Date.now() + 5, content: "メニュー開発・品質管理", color: "#dcfce7" },
                { id: Date.now() + 6, content: "サプライチェーン最適化", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 7, content: "ブランド力（ゴールデンアーチ）", color: "#e0e7ff" },
                { id: Date.now() + 8, content: "好立地な店舗網", color: "#e0e7ff" },
                { id: Date.now() + 9, content: "洗練されたマニュアル", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 10, content: "QSC&V（品質、サービス、清潔さ、価値）", color: "#ffedd5" },
                { id: Date.now() + 11, content: "圧倒的なスピードと利便性", color: "#ffedd5" },
                { id: Date.now() + 12, content: "子供から大人まで楽しめる体験", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 13, content: "利便性を通じた日常的な接点", color: "#fce7f3" },
                { id: Date.now() + 14, content: "モバイルオーダー等によるDX体験", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 15, content: "直営・FC実店舗", color: "#fef3c7" },
                { id: Date.now() + 16, content: "ドライブスルー・デリバリー", color: "#fef3c7" },
                { id: Date.now() + 17, content: "公式アプリ", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 18, content: "忙しいビジネスパーソン（時短）", color: "#ecfdf5" },
                { id: Date.now() + 19, content: "ファミリー層（ハッピーセット）", color: "#ecfdf5" },
                { id: Date.now() + 20, content: "中高生・学生（手軽な軽食）", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 21, content: "食材原価・物流費", color: "#fee2e2" },
                { id: Date.now() + 22, content: "店舗人件費・教育費", color: "#fee2e2" },
                { id: Date.now() + 23, content: "不動産賃料・店舗維持費", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 24, content: "食品・飲料の販売売上", color: "#dcfce7" },
                { id: Date.now() + 25, content: "FC加盟店からのロイヤリティ", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 26, content: "老若男女幅広い一般消費者", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 27, content: "「手軽で美味しい」ハンバーガー、体験、スマイル", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 28, content: "日常的な食事時、多忙な合間", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 29, content: "駅前、郊外、ロードサイド、デリバリー", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 30, content: "食事を安く早く済ませたいというニーズ", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 31, content: "徹底したプロセス標準化とスケールメリット", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 32, content: "安さ・早さを求める層、ファミリー", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 33, content: "モスバーガー、コンビニ、牛丼チェーン", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 34, content: "圧倒的な店舗数、ブランド認知度、最適化されたSCM", color: "#e0e7ff" }]
        },
        muji: {
            title: "無印良品（良品計画）のビジネス分析例",
            KP: [
                { id: Date.now() + 101, content: "グローバル製造パートナー", color: "#fef3c7" },
                { id: Date.now() + 102, content: "アドバイザリーボード（外部デザイナー）", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 103, content: "「理由（わけ）あり」商品企画", color: "#dcfce7" },
                { id: Date.now() + 104, content: "シンプルな生活提案（感じ良いくらし）", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 105, content: "「無印」という哲学・思想", color: "#e0e7ff" },
                { id: Date.now() + 106, content: "商品開発のための観察・洞察力", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 107, content: "「これがいい」ではなく「これでいい」という合理性", color: "#ffedd5" },
                { id: Date.now() + 108, content: "シンプル、高品質、無駄のないデザイン", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 109, content: "MUJI Passport を通じた顧客共創", color: "#fce7f3" },
                { id: Date.now() + 110, content: "思想への共感に基づく高いロイヤリティ", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 111, content: "国内・海外の実店舗（MUJI）", color: "#fef3c7" },
                { id: Date.now() + 112, content: "ネットストア（自社EC）", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 113, content: "自身の価値観を持つ都市生活者", color: "#ecfdf5" },
                { id: Date.now() + 114, content: "シンプル・ミニマルな生活を好む層", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 115, content: "素材選定・商品開発コスト", color: "#fee2e2" },
                { id: Date.now() + 116, content: "店舗運営・グローバル物流網", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 117, content: "衣料品・生活雑貨・食品の販売売上", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 118, content: "自立した価値観を持つ都市の生活者、ミニマリスト", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 119, content: "シンプルで機能的な生活用品と「感じ良い暮らし」", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 120, content: "日常生活のあらゆるシーン（衣食住）", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 121, content: "主要都市の商業施設、オンライン、生活拠点", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 122, content: "過剰なブランドや装飾を避け、本質的な豊かさを求める", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 123, content: "アンチブランドの思想と、徹底した素材・工程の吟味", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 124, content: "シンプル、環境、本質への価値を置く層", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 125, content: "ニトリ（家具・機能）、ユニクロ（衣類）、100均（消耗品）", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 126, content: "独自のライフスタイル思想、根強いファン層、世界観の統一", color: "#e0e7ff" }]
        },
        ikea: {
            title: "IKEA（イケア）のビジネス分析例",
            KP: [
                { id: Date.now() + 201, content: "数千社のグローバルサプライヤー", color: "#fef3c7" },
                { id: Date.now() + 202, content: "物流・配送パートナー", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 203, content: "民主的デザイン（5つの要素）の製品開発", color: "#dcfce7" },
                { id: Date.now() + 204, content: "店舗でのショールーム体験・体験提供", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 205, content: "フラットパック（平積み）物流ノウハウ", color: "#e0e7ff" },
                { id: Date.now() + 206, content: "世界最強の家具ブランド認知度", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 207, content: "優れたデザインの家具を、驚きの低価格で", color: "#ffedd5" },
                { id: Date.now() + 208, content: "店舗での一日楽しめるエンターテインメント（食事含）", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 209, content: "IKEA Family メンバーシップ（特典・優待）", color: "#fce7f3" },
                { id: Date.now() + 210, content: "カタログやSNSを通じたインスピレーション提供", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 211, content: "郊外の超大型ストア（ブルーボックス）", color: "#fef3c7" },
                { id: Date.now() + 212, content: "ECサイト・アプリ・都市型店舗", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 213, content: "手頃な価格で家を整えたい若年夫婦・家族", color: "#ecfdf5" },
                { id: Date.now() + 214, content: "DIYを楽しみ、自分で組み立てることに寛容な層", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 215, content: "大規模製造・原材料調達（スケールメリット）", color: "#fee2e2" },
                { id: Date.now() + 216, content: "店舗・ショールーム・物流センター維持費", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 217, content: "家具・生活雑貨の販売売上", color: "#dcfce7" },
                { id: Date.now() + 218, content: "レストラン・フードマーケットの売上", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 219, content: "予算を抑えつつお洒落な暮らしをしたい若年層・ファミリー", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 220, content: "フラットパック家具、北欧デザイン、店舗体験", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 221, content: "引っ越し、模様替え、週末の家族外出", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 222, content: "郊外の大型店舗、オンラインストア", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 223, content: "より多くの人が、毎日をより快適に過ごせるようにするため", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 224, content: "大量生産、平積み梱包、セルフサービスによる徹底的コスト削減", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 225, content: "コスパ、デザイン、体験を求める実利層", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 226, content: "ニトリ（手軽さ・日本サイズ）、大塚家具（高級）、Amazon", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 227, content: "世界規模の調達力、独自体験店舗、サステナビリティイメージ", color: "#e0e7ff" }]
        },
        daiso: {
            title: "ダイソー（大創産業）のビジネス分析例",
            KP: [
                { id: Date.now() + 301, content: "世界の多種多様な製造工場（OEM）", color: "#fef3c7" },
                { id: Date.now() + 302, content: "各国のテナント・不動産会社", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 303, content: "月数百種類の新商品開発", color: "#dcfce7" },
                { id: Date.now() + 304, content: "圧倒的なボリューム陳列と商品回転", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 305, content: "「100円」という強力なブランドと心理的ハードル低下", color: "#e0e7ff" },
                { id: Date.now() + 306, content: "世界26カ国にわたる膨大な店舗網", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 307, content: "「100円でこんなものまで？」という驚きと楽しさ", color: "#ffedd5" },
                { id: Date.now() + 308, content: "欲しいものが必ず見つかる圧倒的な品揃え（バラエティ）", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 309, content: "宝探しのような買い物体験によるリピート化", color: "#fce7f3" },
                { id: Date.now() + 310, content: "SNS（100均パトロール）を通じた情報の拡散", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 311, content: "路面店・SC内店舗・100円ショップ実店舗", color: "#fef3c7" },
                { id: Date.now() + 312, content: "近年強化中のEC・ネットストア", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 313, content: "家計をやりくりする主婦層・学生", color: "#ecfdf5" },
                { id: Date.now() + 314, content: "DIY・文具・キッチン用品等を求める全世代", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 315, content: "超大量仕入れによる原価圧縮コスト", color: "#fee2e2" },
                { id: Date.now() + 316, content: "店舗運営・物流・在庫管理システム費", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 317, content: "薄利多売による圧倒的な販売売上", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 318, content: "ついで買い、宝探しを楽しむ全世代の消費者", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 319, content: "生活を便利にする多種多様な100円アイテム", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 320, content: "日常の消耗品補充、ふとした買い物のついで", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 321, content: "身近な街角、ショッピングモール内", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 322, content: "良いものを安く早く手に入れたい、発見の楽しみを味わいたい", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 323, content: "世界規模のバイイングパワーと企画開発力による圧倒的品揃え", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 324, content: "価格感度が非常に高く、バラエティを好む大衆層", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 325, content: "セリア（デザイン性）、キャンドゥ（利便性）、コンビニ", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 326, content: "業界最大手のスケール、開発スピード、グローバル供給網", color: "#e0e7ff" }]
        },
        gshock: {
            title: "Casio G-SHOCK のビジネス分析例",
            KP: [
                { id: Date.now() + 401, content: "国内外の精密部品サプライヤー", color: "#fef3c7" },
                { id: Date.now() + 402, content: "著名デザイナー・ブランドコラボ先", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 403, content: "究極の耐衝撃構造の研究・開発", color: "#dcfce7" },
                { id: Date.now() + 404, content: "タフネスを軸としたブランドマーケティング", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 405, content: "衝撃耐性（トリプルGレジスト）技術", color: "#e0e7ff" },
                { id: Date.now() + 406, content: "「壊れない」という世界的なブランドイメージ", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 407, content: "三階建てから落としても壊れない耐衝撃性", color: "#ffedd5" },
                { id: Date.now() + 408, content: "道具としての実用性と、所有欲を満たすデザインの両立", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 409, content: "ファンコミュニティの構築", color: "#fce7f3" },
                { id: Date.now() + 410, content: "限定モデルによるコレクター心理の刺激", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 411, content: "専門店（G-SHOCK STORE）、時計店", color: "#fef3c7" },
                { id: Date.now() + 412, content: "カシオ公式サイト、主要ECモール", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 413, content: "過酷な環境（軍、消防、工事等）で働くプロ", color: "#ecfdf5" },
                { id: Date.now() + 414, content: "ストリート、スポーツを好む若年〜中年層", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 415, content: "耐衝撃試験・材料研究開発費", color: "#fee2e2" },
                { id: Date.now() + 416, content: "広告宣伝費・グローバル販促イベント費", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 417, content: "時計製品（低価格帯〜高級品）の販売売上", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 418, content: "現場職のプロ、アウトドア派、ストリートファッション好き", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 419, content: "圧倒的耐久性を持つデジタル・アナログ腕時計", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 420, content: "仕事、スポーツ、極地での活動時、日常のファッション", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 421, content: "地上・海中・宇宙（あらゆる過酷な環境）", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 422, content: "「絶対に壊したくない」という信頼へのニーズ", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 423, content: "「中空構造」という独自技術を基盤とした物づくり", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 424, content: "実用性とタフな格好良さを重要視する層", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 425, content: "Garmin（高機能）、スマートウォッチ、高級機械式時計（対極）", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 426, content: "カシオの電子技術力、他にない「最強」のブランド確立", color: "#e0e7ff" }]
        },
        pixel: {
            title: "Google Pixel のビジネス分析例",
            KP: [
                { id: Date.now() + 501, content: "主要通信キャリア（docomo, au, SoftBank）", color: "#fef3c7" },
                { id: Date.now() + 502, content: "Android アプリ開発者エコシステム", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 503, content: "独自チップ（Google Tensor）とAIの研究開発", color: "#dcfce7" },
                { id: Date.now() + 504, content: "ソフトウェアによるカメラ機能・翻訳機能の最適化", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 505, content: "世界最強のAI技術・大規模データ", color: "#e0e7ff" },
                { id: Date.now() + 506, content: "Android OS 本家というプラットフォーム優位性", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 507, content: "魔法のようなAI体験（消しゴムマジック、かこって検索）", color: "#ffedd5" },
                { id: Date.now() + 508, content: "高性能ながら競合機より優れたコストパフォーマンス", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 509, content: "Google One 等のサービスを通じた継続利用促進", color: "#fce7f3" },
                { id: Date.now() + 510, content: "OSアップデート保証による安心感の提供", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 511, content: "Google ストア（直営EC）", color: "#fef3c7" },
                { id: Date.now() + 512, content: "大手キャリアショップ、家電量販店", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 513, content: "AIや最新技術に関心の高い層（イノベーター層）", color: "#ecfdf5" },
                { id: Date.now() + 514, content: "iPhone からの乗り換えを検討しているAndroid移行層", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 515, content: "AI/半導体（Tensor）の巨額な研究開発費", color: "#fee2e2" },
                { id: Date.now() + 516, content: "日本市場での大規模なTVCM・広告キャンペーン", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 517, content: "端末販売売上、周辺機器の売上", color: "#dcfce7" },
                { id: Date.now() + 518, content: "広告表示やGoogleサービス利用への誘導（将来価値）", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 519, content: "AI 機能を日常で活用したいスマホユーザー", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 520, content: "AI が主役となる新時代のスマートフォン体験", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 521, content: "写真撮影中、調べ物、翻訳が必要な瞬間", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 522, content: "生活のあらゆる場面、Google エコシステム内", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 523, content: "情報を整理し、日常を便利にするというGoogleの使命", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 524, content: "自社製チップとAIの融合により、ソフトの力でハードを凌駕する", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 525, content: "実用的なAI機能とコスパを重視、シンプルさを好む層", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 526, content: "iPhone（ステータス）、Galaxy（最高スペック）、他中華スマホ", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 527, content: "検索からAIまで一気通貫のGoogleサービス網", color: "#e0e7ff" }]
        },
        applewatch: {
            title: "Apple Watch のビジネス分析例",
            KP: [
                { id: Date.now() + 601, content: "App Store 開発者、ヘルスケア・病院ネットワーク", color: "#fef3c7" },
                { id: Date.now() + 602, content: "精密機器製造委託パートナー（フォックスコン等）", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 603, content: "センサー技術（心拍、血中酸素、心電図）の高度化", color: "#dcfce7" },
                { id: Date.now() + 604, content: "Apple エコシステム（iPhone, Mac）との連携強化", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 605, content: "独自OS（watchOS）と膨大なアプリ資産", color: "#e0e7ff" },
                { id: Date.now() + 606, content: "洗練されたデザイン美学と圧倒的ブランドロイヤリティ", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 607, content: "「健康」を手元で管理し、寿命を延ばすパーソナル秘書", color: "#ffedd5" },
                { id: Date.now() + 608, content: "シームレスな通信・決済・通知体験（iPhoneの拡張）", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 609, content: "iPhone 抜きでは使えないことによる「檻」の提供（囲い込み）", color: "#fce7f3" },
                { id: Date.now() + 610, content: "アクティビティリング等によるゲーミフィケーション（継続）", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 611, content: "Apple Store（直営・オンライン）", color: "#fef3c7" },
                { id: Date.now() + 612, content: "家電量販店、通信キャリア、高級伊勢丹等のショップ", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 613, content: "健康意識の高い層（ダイエット、ランナー、高齢者）", color: "#ecfdf5" },
                { id: Date.now() + 614, content: "多忙なビジネスパーソン、iPhone を既に持っているすべての層", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 615, content: "高度な小型センサー・医療グレード機能の開発費", color: "#fee2e2" },
                { id: Date.now() + 616, content: "厳密なプライバシー・データセキュリティ維持費", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 617, content: "高単価なハードウェア・バンド・周辺機器の売上", color: "#dcfce7" },
                { id: Date.now() + 618, content: "Apple Health+ 等のサブスクリプション収入への寄与", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 619, content: "自身の健康状態を可視化したいiPhoneユーザー", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 620, content: "命を救う、健康を促す、パーソナルな腕時計型デバイス", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 621, content: "睡眠中、運動中、仕事中（24時間365日）", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 622, content: "ユーザーの「腕の上」（究極のパーソナルスペース）", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 623, content: "Apple 経済圏から離れられなくし、かつ人々のQOLを上げるため", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 624, content: "既存のiPhoneとの強力な縦の連携と、洗練されたUI/UX", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 625, content: "健康、ステータス、利便性の三拍子を求める層", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 626, content: "Garmin、Fitbit（専用機）、Android陣営のスマートウォッチ", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 627, content: "ハード・ソフト・サービスが一体となった唯一無二のエコシステム", color: "#e0e7ff" }]
        },
        tech_core: {
            title: "技術コア開発（保存・読込・PDF出力）の分析例",
            KP: [
                { id: Date.now() + 701, content: "オープンソースコミュニティ (React, Lucide, etc.)", color: "#fef3c7" },
                { id: Date.now() + 702, content: "ブラウザベンダー (V8エンジン実装者)", color: "#fef3c7" }
            ],
            KA: [
                { id: Date.now() + 703, content: "JSONデータの永続化と整合性保証", color: "#dcfce7" },
                { id: Date.now() + 704, content: "ブラウザ標準技術を用いたPDFプレビュー・レンダリング", color: "#dcfce7" }
            ],
            KR: [
                { id: Date.now() + 705, content: "HTML5/CSS3/JavaScript 専門知識", color: "#e0e7ff" },
                { id: Date.now() + 706, content: "DOM操作と状態管理の設計パターン", color: "#e0e7ff" }
            ],
            VP: [
                { id: Date.now() + 707, content: "作業の中断・再開を可能にする信頼性の高い保存機能", color: "#ffedd5" },
                { id: Date.now() + 708, content: "外部共有に耐えうる美しいPDFレポート出力", color: "#ffedd5" }
            ],
            CR: [
                { id: Date.now() + 709, content: "開発者向けドキュメントとREADME", color: "#fce7f3" },
                { id: Date.now() + 710, content: "UI/UXフィードバックに基づく高速な反復改善", color: "#fce7f3" }
            ],
            CH: [
                { id: Date.now() + 711, content: "GitHub リポジトリ（ソースコード管理）", color: "#fef3c7" },
                { id: Date.now() + 712, content: "統合開発環境 (VS Code)", color: "#fef3c7" }
            ],
            CS: [
                { id: Date.now() + 713, content: "安定したツールを求めるビジネスアナリスト", color: "#ecfdf5" },
                { id: Date.now() + 714, content: "基盤機能を再利用するアプリケーション開発者", color: "#ecfdf5" }
            ],
            COST: [
                { id: Date.now() + 715, content: "機能実装およびデバッグに伴う開発人件費", color: "#fee2e2" },
                { id: Date.now() + 716, content: "ブラウザ互換性テストの検証コスト", color: "#fee2e2" }
            ],
            REV: [
                { id: Date.now() + 717, content: "手作業による集計・出力時間の圧倒的削減", color: "#dcfce7" },
                { id: Date.now() + 718, content: "データの信頼性向上による業務効率化", color: "#dcfce7" }
            ],
            '5W_WHO': [{ id: Date.now() + 719, content: "基盤開発チームおよび全アプリケーションユーザー", color: "#fef3c7" }],
            '5W_WHAT': [{ id: Date.now() + 720, content: "データの永続性とレポート出力を保証する技術基盤（保存・読込・PDF）", color: "#dcfce7" }],
            '5W_WHEN': [{ id: Date.now() + 721, content: "アプリケーションのMVP開発から商用展開フェーズ", color: "#e0e7ff" }],
            '5W_WHERE': [{ id: Date.now() + 722, content: "ウェブブラウザ基盤およびローカルストレージ層", color: "#ffedd5" }],
            '5W_WHY': [{ id: Date.now() + 723, content: "ユーザーの思考を止めず、提出物を確実にアウトプットするため", color: "#fce7f3" }],
            '5W_HOW': [{ id: Date.now() + 724, content: "JavaScriptによる状態管理と、CSSによるPrint Medien最適化", color: "#ecfdf5" }],
            '3C_CUSTOMER': [{ id: Date.now() + 725, content: "安定稼働と「一発で綺麗なPDF」を求めるユーザー", color: "#fef3c7" }],
            '3C_COMPETITOR': [{ id: Date.now() + 726, content: "ブラウザ標準の不明瞭な印刷機能、外部の有料PDF生成API", color: "#dcfce7" }],
            '3C_COMPANY': [{ id: Date.now() + 727, content: "内部構造を熟知した高速・軽量な独自実装エンジン", color: "#e0e7ff" }]
        }
    };

    const data = tutorials[brandId];
    if (data) {
        state.bmc = data;
        saveState();
        renderBMC();
        // Update select value to match loaded brand
        const selects = document.querySelectorAll('.bmc-toolbar select');
        selects.forEach(s => s.value = brandId);
        alert(`${brandNames[brandId]}の分析例を読み込みました。`);
    }
};

window.exportTechCanvasJSON = () => {
    if (!techCanvasState.shapes || techCanvasState.shapes.length === 0) {
        alert('保存する図形がありません。');
        return;
    }
    const data = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        shapes: techCanvasState.shapes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tech_core_blueprint_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.importTechCanvasJSON = (input) => {
    const file = input.files[0];
    if (!file) return;

    if (!confirm('キャンバスの内容が上書きされます。よろしいですか？')) {
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.shapes) {
                techCanvasState.shapes = data.shapes;
                saveTechCanvas(true);
                drawTechCanvas();
                alert('設計図データを読み込みました。');
            } else {
                alert('有効な設計図データではありません。');
            }
        } catch (err) {
            alert('ファイルの読み込みに失敗しました。');
        }
    };
    reader.readAsText(file);
    input.value = '';
};

window.exportTechCanvasPDF = () => {
    const canvas = document.getElementById('tech-core-canvas');
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>技術コア設計図 プレビュー</title>
                <style>
                    body { margin: 0; display: flex; flex-direction: column; align-items: center; background: #f0f0f0; font-family: sans-serif; }
                    .header { width: 100%; padding: 20px; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; }
                    .canvas-preview { margin: 40px; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.2); max-width: 95%; }
                    img { max-width: 100%; height: auto; display: block; }
                    @media print {
                        .header, button { display: none; }
                        body { background: #fff; margin: 0; }
                        .canvas-preview { box-shadow: none; margin: 0; width: 100%; }
                    }
                    button { padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>技術コア設計図 出力プレビュー</h2>
                    <button onclick="window.print()">PDFとして保存 / 印刷</button>
                </div>
                <div class="canvas-preview">
                    <img src="${dataUrl}" />
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
};

window.loadTechTutorial = (id) => {
    if (!id) return;

    const names = {
        drone: "自律型配送ドローン",
        ev_station: "EV高速充電スタンド",
        smart_agri: "スマート農業IoT",
        factory: "AI自動検品ライン",
        rocket: "再使用型ロケット",
        quantum: "量子クラウド基盤"
    };

    if (!confirm(`既存のキャンバスの内容をクリアして、${names[id]}の設計図例を読み込みますか？`)) return;

    const cx = techCanvasState.canvas.width / 2;
    const cy = techCanvasState.canvas.height / 2;
    let shapes = [];

    switch (id) {
        case 'drone':
            shapes = [
                { type: 'diamond', x1: cx - 60, y1: cy - 60, x2: cx + 60, y2: cy + 60, strokeColor: '#3b82f6', fillColor: 'rgba(59, 130, 246, 0.1)', lineWidth: 3 },
                { type: 'rect', x1: cx - 20, y1: cy - 30, x2: cx + 20, y2: cy + 30, strokeColor: '#94a3b8', fillColor: 'rgba(148, 163, 184, 0.2)', lineWidth: 1 },
                { type: 'line', x1: cx - 40, y1: cy - 40, x2: cx - 180, y2: cy - 180, strokeColor: '#64748b', lineWidth: 8 },
                { type: 'line', x1: cx + 40, y1: cy - 40, x2: cx + 180, y2: cy - 180, strokeColor: '#64748b', lineWidth: 8 },
                { type: 'line', x1: cx - 40, y1: cy + 40, x2: cx - 180, y2: cy + 180, strokeColor: '#64748b', lineWidth: 8 },
                { type: 'line', x1: cx + 40, y1: cy + 40, x2: cx + 180, y2: cy + 180, strokeColor: '#64748b', lineWidth: 8 },
                { type: 'circle', x1: cx - 210, y1: cy - 210, x2: cx - 150, y2: cy - 150, strokeColor: '#3b82f6', fillColor: '#1c212c', lineWidth: 4 },
                { type: 'circle', x1: cx + 150, y1: cy - 210, x2: cx + 210, y2: cy - 150, strokeColor: '#3b82f6', fillColor: '#1c212c', lineWidth: 4 },
                { type: 'circle', x1: cx - 210, y1: cy + 150, x2: cx - 150, y2: cy + 210, strokeColor: '#3b82f6', fillColor: '#1c212c', lineWidth: 4 },
                { type: 'circle', x1: cx + 150, y1: cy + 150, x2: cx + 210, y2: cy + 210, strokeColor: '#3b82f6', fillColor: '#1c212c', lineWidth: 4 },
                { type: 'arrow', x1: cx - 100, y1: cy - 100, x2: cx - 50, y2: cy - 50, strokeColor: '#ef4444', lineWidth: 2 },
                { type: 'text', x1: cx - 220, y1: cy - 120, strokeColor: '#ef4444', fontSize: 14, text: "AI自律制御エンジン v2.4", isBold: true },
                { type: 'rounded-rect', x1: cx - 250, y1: cy + 230, x2: cx + 250, y2: cy + 300, strokeColor: '#4f46e5', fillColor: 'rgba(79, 70, 229, 0.05)', lineWidth: 1 },
                { type: 'text', x1: cx - 230, y1: cy + 250, strokeColor: '#fff', fontSize: 16, text: "製品名: SKY-HAWK Autonomous Delivery Unit", isBold: true }
            ];
            break;
        case 'ev_station':
            shapes = [
                { type: 'rect', x1: cx - 100, y1: cy - 150, x2: cx + 100, y2: cy + 150, strokeColor: '#10b981', fillColor: 'rgba(16, 185, 129, 0.1)', lineWidth: 4 },
                { type: 'rounded-rect', x1: cx - 70, y1: cy - 120, x2: cx + 70, y2: cy - 20, strokeColor: '#fff', fillColor: '#064e3b', lineWidth: 2 },
                { type: 'text', x1: cx - 30, y1: cy - 70, strokeColor: '#10b981', fontSize: 24, text: "85%", isBold: true },
                { type: 'line', x1: cx + 100, y1: cy, x2: cx + 200, y2: cy, strokeColor: '#94a3b8', lineWidth: 10 },
                { type: 'rect', x1: cx + 200, y1: cy - 20, x2: cx + 230, y2: cy + 80, strokeColor: '#94a3b8', fillColor: '#334155', lineWidth: 2 },
                { type: 'text', x1: cx - 80, y1: cy + 180, strokeColor: '#fff', fontSize: 16, text: "Liquid Cooled High-Speed Charger", isBold: true },
                { type: 'arrow', x1: cx, y1: cy - 250, x2: cx, y2: cy - 150, strokeColor: '#f59e0b', lineWidth: 3 }
            ];
            break;
        case 'smart_agri':
            shapes = [
                { type: 'rect', x1: cx - 300, y1: cy + 50, x2: cx + 300, y2: cy + 200, strokeColor: '#16a34a', fillColor: 'rgba(22, 163, 74, 0.1)', lineWidth: 2 },
                { type: 'circle', x1: cx - 200, y1: cy + 80, x2: cx - 160, y2: cy + 120, strokeColor: '#3b82f6', fillColor: '#1e3a8a', lineWidth: 2 },
                { type: 'circle', x1: cx, y1: cy + 80, x2: cx + 40, y2: cy + 120, strokeColor: '#3b82f6', fillColor: '#1e3a8a', lineWidth: 2 },
                { type: 'circle', x1: cx + 200, y1: cy + 80, x2: cx + 240, y2: cy + 120, strokeColor: '#3b82f6', fillColor: '#1e3a8a', lineWidth: 2 },
                { type: 'rect', x1: cx - 50, y1: cy - 150, x2: cx + 50, y2: cy - 50, strokeColor: '#94a3b8', fillColor: 'rgba(255,255,255,0.05)', lineWidth: 2 },
                { type: 'text', x1: cx - 40, y1: cy - 100, strokeColor: '#3b82f6', fontSize: 12, text: "Cloud Hub" },
                { type: 'line', x1: cx, y1: cy - 50, x2: cx, y2: cy + 50, strokeColor: '#3b82f6', lineWidth: 1, lineDash: 'dashed' },
                { type: 'text', x1: cx - 150, y1: cy - 200, strokeColor: '#fff', fontSize: 18, text: "Autonomous Irrigation & Soil Monitoring System", isBold: true }
            ];
            break;
        case 'factory':
            shapes = [
                { type: 'rounded-rect', x1: cx - 350, y1: cy - 20, x2: cx + 350, y2: cy + 20, strokeColor: '#475569', fillColor: '#1e293b', lineWidth: 2 },
                { type: 'rect', x1: cx - 50, y1: cy - 120, x2: cx + 50, y2: cy - 80, strokeColor: '#ef4444', fillColor: 'rgba(239, 68, 68, 0.2)', lineWidth: 2 },
                { type: 'circle', x1: cx - 20, y1: cy - 110, x2: cx + 20, y2: cy - 70, strokeColor: '#fff', lineWidth: 1 },
                { type: 'circle', x1: cx - 200, y1: cy - 15, x2: cx - 170, y2: cy + 15, strokeColor: '#f59e0b', fillColor: '#f59e0b', lineWidth: 0 },
                { type: 'circle', x1: cx, y1: cy - 15, x2: cx + 30, y2: cy + 15, strokeColor: '#f59e0b', fillColor: '#f59e0b', lineWidth: 0 },
                { type: 'circle', x1: cx + 200, y1: cy - 15, x2: cx + 230, y2: cy + 15, strokeColor: '#ef4444', fillColor: '#ef4444', lineWidth: 0 },
                { type: 'text', x1: cx - 60, y1: cy - 150, strokeColor: '#ef4444', fontSize: 14, text: "AI Inspection Camera", isBold: true },
                { type: 'arrow', x1: cx, y1: cy - 80, x2: cx, y2: cy - 25, strokeColor: '#fff', lineWidth: 2 }
            ];
            break;
        case 'rocket':
            shapes = [
                { type: 'rect', x1: cx - 40, y1: cy - 150, x2: cx + 40, y2: cy + 100, strokeColor: '#f8fafc', fillColor: '#f8fafc', lineWidth: 1 },
                { type: 'circle', x1: cx - 40, y1: cy - 200, x2: cx + 40, y2: cy - 100, strokeColor: '#f8fafc', fillColor: '#f8fafc', lineWidth: 0 },
                { type: 'triangle', x1: cx - 40, y1: cy + 100, x2: cx + 40, y2: cy + 150, strokeColor: '#64748b', fillColor: '#334155', lineWidth: 2 },
                { type: 'line', x1: cx - 40, y1: cy + 50, x2: cx - 80, y2: cy + 120, strokeColor: '#f8fafc', lineWidth: 5 },
                { type: 'line', x1: cx + 40, y1: cy + 50, x2: cx + 80, y2: cy + 120, strokeColor: '#f8fafc', lineWidth: 5 },
                { type: 'text', x1: cx - 180, y1: cy - 50, strokeColor: '#3b82f6', fontSize: 14, text: "Liquid Oxygen Tank" },
                { type: 'text', x1: cx - 180, y1: cy + 50, strokeColor: '#ef4444', fontSize: 14, text: "RP-1 Fuel Tank" }
            ];
            break;
        case 'quantum':
            shapes = [
                { type: 'rect', x1: cx - 150, y1: cy - 150, x2: cx + 150, y2: cy + 150, strokeColor: '#4f46e5', fillColor: 'rgba(79, 70, 229, 0.05)', lineWidth: 2 },
                { type: 'circle', x1: cx - 100, y1: cy - 100, x2: cx + 100, y2: cy + 100, strokeColor: '#818cf8', lineWidth: 1, lineDash: 'dashed' },
                { type: 'circle', x1: cx - 5, y1: cy - 5, x2: cx + 5, y2: cy + 5, strokeColor: '#fff', fillColor: '#fff', lineWidth: 0 },
                { type: 'text', x1: cx - 80, y1: cy - 180, strokeColor: '#818cf8', fontSize: 18, text: "Superconducting Qubit Core", isBold: true },
                { type: 'line', x1: cx - 250, y1: cy, x2: cx - 150, y2: cy, strokeColor: '#c084fc', lineWidth: 2 },
                { type: 'text', x1: cx - 350, y1: cy + 5, strokeColor: '#c084fc', fontSize: 14, text: "Cryogenic Interface" }
            ];
            break;
    }

    techCanvasState.shapes = shapes;
    saveTechCanvas(true);
    drawTechCanvas();
    switchView('tech-core');
    alert(`${names[id]}の設計図例を読み込みました。`);
};

// --- Polls & Schedule Adjustment ---
function renderPollList() {
    const listEl = document.getElementById("polls-list");
    if (!listEl) return;

    if (!state.polls || state.polls.length === 0) {
        listEl.innerHTML = "<div class=\"empty-msg\">投票はまだありません</div>";
        return;
    }

    // Auto-check deadlines before rendering
    checkPollDeadlines();

    listEl.innerHTML = state.polls.map(poll => {
        const isActive = poll.id === state.currentPollId;
        const isClosed = poll.status === "closed" || (poll.deadline && new Date(poll.deadline) < new Date());
        const statusLabel = isClosed ? "終了" : "進行中";
        const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
        const isUnvoted = !isClosed && totalVotes === 0;

        const creator = (state.members || []).find(m => m.id === poll.createdBy);
        const creatorName = creator ? (creator.lastName || '') : 'ゲスト';

        return `
            <div class="poll-item ${isActive ? "active-poll" : ""} ${isUnvoted ? "unvoted-poll" : ""}" onclick="selectPoll('${poll.id}')">
                <div class="poll-item-title">
                    ${poll.title}
                    ${isUnvoted ? '<span class="unvoted-dot"></span>' : ''}
                </div>
                <div class="poll-item-meta">
                    <span class="poll-status-badge ${!isClosed ? "poll-status-active" : "poll-status-closed"}">${statusLabel}</span>
                    <span>${totalVotes} 票</span>
                    <span title="作成者: ${creatorName}">${creatorName}</span>
                </div>
            </div>
        `;
    }).join("");

    if (typeof updatePollNotification === "function") updatePollNotification();
}

window.selectPoll = (pollId) => {
    state.currentPollId = pollId;
    hidePollCreateForm();
    renderPollList();
    renderActivePoll();
};

function renderActivePoll() {
    const detailEl = document.getElementById("poll-detail-content");
    if (!detailEl) return;

    const poll = state.polls.find(p => p.id === state.currentPollId);
    if (!poll) {
        detailEl.innerHTML = `
            <div class="empty-poll-detail">
                <i data-lucide="vote" style="width: 48px; height: 48px; opacity: 0.2; margin-bottom: 1rem;"></i>
                <p>左のリストから投票を選択するか、新規作成してください</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons({ root: detailEl });
        return;
    }

    const self = state.members.find(m => m.isSelf);
    const userId = self ? self.id : 'guest';
    const isCreator = poll.createdBy === userId;

    const creator = (state.members || []).find(m => m.id === poll.createdBy);
    const creatorName = creator ? `${creator.lastName || ''}${creator.firstName || ''}` : 'ゲスト';

    const isClosed = poll.status === "closed" || (poll.deadline && new Date(poll.deadline) < new Date());
    const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
    const statusLabel = isClosed ? "終了" : "進行中";

    let deadlineHtml = "";
    if (poll.deadline) {
        const d = new Date(poll.deadline);
        deadlineHtml = `
            <div class="poll-deadline-display">
                <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
                期限: ${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}
                ${isClosed ? " (期限終了)" : ""}
            </div>
        `;
    }

    const anonymityLabel = poll.isAnonymous ? "匿名投票" : "記名投票（アバター公開）";

    let optionsHtml = poll.options.map(opt => {
        const votesCount = opt.votes ? opt.votes.length : 0;
        const percent = totalVotes === 0 ? 0 : Math.round((votesCount / totalVotes) * 100);
        const hasVoted = opt.votes && opt.votes.includes(userId);

        let avatarsHtml = "";
        if (!poll.isAnonymous && opt.votes && opt.votes.length > 0) {
            avatarsHtml = `
                <div class="poll-voters">
                    ${opt.votes.map(vId => {
                const m = state.members.find(member => member.id === vId);
                if (!m && vId !== 'guest') return "";
                const name = m ? `${m.lastName || ''}${m.firstName || ''}` : "ゲスト";
                const color = m ? (m.avatarColor || AVATAR_COLORS[state.members.indexOf(m) % AVATAR_COLORS.length]) : "#94a3b8";
                const initials = m ? (m.lastName ? m.lastName.slice(0, 1) : (m.firstName ? m.firstName.slice(0, 1) : '?')) : "G";
                const avatarContent = m && m.avatarImage
                    ? `<img src="${m.avatarImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                    : `<span style="font-size: 8px; font-weight: 700;">${initials}</span>`;
                return `<div class="poll-mini-avatar" title="${name}" style="background: ${m && m.avatarImage ? 'transparent' : color}; border: 1px solid var(--border); width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">${avatarContent}</div>`;
            }).join("")}
                </div>
            `;
        }

        return `
            <div class="poll-option-row">
                <div class="poll-option-main">
                    <button class="poll-vote-btn ${hasVoted ? 'voted' : ''}" onclick="votePoll('${poll.id}', '${opt.id}')" ${isClosed ? "disabled" : ""}>
                        ${hasVoted ? '<i data-lucide="check" style="width:12px;height:12px;color:white;"></i>' : ''}
                    </button>
                    <span class="poll-option-text-label">${opt.text}</span>
                    <span class="poll-option-count">${votesCount} 票</span>
                </div>
                <div class="poll-bar-container">
                    <div class="poll-bar-fill" style="width: ${percent}%"></div>
                </div>
                ${avatarsHtml}
            </div>
        `;
    }).join("");

    const adminControls = isCreator ? `
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="togglePollStatus('${poll.id}')">
                <i data-lucide="${poll.status === "active" ? 'lock' : 'unlock'}"></i> ${poll.status === "active" ? "終了する" : "再開する"}
            </button>
            <button class="btn btn-danger btn-sm" onclick="deletePoll('${poll.id}')">
                <i data-lucide="trash-2"></i> 削除
            </button>
        </div>
    ` : "";

    detailEl.innerHTML = `
        <div class="poll-detail-header">
            <div>
                <h2 style="margin: 0 0 0.5rem 0;">${poll.title}</h2>
                ${deadlineHtml}
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <span class="poll-status-badge ${!isClosed ? "poll-status-active" : "poll-status-closed"}">${statusLabel}</span>
                    <span style="color: var(--text-dim); font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${poll.type === "multiple" ? "複数選択可" : "単一選択"}</span>
                    <span style="color: var(--text-dim); font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${anonymityLabel}</span>
                    <span style="color: var(--text-dim); font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;"><i data-lucide="user" style="width:12px;height:12px;vertical-align:middle;margin-right:4px;"></i>作成者: ${creatorName}</span>
                </div>
            </div>
            ${adminControls}
        </div>
        <div class="poll-options-list">
            ${optionsHtml}
        </div>
        <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 0.8rem;">
            全 ${totalVotes} 票
        </div>
    `;

    if (window.lucide) lucide.createIcons({ root: detailEl });
}

function showPollCreateForm() {
    state.currentPollId = null;
    document.getElementById("poll-detail-content").style.display = "none";
    document.getElementById("poll-create-form").style.display = "block";

    // Reset state
    pollCreationMode = 'text';
    selectedDates = [];
    document.getElementById("btn-mode-text").classList.add("active");
    document.getElementById("btn-mode-calendar").classList.remove("active");
    document.getElementById("poll-text-options-container").style.display = "block";
    document.getElementById("poll-calendar-options-container").style.display = "none";

    // Set default deadline to 1 week from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(23, 59, 0, 0);
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(nextWeek - tzoffset)).toISOString().slice(0, 16);
    document.getElementById("poll-deadline-input").value = localISOTime;

    renderPollList();
    renderMiniCalendar();
}

function hidePollCreateForm() {
    document.getElementById("poll-detail-content").style.display = "block";
    document.getElementById("poll-create-form").style.display = "none";
}

window.setPollMode = (mode) => {
    pollCreationMode = mode;
    document.getElementById("btn-mode-text").classList.toggle("active", mode === 'text');
    document.getElementById("btn-mode-calendar").classList.toggle("active", mode === 'calendar');
    document.getElementById("poll-text-options-container").style.display = mode === 'text' ? "block" : "none";
    document.getElementById("poll-calendar-options-container").style.display = mode === 'calendar' ? "block" : "none";

    if (mode === 'calendar') renderMiniCalendar();
};

function renderMiniCalendar() {
    const container = document.getElementById("mini-calendar-picker");
    if (!container) return;

    const daysInMonth = new Date(miniCalendarYear, miniCalendarMonth + 1, 0).getDate();
    const firstDay = new Date(miniCalendarYear, miniCalendarMonth, 1).getDay();

    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

    let html = `
        <div class="mc-header">
            <button class="btn-icon" onclick="changeMiniCalendar(-1)"><i data-lucide="chevron-left"></i></button>
            <span>${miniCalendarYear}年 ${monthNames[miniCalendarMonth]}</span>
            <button class="btn-icon" onclick="changeMiniCalendar(1)"><i data-lucide="chevron-right"></i></button>
        </div>
        <div class="mc-grid">
            ${dayNames.map(d => `<div class="mc-day-head">${d}</div>`).join("")}
    `;

    // Empty spaces for first week
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="mc-day other-month"></div>`;
    }

    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${miniCalendarYear}-${String(miniCalendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = selectedDates.includes(dateStr);
        const isToday = today.getFullYear() === miniCalendarYear && today.getMonth() === miniCalendarMonth && today.getDate() === d;

        html += `<div class="mc-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" onclick="toggleDateSelection('${dateStr}')">${d}</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons({ root: container });

    renderSelectedDates();
}

window.changeMiniCalendar = (delta) => {
    miniCalendarMonth += delta;
    if (miniCalendarMonth > 11) {
        miniCalendarMonth = 0;
        miniCalendarYear++;
    } else if (miniCalendarMonth < 0) {
        miniCalendarMonth = 11;
        miniCalendarYear--;
    }
    renderMiniCalendar();
};

window.toggleDateSelection = (dateStr) => {
    const index = selectedDates.indexOf(dateStr);
    if (index === -1) {
        selectedDates.push(dateStr);
    } else {
        selectedDates.splice(index, 1);
    }
    selectedDates.sort();
    renderMiniCalendar();
};

function renderSelectedDates() {
    const container = document.getElementById("selected-dates-items");
    if (!container) return;

    if (selectedDates.length === 0) {
        container.innerHTML = `<div class="empty-msg">日付を選択してください</div>`;
        return;
    }

    container.innerHTML = selectedDates.map(dateStr => {
        const [y, m, d] = dateStr.split("-");
        const dateObj = new Date(y, m - 1, d);
        const dayName = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
        return `
            <div class="selected-date-chip">
                <span>${y}/${m}/${d} (${dayName})</span>
                <button onclick="toggleDateSelection('${dateStr}')">×</button>
            </div>
        `;
    }).join("");
}

function addPollOptionInput() {
    const container = document.getElementById("poll-options-inputs");
    const rowCount = container.querySelectorAll(".poll-option-input-row").length;
    const div = document.createElement("div");
    div.className = "poll-option-input-row";
    div.innerHTML = `
        <input type="text" class="poll-option-text" placeholder="選択肢${rowCount + 1}">
        <button class="btn-remove-option" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
}

function saveNewPoll() {
    const title = document.getElementById("poll-title-input").value.trim();
    if (!title) { alert("タイトルを入力してください"); return; }

    const deadlineStr = document.getElementById("poll-deadline-input").value;
    const deadline = deadlineStr ? new Date(deadlineStr).getTime() : null;

    let options = [];
    if (pollCreationMode === 'text') {
        const optionInputs = document.querySelectorAll(".poll-option-text");
        optionInputs.forEach((input, idx) => {
            const text = input.value.trim();
            if (text) {
                options.push({
                    id: "opt-" + Date.now() + "-" + idx,
                    text: text,
                    votes: []
                });
            }
        });
    } else {
        options = selectedDates.map((dateStr, idx) => {
            const [y, m, d] = dateStr.split("-");
            const dateObj = new Date(y, m - 1, d);
            const dayName = ["日", "月", "火", "水", "木", "金", "土"][dateObj.getDay()];
            return {
                id: "opt-" + Date.now() + "-" + idx,
                text: `${y}/${m}/${d} (${dayName})`,
                votes: []
            };
        });
    }

    if (options.length < 2) {
        alert(pollCreationMode === 'text' ? "選択肢を2つ以上入力してください" : "日付を2つ以上選択してください");
        return;
    }

    const anonymity = document.getElementById("poll-anonymity-select").value;
    const self = state.members.find(m => m.isSelf);
    const creatorId = self ? self.id : 'guest';

    const newPoll = {
        id: "poll-" + Date.now(),
        title: title,
        options: options,
        status: "active",
        type: document.getElementById("poll-type-select").value,
        isAnonymous: anonymity === "anonymous",
        createdBy: creatorId,
        deadline: deadline || null,
        createdAt: Date.now(),
        mode: pollCreationMode
    };

    if (!state.polls) state.polls = [];
    state.polls.unshift(newPoll);
    state.currentPollId = newPoll.id;

    // Reset form
    document.getElementById("poll-title-input").value = "";
    document.getElementById("poll-options-inputs").innerHTML = `
        <div class="poll-option-input-row">
            <input type="text" class="poll-option-text" placeholder="選択肢1">
        </div>
        <div class="poll-option-input-row">
            <input type="text" class="poll-option-text" placeholder="選択肢2">
        </div>
    `;
    document.getElementById("poll-anonymity-select").value = "non-anonymous";
    selectedDates = [];

    saveState();
    hidePollCreateForm();
    renderPollList();
    renderActivePoll();
    if (typeof updatePollNotification === 'function') updatePollNotification();
}

window.votePoll = (pollId, optionId) => {
    const poll = state.polls.find(p => p.id === pollId);
    if (!poll) return;

    // Check if closed
    const isClosed = poll.status === "closed" || (poll.deadline && new Date(poll.deadline) < new Date());
    if (isClosed) {
        alert("この投票は終了しています");
        return;
    }

    const self = state.members.find(m => m.isSelf);
    const userId = self ? self.id : 'guest';

    // If single choice, remove previous votes by this user
    if (poll.type === 'single') {
        poll.options.forEach(opt => {
            if (opt.votes) opt.votes = opt.votes.filter(v => v !== userId);
        });
    }

    const option = poll.options.find(o => o.id === optionId);
    if (option) {
        if (!option.votes) option.votes = [];
        // Prevent duplicate votes on the same option (for multiple choice too, maybe?)
        if (!option.votes.includes(userId)) {
            option.votes.push(userId);
        } else if (poll.type === 'multiple') {
            // Toggle vote if multiple choice?
            option.votes = option.votes.filter(v => v !== userId);
        }
    }

    saveState();
    renderActivePoll();
    if (typeof updatePollNotification === 'function') updatePollNotification();
};

window.togglePollStatus = (pollId) => {
    const poll = state.polls.find(p => p.id === pollId);
    if (poll) {
        poll.status = poll.status === "active" ? "closed" : "active";
        // If re-opening, maybe push deadline? For now just toggle status
        saveState();
        renderActivePoll();
        renderPollList();
        if (typeof updatePollNotification === 'function') updatePollNotification();
    }
};

window.deletePoll = (pollId) => {
    if (!confirm("この投票を削除しますか？")) return;
    state.polls = state.polls.filter(p => p.id !== pollId);
    if (state.currentPollId === pollId) state.currentPollId = null;
    saveState();
    renderPollList();
    renderActivePoll();
    if (typeof updatePollNotification === 'function') updatePollNotification();
};

function checkPollDeadlines() {
    if (!state.polls) return;
    const now = new Date();
    let changed = false;
    state.polls.forEach(poll => {
        if (poll.status === "active" && poll.deadline) {
            if (new Date(poll.deadline) < now) {
                poll.status = "closed";
                changed = true;
            }
        }
    });
    if (changed) {
        saveState();
        if (typeof updatePollNotification === 'function') updatePollNotification();
    }
}

// Check deadlines every minute
setInterval(checkPollDeadlines, 60000);

function updatePollNotification() {
    const badge = document.getElementById("polls-badge");
    if (!badge) return;

    if (!state.polls || state.polls.length === 0) {
        badge.style.display = "none";
        return;
    }

    const unvotedActivePolls = state.polls.filter(poll => {
        const isClosed = poll.status === "closed" || (poll.deadline && new Date(poll.deadline) < new Date());
        if (isClosed) return false;

        // Check if user has voted in any of the options
        // Since we simulate "anonymous" votes, we check if there are no votes at all in any option
        // In a real session-based app, we would check if the current user ID is in any opt.votes
        // For this student app context, we will treat a poll as "unvoted" if total votes is 0.
        const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
        return totalVotes === 0;
    });

    const count = unvotedActivePolls.length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = "block";
    } else {
        badge.style.display = "none";
    }

}

/** 相互評価シート関連の機能 */
window.handlePresentationScheduleImport = (e, targetIters = null) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            let data = JSON.parse(event.target.result);
            if (!state.presentationSchedules) state.presentationSchedules = {};
            if (targetIters) {
                let teamsList = Array.isArray(data) ? data : null;
                if (!teamsList && typeof data === 'object') {
                    const keys = Object.keys(data);
                    if (keys.length > 0 && Array.isArray(data[keys[0]])) {
                        teamsList = data[keys[0]];
                    }
                }
                if (!teamsList) throw new Error('Invalid format: Expected an array of teams.');
                targetIters.forEach(it => {
                    state.presentationSchedules[it] = teamsList;
                });
            } else {
                if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid format: Expected object map.');
                Object.assign(state.presentationSchedules, data);
            }

            saveState();
            alert('発表スケジュールを読み込みました。');
            if (document.getElementById('report-mutual').classList.contains('active')) {
                loadMutualEvaluation();
            }
        } catch (err) {
            alert('ファイルの形式が正しくありません。' + err.message);
            console.error(err);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
};

window.loadMutualEvaluation = () => {
    if (!currentMutualKey) return;

    const iterMatch = currentMutualKey.match(/\d+/);
    const iter = iterMatch ? iterMatch[0] : null;

    const schedules = state.presentationSchedules && state.presentationSchedules[iter] ? state.presentationSchedules[iter] : [];

    // Get logged-in member
    const self = state.members.find(m => m.isSelf);
    const userId = self ? self.id : 'guest';

    if (!state.reports[currentMutualKey]) state.reports[currentMutualKey] = { users: {}, submitted: false };
    const userReport = state.reports[currentMutualKey].users[userId] || { evaluations: {}, submitted: false };

    const container = document.getElementById('mutual-presentation-list');
    if (!container) return;

    if (schedules.length === 0) {
        container.innerHTML = '<div class="wr-no-flow">発表スケジュールデータが読み込まれていません。データ管理から読み込んでください。</div>';
        document.getElementById('mutual-remaining-budget').textContent = '¥5,000,000';
        return;
    }

    container.innerHTML = '';

    // Filter out own team
    const otherTeams = schedules.filter(s => s.symbol !== state.groupSymbol && s.teamName !== state.groupName);

    otherTeams.forEach((team, idx) => {
        const teamKey = team.symbol || team.teamName;
        const evalData = userReport.evaluations[teamKey] || { commentContent: '', commentPresentation: '', investment: 0 };

        const div = document.createElement('div');
        div.className = 'mutual-entry';
        div.innerHTML = `
            <div class="mutual-entry-header">
                <div>
                    <div class="mutual-team-name">${team.teamName}</div>
                    <div class="mutual-theme-tag">${team.theme || 'テーマ未設定'}</div>
                </div>
                <div class="mutual-investment-area">
                    <input type="number" class="mutual-investment-input" value="${evalData.investment || 0}" 
                        min="0" step="100000" onchange="updateMutualInvestment('${teamKey}', this.value)">
                    <div class="mutual-currency-unit">円を投資</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
                <div class="form-group">
                    <label style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600;">【内容面】へのフィードバック</label>
                    <div class="wr-textarea-wrap">
                        <textarea class="wr-textarea mutual-comment-input" rows="2" maxlength="200"
                            placeholder="分析の深さ、アイデアの斬新さなど"
                            oninput="updateMutualComment('${teamKey}', 'commentContent', this.value)">${evalData.commentContent || ''}</textarea>
                        <div class="wr-char-counter"><span>${(evalData.commentContent || '').length}</span>文字</div>
                    </div>
                </div>
                <div class="form-group">
                    <label style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600;">【発表面】へのフィードバック</label>
                    <div class="wr-textarea-wrap">
                        <textarea class="wr-textarea mutual-comment-input" rows="2" maxlength="200"
                            placeholder="スライドの見やすさ、話し方など"
                            oninput="updateMutualComment('${teamKey}', 'commentPresentation', this.value)">${evalData.commentPresentation || ''}</textarea>
                        <div class="wr-char-counter"><span>${(evalData.commentPresentation || '').length}</span>文字</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    updateMutualRemainingBudget();


    // Lock if submitted
    const isSubmitted = userReport.submitted || (state.reports[currentMutualKey] && state.reports[currentMutualKey].submitted);
    const editor = document.querySelector('.mutual-editor');
    if (editor) {
        editor.querySelectorAll('input, textarea, button:not([onclick*="switchView"])').forEach(el => {
            el.disabled = isSubmitted;
        });

        const existingBanner = document.getElementById('mutual-submitted-banner');
        if (existingBanner) existingBanner.remove();

        if (isSubmitted) {
            const banner = document.createElement('div');
            banner.id = 'mutual-submitted-banner';
            banner.className = 'wr-status-banner submitted mb-1';
            banner.style = "margin-bottom: 1rem;";
            banner.innerHTML = `
                <div class="wr-status-info" style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="lock"></i>
                    <span>提出済みのため編集できません。</span>
                </div>
            `;
            editor.insertBefore(banner, editor.firstChild);
            if (window.lucide) lucide.createIcons();
        }
    }
};

window.updateMutualComment = (teamKey, field, val) => {
    if (!currentMutualKey) return;
    const self = state.members.find(m => m.isSelf);
    const userId = self ? self.id : 'guest';

    if (!state.reports[currentMutualKey]) state.reports[currentMutualKey] = { users: {}, submitted: false };
    if (!state.reports[currentMutualKey].users[userId]) state.reports[currentMutualKey].users[userId] = { evaluations: {}, submitted: false };
    if (!state.reports[currentMutualKey].users[userId].evaluations[teamKey]) {
        state.reports[currentMutualKey].users[userId].evaluations[teamKey] = { commentContent: '', commentPresentation: '', investment: 0 };
    }

    state.reports[currentMutualKey].users[userId].evaluations[teamKey][field] = val;

    // Update char count UI for this specific textarea
    const entries = document.querySelectorAll('.mutual-entry');
    entries.forEach(entry => {
        const titleEl = entry.querySelector('.mutual-team-name');
        if (titleEl.textContent === teamKey) {
            const textareas = entry.querySelectorAll('textarea');
            textareas.forEach(ta => {
                if (ta.getAttribute('oninput').includes(`'${field}'`)) {
                    const counter = ta.parentElement.querySelector('.wr-char-counter span');
                    if (counter) counter.textContent = val.length;
                }
            });
        }
    });
};

window.updateMutualInvestment = (teamKey, val) => {
    if (!currentMutualKey) return;
    const amount = parseInt(val) || 0;
    const self = state.members.find(m => m.isSelf);
    const userId = self ? self.id : 'guest';

    if (!state.reports[currentMutualKey]) state.reports[currentMutualKey] = { users: {}, submitted: false };
    if (!state.reports[currentMutualKey].users[userId]) state.reports[currentMutualKey].users[userId] = { evaluations: {}, submitted: false };
    if (!state.reports[currentMutualKey].users[userId].evaluations[teamKey]) state.reports[currentMutualKey].users[userId].evaluations[teamKey] = { comment: '', investment: 0 };

    state.reports[currentMutualKey].users[userId].evaluations[teamKey].investment = amount;
    updateMutualRemainingBudget();
};

window.updateMutualRemainingBudget = () => {
    if (!currentMutualKey) return;
    const self = state.members.find(m => m.isSelf);
    const userId = self ? self.id : 'guest';

    if (!state.reports[currentMutualKey] || !state.reports[currentMutualKey].users[userId]) return;

    const TOTAL_CAPITAL = 5000000;
    let spent = 0;
    Object.values(state.reports[currentMutualKey].users[userId].evaluations).forEach(e => {
        spent += (e.investment || 0);
    });
    const remaining = TOTAL_CAPITAL - spent;
    const el = document.getElementById('mutual-remaining-budget');
    if (el) {
        el.textContent = `¥${remaining.toLocaleString()}`;
        el.style.color = remaining < 0 ? 'var(--danger)' : '#10b981';
    }
};

window.saveMutualEvaluation = (isSubmit = false) => {
    if (!currentMutualKey) return;

    const self = state.members.find(m => m.isSelf);
    const userId = self ? self.id : 'guest';

    if (!state.reports[currentMutualKey]) state.reports[currentMutualKey] = { users: {}, submitted: false };
    const userReport = state.reports[currentMutualKey].users[userId];
    if (!userReport) return;

    if (isSubmit) {
        let spent = 0;
        Object.values(userReport.evaluations).forEach(e => spent += e.investment);
        if (spent > 5000000) {
            alert('投資額の合計が500万円を超えています。');
            return;
        }
        if (!confirm('提出すると修正できなくなります。よろしいですか？')) return;
    }

    userReport.submitted = isSubmit;
    userReport.updatedAt = new Date().toISOString();
    saveState();

    if (isSubmit) {
        alert('相互評価（個人分）を提出しました。');
        renderGantt();
        switchView('gantt');
    } else {
        const btn = document.getElementById('btn-save-mutual-draft');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> 保存しました';
            if (window.lucide) lucide.createIcons();
            setTimeout(() => { btn.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 1500);
        }
        renderGantt();
    }
};

/** ダミーの発表スケジュールを生成（動作確認用） */
window.generateDummyPresentationData = () => {
    const dummyData = {
        "13": [],
        "26": [],
        "27": []
    };

    const themes = [
        "AIを活用した地域見守りシステム", "循環型農業のIT支援プラットフォーム", "学生向けスキルシェアマーケット",
        "商店街活性化のためのARスタンプラリー", "学食の混雑緩和予測アプリ", "リサイクル素材によるプロダクトデザイン",
        "高齢者向けスマートフィットネス", "地産地消を推進するECサイト", "オープンデータによる災害避難シミュレータ",
        "マイクロモビリティのシェアリング管理", "伝統工芸のデジタルアーカイブ", "キャンパス内デリバリーロボット",
        "ボランティア活動のマッチングハブ", "VRによる歴史建造物の再現", "音声認識による議事録自動作成ツール",
        "エネルギー消費可視化スマートホーム"
    ];

    const symbols = "ABCDEFGHIJKLMNOP".split("");

    symbols.forEach((s, idx) => {
        const team = {
            symbol: s,
            teamName: `チーム ${s} (${themes[idx].slice(0, 4)})`,
            theme: themes[idx]
        };
        // In dummy mode, put all 16 teams into both midterm and final
        dummyData["13"].push(team);
        dummyData["26"].push(team);
        dummyData["27"].push(team);
    });

    state.presentationSchedules = dummyData;
    saveState();
    alert('ダミーの発表スケジュール（16件）を生成しました。');
    if (document.getElementById('report-mutual').classList.contains('active')) {
        loadMutualEvaluation();
    }
};



