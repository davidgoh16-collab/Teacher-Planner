# Stage 1: Build the Vite React App
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Build the application. The Gemini API key is NEVER baked into the client bundle; it is only
# read server-side at runtime from process.env.GEMINI_API_KEY. The Firebase web key is injected
# at runtime via /env.js, so no build-time API-key args are needed.
RUN npm run build

# Stage 2: Serve with Node.js (Cloud Run style)
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only (express, firebase-admin, @google/genai, ...).
COPY package*.json ./
RUN npm install --omit=dev

# Copy the built SPA and the server.
COPY --from=builder /app/dist ./dist
COPY server.js .

EXPOSE 8080

# VITE_FIREBASE_API_KEY and GEMINI_API_KEY are supplied at runtime (e.g. Cloud Run env vars).
# server.js exposes only VITE_FIREBASE_API_KEY to the browser via /env.js.
CMD ["node", "server.js"]
