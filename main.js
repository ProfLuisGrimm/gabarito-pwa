// Gabarito Scanner - Protótipo com OpenCV.js
// Funciona em Safari (iPhone) e outros navegadores modernos.
// Fluxo: getUserMedia -> captura frame -> OpenCV encontra folha -> warp -> analisa células -> compara com gabarito.

let video, canvas, ctx, statusEl, resultsEl, btnScan, btnStart, btnCSV;
let numQuestionsEl, numChoicesEl, thresholdEl, answerKeyEl, studentIdEl;

let cvReady = false;
let scanHistory = []; // guarda resultados para exportar CSV

document.addEventListener('DOMContentLoaded', () => {
  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  statusEl = document.getElementById('status');
  resultsEl = document.getElementById('results');
  btnScan = document.getElementById('btnScan');
  btnStart = document.getElementById('btnStart');
  btnCSV = document.getElementById('btnCSV');
  numQuestionsEl = document.getElementById('numQuestions');
  numChoicesEl = document.getElementById('numChoices');
  thresholdEl = document.getElementById('threshold');
  answerKeyEl = document.getElementById('answerKey');
  studentIdEl = document.getElementById('studentId');

  // restaura gabarito salvo
  const savedKey = localStorage.getItem('gabarito_oficial');
  if (savedKey) answerKeyEl.value = savedKey;

  document.getElementById('btnSaveKey').onclick = () => {
    localStorage.setItem('gabarito_oficial', answerKeyEl.value.trim());
    toast('Gabarito salvo no aparelho.');
  };

  document.getElementById('btnHelp').onclick = showHelp;
  document.getElementById('btnPrintSheet').onclick = printSheet;
  document.getElementById('btnCSV').onclick = exportCSV;

  btnStart.onclick = startCamera;
  btnScan.onclick = handleScan;

  // OpenCV carrega de forma assíncrona; aguardamos o runtime
  const checkCv = setInterval(() => {
    if (typeof cv !== 'undefined' && cv['onRuntimeInitialized']) {
      cv['onRuntimeInitialized'] = () => {
        cvReady = true;
        setStatus('OpenCV pronto. Ative a câmera.', 'success');
        clearInterval(checkCv);
      };
    }
  }, 100);
});

function setStatus(msg, cls='') {
  statusEl.textContent = msg;
  statusEl.className = `hint ${cls}`;
}

function toast(msg) {
  setStatus(msg, 'success');
  setTimeout(() => setStatus(''), 2000);
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    btnScan.disabled = false;
    setStatus('Câmera ativa. Posicione a folha com boa luz e toda no quadro.', 'success');
  } catch (err) {
    console.error(err);
    setStatus('Erro ao acessar a câmera. Verifique permissões no Safari.', 'fail');
  }
}

function getAnswerArray() {
  const raw = answerKeyEl.value.trim();
  if (!raw) return null;
  return raw.split(',').map(s => s.trim().toUpperCase());
}

async function handleScan() {
  if (!cvReady) { setStatus('Aguarde o OpenCV carregar.', 'warn'); return; }
  if (video.readyState < 2) { setStatus('Câmera não está pronta.', 'warn'); return; }

  // Captura frame
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  let src = cv.imread(canvas);
  let out = null;
  try {
    out = processFrame(src);
  } catch (e) {
    console.error(e);
    setStatus('Falha no processamento: ' + e.message, 'fail');
    src.delete();
    if (out && out.delete) out.delete();
    return;
  }
  src.delete();

  // Análise de respostas
  const numQ = parseInt(numQuestionsEl.value, 10) || 20;
  const numC = parseInt(numChoicesEl.value, 10) || 4;
  const th = parseFloat(thresholdEl.value) || 0.5;

  const analysis = analyzeSheet(out, numQ, numC, th);
  out.delete();

  // Correção
  const keyArr = getAnswerArray();
  if (!keyArr || keyArr.length < numQ) {
    setStatus('Defina um gabarito com pelo menos ' + numQ + ' respostas.', 'warn');
    return;
  }
  const letters = ['A','B','C','D','E'];

  let score = 0;
  const rows = [];
  for (let i=0;i<numQ;i++) {
    const selIdx = analysis.selections[i]; // -1 se em branco
    const selLetter = selIdx >= 0 ? letters[selIdx] : '—';
    const correct = keyArr[i] || '—';
    const ok = (selLetter === correct);
    if (ok) score++;
    rows.push({ q:i+1, sel: selLetter, cor: correct, ok });
  }

  const aluno = (studentIdEl.value || '').trim();
  scanHistory.push({
    timestamp: new Date().toISOString(),
    aluno,
    numQ, numC, threshold: th,
    answers: rows.map(r => r.sel),
    correct: rows.map(r => r.ok),
    score
  });
  btnCSV.disabled = scanHistory.length === 0 ? true : false;

  // Exibir resultado
  let lines = [];
  lines.push(`Aluno: ${aluno || '(sem ID)'}  |  Acertos: ${score}/${numQ}`);
  lines.push('----------------------------------------------');
  rows.forEach(r => {
    lines.push(
      `${String(r.q).padStart(2,'0')} | Marcado: ${r.sel} | Correto: ${r.cor} | ${r.ok ? '✔' : '✘'}`
    );
  });
  resultsEl.textContent = lines.join('\n');
  setStatus('Leitura concluída. Se desejar, salve em CSV.', 'success');
}

// Processamento: encontra maior quadrilátero (a folha), faz warp para um tamanho fixo e retorna imagem binária.
function processFrame(src) {
  let resized = new cv.Mat();
  let ratio = 1000 / Math.max(src.cols, src.rows);
  cv.resize(src, resized, new cv.Size(Math.round(src.cols*ratio), Math.round(src.rows*ratio)), 0,0, cv.INTER_AREA);

  let gray = new cv.Mat();
  cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY, 0);
  let blur = new cv.Mat();
  cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
  let edges = new cv.Mat();
  cv.Canny(blur, edges, 50, 150);

  // Dilatação para unir contornos
  let kernel = cv.Mat.ones(3,3, cv.CV_8U);
  let dil = new cv.Mat();
  cv.dilate(edges, dil, kernel);

  // Encontrar contornos
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(dil, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let maxArea = 0, best = null;
  for (let i=0;i<contours.size();i++) {
    const c = contours.get(i);
    const area = cv.contourArea(c);
    if (area > maxArea) {
      // Aproxima para polígonos e busca quadrilátero
      let peri = cv.arcLength(c, true);
      let approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4) {
        maxArea = area;
        best = approx; // mantém approx
      } else {
        approx.delete();
      }
    }
  }

  if (!best) {
    gray.delete(); blur.delete(); edges.delete(); dil.delete(); kernel.delete(); contours.delete(); hierarchy.delete(); resized.delete();
    throw new Error('Não encontrei a folha inteira. Tente enquadrar melhor e melhorar a iluminação.');
  }

  // Ordenar pontos (top-left, top-right, bottom-right, bottom-left)
  const pts = [];
  for (let i=0;i<4;i++) {
    const p = best.intPtr(i);
    pts.push({x:p[0], y:p[1]});
  }
  best.delete();
  // Ordena por soma/diferença
  pts.sort((a,b)=> (a.x+a.y)-(b.x+b.y));
  const tl = pts[0];
  const br = pts[3];
  const [tr, bl] = (pts[1].x < pts[2].x) ? [pts[1], pts[2]] : [pts[2], pts[1]];

  const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
  const maxWidth = Math.max(widthTop, widthBottom);
  const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
  const maxHeight = Math.max(heightLeft, heightRight);

  const dstW = 1000, dstH = 1400; // tamanho padrão (A4-ish retrato)
  const srcTri = cv.matFromArray(4,1,cv.CV_32FC2, [tl.x,tl.y, tr.x,tr.y, br.x,br.y, bl.x,bl.y]);
  const dstTri = cv.matFromArray(4,1,cv.CV_32FC2, [0,0, dstW,0, dstW,dstH, 0,dstH]);
  let M = cv.getPerspectiveTransform(srcTri, dstTri);
  let warped = new cv.Mat();
  cv.warpPerspective(resized, warped, M, new cv.Size(dstW, dstH));

  // Binarizar
  let warpedGray = new cv.Mat();
  cv.cvtColor(warped, warpedGray, cv.COLOR_RGBA2GRAY, 0);
  let bin = new cv.Mat();
  cv.adaptiveThreshold(warpedGray, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 31, 10);

  // limpeza
  gray.delete(); blur.delete(); edges.delete(); dil.delete(); kernel.delete(); contours.delete(); hierarchy.delete(); resized.delete();
  srcTri.delete(); dstTri.delete(); M.delete(); warped.delete(); warpedGray.delete();

  return bin; // imagem binária (bolhas pretas = 255)
}

// Analisa uma grade presumida: área central da folha com N questões e C alternativas em colunas horizontais.
function analyzeSheet(binImg, numQ, numC, thresholdFrac) {
  // Definimos uma margem e uma área de grade "ideal" onde estarão as marcações.
  const W = binImg.cols, H = binImg.rows;
  const marginX = Math.round(W*0.10);
  const marginY = Math.round(H*0.18);
  const gridW = W - marginX*2;
  const gridH = H - marginY*2;

  // Grade: numQ linhas, numC colunas
  const cellH = Math.floor(gridH / numQ);
  const cellW = Math.floor(gridW / numC);

  const selections = new Array(numQ).fill(-1);
  const strengths = new Array(numQ).fill(0);

  // Para cada questão, escolhe a alternativa com maior "preenchimento"
  for (let i=0;i<numQ;i++) {
    let bestIdx = -1;
    let bestVal = 0;
    for (let j=0;j<numC;j++) {
      const x = marginX + j*cellW;
      const y = marginY + i*cellH;
      const roi = binImg.roi(new cv.Rect(x, y, Math.max(8,cellW-6), Math.max(8,cellH-6)));
      const filled = cv.countNonZero(roi);
      roi.delete();
      if (filled > bestVal) { bestVal = filled; bestIdx = j; }
    }
    // medir total possível aproximado (área da célula)
    const approxMax = cellW*cellH;
    // Se o preenchimento relativo for baixo, consideramos em branco.
    if (bestVal/approxMax >= thresholdFrac*0.25) {
      selections[i] = bestIdx;
      strengths[i] = bestVal/approxMax;
    } else {
      selections[i] = -1;
      strengths[i] = 0;
    }
  }

  return { selections, strengths, meta:{ W,H, marginX, marginY, cellW, cellH } };
}

// Exportar CSV com histórico de leituras
function exportCSV() {
  if (scanHistory.length === 0) return;
  const letters = ['A','B','C','D','E'];
  const rows = [];
  // Cabeçalho
  const maxQ = Math.max(...scanHistory.map(s => s.numQ));
  const header = ['timestamp','aluno','nota'];
  for (let i=1;i<=maxQ;i++) header.push(`Q${i}`);
  rows.push(header);

  // Linhas
  for (const s of scanHistory) {
    const line = [s.timestamp, s.aluno || '', `${s.score}/${s.numQ}`];
    for (let i=0;i<maxQ;i++) {
      line.push(s.answers[i] || '');
    }
    rows.push(line);
  }

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resultados_gabarito.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Gera uma página de impressão de cartão-resposta simples com 4 marcadores nos cantos e grade N x C.
function printSheet() {
  const numQ = parseInt(numQuestionsEl.value, 10) || 20;
  const numC = parseInt(numChoicesEl.value, 10) || 4;
  const letters = ['A','B','C','D','E'].slice(0,numC);
  const w = window.open('', '_blank');
  const html = [];
  html.push(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cartão-Resposta</title>`);
  html.push(`<style>
    @page { size: A4 portrait; margin: 12mm; }
    body{ font-family: Arial, Helvetica, sans-serif; color:#000; }
    .corners{ display:flex; justify-content:space-between; margin-bottom:8mm; }
    .corner{ width:24mm; height:24mm; background:#000; }
    h1{ font-size:18px; margin:0 0 4mm; }
    .meta{ display:flex; gap:12px; margin:0 0 6mm; }
    .meta div{ flex:1; }
    table{ width:100%; border-collapse:collapse; }
    th,td{ border:1px solid #000; padding:3mm 2mm; text-align:center; font-size:12px; }
    .bubble{ width:6mm; height:6mm; border:1px solid #000; display:inline-block; border-radius:50%; }
    .small{ font-size:10px; color:#555; }
  </style></head><body>`);
  html.push(`<div class="corners"><div class="corner"></div><div class="corner"></div></div>`);
  html.push(`<h1>Cartão-Resposta</h1>`);
  html.push(`<div class="meta"><div>Aluno: ___________________________</div><div>Turma: __________</div><div>Data: ___/___/_____</div></div>`);
  html.push(`<table><thead><tr><th>Questão</th>`);
  for (const L of letters) html.push(`<th>${L}</th>`);
  html.push(`</tr></thead><tbody>`);
  for (let i=1;i<=numQ;i++) {
    html.push(`<tr><td>${i}</td>`);
    for (let j=0;j<numC;j++) html.push(`<td><span class="bubble"></span></td>`);
    html.push(`</tr>`);
  }
  html.push(`</tbody></table>`);
  html.push(`<p class="small">Preencha a bolha da alternativa escolhida com caneta ou lápis escuro. Mantenha a folha limpa e sem amassar.</p>`);
  html.push(`<div class="corners" style="margin-top:8mm;"><div class="corner"></div><div class="corner"></div></div>`);
  html.push(`</body></html>`);
  w.document.write(html.join(''));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function showHelp() {
  const msg = [
    'Dicas de uso:',
    '1) Clique em "Ativar câmera" e enquadre toda a folha.',
    '2) Use boa iluminação e evite sombras.',
    '3) Defina o número de questões e alternativas.',
    '4) Cole o gabarito oficial (A,B,C,...) e salve.',
    '5) Clique em "Escanear agora".',
    '6) Selecione "Exportar CSV" para baixar os resultados.'
  ].join('\n');
  alert(msg);
}
