# Stage 1 - the build process
FROM node:17 as build-deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build

# Stage 2 - the production environment
FROM node:17
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y aria2 chromium
COPY --from=build-deps /usr/src/app .
CMD [ "node", "dist/index.js" ]
