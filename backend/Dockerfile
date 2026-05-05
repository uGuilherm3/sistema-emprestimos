FROM node:20-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install --omit=dev

# Copia o código
COPY . .

# Cria a pasta de uploads caso não exista
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "--env-file=.env", "server.js"]
