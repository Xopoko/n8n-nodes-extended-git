# Project Agents and AI Workflow Guide

This repository ships the **Git Extended** node for n8n. The node exposes a wide range of Git commands, enabling autonomous agents in n8n to automate repository maintenance. This guide explains how agents should operate, how to run local tests and how to extend the system.

## Developer Guidelines

- Always run `npm run lint` and `npm test` before committing changes. These commands compile the project and execute all lint and unit tests.
- The environment has **no internet access** after setup. Do not run commands that attempt to fetch packages such as `npm install` or any other network operations.
- Commands for PHP or Swift are unavailable. Avoid `php`, `swift build`, or their respective test commands.
- Use a project-scoped Personal Access Token with only the scopes required for the agent's role (generally `api`).

## 1. Overview of Agent Architecture

Agents run within n8n as workflows. Each agent can call the **Git Extended** node to execute Git commands. The node implementation lives in [`nodes/GitExtended/GitExtended.node.ts`](nodes/GitExtended/GitExtended.node.ts). Agents issue tasks via prompts, n8n plans tool calls and runs Git operations.

## 2. Agent Catalog

| Agent | Purpose | Trigger/Input | Output | Tools/Integrations |
| ----- | ------- | ------------- | ------ | ----------------- |
| **Repo Maintenance Agent** | Manage branches and commits | User prompt or schedule | Branch updates | Git Extended node |
| **Release Manager Agent** | Tag releases and create release branches | User prompt or CI event | Release notes or tags | Git Extended node |
| **Mirror Sync Agent** | Keep remotes synchronized | Schedule or webhook | Push/pull results | Git Extended node |

These roles are suggestions. Agents can be customized for other workflows such as release management or support automation.

## 3. Setup and Dependencies per Agent

1. Install this package in n8n (through Community Nodes or during setup).
2. Ensure the machine running n8n has the `git` binary available and configure **Git Extended Credentials** if authentication is required.
3. Add an **AI Agent** node in n8n, choose an OpenAI Chat model, and attach the **Git Extended** tool with the credentials.
4. Provide a clear prompt describing the task. The agent will then plan tool actions and run the appropriate Git commands.

Keep prompts concise and prefer direct instructions like "fetch", "update", "create", or "delete". If multiple steps are required, describe the end goal and the agent will chain operations.

## 4. Configuration Format and Structure

Agents are configured in n8n workflows. Use the credentials and node settings provided in this repo. The `credentials/` directory contains the credential type definition and `nodes/` contains the node code.

## 5. Invocation Flow & Lifecycle

1. The user (Agent 0) issues a prompt in n8n.
2. The agent interprets the request and plans the necessary Git commands.
3. The agent executes the commands via the **Git Extended** node.
4. Results are returned to the user or logged for later review.

## 6. Debugging and Observability

- Review n8n execution logs to trace agent steps. Enable return of intermediate steps in the AI Agent node for detailed reasoning.
- Use `npm test` locally to ensure the node behaves correctly. Lint issues can be checked with `npm run lint`.
- If a Git command fails, log the error and stop instead of retrying indefinitely.

## 7. Extending or Adding Agents

To extend the system or create a new agent:

1. Implement new node logic or tools under `nodes/` and add any credentials under `credentials/`.
2. Register the node in your n8n workflow and update prompts accordingly.
3. Document the new agent or tool in this file so other contributors and AI agents understand its purpose.

### Prompt Examples

```
• "Clone https://github.com/example/repo.git into /tmp/work"
• "Create a branch `feature/login` and push to origin"
• "Apply patch `fix.patch` then commit and push"
• "List recent commits on branch `main`"
```

## Design Considerations

- Start with read-only or low-impact operations while testing new prompts.
- Monitor agent runs and review logs during development.
- Limit the toolset to what the agent needs for its role. Provide system messages to set boundaries (e.g. "Never delete branches without explicit instruction").
- Remember token and iteration limits. Use filtering parameters (like `--max-count`) when listing large sets of commits or branches.
- If a Git command fails, log the error and stop instead of retrying indefinitely.

Following these guidelines will help agents operate safely and effectively with the Git Extended node.
