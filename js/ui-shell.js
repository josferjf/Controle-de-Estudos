// ============================================================
// CASCA DA INTERFACE (tema, navegação entre abas)
// ============================================================


        function initTheme() {
            const savedTheme = localStorage.getItem('app-theme');
            // Se o usuário nunca escolheu manualmente, segue a preferência do sistema operacional
            const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', currentTheme);
        }

        function toggleTheme() {
            let theme = document.documentElement.getAttribute('data-theme');
            let nextTheme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('app-theme', nextTheme);
            if(document.getElementById('view-stats').classList.contains('active')) {
                renderCharts();
            }
            lucide.createIcons();
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            
            const eventMap = { 'focus': 0, 'config': 1, 'errors': 2, 'stats': 3, 'simulados': 4, 'backup': 5 };
            const index = eventMap[tabId];
            if (index !== undefined) {
                document.querySelectorAll('.tab-btn')[index].classList.add('active');
            }
            document.getElementById(`view-${tabId}`).classList.add('active');
            
            if(tabId === 'stats') {
                populateSubjectSelector();
                renderCharts();
            }
            if(tabId === 'simulados') {
                renderMockExams();
            }
            if(tabId === 'errors') {
                populateErrorAuxSelects();
                renderErrorNotebook();
                renderErrorDashboard();
            }
            if(tabId === 'backup') {
                renderBackupStatus();
            }
            lucide.createIcons();
        }

        // --- ENGENHARIA DE PRECISÃO DO CRONÔMETRO (SOLUÇÃO DE ABA EM BACKGROUND) ---
        function toggleFocusTotalMode() {
            document.body.classList.toggle('focus-total-mode');
        }

        // Retorna a data no formato AAAA-MM-DD respeitando o fuso horário LOCAL do navegador (evita o bug de sessões
        // noturnas sendo atribuídas ao dia seguinte, que ocorria com toISOString(), que sempre converte para UTC)
