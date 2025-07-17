# Use official Node.js image
FROM node:22-slim


# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Set environment variables and ports
ENV NODE_ENV=production
EXPOSE 5000

# Run the app from src/
CMD ["node", "-r", "dotenv/config", "--experimental-json-modules", "src/index.js"]
