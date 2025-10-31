// --- IMPORTACIONES DE AMBOS PROYECTOS ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fetch = require('node-fetch'); // <-- (de muertos)
require('dotenv').config(); // <-- (de muertos)

// --- INICIALIZACIÓN DE DIHM (GESTOS) ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- MIDDLEWARE DE AMBOS PROYECTOS ---
// --- Opciones para servir archivos estáticos (para Unity WebGL) ---
const staticOptions = {
  setHeaders: function (res, filePath) {
    // Si el archivo es un .br (Brotli), añade el header de Content-Encoding
    if (filePath.endsWith('.br')) {
      res.setHeader('Content-Encoding', 'br');
    }
    
    // Asigna el Content-Type correcto según la extensión
    if (filePath.endsWith('.wasm.br')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.data.br')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    } else if (filePath.endsWith('.framework.js.br')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
};

// --- MIDDLEWARE DE AMBOS PROYECTOS ---
app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public'), staticOptions)); // <-- DEBE TENER 'staticOptions'

// --- LÓGICA DE API DE MUERTOS (CHATBOT) ---
app.post("/api/openai", async (req, res) => {
  const userMsg = req.body.message || "";

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un asistente educativo de la UPSE especializado en la celebración del Día de los Difuntos en Santa Elena, Ecuador."
          },
          { role: "user", content: userMsg }
        ]
      })
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("Error en respuesta OpenAI:", data);
      return res.status(500).json({
        reply: `⚠️ Error del servidor de IA: ${data.error?.message || "desconocido"}`
      });
    }

    const reply = data.choices?.[0]?.message?.content || "⚠️ Sin respuesta generada.";
    res.json({ reply });

  } catch (err) {
    console.error("Error al contactar con OpenAI:", err);
    res.status(500).json({
      reply: "⚠️ Error al conectar con el servidor de IA."
    });
  }
});

// --- RUTAS WEB DE DIHM (GESTOS) ---

// 'GET /' es manejado por express.static, sirviendo 'public/index.html' (el chatbot)

// Ruta para la página principal del proyecto de gestos
app.get('/gestos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'gestos.html'));
});

app.get('/camera', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'camera.html'));
});

app.get('/slides', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'slides.html'));
});

// --- LÓGICA DE SOCKET.IO DE DIHM (GESTOS) ---
io.on('connection', (socket) => {
    console.log('✅ Cliente conectado :', socket.id);
    
    socket.on('create-room', (roomCode) => {
        socket.join(roomCode);
        console.log(`🏠 Sala ${roomCode} creada por ${socket.id}`);
    });
    
    socket.on('join-room', (roomCode) => {
        socket.join(roomCode);
        console.log(`[Servidor] Evento 'join-room' recibido para ${roomCode}. Enviando confirmación...`);
        console.log(`🚪 ${socket.id} se unió a la sala ${roomCode}`);
        socket.emit('room-joined-success', roomCode);
    });

    // --- Lógica de Gesto (¡Esta ya estaba bien!) ---
    socket.on('gesture-data', (data) => {
        const rooms = Array.from(socket.rooms);
        const roomCode = rooms.find(room => room !== socket.id);

        if (roomCode) {
            socket.broadcast.to(roomCode).emit('control-object', data);
        }
    });
    
    // --- 'manual-control' CORREGIDO (ahora usa salas) ---
    socket.on('manual-control', (data) => {
        console.log('🎮 Control manual:', data);
        
        // Aplicamos la misma lógica de sala que en 'gesture-data'
        const rooms = Array.from(socket.rooms);
        const roomCode = rooms.find(room => room !== socket.id);

        if (roomCode) {
            socket.broadcast.to(roomCode).emit('control-object', data);
        }
    });

    // --- Un solo 'disconnect' handler ---
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
        // Socket.io maneja automáticamente el abandono de salas.
    });
});

// --- INICIO DEL SERVIDOR UNIFICADO ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor UNIFICADO corriendo en http://localhost:${PORT}`);
    console.log(`💬 Chatbot (Homepage) en: http://localhost:${PORT}/`);
    console.log(`👋 Gestos (Homepage) en: http://localhost:${PORT}/gestos`);
    console.log(`📷 Cámara de Gestos en: http://localhost:${PORT}/camera`);
});
