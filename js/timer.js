// ============================================================
// CRONÔMETRO & POMODORO
// ============================================================

        function setTimerMode(mode) {
            if (appState.timer_state.isRunning) return;
            appState.timer_state.mode = mode;
            document.querySelectorAll('.mode-chip').forEach(c => c.classList.remove('active'));
            document.querySelector(`.mode-chip[data-mode="${mode}"]`).classList.add('active');
            
            if (mode === 'pomodoro') {
                appState.timer_state.pomodoro_phase = 'focus';
                appState.timer_state.pomodoro_cycle_count = 0;
                appState.timer_state.total_focus_seconds_this_session = 0;
                appState.timer_state.seconds = POMODORO_FOCUS_SECONDS;
                appState.timer_state.accumulatedTime = POMODORO_FOCUS_SECONDS;
            } else {
                appState.timer_state.seconds = 0;
                appState.timer_state.accumulatedTime = 0;
            }
            document.getElementById('timer-display').innerText = formatTimeDisplay(appState.timer_state.seconds);
            updatePomodoroPhaseDisplay();
            saveToDatabase();
        }

        function updatePomodoroPhaseDisplay() {
            const el = document.getElementById('pomodoro-phase-label');
            if (!el) return;
            if (appState.timer_state.mode !== 'pomodoro') {
                el.style.display = 'none';
                return;
            }
            el.style.display = 'block';
            const phase = appState.timer_state.pomodoro_phase || 'focus';
            const cycleCount = appState.timer_state.pomodoro_cycle_count || 0;
            if (phase === 'focus') {
                el.innerText = `Foco • Bloco ${cycleCount + 1}`;
            } else if (phase === 'long_break') {
                el.innerText = `Pausa Longa (15 min)`;
            } else {
                el.innerText = `Pausa Curta (5 min)`;
            }
        }

        function toggleTimer() {
            const btn = document.getElementById('btn-timer-toggle');
            const status = document.getElementById('timer-status');
            
            if (appState.timer_state.isRunning) {
                // Pausa do cronômetro
                clearInterval(timerInterval);
                appState.timer_state.isRunning = false;
                
                if (appState.timer_state.mode === 'regular') {
                    appState.timer_state.accumulatedTime += (Date.now() - appState.timer_state.startTime) / 1000;
                } else {
                    appState.timer_state.accumulatedTime -= (Date.now() - appState.timer_state.startTime) / 1000;
                    if (appState.timer_state.accumulatedTime < 0) appState.timer_state.accumulatedTime = 0;
                }
                
                appState.timer_state.seconds = appState.timer_state.accumulatedTime;
                appState.timer_state.startTime = null;
                
                btn.innerHTML = '<i data-lucide="play"></i> Retomar Foco';
                status.innerText = "SESSÃO PAUSADA";
            } else {
                // Início do cronômetro
                appState.timer_state.isRunning = true;
                appState.timer_state.startTime = Date.now();
                
                btn.innerHTML = '<i data-lucide="pause"></i> Pausar Bloco';
                status.innerText = "PRODUZINDO HORAS LÍQUIDAS...";
                
                executeTimerLoop();
            }
            saveToDatabase();
            lucide.createIcons();
        }

        function executeTimerLoop() {
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                const delta = (Date.now() - appState.timer_state.startTime) / 1000;
                
                if (appState.timer_state.mode === 'regular') {
                    appState.timer_state.seconds = appState.timer_state.accumulatedTime + delta;
                    document.getElementById('timer-display').innerText = formatTimeDisplay(appState.timer_state.seconds);
                } else {
                    appState.timer_state.seconds = appState.timer_state.accumulatedTime - delta;
                    if (appState.timer_state.seconds <= 0) {
                        appState.timer_state.seconds = 0;
                        document.getElementById('timer-display').innerText = formatTimeDisplay(0);
                        handlePomodoroPhaseComplete();
                        return;
                    }
                    document.getElementById('timer-display').innerText = formatTimeDisplay(appState.timer_state.seconds);
                }
                
                // Backup suave em background a cada 10 segundos para mitigar perdas por falta de energia inesperada
                if (Math.floor(appState.timer_state.seconds) % 10 === 0) {
                    saveToDatabase();
                }
            }, 250);
        }

        // Alterna automaticamente entre bloco de foco (25 min) e pausa (5 min, ou 15 min a cada 4º bloco)
        function handlePomodoroPhaseComplete() {
            clearInterval(timerInterval);
            const phase = appState.timer_state.pomodoro_phase || 'focus';

            if (phase === 'focus') {
                appState.timer_state.total_focus_seconds_this_session = (appState.timer_state.total_focus_seconds_this_session || 0) + POMODORO_FOCUS_SECONDS;
                appState.timer_state.pomodoro_cycle_count = (appState.timer_state.pomodoro_cycle_count || 0) + 1;
                const isLongBreak = appState.timer_state.pomodoro_cycle_count % 4 === 0;
                appState.timer_state.pomodoro_phase = isLongBreak ? 'long_break' : 'short_break';
                const breakDuration = isLongBreak ? POMODORO_LONG_BREAK_SECONDS : POMODORO_SHORT_BREAK_SECONDS;
                appState.timer_state.seconds = breakDuration;
                appState.timer_state.accumulatedTime = breakDuration;
                appState.timer_state.startTime = Date.now();
                customAlert(`Bloco de foco concluído! Iniciando ${isLongBreak ? 'uma pausa longa (15 min)' : 'uma pausa curta (5 min)'}.`);
                executeTimerLoop();
            } else {
                appState.timer_state.pomodoro_phase = 'focus';
                appState.timer_state.seconds = POMODORO_FOCUS_SECONDS;
                appState.timer_state.accumulatedTime = POMODORO_FOCUS_SECONDS;
                appState.timer_state.isRunning = false;
                appState.timer_state.startTime = null;
                customAlert("Pausa concluída! Quando estiver pronto, inicie o próximo bloco de foco.");
                document.getElementById('btn-timer-toggle').innerHTML = '<i data-lucide="play"></i> Iniciar Sessão';
                document.getElementById('timer-status').innerText = "CRONÔMETRO PRONTO";
            }

            document.getElementById('timer-display').innerText = formatTimeDisplay(appState.timer_state.seconds);
            updatePomodoroPhaseDisplay();
            saveToDatabase();
            lucide.createIcons();
        }

        function restoreTimerState() {
            if (appState.timer_state && appState.timer_state.isRunning && appState.timer_state.startTime) {
                const delta = (Date.now() - appState.timer_state.startTime) / 1000;
                if (appState.timer_state.mode === 'regular') {
                    appState.timer_state.seconds = appState.timer_state.accumulatedTime + delta;
                } else {
                    appState.timer_state.seconds = appState.timer_state.accumulatedTime - delta;
                    if (appState.timer_state.seconds <= 0) {
                        // Encerra a fase pendente sem tentar recriar múltiplas pausas puladas enquanto o app estava fechado
                        appState.timer_state.isRunning = false;
                        appState.timer_state.startTime = null;
                        appState.timer_state.pomodoro_phase = 'focus';
                        appState.timer_state.seconds = POMODORO_FOCUS_SECONDS;
                        appState.timer_state.accumulatedTime = POMODORO_FOCUS_SECONDS;
                    }
                }
                
                if (appState.timer_state.isRunning) {
                    document.getElementById('btn-timer-toggle').innerHTML = '<i data-lucide="pause"></i> Pausar Bloco';
                    document.getElementById('timer-status').innerText = "PRODUZINDO HORAS LÍQUIDAS...";
                    executeTimerLoop();
                }
            } else if (appState.timer_state) {
                document.getElementById('timer-display').innerText = formatTimeDisplay(appState.timer_state.seconds);
                document.querySelectorAll('.mode-chip').forEach(c => c.classList.remove('active'));
                const modeChip = document.querySelector(`.mode-chip[data-mode="${appState.timer_state.mode}"]`);
                if (modeChip) modeChip.classList.add('active');
            }
            updatePomodoroPhaseDisplay();
        }

        function resetTimer() {
            clearInterval(timerInterval);
            appState.timer_state.isRunning = false;
            appState.timer_state.startTime = null;
            if (appState.timer_state.mode === 'pomodoro') {
                appState.timer_state.pomodoro_phase = 'focus';
                appState.timer_state.pomodoro_cycle_count = 0;
                appState.timer_state.total_focus_seconds_this_session = 0;
                appState.timer_state.seconds = POMODORO_FOCUS_SECONDS;
            } else {
                appState.timer_state.seconds = 0;
            }
            appState.timer_state.accumulatedTime = appState.timer_state.seconds;
            document.getElementById('timer-display').innerText = formatTimeDisplay(appState.timer_state.seconds);
            document.getElementById('btn-timer-toggle').innerHTML = '<i data-lucide="play"></i> Iniciar Sessão';
            document.getElementById('timer-status').innerText = "CRONÔMETRO PRONTO";
            updatePomodoroPhaseDisplay();
            saveToDatabase();
            lucide.createIcons();
        }

        // Pula o item atual do ciclo sem registrar sessão; ele permanece pendente e pode reaparecer depois
        async function skipCurrentCycleStep() {
            const currentStep = appState.study_cycle.steps_sequence[appState.study_cycle.current_step_index];
            if (!currentStep || currentStep.subjectId === "none") return;
            if (appState.timer_state.isRunning) {
                customAlert("Pause o cronômetro antes de pular este item.");
                return;
            }
            const confirmed = await customConfirm("Pular este item do ciclo sem registrar sessão? Ele continuará pendente e poderá aparecer novamente.");
            if (!confirmed) return;

            if (appState.study_cycle.current_step_index >= appState.study_cycle.steps_sequence.length - 1) {
                appState.study_cycle.current_step_index = 0;
            } else {
                appState.study_cycle.current_step_index++;
            }
            resetTimer();
            saveToDatabase();
            updateUI();
        }

        // Modo Foco Total: oculta cabeçalho e coluna lateral para reduzir distrações
