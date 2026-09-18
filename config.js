/*
  RADECT — CONFIGURAÇÃO DA COLEÇÃO

  1) Publique cada PDF no Google Drive.
  2) Em Compartilhar, use "Qualquer pessoa com o link" como Leitor.
  3) Copie apenas o ID do arquivo do Drive.
  4) Cole o ID em driveId.
  5) Para adicionar uma nova edição, duplique um bloco de edição.

  Exemplo de URL do Drive:
  https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view
  ID: 1AbCdEfGhIjKlMnOpQrStUvWxYz
*/

window.RADECT_SETTINGS = {
  // Cole aqui a URL do Cloudflare Worker depois de publicá-lo.
  // Exemplo: https://radect-drive-proxy.SEUNOME.workers.dev
  proxyBase: "https://SEU-WORKER.workers.dev"
};

window.RADECT_EDITIONS = [
  {
    id: "v1n1-2026",
    title: "RADECT — v.1, n.1",
    subtitle: "Revista Acadêmica da Disciplina Ensino de Ciência e Tecnologia",
    date: "ago.–set. 2026",

    // Substitua pelo ID do PDF do primeiro número no Google Drive.
    driveId: "1aDjNUaXIvs_voo4hQUNHQ4gfg2wqFpLy",

    description: "Primeiro número da RADECT.",
    default: true
  }

  /* EXEMPLO PARA O PRÓXIMO NÚMERO:
  ,{
    id: "v1n2-2026",
    title: "RADECT — v.1, n.2",
    subtitle: "Revista Acadêmica da Disciplina Ensino de Ciência e Tecnologia",
    date: "out.–nov. 2026",
    driveId: "ID_DO_SEGUNDO_PDF_NO_GOOGLE_DRIVE",
    description: "Segundo número da RADECT.",
    default: false
  }
  */
];
