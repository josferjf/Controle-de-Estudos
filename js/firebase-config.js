// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// Substitua os valores abaixo pelos que o Firebase te der ao criar o projeto
// (Configurações do Projeto → Geral → Seus apps → Configuração do SDK).
// Esses valores NÃO são secretos — é normal e seguro eles ficarem visíveis no código
// (quem protege seus dados de verdade são as Regras de Segurança do Firestore, configuradas
// separadamente no console do Firebase).

const firebaseConfig = {
   apiKey: "AIzaSyDgvD02uYo7dS7hTGXcvReztmQA3RPyA2w",
   authDomain: "controle-de-estudos-e89d8.firebaseapp.com",
   projectId: "controle-de-estudos-e89d8",
   storageBucket: "controle-de-estudos-e89d8.firebasestorage.app",
   messagingSenderId: "467389406939",
   appId: "1:467389406939:web:9e491583167675bc5e36fe"
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
