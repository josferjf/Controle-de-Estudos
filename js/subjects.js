// ============================================================
// CADASTRO DE MATÉRIAS E TÓPICOS
// ============================================================

        function toggleSubjectTopicsExpanded(subjectId) {
            if (expandedSubjectIds.has(subjectId)) {
                expandedSubjectIds.delete(subjectId);
            } else {
                expandedSubjectIds.add(subjectId);
            }
            renderSubjectsList();
        }

        function toggleSubjectActive(subjectId) {
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            subj.isActive = !subj.isActive;
            regenerateSmartCycle(false);
            updateUI();
        }

        function moveSubject(subjectId, direction) {
            const idx = appState.subjects.findIndex(s => s.id === subjectId);
            const newIdx = idx + direction;
            if (idx === -1 || newIdx < 0 || newIdx >= appState.subjects.length) return;
            const arr = appState.subjects;
            [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
            regenerateSmartCycle(false);
            updateUI();
        }

        // Reordena um tópico/aula dentro da matéria — permite inserir uma aula nova e movê-la pra posição
        // desejada (ex: fazer a nova aula virar a "Aula 02"), já que a ordem de estudo segue a lista.
        function moveTopic(subjectId, topicId, direction) {
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            const idx = subj.topics.findIndex(t => t.id === topicId);
            const newIdx = idx + direction;
            if (idx === -1 || newIdx < 0 || newIdx >= subj.topics.length) return;
            [subj.topics[idx], subj.topics[newIdx]] = [subj.topics[newIdx], subj.topics[idx]];
            regenerateSmartCycle(false);
            updateUI();
        }

        // Abre/fecha o menu de ações de um tópico (mover, links, renomear, excluir), fechando qualquer
        // outro menu que já estivesse aberto
        function toggleTopicMenu(event, topicId) {
            event.stopPropagation();
            document.querySelectorAll('.topic-actions-menu.open').forEach(m => {
                if (m.id !== `topic-menu-${topicId}`) m.classList.remove('open');
            });
            const menu = document.getElementById(`topic-menu-${topicId}`);
            if (menu) {
                menu.classList.toggle('open');
                lucide.createIcons();
            }
        }

        document.addEventListener('click', () => {
            document.querySelectorAll('.topic-actions-menu.open').forEach(m => m.classList.remove('open'));
        });

        function toggleTopicCompleted(subjectId, topicId) {
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            const topic = subj.topics.find(t => t.id === topicId);
            if (!topic) return;
            topic.completed = !topic.completed;
            regenerateSmartCycle(false);
            updateUI();
        }

        async function renameTopic(subjectId, topicId) {
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            const topic = subj.topics.find(t => t.id === topicId);
            if (!topic) return;
            const newTitle = await customPrompt("Renomear tópico/aula:", topic.title);
            if (newTitle && newTitle.trim()) {
                topic.title = newTitle.trim();
                saveToDatabase();
                updateUI();
            }
        }

        // Adiciona ou edita o link do caderno de questões (site externo) vinculado a este tópico específico
        async function editTopicLink(subjectId, topicId) {
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            const topic = subj.topics.find(t => t.id === topicId);
            if (!topic) return;
            const newLink = await customPrompt("Cole o link do caderno de questões para este tópico (deixe em branco para remover):", topic.link || '');
            if (newLink === null) return; // cancelado
            topic.link = newLink.trim();
            saveToDatabase();
            regenerateSmartCycle(false);
            updateUI();
        }

        // Adiciona ou edita o link do material teórico (ex: Google Drive) vinculado a este tópico específico
        async function editTopicMaterialLink(subjectId, topicId) {
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            const topic = subj.topics.find(t => t.id === topicId);
            if (!topic) return;
            const newLink = await customPrompt("Cole o link do material teórico (ex: Google Drive) para este tópico (deixe em branco para remover):", topic.materialLink || '');
            if (newLink === null) return; // cancelado
            topic.materialLink = newLink.trim();
            saveToDatabase();
            regenerateSmartCycle(false);
            updateUI();
        }

        async function deleteTopic(subjectId, topicId) {
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            if (subj.topics.length <= 1) { customAlert("A matéria precisa ter pelo menos um tópico/aula."); return; }
            const confirmed = await customConfirm("Remover este tópico/aula permanentemente?");
            if (confirmed) {
                subj.topics = subj.topics.filter(t => t.id !== topicId);
                regenerateSmartCycle(false);
                updateUI();
            }
        }

        function addTopicToSubject(subjectId) {
            const input = document.getElementById(`new-topic-input-${subjectId}`);
            if (!input) return;
            const title = input.value.trim();
            if (!title) { customAlert("Digite o nome do novo tópico/aula."); return; }
            const subj = appState.subjects.find(s => s.id === subjectId);
            if (!subj) return;
            subj.topics.push({ id: `top-${Date.now()}`, title: title, completed: false, link: '', materialLink: '' });
            input.value = "";
            regenerateSmartCycle(false);
            updateUI();
        }

        function renderSubjectsList() {
            const configList = document.getElementById('config-subjects-list');
            if (!configList) return;
            configList.innerHTML = "";

            const totalEditalQuestions = appState.subjects.reduce((acc, s) => acc + (parseInt(s.expected_questions) || 0), 0);

            appState.subjects.forEach((s, idx) => {
                const div = document.createElement('div');
                div.className = "error-card-modern";
                div.style.borderColor = s.isStrategicReview ? "var(--warning)" : "var(--border)";
                if (!s.isActive) div.style.opacity = "0.6";

                const perf = getSubjectAveragePerformance(s.name);
                const isBoosted = perf !== null && perf < (appState.user_configuration.target_score || 85);
                const completedCount = s.topics.filter(t => t.completed).length;
                const progressPct = s.topics.length > 0 ? Math.round((completedCount / s.topics.length) * 100) : 0;
                const editalPct = totalEditalQuestions > 0 ? ((parseInt(s.expected_questions) || 0) / totalEditalQuestions * 100).toFixed(1) : "0.0";
                const isExpanded = expandedSubjectIds.has(s.id);

                const topicsHtml = s.topics.map((t, tIdx) => `
                    <div style="display:flex; align-items:center; gap:8px; padding: 6px 0; border-bottom: 1px solid var(--border);">
                        <input type="checkbox" style="width:auto; flex-shrink:0;" ${t.completed ? 'checked' : ''} onchange="toggleTopicCompleted('${s.id}','${t.id}')">
                        <span style="flex:1; font-size:13px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${t.completed ? 'color:var(--text-muted); text-decoration:line-through;' : ''}" title="${t.title.replace(/"/g, '&quot;')}">${t.title}</span>
                        <div style="position:relative; flex-shrink:0;">
                            <button class="filter-chip" style="padding:3px 8px; background: var(--bg-card); font-size:12px;" onclick="toggleTopicMenu(event, '${t.id}')" title="Mais ações"><i data-lucide="more-vertical" style="width:13px; height:13px;"></i></button>
                            <div id="topic-menu-${t.id}" class="topic-actions-menu">
                                <button onclick="moveTopic('${s.id}','${t.id}', -1)" ${tIdx === 0 ? 'disabled' : ''}><i data-lucide="chevron-up" style="width:13px; height:13px;"></i> Mover pra cima</button>
                                <button onclick="moveTopic('${s.id}','${t.id}', 1)" ${tIdx === s.topics.length - 1 ? 'disabled' : ''}><i data-lucide="chevron-down" style="width:13px; height:13px;"></i> Mover pra baixo</button>
                                <button onclick="editTopicLink('${s.id}','${t.id}')"><i data-lucide="link" style="width:13px; height:13px; ${t.link ? 'color:var(--primary);' : ''}"></i> ${t.link ? 'Editar' : 'Adicionar'} Caderno de Questões</button>
                                <button onclick="editTopicMaterialLink('${s.id}','${t.id}')"><i data-lucide="book-open" style="width:13px; height:13px; ${t.materialLink ? 'color:var(--primary);' : ''}"></i> ${t.materialLink ? 'Editar' : 'Adicionar'} Material Teórico</button>
                                <button onclick="renameTopic('${s.id}','${t.id}')"><i data-lucide="pencil" style="width:13px; height:13px;"></i> Renomear</button>
                                <button onclick="deleteTopic('${s.id}','${t.id}')" style="color:var(--danger);"><i data-lucide="x" style="width:13px; height:13px;"></i> Excluir</button>
                            </div>
                        </div>
                    </div>
                `).join('');

                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px;">
                        <div style="flex:1;">
                            <strong>${s.name}</strong> <span class="badge badge-purple">Peso ${s.weight}</span>
                            ${s.isStrategicReview ? '<span class="badge badge-warning">Revisão Estratégica Ativa</span>' : ''}
                            ${isBoosted ? '<span class="badge badge-danger">Prioridade elevada</span>' : ''}
                            ${!s.isActive ? '<span class="badge badge-purple">Pausada</span>' : ''}
                            <div style="margin-top:8px;">
                                <div class="progress-bar-container" style="margin-bottom:4px;"><div class="progress-bar" style="width:${progressPct}%;"></div></div>
                                <small style="color:var(--text-muted);">${completedCount}/${s.topics.length} Aulas Concluídas (${progressPct}%) • ${editalPct}% do edital (${s.expected_questions} questões)</small>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display:flex; gap:4px;">
                                <button class="filter-chip" style="padding: 4px 6px; background: var(--bg-card); font-size: 11px;" onclick="moveSubject('${s.id}', -1)" ${idx === 0 ? 'disabled' : ''}><i data-lucide="chevron-up" style="width:12px; height:12px;"></i></button>
                                <button class="filter-chip" style="padding: 4px 6px; background: var(--bg-card); font-size: 11px;" onclick="moveSubject('${s.id}', 1)" ${idx === appState.subjects.length - 1 ? 'disabled' : ''}><i data-lucide="chevron-down" style="width:12px; height:12px;"></i></button>
                            </div>
                            <div style="display:flex; gap:4px;">
                                <button class="filter-chip" style="padding: 4px 8px; background: var(--bg-card); font-size: 11px;" onclick="editSubject('${s.id}')"><i data-lucide="edit-2" style="width:12px; height:12px;"></i></button>
                                <button class="filter-chip" style="padding: 4px 8px; background: var(--danger-alpha); color: var(--danger); font-size: 11px;" onclick="deleteSubject('${s.id}')"><i data-lucide="trash" style="width:12px; height:12px;"></i></button>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:12px;">
                        <button class="filter-chip" style="padding: 5px 10px; background: var(--bg-card); font-size: 11px;" onclick="toggleSubjectActive('${s.id}')"><i data-lucide="${s.isActive ? 'pause' : 'play'}" style="width:12px; height:12px; vertical-align:middle;"></i> ${s.isActive ? 'Pausar' : 'Reativar'}</button>
                        <button class="filter-chip" style="padding: 5px 10px; background: var(--primary-alpha); color: var(--primary-text); font-size: 11px;" onclick="toggleSubjectTopicsExpanded('${s.id}')"><i data-lucide="${isExpanded ? 'chevron-up' : 'list'}" style="width:12px; height:12px; vertical-align:middle;"></i> ${isExpanded ? 'Ocultar Aulas' : 'Ver/Gerenciar Aulas'}</button>
                    </div>
                    ${isExpanded ? `
                        <div style="margin-top:12px; padding-top:12px; border-top: 1px solid var(--border);">
                            ${topicsHtml}
                            <div style="display:flex; gap:8px; margin-top:10px;">
                                <input type="text" id="new-topic-input-${s.id}" placeholder="Nova aula/tópico..." style="flex:1;">
                                <button class="btn" style="width:auto; padding: 8px 14px;" onclick="addTopicToSubject('${s.id}')"><i data-lucide="plus"></i></button>
                            </div>
                        </div>
                    ` : ''}
                `;
                configList.appendChild(div);
            });
            lucide.createIcons();
        }

        function addSubject() {
            const name = document.getElementById('subject-name').value.trim();
            const weight = parseInt(document.getElementById('subject-weight').value) || 1;
            const questions = parseInt(document.getElementById('subject-questions').value) || 10;
            const topicsText = document.getElementById('subject-topics').value.trim();
            const editId = document.getElementById('edit-subject-id').value;

            if(!name) { customAlert("Insira o nome da matéria."); return; }

            if (editId) {
                // Modo Edição: atualiza apenas nome/peso/questões. Os tópicos/aulas são gerenciados individualmente na lista abaixo.
                const subjectBeingEdited = appState.subjects.find(s => s.id === editId);
                const nameChanged = subjectBeingEdited && subjectBeingEdited.name !== name;

                appState.subjects = appState.subjects.map(s => {
                    if (s.id === editId) {
                        return { ...s, name, weight, expected_questions: questions };
                    }
                    return s;
                });

                // Corrige a desconexão do histórico: sessões e erros já registrados guardam o nome como estava na hora,
                // então sem isso o Diagnóstico de Desempenho e a priorização por matéria perdiam todo o histórico após um simples ajuste de nome
                if (nameChanged) {
                    appState.study_logs.forEach(l => { if (l.subject_id === editId) l.snapshot_subject_name = name; });
                    appState.error_notebook.forEach(err => { if (err.subject_id === editId) err.snapshot_subject_name = name; });
                }

                cancelSubjectEdit();
                customAlert("Matéria atualizada com sucesso!");
            } else {
                let topicsArr = [];
                if(topicsText) {
                    topicsArr = topicsText.split('\n').map((t, idx) => {
                        return { id: `top-${Date.now()}-${idx}`, title: t.trim(), completed: false, link: '', materialLink: '' };
                    });
                } else {
                    topicsArr = [{ id: `top-${Date.now()}-0`, title: "Aula Geral 00", completed: false, link: '', materialLink: '' }];
                }

                // Modo Inserção Nova
                appState.subjects.push({
                    id: "subj-" + Date.now(),
                    name: name,
                    weight: weight,
                    expected_questions: questions,
                    isActive: true,
                    isStrategicReview: false,
                    last_tudao_review_date: null,
                    topics: topicsArr
                });
                customAlert("Nova matéria adicionada ao ciclo com sucesso!");
            }

            document.getElementById('subject-name').value = "";
            document.getElementById('subject-topics').value = "";
            regenerateSmartCycle(true);
            updateUI();
        }

        function editSubject(subjectId) {
            const subject = appState.subjects.find(s => s.id === subjectId);
            if (!subject) return;

            document.getElementById('edit-subject-id').value = subject.id;
            document.getElementById('subject-name').value = subject.name;
            document.getElementById('subject-weight').value = subject.weight;
            document.getElementById('subject-questions').value = subject.expected_questions;

            const topicsGroup = document.getElementById('subject-topics-group');
            if (topicsGroup) topicsGroup.style.display = 'none';
            const editNotice = document.getElementById('subject-edit-topics-notice');
            if (editNotice) editNotice.style.display = 'block';

            document.getElementById('form-subject-title-context').innerHTML = `<span class="title-text" style="color: var(--warning);">Modo Edição: ${subject.name}</span>`;
            document.getElementById('btn-save-subject').innerHTML = '<i data-lucide="check-circle"></i> Atualizar Matéria';
            document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
            
            document.getElementById('form-subject-title-context').scrollIntoView({ behavior: 'smooth' });
            lucide.createIcons();
        }

        function cancelSubjectEdit() {
            document.getElementById('edit-subject-id').value = "";
            document.getElementById('subject-name').value = "";
            document.getElementById('subject-topics').value = "";
            const topicsGroup = document.getElementById('subject-topics-group');
            if (topicsGroup) topicsGroup.style.display = 'block';
            const editNotice = document.getElementById('subject-edit-topics-notice');
            if (editNotice) editNotice.style.display = 'none';
            document.getElementById('form-subject-title-context').innerHTML = '<span class="title-text">Nova Disciplina do Edital</span>';
            document.getElementById('btn-save-subject').innerHTML = '<i data-lucide="plus-circle"></i> Inserir Matéria no Ciclo';
            document.getElementById('btn-cancel-edit').style.display = 'none';
            lucide.createIcons();
        }

        async function deleteSubject(subjectId) {
            const confirmed = await customConfirm("ATENÇÃO: Remover esta disciplina excluirá todas as aulas e metas pendentes vinculadas a ela. Os logs históricos de estudo salvos serão preservados. Deseja continuar?");
            if (confirmed) {
                appState.subjects = appState.subjects.filter(s => s.id !== subjectId);
                cancelSubjectEdit();
                regenerateSmartCycle(true);
                updateUI();
            }
        }

