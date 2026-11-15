// ============================================================
// MOTOR DO CICLO DE ESTUDOS (rodízio ponderado, metas, D-Day)
// ============================================================

        // Revisão geral: está na hora de aparecer de novo? Período em meses (0 = a cada volta do ciclo, sempre).
        function isGeneralReviewDue(subj) {
            const raw = appState.user_configuration.tudao_period;
            const periodMonths = (raw === undefined || raw === null || isNaN(raw)) ? 1 : raw;
            if (periodMonths === 0 || !subj.last_tudao_review_date) return true;
            const nextDue = new Date(subj.last_tudao_review_date);
            nextDue.setMonth(nextDue.getMonth() + periodMonths);
            return new Date() >= nextDue;
        }

        function regenerateSmartCycle(forceResetIndex = false) {
            let regularCandidates = [];

            const activeSubjects = appState.subjects.filter(s => s.isActive);
            const avgExpectedQuestions = activeSubjects.length > 0
                ? activeSubjects.reduce((acc, s) => acc + (parseInt(s.expected_questions) || 1), 0) / activeSubjects.length
                : 1;

            appState.subjects.forEach(subj => {
                if (!subj.isActive) return;

                // Peso efetivo da matéria — calculado uma vez e reaproveitado tanto pro próximo tópico normal
                // quanto pra revisão devida, garantindo que a revisão apareça no MESMO turno/frequência que a
                // matéria já tinha no rodízio, em vez de furar a fila inteira ou sumir da rotação.
                const calibrationMode = appState.user_configuration.calibration_mode || 'WEIGHT';
                let baseWeight;
                if (calibrationMode === 'QUESTIONS_COUNT') {
                    baseWeight = Math.max(1, Math.round((parseInt(subj.expected_questions) || 1) / avgExpectedQuestions));
                } else {
                    baseWeight = parseInt(subj.weight) || 1;
                }
                const performance = getSubjectAveragePerformance(subj.id);
                const targetScore = appState.user_configuration.target_score || 85;
                const performanceBoost = (performance !== null && performance < targetScore) ? 1 : 0;

                // MODO RETA FINAL (ativado manualmente pelo usuário): pausa por completo matérias que não têm
                // erro reincidente no Caderno de Erros nem desempenho abaixo da Nota de Corte Almejada — só
                // sobra na fila o que realmente precisa de atenção, com peso extra proporcional à quantidade
                // de erros reincidentes daquela matéria.
                const finalStretchActive = !!appState.user_configuration.final_stretch_mode;
                let recurringErrorCount = 0;
                let belowTarget = false;
                if (finalStretchActive) {
                    recurringErrorCount = appState.error_notebook.filter(e => e.subject_id === subj.id && (e.recurrence_count || 0) > 0).length;
                    belowTarget = performance !== null && performance < targetScore;
                    if (recurringErrorCount === 0 && !belowTarget) {
                        return; // Matéria "em dia" — fica de fora da fila enquanto o Modo Reta Final estiver ativo
                    }
                }
                const finalStretchBoost = finalStretchActive ? (recurringErrorCount * 2) + (belowTarget ? 2 : 0) : 0;
                const effectiveWeight = Math.max(1, baseWeight + performanceBoost + finalStretchBoost);

                const totalTopics = subj.topics.length;
                const completedTopics = subj.topics.filter(t => t.completed).length;

                // Aulas concluídas, da mais recente pra mais antiga (pela data real da sessão; sem data, vale a
                // posição na lista) — base pra montar as revisões.
                const completedSorted = subj.topics
                    .map((t, i) => ({ t, i }))
                    .filter(x => x.t.completed)
                    .sort((a, b) => {
                        const da = a.t.last_studied_at ? new Date(a.t.last_studied_at).getTime() : 0;
                        const db = b.t.last_studied_at ? new Date(b.t.last_studied_at).getTime() : 0;
                        return (db - da) || (b.i - a.i);
                    });
                const toReviewItem = x => ({ title: x.t.title, materialLink: x.t.materialLink || '', link: x.t.link || '' });

                // REVISÃO GERAL: quando a matéria termina (todas as aulas concluídas) ou quando você marca
                // "Somente Revisão" — revisa todas as aulas já concluídas e volta a se repetir no ciclo,
                // respeitando a periodicidade configurada (0 = a cada volta do ciclo).
                if ((totalTopics > 0 && completedTopics === totalTopics) || subj.review_only_mode) {
                    if (completedTopics === 0) return; // nada estudado ainda, nada pra revisar
                    if (!isGeneralReviewDue(subj)) return;
                    regularCandidates.push({
                        weight: effectiveWeight,
                        entry: {
                            subjectId: subj.id,
                            subjectName: subj.name,
                            topicId: "TUDAO",
                            topicTitle: `REVISÃO GERAL: revise todas as aulas já estudadas (${completedTopics} ${completedTopics === 1 ? 'aula' : 'aulas'})`,
                            isReviewMode: true,
                            reviewTopics: completedSorted.slice().sort((a, b) => a.i - b.i).map(toReviewItem)
                        }
                    });
                    return;
                }

                // REVISÃO ACUMULADA: a cada 3 aulas concluídas da mesma matéria, revisa as 3 últimas. Enquanto
                // estiver pendente, ocupa o turno dessa matéria (a próxima aula dela só aparece depois), sem
                // mexer na posição das outras matérias.
                if (completedTopics > 0 && completedTopics % 3 === 0 && subj.last_cumulative_review_milestone !== completedTopics) {
                    regularCandidates.push({
                        weight: effectiveWeight,
                        entry: {
                            subjectId: subj.id,
                            subjectName: subj.name,
                            topicId: "CUMULATIVE",
                            topicTitle: "REVISÃO ACUMULADA: revise as 3 últimas aulas estudadas",
                            isReviewMode: true,
                            reviewTopics: completedSorted.slice(0, 3).sort((a, b) => a.i - b.i).map(toReviewItem)
                        }
                    });
                    return;
                }

                const pend = subj.topics.find(t => !t.completed);
                if (pend) {
                    // "Preciso de mais tempo": esse tópico foi adiado por 2 dias — a matéria some da fila até
                    // o prazo passar, em vez de reaparecer no próximo turno do rodízio.
                    if (pend.postponed_until && new Date(pend.postponed_until) > new Date()) {
                        return;
                    }

                    regularCandidates.push({
                        weight: effectiveWeight,
                        entry: {
                            subjectId: subj.id,
                            subjectName: subj.name,
                            topicId: pend.id,
                            topicTitle: pend.title,
                            topicLink: pend.link || '',
                            topicMaterialLink: pend.materialLink || '',
                            isReviewMode: false,
                            priorityBoosted: performanceBoost > 0,
                            finalStretchReason: finalStretchActive ? (recurringErrorCount > 0 ? 'erros' : 'desempenho') : null
                        }
                    });
                }
            });

            const weightedRegularSequence = buildWeightedRoundRobin(regularCandidates);
            let sequence = weightedRegularSequence;

            if (sequence.length === 0) {
                const emptyMsg = appState.user_configuration.final_stretch_mode
                    ? "Nenhuma matéria com erro reincidente ou abaixo da meta agora — tudo em dia! Desative o Modo Reta Final pra voltar ao ciclo normal."
                    : "Cadastre matérias nas configurações.";
                sequence.push({ subjectId: "none", subjectName: "Nenhuma", topicId: "none", topicTitle: emptyMsg, isReviewMode: false });
            }

            appState.study_cycle.steps_sequence = sequence;
            
            // Correção da trava: Incrementa ou mantém o ponteiro em vez de resetar forçado para zero
            if (forceResetIndex || appState.study_cycle.current_step_index >= sequence.length) {
                appState.study_cycle.current_step_index = 0;
            }
            saveToDatabase();
        }

        // Liga/desliga o Modo Reta Final — é sempre uma decisão manual do usuário, nunca automática.
        // Ativado: a fila passa a mostrar só matérias com erro reincidente no Caderno de Erros ou com
        // desempenho abaixo da Nota de Corte Almejada, pausando o resto até ser desativado.
        async function toggleFinalStretchMode() {
            const isActive = !!appState.user_configuration.final_stretch_mode;

            if (!isActive) {
                const confirmed = await customConfirm(
                    "Ativar o Modo Reta Final?\n\nA partir de agora, a fila do Modo Foco vai mostrar só matérias com erro reincidente no Caderno de Erros ou com desempenho abaixo da sua Nota de Corte Almejada. Matérias em dia ficam pausadas até você desativar."
                );
                if (!confirmed) return;
                appState.user_configuration.final_stretch_mode = true;
                customAlert("Modo Reta Final ativado. Bons estudos na consolidação final!");
            } else {
                appState.user_configuration.final_stretch_mode = false;
                customAlert("Modo Reta Final desativado. Voltando ao ciclo normal.");
            }

            regenerateSmartCycle(true);
            updateUI();
        }

        // Retorna o aproveitamento médio (%) da matéria com base nas sessões com questões registradas, ou null se não houver dados
        // Casa pelo ID da matéria (não pelo nome!) — se casasse por nome, uma matéria excluída e recriada
        // com o mesmo nome (ou só coincidência de nome) herdaria o desempenho antigo de outra matéria, sem
        // ter nenhuma relação real com ela. O ID é único e nunca se repete entre matérias diferentes.
        function getSubjectAveragePerformance(subjectId) {
            const logs = appState.study_logs.filter(l => l.subject_id === subjectId && l.questions_attempted > 0);
            if (logs.length === 0) return null;
            const totalQ = logs.reduce((a, l) => a + l.questions_attempted, 0);
            const totalC = logs.reduce((a, l) => a + l.questions_correct, 0);
            return totalQ > 0 ? (totalC / totalQ) * 100 : null;
        }

        // Rodízio ponderado (weighted round-robin): distribui as matérias de forma intercalada e proporcional ao peso efetivo de cada uma
        function buildWeightedRoundRobin(candidates) {
            if (candidates.length === 0) return [];
            const totalWeight = candidates.reduce((a, c) => a + c.weight, 0);
            const counters = candidates.map(c => ({ ...c, credit: 0 }));
            const result = [];
            for (let i = 0; i < totalWeight; i++) {
                counters.forEach(c => c.credit += c.weight);
                let chosenIdx = 0;
                for (let j = 1; j < counters.length; j++) {
                    if (counters[j].credit > counters[chosenIdx].credit) chosenIdx = j;
                }
                result.push(counters[chosenIdx].entry);
                counters[chosenIdx].credit -= totalWeight;
            }
            return result;
        }

        // --- ALTERAÇÃO 1: DISTRIBUIÇÃO DA CARGA HORÁRIA SEMANAL POR DIA ---
        const DISTRIBUTION_DAY_IDS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
        const DISTRIBUTION_DAY_LABELS = { segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' };

        function readDistributionInputs() {
            const dist = {};
            DISTRIBUTION_DAY_IDS.forEach(day => {
                const el = document.getElementById(`dist-${day}`);
                dist[day] = el ? (parseFloat(el.value) || 0) : 0;
            });
            return dist;
        }

        function populateDistributionInputs() {
            const dist = appState.user_configuration.daily_distribution || {};
            DISTRIBUTION_DAY_IDS.forEach(day => {
                const el = document.getElementById(`dist-${day}`);
                if (el) el.value = dist[day] || 0;
            });
            const examDateInput = document.getElementById('config-exam-date');
            if (examDateInput) examDateInput.value = appState.user_configuration.exam_date || '';

            const calibrationSelect = document.getElementById('config-calibration-mode');
            if (calibrationSelect) calibrationSelect.value = appState.user_configuration.calibration_mode || 'WEIGHT';
            const targetScoreInput = document.getElementById('config-target-score');
            if (targetScoreInput) targetScoreInput.value = appState.user_configuration.target_score || 85;
            const tudaoPeriodSelect = document.getElementById('config-tudao-period');
            if (tudaoPeriodSelect) tudaoPeriodSelect.value = (appState.user_configuration.tudao_period === undefined || appState.user_configuration.tudao_period === null) ? 1 : appState.user_configuration.tudao_period;

            updateDistributionTotalDisplay();
        }

        function updateDistributionTotalDisplay() {
            const dist = readDistributionInputs();
            const total = Object.values(dist).reduce((a, b) => a + b, 0);

            DISTRIBUTION_DAY_IDS.forEach(day => {
                const labelEl = document.getElementById(`dist-${day}-label`);
                if (labelEl) labelEl.innerText = `${dist[day]}h`;
            });

            const totalEl = document.getElementById('total-weekly-hours-display');
            if (totalEl) totalEl.innerText = `${total}h`;
            const avgEl = document.getElementById('avg-daily-hours-display');
            if (avgEl) avgEl.innerText = `${(total / 7).toFixed(1)}h`;

            return { dist, total };
        }

        // Atalhos rápidos para começar a configuração de um jeito visual e simples
        function applyDistributionPreset(presetType) {
            let preset;
            if (presetType === 'weekdays') {
                preset = { segunda: 3, terca: 3, quarta: 3, quinta: 3, sexta: 3, sabado: 0, domingo: 0 };
            } else if (presetType === 'everyday') {
                preset = { segunda: 2, terca: 2, quarta: 2, quinta: 2, sexta: 2, sabado: 2, domingo: 2 };
            } else if (presetType === 'weekend-heavy') {
                preset = { segunda: 1, terca: 1, quarta: 1, quinta: 1, sexta: 1, sabado: 5, domingo: 5 };
            } else {
                return;
            }
            DISTRIBUTION_DAY_IDS.forEach(day => {
                const el = document.getElementById(`dist-${day}`);
                if (el) el.value = preset[day];
            });
            updateDistributionTotalDisplay();
        }

        // O total semanal e a média diária agora são sempre derivados da distribuição por dia, sem necessidade de validação de soma
        function saveWeeklyDistribution() {
            const { dist, total } = updateDistributionTotalDisplay();

            appState.user_configuration.daily_distribution = dist;
            appState.user_configuration.weekly_hours_goal = total;
            appState.user_configuration.daily_hours_goal = total > 0 ? (total / 7) : 0;
            saveToDatabase();

            // ALTERAÇÃO 2: a quantidade de metas passa a ser determinada pela carga horária semanal (ciclo/ordem intocados)
            regenerateSmartCycle(false);
            renderWeeklyGoalsSummary();
            updateUI();
            customAlert("Carga horária salva com sucesso! As metas da semana foram geradas com base na nova distribuição.");
        }

        // --- ALTERAÇÃO 2: GERAÇÃO DAS METAS COM BASE NA CARGA HORÁRIA (1 META = 1 HORA) ---
        function renderWeeklyGoalsSummary() {
            const summaryEl = document.getElementById('weekly-goals-summary');
            if (!summaryEl) return;
            const dist = appState.user_configuration.daily_distribution || {};
            const totalGoals = Math.round(parseFloat(appState.user_configuration.weekly_hours_goal) || 0);

            let html = `<div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Total de metas geradas: <strong style="color:var(--text-main);">${totalGoals}</strong> (1 meta = 1 hora)</div>`;
            DISTRIBUTION_DAY_IDS.forEach(day => {
                const hours = dist[day] || 0;
                const goals = Math.round(hours);
                html += `<div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom: 1px solid var(--border);"><span>${DISTRIBUTION_DAY_LABELS[day]}</span><span>${hours}h — ${goals} meta(s)</span></div>`;
            });
            summaryEl.innerHTML = html;
        }

        // --- ALTERAÇÃO 3: PREVISÃO DA DATA DE CONCLUSÃO (ALÉM DA ESTIMATIVA EM DIAS JÁ EXISTENTE) ---
        function computeEstimatedCompletionDate(totalHoursNeeded) {
            const dist = appState.user_configuration.daily_distribution;
            const fallbackDaily = parseFloat(appState.user_configuration.daily_hours_goal) || 0;
            const hasDistribution = dist && Object.values(dist).some(h => (parseFloat(h) || 0) > 0);
            // Índice alinhado ao Date.getDay(): 0 = Domingo ... 6 = Sábado
            const hoursByWeekday = hasDistribution ? [
                parseFloat(dist.domingo) || 0,
                parseFloat(dist.segunda) || 0,
                parseFloat(dist.terca) || 0,
                parseFloat(dist.quarta) || 0,
                parseFloat(dist.quinta) || 0,
                parseFloat(dist.sexta) || 0,
                parseFloat(dist.sabado) || 0
            ] : null;

            let remaining = totalHoursNeeded;
            let cursorDate = new Date();
            let safety = 0;
            while (remaining > 0 && safety < 3650) {
                const weekday = cursorDate.getDay();
                const dayHours = hoursByWeekday ? hoursByWeekday[weekday] : fallbackDaily;
                if (dayHours > 0) remaining -= dayHours;
                if (remaining > 0) cursorDate.setDate(cursorDate.getDate() + 1);
                safety++;
            }
            return cursorDate;
        }

        // --- SUGESTÃO: CONTAGEM REGRESSIVA PARA A PROVA (D-DAY) + RITMO NECESSÁRIO X RITMO ATUAL ---
        function updateExamCountdownAndPace() {
            settleMetasBalance();
            const daysEl = document.getElementById('exam-countdown-days');
            const requiredEl = document.getElementById('pace-required-text');
            const currentEl = document.getElementById('pace-current-text');
            const statusEl = document.getElementById('pace-status-indicator');
            if (!daysEl) return;

            const examDateStr = appState.user_configuration.exam_date;
            if (!examDateStr) {
                daysEl.innerText = "--";
                requiredEl.innerText = "Configure a data da prova";
                currentEl.innerText = "--";
                statusEl.innerHTML = "";
                return;
            }

            const today = new Date(); today.setHours(0, 0, 0, 0);
            const examDate = new Date(examDateStr + 'T00:00:00');
            const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
            daysEl.innerText = diffDays >= 0 ? diffDays : "0";

            const totalT = appState.subjects.reduce((acc, s) => acc + s.topics.length, 0);
            const doneT = appState.subjects.reduce((acc, s) => acc + s.topics.filter(t => t.completed).length, 0);
            const remT = totalT - doneT;
            const totalHoursNeeded = (remT * 1.5) + (appState.study_cycle.pending_metas_balance || 0);

            const requiredPace = diffDays > 0 ? (totalHoursNeeded / diffDays) : totalHoursNeeded;
            requiredEl.innerText = `${requiredPace.toFixed(1)}h/dia`;

            const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentSeconds = appState.study_logs
                .filter(l => new Date(l.timestamp) >= sevenDaysAgo)
                .reduce((acc, l) => acc + l.liquid_seconds, 0);
            const currentPace = (recentSeconds / 3600) / 7;
            currentEl.innerText = `${currentPace.toFixed(1)}h/dia`;

            if (remT <= 0) {
                statusEl.innerHTML = `<div class="alert-banner" style="background-color: var(--success-alpha); border:1px solid var(--success-alpha); color: var(--success); margin:0;"><i data-lucide="check-circle"></i> <span>Edital concluído!</span></div>`;
            } else if (currentPace + 0.05 >= requiredPace) {
                statusEl.innerHTML = `<div class="alert-banner" style="background-color: var(--success-alpha); border:1px solid var(--success-alpha); color: var(--success); margin:0;"><i data-lucide="check-circle"></i> <span>Seu ritmo está em dia com o prazo da prova.</span></div>`;
            } else {
                statusEl.innerHTML = `<div class="alert-banner danger" style="margin:0;"><i data-lucide="alert-triangle"></i> <span>Seu ritmo atual está abaixo do necessário para terminar a tempo.</span></div>`;
            }
            lucide.createIcons();
        }

        // --- SUGESTÃO: HEATMAP DE CONSISTÊNCIA (ESTILO GITHUB) ---
        function saveAdvancedGoals() {
            appState.user_configuration.target_score = parseInt(document.getElementById('config-target-score').value) || 85;
            const periodSelect = document.getElementById('config-tudao-period');
            if(periodSelect) {
                { const pv = parseInt(periodSelect.value); appState.user_configuration.tudao_period = isNaN(pv) ? 1 : pv; }
            }
            saveToDatabase();
        }

        function saveGlobalConfiguration() {
            appState.user_configuration.calibration_mode = document.getElementById('config-calibration-mode').value;
            const examDateInput = document.getElementById('config-exam-date');
            appState.user_configuration.exam_date = examDateInput && examDateInput.value ? examDateInput.value : null;
            saveAdvancedGoals();
            regenerateSmartCycle(false);
            updateUI();
            customAlert("Configurações do ciclo atualizadas globalmente.");
        }

        // Calcula quantas metas (1 meta = 1 hora) estão previstas para hoje, considerando a distribuição
        // configurada + qualquer recuperação de atraso pendente (definida pelo botão "Replanejar atrasos")
        // Verifica dias anteriores ainda não "acertados" e soma ao saldo pendente qualquer meta não cumprida,
        // automaticamente — sem precisar de nenhum clique ou ação manual do usuário.
        function settleMetasBalance() {
            const dayKeys = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
            const dist = appState.user_configuration.daily_distribution || {};
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const todayKey = toLocalDateKey(today);

            // Primeira vez que esse recurso roda: define o marco inicial em "ontem", sem varrer todo o
            // histórico anterior (evita um saldo gigante surgir do nada pra quem já usava o sistema antes).
            if (!appState.study_cycle.balance_settled_through_date) {
                appState.study_cycle.balance_settled_through_date = todayKey;
                saveToDatabase();
                return;
            }

            if (appState.study_cycle.balance_settled_through_date === todayKey) return; // já acertado até hoje

            let cursor = new Date(appState.study_cycle.balance_settled_through_date + 'T00:00:00');
            cursor.setDate(cursor.getDate() + 1);
            let changed = false;
            let safety = 0;
            let lastProcessedKey = appState.study_cycle.balance_settled_through_date;

            while (cursor < today && safety < 90) {
                const expectedMetas = Math.round(parseFloat(dist[dayKeys[cursor.getDay()]]) || 0);
                if (expectedMetas > 0) {
                    const cursorKey = toLocalDateKey(cursor);
                    const completedThatDay = appState.study_logs.filter(l => toLocalDateKey(new Date(l.timestamp)) === cursorKey).length;
                    const deficit = Math.max(0, expectedMetas - completedThatDay);
                    appState.study_cycle.pending_metas_balance = (appState.study_cycle.pending_metas_balance || 0) + deficit;
                    changed = true;
                }
                lastProcessedKey = toLocalDateKey(cursor);
                cursor.setDate(cursor.getDate() + 1);
                safety++;
            }

            // Se o limite de segurança foi atingido antes de alcançar "hoje" (ex: usuário ficou meses sem
            // abrir o site), retoma de onde parou na próxima chamada em vez de pular dias sem processar.
            appState.study_cycle.balance_settled_through_date = (safety >= 90 && cursor < today) ? lastProcessedKey : todayKey;
            if (changed) saveToDatabase();
        }

        function computeTodayMetaCount() {
            settleMetasBalance();
            const dist = appState.user_configuration.daily_distribution || {};
            const dayKeys = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
            const todayHours = parseFloat(dist[dayKeys[new Date().getDay()]]) || 0;
            return Math.round(todayHours);
        }

        // Quantas metas (sessões registradas) já foram concluídas hoje
        function computeTodayCompletedMetasCount() {
            const todayKey = toLocalDateKey(new Date());
            return appState.study_logs.filter(l => toLocalDateKey(new Date(l.timestamp)) === todayKey).length;
        }
