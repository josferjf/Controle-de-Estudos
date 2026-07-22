// ============================================================
// RENDERIZAÇÃO PRINCIPAL DA INTERFACE E GRÁFICOS
// ============================================================

        // Modo de visão da fila de metas: 'today' (padrão), 'advance' (adiantar metas), 'two_weeks' (estimativa)
        // É um estado só de exibição, não precisa ser salvo na nuvem — reinicia em "hoje" a cada carregamento.
        let cycleQueueViewMode = 'today';

        function toggleTwoWeeksView() {
            cycleQueueViewMode = (cycleQueueViewMode === 'two_weeks') ? 'today' : 'two_weeks';
            updateUI();
        }

        function advanceTodayGoals() {
            cycleQueueViewMode = 'advance';
            updateUI();
        }

        function updateUI() {
            const count = appState.error_notebook.length;
            const badge = document.getElementById('error-badge-count');
            if(count > 0) { badge.innerText = count; badge.style.display = "inline-block"; }
            else { badge.style.display = "none"; }

            const container = document.getElementById('cycle-queue-container');
            container.innerHTML = "";
            
            if (appState.study_cycle.current_step_index >= appState.study_cycle.steps_sequence.length) {
                appState.study_cycle.current_step_index = 0;
            }
            
            const currentStep = appState.study_cycle.steps_sequence[appState.study_cycle.current_step_index];
            if (currentStep) {
                document.getElementById('focus-subject-title').innerText = currentStep.subjectName;
                document.getElementById('focus-topic-title').innerText = currentStep.topicTitle;
                
                const alertZone = document.getElementById('review-alert-indicator');
                if (currentStep.pilar === 1) {
                    const boostBadge = currentStep.priorityBoosted ? `<span class="badge badge-warning" style="margin-left:8px;">Prioridade elevada (desempenho abaixo da meta)</span>` : '';
                    alertZone.innerHTML = `
                        <div class="alert-banner warning" style="margin: 0;"><i data-lucide="info"></i> <span><strong>Pilar 1 - Revisão Rápida:</strong> Dedique de 5 a 10 min para rever as anotações do bloco anterior.${boostBadge}</span></div>
                        <label style="display:flex; align-items:center; gap:8px; margin-top:10px; font-size:13px; cursor:pointer; color: var(--text-muted);">
                            <input type="checkbox" id="quick-review-checkbox" style="width:auto;"> Já revisei rapidamente o bloco anterior
                        </label>
                    `;
                } else if (currentStep.pilar === 2 || currentStep.pilar === 3) {
                    alertZone.innerHTML = `<div class="alert-banner danger" style="margin: 0;"><i data-lucide="alert-octagon"></i> <span><strong>Revisão Bloqueante:</strong> Consolide a base antes de tentar avançar no edital.</span></div>`;
                } else {
                    alertZone.innerHTML = "";
                }
                lucide.createIcons();
            }

            // Matérias com peso maior ocupam mais posições na fila internamente (é assim que o peso
            // influencia a frequência), mas mostrar cada posição como linha separada confundia, já que
            // é sempre o mesmo próximo tópico pendente. Aqui agrupamos por matéria+tópico numa única linha.
            const currentQueueKey = currentStep ? `${currentStep.subjectId}-${currentStep.topicId}` : null;

            const groupedSteps = new Map();
            appState.study_cycle.steps_sequence.forEach((step) => {
                const key = `${step.subjectId}-${step.topicId}`;
                if (!groupedSteps.has(key)) {
                    groupedSteps.set(key, { step, count: 0 });
                }
                groupedSteps.get(key).count++;
            });
            const groupedArray = Array.from(groupedSteps.entries());

            // --- METAS DE HOJE: filtra a fila de acordo com a cota diária configurada e o modo de visão ativo ---
            const todayQuota = computeTodayMetaCount();
            const todayCompleted = computeTodayCompletedMetasCount();
            const remainingToday = Math.max(0, todayQuota - todayCompleted);

            const progressEl = document.getElementById('today-goals-progress');
            const titleEl = document.getElementById('cycle-queue-title-text');
            const completedMsgEl = document.getElementById('today-goals-completed-msg');
            const toggleBtn = document.getElementById('btn-toggle-two-weeks');
            const completedTitleEl = document.getElementById('today-goals-completed-title');
            const completedSubtitleEl = document.getElementById('today-goals-completed-subtitle');

            let itemsToShow;
            if (cycleQueueViewMode === 'two_weeks') {
                titleEl.innerText = 'Próximas 2 Semanas (estimativa)';
                toggleBtn.innerText = 'Voltar para Hoje';
                const dist = appState.user_configuration.daily_distribution || {};
                const avgDaily = Object.values(dist).reduce((a, b) => a + (parseFloat(b) || 0), 0) / 7;
                itemsToShow = Math.max(1, Math.round(avgDaily * 14));
                progressEl.innerText = `Estimativa com base no seu ritmo médio configurado (~${avgDaily.toFixed(1)}h/dia) — não é uma previsão exata de datas.`;
                container.style.display = 'flex';
                completedMsgEl.style.display = 'none';
            } else if (cycleQueueViewMode === 'advance') {
                titleEl.innerText = 'Metas de Hoje (adiantadas)';
                toggleBtn.innerText = 'Ver Próximas 2 Semanas';
                itemsToShow = remainingToday + Math.max(1, todayQuota || 3);
                progressEl.innerText = `${todayCompleted}/${todayQuota} metas de hoje concluídas • mostrando metas adiantadas da fila`;
                container.style.display = 'flex';
                completedMsgEl.style.display = 'none';
            } else {
                titleEl.innerText = 'Metas de Hoje';
                toggleBtn.innerText = 'Ver Próximas 2 Semanas';
                itemsToShow = remainingToday;
                progressEl.innerText = todayQuota > 0
                    ? `${todayCompleted}/${todayQuota} metas de hoje concluídas`
                    : 'Nenhuma meta programada para hoje na sua distribuição de horas.';

                if (remainingToday === 0 && groupedArray.length > 0) {
                    container.style.display = 'none';
                    completedMsgEl.style.display = 'block';
                    if (todayQuota > 0) {
                        completedTitleEl.innerText = 'Metas de hoje concluídas!';
                        completedSubtitleEl.innerText = 'Quer continuar estudando? Adiante mais metas da fila.';
                    } else {
                        completedTitleEl.innerText = 'Nenhuma meta programada para hoje';
                        completedSubtitleEl.innerText = 'Quer estudar mesmo assim? Adiante metas da fila.';
                    }
                } else {
                    container.style.display = 'flex';
                    completedMsgEl.style.display = 'none';
                }
            }

            const itemsSlice = groupedArray.slice(0, itemsToShow);
            itemsSlice.forEach(([key, data]) => {
                const step = data.step;
                const item = document.createElement('div');
                item.className = `cycle-item ${key === currentQueueKey ? 'active' : ''}`;
                const freqBadge = data.count > 1 ? `<span class="badge badge-purple" style="margin-left:6px;">${data.count}x na fila</span>` : '';
                item.innerHTML = `<div><strong>${step.subjectName}</strong>${freqBadge}<br><small style="color:var(--text-muted);">${step.topicTitle}</small></div>
                <span class="badge ${step.isReviewMode ? 'badge-danger' : 'badge-success'}">${step.isReviewMode ? 'Revisão' : 'Teoria'}</span>`;
                container.appendChild(item);
            });

            if (itemsSlice.length === 0 && container.style.display !== 'none') {
                container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:15px 0;">Nenhuma matéria pendente encontrada.</p>`;
            }

            renderSubjectsList();

            renderErrorNotebook();
            renderErrorDashboard();

            const filteredLogs = getFilteredLogs();

            let totalSeconds = filteredLogs.reduce((acc, l) => acc + l.liquid_seconds, 0);
            let totalHrs = Math.floor(totalSeconds / 3600);
            let totalMins = Math.floor((totalSeconds % 3600) / 60);
            document.getElementById('stat-total-hours').innerText = `${totalHrs}h ${totalMins.toString().padStart(2, '0')}m`;

            let tQty = filteredLogs.reduce((acc, l) => acc + l.questions_attempted, 0);
            let tCorrect = filteredLogs.reduce((acc, l) => acc + l.questions_correct, 0);
            document.getElementById('stat-total-questions').innerText = tQty;
            document.getElementById('stat-global-performance').innerText = tQty > 0 ? ((tCorrect / tQty) * 100).toFixed(1) + "%" : "0.0%";
            
            let totalMinutes = totalSeconds / 60;
            document.getElementById('stat-pace').innerText = tQty > 0 ? (totalMinutes / tQty).toFixed(1) + " min/Q" : "0.0 min/Q";

            const avgSessionEl = document.getElementById('stat-avg-session');
            if (avgSessionEl) {
                avgSessionEl.innerText = filteredLogs.length > 0 ? `${Math.round(totalMinutes / filteredLogs.length)} min` : "0 min";
            }

            // Comparação com o período anterior equivalente (só faz sentido para filtros de 7/30 dias)
            const previousLogs = getPreviousPeriodLogs();
            if (previousLogs !== null) {
                const prevSeconds = previousLogs.reduce((acc, l) => acc + l.liquid_seconds, 0);
                const prevQty = previousLogs.reduce((acc, l) => acc + l.questions_attempted, 0);
                const prevCorrect = previousLogs.reduce((acc, l) => acc + l.questions_correct, 0);
                const prevPerformance = prevQty > 0 ? (prevCorrect / prevQty) * 100 : 0;
                const currentPerformance = tQty > 0 ? (tCorrect / tQty) * 100 : 0;

                document.getElementById('stat-total-hours-delta').innerText = formatTrendDelta(totalSeconds, prevSeconds);
                document.getElementById('stat-total-questions-delta').innerText = formatTrendDelta(tQty, prevQty);
                document.getElementById('stat-global-performance-delta').innerText = formatTrendDelta(currentPerformance, prevPerformance);
            } else {
                document.getElementById('stat-total-hours-delta').innerText = "";
                document.getElementById('stat-total-questions-delta').innerText = "";
                document.getElementById('stat-global-performance-delta').innerText = "";
            }

            const totalT = appState.subjects.reduce((acc,s)=>acc+s.topics.length, 0);
            const doneT = appState.subjects.reduce((acc,s)=>acc+s.topics.filter(t=>t.completed).length, 0);

            // Cobertura do Edital ponderada pelo nº de questões esperadas de cada matéria, não apenas pela contagem bruta de tópicos
            const totalEditalQuestionsForCoverage = appState.subjects.reduce((acc, s) => acc + (parseInt(s.expected_questions) || 0), 0);
            let coveragePercentage;
            if (totalEditalQuestionsForCoverage > 0) {
                const weightedCoverage = appState.subjects.reduce((acc, s) => {
                    const subjTotal = s.topics.length;
                    const subjDone = s.topics.filter(t => t.completed).length;
                    const subjCompletionRatio = subjTotal > 0 ? (subjDone / subjTotal) : 0;
                    return acc + (subjCompletionRatio * (parseInt(s.expected_questions) || 0));
                }, 0);
                coveragePercentage = (weightedCoverage / totalEditalQuestionsForCoverage) * 100;
            } else {
                coveragePercentage = totalT > 0 ? (doneT / totalT) * 100 : 0;
            }
            document.getElementById('stat-edital-coverage').innerText = coveragePercentage.toFixed(1) + "%";

            // Cálculo dinâmico do progresso da meta semanal baseado nos logs filtrados
            const weeklyHoursGoal = parseFloat(appState.user_configuration.weekly_hours_goal) || 30;
            const computedHoursThisPeriod = totalSeconds / 3600;
            const progressPercent = Math.min(100, (computedHoursThisPeriod / weeklyHoursGoal) * 100);
            document.getElementById('weekly-progress-bar').style.width = `${progressPercent}%`;
            document.getElementById('weekly-progress-text').innerText = `${progressPercent.toFixed(1)}% concluído`;
            document.getElementById('weekly-hours-text').innerText = `${computedHoursThisPeriod.toFixed(1)}h / ${weeklyHoursGoal}h`;

            // ALTERAÇÃO 2: quantidade de metas geradas com base na carga horária semanal (1 meta = 1 hora)
            const weeklyGoalsCountEl = document.getElementById('weekly-goals-count-text');
            if (weeklyGoalsCountEl) {
                weeklyGoalsCountEl.innerText = `Metas desta semana: ${Math.round(weeklyHoursGoal)} (1 meta = 1 hora de estudo)`;
            }

            const streakEl = document.getElementById('focus-streak-badge');
            if (streakEl) {
                const streak = computeStudyStreak();
                streakEl.innerText = `🔥 ${streak} dia(s) seguido(s)`;
            }

            const diagnoseTbody = document.getElementById('diagnose-table-body');
            diagnoseTbody.innerHTML = "";
            
            let subjectSummaryMap = {};
            appState.subjects.forEach(s => { subjectSummaryMap[s.name] = { seconds: 0, qty: 0, correct: 0, weight: parseInt(s.weight) || 1 }; });
            filteredLogs.forEach(l => {
                if(subjectSummaryMap[l.snapshot_subject_name]) {
                    subjectSummaryMap[l.snapshot_subject_name].seconds += l.liquid_seconds;
                    subjectSummaryMap[l.snapshot_subject_name].qty += l.questions_attempted;
                    subjectSummaryMap[l.snapshot_subject_name].correct += l.questions_correct;
                }
            });

            const targetScore = appState.user_configuration.target_score || 85;

            // Ordena por urgência: peso da matéria x quanto está abaixo da meta primeiro, matérias sem registros por último
            const sortedSubjectNames = Object.keys(subjectSummaryMap).sort((a, b) => {
                const dataA = subjectSummaryMap[a];
                const dataB = subjectSummaryMap[b];
                const pctA = dataA.qty > 0 ? (dataA.correct / dataA.qty) * 100 : null;
                const pctB = dataB.qty > 0 ? (dataB.correct / dataB.qty) * 100 : null;
                const urgencyA = pctA === null ? -1 : dataA.weight * Math.max(0, targetScore - pctA);
                const urgencyB = pctB === null ? -1 : dataB.weight * Math.max(0, targetScore - pctB);
                return urgencyB - urgencyA;
            });

            sortedSubjectNames.forEach(subjName => {
                const data = subjectSummaryMap[subjName];
                const sHrs = Math.floor(data.seconds / 3600);
                const sMins = Math.floor((data.seconds % 3600) / 60);
                const pct = data.qty > 0 ? (data.correct / data.qty) * 100 : 0;
                
                let statusBadge = `<span class="badge badge-purple">Sem registros</span>`;
                if(data.qty > 0) {
                    statusBadge = pct >= targetScore ? `<span class="badge badge-success">✓ Acima da Meta</span>` : `<span class="badge badge-danger">⚠️ Abaixo da Meta</span>`;
                }

                const trDiagnose = document.createElement('tr');
                trDiagnose.innerHTML = `
                    <td><strong>${subjName}</strong></td>
                    <td>${sHrs}h ${sMins}m</td>
                    <td>${data.qty}</td>
                    <td><strong>${data.qty > 0 ? pct.toFixed(1) + "%" : "0.0%"}</strong></td>
                    <td>${statusBadge}</td>
                `;
                diagnoseTbody.appendChild(trDiagnose);
            });

            renderStudyLogsHistory();


            const dailyH = parseFloat(appState.user_configuration.daily_hours_goal) || 4.5;
            const remT = totalT - doneT;
            settleMetasBalance();
            const debtHours = appState.study_cycle.pending_metas_balance || 0;
            const daysNeeded = Math.ceil(((remT * 1.5) + debtHours) / dailyH);
            if(remT <= 0 && debtHours <= 0) { document.getElementById('config-estimated-date').innerText = "Edital Concluído!"; }
            else { document.getElementById('config-estimated-date').innerText = `Aprox. ${daysNeeded} dias ativos`; }

            // ALTERAÇÃO 3: previsão da data de conclusão, recalculada automaticamente junto com a estimativa em dias
            const completionDateEl = document.getElementById('config-estimated-completion-date');
            if (completionDateEl) {
                if (remT <= 0 && debtHours <= 0) {
                    completionDateEl.innerText = "Edital Concluído!";
                } else {
                    const predictedDate = computeEstimatedCompletionDate((remT * 1.5) + debtHours);
                    completionDateEl.innerText = predictedDate.toLocaleDateString('pt-BR');
                }
            }

            const debtNoticeEl = document.getElementById('config-debt-hours-notice');
            if (debtNoticeEl) {
                if (debtHours > 0) {
                    debtNoticeEl.style.display = 'block';
                    debtNoticeEl.innerText = `Inclui ${debtHours.toFixed(1)}h de metas não cumpridas em dias anteriores, já incorporadas automaticamente a este prazo`;
                } else {
                    debtNoticeEl.style.display = 'none';
                }
            }

            const quickReviewsEl = document.getElementById('stat-quick-reviews');
            if (quickReviewsEl) quickReviewsEl.innerText = appState.study_cycle.quick_reviews_completed || 0;

            updateExamCountdownAndPace();

            lucide.createIcons();
        }

        // --- CORREÇÃO DA CONSISTÊNCIA DE INTEGRAÇÃO DOS FILTROS DO CHART.JS ---
        function renderCharts() {
            const filteredLogs = getFilteredLogs();
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const tickColor = isDark ? '#94a3b8' : '#64748b';
            const gridColor = isDark ? '#232b3f' : '#e2e8f0';

            renderConsistencyHeatmap();

            let subjectDataMap = {};
            appState.subjects.forEach(s => { subjectDataMap[s.name] = { minutes: 0, questions: 0, correct: 0 }; });
            
            filteredLogs.forEach(log => {
                if(!subjectDataMap[log.snapshot_subject_name]) {
                    subjectDataMap[log.snapshot_subject_name] = { minutes: 0, questions: 0, correct: 0 };
                }
                subjectDataMap[log.snapshot_subject_name].minutes += log.liquid_seconds / 60;
                subjectDataMap[log.snapshot_subject_name].questions += log.questions_attempted;
                subjectDataMap[log.snapshot_subject_name].correct += log.questions_correct;
            });

            let labels = Object.keys(subjectDataMap);
            let minutesData = labels.map(l => Math.round(subjectDataMap[l].minutes));
            
            if(chartRadarInstance) chartRadarInstance.destroy();
            if(chartPerformanceRadarInstance) chartPerformanceRadarInstance.destroy();
            if(chartLineInstance) chartLineInstance.destroy();
            if(chartBarInstance) chartBarInstance.destroy();

            // Radar de Desempenho: só entram matérias com questões registradas no período, para não confundir
            // "sem dados ainda" com "desempenho ruim" (ambos apareceriam como 0%)
            const radarLabels = labels.filter(l => subjectDataMap[l].questions > 0);
            const radarPerformanceData = radarLabels.map(l => {
                const d = subjectDataMap[l];
                return d.questions > 0 ? Math.round((d.correct / d.questions) * 100) : 0;
            });
            const targetScoreForRadar = appState.user_configuration.target_score || 85;

            const ctxPerformanceRadar = document.getElementById('canvas-performance-radar');
            const radarNoticeEl = document.getElementById('performance-radar-notice');
            if (ctxPerformanceRadar && radarLabels.length >= 3) {
                ctxPerformanceRadar.style.display = 'block';
                if (radarNoticeEl) radarNoticeEl.style.display = 'none';
                chartPerformanceRadarInstance = new Chart(ctxPerformanceRadar.getContext('2d'), {
                    type: 'radar',
                    data: {
                        labels: radarLabels,
                        datasets: [
                            {
                                label: 'Seu Desempenho',
                                data: radarPerformanceData,
                                borderColor: '#f59e0b',
                                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                borderWidth: 2,
                                pointBackgroundColor: '#f59e0b'
                            },
                            {
                                label: `Nota de Corte (${targetScoreForRadar}%)`,
                                data: radarLabels.map(() => targetScoreForRadar),
                                borderColor: '#ef4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                                borderWidth: 1.5,
                                borderDash: [6, 4],
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            r: {
                                min: 0,
                                max: 100,
                                grid: { color: gridColor },
                                angleLines: { color: gridColor },
                                pointLabels: { color: tickColor, font: { size: 11 } },
                                ticks: { color: tickColor, backdropColor: 'transparent', stepSize: 20 }
                            }
                        },
                        plugins: {
                            legend: { position: 'bottom', labels: { color: tickColor, font: { family: 'Inter', weight: 500 } } }
                        }
                    }
                });
            } else if (ctxPerformanceRadar) {
                // Radar precisa de pelo menos 3 eixos para fazer sentido visualmente
                ctxPerformanceRadar.style.display = 'none';
                if (radarNoticeEl) radarNoticeEl.style.display = 'block';
            }

            const ctxPizza = document.getElementById('canvas-radar').getContext('2d');
            chartRadarInstance = new Chart(ctxPizza, {
                type: 'doughnut',
                data: {
                    labels: labels.length > 0 ? labels : ["Sem dados"],
                    datasets: [{
                        data: minutesData.some(m => m > 0) ? minutesData : [100],
                        backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(71, 85, 105, 0.8)', 'rgba(139, 92, 246, 0.8)'],
                        borderColor: isDark ? '#131825' : '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    cutout: '70%',
                    plugins: { 
                        legend: { 
                            position: 'bottom',
                            labels: { color: tickColor, font: { family: 'Inter', weight: 500 } }
                        } 
                    } 
                }
            });

            const ctxLine = document.getElementById('canvas-line').getContext('2d');
            const selectedSubjectFilter = document.getElementById('chart-subject-selector')?.value || 'all';
            
            let displayLogs = filteredLogs;
            if (selectedSubjectFilter !== 'all') {
                displayLogs = filteredLogs.filter(l => l.snapshot_subject_name === selectedSubjectFilter);
            }

            let performanceTimeline = displayLogs.map(l => l.performance_percentage);
            let timelineLabels = displayLogs.map((_, i) => `S. ${i+1}`);
            const labelsForChart = timelineLabels.length > 0 ? timelineLabels : ["Início"];
            const targetScoreForChart = appState.user_configuration.target_score || 85;
            
            let lineGradient = ctxLine.createLinearGradient(0, 0, 0, 230);
            lineGradient.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
            lineGradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

            chartLineInstance = new Chart(ctxLine, {
                type: 'line',
                data: {
                    labels: labelsForChart,
                    datasets: [{
                        label: selectedSubjectFilter === 'all' ? 'Taxa Geral %' : `${selectedSubjectFilter} %`,
                        data: performanceTimeline.length > 0 ? performanceTimeline : [0],
                        borderColor: '#f59e0b',
                        backgroundColor: lineGradient,
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2,
                        pointBackgroundColor: '#f59e0b'
                    }, {
                        label: `Nota de Corte (${targetScoreForChart}%)`,
                        data: labelsForChart.map(() => targetScoreForChart),
                        borderColor: '#ef4444',
                        borderDash: [6, 4],
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: false
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: tickColor } } },
                    scales: { 
                        y: { 
                            min: 0, 
                            max: 100,
                            grid: { color: gridColor },
                            ticks: { color: tickColor }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: tickColor }
                        }
                    }
                }
            });

            const ctxBar = document.getElementById('canvas-bar').getContext('2d');
            let barGradient = ctxBar.createLinearGradient(0, 0, 0, 250);
            barGradient.addColorStop(0, '#10b981');
            barGradient.addColorStop(1, '#059669');

            chartBarInstance = new Chart(ctxBar, {
                type: 'bar',
                data: {
                    labels: labels.length > 0 ? labels : ["Sem dados"],
                    datasets: [{
                        label: 'Minutos Líquidos',
                        data: minutesData.length > 0 ? minutesData : [0],
                        backgroundColor: barGradient,
                        borderRadius: 4
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: tickColor } } },
                    scales: {
                        y: { grid: { color: gridColor }, ticks: { color: tickColor } },
                        x: { grid: { display: false }, ticks: { color: tickColor } }
                    }
                }
            });
        }

        // --- MELHORIA 2: FLUXOS COMPLETOS PARA EDIÇÃO E EXCLUSÃO UNITÁRIA DE DISCIPLINAS ---
        // --- CADASTRO DE MATÉRIAS: RENDERIZAÇÃO COM PROGRESSO, % DO EDITAL, ATIVO/PAUSADO E TÓPICOS INDIVIDUAIS ---
        let expandedSubjectIds = new Set();

        function computeStudyStreak() {
            const hoursByDate = {};
            appState.study_logs.forEach(l => {
                const key = toLocalDateKey(new Date(l.timestamp));
                hoursByDate[key] = (hoursByDate[key] || 0) + l.liquid_seconds;
            });

            let streak = 0;
            let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
            const todayKey = toLocalDateKey(cursor);
            if (!hoursByDate[todayKey]) {
                cursor.setDate(cursor.getDate() - 1);
            }
            while (true) {
                const key = toLocalDateKey(cursor);
                if (hoursByDate[key] && hoursByDate[key] > 0) {
                    streak++;
                    cursor.setDate(cursor.getDate() - 1);
                } else {
                    break;
                }
            }
            return streak;
        }

        function renderConsistencyHeatmap() {
            const container = document.getElementById('consistency-heatmap-container');
            if (!container) return;

            const totalDays = 119; // ~17 semanas
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const startDate = new Date(today); startDate.setDate(startDate.getDate() - (totalDays - 1));
            startDate.setDate(startDate.getDate() - startDate.getDay());

            const hoursByDate = {};
            appState.study_logs.forEach(l => {
                const key = toLocalDateKey(new Date(l.timestamp));
                hoursByDate[key] = (hoursByDate[key] || 0) + (l.liquid_seconds / 3600);
            });

            function intensityColor(hours) {
                if (hours <= 0) return 'var(--bg-input)';
                if (hours < 1) return 'rgba(16, 185, 129, 0.25)';
                if (hours < 2) return 'rgba(16, 185, 129, 0.5)';
                if (hours < 4) return 'rgba(16, 185, 129, 0.75)';
                return 'rgba(16, 185, 129, 1)';
            }

            let html = '<div style="display:flex; gap:4px;">';
            let cursor = new Date(startDate);
            while (cursor <= today) {
                html += '<div style="display:flex; flex-direction:column; gap:4px;">';
                for (let i = 0; i < 7; i++) {
                    const key = toLocalDateKey(cursor);
                    const isFuture = cursor > today;
                    const hours = hoursByDate[key] || 0;
                    const bg = isFuture ? 'transparent' : intensityColor(hours);
                    const title = isFuture ? '' : `${cursor.toLocaleDateString('pt-BR')}: ${hours.toFixed(1)}h`;
                    html += `<div title="${title}" style="width:12px; height:12px; border-radius:3px; background-color:${bg}; border:1px solid var(--border);"></div>`;
                    cursor.setDate(cursor.getDate() + 1);
                }
                html += '</div>';
            }
            html += '</div>';

            container.innerHTML = html;
        }

        // --- SUGESTÃO: SIMULADOS RASTREADOS SEPARADAMENTE ---
        let chartMockExamsInstance = null;

