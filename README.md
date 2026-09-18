# RADECT — Flipbook com PDFs no Google Drive

Esta versão mantém os PDFs da revista no **Google Drive**. O **GitHub Pages** hospeda apenas o leitor (HTML/CSS/JavaScript) e um **Cloudflare Worker** gratuito funciona como ponte para o PDF.js ler o PDF do Drive com CORS.

## Arquitetura

Google Drive (PDFs) → Cloudflare Worker (ponte) → GitHub Pages (flipbook) → Moodle (iframe)

## Primeira configuração

1. Envie o PDF da RADECT ao Google Drive.
2. Compartilhe como **Qualquer pessoa com o link — Leitor**.
3. Copie o ID do arquivo do Drive.
4. Publique o Worker da pasta `cloudflare-worker/`.
5. Copie a URL `https://...workers.dev` para `RADECT_SETTINGS.proxyBase` em `config.js`.
6. Cole o ID do PDF em `driveId` da primeira edição.
7. Publique os arquivos da raiz deste pacote no GitHub Pages.
8. Use o `iframe` de `EMBED-MOODLE.html` no Moodle.

Leia `CONFIGURAR-PASSO-A-PASSO.md` para as instruções completas.
