const fs = require('fs');

const initialData = JSON.parse(fs.readFileSync('2026_株式会社ムーン・ラボラトリー_A.json', 'utf8'));

// Generate unique IDs for tasks and members
const generateId = () => Math.random().toString(36).substr(2, 9);
const now = new Date();
const nowStr = now.toISOString();

// Create realistic Avatars (Simple colored circles with initials)
const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899'];
const generateAvatar = (name, index) => {
    const c = colors[index % colors.length];
    const initial = name.charAt(0);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="50" fill="${c}"/>
        <text x="50" y="65" font-family="sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const roles = [
    "プロジェクトリーダー",
    "マーケティング",
    "エンジニアリング",
    "エンジニアリング",
    "エンジニアリング",
    "プロモーション",
    "プロモーション"
];

const members = initialData.members.map((m, i) => ({
    ...m,
    id: generateId(),
    updatedAt: nowStr,
    isSelf: i === 0,
    role: roles[i],
    avatarImage: generateAvatar(m.lastName, i)
}));

const selfId = members[0].id;
const pLeaderId = members[0].id; // Sakai
const engGroupIds = members.filter(m => m.role === "エンジニアリング").map(m => m.id);
const mktGroupIds = members.filter(m => m.role === "マーケティング").map(m => m.id);
const prmGroupIds = members.filter(m => m.role === "プロモーション").map(m => m.id);

// 1. Tasks
const tasks = [
    { uuid: generateId(), text: "市場調査と課題ヒアリング", startIter: 3, endIter: 5, completed: true, color: "#f59e0b", assignees: mktGroupIds, updatedAt: nowStr },
    { uuid: generateId(), text: "要件定義とペルソナ作成", startIter: 5, endIter: 7, completed: true, color: "#6366f1", assignees: [...mktGroupIds, engGroupIds[0]], updatedAt: nowStr },
    { uuid: generateId(), text: "技術検証 (PoC) とモックアップ作成", startIter: 7, endIter: 11, completed: true, color: "#10b981", assignees: engGroupIds, updatedAt: nowStr },
    { uuid: generateId(), text: "中間ポスター・リーフレット制作", startIter: 10, endIter: 12, completed: true, color: "#ec4899", assignees: prmGroupIds, updatedAt: nowStr },
    { uuid: generateId(), text: "プロトタイプ開発(UI/フロント)", startIter: 15, endIter: 21, completed: false, color: "#0ea5e9", assignees: [engGroupIds[0], engGroupIds[1]], updatedAt: nowStr },
    { uuid: generateId(), text: "バックエンドAPI・データベース構築", startIter: 15, endIter: 22, completed: false, color: "#8b5cf6", assignees: [engGroupIds[2]], updatedAt: nowStr },
    { uuid: generateId(), text: "最終パンフレット作成", startIter: 22, endIter: 25, completed: false, color: "#ec4899", assignees: prmGroupIds, updatedAt: nowStr },
    { uuid: generateId(), text: "最終プレゼン資料ブラッシュアップ", startIter: 24, endIter: 26, completed: false, color: "#4f46e5", assignees: members.map(m => m.id), updatedAt: nowStr }
];

// 2. Polls
const polls = [
    {
        id: generateId(),
        title: "来週の作業臨時ミーティング日程調整",
        status: "active",
        type: "multiple",
        options: [
            { id: generateId(), text: "10/14(土) 10:00〜12:00", votes: [members[0].id, members[2].id] },
            { id: generateId(), text: "10/14(土) 14:00〜16:00", votes: members.map(m => m.id).slice(0, 6) },
            { id: generateId(), text: "10/15(日) 20:00〜22:00（オンライン）", votes: members.map(m => m.id) }
        ]
    },
    {
        id: generateId(),
        title: "想定ペルソナ（ターゲット層）の最終決定",
        status: "closed",
        type: "single",
        options: [
            { id: generateId(), text: "20〜30代の若年層カップル・友人", votes: [members[1].id, members[5].id] },
            { id: generateId(), text: "アクティブシニア層（60代〜）", votes: [members[0].id, members[2].id, members[3].id, members[4].id, members[6].id] }
        ]
    }
];

// 3. Topics and Messages
const topics = [
    { id: 'general', name: '全般', createdBy: 'system', timestamp: 0 },
    { id: 'from_teacher', name: '教員より', createdBy: 'system', timestamp: 0 },
    { id: 'engineering_group', name: '技術班内部連絡', createdBy: pLeaderId, timestamp: Date.now() - 1000000 }
];

const messages = [
    {
        id: generateId(),
        topicId: 'from_teacher',
        senderName: 'システム', senderRole: '案内',
        content: '初期設定ファイルが読み込まれました。',
        timestamp: Date.now() - 86400000, color: '#4f46e5', readBy: members.map(m => m.id)
    },
    {
        id: generateId(),
        topicId: 'general',
        senderName: members[0].lastName, senderRole: members[0].role, avatarImage: members[0].avatarImage,
        content: 'お疲れ様です！PBL2活動が始まりました。まずは「チームワーク形成」タブから、各自のプロフィール（強み、興味、やりたいこと）を記入してください。',
        timestamp: Date.now() - 3600000, color: colors[0], readBy: [members[0].id, members[1].id, members[2].id]
    },
    {
        id: generateId(),
        topicId: 'general',
        senderName: members[1].lastName, senderRole: members[1].role, avatarImage: members[1].avatarImage,
        content: '了解しました！記入しておきますね。あと、ペルソナ決定の投票も作成したので回答お願いします。',
        timestamp: Date.now() - 3500000, color: colors[1], readBy: [members[0].id, members[1].id]
    },
    {
        id: generateId(),
        topicId: 'general',
        senderName: members[5].lastName, senderRole: members[5].role, avatarImage: members[5].avatarImage,
        content: '記入しましたー。日程調整のアンケートも作ってくれたんですね。入力しておきます。',
        timestamp: Date.now() - 3400000, color: colors[5], readBy: [members[0].id]
    },
    {
        id: generateId(),
        topicId: 'engineering_group',
        senderName: members[2].lastName, senderRole: members[2].role, avatarImage: members[2].avatarImage,
        content: 'バックエンドのAPI実装について相談です。今回フロントとはRESTで通信する形で進めてよいでしょうか？',
        timestamp: Date.now() - 7200000, color: colors[2], readBy: engGroupIds
    },
    {
        id: generateId(),
        topicId: 'engineering_group',
        senderName: members[3].lastName, senderRole: members[3].role, avatarImage: members[3].avatarImage,
        content: 'はい、RESTが無難だと思います。データベース周りはとりあえずFirebaseを使う想定でどうでしょう？',
        timestamp: Date.now() - 7000000, color: colors[3], readBy: engGroupIds
    },
    {
        id: generateId(),
        topicId: 'engineering_group',
        senderName: members[4].lastName, senderRole: members[4].role, avatarImage: members[4].avatarImage,
        content: '賛成です！モックアップで検証して、問題があればまた検討しましょう。私はフロントのコンポーネント設計を進めます。',
        timestamp: Date.now() - 6900000, color: colors[4], readBy: engGroupIds
    }
];

// 4. Teamwork
const teamworkMembers = {};
const interestsSamples = ["地域創生とIT", "ユーザー心理分析", "サーバーレスアーキテクチャ", "モダンなUI開発", "ビッグデータ解析", "グラフィックデザイン", "SNSマーケティング"];
const goalsSamples = ["PMスキルを磨きたい", "マーケティングリサーチの基本を学ぶ", "バックエンドの知見を深める", "フルスタックな技術を習得", "チーム開発の立ち回りを学ぶ", "人を惹きつけるポスターを作りたい", "実践的なプレゼン能力の向上"];
const strengthsSamples = ["ファシリテーション、全体俯瞰", "アンケート設計、データ分析", "API設計、Python", "React/Vueなどフロントエンド", "データベース設計、インフラ", "Illustrator/Figma", "PowerPoint、スケジュール管理"];

members.forEach((m, idx) => {
    teamworkMembers[m.id] = {
        strengths: strengthsSamples[idx % strengthsSamples.length],
        interests: interestsSamples[idx % interestsSamples.length],
        goals: goalsSamples[idx % goalsSamples.length],
        photo: m.avatarImage
    };
});

const teamwork = {
    intro: "私たちは「地域資源を活用した持続可能なスマートツーリズム」をテーマに、AIなどのIT技術を使って地域の活性化に貢献することを目指します。互いの得意分野を活かしてプロジェクトを成功させましょう！",
    members: teamworkMembers
};

// 5. Artifacts and Hotspots
const createArtifactSlide = (label, bgCol) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <rect width="100%" height="100%" fill="${bgCol}"/>
        <text x="50%" y="50%" font-family="sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">${label}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const artifactSettings = {
    slides: {
        submitted: false, updatedAt: nowStr,
        slides: [
            {
                src: createArtifactSlide("タイトルスライド", "#3b82f6"),
                hotspots: [
                    { rect: { x: 10, y: 10, w: 80, h: 20 }, authorIdx: 0 } // Project Leader role
                ]
            },
            {
                src: createArtifactSlide("市場課題とペルソナ", "#10b981"),
                hotspots: [
                    { rect: { x: 10, y: 30, w: 40, h: 60 }, authorIdx: 1 }, // Marketing
                    { rect: { x: 55, y: 30, w: 35, h: 60 }, authorIdx: 1 }
                ]
            },
            {
                src: createArtifactSlide("システムアーキテクチャ", "#6366f1"),
                hotspots: [
                    { rect: { x: 20, y: 20, w: 60, h: 70 }, authorIdx: 2 } // Engineering assigned
                ]
            }
        ]
    },
    poster: {
        submitted: false, updatedAt: nowStr,
        slides: [
            {
                src: createArtifactSlide("中間ポスター", "#ec4899"),
                hotspots: [
                    { rect: { x: 5, y: 5, w: 90, h: 10 }, authorIdx: 5 }, // Promotion
                    { rect: { x: 5, y: 20, w: 40, h: 60 }, authorIdx: 6 } // Promotion
                ]
            }
        ]
    },
    leaflet: {
        submitted: false, updatedAt: nowStr,
        slides: [
            {
                src: createArtifactSlide("リーフレット", "#8b5cf6"),
                hotspots: [
                    { rect: { x: 10, y: 10, w: 30, h: 80 }, authorIdx: 5 },
                    { rect: { x: 60, y: 10, w: 30, h: 80 }, authorIdx: 6 }
                ]
            }
        ]
    }
};

// 6. Reports (Work Reports, Contribution, Mutual Eval)
const reports = {};
// Add normal work reports up to iteration 14
for (let i = 3; i <= 14; i++) {
    reports[i.toString()] = {
        achievement: "今週のタスクを順調に進行しました。対象の活動が無事に完了しています。".repeat(3),
        challenge: "想定外の環境課題がいくつかありましたが、メンバー間で協力して解決策を見出しています。".repeat(3),
        communications: members.map(m => `進捗共有：${m.role}としての実装・調査を進めています。`),
        selectedTasks: tasks.slice(0, 3).map(t => tasks.indexOf(t)),
        content: "今週のタスクを順調に進行しました...",
        submitted: true, submittedAt: nowStr, updatedAt: nowStr
    };
}
reports['analysis'] = {
    bg: "地域資源を活用できていない課題があります。",
    problem: "若年層の訪問減少",
    solution: "IT観光アプリの提供",
    content: "...", submitted: true, updatedAt: nowStr
};

// Contribution (detailed values)
const reportData = {};
members.forEach((m, idx) => {
    const ratings = {};
    const evalRoles = {};
    members.forEach(otherM => {
        if (otherM.id !== m.id) {
            // Realistic ratings: generally 4-5, maybe 3
            ratings[otherM.id] = (Math.random() > 0.8) ? 4 : 5;
        }
        evalRoles[otherM.id] = [otherM.role];
    });
    reportData[m.id] = { ratings, roles: evalRoles, submitted: true, updatedAt: nowStr };
});
reports['contribution_13'] = reportData;

// Mutual evaluation
const mutualData = { users: {} };
members.forEach(m => {
    mutualData.users[m.id] = {
        submitted: true, updatedAt: nowStr,
        evaluations: {
            "group_B": { investment: 2000000, comment: "プレゼンの説得力が非常に高く参考になりました。" },
            "group_C": { investment: 3000000, comment: "技術選定の理由が明確で開発力に驚きました。" }
        }
    };
});
reports['group_eval_13'] = mutualData;

// Feedback Reflection
reports['feedback_13'] = {
    author: [selfId],
    feedbackEntries: [
        { content: "UIのモックアップが非常に見やすい。", presentation: "全体的に好印象だが、機能の詳細が分からない" },
        { content: "技術リソースの確保に懸念がある。", presentation: "開発スケジュールについて工夫が必要" }
    ],
    futurePlans: "UIの良さを活かしつつ、詳細設計を詰めます。技術面のリスクに対しては、早めにプロトタイプを作成して検証期間を設けることで対策します。",
    submitted: true,
    updatedAt: nowStr
};

// Compile full state
const fullState = {
    themeName: initialData.themeName,
    companyName: initialData.companyName,
    groupSymbol: initialData.groupSymbol,
    groupName: "ムーン・ツアーズ",
    groupLogo: "", teamsUrl: "",
    members: members,
    isConfigLocked: true, membersLocked: true,
    tasks: tasks,
    polls: polls,
    messages: messages,
    topics: topics,
    currentTopicId: 'general',
    lastMessagesCheckTime: Date.now(),
    teamwork: teamwork,
    reports: reports,
    artifactSettings: artifactSettings,
    artifacts: { poster: false, leaflet: false, pamphlet_25: false, slides_25: false },
    schedule: initialData.schedule,
    sidebarCollapsed: false,
    supervisingInstructors: initialData.supervisingInstructors,
    deliverableTargets: initialData.deliverableTargets,
    bmc: {}, currentPollId: null
};

fs.writeFileSync('pbl2_rich_mock_data.json', JSON.stringify(fullState, null, 2), 'utf8');
console.log(`Generated rich mock data: pbl2_rich_mock_data.json`);
