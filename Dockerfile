FROM node:alpine as build-stage
WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY . /app
RUN npx prisma generate && npm run build

FROM node:alpine as run-stage
WORKDIR /app
COPY --from=build-stage /app /app
RUN npm prune --omit dev
CMD ["npm", "run", "docker"]
