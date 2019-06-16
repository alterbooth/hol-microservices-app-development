FROM node:10.16.0-alpine
ADD . /usr/src/web
WORKDIR /usr/src/web
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]