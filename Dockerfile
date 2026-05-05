# Estágio 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências
RUN npm install --legacy-peer-deps

# Copia o restante dos arquivos
COPY . .

# Gera o build de produção
RUN npm run build

# Estágio 2: Serve
FROM nginx:stable-alpine

# Copia os arquivos estáticos do build anterior para o diretório de assets do nginx na subpasta sistemas
COPY --from=build /app/dist /usr/share/nginx/html/sistemas

# Copia uma configuração customizada do nginx para lidar com SPA (React Router) e rotas
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
