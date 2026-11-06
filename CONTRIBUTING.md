# Contributing to Atlas-Index

Thank you for your interest in contributing to **Atlas-Index**! This project is an open-source local search engine designed to help developers keep working seamlessly even during internet outages, relying primarily on personal data input.

To ensure a smooth collaboration, please follow the guidelines below.

## 1. Before You Code (Required)

We strictly require all contributors to follow this workflow before writing any code or opening a Pull Request:

1. **Open an Issue First:** Before starting any work, you must open an issue explaining the feature you want to add or the bug you want to fix. 
2. **Wait for Discussion:** Discuss the proposal with the maintainers within the issue to ensure alignment with the project's goals.
3. **Get Approval:** Once the issue is approved and assigned to you, you can begin working on the code.

## 2. Branch Naming Convention

When creating a new branch to work on your assigned issue, you must strictly follow this naming format:

`issuenumber-typeofissue-branchname`

*Examples:*
* `42-feature-add-sidebar`
* `105-bugfix-resolve-postgres-crash`
* `73-docs-update-readme`

## 3. Local Development Setup

The prerequisites and technical stack for this project include:
* **Tech Stack:** Next.js, Ollama, TypeScript, and pgvector.
* **Prerequisites:** Node.js and Docker.

Please refer to the core **README.md** file of this repository for the complete, step-by-step instructions on how to clone, configure, and run the development environment locally.

## 4. Code Quality & Formatting

* Write clean, readable TypeScript and Next.js code.
* Ensure your code does not break the existing local Docker services (pgvector, Ollama).
* Double-check your code manually for proper formatting and structural consistency before committing.

## 5. Submitting a Pull Request (PR)

1. Push your changes to your remote branch on GitHub.
2. Open a Pull Request from your branch against our main branch.
3. Reference the approved issue number in your PR description (e.g., `Closes #42`).
4. Wait for the project maintainers to review your code.
