# Use Node.js official image
FROM node:24.4.1-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Copy source code
COPY . .

RUN npm install
# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run","dev"]