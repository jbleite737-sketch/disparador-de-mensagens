# Validação da versão 1.0

- `npm test`: 14 testes passaram, zero falhas. Abrangem CSV/telefones, personalização, limites, exportação, persistência de mídia, rejeição de formatos, tokens da fila, pausa, reinício e resultados incertos.
- `npm run test:browser`: 14 verificações passaram no Chromium. Incluem XLSX real, deduplicação, campos personalizados, rascunho, fluxo de texto, pausa, relatório, destinatário incorreto, lista colada, renderização sem execução de HTML, foto persistida, foto + legenda em um único clique, ausência de exceções e layout estreito.
- A página de teste usa a política `script-src 'self'; object-src 'none'`, equivalente à restrição de scripts do manifesto. ExcelJS funciona como biblioteca local, sem CDN.
- `npm run package`: ZIPs gerados e reabertos com validação de CRC e verificação dos arquivos obrigatórios do manifesto.
- Código Python original não executado. Inspeção REA e leitura estática documentadas separadamente.

## Não validado neste ambiente

O Chromium gerenciado bloqueou `Extensions.loadUnpacked` por política administrativa. A política foi preservada. Os testes de navegador exercitam os arquivos reais de UI, background e content script, com fronteiras de APIs Chrome/IndexedDB do worker e WhatsApp simuladas. Isso não comprova o ciclo de vida real de um service worker MV3, nem compatibilidade com todas as versões da interface do WhatsApp.

Nenhuma conta de WhatsApp foi conectada; nenhuma mensagem real foi enviada. Faça a primeira validação no Chrome com um único número seu e uma imagem de teste. Confira destinatário, imagem, legenda e relatório antes de usar uma lista maior. Interrompa a campanha se aparecer um resultado incerto; a extensão não o repetirá automaticamente.

A versão distribuída envia uma foto por campanha, opcionalmente com legenda, ou texto sem foto. Não inclui vídeos, áudios, PDFs ou galerias.
