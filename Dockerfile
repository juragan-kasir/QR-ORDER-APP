# ---- Stage 1: build ----
FROM node:22-alpine AS build
WORKDIR /app

# copy package*.json first, then npm ci → this layer is cached, so a change
# that only touches src/ does not reinstall dependencies
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_* is baked into the JS at BUILD time, not when the container runs.
# vite.config.ts refuses a production build that targets localhost/127.0.0.1;
# unset falls back to https://api-bisa-nota.vercel.app.
ARG VITE_API_BASE_URL
RUN npm run build

# ---- Stage 2: serve ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
