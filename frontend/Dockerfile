# Stage 1: Base dependencies
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Development target
FROM base AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Stage 3: Builder target (compiles production code)
FROM base AS builder
COPY . .
RUN npm run build

# Stage 4: Production runner target
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
