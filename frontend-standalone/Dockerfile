FROM node:20-alpine
WORKDIR /app
COPY . ./
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
EXPOSE 3002
CMD ["node", "server.js"]
