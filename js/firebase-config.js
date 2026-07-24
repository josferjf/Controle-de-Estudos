// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// Substitua os valores abaixo pelos que o Firebase te der ao criar o projeto
// (Configurações do Projeto → Geral → Seus apps → Configuração do SDK).
// Esses valores NÃO são secretos — é normal e seguro eles ficarem visíveis no código
// (quem protege seus dados de verdade são as Regras de Segurança do Firestore, configuradas
// separadamente no console do Firebase).

const firebaseConfig = {
    apiKey: "COLE_AQUI_SUA_API_KEY",
    authDomain: "COLE_AQUI_SEU_PROJETO.firebaseapp.com",
    projectId: "COLE_AQUI_SEU_PROJECT_ID",
    storageBucket: "COLE_AQUI_SEU_PROJETO.appspot.com",
    messagingSenderId: "COLE_AQUI_SEU_SENDER_ID",
    appId: "COLE_AQUI_SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// Ativa o cache local automático do Firestore: mesmo sem internet, o app continua funcionando
// normalmente e sincroniza sozinho assim que a conexão voltar.
firebase.firestore().enablePersistence().catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistência offline não pôde ser ativada: o site está aberto em mais de uma aba ao mesmo tempo.');
    } else if (err.code === 'unimplemented') {
        console.warn('Este navegador não suporta persistência offline do Firestore.');
    }
});
