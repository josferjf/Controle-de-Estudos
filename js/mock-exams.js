// ============================================================
// SIMULADOS
// ============================================================

        function addMockExam() {
            const name = document.getElementById('mock-exam-name').value.trim();
            const dateVal = document.getElementById('mock-exam-date').value;
            const hours = parseFloat(document.getElementById('mock-exam-hours').value) || 0;
            const totalQ = parseInt(document.getElementById('mock-exam-total-questions').value) || 0;
            const correctQ = parseInt(document.getElementById('mock-exam-correct').value) || 0;

            if (!name) { customAlert("Informe o nome/identificação do simulado."); return; }
            if (totalQ <= 0) { customAlert("Informe a quantidade total de questões do simulado."); return; }
            if (correctQ > totalQ) { customAlert("O número de acertos não pode superar o total de questões."); return; }

            appState.mock_exams.push({
                id: "mock-" + Date.now(),
                name: name,
                date: dateVal || toLocalDateKey(new Date()),
                hours_spent: hours,
                total_questions: totalQ,
                correct_questions: correctQ,
                performance_percentage: (correctQ / totalQ) * 100
            });

            saveToDatabase();
            document.getElementById('mock-exam-name').value = "";
            document.getElementById('mock-exam-date').value = "";
            document.getElementById('mock-exam-hours').value = "";
            document.getElementById('mock-exam-total-questions').value = "";
            document.getElementById('mock-exam-correct').value = "";

            renderMockExams();
            customAlert("Simulado registrado com sucesso!");
        }

        async function deleteMockExam(mockId) {
            const confirmed = await customConfirm("Deseja realmente excluir este simulado do histórico?");
            if (confirmed) {
                appState.mock_exams = appState.mock_exams.filter(m => m.id !== mockId);
                saveToDatabase();
                renderMockExams();
            }
        }

        function renderMockExams() {
            const tbody = document.getElementById('mock-exams-table-body');
            if (!tbody) return;
            tbody.innerHTML = "";
            const sorted = appState.mock_exams.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

            if (sorted.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 30px 20px;"><i data-lucide="clipboard-list" style="width:28px; height:28px; opacity:0.4; margin-bottom:8px;"></i><br>Nenhum simulado registrado ainda. Cadastre o primeiro no formulário acima.</td></tr>`;
                lucide.createIcons();
            }

            sorted.slice().reverse().forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.correct_questions}/${m.total_questions}</td>
                    <td><span class="badge ${m.performance_percentage >= (appState.user_configuration.target_score || 85) ? 'badge-success' : 'badge-danger'}">${m.performance_percentage.toFixed(1)}%</span></td>
                    <td>${m.hours_spent}h</td>
                    <td><button class="filter-chip" style="padding: 4px 8px; background: var(--danger-alpha); color: var(--danger); font-size: 11px;" onclick="deleteMockExam('${m.id}')"><i data-lucide="trash" style="width:12px; height:12px;"></i></button></td>
                `;
                tbody.appendChild(tr);
            });

            const ctxMock = document.getElementById('canvas-mock-exams');
            if (ctxMock) {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const tickColor = isDark ? '#94a3b8' : '#64748b';
                const gridColor = isDark ? '#232b3f' : '#e2e8f0';
                if (chartMockExamsInstance) chartMockExamsInstance.destroy();
                chartMockExamsInstance = new Chart(ctxMock.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: sorted.map(m => new Date(m.date + 'T00:00:00').toLocaleDateString('pt-BR')),
                        datasets: [{
                            label: 'Aproveitamento %',
                            data: sorted.map(m => m.performance_percentage),
                            borderColor: '#32d74b',
                            backgroundColor: 'rgba(50,215,75,0.15)',
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { labels: { color: tickColor } } },
                        scales: {
                            y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: tickColor } },
                            x: { grid: { display: false }, ticks: { color: tickColor } }
                        }
                    }
                });
            }
            lucide.createIcons();
        }

