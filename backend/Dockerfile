FROM node:20-alpine

# Install ping (iputils) for connectivity tests
RUN apk add --no-cache iputils

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
