// ============================================================
// RESUMOS EM PDF (Firebase Storage para o arquivo + Firestore para os metadados)
// ============================================================

function populateSummarySubjectSelect() {
    const select = document.getElementById('summary-subject-select');
    const filterSelect = document.getElementById('summary-filter-subject');
    const options = '<option value="">Nenhuma / Não vincular</option>' +
        appState.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    if (select) {
        const currentVal = select.value;
        select.innerHTML = options;
        select.value = currentVal;
    }
    if (filterSelect) {
        const currentFilterVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Todas as matérias</option>' +
            appState.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        filterSelect.value = currentFilterVal;
    }
}

function uploadSummaryPDF() {
    const fileInput = document.getElementById('summary-file-input');
    const titleInput = document.getElementById('summary-title-input');
    const subjectSelect = document.getElementById('summary-subject-select');
    const file = fileInput.files[0];

    if (!file) { alert("Selecione um arquivo PDF para enviar."); return; }
    if (file.type !== 'application/pdf') { alert("Só é possível enviar arquivos no formato PDF."); return; }

    const maxSizeBytes = 15 * 1024 * 1024; // 15 MB de limite de segurança por arquivo
    if (file.size > maxSizeBytes) {
        alert(`Este arquivo tem ${(file.size / (1024*1024)).toFixed(1)} MB. O limite por resumo é 15 MB.`);
        return;
    }

    const title = titleInput.value.trim() || file.name.replace(/\.pdf$/i, '');
    const subjectId = subjectSelect.value || null;
    const subjectName = subjectId ? (appState.subjects.find(s => s.id === subjectId) || {}).name || '' : '';
    const summaryId = "summary-" + Date.now();
    const storagePath = `users/${currentUserId}/summaries/${summaryId}.pdf`;

    const progressEl = document.getElementById('summary-upload-progress');
    const progressBarEl = document.getElementById('summary-upload-progress-bar');
    progressEl.style.display = 'block';
    progressBarEl.style.width = '0%';

    const uploadTask = firebase.storage().ref(storagePath).put(file);

    uploadTask.on('state_changed',
        (snapshot) => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            progressBarEl.style.width = `${pct}%`;
        },
        (error) => {
            console.error('Erro no upload do resumo:', error);
            alert("Não foi possível enviar o arquivo. Verifique sua internet e tente novamente.");
            progressEl.style.display = 'none';
        },
        async () => {
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            appState.summaries.unshift({
                id: summaryId,
                subjectId: subjectId,
                subjectName: subjectName,
                title: title,
                fileName: file.name,
                storagePath: storagePath,
                downloadURL: downloadURL,
                fileSizeBytes: file.size,
                uploadedAt: new Date().toISOString()
            });
            saveToDatabase();

            fileInput.value = "";
            titleInput.value = "";
            subjectSelect.value = "";
            progressEl.style.display = 'none';

            renderSummariesList();
            alert("Resumo enviado com sucesso!");
        }
    );
}

function deleteSummary(summaryId) {
    const summary = appState.summaries.find(s => s.id === summaryId);
    if (!summary) return;
    if (!confirm(`Excluir permanentemente o resumo "${summary.title}"? Essa ação não pode ser desfeita.`)) return;

    firebase.storage().ref(summary.storagePath).delete()
        .catch((err) => console.warn('Arquivo já não existia no Storage ou não pôde ser removido:', err))
        .finally(() => {
            appState.summaries = appState.summaries.filter(s => s.id !== summaryId);
            saveToDatabase();
            renderSummariesList();
        });
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSummariesList() {
    const container = document.getElementById('summaries-list-container');
    if (!container) return;

    const searchInput = document.getElementById('summary-search-input');
    const filterSelect = document.getElementById('summary-filter-subject');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filterSubjectId = filterSelect ? filterSelect.value : '';

    let list = appState.summaries.slice();
    if (filterSubjectId) list = list.filter(s => s.subjectId === filterSubjectId);
    if (searchTerm) list = list.filter(s => `${s.title} ${s.subjectName} ${s.fileName}`.toLowerCase().includes(searchTerm));

    container.innerHTML = "";
    if (list.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">Nenhum resumo encontrado.</p>`;
        return;
    }

    list.forEach(summary => {
        const card = document.createElement('div');
        card.className = "error-card-modern";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; gap:10px;">
                <div>
                    <strong>${summary.title}</strong>
                    ${summary.subjectName ? `<span class="badge badge-purple" style="margin-left:6px;">${summary.subjectName}</span>` : ''}
                    <br><small style="color:var(--text-muted);">${summary.fileName} • ${formatFileSize(summary.fileSizeBytes)} • ${new Date(summary.uploadedAt).toLocaleDateString('pt-BR')}</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <a href="${summary.downloadURL}" target="_blank" rel="noopener" class="filter-chip" style="padding: 4px 8px; background: var(--primary-alpha); color: var(--primary); font-size: 11px; text-decoration:none;"><i data-lucide="eye" style="width:12px; height:12px;"></i> Abrir</a>
                    <button class="filter-chip" style="padding: 4px 8px; background: var(--danger-alpha); color: var(--danger); font-size: 11px;" onclick="deleteSummary('${summary.id}')"><i data-lucide="trash-2" style="width:12px; height:12px;"></i></button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
}
