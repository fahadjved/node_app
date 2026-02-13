FROM node:22-alpine
WORKDIR /var/task
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD [ "node", "index.js" ]
