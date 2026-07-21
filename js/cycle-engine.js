// ============================================================
// MOTOR DO CICLO DE ESTUDOS (rodízio ponderado, metas, D-Day)
// ============================================================

        function regenerateSmartCycle(forceResetIndex = false) {
            let reviewSequence = [];
            let regularCandidates = [];

            const activeSubjects = appState.subjects.filter(s => s.isActive);
            const avgExpectedQuestions = activeSubjects.length > 0
                ? activeSubjects.reduce((acc, s) => acc + (parseInt(s.expected_questions) || 1), 0) / activeSubjects.length
                : 1;

            appState.subjects.forEach(subj => {
                if (!subj.isActive) return;

                if (subj.isStrategicReview) {
                    // Periodicidade da Revisão Tudão: só volta a aparecer quando o período configurado já passou desde a última vez feita
                    const periodMonths = appState.user_configuration.tudao_period || 1;
                    const lastReview = subj.last_tudao_review_date ? new Date(subj.last_tudao_review_date) : null;
                    let isDue = true;
                    if (lastReview) {
                        const nextDue = new Date(lastReview);
                        nextDue.setMonth(nextDue.getMonth() + periodMonths);
                        isDue = new Date() >= nextDue;
                    }
                    if (isDue) {
                        reviewSequence.push({
                            subjectId: subj.id,
                            subjectName: subj.name,
                            topicId: "STRATEGIC",
                            topicTitle: "MODO REVISÃO ESTRATÉGICA: Cadernos Completos via TEC Concursos (Questões)",
                            isReviewMode: true,
                            pilar: 4
                        });
                    }
                    return;
                }

                const totalTopics = subj.topics.length;
                const completedTopics = subj.topics.filter(t => t.completed).length;

                if (completedTopics === totalTopics && totalTopics > 0) {
                    reviewSequence.push({
                        subjectId: subj.id,
                        subjectName: subj.name,
                        topicId: "TUDAO",
                        topicTitle: `REVISÃO TUDÃO: Conteúdo Completo (Ajuste: ${appState.user_configuration.tudao_period || 1} Mês)`,
                        isReviewMode: true,
                        pilar: 3
                    });
                    subj.isStrategicReview = true;
                    return;
                }

                if (completedTopics > 0 && completedTopics % 3 === 0) {
                    reviewSequence.push({
                        subjectId: subj.id,
                        subjectName: subj.name,
                        topicId: "CUMULATIVE",
                        topicTitle: `REVISÃO CUMULATIVA: Bloqueio de avanço! Revisar do início até Aula ${completedTopics - 1}`,
                        isReviewMode: true,
                        pilar: 2
                    });
                }

                const pend = subj.topics.find(t => !t.completed);
                if (pend) {
                    // Calibragem Base: respeita o modo escolhido pelo usuário (peso teórico ou nº de questões do edital)
                    const calibrationMode = appState.user_configuration.calibration_mode || 'WEIGHT';
                    let baseWeight;
                    if (calibrationMode === 'QUESTIONS_COUNT') {
                        baseWeight = Math.max(1, Math.round((parseInt(subj.expected_questions) || 1) / avgExpectedQuestions));
                    } else {
                        baseWeight = parseInt(subj.weight) || 1;
                    }

                    // Prioridade dinâmica: desempenho abaixo da meta soma peso extra.
                    const performance = getSubjectAveragePerformance(subj.name);
                    const targetScore = appState.user_configuration.target_score || 85;
                    const performanceBoost = (performance !== null && performance < targetScore) ? 1 : 0;
                    const effectiveWeight = Math.max(1, baseWeight + performanceBoost);

                    regularCandidates.push({
                        weight: effectiveWeight,
                        entry: {
                            subjectId: subj.id,
                            subjectName: subj.name,
                            topicId: pend.id,
                            topicTitle: pend.title,
                            isReviewMode: false,
                            // Pilar 1 (Revisão Rápida) só faz sentido quando já existe uma sessão anterior dessa
                            // matéria pra revisar — no primeiro tópico de uma matéria nova ainda não há nada a rever.
                            pilar: completedTopics > 0 ? 1 : 0,
                            priorityBoosted: performanceBoost > 0
                        }
                    });
                }
            });

            const weightedRegularSequence = buildWeightedRoundRobin(regularCandidates);
            let sequence = reviewSequence.concat(weightedRegularSequence);

            if (sequence.length === 0) {
                sequence.push({ subjectId: "none", subjectName: "Nenhuma", topicId: "none", topicTitle: "Cadastre matérias nas configurações.", isReviewMode: false, pilar: 0 });
            }

            appState.study_cycle.steps_sequence = sequence;
            
            // Correção da trava: Incrementa ou mantém o ponteiro em vez de resetar forçado para zero
            if (forceResetIndex || appState.study_cycle.current_step_index >= sequence.length) {
                appState.study_cycle.current_step_index = 0;
            }
            saveToDatabase();
        }

        // Retorna o aproveitamento médio (%) da matéria com base nas sessões com questões registradas, ou null se não houver dados
        function getSubjectAveragePerformance(subjectName) {
            const logs = appState.study_logs.filter(l => l.snapshot_subject_name === subjectName && l.questions_attempted > 0);
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
            if (tudaoPeriodSelect) tudaoPeriodSelect.value = appState.user_configuration.tudao_period || 1;

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
            const totalHoursNeeded = remT * 1.5;

            const requiredPace = diffDays > 0 ? (totalHoursNeeded / diffDays) : totalHoursNeeded;
            requiredEl.innerText = `${requiredPace.toFixed(1)}h/dia`;

            const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentSeconds = appState.study_logs
                .filter(l => new Date(l.timestamp) >= sevenDaysAgo)
                .reduce((acc, l) => acc + l.liquid_seconds, 0);
            const currentPace = (recentSeconds / 3600) / 7;
            currentEl.innerText = `${currentPace.toFixed(1)}h/dia`;

            if (remT <= 0) {
                statusEl.innerHTML = `<div class="alert-banner" style="background-color: var(--primary-alpha); border:1px solid rgba(16,185,129,0.2); color: var(--primary); margin:0;"><i data-lucide="check-circle"></i> <span>Edital concluído!</span></div>`;
            } else if (currentPace + 0.05 >= requiredPace) {
                statusEl.innerHTML = `<div class="alert-banner" style="background-color: var(--primary-alpha); border:1px solid rgba(16,185,129,0.2); color: var(--primary); margin:0;"><i data-lucide="check-circle"></i> <span>Seu ritmo está em dia com o prazo da prova.</span></div>`;
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
                appState.user_configuration.tudao_period = parseInt(periodSelect.value) || 1;
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
            customAlert("Configurações do ciclo updated globalmente.");
        }

        function simulateInactivityDelay() {
            const dist = appState.user_configuration.daily_distribution || {};
            const dayKeys = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']; // alinhado ao Date.getDay()
            const today = new Date(); today.setHours(0, 0, 0, 0);

            let missedHours = 0;
            let missedDaysCount = 0;

            for (let i = 1; i <= 14; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() - i);
                const expectedHours = parseFloat(dist[dayKeys[checkDate.getDay()]]) || 0;
                if (expectedHours <= 0) continue;

                const studiedSeconds = appState.study_logs
                    .filter(l => {
                        const d = new Date(l.timestamp); d.setHours(0, 0, 0, 0);
                        return d.getTime() === checkDate.getTime();
                    })
                    .reduce((acc, l) => acc + l.liquid_seconds, 0);
                const studiedHours = studiedSeconds / 3600;

                if (studiedHours < expectedHours) {
                    missedHours += (expectedHours - studiedHours);
                    missedDaysCount++;
                }
            }

            if (missedHours <= 0.05) {
                customAlert("Nenhum atraso detectado nos últimos 14 dias! Seu ritmo está em dia com a distribuição configurada.");
            } else {
                customAlert(`Atraso detectado: ${missedHours.toFixed(1)}h não estudadas em ${missedDaysCount} dia(s) nos últimos 14 dias, considerando sua distribuição configurada. Recomenda-se reforçar aprox. ${(missedHours / 7).toFixed(1)}h extras por dia nos próximos 7 dias para recuperar o ritmo.`);
            }

            regenerateSmartCycle(false);
            updateUI();
        }

