# Usar una imagen oficial de Node.js
FROM node:18-slim

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiar el package.json y package-lock.json
COPY package*.json ./

# Instalar las dependencias del servidor
RUN npm install

# Copiar el resto de los archivos del proyecto
COPY . .

# Exponer el puerto que usa el servidor
EXPOSE 3000

# Comando para iniciar la aplicación
CMD [ "node", "server.js" ]
