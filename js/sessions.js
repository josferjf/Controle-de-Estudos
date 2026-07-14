// ============================================================
// REGISTRO DE SESSÕES DE ESTUDO
// ============================================================

        function toggleNoQuestionsMode() {
            const checkbox = document.getElementById('input-no-questions');
            const qtyInput = document.getElementById('input-log-qty');
            const correctInput = document.getElementById('input-log-correct');
            const isChecked = checkbox.checked;

            qtyInput.disabled = isChecked;
            correctInput.disabled = isChecked;
            if (isChecked) {
                qtyInput.value = "";
                correctInput.value = "";
            }
        }

        function submitStudySession() {
            const qtyInput = document.getElementById('input-log-qty').value;
            const correctInput = document.getElementById('input-log-correct').value;
            
            const currentStep = appState.study_cycle.steps_sequence[appState.study_cycle.current_step_index];
            if (!currentStep || currentStep.subjectId === "none") {
                alert("Nenhuma matéria selecionada no ciclo ativo.");
                return;
            }

            // Pilar 1 - Revisão Rápida: agora é uma exigência real, não apenas um texto informativo
            if (currentStep.pilar === 1) {
                const quickReviewCheckbox = document.getElementById('quick-review-checkbox');
                if (!quickReviewCheckbox || !quickReviewCheckbox.checked) {
                    alert("Antes de salvar, confirme que você fez a Revisão Rápida (5 a 10 min) do bloco anterior, marcando a caixa de confirmação.");
                    return;
                }
            }

            const noQuestionsCheckbox = document.getElementById('input-no-questions');
            const isTheoryOnly = noQuestionsCheckbox ? noQuestionsCheckbox.checked : false;

            let qty = 0;
            let correct = 0;

            if (!isTheoryOnly) {
                qty = parseInt(qtyInput) || 0;
                correct = parseInt(correctInput) || 0;

                if (qtyInput.trim() !== "" || correctInput.trim() !== "") {
                    if (qty < 0 || correct < 0) {
                        alert("A quantidade de questões ou acertos não pode ser um número negativo.");
                        return;
                    }
                    if (correct > qty) {
                        alert("Atenção Inconsistência: O número de acertos não pode superar o total de questões feitas.");
                        return;
                    }
                }
            }

            const calculatedSeconds = appState.timer_state.mode === 'pomodoro'
                ? (appState.timer_state.total_focus_seconds_this_session || 0) + (appState.timer_state.pomodoro_phase === 'focus' ? (POMODORO_FOCUS_SECONDS - appState.timer_state.seconds) : 0)
                : appState.timer_state.seconds;

            const manualHoursInput = document.getElementById('input-manual-hours').value;
            let logSeconds;
            if (manualHoursInput && manualHoursInput.trim() !== "") {
                const manualHours = parseFloat(manualHoursInput);
                if (isNaN(manualHours) || manualHours <= 0) {
                    alert("O ajuste manual de tempo precisa ser um número maior que zero.");
                    return;
                }
                logSeconds = manualHours * 3600;
            } else if (calculatedSeconds > 5) {
                logSeconds = calculatedSeconds;
            } else {
                alert("O cronômetro não foi iniciado (ou rodou por menos de 5 segundos). Inicie o cronômetro antes de estudar, ou preencha o campo 'Ajustar Tempo (opcional)' manualmente antes de salvar.");
                return;
            }

            const percentage = qty > 0 ? (correct / qty) * 100 : 0;

            // Só gera gatilho automatizado se o estudante realmente informou questões realizadas (sessões só teoria nunca disparam)
            if (!isTheoryOnly && qty > 0 && percentage < 80) {
                appState.error_notebook.unshift({
                    id: "err-auto-" + Date.now(),
                    timestamp: new Date().toISOString(),
                    snapshot_subject_name: currentStep.subjectName,
                    snapshot_topic_title: currentStep.topicTitle,
                    error_type: "Atenção",
                    subject_id: currentStep.subjectId,
                    root_cause: "Não Informado",
                    related_error_id: null,
                    recurrence_count: 0,
                    view_count: 0,
                    last_viewed_at: null,
                    trigger_percentage: percentage,
                    user_notes: `Desempenho Crítico: ${percentage.toFixed(1)}% de acertos (${correct}/${qty} Q). Necessário revisar e mapear pegadinhas.`,
                    imageDataUrl: ""
                });
            }

            if (!currentStep.isReviewMode && currentStep.topicId !== "STRATEGIC" && currentStep.topicId !== "TUDAO") {
                appState.subjects.forEach(s => {
                    if (s.id === currentStep.subjectId) {
                        s.topics.forEach(t => {
                            if (t.id === currentStep.topicId) t.completed = true;
                        });
                    }
                });
            } else if (currentStep.topicId === "STRATEGIC" || currentStep.topicId === "TUDAO") {
                // Registra quando a revisão Tudão/Estratégica foi de fato concluída, para respeitar a periodicidade configurada
                appState.subjects.forEach(s => {
                    if (s.id === currentStep.subjectId) {
                        s.last_tudao_review_date = new Date().toISOString();
                    }
                });
            }

            // Pilar 1 - Revisão Rápida: contabiliza a revisão realizada
            if (currentStep.pilar === 1) {
                appState.study_cycle.quick_reviews_completed = (appState.study_cycle.quick_reviews_completed || 0) + 1;
            }

            appState.study_logs.push({
                id: "log-" + Date.now(),
                timestamp: new Date().toISOString(),
                subject_id: currentStep.subjectId,
                snapshot_subject_name: currentStep.subjectName,
                snapshot_topic_title: currentStep.topicTitle,
                liquid_seconds: logSeconds,
                questions_attempted: qty,
                questions_correct: correct,
                performance_percentage: percentage,
                is_theory_only: isTheoryOnly
            });

            // Incrementa rotativamente o ciclo para a próxima matéria da fila
            appState.study_cycle.current_step_index++;
            
            document.getElementById('input-log-qty').value = "";
            document.getElementById('input-log-correct').value = "";
            document.getElementById('input-manual-hours').value = "";
            document.getElementById('input-log-qty').disabled = false;
            document.getElementById('input-log-correct').disabled = false;
            if (noQuestionsCheckbox) noQuestionsCheckbox.checked = false;

            alert("Progresso pragmático salvo!");
            resetTimer();
            regenerateSmartCycle(false);
            updateUI();
        }

        function changeStatsPeriod(period) {
            currentStatsPeriod = period;
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            document.getElementById(`filter-${period}`).classList.add('active');
            updateUI();
            renderCharts();
        }

        function populateSubjectSelector() {
            const selector = document.getElementById('chart-subject-selector');
            if (!selector) return;
            selector.innerHTML = '<option value="all">Todas as Matérias</option>';
            appState.subjects.forEach(s => {
                selector.innerHTML += `<option value="${s.name}">${s.name}</option>`;
            });
        }

        function getFilteredLogs() {
            const now = new Date();
            return appState.study_logs.filter(log => {
                const logDate = new Date(log.timestamp);
                if (currentStatsPeriod === '7') {
                    return (now - logDate) / (1000 * 60 * 60 * 24) <= 7;
                } else if (currentStatsPeriod === '30') {
                    return (now - logDate) / (1000 * 60 * 60 * 24) <= 30;
                }
                return true; 
            });
        }

        // Logs do período imediatamente anterior ao filtro atual (ex: os 7 dias antes dos últimos 7 dias), para comparação de tendência
        function getPreviousPeriodLogs() {
            if (currentStatsPeriod === 'all') return null;
            const days = parseInt(currentStatsPeriod);
            const now = new Date();
            return appState.study_logs.filter(log => {
                const logDate = new Date(log.timestamp);
                const daysAgo = (now - logDate) / (1000 * 60 * 60 * 24);
                return daysAgo > days && daysAgo <= (days * 2);
            });
        }

        // Formata a variação percentual entre o período atual e o anterior, para exibir junto aos stat-boxes
        function formatTrendDelta(current, previous) {
            if (previous === null) return "";
            if (previous === 0) return current > 0 ? "▲ novo neste período" : "";
            const deltaPct = ((current - previous) / previous) * 100;
            if (Math.abs(deltaPct) < 0.5) return "≈ estável vs. período anterior";
            const arrow = deltaPct > 0 ? "▲" : "▼";
            return `${arrow} ${Math.abs(deltaPct).toFixed(0)}% vs. período anterior`;
        }

        // Histórico de Sessões: aplica o filtro de período + busca por matéria/tópico
        function renderStudyLogsHistory() {
            const tbody = document.getElementById('stats-table-body');
            if (!tbody) return;
            tbody.innerHTML = "";

            const searchInput = document.getElementById('stats-history-search');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            let logs = getFilteredLogs();
            if (searchTerm) {
                logs = logs.filter(log => `${log.snapshot_subject_name} ${log.snapshot_topic_title}`.toLowerCase().includes(searchTerm));
            }

            logs.slice().reverse().forEach(log => {
                const tr = document.createElement('tr');
                const questionsCell = log.is_theory_only
                    ? `<span class="badge badge-purple">Só Teoria</span>`
                    : `${log.questions_correct}/${log.questions_attempted}`;
                const performanceCell = log.is_theory_only
                    ? `<span class="badge badge-purple">—</span>`
                    : `<span class="badge ${log.performance_percentage >= 80 ? 'badge-success' : 'badge-danger'}">${log.performance_percentage.toFixed(1)}%</span>`;
                tr.innerHTML = `
                    <td>${new Date(log.timestamp).toLocaleDateString()}</td>
                    <td><strong>${log.snapshot_subject_name}</strong></td>
                    <td>${log.snapshot_topic_title}</td>
                    <td>${Math.floor(log.liquid_seconds / 60)} min</td>
                    <td>${questionsCell}</td>
                    <td>${performanceCell}</td>
                    <td><button class="filter-chip" style="padding: 4px 8px; background: var(--danger-alpha); color: var(--danger); font-size: 11px;" onclick="deleteStudyLog('${log.id}')"><i data-lucide="trash-2" style="width:12px; height:12px;"></i></button></td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        }

        // Exclui uma sessão individual do histórico (ex: registro digitado errado), sem afetar as demais
        function deleteStudyLog(logId) {
            if (confirm("Excluir esta sessão do histórico permanentemente? Isso vai recalcular suas métricas.")) {
                appState.study_logs = appState.study_logs.filter(l => l.id !== logId);
                saveToDatabase();
                updateUI();
                if (document.getElementById('view-stats').classList.contains('active')) {
                    renderCharts();
                }
            }
        }

