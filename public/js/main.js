// ====== UI Helpers ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ====== Dark mode toggle (persistente) ======
(function initDarkMode(){
  const btn = $('#darkModeBtn');
  const saved = localStorage.getItem('upse_dark');
  if (saved === '1') document.body.classList.add('dark');
  btn.addEventListener('click', ()=>{
    document.body.classList.toggle('dark');
    localStorage.setItem('upse_dark', document.body.classList.contains('dark') ? '1' : '0');
  });
})();

// ====== Chatbox ======
(function initChat(){
  const chatbox = $('#chatbox');
  $('#chatboxToggle').addEventListener('click', ()=> chatbox.classList.toggle('active'));
  $('#chatCloseBtn').addEventListener('click', ()=> chatbox.classList.remove('active'));
})();

// ====== Voz (entrada y salida, multilingüe ES/EN/ZH) ======
let recognition = null;
let listening = false;
let speechEnabled = true;
let currentLang = 'es-ES'; // idioma por defecto

const voiceStatus = $('#voiceStatus');
const voiceBtn = $('#voiceBtn');
const muteBtn = $('#muteBtn');

// Detectar idioma automáticamente por el texto del usuario
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
    voiceStatus.textContent = 'Tu navegador no soporta reconocimiento de voz.';
    return;
  }
  recognition = new SR();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    listening = true;
    voiceStatus.textContent = `🎙️ Escuchando (${lang})...`;
  };
  recognition.onerror = (e) => {
    voiceStatus.textContent = '⚠️ Error de voz: ' + (e.error || 'desconocido');
    listening = false;
  };
  recognition.onend = () => {
    listening = false;
    voiceStatus.textContent = 'Puedes usar voz o texto';
  };
  recognition.onresult = (ev) => {
    const text = ev.results[0][0].transcript;
    $('#chatboxInput').value = text;
    handleChatboxInput();
  };
}

voiceBtn.addEventListener('click', () => {
  if (!recognition) initRecognition(currentLang);
  if (!recognition) return;
  if (listening) recognition.stop();
  else recognition.start();
});

muteBtn.addEventListener('click', () => {
  speechEnabled = !speechEnabled;
  muteBtn.innerHTML = speechEnabled
    ? '<i class="fa-solid fa-volume-high"></i>'
    : '<i class="fa-solid fa-volume-xmark"></i>';
});


// ====== Conocimiento educativo (dataset) ======
const educationalKnowledge = {
  conceptos: {
    'cultura las vegas': {
      response: '📚 La Cultura Las Vegas (8,800–4,600 a.C.) es considerada la primera civilización del Ecuador. Enterraban a sus muertos cerca de sus viviendas con ofrendas, mostrando una temprana relación espiritual entre vivos y difuntos.',
      elements: ['🏛️','⏰','🌱','💀']
    },
    'sincretismo cultural': {
      response: '📖 El sincretismo en Santa Elena es la fusión de creencias prehispánicas con prácticas católicas (1 y 2 de noviembre). No fue mera imposición: ambas cosmovisiones dialogaron y generaron una tradición híbrida vigente.',
      elements: ['⛪','✝️','🕯️','🌺']
    },
    'patrimonio unesco': {
      response: '🏛️ Esta tradición recibió reconocimiento internacional como Patrimonio Cultural Inmaterial (2008). Refuerza su valor por la transmisión intergeneracional y su vigencia contemporánea.',
      elements: ['🏛️','🌍','📜','🎖️']
    }
  },
  ofrendas: {
    'vela': {
      response: '🕯️ La vela simboliza la luz que guía a las almas al altar familiar y la purificación del espacio.',
      elements: ['🕯️','✨','🛤️','👻']
    },
    'agua': {
      response: '💧 El agua representa purificación, renovación y hospitalidad para el ser querido que vuelve.',
      elements: ['💧','🌊','💙','🥤']
    },
    'colada morada': {
      response: '🍷 Bebida ancestral de maíz morado y frutas; simboliza vida, muerte y renacimiento, y fortalece lazos comunitarios.',
      elements: ['🍷','🟣','🌽','🫐']
    },
    'guaguas de pan': {
      response: '👶 Panes con forma de bebé que representan la continuidad del ciclo vital y la memoria cultural.',
      elements: ['👶','🍞','🍼','🔄']
    }
  },
  practicas: {
    'ritual del llamado': {
      response: '🔥 Apertura simbólica del hogar a medianoche o al amanecer para recibir a las almas. Un acto liminal de encuentro.',
      elements: ['🔥','🌅','🚪','🦟']
    },
    'muertear': {
      response: '🚶 Recorridos comunitarios que refuerzan solidaridad y pertenencia. 1/nov (niños), 2/nov (adultos).',
      elements: ['🚶','👨‍👩‍👧‍👦','🍬','🍽️']
    },
    'cementerio': {
      response: '🪦 Visitas con limpieza y decoración de tumbas: continuidad familiar y encuentro intergeneracional.',
      elements: ['🪦','⭐','🕯️','☁️']
    }
  },
  importancia: {
    'identidad cultural': {
      response: '🆔 Actúa como ancla identitaria: pertenencia, continuidad histórica y sentido comunitario.',
      elements: ['🆔','🌍','🏠','💪']
    },
    'transmision generacional': {
      response: '👨‍👩‍👧‍👦 Se enseñan técnicas (colada, altar) y significados simbólicos dentro de la familia.',
      elements: ['👨‍👩‍👧‍👦','🎓','📚','⏰']
    },
    'resistencia cultural': {
      response: '🛡️ Frente a la homogeneización global, la tradición se adapta sin perder su esencia.',
      elements: ['🛡️','⚔️','🏛️','🔄']
    },
    'desarrollo economico': {
      response: '💰 Impacto local: panaderías, florerías, turismo cultural y economía circular.',
      elements: ['💰','🍞','🌸','✈️']
    }
  }
};

// Mapa de frases clave → respuestas (incluye variantes del original)
function processEducationalInput(raw){
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
  function fmt(text, elements=[]){ return {response:text, elements}; }
  function edu(obj){ return fmt(obj.response, obj.elements); }
  function educitional(key){ return fmt(educationalKnowledge.practicas[key].response, educationalKnowledge.practicas[key].elements); }
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
function addEducationalChatMessage(message, isUser=false){
  const box = $('#chatboxMessages');
  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user':'ai'}`;
  div.textContent = message;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function formatEducationalResponse(text, elements=[]){
  if (!elements || !elements.length) return text;
  // una sola fila de iconos (sin duplicar)
  return `${text}\n\n${elements.join(' ')}`;
}

async function handleChatboxInput() {
  const input = $('#chatboxInput').value.trim();
  if (!input) return;

  // Detectar idioma automáticamente
  currentLang = detectLanguage(input);
  const langDisplay = $('#langDisplay');
  langDisplay.textContent =
  currentLang === 'zh-CN' ? 'Idioma: 中文 🇨🇳' :
  currentLang === 'en-US' ? 'Idioma: English 🇬🇧' :
  'Idioma: Español 🇪🇸';

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

//$('#sendChatboxBtn').addEventListener('click', handleChatboxInput);
$('#chatboxInput').addEventListener('keypress', e=>{ if(e.key==='Enter') handleChatboxInput(); });

// ====== Quiz ======
const allQuestions = [
  { question: "¿Cuál es la cultura más antigua relacionada con esta tradición en Santa Elena?", options: ["Valdivia","Chorrera","Las Vegas","Machalilla"], correct: 2, explanation: "La Cultura Las Vegas (8,800–4,600 a.C.) es la más antigua y rinde culto a los difuntos." },
  { question: "¿Cuántos años de tradición tiene el Día de los Difuntos en Santa Elena?", options: ["500 años","2,000 años","8,000 años","1,000 años"], correct: 2, explanation: "Se remonta a la Cultura Las Vegas (8,800–4,600 a.C.), más de 8,000 años." },
  { question: "¿Qué representa la Colada Morada?", options: ["Solo luto","Vida, muerte y renacimiento","Una bebida moderna","Celebración católica"], correct: 1, explanation: "Simboliza vida, muerte y renacimiento; es de origen prehispánico." },
  { question: "¿Cuándo se celebra el Día de los Fieles Difuntos?", options: ["1 de noviembre","2 de noviembre","31 de octubre","15 de noviembre"], correct: 1, explanation: "El 2 de noviembre; el 1 es Todos los Santos." },
  { question: "¿Qué organismo reconoció esta tradición como Patrimonio Cultural?", options: ["ONU","UNESCO","OMS","UNICEF"], correct: 1, explanation: "La UNESCO declaró la tradición Patrimonio Cultural Inmaterial." },
  { question: "¿Qué simboliza la vela en la mesa de los muertos?", options: ["Decoración","Ilumina el camino del alma","Calor","Nada específico"], correct: 1, explanation: "La vela guía a las almas hacia el altar familiar." },
  { question: "¿Cuál es el elemento principal que diferencia la tradición de Santa Elena del resto de Ecuador?", options: ["Colada morada","Mesa de los muertos","Guaguas de pan","Festival de música"], correct: 1, explanation: "La mesa de los muertos es el centro de la celebración local." },
  { question: "¿Qué día es dedicado especialmente a los niños fallecidos en Santa Elena?", options: ["1 de noviembre","2 de noviembre","31 de octubre","15 de diciembre"], correct: 0, explanation: "El 1 de noviembre recuerda a los 'muertos chiquitos'." },
  { question: "¿Qué frase tradicional usan los niños al ‘muertear’?", options: ["Pan pedimos, santos somos...","Ángeles somos, del cielo venimos, pan pedimos","Guaguas traemos","Flores pedimos"], correct: 1, explanation: "La frase completa es 'Ángeles somos, del cielo venimos, pan pedimos'." },
  { question: "¿Qué alimento suele regalarse a los visitantes durante el 'muertear'?", options: ["Colada morada","Arroz","Pan de muerto","Tamales"], correct: 2, explanation: "Se entrega pan de muerto como símbolo de la festividad." },
  { question: "¿Dónde suelen ubicar la mesa de los muertos en Santa Elena?", options: ["En la sala","En el patio","En una habitación especial","En la cocina"], correct: 2, explanation: "Tradicionalmente, en una habitación decorada con tolda blanca." },
  { question: "¿Qué día se cree que las almas de los difuntos adultos visitan a sus familias?", options: ["1 de noviembre","2 de noviembre","Navidad","21 de junio"], correct: 1, explanation: "El 2 de noviembre corresponde a los adultos." },
  { question: "¿Cuál de los siguientes elementos NO está en la mesa de los muertos?", options: ["Fotos del difunto","Velas","Celulares","Alimentos favoritos del fallecido"], correct: 2, explanation: "No se ponen celulares en la mesa de los muertos." },
  { question: "¿Para qué se abren puertas y ventanas durante el ritual del llamado?", options: ["Ventilar la casa","Que entren las almas","Invitar a los vecinos","Dejar salir el humo"], correct: 1, explanation: "Se abren para que las almas puedan entrar al hogar." },
  { question: "¿Qué significa si la comida en la mesa pierde sabor según la tradición?", options: ["Se dañó","Los difuntos vinieron","Hubo mal espíritu","El chef cocinó mal"], correct: 1, explanation: "Indica que el difunto llegó y probó los alimentos." },
  { question: "¿Cuál NO es un alimento tradicional de la mesa santaelenense?", options: ["Tamales de yuca","Caldo de langosta","Pizza","Dulce de mango"], correct: 2, explanation: "La pizza no forma parte de la comida típica tradicional." },
  { question: "¿Cuál es una fruta usada en la Colada Morada?", options: ["Mora","Piña","Sandía","Naranja"], correct: 0, explanation: "La mora es un ingrediente clave en la colada." },
  { question: "El pan de muerto en Santa Elena tiene forma de...", options: ["Cruz","Muñeco","Estrella","Corazón"], correct: 1, explanation: "El pan se elabora en forma de muñeco." },
  { question: "¿Dónde está el sitio arqueológico de Los Amantes de Sumpa?", options: ["Guayas","Manabí","Santa Elena","Pichincha"], correct: 2, explanation: "Los Amantes de Sumpa está en Santa Elena." },
  { question: "¿Qué ritual hacen las familias al visitar los cementerios?", options: ["Llevan flores","Cierran tumbas","Bailan alrededor","Hacen fogatas"], correct: 0, explanation: "Llevan flores y limpian las tumbas." },
  { question: "¿Qué bebida acompaña tradicionalmente la comida del Día de Difuntos?", options: ["Jugo de naranja","Coca Cola","Chicha de maíz","Cerveza artesanal"], correct: 2, explanation: "La chicha de maíz es la bebida tradicional." },
  { question: "¿Qué significa el mantel blanco en la mesa de los muertos?", options: ["Decoración","Pureza y respeto","Simboliza el cielo","Representa alegría"], correct: 1, explanation: "El mantel blanco refleja pureza y respeto." },
  { question: "¿Qué elemento representa la sed del difunto?", options: ["Agua","Sal","Pan","Velas"], correct: 0, explanation: "Un vaso de agua se pone porque el difunto viene sediento." },
  { question: "¿Qué representan las 'mosquitas negras' en la tradición?", options: ["Insectos normales","El alma de los difuntos","Mala suerte","Fortuna"], correct: 1, explanation: "Simbolizan el alma del difunto que visita esa noche." },
  { question: "El ritual del llamado se realiza...", options: ["Al mediodía","Durante el atardecer","A medianoche o amanecer","En la tarde"], correct: 2, explanation: "Se realiza a medianoche o antes del amanecer." },
  { question: "Para los niños fallecidos, además de comida, la familia coloca...", options: ["Dinero","Ropa","Juguetes favoritos","Libros"], correct: 2, explanation: "Se colocan juguetes favoritos en su honor." },
  { question: "¿Qué simboliza la tolda blanca sobre la mesa?", options: ["Separar el mundo terrenal","Cubrir la comida","Atraer la lluvia","Proteger del sol"], correct: 0, explanation: "Simboliza la separación del mundo terrenal y espiritual." },
  { question: "¿Qué tipo de historias se comparten en familia durante la visita al cementerio?", options: ["De terror","Historias de vida del difunto","Chistes","Sobre política"], correct: 1, explanation: "Se comparten recuerdos del ser querido." },
  { question: "¿Cuál es el rol de la Casa de la Cultura de Santa Elena en la tradición?", options: ["Vender velas","Organizar talleres y ferias","Repartir dulces","Cuidar cementerios"], correct: 1, explanation: "Organiza talleres, ferias y mantiene la tradición." },
  { question: "¿Cuál de estos platos es típico en la celebración?", options: ["Picante de pescado salado con yuca","Pizza","Encebollado","Pollo a la brasa"], correct: 0, explanation: "El picante de pescado salado es tradicional." },
  { question: "¿Qué ingrediente ancestral se usaba originalmente en la colada morada?", options: ["Sangre de llama","Azúcar rubia","Papaya","Salchicha"], correct: 0, explanation: "Se usaba sangre de llama en la receta prehispánica." },
  { question: "¿Cuál es uno de los objetivos de presentar pan de muerto en la mesa?", options: ["Alimentar a los vivos","Representar al difunto","Como postre solamente","Proteger la casa"], correct: 1, explanation: "El pan simboliza la presencia del difunto." },
  { question: "¿Quiénes integran el ritual del 'muertear'?", options: ["Solo adultos","Niños y adultos","Solo mujeres","Sacerdotes"], correct: 1, explanation: "Participan niños y adultos de la comunidad." },
  { question: "En la tradición, si la familia no ofrece pan al niño que muertea, este responde:", options: ["Volveré mañana","Ni más venimos","Gracias igual","Que viva el difunto"], correct: 1, explanation: "El dicho tradicional es: Si no nos dan pan, ni más venimos." },
  { question: "¿Cuál es la fruta emblemática de la colada morada, típica de los Andes?", options: ["Ismhpingo","Mortiño","Ciruela china","Tuna"], correct: 1, explanation: "El mortiño da el color y sabor característico a la colada." },
  { question: "¿Por qué se coloca sal en la mesa de difuntos?", options: ["Evitar que los vivos coman","Dar sabor a la comida","Ahuyentar malos espíritus","Como adorno"], correct: 1, explanation: "La sal es para dar sabor y como ofrenda." },
  { question: "¿Cómo se enseña la tradición a las nuevas generaciones?", options: ["A través de talleres y ferias","Por televisión","Sólo en libros","En inglés"], correct: 0, explanation: "Talleres y ferias promueven la transmisión generacional." },
  { question: "¿Qué institución promueve el reconocimiento de la mesa como Patrimonio Cultural Inmaterial?", options: ["INPC","Ministerio de Finanzas","Ministerio de Deportes","Ministerio del Interior"], correct: 0, explanation: "El INPC lidera el proceso de reconocimiento." },
  { question: "¿En qué sentido la tradición reactiva la economía local?", options: ["Ferias, panaderías y florerías","Solo bancos","Inmobiliarias","Hoteles"], correct: 0, explanation: "Impulsa comercios como panaderías, florerías y ferias." },
  { question: "¿Qué platillo NO es típico de la mesa de difuntos?", options: ["Natilla de maíz","Torta de camote","Ceviche de camarón","Hamburguesa"], correct: 3, explanation: "La hamburguesa no pertenece a la tradición." },
  { question: "El color morado de la colada representa...", options: ["Luto y raíces andinas","Realeza","Fiesta","Esperanza"], correct: 0, explanation: "Morado: color del luto y las raíces ancestrales." },
  { question: "¿Qué es una guagua de pan?", options: ["Una fruta","Un muñeco de pan","Una bebida","Un adorno"], correct: 1, explanation: "Guagua de pan es pan en forma de niño/muñeco." },
  { question: "¿Por qué las figuras de pan no tienen brazos?", options: ["Por economía","Simbolizan momificación","Están incompletos","Es solo estilo"], correct: 1, explanation: "Sin brazos: tradición de momificación prohibida por españoles." },
  { question: "¿En qué época del año se observa mayor fervor por la tradición?", options: ["Semana Santa","Navidad","1 y 2 de noviembre","Junio"], correct: 2, explanation: "Aumenta entre el 1 y 2 de noviembre." },
  { question: "¿Quién visita la casa durante la noche del 1 o 2 de noviembre según la creencia?", options: ["Vecinos","Familiares vivos","Almas de los difuntos","Gobernadores"], correct: 2, explanation: "Se cree que las almas regresan a visitar." },
  { question: "¿Qué vegetales o raíces también se incorporan en las recetas tradicionales?", options: ["Zanahoria","Camote y yuca","Tomate","Papa"], correct: 1, explanation: "El camote y la yuca son bases en dulces y tamales." },
  { question: "¿Por qué se coloca una fotografía del difunto en la mesa?", options: ["Para recordarlo","Para identificarlo","Para asustar","Para que no se pierda"], correct: 0, explanation: "La foto es símbolo de su presencia en el hogar." },
  { question: "¿Qué acción se realiza al finalizar el ritual de la mesa?", options: ["Repartir la comida","Dejar la mesa servida por una semana","Quemar la mesa","Despedir a las almas"], correct: 0, explanation: "La comida se reparte cuando termina la conmemoración." },
  { question: "¿Qué significa que la comida en la mesa se le dé a los visitantes?", options: ["Es caridad","Mandato religioso","Solidaridad y comunidad","Parte del ayuno"], correct: 2, explanation: "Compartir la comida une a la comunidad." },
  { question: "El sitio de 'Los Amantes de Sumpa' evidencia...", options: ["Que vivían solos","Antiguos rituales funerarios","Guerra preinca","Comercio marítimo"], correct: 1, explanation: "Demuestra rituales funerarios ancestrales." },
  { question: "¿La celebración es exactamente igual en todo Ecuador?", options: ["Sí","No, varía por región","Sólo en Quito","Solo en la costa"], correct: 1, explanation: "Hay variantes por provincia y contexto rural/urbano." },
  { question: "Uno de los objetivos fundamentales de la celebración es:", options: ["Olvidar a los difuntos","Fortalecer la identidad cultural","Cambiar la religión","Imitar costumbres europeas"], correct: 1, explanation: "La celebración preserva la identidad cultural local." },
  { question: "¿Cuál es el mayor reto actual de la tradición?", options: ["Falta de comida","Modernización y economía","Gobierno","Falta de panaderos"], correct: 1, explanation: "Modernidad y economía amenazan la continuidad." },
  { question: "¿Qué tipo de flores suelen llevarse al cementerio?", options: ["Solas artificiales","Coloridas naturales","Ninguna","Cactus"], correct: 1, explanation: "Se prefieren flores naturales coloridas." },
  { question: "¿Qué práctica es más fuerte en las comunas que en áreas urbanas?", options: ["La mesa de muertos","El fútbol","El comercio","La política"], correct: 0, explanation: "Las comunas rurales mantienen con mayor fervor la tradición ancestral." },
  { question: "¿Qué institución apoya la realización de ferias gastronómicas?", options: ["Casa de la Cultura","Banco Central","Ministerio del Trabajo","INPC"], correct: 0, explanation: "La Casa de la Cultura organiza y apoya ferias." },
  { question: "¿Qué tipo de música suele ambientar estas fechas?", options: ["Religiosa y tradicional","Rock","Electrónica","Reggaetón"], correct: 0, explanation: "Predomina música tradicional/marimba o coros religiosos." },
  { question: "¿Cuál es uno de los beneficios de la celebración para el turismo?", options: ["Aumenta visitas familiares","Reduce el turismo","No tiene impacto","Restringe hoteles"], correct: 0, explanation: "Genera interés turístico cultural." },
  { question: "¿Por qué se encienden velas durante la visita al cementerio?", options: ["Iluminar la tumba","Homenaje a los difuntos","Atraer almas","Por costumbre"], correct: 1, explanation: "Simboliza el homenaje y el camino de luz para las almas." },
  { question: "¿En cuánto tiempo se debe retirar la mesa de muertos en Santa Elena?", options: ["Antes del mediodía","Después de las 16:00","A las 6:00","Al día siguiente"], correct: 1, explanation: "Se levanta después de las 16:00." },
  { question: "¿Qué herramienta digital puede ayudar a preservar la tradición?", options: ["Redes sociales","App de pan","Criptomonedas","Videollamadas"], correct: 0, explanation: "Redes sociales ayudan a difundir y educar sobre la tradición." },
  { question: "¿Quién lanzó oficialmente el proceso de reconocimiento como Patrimonio Inmaterial para la mesa de muertos?", options: ["INPC","UNESCO","Ministerio de Salud","Casa de la Cultura"], correct: 0, explanation: "El INPC lidera oficialmente la gestión." },
  { question: "¿Qué alimento dulce acompaña a menudo la colada morada?", options: ["Arroz con leche","Torta de camote","Pan de muerto","Polvorosa"], correct: 2, explanation: "Guaguas/pan de muerto se sirven junto a colada morada." },
  { question: "¿Qué elemento se pone en la mesa para simbolizar la fertilidad y bienestar?", options: ["Flores de colores","Aguacate","Maíz y frutas","Velas azules"], correct: 2, explanation: "El maíz (principal en la colada y mesa) y frutas simbolizan fertilidad." },
  { question: "¿Cuál de los siguientes NO es un significado de la tradición?", options: ["Identidad cultural","Recuerdo de los ancestros","Celebración comercial","Unión familiar"], correct: 2, explanation: "La celebración no se originó como evento comercial." },
  { question: "¿Por qué la colada morada tiene muchos ingredientes?", options: ["Por abundancia agrícola y simbolismo","Por tradición europea","Por azar","Porque es fácil"], correct: 0, explanation: "Se integran productos locales y simbolizan abundancia." },
  { question: "¿Qué valor resalta la tradición de compartir los alimentos?", options: ["Competencia","Solidaridad","Mercantilismo","Individualismo"], correct: 1, explanation: "Compartir refuerza la solidaridad comunitaria." },
  { question: "¿Qué frase resume el sentir espiritual de la tradición?", options: ["Dios está lejos","Ángeles somos, del cielo venimos","Feliz cumpleaños","Buen provecho"], correct: 1, explanation: "'Ángeles somos...' expresa la esencia espiritual y comunitaria." },
  { question: "¿Qué alimento fermentado puede haber en la mesa?", options: ["Chicha de maíz","Sangría","Yogur","Sidra"], correct: 0, explanation: "La chicha de maíz, fermentada, es típica." },
  { question: "¿Cuál es la posición de la UNESCO frente a la fiesta?", options: ["No la reconoce","La reconoce como Patrimonio Cultural Inmaterial","Obliga su práctica","No opina"], correct: 1, explanation: "UNESCO la reconoce como manifestación patrimonial." },
  { question: "¿Qué representan las flores en la mesa y en la tumba?", options: ["Belleza y fragilidad de la vida","Por moda","Solo por color","Abundancia"], correct: 0, explanation: "Las flores simbolizan la vida y su fragilidad." },
  { question: "Al despedirse, los niños que muerteen reciben...", options: ["Arroz con leche","Fruta y pan de muerto","Dinero","Bendición"], correct: 1, explanation: "Reciben fruta y pan de muerto como detalle." },
  { question: "¿Por qué algunos hoy celebran con menos abundancia?", options: ["Por crisis económica y modernidad","Por ley","Por religión","Por falta de flores"], correct: 0, explanation: "La crisis y modernización afectan la magnitud de la práctica." },
  { question: "Una función formativa clave de la tradición es...", options: ["Enseñar sobre la muerte como parte natural de la vida","Promover el fútbol","Fomentar rivalidades","Aprender inglés"], correct: 0, explanation: "Se enseña a ver la muerte de manera natural." },
  { question: "¿Qué hacen los municipios de Santa Elena para la tradición?", options: ["Cierran ferreterías","Dan apoyo institucional a eventos","Prohíben la fiesta","Entregan regalos"], correct: 1, explanation: "El municipio apoya logística y difusión." },
  { question: "El principal canal de transmisión generacional es...", options: ["La feria y la práctica familiar","Documentales","Educación formal","Noticias"], correct: 0, explanation: "La práctica familiar y la feria/talleres transmiten la tradición." },
  { question: "La esperanza actual de la tradición reside en...", options: ["Jóvenes y educación cultural","Importación de pan","Gobierno central","Nuevas recetas extranjeras"], correct: 0, explanation: "Los jóvenes y la educación sostenida renovarán la tradición." }
];
function getRandomQuestions(arr, count=5){
  const shuffled = arr.sort(()=>Math.random()-0.5);
  return shuffled.slice(0, count);
}

// Inicializa el quiz con 5 preguntas aleatorias
let quizData = getRandomQuestions(allQuestions, 5);

let qIndex = 0;
let score = 0;

function renderQuestion(){
  const container = $('#quiz-container');
  const prog = $('#quizProgress');
  if (qIndex >= quizData.length){ return showResults(); }
  const q = quizData[qIndex];
  const percentage = Math.round((qIndex/quizData.length)*100);
  prog.style.width = percentage + '%';

  container.innerHTML = `
    <h3 class="text-lg font-bold">Pregunta ${qIndex+1} de ${quizData.length}</h3>
    <p class="mt-2">${q.question}</p>
    ${q.options.map((opt,i)=>`
      <div class="quiz-option" data-i="${i}">
        <span class="font-medium">${String.fromCharCode(65+i)})</span> ${opt}
      </div>
    `).join('')}
    <div id="quiz-feedback" class="quiz-feedback" style="display:none"></div>
  `;

  $$('.quiz-option').forEach(opt=>{
    opt.addEventListener('click', ()=> checkAnswer(opt, q));
  });
}

function checkAnswer(el, q){
  const i = parseInt(el.dataset.i);
  const ok = i === q.correct;
  el.classList.add(ok ? 'correct' : 'incorrect');
  const fb = $('#quiz-feedback');
  fb.style.display = 'block';
  fb.textContent = (ok ? '✅ ¡Correcto! ' : '❌ Incorrecto. ') + q.explanation;
  if (ok) score++;
  $$('.quiz-option').forEach(x => x.style.pointerEvents='none');
  setTimeout(()=>{ qIndex++; renderQuestion(); }, 2000);
}

function showResults(){
  const container = $('#quiz-container');
  $('#quizProgress').style.width = '100%';
  const pct = Math.round((score/quizData.length)*100);
  const icon = pct>=80 ? '🎉' : pct>=60 ? '👏' : pct>=40 ? '📚' : '💡';
  const msg  = pct>=80 ? '¡Excelente!' : pct>=60 ? 'Muy bien.' : pct>=40 ? 'Buen intento.' : 'Sigue aprendiendo.';

  container.innerHTML = `
    <div class="text-center">
      <h3 class="text-2xl font-bold">¡Cuestionario completado!</h3>
      <div class="text-5xl" style="margin:10px 0">${icon}</div>
      <p>Tu puntuación: ${score}/${quizData.length} (${pct}%)</p>
      <p class="mt-2">${msg}</p>
      <button id="restartQuiz" class="btn" style="margin-top:12px;background:linear-gradient(90deg,var(--upse-mar),#52c7ba);border:1px solid #52c7ba">Intentar de nuevo</button>
    </div>
  `;
  $('#restartQuiz').addEventListener('click', ()=>{
    qIndex=0; score=0;
    quizData = getRandomQuestions(allQuestions,5); // 🔁 Nuevas 5 preguntas aleatorias
    renderQuestion();
  });
}
// --- Añade esto al final de main.js ---

// ====== Desplegable "Ver más" para tarjetas de componentes ======
(function initVerMas() {
 // Selecciona todos los botones dentro de .learn-card
 const botones = document.querySelectorAll('.learn-card .btn');

 botones.forEach(btn => {
 	btn.addEventListener('click', (e) => {
 	  // 1. Encuentra la tarjeta padre y el contenido adicional
 	  const card = e.target.closest('.learn-card');
 	  const info = card.querySelector('.info-adicional');

 	  // 2. Alterna la clase 'active' en el contenido
 	  const isActive = info.classList.toggle('active');

 	  // 3. Cambia el texto y el ícono del botón
 	  if (isActive) {
 		e.target.innerHTML = 'Ver menos <i class="fa-solid fa-chevron-up"></i>';
 	  } else {
 		e.target.innerHTML = 'Ver más <i class="fa-solid fa-chevron-down"></i>';
 	  }
 	});
 });
})();

// Nota: También asegúrate de que el botón de envío del chat esté activo si lo deseas.
// Descomenta la siguiente línea si quieres que el botón de "enviar" (avión) funcione.
$('#sendChatboxBtn').addEventListener('click', handleChatboxInput);
// Init quiz
renderQuestion();
