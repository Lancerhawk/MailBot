# Contributing to MailBot

First off, thank you for considering contributing to MailBot! It's people like you that make MailBot such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/Lancerhawk/MailBot/issues) to see if someone else has already created a ticket. If not, go ahead and make one!

## Development Setup

To set up your local development environment:

1. **Fork & Clone:** Fork the repository and clone it to your local machine.
2. **Backend Setup:**
   - Navigate to `/backend`
   - Run `npm install`
   - Copy `.env.example` to `.env` and fill in your database, Google, and AI API keys.
   - Run `npx prisma migrate dev` to set up your local database.
   - Start the server with `npm run dev`
3. **Frontend Setup:**
   - Navigate to `/frontend`
   - Run `npm install`
   - Copy `.env.example` to `.env.local`
   - Start the frontend with `npm run dev`

## Branching Strategy

We use a feature-branching model:
- `main` is the stable production branch.
- Create your feature branch off of `main` (e.g., `feature/awesome-new-feature` or `fix/annoying-bug`).

## Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3. You may merge the Pull Request in once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.

## AI API Note
MailBot relies on Groq and Gemini APIs. Please ensure you are not committing any of your personal API keys in your PRs. We use `.env` files which are ignored by git.
