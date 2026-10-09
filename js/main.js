// ============================================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================================

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkAuthState();
});

// Registra o Service Worker do PWA (permite instalar como app e funcionar offline).
// Roda em segundo plano, sem bloquear nem depender do restante da inicialização.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => {
            console.warn('Service Worker não pôde ser registrado:', err);
        });
    });
}

// Roda uma vez, assim que o usuário está autenticado (login novo ou sessão já existente).
async function runAppInitialization() {
    const result = await loadFromDatabase();

    if (result.status === 'error') {
        // NUNCA inicializa nem salva um estado em branco aqui — se a leitura falhou (rede, permissão,
        // instabilidade), os dados reais podem muito bem continuar intactos no banco. Prosseguir e
        // salvar um estado vazio por cima é exatamente o que já causou perda de dados antes. Em vez
        // disso, interrompe e deixa claro que precisa tentar de novo.
        throw new Error('Não foi possível carregar seus dados salvos (verifique sua internet e tente novamente). Por segurança, nada foi alterado ainda.');
    }

    if (result.status === 'new') {
        // Primeira vez desta conta de verdade (o documento realmente não existe ainda): começa do zero
        // com o estado padrão e já salva na nuvem.
        appState = JSON.parse(JSON.stringify(defaultAppState));
        saveToDatabase();
    }

    // Retrocompatibilidade: garante que dados salvos antes das últimas melhorias recebam os campos novos
    applyBackwardCompatibilityMigrations();

    initTheme();
    // Recalcula sempre (não só quando a fila estiver vazia) para garantir que eventuais correções na lógica do
    // ciclo se reflitam imediatamente, em vez de uma fila antiga já salva continuar sendo exibida indefinidamente.
    regenerateSmartCycle(false);
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
