// ============================================================
// CADERNO DE ERROS
// ============================================================

        // As 4 causas possíveis, cada uma já com a ação sugerida — a causa não é só uma etiqueta,
        // ela já diz o que fazer a respeito.
        const ERROR_CAUSES = {
            conteudo:  { label: 'Não sabia o conteúdo',            action: 'Revisar a teoria desse tópico de novo.',                                  color: '#ef4444' },
            confusao:  { label: 'Confundi dois conceitos',          action: 'Fazer um quadro comparativo entre os dois conceitos.',                     color: '#f59e0b' },
            atencao:   { label: 'Não li com atenção',               action: 'Não é sobre conteúdo — treine ritmo e atenção na leitura do enunciado.',   color: '#0891b2' },
            pegadinha: { label: 'Caí numa pegadinha da banca',      action: 'Grave o padrão dessa armadilha específica pra reconhecer da próxima vez.', color: '#8b5cf6' }
        };

        function addManualError() {
            const what = document.getElementById('error-manual-what').value.trim();
            const rule = document.getElementById('error-manual-rule').value.trim();
            const cause = document.getElementById('error-manual-cause').value;
            const subjectId = document.getElementById('error-manual-subject-link').value || null;
            const questionsLink = document.getElementById('error-manual-questions-link').value.trim();
            const editId = document.getElementById('edit-error-id').value;

            if (!what || !rule) { customAlert("Preencha 'O que eu errei' e 'A regra certa'!"); return; }

            const subj = subjectId ? appState.subjects.find(s => s.id === subjectId) : null;

            if (editId) {
                // Modo Edição: atualiza o registro existente sem mexer em reincidência/timestamp/histórico de revisão
                const err = appState.error_notebook.find(e => e.id === editId);
                if (!err) { customAlert("Erro não encontrado (pode já ter sido excluído)."); cancelErrorEdit(); return; }
                err.subject_id = subjectId;
                err.snapshot_subject_name = subj ? subj.name : "Sem matéria vinculada";
                err.what_went_wrong = what;
                err.cause = cause;
                err.correct_rule = rule;
                err.questions_link = questionsLink || '';

                saveToDatabase();
                updateUI();
                populateErrorAuxSelects();
                cancelErrorEdit();
                customAlert("Erro atualizado com sucesso!");
                return;
            }

            // Reincidência é detectada automaticamente: se já existe erro na mesma matéria com a
            // mesma causa, esse novo registro já nasce marcado como reincidência
            const recurrenceCount = appState.error_notebook.filter(e => e.subject_id === subjectId && e.cause === cause && subjectId).length;

            const newError = {
                id: "err-" + Date.now(),
                timestamp: new Date().toISOString(),
                subject_id: subjectId,
                snapshot_subject_name: subj ? subj.name : "Sem matéria vinculada",
                what_went_wrong: what,
                cause: cause,
                correct_rule: rule,
                questions_link: questionsLink || '',
                recurrence_count: recurrenceCount,
                view_count: 0,
                last_viewed_at: null
            };

            appState.error_notebook.unshift(newError);
            saveToDatabase();
            updateUI();
            populateErrorAuxSelects();
            customAlert("Erro registrado no caderno!");

            document.getElementById('error-manual-what').value = "";
            document.getElementById('error-manual-rule').value = "";
            document.getElementById('error-manual-subject-link').value = "";
            document.getElementById('error-manual-questions-link').value = "";
            document.getElementById("error-manual-cause").selectedIndex = 0;
        }

        // Preenche o formulário com os dados de um erro já registrado, pra permitir corrigir ou
        // completar qualquer campo depois — inclusive adicionar o link do caderno de questões que
        // normalmente só fica pronto depois que o erro já foi registrado.
        function editErrorItem(errorId) {
            const err = appState.error_notebook.find(e => e.id === errorId);
            if (!err) return;

            document.getElementById('edit-error-id').value = err.id;
            document.getElementById('error-manual-subject-link').value = err.subject_id || "";
            document.getElementById('error-manual-what').value = err.what_went_wrong || "";
            document.getElementById('error-manual-rule').value = err.correct_rule || "";
            document.getElementById('error-manual-questions-link').value = err.questions_link || "";
            document.getElementById('error-manual-cause').value = err.cause || "conteudo";

            document.getElementById('error-form-title-context').innerHTML = `<i data-lucide="pencil" style="width:16px; height:16px; color: var(--warning);"></i> Editando erro: ${escapeHTML(err.what_went_wrong)}`;
            document.getElementById('btn-save-error').innerHTML = '<i data-lucide="check-circle"></i> Salvar Alterações';
            document.getElementById('btn-cancel-error-edit').style.display = 'inline-flex';

            document.getElementById('error-form-title-context').scrollIntoView({ behavior: 'smooth' });
            lucide.createIcons();
        }

        function cancelErrorEdit() {
            document.getElementById('edit-error-id').value = "";
            document.getElementById('error-manual-what').value = "";
            document.getElementById('error-manual-rule').value = "";
            document.getElementById('error-manual-subject-link').value = "";
            document.getElementById('error-manual-questions-link').value = "";
            document.getElementById("error-manual-cause").selectedIndex = 0;
            document.getElementById('error-form-title-context').innerHTML = '<i data-lucide="plus" style="width:16px; height:16px;"></i> Registrar Novo Erro (completo)';
            document.getElementById('btn-save-error').innerHTML = '<i data-lucide="save"></i> Gravar no Caderno de Erros';
            document.getElementById('btn-cancel-error-edit').style.display = 'none';
            lucide.createIcons();
        }

        // Classifica a causa de um erro que ainda não tinha sido classificado (ex: gerado automaticamente
        // pelo gatilho de baixo rendimento) — aparece como um mini-formulário direto no card
        function classifyErrorCause(errorId, cause) {
            const err = appState.error_notebook.find(e => e.id === errorId);
            if (!err) return;
            err.cause = cause;
            err.recurrence_count = appState.error_notebook.filter(e => e.subject_id === err.subject_id && e.cause === cause && e.id !== err.id && err.subject_id).length;
            saveToDatabase();
            renderErrorNotebook();
            renderErrorDashboard();
        }

        // --- MELHORIA 1: EXCLUSÃO UNITÁRIA DO CADERNO DE ERROS ---
        async function deleteErrorItem(errorId) {
            const confirmed = await customConfirm("Deseja realmente remover permanentemente este item do seu caderno de erros?");
            if (confirmed) {
                appState.error_notebook = appState.error_notebook.filter(err => err.id !== errorId);
                saveToDatabase();
                updateUI();
                populateErrorAuxSelects();
            }
        }

        // Filtro rápido por criticidade (chips Todos/Crítico/Atenção/Normal) e quais erros estão
        // expandidos na lista (por padrão todos ficam recolhidos, só mostrando o essencial)
        let currentErrorCriticalityFilter = 'all';
        let expandedErrorIds = new Set();

        function setErrorCriticalityFilter(value) {
            currentErrorCriticalityFilter = value;
            renderErrorNotebook();
        }

        function toggleErrorCardExpand(errorId) {
            if (expandedErrorIds.has(errorId)) {
                expandedErrorIds.delete(errorId);
            } else {
                expandedErrorIds.add(errorId);
            }
            renderErrorNotebook();
        }

        // Menu "⋮" de Editar/Excluir de cada erro — mesmo padrão de posicionamento (position:fixed
        // calculado via getBoundingClientRect) já usado no menu de ações dos tópicos no Cadastro
        function toggleErrorMenu(event, errorId) {
            event.stopPropagation();
            document.querySelectorAll('.topic-actions-menu.open').forEach(m => {
                if (m.id !== `error-menu-${errorId}`) m.classList.remove('open');
            });
            const menu = document.getElementById(`error-menu-${errorId}`);
            if (!menu) return;

            const isOpening = !menu.classList.contains('open');
            menu.classList.toggle('open');
            if (!isOpening) return;

            lucide.createIcons();
            const btnRect = event.currentTarget.getBoundingClientRect();
            const menuRect = menu.getBoundingClientRect();
            const margin = 8;

            let top = btnRect.bottom + 4;
            if (top + menuRect.height > window.innerHeight - margin) {
                top = btnRect.top - menuRect.height - 4;
            }
            top = Math.max(margin, Math.min(top, window.innerHeight - menuRect.height - margin));

            let left = btnRect.right - menuRect.width;
            left = Math.max(margin, Math.min(left, window.innerWidth - menuRect.width - margin));

            menu.style.top = `${top}px`;
            menu.style.left = `${left}px`;
        }

        document.addEventListener('click', () => {
            document.querySelectorAll('.topic-actions-menu.open').forEach(m => m.classList.remove('open'));
        });

        // Widget independente: salva só o link do caderno de questões, sem exigir preencher "o que
        // errei", causa ou regra certa — pensado pro fluxo real de "terminei a sessão, montei um
        // caderno só com as questões erradas, quero guardar o link rapidinho".
        function quickAddQuestionsLink() {
            const link = document.getElementById('quick-link-url').value.trim();
            const subjectId = document.getElementById('quick-link-subject').value || null;

            if (!link) { customAlert("Cole o link do caderno de questões primeiro."); return; }

            const subj = subjectId ? appState.subjects.find(s => s.id === subjectId) : null;

            const newError = {
                id: "err-link-" + Date.now(),
                timestamp: new Date().toISOString(),
                subject_id: subjectId,
                snapshot_subject_name: subj ? subj.name : "Sem matéria vinculada",
                what_went_wrong: "Revisão de questões erradas",
                cause: null,
                correct_rule: '',
                questions_link: link,
                recurrence_count: 0,
                view_count: 0,
                last_viewed_at: null
            };

            appState.error_notebook.unshift(newError);
            saveToDatabase();
            updateUI();
            populateErrorAuxSelects();

            document.getElementById('quick-link-url').value = '';
            document.getElementById('quick-link-subject').value = '';
            customAlert("Link salvo! Quando quiser, clique em Editar nesse item pra completar o que errou e a regra certa.");
        }

        // --- CADERNO DE ERROS: SELETORES AUXILIARES (MATÉRIA VINCULADA, REINCIDÊNCIA, FILTRO) ---
        function populateErrorAuxSelects() {
            const subjectLinkSelect = document.getElementById('error-manual-subject-link');
            const filterSubjectSelect = document.getElementById('error-filter-subject');
            const quickLinkSubjectSelect = document.getElementById('quick-link-subject');
            if (subjectLinkSelect) {
                const currentVal = subjectLinkSelect.value;
                subjectLinkSelect.innerHTML = '<option value="">Nenhuma / Não vincular</option>' +
                    appState.subjects.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('');
                subjectLinkSelect.value = currentVal;
            }
            if (filterSubjectSelect) {
                const currentVal = filterSubjectSelect.value;
                filterSubjectSelect.innerHTML = '<option value="">Todas</option>' +
                    appState.subjects.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('');
                filterSubjectSelect.value = currentVal;
            }
            if (quickLinkSubjectSelect) {
                const currentVal = quickLinkSubjectSelect.value;
                quickLinkSubjectSelect.innerHTML = '<option value="">Nenhuma</option>' +
                    appState.subjects.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('');
                quickLinkSubjectSelect.value = currentVal;
            }
        }

        // Criticidade: cruza o desempenho que gerou o erro com o peso da matéria vinculada
        function getErrorCriticality(err) {
            const subj = err.subject_id ? appState.subjects.find(s => s.id === err.subject_id) : null;
            const weight = subj ? (parseInt(subj.weight) || 1) : 1;

            if (err.trigger_percentage !== undefined && err.trigger_percentage !== null && err.trigger_percentage < 50) {
                return 'alta';
            }
            if (weight >= 3 && err.trigger_percentage !== undefined && err.trigger_percentage !== null && err.trigger_percentage < 80) {
                return 'alta';
            }
            if (weight >= 3 || (err.recurrence_count && err.recurrence_count > 0)) {
                return 'media';
            }
            return 'normal';
        }

        // Retorna o caderno de erros já filtrado/ordenado conforme os controles de busca ativos
        function getFilteredErrorNotebook() {
            const searchInput = document.getElementById('error-search-input');
            const subjectFilter = document.getElementById('error-filter-subject');
            const rootCauseFilter = document.getElementById('error-filter-root-cause');
            const unreviewedFilter = document.getElementById('error-filter-unreviewed');

            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const subjectId = subjectFilter ? subjectFilter.value : '';
            const rootCause = rootCauseFilter ? rootCauseFilter.value : '';
            const onlyUnreviewed = unreviewedFilter ? unreviewedFilter.checked : false;

            let list = appState.error_notebook.filter(err => {
                if (subjectId && err.subject_id !== subjectId) return false;
                if (rootCause) {
                    const causeVal = rootCause === 'null' ? null : rootCause;
                    if (err.cause !== causeVal) return false;
                }
                if (onlyUnreviewed && (err.view_count || 0) > 0) return false;
                if (currentErrorCriticalityFilter !== 'all' && getErrorCriticality(err) !== currentErrorCriticalityFilter) return false;
                if (searchTerm) {
                    const haystack = `${err.snapshot_subject_name} ${err.what_went_wrong} ${err.correct_rule}`.toLowerCase();
                    if (!haystack.includes(searchTerm)) return false;
                }
                return true;
            });

            const criticalityRank = { 'alta': 0, 'media': 1, 'normal': 2 };
            list.sort((a, b) => {
                const diff = criticalityRank[getErrorCriticality(a)] - criticalityRank[getErrorCriticality(b)];
                if (diff !== 0) return diff;
                return new Date(b.timestamp) - new Date(a.timestamp);
            });

            return list;
        }

        function markErrorAsReviewed(errorId) {
            const err = appState.error_notebook.find(e => e.id === errorId);
            if (err) {
                err.view_count = (err.view_count || 0) + 1;
                err.last_viewed_at = new Date().toISOString();
                saveToDatabase();
                renderErrorNotebook();
                renderErrorDashboard();
            }
        }

        function renderErrorNotebook() {
            const errorContainer = document.getElementById('error-notebook-container');
            if (!errorContainer) return;
            errorContainer.innerHTML = "";

            // Atualiza os chips de filtro rápido (estado ativo + contagem de cada criticidade)
            const chipsWrapper = document.getElementById('error-criticality-chips');
            if (chipsWrapper) {
                const counts = { alta: 0, media: 0, normal: 0 };
                appState.error_notebook.forEach(e => { counts[getErrorCriticality(e)]++; });
                chipsWrapper.querySelectorAll('.filter-chip').forEach(chip => {
                    const crit = chip.dataset.crit;
                    chip.classList.toggle('active', currentErrorCriticalityFilter === crit);
                    if (crit === 'alta') chip.innerText = `🔴 Crítico (${counts.alta})`;
                    if (crit === 'media') chip.innerText = `🟡 Atenção (${counts.media})`;
                    if (crit === 'normal') chip.innerText = `Normal (${counts.normal})`;
                    if (crit === 'all') chip.innerText = `Todos (${appState.error_notebook.length})`;
                });
            }

            const filteredList = getFilteredErrorNotebook();

            if (filteredList.length === 0) {
                errorContainer.innerHTML = `<div style="text-align: center; padding: 30px 20px;"><i data-lucide="search-x" style="width:28px; height:28px; color:var(--text-muted); opacity:0.4; margin-bottom:8px;"></i><p style="color: var(--text-muted); font-size: 14px; margin-top:8px;">Nenhum erro encontrado com os filtros atuais.</p></div>`;
                lucide.createIcons();
                return;
            }

            // Agrupa por matéria (mantendo a ordem de criticidade/data já definida em getFilteredErrorNotebook
            // dentro de cada grupo), pra facilitar escanear a lista quando ela cresce
            const groups = new Map();
            filteredList.forEach(err => {
                const key = err.subject_id || 'sem-materia';
                if (!groups.has(key)) groups.set(key, { name: err.snapshot_subject_name, items: [] });
                groups.get(key).items.push(err);
            });

            groups.forEach(group => {
                const groupHeader = document.createElement('div');
                groupHeader.style.cssText = "font-size:12px; font-weight:700; color:var(--accent-editorial); text-transform:uppercase; letter-spacing:0.3px; margin: 18px 0 8px; padding-bottom:6px; border-bottom: 1px solid var(--border);";
                groupHeader.innerText = `${group.name} (${group.items.length})`;
                errorContainer.appendChild(groupHeader);

                group.items.forEach(err => {
                    const criticality = getErrorCriticality(err);
                    const borderColor = criticality === 'alta' ? 'var(--danger)' : (criticality === 'media' ? 'var(--warning)' : 'var(--border)');
                    const criticalityBadge = criticality === 'alta' ? '<span class="badge badge-danger">Prioridade Crítica</span>' : (criticality === 'media' ? '<span class="badge badge-warning">Atenção</span>' : '');
                    const recurrenceBadge = err.recurrence_count > 0 ? `<span class="badge badge-warning">🔁 Reincidência (${err.recurrence_count}x)</span>` : '';
                    const reviewInfo = err.view_count > 0
                        ? `Revisado ${err.view_count}x • Última vez: ${new Date(err.last_viewed_at).toLocaleDateString('pt-BR')}`
                        : 'Nunca revisado desde o cadastro';

                    const causeInfo = err.cause ? ERROR_CAUSES[err.cause] : null;
                    const causeBlock = causeInfo
                        ? `<div style="display:flex; align-items:flex-start; gap:8px; background:var(--bg-input); border-radius:var(--radius-interactive); padding:10px 12px; margin-bottom:10px;">
                               <i data-lucide="lightbulb" style="width:14px; height:14px; color:${causeInfo.color}; flex-shrink:0; margin-top:2px;"></i>
                               <div><strong style="color:${causeInfo.color}; font-size:13px;">${causeInfo.label}</strong><br><small style="color:var(--text-muted);">${causeInfo.action}</small></div>
                           </div>`
                        : `<div style="background:var(--warning-alpha); border-radius:var(--radius-interactive); padding:10px 12px; margin-bottom:10px;">
                               <small style="color:var(--warning); font-weight:600; display:block; margin-bottom:6px;">Ainda não classificado — por que você errou?</small>
                               <div style="display:flex; flex-wrap:wrap; gap:6px;">
                                   ${Object.entries(ERROR_CAUSES).map(([key, c]) => `<button class="filter-chip" style="padding:4px 8px; background:var(--bg-card); font-size:11px;" onclick="classifyErrorCause('${err.id}','${key}')">${c.label}</button>`).join('')}
                               </div>
                           </div>`;

                    const isExpanded = expandedErrorIds.has(err.id);

                    const card = document.createElement('div');
                    card.className = "error-card-modern";
                    card.style.borderColor = borderColor;
                    card.innerHTML = `
                        <div style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; padding-right: 40px;" onclick="toggleErrorCardExpand('${err.id}')">
                            <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" style="width:16px; height:16px; flex-shrink:0; margin-top:3px; color:var(--text-muted);"></i>
                            <div style="flex:1; min-width:0;">
                                <p style="font-size:14px; font-weight:600; margin:0; ${isExpanded ? '' : 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'}">${escapeHTML(err.what_went_wrong)}</p>
                                <small style="color:var(--text-muted); font-size:11px;">${new Date(err.timestamp).toLocaleDateString()}${criticality === 'alta' ? ' • 🔴 Crítico' : (criticality === 'media' ? ' • 🟡 Atenção' : '')}${err.recurrence_count > 0 ? ` • 🔁 ${err.recurrence_count}x` : ''}</small>
                            </div>
                        </div>
                        <div style="position:absolute; top:14px; right:14px;">
                            <button class="filter-chip" style="padding:4px 8px; background: var(--bg-card); font-size:12px;" onclick="toggleErrorMenu(event, '${err.id}')" title="Mais ações"><i data-lucide="more-vertical" style="width:14px; height:14px;"></i></button>
                            <div id="error-menu-${err.id}" class="topic-actions-menu">
                                <button onclick="editErrorItem('${err.id}')"><i data-lucide="pencil" style="width:13px; height:13px;"></i> Editar</button>
                                <button onclick="deleteErrorItem('${err.id}')" style="color:var(--danger);"><i data-lucide="trash-2" style="width:13px; height:13px;"></i> Excluir</button>
                            </div>
                        </div>
                        ${isExpanded ? `
                        <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
                            ${causeBlock}
                            <div style="margin-bottom:10px; display:flex; flex-wrap:wrap; gap:6px;">
                                ${criticalityBadge}
                                ${recurrenceBadge}
                            </div>
                            <div style="border-left: 3px solid var(--success); padding-left: 10px;">
                                <small style="color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:0.3px;">A regra certa</small>
                                <p style="font-size:14px; white-space:pre-wrap; margin-top:2px;">${err.correct_rule ? escapeHTML(err.correct_rule) : '<span style="color:var(--text-muted);">Ainda não preenchida.</span>'}</p>
                            </div>
                            ${err.questions_link ? `<div style="margin-top:10px;"><a href="${escapeHTML(err.questions_link)}" target="_blank" rel="noopener" class="filter-chip topic-link-btn" style="display:inline-flex; padding: 6px 12px; background: var(--primary-alpha); text-decoration:none; font-size:12px;" onclick="event.stopPropagation();"><i data-lucide="link" style="width:12px; height:12px;"></i>&nbsp;Caderno de Questões deste erro</a></div>` : ''}
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top: 1px solid var(--border);">
                                <small style="color:var(--text-muted); font-size:11px;">${reviewInfo}</small>
                                <button class="filter-chip" style="padding: 4px 10px; background: var(--primary-alpha); color: var(--primary-text); font-size: 11px;" onclick="event.stopPropagation(); markErrorAsReviewed('${err.id}')"><i data-lucide="check" style="width:12px; height:12px; vertical-align:middle;"></i> Marcar como Revisado</button>
                            </div>
                        </div>` : ''}
                    `;
                    errorContainer.appendChild(card);
                });
            });
            lucide.createIcons();
        }

        // --- CADERNO DE ERROS: PAINEL DE ESTATÍSTICAS PRÓPRIO ---
        let chartErrorsRootCauseInstance = null;
        let chartErrorsMonthlyInstance = null;

        function renderErrorDashboard() {
            const totalEl = document.getElementById('stat-errors-total');
            if (!totalEl) return;

            const errors = appState.error_notebook;
            totalEl.innerText = errors.length;

            const totalRecurrences = errors.reduce((acc, e) => acc + (e.recurrence_count || 0), 0);
            document.getElementById('stat-errors-recurrences').innerText = totalRecurrences;

            const neverReviewed = errors.filter(e => (e.view_count || 0) === 0).length;
            document.getElementById('stat-errors-never-reviewed').innerText = neverReviewed;

            const bySubject = {};
            errors.forEach(e => { bySubject[e.snapshot_subject_name] = (bySubject[e.snapshot_subject_name] || 0) + 1; });
            const topSubjectEntry = Object.entries(bySubject).sort((a, b) => b[1] - a[1])[0];
            document.getElementById('stat-errors-top-subject').innerText = topSubjectEntry ? `${topSubjectEntry[0]} (${topSubjectEntry[1]})` : '--';

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const tickColor = isDark ? '#94a3b8' : '#64748b';
            const gridColor = isDark ? '#232b3f' : '#e2e8f0';

            const rootCauseMap = {};
            errors.forEach(e => {
                const label = e.cause ? ERROR_CAUSES[e.cause].label : "Não classificado";
                rootCauseMap[label] = (rootCauseMap[label] || 0) + 1;
            });
            const rootCauseCanvas = document.getElementById('canvas-errors-rootcause');
            if (rootCauseCanvas) {
                if (chartErrorsRootCauseInstance) chartErrorsRootCauseInstance.destroy();
                const rootCauseColors = ['#64748b', '#ef4444', '#f59e0b', '#0891b2', '#8b5cf6', '#22c55e'];
                const rootCauseLabels = Object.keys(rootCauseMap);
                chartErrorsRootCauseInstance = new Chart(rootCauseCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: rootCauseLabels,
                        datasets: [{
                            data: Object.values(rootCauseMap),
                            backgroundColor: rootCauseColors
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } }
                    }
                });

                const rootCauseLegendContainer = document.getElementById('rootcause-legend-container');
                if (rootCauseLegendContainer) {
                    rootCauseLegendContainer.innerHTML = rootCauseLabels.map((label, i) => {
                        const color = rootCauseColors[i % rootCauseColors.length];
                        return `<span style="display:flex; align-items:center; gap:6px; font-size:12px; color:${tickColor};"><span style="width:11px; height:11px; border-radius:3px; background:${color}; flex-shrink:0;"></span>${label}</span>`;
                    }).join('');
                }
            }

            const monthlyMap = {};
            errors.forEach(e => {
                const d = new Date(e.timestamp);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthlyMap[key] = (monthlyMap[key] || 0) + 1;
            });
            const sortedMonths = Object.keys(monthlyMap).sort();
            const monthlyCanvas = document.getElementById('canvas-errors-monthly');
            if (monthlyCanvas) {
                if (chartErrorsMonthlyInstance) chartErrorsMonthlyInstance.destroy();
                chartErrorsMonthlyInstance = new Chart(monthlyCanvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: sortedMonths,
                        datasets: [{
                            label: 'Novos erros',
                            data: sortedMonths.map(m => monthlyMap[m]),
                            backgroundColor: '#f59e0b'
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 } },
                            x: { grid: { display: false }, ticks: { color: tickColor } }
                        }
                    }
                });
            }
        }

        // --- CADERNO DE ERROS: MODO REVISÃO ATIVA (FLASHCARDS) ---
        let flashcardState = { list: [], index: 0, revealed: false, reviewedIds: new Set() };

        function openFlashcardMode() {
            const list = getFilteredErrorNotebook();
            if (list.length === 0) {
                customAlert("Nenhum erro encontrado com os filtros atuais para revisar.");
                return;
            }
            flashcardState = { list: list, index: 0, revealed: false, reviewedIds: new Set() };
            document.getElementById('flashcard-modal').style.display = 'flex';
            renderFlashcard();
        }

        function closeFlashcardMode() {
            document.getElementById('flashcard-modal').style.display = 'none';
        }

        function renderFlashcard() {
            const { list, index, revealed } = flashcardState;
            const err = list[index];
            const criticality = getErrorCriticality(err);
            const titleColor = criticality === 'alta' ? 'var(--danger)' : (criticality === 'media' ? 'var(--warning)' : 'var(--text-main)');
            const causeInfo = err.cause ? ERROR_CAUSES[err.cause] : null;
            document.getElementById('flashcard-progress').innerText = `${index + 1} / ${list.length}`;

            const contentEl = document.getElementById('flashcard-content');
            if (!revealed) {
                contentEl.innerHTML = `
                    <div style="text-align:center; padding: 30px 10px;">
                        <strong style="color:${titleColor}; display:block; margin-bottom: 10px;">${escapeHTML(err.snapshot_subject_name)}</strong>
                        <h3 style="margin-bottom: 10px;">${escapeHTML(err.what_went_wrong)}</h3>
                        <p style="margin-top: 20px; font-size: 13px; color: var(--text-muted);">Tente lembrar a regra certa antes de revelar.</p>
                    </div>
                `;
                document.getElementById('flashcard-reveal-btn').innerText = "Revelar Resposta";
            } else {
                contentEl.innerHTML = `
                    <div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <strong style="color:${titleColor};">${escapeHTML(err.snapshot_subject_name)}</strong>
                            <small style="color:var(--text-muted);">${new Date(err.timestamp).toLocaleDateString()}</small>
                        </div>
                        <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">${escapeHTML(err.what_went_wrong)}</p>
                        ${causeInfo ? `<div style="display:flex; align-items:flex-start; gap:8px; background:var(--bg-input); border-radius:var(--radius-interactive); padding:10px 12px; margin-bottom:14px;"><i data-lucide="lightbulb" style="width:14px; height:14px; color:${causeInfo.color}; flex-shrink:0; margin-top:2px;"></i><div><strong style="color:${causeInfo.color}; font-size:13px;">${causeInfo.label}</strong><br><small style="color:var(--text-muted);">${causeInfo.action}</small></div></div>` : ''}
                        <div style="border-left: 3px solid var(--success); padding-left: 10px;">
                            <small style="color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:0.3px;">A regra certa</small>
                            <p style="font-size:14px; white-space:pre-wrap; margin-top:2px;">${err.correct_rule ? escapeHTML(err.correct_rule) : '<span style="color:var(--text-muted);">Ainda não preenchida.</span>'}</p>
                        </div>
                        ${err.questions_link ? `<div style="margin-top:10px;"><a href="${escapeHTML(err.questions_link)}" target="_blank" rel="noopener" class="filter-chip topic-link-btn" style="display:inline-flex; padding: 6px 12px; background: var(--primary-alpha); text-decoration:none; font-size:12px;"><i data-lucide="link" style="width:12px; height:12px;"></i>&nbsp;Caderno de Questões deste erro</a></div>` : ''}
                    </div>
                `;
                document.getElementById('flashcard-reveal-btn').innerText = "Ocultar Resposta";
                if (!flashcardState.reviewedIds.has(err.id)) {
                    flashcardState.reviewedIds.add(err.id);
                    markErrorAsReviewed(err.id);
                }
            }
            lucide.createIcons();
        }

        function flashcardReveal() {
            flashcardState.revealed = !flashcardState.revealed;
            renderFlashcard();
        }

        function flashcardNext() {
            flashcardState.index = (flashcardState.index + 1) % flashcardState.list.length;
            flashcardState.revealed = false;
            renderFlashcard();
        }

        function flashcardPrev() {
            flashcardState.index = (flashcardState.index - 1 + flashcardState.list.length) % flashcardState.list.length;
            flashcardState.revealed = false;
            renderFlashcard();
        }

        // --- CADERNO DE ERROS: EXPORTAÇÃO EM PDF (VIA IMPRESSÃO DO NAVEGADOR) ---
        function exportErrorsToPrintablePDF() {
            const list = getFilteredErrorNotebook();
            if (list.length === 0) {
                customAlert("Nenhum erro encontrado com os filtros atuais para exportar.");
                return;
            }

            const printWindow = window.open('', '_blank');
            const rows = list.map(err => {
                const causeInfo = err.cause ? ERROR_CAUSES[err.cause] : null;
                return `
                <div style="border: 1px solid #ccc; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <strong>${escapeHTML(err.snapshot_subject_name)}</strong>
                        <span>${new Date(err.timestamp).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p style="font-size:13px; font-weight:bold; margin-bottom:6px;">${escapeHTML(err.what_went_wrong)}</p>
                    <div style="font-size:11px; color:#555; margin-bottom:8px;">Por que errei: ${causeInfo ? causeInfo.label : "Não classificado"}</div>
                    <p style="font-size:13px; white-space:pre-wrap;"><strong>Regra certa:</strong> ${err.correct_rule ? escapeHTML(err.correct_rule) : '-'}</p>
                </div>
            `;
            }).join('');

            printWindow.document.write(`
                <html>
                <head>
                    <title>Caderno de Erros - Exportação</title>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; color: #111; padding: 30px; }
                        h1 { font-size: 20px; margin-bottom: 4px; }
                        p.subtitle { color: #666; font-size: 12px; margin-bottom: 25px; }
                    </style>
                </head>
                <body>
                    <h1>Caderno de Erros Estratégico</h1>
                    <p class="subtitle">Exportado em ${new Date().toLocaleDateString('pt-BR')} • ${list.length} item(ns)</p>
                    ${rows}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.onload = function() {
                printWindow.focus();
                printWindow.print();
            };
        }

        // --- CORREÇÃO DE VALIDAÇÃO DE INPUTS ZERO/INCOERENTES ---
        // Sessão sem questões (só teoria): desabilita e limpa os campos de questões para deixar claro que não são necessários
