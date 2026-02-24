const fs = require('fs');

const initialData = JSON.parse(fs.readFileSync('2026_株式会社ムーン・ラボラトリー_A.json', 'utf8'));

// Generate unique IDs for tasks and members
const generateId = () => Math.random().toString(36).substr(2, 9);
const now = new Date().toISOString();

const members = initialData.members.map((m, i) => ({
    ...m,
    id: generateId(),
    updatedAt: now,
    isSelf: i === 0 // Make the first member "self" for evaluation purposes
}));

const selfId = members[0].id;

const reports = {};

// 1. Work Reports (Sessions 3 to 28)
for (let i = 3; i <= 28; i++) {
    reports[i.toString()] = {
        achievement: "今週のタスクを完了しました。ユーザーインタビューを実施し、要件定義の方向性を固めることができました。",
        challenge: "想定よりもアンケートの回収率が低く、次のセッションで追加の調査を行う必要があります。",
        communications: ["調査依頼済み", "デザイン修正着手", "モックアップ作成中"],
        selectedTasks: [],
        content: "今週のタスクを完了しました。ユーザーインタビューを実施し、要件定義の方向性を固めることができました。\n想定よりもアンケートの回収率が低く、次のセッションで追加の調査を行う必要があります。",
        submitted: true,
        submittedAt: now,
        updatedAt: now
    };
}

// 2. Analysis Report
reports['analysis'] = {
    bg: "現状の社会課題として、地域資源が十分に活用されていない問題があります。",
    problem: "高齢化が進む地域において、持続可能なツーリズムの仕組みが欠如している点です。",
    solution: "AIを活用したパーソナライズされた観光ルート生成アプリを開発し、地域経済を活性化します。",
    content: "現状の社会課題として、地域資源が十分に活用されていない問題があります。\n高齢化が進む地域において、持続可能なツーリズムの仕組みが欠如している点です。\nAIを活用したパーソナライズされた観光ルート生成アプリを開発し、地域経済を活性化します。",
    submitted: true,
    updatedAt: now
};

// 3. Contribution Surveys (13 and 27)
['contribution_13', 'contribution_27'].forEach(key => {
    const reportData = {};
    members.forEach(m => {
        const ratings = {};
        const roles = {};
        members.forEach(otherM => {
            if (otherM.id !== m.id) {
                ratings[otherM.id] = 5;
            }
            roles[otherM.id] = ["プロジェクトリーダー", "エンジニアリング"];
        });
        reportData[m.id] = {
            ratings,
            roles,
            submitted: true,
            updatedAt: now
        };
    });
    reports[key] = reportData;
});

// 4. Mutual Evaluations (group_eval_13, group_eval_27)
['group_eval_13', 'group_eval_27'].forEach(key => {
    const reportData = { users: {} };
    members.forEach(m => {
        reportData.users[m.id] = {
            submitted: true,
            updatedAt: now,
            evaluations: {
                "some-other-team": {
                    investment: 5000000,
                    comment: "非常に素晴らしい提案でした。技術的な実現性も高く、投資価値があると感じました。"
                }
            }
        };
    });
    reports[key] = reportData;
});

// 5. Reflection Sheets (feedback_13, feedback_27)
['feedback_13', 'feedback_27'].forEach(key => {
    reports[key] = {
        author: [selfId],
        feedbackEntries: [
            { content: " UIがとても分かりやすいという評価を受けました。", presentation: "全体的に好印象" },
            { content: " ターゲット層の絞り込みが甘いという指摘がありました。", presentation: "要検討" }
        ],
        futurePlans: "指摘されたターゲット層の絞り込みについて、次週のミーティングでペルソナを再定義します。また、プロトタイプの改善も並行して進めます。",
        submitted: true,
        updatedAt: now
    };
});

const artifactSettings = {};
['poster', 'leaflet', 'pamphlet', 'slides'].forEach(key => {
    artifactSettings[key] = {
        submitted: true,
        submittedAt: now,
        updatedAt: now,
        slides: [
            {
                src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzRmNDZlNSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U2FtcGxlIEFydGlmYWN0PC90ZXh0Pjwvc3ZnPg==",
                hotspots: []
            }
        ]
    };
});

const artifacts = {
    poster: true,
    leaflet: true,
    pamphlet_25: true,
    slides_25: true
};

const fullState = {
    themeName: initialData.themeName,
    companyName: initialData.companyName,
    groupSymbol: initialData.groupSymbol,
    groupName: "ムーン・ツアーズ",
    groupLogo: "",
    teamsUrl: "",
    members: members,
    isConfigLocked: true,
    membersLocked: true,
    tasks: [
        {
            uuid: generateId(),
            text: "要件定義書の作成",
            startIter: 3,
            endIter: 5,
            completed: true,
            color: "#6366f1",
            assignees: [members[0].id, members[1].id],
            updatedAt: now
        },
        {
            uuid: generateId(),
            text: "プロトタイプ開発",
            startIter: 6,
            endIter: 13,
            completed: true,
            color: "#10b981",
            assignees: members.map(m => m.id),
            updatedAt: now
        }
    ],
    reports: reports,
    presentationSchedules: {},
    artifactSettings: artifactSettings,
    artifacts: artifacts,
    analysisReport: reports['analysis'], // for legacy compatibility
    schedule: initialData.schedule,
    sidebarCollapsed: false,
    messages: [],
    topics: [{ id: 'general', name: '全般', createdBy: 'system', timestamp: 0 }, { id: 'from_teacher', name: '教員より', createdBy: 'system', timestamp: 0 }],
    lastMessagesCheckTime: 0,
    currentTopicId: 'from_teacher',
    supervisingInstructors: initialData.supervisingInstructors,
    bookmarks: [],
    deliverableTargets: initialData.deliverableTargets,
    bmc: {},
    polls: [],
    currentPollId: null
};

// Write output
const outFileName = 'pbl2_full_submitted_backup.json';
fs.writeFileSync(outFileName, JSON.stringify(fullState, null, 2), 'utf8');

console.log(`Generated full backup: ${outFileName}`);
