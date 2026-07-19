# Guia de Publicação — Controle de Estudos na Nuvem

Siga esta ordem. Leva uns 15-20 minutos, é só uma vez.

---

## PARTE 1 — Criar o projeto no Firebase (gratuito)

1. Acesse **https://console.firebase.google.com** e entre com uma conta Google (crie uma se não tiver).
2. Clique em **"Criar um projeto"**.
3. Dê um nome (ex: "controle-de-estudos") e clique em **Continuar**.
4. Na tela do Google Analytics, pode **desativar** (não precisa) e clique em **Criar projeto**.
5. Aguarde a criação e clique em **Continuar**.

### 1.1 Ativar o Login por E-mail/Senha

1. No menu lateral esquerdo, clique em **Compilação → Authentication**.
2. Clique em **Vamos começar**.
3. Clique em **E-mail/senha** na lista de provedores.
4. Ative a primeira opção (E-mail/senha) e clique em **Salvar**.

### 1.2 Criar o Banco de Dados (Firestore)

1. No menu lateral, clique em **Compilação → Firestore Database**.
2. Clique em **Criar banco de dados**.
3. Escolha **"Iniciar no modo de produção"** e clique em **Avançar**.
4. Escolha a localização mais próxima de você (ex: `southamerica-east1` para o Brasil) e clique em **Ativar**.

### 1.3 Colar as Regras de Segurança

1. Ainda no Firestore Database, clique na aba **Regras** (no topo).
2. Apague todo o conteúdo que já estiver lá.
3. Abra o arquivo **`firestore.rules`** (está junto com os arquivos do site) e cole o conteúdo inteiro no lugar.
4. Clique em **Publicar**.

### 1.4 Pegar as Chaves de Configuração

1. Clique no ícone de engrenagem (⚙️) ao lado de "Visão geral do projeto", no topo do menu, e escolha **Configurações do projeto**.
2. Role até **"Seus aplicativos"** e clique no ícone **`</>`** (Web).
3. Dê um apelido (ex: "controle-estudos-web") e clique em **Registrar app**. **Não** marque a opção de Hosting.
4. Vai aparecer um bloco de código parecido com isto:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "controle-de-estudos-xxxx.firebaseapp.com",
  projectId: "controle-de-estudos-xxxx",
  storageBucket: "controle-de-estudos-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. Abra o arquivo **`js/firebase-config.js`** (dos arquivos do site) e substitua os valores `"COLE_AQUI_..."` pelos valores reais que apareceram na sua tela, um por um.
6. Salve o arquivo.

### 1.5 Ativar o Armazenamento de Arquivos (Storage) — necessário para os Resumos em PDF

1. No menu lateral, clique em **Compilação → Storage**.
2. Clique em **Começar**.
3. Escolha **"Iniciar no modo de produção"** e clique em **Avançar**.
4. Escolha a mesma localização que você usou no Firestore e clique em **Concluído**.
5. Clique na aba **Regras** (no topo).
6. Apague todo o conteúdo que já estiver lá.
7. Abra o arquivo **`storage.rules`** (está junto com os arquivos do site) e cole o conteúdo inteiro no lugar.
8. Clique em **Publicar**.

---

## PARTE 2 — Publicar o site no GitHub Pages (gratuito)

1. Acesse **https://github.com** e crie uma conta gratuita (se não tiver).
2. Clique no **+** no canto superior direito → **New repository**.
3. Dê um nome (ex: `controle-de-estudos`), marque como **Private** (só você acessa o código-fonte) ou **Public** (tanto faz para o funcionamento), e clique em **Create repository**.
4. Na página do repositório, clique em **"uploading an existing file"** (ou "Add file → Upload files").
5. Arraste **a pasta inteira `site`** (com tudo dentro: `index.html`, a pasta `css`, a pasta `js`) para a área de upload. Se o navegador não aceitar arrastar a pasta inteira, arraste o conteúdo de dentro dela (o `index.html` e as pastas `css`/`js`) direto para a raiz do repositório.
6. Role para baixo e clique em **Commit changes**.
7. Vá em **Settings** (aba do repositório) → **Pages** (menu lateral).
8. Em "Branch", escolha **main** e a pasta **/ (root)**, depois clique em **Save**.
9. Aguarde 1-2 minutos. Atualize a página — vai aparecer uma mensagem: **"Your site is live at https://SEU-USUARIO.github.io/controle-de-estudos/"**.

Essa é a URL do seu site, funcionando na nuvem, de graça, para sempre (dentro dos limites do plano gratuito, que são bem generosos para uso pessoal).

---

## PARTE 3 — Trazer seus dados que já existem hoje (opcional)

Se você já tem dados salvos na versão anterior (sem login) e não quer perdê-los:

1. Abra a versão **antiga** do site (a que já está usando).
2. Vá em **Backup/Dados → Gerar Arquivo .JSON** e salve o backup no computador.
3. Abra a **nova** versão (publicada no GitHub Pages), crie sua conta/faça login.
4. Vá em **Backup/Dados → Carregar Backup .JSON** e selecione o arquivo que você acabou de baixar.

Pronto — seus dados antigos estarão na nuvem, vinculados à sua conta.

---

## Testando antes de publicar (opcional)

Se quiser testar localmente antes de subir pro GitHub: depois de preencher o `firebase-config.js`, é só abrir o `index.html` direto no navegador (duplo clique) — funciona igual, já que não usamos nenhuma ferramenta que exija servidor.

## Dúvidas comuns

- **"Erro de permissão" ao salvar**: confira se colou as Regras de Segurança certinho (Parte 1.3) e clicou em Publicar.
- **Login não funciona**: confira se ativou "E-mail/senha" em Authentication (Parte 1.1).
- **Nada aparece / tela em branco**: abra o Console do navegador (F12) e veja se há alguma mensagem de erro em vermelho — geralmente indica algum valor errado no `firebase-config.js`.
