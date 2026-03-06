# Development Dockerfile for NestJS
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Expose NestJS default port
EXPOSE 4000

# Run in development mode with hot reload
CMD ["npm", "run", "start:dev"]