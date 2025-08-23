# Gabarito Scanner — Protótipo (PWA simples)

Este é um protótipo de aplicativo web para **corrigir provas de múltipla escolha** usando a **câmera do celular** (iPhone / Android) sem instalar nada da App Store. Funciona como um **PWA** leve, rodando no **Safari** com acesso à câmera.

> ⚠️ É um protótipo educacional: robustez limitada. Para uso real, ajuste margens, detecção e layout do cartão-resposta.

## Como usar (passo a passo rápido)

1. **Publique os arquivos** em um serviço com HTTPS (ex.: GitHub Pages).  
2. No iPhone, **abra o link** no Safari e **Compartilhar → Adicionar à Tela de Início** para usar como app.  
3. Toque em **Ativar câmera** e **posicione a folha inteira** dentro do quadro, com boa luz.
4. Defina **número de questões**, **alternativas** (4 ou 5), cole o **gabarito oficial** (A,B,C,...) e **Salve**.
5. Toque **Escanear agora**. Veja acertos/erros.  
6. Toque **Exportar CSV** para baixar seus resultados e abrir no Numbers/Excel.

## Imprimir cartão-resposta

Use o botão **Imprimir Cartão-Resposta** (gera uma página de impressão A4).  
Dicas:
- Peça ao aluno para **preencher bem a bolha** da alternativa.
- Evite amassar a folha.
- Use **caneta ou lápis escuro**.

## Estrutura

- `index.html` — Interface e layout.
- `main.js` — Lógica de câmera + OpenCV.js + correção.
- (OpenCV.js) — Carregado do CDN oficial.

## Desenvolvimento local

Você pode testar localmente com um servidor simples (ex.: Live Server no VS Code). Para uso no iPhone com câmera, publique em HTTPS (GitHub Pages).

## GitHub Pages (resumo)

1. Crie um repositório, envie estes arquivos (`index.html`, `main.js`, `README.md`).  
2. Vá em **Settings → Pages → Build and deployment** e escolha **Deploy from branch**.  
3. Selecione a branch `main` e a pasta raiz. Salve.  
4. Aguarde o link do GitHub Pages e abra no iPhone (Safari).  
5. **Compartilhar → Adicionar à Tela de Início**.

## Ajustes finos (quando for evoluir)

- Tornar o cartão-resposta mais robusto, com **marcadores de canto mais largos** e uma **área de grade** com bordas nítidas.
- Calibrar margens em `analyzeSheet()` para combinar com seu layout impresso.
- Adicionar **QR Code** no cartão para identificar aluno/prova automaticamente.
- Tratar casos de **dupla marcação** (duas bolhas por questão).  
- Salvar/recuperar resultados via planilhas/API.

Boa correção! 🎓
