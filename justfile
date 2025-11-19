# Justfile for examples.expanso.io

# List all available recipes
default:
    @just --list

# Install dependencies
install:
    npm install

# Start development server with live reload
dev:
    npm start -- --port 3100

# Build for production
build:
    npm run build

# Serve production build locally
serve:
    npm run serve

# Run TypeScript type checking
typecheck:
    npm run typecheck

# Clear Docusaurus cache
clear:
    npm run clear

# Clean build artifacts and cache
clean:
    npm run clear
    rm -rf build .docusaurus

# Full rebuild (clean + install + build)
rebuild: clean install build

# Test production build locally (build + serve)
test-prod: build serve
