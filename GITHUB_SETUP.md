# Push ClassCircle to GitHub

1. Visit https://github.com/new and create a **private**, empty repository (no automatically generated README or `.gitignore`). Suggestion: `classcircle`.
2. Reply in ChatGPT with its exact URL, e.g. `https://github.com/your-username/classcircle`.
3. ChatGPT can use the connected GitHub integration to create the source files on its default branch, if your GitHub connection grants access to that repository.
4. Review the commit and connect the repository to your selected hosting service.

If uploading manually, extract this ZIP and upload the **contents** of the `classcircle-open/` folder into your GitHub repository. Do not upload the ZIP as one opaque file if you want code editing and auto deployments.

The repo can include `.dev.vars.example`, but must **never include** `.dev.vars`, `.env`, actual database URLs, client secrets, Gemini/Groq API keys, OAuth secrets or other private credentials. Those belong in hosting-provider secrets. The `.gitignore` already excludes common secret files.

For the Neon setup, follow `NEON_DEPLOY.md`. For D1 use `README.md`.
