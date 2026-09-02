FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create placeholder icons for PWA (real icons should be added)
RUN mkdir -p public && \
    echo "placeholder" > public/icon-192.png && \
    echo "placeholder" > public/icon-512.png

EXPOSE 3000

CMD ["npm", "run", "dev"]
