// ============================================================
// CADERNO DE ERROS
// ============================================================

        function addManualError() {
            const title = document.getElementById('error-manual-title').value.trim();
            const text = document.getElementById('error-manual-text').value.trim();
            const fileInput = document.getElementById('error-manual-image');
            const relatedErrorId = document.getElementById('error-manual-related').value;
            
            if (!title || !text) { customAlert("Preencha o título e o texto explicativo!"); return; }

            const newError = {
                id: "err-" + Date.now(),
                timestamp: new Date().toISOString(),
                snapshot_subject_name: title,
                snapshot_topic_title: "Inserção Manual / Resumo",
                error_type: document.getElementById("error-manual-type").value,
                subject_id: document.getElementById('error-manual-subject-link').value || null,
                root_cause: document.getElementById('error-manual-root-cause').value,
                related_error_id: relatedErrorId || null,
                recurrence_count: 0,
                view_count: 0,
                last_viewed_at: null,
                banca: document.getElementById('error-manual-banca').value.trim(),
                exam_year: document.getElementById('error-manual-exam-year').value.trim(),
                user_notes: text,
                imageDataUrl: ""
            };

            function finalizeErrorCreation() {
                appState.error_notebook.unshift(newError);
                if (relatedErrorId) {
                    const original = appState.error_notebook.find(e => e.id === relatedErrorId);
                    if (original) original.recurrence_count = (original.recurrence_count || 0) + 1;
                }
                saveToDatabase();
                updateUI();
                populateErrorAuxSelects();
            }

            if (fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    newError.imageDataUrl = e.target.result;
                    finalizeErrorCreation();
                    customAlert("Sucesso! Erro/Print adicionado com sucesso.");
                };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                finalizeErrorCreation();
                customAlert("Sucesso! Erro textual registrado.");
            }

            document.getElementById('error-manual-title').value = "";
            document.getElementById('error-manual-text').value = "";
            document.getElementById('error-manual-banca').value = "";
            document.getElementById('error-manual-exam-year').value = "";
            document.getElementById('error-manual-subject-link').value = "";
            document.getElementById('error-manual-related').value = "";
            fileInput.value = "";
            document.getElementById("error-manual-type").selectedIndex=0;
            document.getElementById("error-manual-root-cause").selectedIndex=0;
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

        // --- CADERNO DE ERROS: SELETORES AUXILIARES (MATÉRIA VINCULADA, REINCIDÊNCIA, FILTRO) ---
        function populateErrorAuxSelects() {
            const subjectLinkSelect = document.getElementById('error-manual-subject-link');
            const filterSubjectSelect = document.getElementById('error-filter-subject');
            if (subjectLinkSelect) {
                const currentVal = subjectLinkSelect.value;
                subjectLinkSelect.innerHTML = '<option value="">Nenhuma / Não vincular</option>' +
                    appState.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                subjectLinkSelect.value = currentVal;
            }
            if (filterSubjectSelect) {
                const currentVal = filterSubjectSelect.value;
                filterSubjectSelect.innerHTML = '<option value="">Todas</option>' +
                    appState.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                filterSubjectSelect.value = currentVal;
            }

            const relatedSelect = document.getElementById('error-manual-related');
            if (relatedSelect) {
                relatedSelect.innerHTML = '<option value="">Nenhum (erro novo)</option>' +
                    appState.error_notebook.map(e => `<option value="${e.id}">${e.snapshot_subject_name} - ${new Date(e.timestamp).toLocaleDateString('pt-BR')}</option>`).join('');
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
                if (rootCause && (err.root_cause || "Não Informado") !== rootCause) return false;
                if (onlyUnreviewed && (err.view_count || 0) > 0) return false;
                if (searchTerm) {
                    const haystack = `${err.snapshot_subject_name} ${err.snapshot_topic_title} ${err.user_notes} ${err.banca || ''} ${err.exam_year || ''} ${err.error_type || ''}`.toLowerCase();
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

            const filteredList = getFilteredErrorNotebook();

            if (filteredList.length === 0) {
                errorContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Nenhum erro encontrado com os filtros atuais.</p>`;
                return;
            }

            filteredList.forEach(err => {
                const criticality = getErrorCriticality(err);
                const borderColor = criticality === 'alta' ? 'var(--danger)' : (criticality === 'media' ? 'var(--warning)' : 'var(--border)');
                const criticalityBadge = criticality === 'alta' ? '<span class="badge badge-danger">Prioridade Crítica</span>' : (criticality === 'media' ? '<span class="badge badge-warning">Atenção</span>' : '');
                const recurrenceBadge = err.recurrence_count > 0 ? `<span class="badge badge-warning">🔁 Reincidência (${err.recurrence_count}x)</span>` : '';
                const reviewInfo = err.view_count > 0
                    ? `Revisado ${err.view_count}x • Última vez: ${new Date(err.last_viewed_at).toLocaleDateString('pt-BR')}`
                    : 'Nunca revisado desde o cadastro';

                const card = document.createElement('div');
                card.className = "error-card-modern";
                card.style.borderColor = borderColor;
                card.innerHTML = `
                    <button class="filter-chip" style="position: absolute; top: 14px; right: 14px; background: var(--danger-alpha); color: var(--danger); padding: 4px 8px; font-size: 11px;" onclick="deleteErrorItem('${err.id}')"><i data-lucide="trash-2" style="width:13px; height:13px; vertical-align: middle;"></i> Excluir</button>
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; padding-right: 70px;">
                        <strong style="color:var(--danger);">${err.snapshot_subject_name}</strong>
                        <small style="color:var(--text-muted);">${new Date(err.timestamp).toLocaleDateString()}</small>
                    </div>
                    <div style="color:var(--text-muted); font-size:12px; margin-bottom:4px;">Referência: ${err.snapshot_topic_title}</div>
                    <div style="margin-bottom:10px; display:flex; flex-wrap:wrap; gap:6px;">
                        <span class="badge badge-purple">${err.error_type||"Não informado"}</span>
                        <span class="badge badge-purple">${err.root_cause || "Não Informado"}</span>
                        ${err.banca ? `<span class="badge badge-purple">Banca: ${err.banca}</span>` : ''}
                        ${err.exam_year ? `<span class="badge badge-purple">Prova ${err.exam_year}</span>` : ''}
                        ${criticalityBadge}
                        ${recurrenceBadge}
                    </div>
                    <p style="font-size:14px; white-space:pre-wrap;">${err.user_notes}</p>
                    ${err.imageDataUrl ? `<div class="error-media-preview"><img src="${err.imageDataUrl}" class="error-img-render" onclick="window.open(this.src)"></div>` : ''}
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top: 1px solid var(--border);">
                        <small style="color:var(--text-muted); font-size:11px;">${reviewInfo}</small>
                        <button class="filter-chip" style="padding: 4px 10px; background: var(--primary-alpha); color: var(--primary-text); font-size: 11px;" onclick="markErrorAsReviewed('${err.id}')"><i data-lucide="check" style="width:12px; height:12px; vertical-align:middle;"></i> Marcar como Revisado</button>
                    </div>
                `;
                errorContainer.appendChild(card);
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
                const rc = e.root_cause || "Não Informado";
                rootCauseMap[rc] = (rootCauseMap[rc] || 0) + 1;
            });
            const rootCauseCanvas = document.getElementById('canvas-errors-rootcause');
            if (rootCauseCanvas) {
                if (chartErrorsRootCauseInstance) chartErrorsRootCauseInstance.destroy();
                chartErrorsRootCauseInstance = new Chart(rootCauseCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(rootCauseMap),
                        datasets: [{
                            data: Object.values(rootCauseMap),
                            backgroundColor: ['#64748b', '#ef4444', '#f59e0b', '#0891b2', '#8b5cf6', '#22c55e']
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } } }
                    }
                });
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
        let flashcardState = { list: [], index: 0, revealed: false };

        function openFlashcardMode() {
            const list = getFilteredErrorNotebook();
            if (list.length === 0) {
                customAlert("Nenhum erro encontrado com os filtros atuais para revisar.");
                return;
            }
            flashcardState = { list: list, index: 0, revealed: false };
            document.getElementById('flashcard-modal').style.display = 'flex';
            renderFlashcard();
        }

        function closeFlashcardMode() {
            document.getElementById('flashcard-modal').style.display = 'none';
        }

        function renderFlashcard() {
            const { list, index, revealed } = flashcardState;
            const err = list[index];
            document.getElementById('flashcard-progress').innerText = `${index + 1} / ${list.length}`;

            const contentEl = document.getElementById('flashcard-content');
            if (!revealed) {
                contentEl.innerHTML = `
                    <div style="text-align:center; padding: 30px 10px;">
                        <span class="badge badge-purple" style="margin-bottom: 15px; display:inline-block;">${err.error_type || "Não informado"}</span>
                        <h3 style="margin-bottom: 10px;">${err.snapshot_subject_name}</h3>
                        <p style="color: var(--text-muted); font-size: 13px;">${err.snapshot_topic_title}</p>
                        <p style="margin-top: 20px; font-size: 13px; color: var(--text-muted);">Tente lembrar o que você errou e por quê antes de revelar.</p>
                    </div>
                `;
                document.getElementById('flashcard-reveal-btn').innerText = "Revelar Resposta";
            } else {
                contentEl.innerHTML = `
                    <div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <strong style="color:var(--danger);">${err.snapshot_subject_name}</strong>
                            <small style="color:var(--text-muted);">${new Date(err.timestamp).toLocaleDateString()}</small>
                        </div>
                        <div style="margin-bottom:10px; display:flex; flex-wrap:wrap; gap:6px;">
                            <span class="badge badge-purple">${err.error_type||"Não informado"}</span>
                            <span class="badge badge-purple">${err.root_cause || "Não Informado"}</span>
                        </div>
                        <p style="font-size:14px; white-space:pre-wrap;">${err.user_notes}</p>
                        ${err.imageDataUrl ? `<div class="error-media-preview"><img src="${err.imageDataUrl}" class="error-img-render" onclick="window.open(this.src)"></div>` : ''}
                    </div>
                `;
                document.getElementById('flashcard-reveal-btn').innerText = "Ocultar Resposta";
                markErrorAsReviewed(err.id);
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
            const rows = list.map(err => `
                <div style="border: 1px solid #ccc; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <strong>${err.snapshot_subject_name}</strong>
                        <span>${new Date(err.timestamp).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div style="font-size:12px; color:#555; margin-bottom:4px;">Referência: ${err.snapshot_topic_title}</div>
                    <div style="font-size:11px; color:#555; margin-bottom:8px;">Tipo: ${err.error_type || "Não informado"} | Causa Raiz: ${err.root_cause || "Não Informado"} ${err.banca ? `| Banca: ${err.banca}` : ''} ${err.exam_year ? `| Prova ${err.exam_year}` : ''}</div>
                    <p style="font-size:13px; white-space:pre-wrap;">${err.user_notes}</p>
                </div>
            `).join('');

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
