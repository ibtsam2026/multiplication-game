// =============================
// منطق لعبة جدول الضرب – واجهة عربية
// =============================
(function() {
  const gridEl = document.getElementById('grid');
  const modalEl = document.getElementById('modal');
  const closeModalBtn = document.getElementById('closeModal');
  const questionTextEl = document.getElementById('questionText');
  const choicesEl = document.getElementById('choices');
  const scoreEl = document.getElementById('score');
  const progressEl = document.getElementById('progress');
  const feedbackEl = document.getElementById('feedback');
  const winSound = document.getElementById('winSound');
  const loseSound = document.getElementById('loseSound');

  // تحويل الأرقام إلى أرقام عربية (٠١٢٣٤٥٦٧٨٩)
  const AR_DIGITS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function toArabicDigits(n) {
    return String(n).split('').map(ch => {
      if (ch === '-') return '−';
      if (ch === '.') return '٫';
      const code = ch.charCodeAt(0) - 48; // '0' = 48
      return (code >= 0 && code <= 9) ? AR_DIGITS[code] : ch;
    }).join('');
  }

  // مولد أرقام عشوائية بسيط قابل للبذر لضمان اختلاف الأسئلة لكل طالب
  function makePRNG(seed) {
    let s = seed >>> 0;
    return function() {
      // LCG: X_{n+1} = (aX_n + c) mod m
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296; // [0,1)
    };
  }

  // إنشاء شبكة ٤٠ طالبًا
  function buildGrid() {
    for (let i = 1; i <= 40; i++) {
      const btn = document.createElement('button');
      btn.className = 'student-card';
      btn.dataset.studentId = String(i);
      const completed = localStorage.getItem('studentDone_' + i) === '1';
      btn.innerHTML = `<span class="number">${toArabicDigits(i)}</span>` +
                      `<span class="status-icon">${completed ? '✅' : '🔒'}</span>`;
      if (completed) btn.classList.add('completed');
      btn.addEventListener('click', () => startTestForStudent(i));
      gridEl.appendChild(btn);
    }
  }

  // إنشاء ٥ أسئلة فريدة لطالب معين
  function generateQuestionsFor(studentId) {
    const prng = makePRNG( (studentId * 997) ^ 0x9e3779b9 ); // بذرة مختلفة لكل طالب
    const questions = [];
    const used = new Set();
    while (questions.length < 5) {
      // جدول ٢ إلى ٩ × (١ إلى ١٠)
      const a = 2 + Math.floor(prng() * 8);  // 2..9
      const b = 1 + Math.floor(prng() * 10); // 1..10
      const key = a + 'x' + b;
      if (used.has(key)) continue; // لا نكرر داخل نفس الطالب
      used.add(key);
      questions.push({ a, b, correct: a * b });
    }
    return questions;
  }

  // إنشاء خيارات متعددة مع مشتتات معقولة
  function makeChoices(correct, a, b, prng) {
    const options = new Set([correct]);
    // مشتتات محتملة حول القيمة الصحيحة
    const candidates = [
      correct + a,      // خطأ شائع بجمع المضروب
      correct - a,
      correct + b,
      correct - b,
      a * (b + 1),
      a * (b - 1),
      (a + b),          // جمع العددين
      a * (b + (Math.random() < 0.5 ? 2 : -2))
    ];
    // املأ حتى ٤ خيارات إجمالاً
    let idx = 0;
    while (options.size < 4 && idx < candidates.length) {
      const val = candidates[idx++];
      if (val > 0) options.add(val);
    }
    // لو لم تكفِ، ولّد حول الصحيح بفروق صغيرة
    while (options.size < 4) {
      const delta = 1 + Math.floor(prng() * 5); // 1..5
      const sign = prng() < 0.5 ? -1 : 1;
      const val = correct + sign * delta;
      if (val > 0) options.add(val);
    }
    // حول إلى مصفوفة وامزج
    const arr = Array.from(options);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let state = null; // حالة الاختبار الحالية

  function startTestForStudent(studentId) {
    // حضّر الحالة
    const prng = makePRNG( (studentId * 1315423911) ^ 0x85ebca6b );
    state = {
      studentId,
      prng,
      questions: generateQuestionsFor(studentId),
      index: 0,
      score: 0
    };
    scoreEl.textContent = `الدرجة: ${toArabicDigits(state.score)}/٥`;
    progressEl.textContent = `السؤال ${toArabicDigits(1)} من ${toArabicDigits(5)}`;
    feedbackEl.textContent = '';

    // عرض أول سؤال وفتح المودال
    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    const q = state.questions[state.index];
    questionTextEl.textContent = `${toArabicDigits(q.a)} × ${toArabicDigits(q.b)}`;
    choicesEl.innerHTML = '';

    const choices = makeChoices(q.correct, q.a, q.b, state.prng);
    choices.forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = toArabicDigits(val);
      btn.addEventListener('click', () => onChoose(val === q.correct, btn));
      choicesEl.appendChild(btn);
    });
  }

  function onChoose(isCorrect, btn) {
    // عطّل الأزرار مؤقتًا
    Array.from(choicesEl.children).forEach(ch => ch.disabled = true);

    if (isCorrect) {
      btn.classList.add('correct');
      feedbackEl.textContent = 'أحسنت! إجابة صحيحة.';
      try { winSound.currentTime = 0; winSound.play(); } catch(e) {}
      state.score++;
    } else {
      btn.classList.add('wrong');
      feedbackEl.textContent = 'للأسف، إجابة غير صحيحة.';
      try { loseSound.currentTime = 0; loseSound.play(); } catch(e) {}
    }

    scoreEl.textContent = `الدرجة: ${toArabicDigits(state.score)}/٥`;

    // التالي تلقائيًا بعد مهلة قصيرة
    setTimeout(() => {
      state.index++;
      if (state.index < state.questions.length) {
        progressEl.textContent = `السؤال ${toArabicDigits(state.index + 1)} من ${toArabicDigits(5)}`;
        feedbackEl.textContent = '';
        renderCurrentQuestion();
      } else {
        showFinalResult();
      }
    }, 800);
  }

  function showFinalResult() {
    const total = state.questions.length;
    const score = state.score;
    let msg = '';
    if (score === 5) msg = 'ممتاز! نتيجتك هي ';
    else if (score >= 4) msg = 'رائع! نتيجتك هي ';
    else if (score >= 3) msg = 'جيد! نتيجتك هي ';
    else msg = 'حاول مجددًا! نتيجتك هي ';

    questionTextEl.textContent = `${msg}${toArabicDigits(score)}/${toArabicDigits(total)}`;
    choicesEl.innerHTML = '';
    feedbackEl.textContent = '';

    // تعليم الطالب بأنه أنهى الاختبار وتحديث الشبكة
    localStorage.setItem('studentDone_' + state.studentId, '1');
    const card = document.querySelector(`.student-card[data-student-id="${state.studentId}"]`);
    if (card) {
      card.classList.add('completed');
      const icon = card.querySelector('.status-icon');
      if (icon) icon.textContent = '✅';
    }

    // إغلاق تلقائي بعد ٢ ثوانٍ
    setTimeout(closeModal, 2000);
  }

  function closeModal() {
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    state = null;
  }

  closeModalBtn.addEventListener('click', closeModal);

  // ابدأ
  buildGrid();
})();
