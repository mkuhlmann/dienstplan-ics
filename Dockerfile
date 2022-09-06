FROM node:alpine as build-stage
WORKDIR /app
COPY . /app
RUN npm install && npx prisma generate && npm run build

FROM node:alpine as run-stage
WORKDIR /app
COPY --from=build-stage /app /app
RUN npm prune --omit dev
CMD ["npm", "run", "docker"]
