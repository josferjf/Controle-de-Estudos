// ============================================================
// ESTADO GLOBAL & PERSISTÊNCIA (Firebase Firestore, salvamento automático na nuvem)
// ============================================================

const defaultAppState = {
    user_configuration: {
        weekly_hours_goal: 30,
        daily_hours_goal: 4.5,
        calibration_mode: 'WEIGHT',
        target_score: 85,
        tudao_period: 1,
        daily_distribution: { segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0, sabado: 0, domingo: 0 },
        exam_date: null
    },
    subjects: [
        { id: "subj-1", name: "Direito Constitucional", weight: 3, expected_questions: 15, isActive: true, isStrategicReview: false, last_tudao_review_date: null, topics: [
            { id: "top-1-1", title: "Aula 00: Direitos Individuais", completed: true, link: '' },
            { id: "top-1-2", title: "Aula 01: Processo Legislativo", completed: false, link: '' },
            { id: "top-1-3", title: "Aula 02: Controle de Constitucionalidade", completed: false, link: '' },
            { id: "top-1-4", title: "Aula 03: Poder Executivo", completed: false, link: '' }
        ]},
        { id: "subj-2", name: "Direito Administrativo", weight: 2, expected_questions: 12, isActive: true, isStrategicReview: false, last_tudao_review_date: null, topics: [
            { id: "top-2-1", title: "Aula 00: Princípios Regime Jurídico", completed: true, link: '' },
            { id: "top-2-2", title: "Aula 01: Atos Administrativos", completed: true, link: '' },
            { id: "top-2-3", title: "Aula 02: Nova Lei de Licitações 14.133", completed: false, link: '' }
        ]}
    ],
    study_cycle: { current_step_index: 0, steps_sequence: [], last_activity_date: new Date().toISOString(), quick_reviews_completed: 0, pending_metas_balance: 0, balance_settled_through_date: null },
    study_logs: [],
    error_notebook: [],
    mock_exams: [],
    last_backup_export_date: null,
    timer_state: { mode: 'regular', seconds: 0, isRunning: false, startTime: null, accumulatedTime: 0, pomodoro_phase: 'focus', pomodoro_cycle_count: 0, total_focus_seconds_this_session: 0 }
};

let appState = JSON.parse(JSON.stringify(defaultAppState));

let timerInterval = null;
const POMODORO_FOCUS_SECONDS = 25 * 60;
const POMODORO_SHORT_BREAK_SECONDS = 5 * 60;
const POMODORO_LONG_BREAK_SECONDS = 15 * 60;
let currentStatsPeriod = 'all';

let chartRadarInstance = null;
let chartPerformanceRadarInstance = null;
let chartLineInstance = null;
let chartBarInstance = null;

// --- IDENTIDADE DO USUÁRIO AUTENTICADO (definida por auth.js após login) ---
let currentUserId = null;

// --- PERSISTÊNCIA NA NUVEM (Firestore) ---
// Cada usuário tem um único documento em "users/{uid}" com todo o appState.
// O Firestore já mantém um cache local automático (ativado em firebase-config.js via enablePersistence),
// então mesmo offline as mudanças ficam salvas e sincronizam sozinhas quando a internet voltar.

let saveDebounceTimer = null;
let pendingSaveSnapshot = null;

function saveToDatabase() {
    if (!currentUserId) return; // ainda não autenticado, nada a fazer
    appState.timer_state.seconds = Math.floor(appState.timer_state.seconds);

    pendingSaveSnapshot = JSON.parse(JSON.stringify(appState));
    updateSyncStatus('saving');
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(flushPendingSave, 800);
}

function flushPendingSave() {
    if (!pendingSaveSnapshot || !currentUserId) return;
    const dataToSave = pendingSaveSnapshot;
    pendingSaveSnapshot = null;
    firebase.firestore().collection('users').doc(currentUserId).set(dataToSave)
        .then(() => updateSyncStatus('synced'))
        .catch((err) => {
            console.error('Erro ao salvar na nuvem:', err);
            updateSyncStatus('error');
        });
}

// Melhor esforço para não perder as últimas mudanças se a aba for fechada logo após uma edição
window.addEventListener('beforeunload', () => {
    if (pendingSaveSnapshot) {
        clearTimeout(saveDebounceTimer);
        flushPendingSave();
    }
});

async function loadFromDatabase() {
    if (!currentUserId) return false;
    try {
        const doc = await firebase.firestore().collection('users').doc(currentUserId).get();
        if (doc.exists) {
            appState = doc.data();
            if (!appState.timer_state) appState.timer_state = JSON.parse(JSON.stringify(defaultAppState.timer_state));
            return true;
        }
        return false;
    } catch (err) {
        console.error('Erro ao carregar da nuvem:', err);
        return false;
    }
}

// Pequeno indicador visual no cabeçalho, para você nunca precisar se perguntar "isso já foi salvo?"
function updateSyncStatus(status) {
    const icon = document.getElementById('sync-status-icon');
    if (!icon) return;
    if (status === 'saving') {
        icon.setAttribute('title', 'Salvando...');
        icon.style.color = 'var(--header-text)';
        icon.style.opacity = '0.6';
    } else if (status === 'synced') {
        icon.setAttribute('title', 'Salvo na nuvem');
        icon.style.color = 'var(--header-text)';
        icon.style.opacity = '0.85';
    } else if (status === 'error') {
        icon.setAttribute('title', 'Erro ao salvar (verifique sua internet)');
        icon.style.color = '#fca5a5';
        icon.style.opacity = '1';
    }
}

// Aplica todos os campos novos adicionados ao longo das atualizações, garantindo compatibilidade com estados salvos ou backups antigos
function applyBackwardCompatibilityMigrations() {
    if (!appState.timer_state) appState.timer_state = JSON.parse(JSON.stringify(defaultAppState.timer_state));
    if (!appState.mock_exams) appState.mock_exams = [];
    if (!appState.error_notebook) appState.error_notebook = [];
    if (!appState.study_cycle) appState.study_cycle = JSON.parse(JSON.stringify(defaultAppState.study_cycle));
    if (!appState.user_configuration) appState.user_configuration = JSON.parse(JSON.stringify(defaultAppState.user_configuration));

    if (!appState.user_configuration.daily_distribution) {
        appState.user_configuration.daily_distribution = { segunda: 0, terca: 0, quarta: 0, quinta: 0, sexta: 0, sabado: 0, domingo: 0 };
    }
    if (appState.user_configuration.exam_date === undefined) appState.user_configuration.exam_date = null;
    if (!Array.isArray(appState.mock_exams)) appState.mock_exams = [];
    if (appState.study_cycle.quick_reviews_completed === undefined) appState.study_cycle.quick_reviews_completed = 0;
    if (appState.study_cycle.pending_metas_balance === undefined) appState.study_cycle.pending_metas_balance = 0;
    if (appState.study_cycle.balance_settled_through_date === undefined) appState.study_cycle.balance_settled_through_date = null;
    appState.subjects.forEach(s => {
        if (s.last_tudao_review_date === undefined) s.last_tudao_review_date = null;
        s.topics.forEach(t => { if (t.link === undefined) t.link = ''; });
    });
    appState.error_notebook.forEach(err => {
        if (err.subject_id === undefined) err.subject_id = null;
        if (err.root_cause === undefined) err.root_cause = "Não Informado";
        if (err.related_error_id === undefined) err.related_error_id = null;
        if (err.recurrence_count === undefined) err.recurrence_count = 0;
        if (err.view_count === undefined) err.view_count = 0;
        if (err.last_viewed_at === undefined) err.last_viewed_at = null;
    });
    if (appState.timer_state.pomodoro_phase === undefined) appState.timer_state.pomodoro_phase = 'focus';
    if (appState.timer_state.pomodoro_cycle_count === undefined) appState.timer_state.pomodoro_cycle_count = 0;
    if (appState.timer_state.total_focus_seconds_this_session === undefined) appState.timer_state.total_focus_seconds_this_session = 0;
    if (appState.last_backup_export_date === undefined) appState.last_backup_export_date = null;
    if (!appState.study_logs) appState.study_logs = [];
    appState.study_logs.forEach(l => { if (l.is_theory_only === undefined) l.is_theory_only = false; });
}

function toLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatTimeDisplay(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}
