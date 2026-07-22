// ============================================================
// AUTENTICAÇÃO (Firebase Authentication)
// ============================================================

function checkAuthState() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            showAppView();
            await runAppInitialization();
        } else {
            currentUserId = null;
            showLoginView();
        }
    });
}

function showLoginView() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('login-form-view').style.display = 'block';
    document.getElementById('signup-form-view').style.display = 'none';
    document.getElementById('forgot-password-view').style.display = 'none';
    document.getElementById('login-error-msg').style.display = 'none';
    document.getElementById('login-success-msg').style.display = 'none';
    lucide.createIcons();
}

function showSignupView() {
    document.getElementById('login-form-view').style.display = 'none';
    document.getElementById('signup-form-view').style.display = 'block';
    document.getElementById('forgot-password-view').style.display = 'none';
    document.getElementById('login-error-msg').style.display = 'none';
    document.getElementById('login-success-msg').style.display = 'none';
    lucide.createIcons();
}

function showForgotPasswordView() {
    document.getElementById('login-form-view').style.display = 'none';
    document.getElementById('signup-form-view').style.display = 'none';
    document.getElementById('forgot-password-view').style.display = 'block';
    document.getElementById('login-error-msg').style.display = 'none';
    document.getElementById('login-success-msg').style.display = 'none';
    lucide.createIcons();
}

function showAppView() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
}

function showLoginError(message) {
    document.getElementById('login-success-msg').style.display = 'none';
    const el = document.getElementById('login-error-msg');
    el.innerText = message;
    el.style.display = 'block';
}

function showLoginSuccess(message) {
    document.getElementById('login-error-msg').style.display = 'none';
    const el = document.getElementById('login-success-msg');
    el.innerText = message;
    el.style.display = 'block';
}

// Traduz os códigos de erro do Firebase Auth para mensagens compreensíveis
function translateAuthError(code) {
    const map = {
        'auth/invalid-email': 'E-mail inválido.',
        'auth/user-disabled': 'Esta conta foi desativada.',
        'auth/user-not-found': 'Não existe conta com esse e-mail.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar em vez de criar uma nova.',
        'auth/weak-password': 'Senha muito fraca — use pelo menos 6 caracteres.',
        'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
        'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.'
    };
    return map[code] || 'Não foi possível completar a operação. Tente novamente.';
}

function handleLoginSubmit() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showLoginError('Preencha e-mail e senha.');
        return;
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
        .catch((err) => {
            showLoginError(translateAuthError(err.code));
        });
    // Se der certo, o listener em checkAuthState() cuida de mostrar o app automaticamente
}

function handleSignupSubmit() {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-password-confirm').value;

    if (!email || !password || !confirmPassword) {
        showLoginError('Preencha todos os campos.');
        return;
    }
    if (password.length < 6) {
        showLoginError('A senha precisa ter pelo menos 6 caracteres.');
        return;
    }
    if (password !== confirmPassword) {
        showLoginError('As senhas não coincidem.');
        return;
    }

    firebase.auth().createUserWithEmailAndPassword(email, password)
        .catch((err) => {
            showLoginError(translateAuthError(err.code));
        });
    // Se der certo, o listener em checkAuthState() cuida de mostrar o app automaticamente
}

async function handleLogout() {
    const confirmed = await customConfirm('Deseja realmente sair?');
    if (!confirmed) return;
    firebase.auth().signOut();
}

function handleForgotPasswordSubmit() {
    const email = document.getElementById('forgot-password-email').value.trim();

    if (!email) {
        showLoginError('Informe o e-mail da sua conta.');
        return;
    }

    firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
            showLoginSuccess('Link de recuperação enviado! Confira sua caixa de entrada (e também o spam).');
        })
        .catch((err) => {
            showLoginError(translateAuthError(err.code));
        });
}
