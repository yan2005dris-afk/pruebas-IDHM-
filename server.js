const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Lógica de Socket.io
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado:', socket.id);

  // Escuchar eventos de gestos desde 'camera.html'
  socket.on('gesture-data', (data) => {
    // Retransmitir esos datos a 'lienzo.html'
    // 'socket.broadcast.emit' envía a todos MENOS al que lo envió
    socket.broadcast.emit('control-object', data);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
