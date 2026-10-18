# Contato Flow — extensão Chrome

Extensão local para importar contatos e organizar uma fila de mensagens de texto e fotos no WhatsApp Web. Construída a partir da análise funcional do WabulkXpress, com código independente.

## Instalar o ZIP

1. Extraia `Contato-Flow-Chrome.zip` em uma pasta permanente.
2. No Chrome, abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique **Carregar sem compactação** e selecione a pasta `Contato-Flow-Chrome` que contém `manifest.json`.
5. Fixe a extensão na barra do Chrome e clique no ícone para abrir o painel.

Não é necessário Python, Node.js ou REA para usar o ZIP pronto. O ZIP não instala por duplo clique e não é uma extensão assinada pela Chrome Web Store.

## Usar

1. Abra o WhatsApp Web e conecte sua conta por QR code, se necessário.
2. No painel, escolha um arquivo **.xlsx ou .csv**, ou cole uma lista. Na planilha, use a primeira linha como cabeçalho. Selecione a aba e as colunas de telefone/nome e clique **Importar contatos**.
3. Prefira números como texto com DDI, por exemplo `+5511999999999`. No modo Brasil, telefones de 10 ou 11 dígitos recebem `55`. O modo internacional exige DDI já informado.
4. Escreva a mensagem, usando `{{nome}}`, `{{telefone}}` e outras colunas, como `{{empresa}}`. Confira as prévias com as setas.
5. Opcionalmente, em **Adicionar foto**, escolha JPG, PNG ou WebP de até 5 MB. A mesma foto será usada na campanha, com o texto personalizado como legenda (até 1.024 caracteres). Também é possível enviar a foto sem legenda.
6. Configure os intervalos e a pausa entre lotes. O mínimo é 30 segundos. O tempo de carregamento da conversa pode aumentar o intervalo. Esses intervalos não garantem evitar restrições do WhatsApp.
7. Confirme a autorização dos contatos, clique **Iniciar campanha** e revise o resumo. Uma aba dedicada do WhatsApp será aberta. Não mude de conversa nem digite nessa aba enquanto a fila estiver ativa.
8. Use **Pausar fila** ou **Retomar fila**. Um envio já acionado pode terminar mesmo após pausar. Fechar o painel não interrompe a fila; fechar a aba do WhatsApp pausa a operação. Não feche o Chrome nem suspenda o computador para continuar enviando.
9. Exporte o relatório CSV. Para apagar a campanha e seus dados, pause, aguarde a operação atual e use **Nova campanha**.

A aba do WhatsApp é ativada a cada contato. Use um perfil separado do Chrome se não quiser que isso interfira em outras atividades.

## Como ler os resultados

- **Pendente:** ainda não tentada.
- **Abrindo / Enviando:** operação em andamento.
- **Submetida:** uma nova mensagem de saída foi observada; não confirma entrega ou leitura.
- **Erro:** não houve clique de envio pelo adaptador ou a preparação falhou. A fila pausa; ao retomar, contatos com erro ficam excluídos, e os pendentes continuam.
- **Incerta:** pode ter ocorrido envio, mas não foi possível confirmar. Confira a conversa, depois clique **Já conferi os envios incertos**. A extensão não reenviará esses contatos.
- **Revisada:** resultado incerto conferido manualmente, excluído de novas tentativas.

Se a identidade do destinatário não puder ser confirmada, ou se a interface mudar, a fila pausa. Nunca transforme erro ou resultado incerto em “enviado” só para avançar. O relatório preserva esses estados.

## Dados e permissões

A lista, mensagem e resultados ficam em `chrome.storage.local`; a foto fica no IndexedDB local, sem servidor próprio e sem telemetria. O WhatsApp recebe o número, o texto e a foto das mensagens submetidas. As URLs de abertura também contêm número/texto e podem constar no histórico do navegador; apagar a campanha não limpa esse histórico nem as mensagens do WhatsApp.

Permissões: `storage` para persistência, `alarms` para a fila e acesso apenas a `https://web.whatsapp.com/*` para operar sua interface. Não solicita acesso a todos os sites. Bibliotecas são locais, sem código remoto. Dados locais não são criptografados pela extensão.

## Validação e limites

O núcleo, a mídia e a fila possuem testes automatizados. A interface, o background e o content script foram exercitados no Chromium com APIs Chrome e WhatsApp simulados, sem envio real. O Chromium deste ambiente proíbe extensões locais por política administrativa, por isso não foi possível validar a extensão carregada de fato neste ambiente. A interface real do WhatsApp e os diferentes tipos de conversa ainda precisam de teste com um número seu. Conversas com identificadores LID, sem telefone verificável na página, são recusadas pelo adaptador.

A versão 1.0 envia **texto ou uma foto JPG/PNG/WebP por campanha**, com legenda opcional. Não inclui vídeo, áudio, PDF, galerias, fotos diferentes por contato, email/SMS, IA ou agendamento por data. Para planilhas .xls, salve como .xlsx. A extensão não é afiliada ao WhatsApp/Meta e não foi publicada na loja.

## Desenvolvimento

Node.js 24 e npm. Na raiz:

```sh
npm ci
npm run build
npm test
npm run test:browser
npm run package
```

O teste de navegador usa `/usr/bin/chromium`. Ele simula as APIs Chrome e o armazenamento de mídia do worker, intercepta o domínio WhatsApp e responde com HTML local. Não conecte uma conta real nesse perfil de teste.

Arquivos: `extension/` (produto), `tests/` (testes), `docs/ANALISE-REA.md` (análise), `docs/rea-original.json` (evidência REA).
