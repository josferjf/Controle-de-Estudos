// ============================================================
// BACKUP, EXPORTAÇÃO E LIMPEZA DE DADOS
// ============================================================

        function exportToCSV() {
            const headers = ['Data', 'Materia', 'Topico', 'Segundos_Liquidos', 'Apenas_Teoria', 'Questoes_Feitas', 'Questoes_Corretas', 'Aproveitamento'];
            const rows = appState.study_logs.map(l => [
                new Date(l.timestamp).toLocaleDateString(), l.snapshot_subject_name, l.snapshot_topic_title, l.liquid_seconds, l.is_theory_only ? 'Sim' : 'Não', l.questions_attempted, l.questions_correct, l.is_theory_only ? '' : l.performance_percentage.toFixed(1)
            ]);
            downloadCSV(headers, rows, `controle_estudos_sessoes_${Date.now()}.csv`);
        }

        function exportMockExamsToCSV() {
            const headers = ['Data', 'Nome_Simulado', 'Questoes_Totais', 'Acertos', 'Aproveitamento', 'Horas_Gastas'];
            const rows = appState.mock_exams.map(m => [
                new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR'), m.name, m.total_questions, m.correct_questions, m.performance_percentage.toFixed(1), m.hours_spent
            ]);
            downloadCSV(headers, rows, `controle_estudos_simulados_${Date.now()}.csv`);
        }

        function exportErrorNotebookToCSV() {
            const headers = ['Data', 'Materia', 'Referencia', 'Tipo_Erro', 'Causa_Raiz', 'Banca', 'Ano_Prova', 'Reincidencias', 'Vezes_Revisado', 'Anotacoes'];
            const rows = appState.error_notebook.map(err => [
                new Date(err.timestamp).toLocaleDateString('pt-BR'), err.snapshot_subject_name, err.snapshot_topic_title, err.error_type || '', err.root_cause || '', err.banca || '', err.exam_year || '', err.recurrence_count || 0, err.view_count || 0, (err.user_notes || '').replace(/\n/g, ' ')
            ]);
            downloadCSV(headers, rows, `controle_estudos_caderno_erros_${Date.now()}.csv`);
        }

        // Arquivo de contexto/configuração, para dar à IA a referência necessária para interpretar os demais CSVs corretamente
        function exportContextSummaryToCSV() {
            const totalT = appState.subjects.reduce((acc, s) => acc + s.topics.length, 0);
            const doneT = appState.subjects.reduce((acc, s) => acc + s.topics.filter(t => t.completed).length, 0);
            const dist = appState.user_configuration.daily_distribution || {};
            const headers = ['Campo', 'Valor'];
            const rows = [
                ['Nota_de_Corte_Almejada', `${appState.user_configuration.target_score || 85}%`],
                ['Carga_Horaria_Semanal', `${appState.user_configuration.weekly_hours_goal || 0}h`],
                ['Distribuicao_Segunda', `${dist.segunda || 0}h`],
                ['Distribuicao_Terca', `${dist.terca || 0}h`],
                ['Distribuicao_Quarta', `${dist.quarta || 0}h`],
                ['Distribuicao_Quinta', `${dist.quinta || 0}h`],
                ['Distribuicao_Sexta', `${dist.sexta || 0}h`],
                ['Distribuicao_Sabado', `${dist.sabado || 0}h`],
                ['Distribuicao_Domingo', `${dist.domingo || 0}h`],
                ['Data_da_Prova', appState.user_configuration.exam_date || 'Não informada'],
                ['Calibragem_Base', appState.user_configuration.calibration_mode === 'QUESTIONS_COUNT' ? 'Por Questões do Edital' : 'Por Peso Teórico'],
                ['Total_de_Materias_Cadastradas', appState.subjects.length],
                ['Total_de_Topicos_Aulas', totalT],
                ['Topicos_Concluidos', doneT],
                ['Total_de_Sessoes_Registradas', appState.study_logs.length],
                ['Total_de_Simulados_Registrados', appState.mock_exams.length],
                ['Total_de_Itens_no_Caderno_de_Erros', appState.error_notebook.length],
                ...appState.subjects.map(s => [
                    `Materia_${s.name}`,
                    `Peso ${s.weight}, ${s.expected_questions} questões no edital, ${s.topics.filter(t => t.completed).length}/${s.topics.length} aulas concluídas, ` +
                    `Status: ${s.isActive ? 'Ativa' : 'Pausada'}, ` +
                    `Revisão Estratégica: ${s.isStrategicReview ? 'Sim (matéria já concluída, em modo de revisão contínua)' : 'Não'}`
                ])
            ];
            downloadCSV(headers, rows, `controle_estudos_contexto_${Date.now()}.csv`);
        }

        function downloadCSV(headers, rows, filename) {
            const escapeCell = (cell) => {
                const str = String(cell ?? '');
                return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
            };
            const content = [headers.join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');
            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], {type: 'text/csv;charset=utf-8;'});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.setAttribute('download', filename);
            a.click();
        }

        // Exporta todos os CSVs de uma vez, prontos para análise externa por IA
        function exportAllCSVForAI() {
            exportContextSummaryToCSV();
            setTimeout(() => exportToCSV(), 200);
            setTimeout(() => exportMockExamsToCSV(), 400);
            setTimeout(() => exportErrorNotebookToCSV(), 600);
        }

        function exportBackupJSON() {
            const blob = new Blob([JSON.stringify(appState, null, 2)], {type: 'application/json'});
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.setAttribute('download', `backup_controle_estudos_${Date.now()}.json`);
            a.click();

            appState.last_backup_export_date = new Date().toISOString();
            saveToDatabase();
            renderBackupStatus();
        }

        // Mostra quando foi o último backup exportado, com alerta visual se estiver há muito tempo sem um
        function renderBackupStatus() {
            const el = document.getElementById('backup-status-text');
            if (!el) return;
            if (!appState.last_backup_export_date) {
                el.innerHTML = `<span style="color: var(--danger);">Você ainda não fez nenhum backup. Recomendamos gerar um agora.</span>`;
                return;
            }
            const lastDate = new Date(appState.last_backup_export_date);
            const daysSince = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
            const formattedDate = lastDate.toLocaleDateString('pt-BR');
            if (daysSince > 7) {
                el.innerHTML = `<span style="color: var(--danger);">Último backup: ${formattedDate} (há ${daysSince} dias). Recomendamos gerar um novo.</span>`;
            } else {
                el.innerHTML = `<span style="color: var(--primary);">Último backup: ${formattedDate} (há ${daysSince} dia${daysSince === 1 ? '' : 's'}).</span>`;
            }
        }

        // Retorna um resumo legível do conteúdo de um backup, exibido antes de confirmar a restauração
        function summarizeBackupContent(parsed) {
            const totalTopics = (parsed.subjects || []).reduce((acc, s) => acc + (s.topics ? s.topics.length : 0), 0);
            const logs = parsed.study_logs || [];
            let dateRangeText = "sem sessões registradas";
            if (logs.length > 0) {
                const dates = logs.map(l => new Date(l.timestamp)).sort((a, b) => a - b);
                dateRangeText = `de ${dates[0].toLocaleDateString('pt-BR')} até ${dates[dates.length - 1].toLocaleDateString('pt-BR')}`;
            }
            return `Este backup contém:\n` +
                `• ${(parsed.subjects || []).length} matéria(s), ${totalTopics} tópico(s)/aula(s)\n` +
                `• ${logs.length} sessão(ões) de estudo registrada(s) (${dateRangeText})\n` +
                `• ${(parsed.error_notebook || []).length} item(ns) no caderno de erros\n` +
                `• ${(parsed.mock_exams || []).length} simulado(s) registrado(s)`;
        }

        function importBackupJSON(event) {
            const file = event.target.files[0]; if(!file) return;
            const r = new FileReader();
            r.onload = function(e) {
                let parsed;
                try {
                    parsed = JSON.parse(e.target.result);
                } catch(err) {
                    alert("Não foi possível ler este arquivo: o JSON está corrompido ou mal formatado.");
                    event.target.value = "";
                    return;
                }

                if (!parsed.subjects || !parsed.study_logs) {
                    alert("Este arquivo não parece ser um backup válido do Gerenciador de Estudos (faltam campos essenciais como 'subjects' ou 'study_logs').");
                    event.target.value = "";
                    return;
                }

                const summary = summarizeBackupContent(parsed);
                const confirmed = confirm(
                    `${summary}\n\nATENÇÃO: restaurar este backup vai substituir TODOS os seus dados atuais (matérias, sessões, caderno de erros, simulados e configurações). Essa ação não pode ser desfeita.\n\nDeseja continuar?`
                );
                if (!confirmed) {
                    event.target.value = "";
                    return;
                }

                appState = parsed;
                applyBackwardCompatibilityMigrations();
                saveToDatabase();
                regenerateSmartCycle(false);
                updateUI();
                renderBackupStatus();
                alert("Backup restaurado com sucesso!");
                event.target.value = "";
            };
            r.readAsText(file);
        }

        function clearAllData() {
            const firstConfirmation = confirm("ATENÇÃO! Você tem certeza de que deseja apagar permanentemente todas as matérias, logs, históricos e resumos cadastrados?");
            if (firstConfirmation) {
                const secondConfirmation = confirm("CONFIRMAÇÃO FINAL: Esta ação não pode ser desfeita e limpará todo o armazenamento local de longo prazo. Deseja continuar?");
                if (secondConfirmation) {
                    clearInterval(timerInterval);
                    
                    // Limpa dados de ambos os storages para evitar lixo residual
                    localStorage.removeItem('controle_estudos_db');
                    appState = JSON.parse(JSON.stringify(defaultAppState));
                    
                    if (db) {
                        const transaction = db.transaction([STORE_NAME], 'readwrite');
                        const store = transaction.objectStore(STORE_NAME);
                        store.delete('globalState');
                    }

                    resetTimer();
                    regenerateSmartCycle(true);
                    populateSubjectSelector();
                    updateUI();
                    renderBackupStatus();
                    switchTab('focus');
                    alert("O aplicativo foi redefinido com sucesso para o estado original de fábrica.");
                }
            }
        }

        // --- ALTERAÇÃO 5: EXCLUSÃO INDEPENDENTE APENAS DAS ATIVIDADES CONCLUÍDAS ---
        function clearCompletedActivities() {
            const confirmation = confirm("Deseja excluir permanentemente apenas o histórico de atividades concluídas (sessões de estudo registradas)? Disciplinas, ciclos, metas pendentes, carga horária e configurações serão mantidos.");
            if (confirmation) {
                appState.study_logs = [];
                saveToDatabase();
                updateUI();
                if (document.getElementById('view-stats').classList.contains('active')) {
                    renderCharts();
                }
                alert("Histórico de atividades concluídas removido com sucesso. O restante do sistema foi mantido.");
            }
        }
