# Use the official Node.js image as the base image
FROM node:16

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install the project dependencies
RUN npm ci

# Copy the rest of the application code (including tsconfig and basic.ts) to the container
COPY . .

# Compile the TypeScript code to JavaScript
RUN npm run build

# Set the command to run your TypeScript script
CMD [ "node", "dist/basic.js" ]
