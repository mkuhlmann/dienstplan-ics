FROM node:alpine as build-stage
WORKDIR /app
COPY . /app
RUN npm install && npx prisma generate && npm run build

FROM node:alpine as run-stage
WORKDIR /app
COPY --from=build-stage /app /app
RUN rm -R node_modules
RUN npm install --only=production && npx prisma generate
CMD ["npm", "run", "docker"]
