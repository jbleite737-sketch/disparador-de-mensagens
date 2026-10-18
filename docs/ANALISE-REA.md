# Análise do WabulkXpress e reconstrução para Chrome

## Evidência e escopo

O REA 6.5.0 executou `inspect-artifact` sobre `WabulkXpress-main.zip`, sem executar o programa original. Evidência integral: `rea-original.json`. SHA-256 do ZIP: `3abb6fc8c95f714d4d9190f98affaca3bccc4c0c72d3708eb813a9b4f8da0a4a`.

O inventário reconheceu o ZIP e concluiu a inspeção dos artefatos. A lógica Python foi analisada diretamente por leitura e AST; o REA não decompilou nem validou a execução do aplicativo Python. O README do arquivo é documentação de referência, não uma instrução para instalar componentes ou executar ações externas.

## Comportamento encontrado no código

Referências a `WabulkXpress-main/WabulkXpress.py`:

| Local | Observação |
|---|---|
| linhas 191–477, `selenium_send_bulk` | Abre Chrome via Selenium e navega para `web.whatsapp.com/send?phone=…`; escreve texto, aciona envio e aguarda indicadores visuais. |
| linhas 5219–5438, `load_excel_data` | Importa Excel/CSV e mapeia telefone, nome e campos personalizados. |
| linhas 5477–5656, `start_sending` | Monta mensagens por contato, configura intervalos e inicia uma thread de envio. |
| linhas 3973–4050, `generate_html_report` | Produz relatório de resultados. |

Dependências observadas incluem CustomTkinter, openpyxl, Selenium, pyautogui, Pillow e módulos específicos do Windows. A versão principal também possui anexos, agendamento e recursos de IA.

## Problemas identificados por leitura, sem reprodução do original

- `idx -= 1` dentro de `for enumerate(...)` não repete a iteração; a recuperação de falhas pode pular contatos e decrementar contadores indevidamente.
- A presença do último checkmark da conversa pode corresponder a uma mensagem antiga. Não prova a entrega da mensagem atual.
- Seletores por texto inglês e atalhos de teclado dependem de idioma e foco.
- A alegação de proteção “anti-ban” do README não é comprovada pelos intervalos aleatórios.

## Reconstrução independente: Contato Flow

O novo código foi escrito para Manifest V3, sem copiar o código Python, chaves, dados de licença ou ativos gráficos do ZIP. ExcelJS é distribuído localmente com sua licença MIT.

Implementado: XLSX/CSV/lista colada, uma foto JPG/PNG/WebP de até 5 MB por campanha, legenda personalizada de até 1.024 caracteres, seleção de aba e colunas, normalização de números, deduplicação, campos `{{nome}}` e campos da planilha, prévia, fila persistente, pausas entre lotes, atraso adaptado ao tempo de carregamento, relatório CSV, pausa/retomada e revisão de resultados incertos.

A mídia é armazenada no IndexedDB; apenas seus metadados integram o rascunho. O content script carrega a foto pelo input de arquivo da interface e preenche a legenda na prévia. Não há colagem de links para substituir o arquivo. O service worker coordena uma aba dedicada. A autorização de clique é vinculada a um token persistido e à aba. O content script verifica número visível ou identificador da conversa e o texto preenchido antes do clique; se não puder confirmar, pausa. Uma nova mensagem de saída observada após o clique é registrada como `submitted`, nunca como entrega ou leitura confirmada. Resultados incertos não são repetidos automaticamente.

A recuperação usa `chrome.storage.local` e `chrome.alarms`. Reiniciar o Chrome pausa a campanha. Alarmes podem atrasar quando o computador suspende; não há promessa de horário exato.

## Limites da versão

- Integração não oficial com a interface do WhatsApp Web, sujeita a mudanças. Sem APIs internas ou extração de contatos.
- Conversas cujos identificadores só usam LID e cujo cabeçalho não expõe o telefone podem não passar na confirmação do destinatário. A fila pausa em vez de adivinhar.
- WhatsApp real ainda não validado com conta conectada. O Chromium gerenciado proibiu carregar extensões locais; a política não foi alterada. Testes de navegador exercitam o código real com APIs de extensão e página WhatsApp simuladas, sem tráfego real de mensagens.
- Esta versão envia texto e uma foto por campanha, não inclui vídeos, áudios, PDFs ou galerias; não inclui IA, geração de imagens, envio por email/SMS ou agendamento por data. “Outros meios de contato” foi implementado como outras formas de importar contatos: CSV, células do Excel e lista colada.
- XLS antigo deve ser convertido para XLSX ou CSV. Até 5 MB, 100 colunas e 5.000 contatos por importação. Não abra planilhas de origem desconhecida.
- A extensão é entregue para instalação local; não foi publicada na Chrome Web Store.
