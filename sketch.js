// 英文選擇題：p5.js + Google 試算表 CSV 題庫
// 題庫不放在本地 questions.csv，而是從公開發布的 Google 試算表讀取。

// ==================== 使用者設定區 ====================
// 請把下一行的文字替換成「Google 試算表發布到網路後」的 CSV 網址。
// 例如：https://docs.google.com/spreadsheets/d/試算表ID/export?format=csv&gid=工作表ID
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRV_22x3pr1ogtAqGzKzDu_9RA0i9XVi6kWWbkfWDCwsid6ge4GSTVC6HHNWw39XVsLqTolCg19Aep/pub?gid=1958516374&single=true&output=csv";

// 其他容易調整的測驗設定集中在這裡。
const QUIZ_SETTINGS = {
  questionCount: 5,
  expectedColumns: ['id', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'answer'],
  answerLabels: ['A', 'B', 'C', 'D'],
  maxContentWidth: 760
};
// =====================================================

let questionTable = null;
let allQuestions = [];
let selectedQuestions = [];
let csvLoadError = null;
let invalidRows = [];
let quizReady = false;

// 這份位置資料是唯一來源；updateLayout() 會統一計算所有按鈕位置。
const buttonLayout = {
  answers: [],
  next: { x: 0, y: 0, w: 0, h: 0 },
  restart: { x: 0, y: 0, w: 0, h: 0 }
};

let layout = {};
let currentQuestionIndex = 0;
let score = 0;
let selectedAnswerIndex = -1;
let hasAnswered = false;
let quizFinished = false;

function hideLoadingMessage() {
  const loadingElement = typeof document !== 'undefined'
    ? document.getElementById('loading-message')
    : null;
  if (loadingElement) {
    loadingElement.style.display = 'none';
    loadingElement.setAttribute('aria-hidden', 'true');
  }
}

// 所有載入、格式與執行錯誤都會顯示在頁面，而不是只留白。
function showError(message) {
  hideLoadingMessage();
  const text = String(message || '未知錯誤');
  const errorPanel = typeof document !== 'undefined'
    ? document.getElementById('error-panel')
    : null;
  if (errorPanel) {
    errorPanel.textContent = '測驗載入或執行錯誤\n' + text;
    errorPanel.style.display = 'block';
  }
  if (typeof console !== 'undefined' && console.error) console.error(text);
}

function isPlaceholderUrl(url) {
  const value = String(url || '').trim();
  return !value || value === '請將你的 Google 試算表 CSV 網址貼在這裡' || !/^https?:\/\//i.test(value);
}

function preload() {
  if (isPlaceholderUrl(GOOGLE_SHEET_CSV_URL)) {
    csvLoadError = '尚未設定 Google 試算表 CSV 網址。請在 sketch.js 最前面的 GOOGLE_SHEET_CSV_URL 貼上公開發布的 CSV 網址。';
    return;
  }

  // 使用 p5.js loadTable 讀取公開 Google 試算表 CSV；header 會把第一列當作欄位名稱。
  questionTable = loadTable(
    GOOGLE_SHEET_CSV_URL,
    'csv',
    'header',
    function () {},
    function (error) {
      csvLoadError = 'Google 試算表 CSV 載入失敗：' + String(error || '網址無法讀取，或試算表尚未公開發布。');
    }
  );
}

function setup() {
  try {
    const canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-holder');
    textAlign(LEFT, TOP);
    textWrap(CHAR);

    if (csvLoadError) {
      showError(csvLoadError);
      noLoop();
      return;
    }
    if (!questionTable) {
      showError('沒有讀到題庫。請確認 GOOGLE_SHEET_CSV_URL 已替換，且網址是可公開讀取的 CSV 網址。');
      noLoop();
      return;
    }

    parseQuestions();
    if (invalidRows.length > 0) {
      showError('Google 試算表有格式錯誤，請修正第 ' + invalidRows.join('、') + ' 列。每列必須有 question、optionA～optionD，且 answer 只能是 A、B、C 或 D。');
      noLoop();
      return;
    }
    if (allQuestions.length < QUIZ_SETTINGS.questionCount) {
      showError('有效題目只有 ' + allQuestions.length + ' 題，至少需要 ' + QUIZ_SETTINGS.questionCount + ' 題才能開始測驗。');
      noLoop();
      return;
    }

    startQuiz();
    updateLayout();
    quizReady = true;
    hideLoadingMessage();
    redraw();
  } catch (error) {
    showError('setup() 執行失敗：' + (error && error.message ? error.message : error));
    noLoop();
  }
}

function windowResized() {
  try {
    resizeCanvas(windowWidth, windowHeight);
    updateLayout();
    redraw();
  } catch (error) {
    showError('視窗調整版面失敗：' + (error && error.message ? error.message : error));
  }
}

function readCell(row, columnName) {
  const value = row.getString(columnName);
  return String(value == null ? '' : value).trim();
}

function parseQuestions() {
  allQuestions = [];
  invalidRows = [];

  const headers = Array.isArray(questionTable.columns) ? questionTable.columns : [];
  const missingColumns = QUIZ_SETTINGS.expectedColumns.filter(function (columnName) {
    return headers.indexOf(columnName) === -1;
  });
  if (missingColumns.length > 0) {
    invalidRows.push('欄位（缺少 ' + missingColumns.join('、') + '）');
    return;
  }

  questionTable.getRows().forEach(function (row, rowIndex) {
    const values = QUIZ_SETTINGS.expectedColumns.map(function (columnName) {
      return readCell(row, columnName);
    });
    // 完全空白列視為試算表尾端的空列，不列入錯誤。
    if (values.every(function (value) { return value === ''; })) return;

    const id = values[0];
    const question = values[1];
    const options = values.slice(2, 6);
    const answer = values[6].toUpperCase();
    const hasFourOptions = options.length === 4 && options.every(function (option) { return option.length > 0; });
    const validAnswer = QUIZ_SETTINGS.answerLabels.indexOf(answer) !== -1;

    if (!question || !hasFourOptions || !validAnswer) {
      invalidRows.push(rowIndex + 2);
      return;
    }
    allQuestions.push({ id: id, question: question, options: options, answer: answer });
  });
}

function shuffleArray(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = floor(random(index + 1));
    const temporary = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = temporary;
  }
  return result;
}

function startQuiz() {
  // 重新開始時重新洗牌，並重新抽出 5 題。
  selectedQuestions = shuffleArray(allQuestions).slice(0, QUIZ_SETTINGS.questionCount);
  currentQuestionIndex = 0;
  score = 0;
  selectedAnswerIndex = -1;
  hasAnswered = false;
  quizFinished = false;
}

function getCurrentQuestion() {
  return selectedQuestions[currentQuestionIndex] || null;
}

function answerIndex(answer) {
  return QUIZ_SETTINGS.answerLabels.indexOf(answer);
}

function calculateMetrics() {
  const narrow = width < 560;
  const sidePadding = constrain(width * 0.06, 16, 34);
  const contentWidth = min(QUIZ_SETTINGS.maxContentWidth, max(0, width - sidePadding * 2));
  const base = constrain(min(width, height) * (narrow ? 0.041 : 0.044), 14, 25);
  return {
    sidePadding: sidePadding,
    contentX: (width - contentWidth) / 2,
    contentWidth: contentWidth,
    base: base,
    singleColumn: narrow || contentWidth < 520,
    titleSize: base * 1.52,
    progressSize: base * 0.80,
    questionSize: base * 1.16,
    optionSize: base * 0.91,
    feedbackSize: base * 0.90,
    buttonHeight: constrain(base * (narrow ? 2.85 : 2.55), 46, 76),
    actionHeight: constrain(base * 2.25, 44, 62),
    gap: base * 0.52,
    sectionGap: base * 0.72,
    radius: base * 0.44
  };
}

function wrapLines(value, maxWidth, fontName, fontSize, fontStyle) {
  textFont(fontName);
  textStyle(fontStyle);
  textSize(fontSize);
  const lines = [];
  let line = '';
  Array.from(String(value)).forEach(function (character) {
    const candidate = line + character;
    if (line && textWidth(candidate) > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  });
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

function updateLayout() {
  const metrics = calculateMetrics();
  layout = { metrics: metrics, questionLines: [], feedbackLines: [] };
  const current = getCurrentQuestion();
  const actionWidth = min(metrics.contentWidth, 300);

  if (quizFinished) {
    layout.finishTitleY = max(40, height * 0.25);
    layout.finishScoreY = layout.finishTitleY + metrics.titleSize * 2.0;
    buttonLayout.restart = {
      x: (width - actionWidth) / 2,
      y: layout.finishScoreY + metrics.questionSize * 2.0,
      w: actionWidth,
      h: metrics.actionHeight
    };
    return;
  }

  const questionText = current ? current.question : '目前沒有可顯示的題目';
  layout.questionLines = wrapLines(questionText, metrics.contentWidth, 'Noto Serif TC', metrics.questionSize, BOLD);
  const headerHeight = metrics.titleSize * 1.42 + metrics.progressSize * 1.55 + metrics.sectionGap;
  layout.questionY = max(22, (height - 560) / 2) + headerHeight;
  const questionLineHeight = metrics.questionSize * 1.42;
  const questionHeight = layout.questionLines.length * questionLineHeight;
  const answerTop = layout.questionY + questionHeight + metrics.sectionGap;
  const columns = metrics.singleColumn ? 1 : 2;
  const rows = columns === 1 ? 4 : 2;
  const answerGap = metrics.gap;
  const answerWidth = columns === 1 ? metrics.contentWidth : (metrics.contentWidth - answerGap) / 2;
  const availableAnswerHeight = (height - answerTop - 150 - answerGap * (rows - 1)) / rows;
  const answerHeight = max(42, min(metrics.buttonHeight, availableAnswerHeight));

  // 四個選項的位置集中在 buttonLayout，繪圖與點擊共用同一份資料。
  buttonLayout.answers = [];
  for (let index = 0; index < 4; index += 1) {
    const column = columns === 1 ? 0 : index % 2;
    const row = columns === 1 ? index : floor(index / 2);
    buttonLayout.answers.push({
      x: metrics.contentX + column * (answerWidth + answerGap),
      y: answerTop + row * (answerHeight + answerGap),
      w: answerWidth,
      h: answerHeight
    });
  }

  const lastAnswer = buttonLayout.answers[buttonLayout.answers.length - 1];
  const feedbackY = lastAnswer.y + lastAnswer.h + metrics.sectionGap * 0.55;
  if (hasAnswered && current) {
    const feedback = selectedAnswerIndex === answerIndex(current.answer)
      ? '答對了！'
      : '答錯了，正確答案是 ' + current.answer;
    layout.feedbackLines = wrapLines(feedback, metrics.contentWidth, 'Noto Sans TC', metrics.feedbackSize, NORMAL);
  }
  const feedbackHeight = hasAnswered ? layout.feedbackLines.length * metrics.feedbackSize * 1.4 : 0;
  buttonLayout.next = {
    x: (width - actionWidth) / 2,
    y: feedbackY + feedbackHeight + metrics.sectionGap * 0.35,
    w: actionWidth,
    h: metrics.actionHeight
  };
  buttonLayout.restart = {
    x: (width - actionWidth) / 2,
    y: height - metrics.actionHeight - metrics.sidePadding * 0.65,
    w: actionWidth,
    h: metrics.actionHeight
  };
}

function draw() {
  background('#f4f8fb');
  if (!quizReady) return;
  if (quizFinished) {
    drawFinished();
    return;
  }
  drawCard();
  drawQuestion();
  drawAnswerButtons();
  drawRestartButton();
}

function drawCard() {
  const metrics = layout.metrics;
  noStroke();
  fill('#ffffff');
  rect(metrics.contentX - metrics.sidePadding * 0.45, 16,
    metrics.contentWidth + metrics.sidePadding * 0.9, height - 32, metrics.radius);
  fill('#23415d');
  textFont('Noto Sans TC');
  textStyle(BOLD);
  textSize(metrics.titleSize);
  textAlign(CENTER, TOP);
  text('英文選擇題', width / 2, 28);
  fill('#60788c');
  textStyle(NORMAL);
  textSize(metrics.progressSize);
  const progress = '第 ' + (currentQuestionIndex + 1) + ' / ' + selectedQuestions.length + ' 題　　目前得分：' + score;
  text(progress, width / 2, 28 + metrics.titleSize * 1.42);
  textAlign(LEFT, TOP);
}

function drawQuestion() {
  const metrics = layout.metrics;
  fill('#17212b');
  textFont('Noto Serif TC');
  textStyle(BOLD);
  textSize(metrics.questionSize);
  textAlign(LEFT, TOP);
  layout.questionLines.forEach(function (line, index) {
    text(line, metrics.contentX, layout.questionY + index * metrics.questionSize * 1.42);
  });
}

function drawAnswerButtons() {
  const metrics = layout.metrics;
  const current = getCurrentQuestion();
  const answerRects = getAnswerButtonRects();
  answerRects.forEach(function (rectInfo, index) {
    let fillColor = '#f8fbfd';
    let strokeColor = '#8da6b8';
    if (hasAnswered) {
      if (index === answerIndex(current.answer)) {
        fillColor = '#d9f2df';
        strokeColor = '#259447';
      } else if (index === selectedAnswerIndex) {
        fillColor = '#ffe0e0';
        strokeColor = '#d33b3b';
      }
    }
    fill(fillColor);
    stroke(strokeColor);
    strokeWeight(2);
    rect(rectInfo.x, rectInfo.y, rectInfo.w, rectInfo.h, metrics.radius);
    fill('#20394f');
    noStroke();
    textFont('Noto Sans TC');
    textStyle(NORMAL);
    textSize(metrics.optionSize);
    textAlign(LEFT, CENTER);
    const label = QUIZ_SETTINGS.answerLabels[index] + '. ' + current.options[index];
    const lines = wrapLines(label, rectInfo.w - metrics.base * 1.4, 'Noto Sans TC', metrics.optionSize, NORMAL);
    const lineHeight = metrics.optionSize * 1.25;
    const textTop = rectInfo.y + (rectInfo.h - lines.length * lineHeight) / 2;
    lines.forEach(function (line, lineIndex) {
      text(line, rectInfo.x + metrics.base * 0.7, textTop + lineIndex * lineHeight);
    });
  });

  if (hasAnswered) {
    fill('#23415d');
    textAlign(CENTER, TOP);
    textSize(metrics.feedbackSize);
    textFont('Noto Sans TC');
    textStyle(BOLD);
    layout.feedbackLines.forEach(function (line, index) {
      text(line, width / 2, buttonLayout.next.y - metrics.sectionGap * 0.5 - (layout.feedbackLines.length - index) * metrics.feedbackSize * 1.35);
    });
    drawActionButton(buttonLayout.next, currentQuestionIndex === selectedQuestions.length - 1 ? '看結果' : '下一題', '#2f6f9f');
  }
}

function drawRestartButton() {
  drawActionButton(buttonLayout.restart, '重新開始', '#607d8b');
}

function drawActionButton(rectInfo, label, color) {
  fill(color);
  noStroke();
  rect(rectInfo.x, rectInfo.y, rectInfo.w, rectInfo.h, layout.metrics.radius);
  fill('#ffffff');
  textFont('Noto Sans TC');
  textStyle(BOLD);
  textSize(layout.metrics.optionSize);
  textAlign(CENTER, CENTER);
  text(label, rectInfo.x + rectInfo.w / 2, rectInfo.y + rectInfo.h / 2);
  textAlign(LEFT, TOP);
}

function drawFinished() {
  const metrics = layout.metrics;
  fill('#ffffff');
  noStroke();
  rect(metrics.contentX - metrics.sidePadding * 0.45, 16,
    metrics.contentWidth + metrics.sidePadding * 0.9, height - 32, metrics.radius);
  fill('#23415d');
  textAlign(CENTER, TOP);
  textFont('Noto Sans TC');
  textStyle(BOLD);
  textSize(metrics.titleSize * 1.1);
  text('測驗完成！', width / 2, layout.finishTitleY);
  fill('#17212b');
  textSize(metrics.questionSize);
  text('你答對了 ' + score + ' / ' + selectedQuestions.length + ' 題', width / 2, layout.finishScoreY);
  drawActionButton(buttonLayout.restart, '重新開始', '#2f6f9f');
  textAlign(LEFT, TOP);
}

// 依需求保留共用的按鈕位置函式；drawAnswerButtons() 與 mousePressed() 都會使用它。
function getAnswerButtonRects() {
  return buttonLayout.answers;
}

function insideRect(px, py, rectInfo) {
  return px >= rectInfo.x && px <= rectInfo.x + rectInfo.w && py >= rectInfo.y && py <= rectInfo.y + rectInfo.h;
}

function mousePressed() {
  try {
    if (!quizReady) return false;

    if (quizFinished) {
      if (insideRect(mouseX, mouseY, buttonLayout.restart)) {
        startQuiz();
        updateLayout();
        redraw();
      }
      return false;
    }

    if (insideRect(mouseX, mouseY, buttonLayout.restart)) {
      startQuiz();
      updateLayout();
      redraw();
      return false;
    }

    if (!hasAnswered) {
      // 點擊判斷與繪圖同樣使用 getAnswerButtonRects()，避免位置不一致。
      const answerRects = getAnswerButtonRects();
      for (let index = 0; index < answerRects.length; index += 1) {
        if (insideRect(mouseX, mouseY, answerRects[index])) {
          selectedAnswerIndex = index;
          hasAnswered = true;
          if (selectedAnswerIndex === answerIndex(getCurrentQuestion().answer)) score += 1;
          updateLayout();
          redraw();
          return false;
        }
      }
    } else if (insideRect(mouseX, mouseY, buttonLayout.next)) {
      if (currentQuestionIndex >= selectedQuestions.length - 1) {
        quizFinished = true;
      } else {
        currentQuestionIndex += 1;
        selectedAnswerIndex = -1;
        hasAnswered = false;
      }
      updateLayout();
      redraw();
      return false;
    }
  } catch (error) {
    showError('點擊處理失敗：' + (error && error.message ? error.message : error));
  }
  return false;
}

window.onerror = function (message, source, line, column, error) {
  const detail = error && error.stack ? error.stack : String(message);
  showError(detail + (line ? '\n行號：' + line : ''));
  return false;
};
