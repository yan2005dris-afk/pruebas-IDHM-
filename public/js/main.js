// ====== UI Helpers ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ====== Dark mode toggle (persistente) ======
(function initDarkMode() {
  const btn = $('#darkModeBtn');
  if (btn) { // <-- ¡GUARDIA! Comprueba si el botón existe
    const saved = localStorage.getItem('upse_dark');
    if (saved === '1') document.body.classList.add('dark');
    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('upse_dark', document.body.classList.contains('dark') ? '1' : '0');
    });
  }
})();

// ====== Chatbox UI (Toggle) ======
(function initChat() {
  const chatbox = $('#chatbox');
  if (chatbox) { // <-- ¡GUARDIA! Comprueba si el chatbox existe
    $('#chatboxToggle').addEventListener('click', () => chatbox.classList.toggle('active'));
    $('#chatCloseBtn').addEventListener('click', () => chatbox.classList.remove('active'));
  }
})();

// ====== Lógica del Chat (Voz, IA, Eventos) ======
// AÑADIDO: Solo ejecutar si existe el input del chat
if ($('#chatboxInput')) {

  // ====== Voz (entrada y salida) ======
  let recognition = null;
  let listening = false;
  let speechEnabled = true;
  let currentLang = 'es-ES'; // idioma por defecto

  // AÑADIDO: Comprobar si los elementos de voz existen antes de usarlos
  const voiceStatus = $('#voiceStatus');
  const voiceBtn = $('#voiceBtn');
  const muteBtn = $('#muteBtn');
  const langDisplay = $('#langDisplay');

  // Detectar idioma...
  function detectLanguage(text) {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN'; // caracteres chinos
    if (/[a-z]/i.test(text) && /\b(the|is|you|hello|why|what|how|thank)\b/i.test(text)) return 'en-US';
    if (/[a-záéíóúñ]/i.test(text)) return 'es-ES';
    return 'es-ES';
  }

  // Hablar según idioma detectado
  function speak(text) {
    if (!speechEnabled) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = currentLang;
      utter.rate = 1;
      speechSynthesis.speak(utter);
    } catch (e) { console.error(e); }
  }

  function initRecognition(lang = 'es-ES') {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (voiceStatus) voiceStatus.textContent = 'Tu navegador no soporta reconocimiento de voz.';
      return;
    }
    recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      listening = true;
      if (voiceStatus) voiceStatus.textContent = `🎙️ Escuchando (${lang})...`;
    };
    recognition.onerror = (e) => {
      if (voiceStatus) voiceStatus.textContent = '⚠️ Error de voz: ' + (e.error || 'desconocido');
      listening = false;
    };
    recognition.onend = () => {
      listening = false;
      if (voiceStatus) voiceStatus.textContent = 'Puedes usar voz o texto';
    };
    recognition.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      $('#chatboxInput').value = text;
      handleChatboxInput();
    };
  }

  // AÑADIDO: Comprobar si los botones de voz existen antes de añadir listeners
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      if (!recognition) initRecognition(currentLang);
      if (!recognition) return;
      if (listening) recognition.stop();
      else recognition.start();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      speechEnabled = !speechEnabled;
      muteBtn.innerHTML = speechEnabled
        ? '<i class="fa-solid fa-volume-high"></i>'
        : '<i class="fa-solid fa-volume-xmark"></i>';
    });
  }

  // ====== Conocimiento educativo (dataset) ======
  const educationalKnowledge = {
    conceptos: {
      'cultura las vegas': {
        response: '📚 La Cultura Las Vegas (8,800–4,600 a.C.) es considerada la primera civilización del Ecuador. Enterraban a sus muertos cerca de sus viviendas con ofrendas, mostrando una temprana relación espiritual entre vivos y difuntos.',
        elements: ['🏛️', '⏰', '🌱', '💀']
      },
      'sincretismo cultural': {
        response: '📖 El sincretismo en Santa Elena es la fusión de creencias prehispánicas con prácticas católicas (1 y 2 de noviembre). No fue mera imposición: ambas cosmovisiones dialogaron y generaron una tradición híbrida vigente.',
        elements: ['⛪', '✝️', '🕯️', '🌺']
      },
      'patrimonio unesco': {
        response: '🏛️ Esta tradición recibió reconocimiento internacional como Patrimonio Cultural Inmaterial (2008). Refuerza su valor por la transmisión intergeneracional y su vigencia contemporánea.',
        elements: ['🏛️', '🌍', '📜', '🎖️']
      }
    },
    ofrendas: {
      'vela': {
        response: '🕯️ La vela simboliza la luz que guía a las almas al altar familiar y la purificación del espacio.',
        elements: ['🕯️', '✨', '🛤️', '👻']
      },
      'agua': {
        response: '💧 El agua representa purificación, renovación y hospitalidad para el ser querido que vuelve.',
        elements: ['💧', '🌊', '💙', '🥤']
      },
      'colada morada': {
        response: '🍷 Bebida ancestral de maíz morado y frutas; simboliza vida, muerte y renacimiento, y fortalece lazos comunitarios.',
        elements: ['🍷', '🟣', '🌽', '🫐']
      },
      'guaguas de pan': {
        response: '👶 Panes con forma de bebé que representan la continuidad del ciclo vital y la memoria cultural.',
        elements: ['👶', '🍞', '🍼', '🔄']
      }
    },
    practicas: {
      'ritual del llamado': {
        response: '🔥 Apertura simbólica del hogar a medianoche o al amanecer para recibir a las almas. Un acto liminal de encuentro.',
        elements: ['🔥', '🌅', '🚪', '🦟']
      },
      'muertear': {
        response: '🚶 Recorridos comunitarios que refuerzan solidaridad y pertenencia. 1/nov (niños), 2/nov (adultos).',
        elements: ['🚶', '👨‍👩‍👧‍👦', '🍬', '🍽️']
      },
      'cementerio': {
        response: '🪦 Visitas con limpieza y decoración de tumbas: continuidad familiar y encuentro intergeneracional.',
        elements: ['🪦', '⭐', '🕯️', '☁️']
      }
    },
    importancia: {
      'identidad cultural': {
        response: '🆔 Actúa como ancla identitaria: pertenencia, continuidad histórica y sentido comunitario.',
        elements: ['🆔', '🌍', '🏠', '💪']
      },
      'transmision generacional': {
        response: '👨‍👩‍👧‍👦 Se enseñan técnicas (colada, altar) y significados simbólicos dentro de la familia.',
        elements: ['👨‍👩‍👧‍👦', '🎓', '📚', '⏰']
      },
      'resistencia cultural': {
        response: '🛡️ Frente a la homogeneización global, la tradición se adapta sin perder su esencia.',
        elements: ['🛡️', '⚔️', '🏛️', '🔄']
      },
      'desarrollo economico': {
        response: '💰 Impacto local: panaderías, florerías, turismo cultural y economía circular.',
        elements: ['💰', '🍞', '🌸', '✈️']
      }
    }
  };

  // Mapa de frases clave → respuestas (incluye variantes del original)
  function processEducationalInput(raw) {
    const lower = raw.toLowerCase().trim();

    // saludos / ayuda
    if (/(hola|buenos días|buenas tardes|buenas noches)/.test(lower))
      return fmt('¡Hola! Puedo ayudarte con historia, ofrendas, rituales e importancia cultural. ¿Qué te interesa?');
    if (/(ayuda|comandos|no sé|que puedo preguntar)/.test(lower))
      return fmt('Puedes preguntar por: Cultura Las Vegas, sincretismo, vela, agua, colada morada, guaguas de pan, ritual del llamado, muertear, cementerio, identidad, transmisión, resistencia y economía.');
    if (/gracias/.test(lower))
      return fmt('¡Con gusto! ¿Quieres intentar el cuestionario o explorar otra sección?');

    // conceptos
    if (lower.includes('cultura las vegas') || lower === 'las vegas') return edu(educationalKnowledge.conceptos['cultura las vegas']);
    if (lower.includes('sincretismo')) return edu(educationalKnowledge.conceptos['sincretismo cultural']);
    if (lower.includes('unesco') || lower.includes('patrimonio')) return edu(educationalKnowledge.conceptos['patrimonio unesco']);

    // ofrendas
    if (/(vela|velas)/.test(lower)) return edu(educationalKnowledge.ofrendas['vela']);
    if (lower.includes('agua')) return edu(educationalKnowledge.ofrendas['agua']);
    if (lower.includes('colada')) return edu(educationalKnowledge.ofrendas['colada morada']);
    if (/(guaguas de pan|guaguas)/.test(lower)) return edu(educationalKnowledge.ofrendas['guaguas de pan']);

    // prácticas
    if (/(ritual del llamado|llamado)/.test(lower)) return edu(educationalKnowledge.practicas['ritual del llamado']);
    // Así es más consistente:
    if (lower.includes('muertear')) return edu(educationalKnowledge.practicas['muertear']);
    if (/(cementerio|cementerios)/.test(lower)) return edu(educationalKnowledge.practicas['cementerio']);

    // importancia
    if (/(identidad cultural|identidad)/.test(lower)) return edu(educationalKnowledge.importancia['identidad cultural']);
    if (/(transmision|transmisión|generaciones)/.test(lower)) return edu(educationalKnowledge.importancia['transmision generacional']);
    if (lower.includes('resistencia')) return edu(educationalKnowledge.importancia['resistencia cultural']);
    if (/(economico|económico|desarrollo)/.test(lower)) return edu(educationalKnowledge.importancia['desarrollo economico']);

    // preguntas comunes
    if (/(cuánto|cuanto|antigüedad|antiguedad)/.test(lower))
      return fmt('La tradición supera los 8,000 años (Cultura Las Vegas). Luego se fusiona con el calendario católico (1 y 2 de noviembre).');
    if (/(cuándo|cuando|fecha)/.test(lower))
      return fmt('Se vive el 1/nov (Todos los Santos) y 2/nov (Fieles Difuntos). Preparativos desde días antes.');
    if (/(dónde|donde)/.test(lower))
      return fmt('Principalmente en la provincia de Santa Elena (Ecuador): Sinchal, San Pedro, Colonche y otros.');
    if (/(por qué|porque|por que)/.test(lower))
      return fmt('Conecta vivos y muertos, refuerza identidad y transmisión de valores familiares y comunitarios.');
    if (/(quién|quienes|quiénes|quien)/.test(lower))
      return fmt('Participa toda la familia; mayores como guardianes del conocimiento ritual; práctica comunitaria.');
    if (/(comida|alimentos|platos)/.test(lower))
      return fmt('Colada morada, guaguas de pan y platos locales: picante de pescado, seco de gallina, tamales de yuca, ceviches.');
    if (/(frase|angelitos|ángeles somos)/.test(lower))
      return fmt('“Ángeles somos, del cielo venimos, pan pedimos…”. Expresa reciprocidad simbólica entre vivos y difuntos.');

    // fallback
    return null;
    //return fmt('💡 Puedo ayudarte con: historia (Cultura Las Vegas), ofrendas (vela, agua, colada, guaguas), rituales (llamado, muertear, cementerio) e importancia (identidad, transmisión, economía, resistencia).', ['💡','📖','🔍','🤝']);

    // helpers locales
    function fmt(text, elements = []) { return { response: text, elements }; }
    function edu(obj) { return fmt(obj.response, obj.elements); }
    function educitional(key) { return fmt(educationalKnowledge.practicas[key].response, educationalKnowledge.practicas[key].elements); }
  }

  async function askOpenAI(message) {
    try {
      // ⚠️ Importante: reemplaza esta URL por la de tu backend o proxy
      // Nunca pongas la API key directamente en el cliente
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      return data.reply || "No pude generar una respuesta en este momento.";
    } catch (err) {
      console.error(err);
      return "⚠️ Error al contactar el servidor de IA.";
    }
  }

  // ====== Chat rendering ======
  function addEducationalChatMessage(message, isUser = false) {
    const box = $('#chatboxMessages');
    const div = document.createElement('div');
    div.className = `msg ${isUser ? 'user' : 'ai'}`;
    div.textContent = message;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function formatEducationalResponse(text, elements = []) {
    if (!elements || !elements.length) return text;
    // una sola fila de iconos (sin duplicar)
    return `${text}\n\n${elements.join(' ')}`;
  }

  async function handleChatboxInput() {
    const input = $('#chatboxInput').value.trim();
    if (!input) return;

    // Detectar idioma automáticamente
    currentLang = detectLanguage(input);
    
    if (langDisplay) { // <-- ¡GUARDIA!
      langDisplay.textContent =
        currentLang === 'zh-CN' ? 'Idioma: 中文 🇨🇳' :
          currentLang === 'en-US' ? 'Idioma: English 🇬🇧' :
            'Idioma: Español 🇪🇸';
    }

    if (recognition) recognition.lang = currentLang;

    addEducationalChatMessage(input, true);
    $('#chatboxInput').value = '';

    // 1️⃣ Primero intenta con el conocimiento educativo local
    const result = processEducationalInput(input);
    let formatted = result && result.response
      ? formatEducationalResponse(result.response, result.elements)
      : null;

    // 2️⃣ Si no encontró nada útil, llama a OpenAI
    if (!formatted || /No tengo info/.test(formatted)) {
      formatted = await askOpenAI(input);
    }

    // 3️⃣ Mostrar y leer respuesta
    setTimeout(() => {
      addEducationalChatMessage(formatted, false);
      speak(formatted.replace(/\n+/g, ' '));
    }, 500);
  }

  // Event Listeners del Chat
  $('#sendChatboxBtn').addEventListener('click', handleChatboxInput);
  $('#chatboxInput').addEventListener('keypress', e => { if (e.key === 'Enter') handleChatboxInput(); });

} // <-- FIN DEL if ($('#chatboxInput'))

// ====== Quiz ======
// AÑADIDO: Solo ejecutar si existe el contenedor del quiz
if ($('#quiz-container')) {

  const allQuestions = [
    { question: "¿Cuál es la cultura más antigua relacionada con esta tradición en Santa Elena?", options: ["Valdivia", "Chorrera", "Las Vegas", "Machalilla"], correct: 2, explanation: "La Cultura Las Vegas (8,800–4,600 a.C.) es la más antigua y rinde culto a los difuntos." },
    { question: "¿Cuántos años de tradición tiene el Día de los Difuntos en Santa Elena?", options: ["500 años", "2,000 años", "8,000 años", "1,000 años"], correct: 2, explanation: "Se remonta a la Cultura Las Vegas (8,800–4,600 a.C.), más de 8,000 años." },
    // ... (El resto de tus 70+ preguntas van aquí, no las borres)
    // ...
    { question: "La esperanza actual de la tradición reside en...", options: ["Jóvenes y educación cultural", "Importación de pan", "Gobierno central", "Nuevas recetas extranjeras"], correct: 0, explanation: "Los jóvenes y la educación sostenida renovarán la tradición." }
  ];
  function getRandomQuestions(arr, count = 5) {
    const shuffled = arr.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Inicializa el quiz con 5 preguntas aleatorias
  let quizData = getRandomQuestions(allQuestions, 5);

  let qIndex = 0;
  let score = 0;

  function renderQuestion() {
    const container = $('#quiz-container');
    const prog = $('#quizProgress');
    if (qIndex >= quizData.length) { return showResults(); }
    const q = quizData[qIndex];
    const percentage = Math.round((qIndex / quizData.length) * 100);
    prog.style.width = percentage + '%';

    container.innerHTML = `
     <h3 class="text-lg font-bold">Pregunta ${qIndex + 1} de ${quizData.length}</h3>
     <p class="mt-2">${q.question}</p>
     ${q.options.map((opt, i) => `
       <div class="quiz-option" data-i="${i}">
         <span class="font-medium">${String.fromCharCode(65 + i)})</span> ${opt}
       </div>
     `).join('')}
     <div id="quiz-feedback" class="quiz-feedback" style="display:none"></div>
   `;

    $$('.quiz-option').forEach(opt => {
      opt.addEventListener('click', () => checkAnswer(opt, q));
    });
  }

  function checkAnswer(el, q) {
    const i = parseInt(el.dataset.i);
    const ok = i === q.correct;
    el.classList.add(ok ? 'correct' : 'incorrect');
    const fb = $('#quiz-feedback');
    fb.style.display = 'block';
    fb.textContent = (ok ? '✅ ¡Correcto! ' : '❌ Incorrecto. ') + q.explanation;
    if (ok) score++;
    $$('.quiz-option').forEach(x => x.style.pointerEvents = 'none');
    setTimeout(() => { qIndex++; renderQuestion(); }, 2000);
  }

  function showResults() {
    const container = $('#quiz-container');
    $('#quizProgress').style.width = '100%';
    const pct = Math.round((score / quizData.length) * 100);
    const icon = pct >= 80 ? '🎉' : pct >= 60 ? '👏' : pct >= 40 ? '📚' : '💡';
    const msg = pct >= 80 ? '¡Excelente!' : pct >= 60 ? 'Muy bien.' : pct >= 40 ? 'Buen intento.' : 'Sigue aprendiendo.';

    container.innerHTML = `
     <div class="text-center">
       <h3 class="text-2xl font-bold">¡Cuestionario completado!</h3>
       <div class="text-5xl" style="margin:10px 0">${icon}</div>
       <p>Tu puntuación: ${score}/${quizData.length} (${pct}%)</p>
       <p class="mt-2">${msg}</p>
       <button id="restartQuiz" class="btn" style="margin-top:12px;background:linear-gradient(90deg,var(--upse-mar),#52c7ba);border:1px solid #52c7ba">Intentar de nuevo</button>
     </div>
   `;
    $('#restartQuiz').addEventListener('click', () => {
      qIndex = 0; score = 0;
      quizData = getRandomQuestions(allQuestions, 5); // 🔁 Nuevas 5 preguntas aleatorias
      renderQuestion();
    });
  }
  
  // Init quiz
  renderQuestion();

} // <-- FIN DEL if ($('#quiz-container'))


// ====== Desplegable "Ver más" para tarjetas de componentes ======
(function initVerMas() {
  // Selecciona todos los botones dentro de .learn-card
  const botones = document.querySelectorAll('.learn-card .btn');

  if (botones && botones.length > 0) { // <-- ¡GUARDIA!
    botones.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // 1. Encuentra la tarjeta padre y el contenido adicional
        // MODIFICADO: Usar e.currentTarget en lugar de e.target para asegurar que sea el botón
        const card = e.currentTarget.closest('.learn-card');
        const info = card.querySelector('.info-adicional');

        // 2. Alterna la clase 'active' en el contenido
        const isActive = info.classList.toggle('active');

        // 3. Cambia el texto y el ícono del botón
        if (isActive) {
          e.currentTarget.innerHTML = 'Ver menos <i class="fa-solid fa-chevron-up"></i>';
        } else {
          e.currentTarget.innerHTML = 'Ver más <i class="fa-solid fa-chevron-down"></i>';
        }
      });
    });
  }
})();