# RADECT — Google Drive + Cloudflare Worker + GitHub Pages + Moodle

## 1. Colocar o PDF no Google Drive

1. Faça upload do PDF.
2. Clique em **Compartilhar**.
3. Em **Acesso geral**, selecione **Qualquer pessoa com o link**.
4. Mantenha como **Leitor**.
5. Copie o link.

Exemplo:

`https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing`

O ID é o trecho entre `/d/` e `/view`:

`1AbCdEfGhIjKlMnOpQrStUvWxYz`

## 2. Publicar o Cloudflare Worker

A forma mais simples é pelo painel da Cloudflare:

1. Crie/acesse uma conta gratuita em Cloudflare.
2. Entre em **Workers & Pages**.
3. Crie um Worker.
4. Abra o editor do Worker.
5. Apague o código de exemplo.
6. Copie todo o conteúdo de `cloudflare-worker/worker.js`.
7. Faça o deploy.
8. A Cloudflare fornecerá uma URL semelhante a:

`https://radect-drive-proxy.SEUNOME.workers.dev`

Abra essa URL no navegador. Deve aparecer um JSON com `"ok": true`.

## 3. Configurar o leitor

Abra `config.js`.

Troque:

`proxyBase: "https://SEU-WORKER.workers.dev"`

pela URL real do Worker.

Depois troque:

`driveId: "COLE_AQUI_O_ID_DO_GOOGLE_DRIVE"`

pelo ID do PDF.

## 4. Testar o PDF pelo Worker

Abra:

`https://SEU-WORKER.workers.dev/pdf/ID_DO_ARQUIVO`

Se o arquivo estiver público e o ID estiver correto, o PDF deve abrir/ser entregue pelo navegador.

## 5. Publicar o leitor no GitHub Pages

Crie um repositório, por exemplo `radect-revista`, e envie para a raiz:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `.nojekyll`
- `README.md`
- `EMBED-MOODLE.html`

A pasta `cloudflare-worker` pode ficar no repositório como documentação/código-fonte, mas não é executada pelo GitHub Pages.

Em **Settings → Pages**:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**

## 6. Adicionar novos números

Para cada novo número:

1. envie o PDF ao Google Drive;
2. compartilhe como **Qualquer pessoa com o link**;
3. copie o ID;
4. duplique um bloco em `RADECT_EDITIONS` no `config.js`;
5. altere `id`, `title`, `date`, `driveId` e `description`;
6. deixe apenas uma edição com `default: true`.

Nenhum PDF precisa ser enviado ao GitHub.

## 7. Segurança e observações

- O Worker só aceita IDs do Google Drive; ele não funciona como proxy de URLs arbitrárias.
- Os PDFs precisam estar acessíveis publicamente por link para que estudantes sem login possam lê-los.
- O botão **PDF** do flipbook abre o arquivo original no Google Drive.
- Para retirar uma edição do ar, remova seu bloco do `config.js` ou altere o compartilhamento no Drive.
