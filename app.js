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
    deliverableTargets: DEFAULT_DELIVERABLE_TARGETS
};

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
    document.getElementById('btn-export-teacher-json')?.addEventListener('click', exportTeacherSetup);
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

    // Report Tabs switching
    document.querySelectorAll('.report-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const reportId = tab.getAttribute('data-report');
            switchTab(reportId);
        });
    });

    // Save Analysis & Contribution
    document.getElementById('btn-save-analysis').addEventListener('click', saveAnalysisReport);
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

    // Attachments
    document.getElementById('btn-attach-file').addEventListener('click', () => {
        document.getElementById('message-file-input').click();
    });
    document.getElementById('message-file-input').addEventListener('change', handleFileSelect);

    // Bookmarks - Handled via direct table interaction
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
        mindmap: 'マインドマップ',
        messages: 'メンバー伝言板',
        bookmarks: 'ブックマーク・参考ソース',
        deliverables: '成果物フォルダ'
    };
    document.getElementById('view-title').textContent = titles[viewId] || 'PBL2 Manager';

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

        card.innerHTML = `
            <input type="file" id="avatar-input-${index}" name="avatarInput" aria-label="アバターアップロード" accept="image/*" style="display:none" onchange="setAvatarImage(${index}, this)">
            <div class="member-card-smart ${isLocked ? 'locked' : ''}">
                <div class="smart-row-top">
                    <div class="smart-avatar-container" ${!(isLocked || state.isConfigLocked) ? `onclick="document.getElementById('avatar-input-${index}').click()" oncontextmenu="clearAvatarImage(${index}); return false;"` : ''}>
                        <div class="smart-avatar" style="background:${avatarBg};">
                            ${avatarInner}
                            ${!(isLocked || state.isConfigLocked) ? `
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
                        <div class="smart-self-indicator ${member.isSelf ? 'active' : ''}" onclick="setSelf(${index})" style="border: 1px solid var(--border); padding: 0 4px; border-radius: 4px; background: rgba(0,0,0,0.2); cursor: pointer;">
                            ${member.isSelf ? '自分' : '他'}
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
        {
            id: 'effort',
            name: '取り組み',
            color: '#ef4444', // Red
            items: [
                { name: '作業報告書提出', type: 'report', key: 'work-reports' },
                { name: '課題設定レポート', type: 'analysis', key: 'analysis', target: targets.analysis },
                { name: '貢献度調査', type: 'contribution', key: 'contribution', targets: targets.contribution }
            ]
        },
        {
            id: 'presentation',
            name: '発表成果',
            color: '#f59e0b', // Orange
            items: [
                { name: '事業企画ポスター', type: 'toggle', key: 'poster', target: targets.poster },
                { name: '事業企画リーフレット', type: 'toggle', key: 'leaflet', target: targets.leaflet },
                { name: '相互評価シート', type: 'individual', key: 'mutual', targets: targets.mutual },
                { name: '振り返りシート', type: 'individual', key: 'reflection', targets: targets.reflection },
                { name: '製品・サービスパンフレット', type: 'toggle', key: 'pamphlet_25', target: targets.pamphlet },
                { name: '最終プレゼンスライド', type: 'toggle', key: 'slides_25', target: targets.slides }
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

        // Render Pre-defined Deliverables for this category
        group.items.forEach(item => {
            const labelCell = document.createElement('div');
            labelCell.className = 'gantt-label deliverable-label';
            labelCell.style.borderLeftColor = group.color;
            labelCell.innerHTML = `<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.name}">${item.name}</span>`;
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
                if (item.type === 'report') {
                    const iter = i; // iter = actual session number (matches DEFAULT_SCHEDULE id)
                    const startIter = targets.workReportStart || 3;
                    if (iter >= startIter) { // Reports start from defined session
                        const report = state.reports[iter];
                        const isSubmitted = report && report.submitted;
                        const hasDraft = report && report.content && !isSubmitted;

                        const marker = document.createElement('div');
                        marker.className = `report-marker ${isSubmitted ? 'submitted' : (hasDraft ? 'draft' : 'pending')} category-effort`;

                        if (isSubmitted) {
                            marker.innerHTML = '<i data-lucide="check"></i>';
                        } else if (hasDraft) {
                            marker.innerHTML = '<span class="dot-icon">●</span>';
                        }

                        marker.title = `第${iter}回 作業報告書: ${isSubmitted ? '提出済' : (hasDraft ? '下書き保存中' : '未作成')}\nクリックで編集へ`;
                        marker.onclick = () => openWorkReport(iter);
                        cell.appendChild(marker);
                    }
                } else {
                    const isTarget = item.target === i || (item.targets && item.targets.includes(i));
                    if (isTarget) {
                        const itKey = item.targets ? `${item.key}_${i}` : item.key;
                        let isSubmitted = false;
                        let hasDraft = false;

                        let progressText = '';
                        if (item.type === 'contribution' || item.type === 'individual') {
                            const reportGroup = state.reports[itKey];
                            const memberCount = (state.members || []).length;
                            if (reportGroup && memberCount > 0) {
                                let startedCount = 0;
                                let submittedCount = 0;
                                (state.members || []).forEach(m => {
                                    const userRep = reportGroup[m.id];
                                    if (userRep) {
                                        if (userRep.submitted) submittedCount++;
                                        const hasInteraction = (userRep.ratings && Object.keys(userRep.ratings).length > 0) ||
                                            (userRep.roles && Object.keys(userRep.roles).length > 0) ||
                                            userRep.content;
                                        if (hasInteraction || userRep.submitted) startedCount++;
                                    }
                                });
                                isSubmitted = submittedCount >= memberCount;
                                hasDraft = !isSubmitted && startedCount > 0;
                                progressText = `${submittedCount}/${memberCount}人完了`;
                            } else {
                                isSubmitted = false;
                                hasDraft = false;
                                progressText = `0/${memberCount}人完了`;
                            }
                        } else if (item.type === 'toggle') {
                            const settings = state.artifactSettings && state.artifactSettings[item.key];
                            // Check if it's one of the complex artifacts
                            if (['poster', 'leaflet', 'pamphlet_25', 'slides_25'].includes(item.key)) {
                                isSubmitted = settings && settings.submitted;
                                hasDraft = !isSubmitted && settings && settings.slides && settings.slides.length > 0;
                            } else {
                                // Simple toggle
                                isSubmitted = state.artifacts[itKey];
                                hasDraft = false;
                            }
                        } else {
                            const report = state.reports[itKey];
                            isSubmitted = report && report.submitted;
                            hasDraft = !isSubmitted && report && report.content;
                        }

                        const marker = document.createElement('div');
                        const catClass = group.id === 'effort' ? 'category-effort' : 'category-presentation';
                        marker.className = `report-marker ${isSubmitted ? 'submitted' : (hasDraft ? 'draft' : 'pending')} ${catClass}`;

                        if (isSubmitted) {
                            marker.innerHTML = '<i data-lucide="check"></i>';
                        } else if (hasDraft) {
                            marker.innerHTML = '<span class="dot-icon">●</span>';
                        }

                        let statusText = isSubmitted ? '提出済' : (hasDraft ? '作成中(下書きあり)' : '未着手');
                        if (progressText) statusText += ` (${progressText})`;
                        marker.title = `${item.name} (${i}回目): ${statusText}\nクリックで編集・登録`;
                        marker.onclick = () => {
                            if (item.type === 'toggle') {
                                if (['poster', 'leaflet', 'pamphlet_25', 'slides_25'].includes(item.key)) {
                                    // Special interactive modal for detailed deliverables
                                    openArtifactModal(itKey, item.name);
                                } else {
                                    // Simple toggle for others
                                    state.artifacts[itKey] = !state.artifacts[itKey];
                                    saveState();
                                    renderGantt();
                                }
                            } else {
                                switchView('reports');
                                if (item.type === 'analysis') switchTab('analysis-report');
                                else {
                                    switchTab('contribution');
                                    currentContributionKey = itKey;
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
    currentArtifactKey = key;
    currentSlideIndex = -1;
    document.getElementById('artifact-modal-title').textContent = `${name} 詳細設定`;

    // Initialize data if not exists
    if (!state.artifactSettings) state.artifactSettings = {};
    if (!state.artifactSettings[key]) {
        state.artifactSettings[key] = { slides: [], submitted: false };
    }
    const data = state.artifactSettings[key];

    renderArtifactSlides();
    renderArtifactMemberList();

    // Reset viewer
    document.getElementById('hotspot-container').style.display = 'none';
    document.getElementById('presenters-section').style.display = 'none';
    document.getElementById('viewer-placeholder').style.display = 'block';

    // Apply Locking
    applyArtifactLockState(data.submitted, data.submittedAt);

    document.getElementById('modal-artifact-detail').classList.add('active');
    renderContributorChart();
    if (window.lucide) lucide.createIcons();
}

/** Apply or remove the locked state on the artifact modal */
function applyArtifactLockState(isLocked, submittedAt) {
    const modal = document.getElementById('modal-artifact-detail');
    const banner = document.getElementById('artifact-submitted-banner');
    const atEl = document.getElementById('artifact-submitted-at');
    const footerBtns = document.getElementById('artifact-modal-footer-btns');

    // Controls to disable
    const controls = [
        document.getElementById('btn-add-artifact-slide'),
        document.getElementById('btn-draft-artifact-data'),
        document.getElementById('btn-submit-artifact-data'),
        document.getElementById('btn-clear-hotspots'),
        document.getElementById('btn-clear-all-hotspots')
    ];

    if (isLocked) {
        modal.classList.add('locked');
        banner.style.display = 'flex';
        if (atEl && submittedAt) {
            atEl.textContent = `提出日時: ${new Date(submittedAt).toLocaleString('ja-JP')}`;
        }
        controls.forEach(c => { if (c) c.style.display = 'none'; });
        // Enable Rich Editor readonly if possible, or just overlay
        document.getElementById('artifact-presentation-script').contentEditable = "false";
    } else {
        modal.classList.remove('locked');
        banner.style.display = 'none';
        controls.forEach(c => { if (c) c.style.display = 'flex'; });
        // Restore buttons that were 'flex' originally
        document.getElementById('btn-add-artifact-slide').style.display = 'block';
        document.getElementById('artifact-presentation-script').contentEditable = "true";
    }
}

/** Close the artifact modal */
function closeArtifactModal() {
    document.getElementById('modal-artifact-detail').classList.remove('active');
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

    if (!confirm('この成果物のすべてのスライドと担当設定を完全に削除しますか？\n(削除後、元に戻すことはできません)')) return;

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
                        if (art.key === currentArtifactKey) return art.name || '成果物';
                    }
                }
            }
        }
        return '成果物';
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
    const container = document.getElementById('hotspot-container');
    const drawingRect = document.getElementById('drawing-rect');

    container.addEventListener('mousedown', (e) => {
        if (currentSlideIndex === -1) return;
        const rect = container.getBoundingClientRect();
        isDrawingHotspot = true;

        // Use clientX/Y to get consistent coordinates regardless of where mousedown originated
        hotspotStartPos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        drawingRect.style.left = hotspotStartPos.x + 'px';
        drawingRect.style.top = hotspotStartPos.y + 'px';
        drawingRect.style.width = '0px';
        drawingRect.style.height = '0px';
        drawingRect.style.display = 'block';

        e.preventDefault(); // Prevent text selection
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

        // Convert to Percentages for responsiveness
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
        alert('この成果物はすでに提出済みです。');
        return;
    }

    const hasData = data && data.slides && data.slides.length > 0;
    state.artifacts[currentArtifactKey] = hasData; // Keep legacy flag for Gantt marking

    if (hasData) {
        data.updatedAt = new Date().toISOString();
    }
    saveState();

    // Visual feedback
    const btn = document.getElementById('btn-draft-artifact-data');
    const orig = btn.innerText;
    btn.innerText = '保存しました';
    btn.style.background = '#059669';
    setTimeout(() => { btn.innerText = orig; btn.style.background = ''; }, 1500);

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

    if (!confirm('この成果物を「最終提出」しますか？\n提出後の編集はできなくなります（解除にはパスワードが必要です）。')) return;

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
let currentContributionKey = '';

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
            statusEl.classList.add('over'); statusEl.textContent = '趁E��';
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
        container.innerHTML = '<p class="wr-hint">タスクが登録されてぁE��せん�E�ガントチャートで追加してください�E�E/p>';
        return;
    }

    const currentData = getWrCurrent();
    const selectedIds = currentData?.selectedTasks || [];

    // Group tasks by category
    const groups = [
        { id: 'effort', label: '取り絁E��タスク', color: '#6366f1', tasks: state.tasks.filter(t => !t.category || t.category === 'effort') },
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
                <div class="wr-no-flow" style="padding:1rem;">プロセスフロー未登録<br><small>タスクを編雁E��てマインド�EチE�Eを保存してください</small></div>
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

                const img = mk('image', { x: x - r, y: y - r, width: r * 2, height: r * 2, href: m.avatarImage, 'clip-path': `url(#${clipId})`, preserveAspectRatio: 'xMidYMid slice' });
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
    setEl('wr-iter-label', session ? `第${session.id}回` : `第${iter}回`);
    setEl('wr-iter-date', session ? formatDate(session.date) : '-');

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
    state.reports['analysis'] = { bg, problem, solution, content, updatedAt: new Date().toISOString() };
    saveState();
    alert('課題設定レポ�Eトを保存しました');
    renderGantt();
}

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
        list.innerHTML = '<li class="empty-msg">活動�Eまだありません</li>';
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

    const selfMember = state.members.find(m => m.isSelf);
    const selfKey = selfMember ? (selfMember.emailLocal || (selfMember.lastName + selfMember.firstName)) : null;

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
        }

        const isMe = selfKey && (msg.senderKey === selfKey);

        const div = document.createElement('div');
        div.className = `message-item ${isMe ? 'self' : ''}`;

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
        const readByNames = [];
        if (readCount > 0 && state.members) {
            readBy.forEach(readerKey => {
                const m = state.members.find(mem => (mem.emailLocal || ((mem.lastName || '') + (mem.firstName || ''))) === readerKey);
                if (m) readByNames.push((m.lastName || '') + (m.firstName || ''));
            });
        }
        const readTooltip = readByNames.length > 0 ? `既読: ${readByNames.join(', ')}` : 'まだ誰も読んでいません';
        const readLabel = `<span class="message-read-status" title="${readTooltip}">${readCount > 0 ? `既読 ${readCount}` : '未読'}</span>`;

        const reactionsHtml = msg.reactions ? Object.entries(msg.reactions).map(([emoji, users]) => {
            const hasReacted = selfKey && users.includes(selfKey);
            const userNames = users.map(uKey => {
                const m = state.members.find(mem => (mem.emailLocal || ((mem.lastName || '') + (mem.firstName || ''))) === uKey);
                return m ? `${m.lastName || ''}${m.firstName || ''}` : uKey;
            }).join(', ');
            return `<div class="reaction-badge ${hasReacted ? 'active' : ''}" onclick="addReaction('${msg.id}', '${emoji}')" title="${emoji}: ${userNames}">${emoji} ${users.length}</div>`;
        }).join('') : '';

        div.innerHTML = `
            <div class="message-avatar" style="background:${avatarBg};" title="${msg.senderName}">
                ${avatarInner}
            </div>
            <div class="message-content-wrapper">
                <div class="message-meta">
                    <span style="font-weight:600;">${msg.senderName}</span>
                    <span>${timeStr}</span>
                </div>
                <div class="message-bubble">${formatMessageContent(msg.content)}${renderAttachments(msg.attachments)}${isMe ? `<button class="btn-delete-msg" onclick="deleteMessage('${msg.id}')" title="削除">×</button>` : ''}</div>
                <div class="message-reactions-wrapper">
                    ${isMe ? readLabel : ''}
                    <div class="message-reactions">${reactionsHtml}</div>
                    <button class="btn-add-reaction" onclick="toggleReactionPicker(event, '${msg.id}')" title="リアクションを追加">
                        <i data-lucide="smile-plus" style="width:16px; height:16px;"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(div);
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

    // Save current state first
    saveState();

    state.currentTopicId = topicId;

    // Mark messages in new topic as read
    markMessagesAsRead();
    saveState();

    updateMessageNotification(); // Badge needs update after reading current topic
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
    if (!container || !breadcrumb) return;

    container.innerHTML = '';

    // Breadcrumb setup
    if (folderId === 'root') {
        breadcrumb.innerHTML = '<span class="breadcrumb-item active"><i data-lucide="package" style="width:14px;height:14px;"></i> 成果物ルート</span>';
    } else {
        const icon = folderId === 'reports' ? 'clipboard-list' : 'presentation';
        const label = folderId === 'reports' ? '活動報告書' : '提出用成果物';
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item" onclick="renderDeliverables('root')" style="cursor:pointer">
                <i data-lucide="package" style="width:14px;height:14px;"></i> 成果物ルート
            </span>
            <span class="breadcrumb-item active">
                <i data-lucide="${icon}" style="width:14px;height:14px;"></i> ${label}
            </span>
        `;
    }

    if (folderId === 'root') {
        const startIter = state.deliverableTargets?.workReportStart || 3;
        const folders = [
            { id: 'reports', name: '活動報告書', icon: 'clipboard-list', desc: `各回の実施報告書 (第${startIter}回〜)`, color: '#6366f1' },
            { id: 'presentation', name: '提出用成果物', icon: 'presentation', desc: 'ポスター・スライド・レポート', color: '#f59e0b' }
        ];

        folders.forEach(f => {
            const item = createDeliverableItem(f.name, f.icon, f.desc, f.color);
            item.onclick = () => renderDeliverables(f.id);
            container.appendChild(item);
        });
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
                if (isSubmitted) {
                    openWorkReport(s.id);
                    setTimeout(() => previewWorkReport(), 100);
                } else {
                    openWorkReport(s.id);
                }
            };
            container.appendChild(item);
        });
    } else if (folderId === 'presentation') {
        const ARTIFACT_DEFS = [
            { key: 'poster', name: '事業企画ポスター', icon: 'image', color: '#4f46e5' },
            { key: 'leaflet', name: '事業企画リーフレット', icon: 'file-text', color: '#0ea5e9' },
            { key: 'pamphlet_25', name: '製品・サービスパンフレット', icon: 'book-open', color: '#10b981' },
            { key: 'slides_25', name: '最終プレゼンスライド', icon: 'presentation', color: '#f59e0b' },
            { key: 'analysis', name: '課題設定レポート (分析)', icon: 'file-bar-chart', color: '#6366f1' }
        ];

        ARTIFACT_DEFS.forEach(def => {
            let isFinal = false;
            let hasDraft = false;
            let statusLabel = '未登録';
            let statusColor = 'var(--text-dim)';

            if (def.key === 'analysis') {
                const r = state.reports && state.reports['analysis'];
                isFinal = r && r.updatedAt;
                statusLabel = isFinal ? '作成済み' : '未作成';
                statusColor = isFinal ? 'var(--success)' : 'var(--text-dim)';
            } else {
                const settings = state.artifactSettings && state.artifactSettings[def.key];
                isFinal = settings && settings.submitted;
                hasDraft = settings && settings.slides && settings.slides.length > 0 && !isFinal;

                if (isFinal) {
                    statusLabel = '最終提出済み';
                    statusColor = 'var(--success)';
                } else if (hasDraft) {
                    statusLabel = '下書き保存中';
                    statusColor = 'var(--warning)';
                }
            }

            const item = createDeliverableItem(def.name, def.icon, statusLabel, statusColor, isFinal);
            item.onclick = () => {
                if (isFinal && def.key !== 'analysis') {
                    openArtifactModal(def.key, def.name);
                    setTimeout(() => { exportArtifactScript(); closeArtifactModal(); }, 100);
                } else if (def.key === 'analysis') {
                    switchView('reports');
                    switchTab('analysis-report');
                } else {
                    openArtifactModal(def.key, def.name);
                }
            };
            container.appendChild(item);
        });
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
