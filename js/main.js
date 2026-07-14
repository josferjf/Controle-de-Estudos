// ============================================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkAuthState();
});

// Roda uma vez, assim que o usuário está autenticado (login novo ou sessão já existente).
async function runAppInitialization() {
    const loaded = await loadFromDatabase();
    if (!loaded) {
        // Primeira vez desta conta: começa do zero com o estado padrão e já salva na nuvem
        appState = JSON.parse(JSON.stringify(defaultAppState));
        saveToDatabase();
    }

    // Retrocompatibilidade: garante que dados salvos antes das últimas melhorias recebam os campos novos
    applyBackwardCompatibilityMigrations();

    initTheme();
    if (!appState.study_cycle.steps_sequence || appState.study_cycle.steps_sequence.length === 0) {
        regenerateSmartCycle(true);
    }
    populateSubjectSelector();

    // Restaura o estado preciso do cronômetro caso estivesse ativo antes de um fechamento de aba
    restoreTimerState();

    populateDistributionInputs();
    renderWeeklyGoalsSummary();
    renderMockExams();
    populateErrorAuxSelects();
    renderBackupStatus();

    updateUI();
}
