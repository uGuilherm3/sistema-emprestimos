# Estágio 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências
RUN npm install

# Copia o restante dos arquivos
COPY . .

# Passa as variáveis de build (Vite precisa delas no tempo de build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Gera o build de produção
RUN npm run build

# Estágio 2: Serve
FROM nginx:stable-alpine

# Copia os arquivos estáticos do build anterior para o diretório do nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia uma configuração customizada do nginx para lidar com SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
