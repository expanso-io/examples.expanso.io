# Expanso Examples

Pipeline patterns and runnable examples for [Expanso Edge](https://expanso.io).

🌐 **Live Site:** [examples.expanso.io](https://examples.expanso.io)

## What's Inside

This repository contains curated examples of Expanso Edge pipelines with:

- 📥 **Downloadable YAML files** - Configurations to adapt and validate for your environment
- 📖 **Detailed documentation** - Step-by-step explanations
- 🔗 **Component references** - Links to full documentation
- ▶️ **Quick start commands** - Test examples locally

## Structure

```
examples.expanso.io/
├── docs/              # Example documentation (MDX)
├── examples/          # Pipeline YAML files
├── static/            # Images and assets
└── src/               # React components and styling
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Serve production build locally
npm run serve
```

## Deployment

The executable deployment defined in this repository is GitHub Pages: `.github/workflows/deploy.yml` builds and deploys the site after changes land on `main`.

Legacy URL redirects are defined in `docusaurus.config.ts`. Docusaurus emits them as static redirect pages, so they work on the GitHub Pages deployment without separate host rules. DNS, custom-domain, or any external proxy ownership is managed outside this repository and must be verified separately before changing hosts.

## Related

- 📚 [Main Documentation](https://docs.expanso.io) - Concepts, guides, and component reference
- 🌐 [Expanso Website](https://expanso.io) - Product information
- ☁️ [Expanso Cloud](https://cloud.expanso.io) - Deploy and manage pipelines

## License

Copyright © 2024 Expanso, Inc.
