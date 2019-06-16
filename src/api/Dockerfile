FROM node:10.16.0-alpine
ADD . /usr/src/api
WORKDIR /usr/src/api
RUN npm install
EXPOSE 3001
CMD ["node", "index.js"]