// ============================================================
// CAIXAS DE DIÁLOGO CUSTOMIZADAS (substituem alert()/confirm() nativos do navegador)
// ============================================================

let _resolveCustomAlert = null;
let _resolveCustomConfirm = null;

// Substituto de alert(): não bloqueia a execução (igual o nativo não bloquearia se não fosse aguardado),
// mas pode ser aguardado com "await" caso algum código precise esperar o usuário fechar antes de continuar.
function customAlert(message) {
    document.getElementById('custom-alert-message').innerText = message;
    document.getElementById('custom-alert-modal').classList.add('active');
    lucide.createIcons();
    focusDialogPrimaryButton('custom-alert-modal');
    return new Promise((resolve) => { _resolveCustomAlert = resolve; });
}

function closeCustomAlert() {
    document.getElementById('custom-alert-modal').classList.remove('active');
    if (_resolveCustomAlert) { _resolveCustomAlert(); _resolveCustomAlert = null; }
}

// Substituto de confirm(): retorna uma Promise<boolean> — use com "await" no lugar de "if (confirm(...))"
function customConfirm(message) {
    document.getElementById('custom-confirm-message').innerText = message;
    document.getElementById('custom-confirm-modal').classList.add('active');
    lucide.createIcons();
    focusDialogPrimaryButton('custom-confirm-modal');
    return new Promise((resolve) => { _resolveCustomConfirm = resolve; });
}

function resolveCustomConfirm(result) {
    document.getElementById('custom-confirm-modal').classList.remove('active');
    if (_resolveCustomConfirm) { _resolveCustomConfirm(result); _resolveCustomConfirm = null; }
}

// Foca o botão de ação principal assim que o diálogo abre, permitindo confirmar direto com Enter
function focusDialogPrimaryButton(modalId) {
    requestAnimationFrame(() => {
        const modal = document.getElementById(modalId);
        const primaryBtn = modal.querySelector('.custom-dialog-box .btn:not(.btn-secondary)');
        if (primaryBtn) primaryBtn.focus();
    });
}

// Atalhos de teclado: Esc cancela/fecha, Enter confirma — funciona com qualquer um dos dois diálogos aberto
document.addEventListener('keydown', (e) => {
    const alertOpen = document.getElementById('custom-alert-modal').classList.contains('active');
    const confirmOpen = document.getElementById('custom-confirm-modal').classList.contains('active');
    if (!alertOpen && !confirmOpen) return;

    if (e.key === 'Escape') {
        if (alertOpen) closeCustomAlert();
        if (confirmOpen) resolveCustomConfirm(false);
    } else if (e.key === 'Enter') {
        if (alertOpen) closeCustomAlert();
        if (confirmOpen) resolveCustomConfirm(true);
    }
});
