/**
 * RAG-based generation services for documentation, package prompts, and reimplementation
 */
import { streamChat } from './llm.js';
import { queryRag, buildRagContext, isIndexed, QueryOptions } from './ragQuery.js';
import { KeyEntry } from './api-key-pool.js';

/**
 * System prompt for documentation generation
 */
const SYSTEM_PROMPT = `You are an expert technical documentation writer. Your task is to generate comprehensive documentation for a codebase based on the provided code snippets.

Generate documentation with the following structure:

## Overview
A high-level summary of what this project does, its purpose, and key features.

## Architecture
Describe the overall architecture, key design patterns used, and how the major components interact.

## Key Components
List and describe the main components, modules, or classes in the codebase. Explain their responsibilities.

## Data Flow
Explain how data flows through the application, from input to output.

## API Reference
Document any public APIs, endpoints, or interfaces. Include function signatures and brief descriptions.

## Configuration
Describe configuration options, environment variables, and how to customize the application.

## Getting Started
Provide a quick guide on how to set up and run the project.

Use clear, concise language. Include code examples where helpful. Format using Markdown.

Base your documentation ONLY on the code provided. Do not make assumptions about features not present in the code.`;

/**
 * System prompt for package/migration prompt generation
 */
const PACKAGE_PROMPT_SYSTEM = `You are an expert software architect specializing in desktop application development and Electron. Your task is to analyze a SaaS web application codebase and generate a comprehensive one-shot prompt for Claude Code to migrate it to an Electron desktop application.

The user will have both this prompt AND the open source codebase available when using Claude Code.

Generate a prompt with the following structure:

## Migration Overview
Briefly describe what this application does and the key considerations for making it a desktop app.

## Architecture Changes Required
Explain what architectural changes are needed. Focus on:
- How to restructure the client/server model for Electron's main/renderer process
- What backend services need to be embedded vs removed
- How to handle data persistence locally instead of via API

## Step-by-Step Migration Plan
Provide numbered steps for Claude Code to follow. Each step should:
- Explain WHAT needs to be done
- Explain WHY it's needed
- Explain HOW to approach it (conceptually, not with code snippets)

## Key Files to Modify
List the most important files that will need changes and what kind of changes.

## Dependencies to Add/Remove
- List npm packages to add for Electron
- List packages that can be removed (server-only dependencies)

## Configuration Changes
Explain what config/environment changes are needed for desktop mode.

## Testing Considerations
Brief notes on how to verify the migration works.

IMPORTANT GUIDELINES:
- Focus on WHAT and HOW, avoid code snippets unless absolutely critical
- Be concise but comprehensive
- Assume the reader has the full codebase available
- Prioritize the most impactful changes first
- Consider offline functionality, local storage, and desktop-specific features`;

/**
 * System prompt for reimplement prompt generation
 */
const REIMPLEMENT_PROMPT_SYSTEM = `You are an expert software architect. Your task is to analyze a codebase and generate a comprehensive one-shot prompt for Claude Code (an AI engineer) to reimplement the application from scratch.

IMPORTANT CONTEXT:
- Claude Code will have access to the original application's source code
- Claude Code should analyze the original project first before implementing
- For technical details, ask Claude Code to identify what it needs from the original code rather than being prescriptive
- Focus on WHAT needs to be built and the overall HOW, let Claude Code determine specific implementation details

TARGET STACK:
- React 18+ with TypeScript
- Vite as the build tool
- shadcn/ui for all UI components
- Tailwind CSS for styling
- Modern best practices

Generate a prompt with the following structure:

## Instructions for Claude Code

Begin by analyzing the original application codebase provided alongside this prompt. Identify:
- The core functionality and features
- Data structures and state management patterns
- UI components and their behaviors
- API integrations and data flow

Use the original code as your reference for all implementation details.

## Application Overview
Describe what this application does, its core purpose, and the problem it solves. Be specific but concise.

## Core Features to Implement
List every feature that exists in the original application:
- What each feature does from a user perspective
- Key behaviors and interactions
- Reference: "See original implementation in [relevant files]" where appropriate

## Data & State Requirements
Describe the data the application manages:
- What entities/data types exist
- How data flows through the application
- Persistence requirements (localStorage, API, etc.)
- Ask Claude Code to analyze the original code for exact schemas and structures

## User Interface
Describe the screens and navigation:
- Page structure and routing
- Key UI components and their purposes
- Loading states, error handling, empty states
- Recommend shadcn/ui components where applicable (Button, Card, Dialog, etc.)

## User Flows
Document the main user journeys:
- Step-by-step for each major feature
- Form validations and feedback patterns
- Ask Claude Code to reference original code for exact validation rules

## Backend/API Integration
If applicable:
- What endpoints or services the app connects to
- Data fetching patterns
- Ask Claude Code to analyze original API calls for exact request/response structures

## Implementation Approach
High-level guidance:
- Suggest project structure
- Recommend state management approach based on complexity
- Note any complex algorithms or logic that Claude Code should study in the original

CRITICAL RULES:
1. DO NOT implement features that do not exist in the original application
2. DO NOT implement login, user management, authentication, or admin features - this is a single-user application
3. Strip out any auth-related code, user sessions, or multi-user functionality
4. Focus only on the core application functionality

GUIDELINES FOR THE PROMPT:
- Be comprehensive about WHAT but defer to Claude Code for HOW
- Reference the original codebase rather than prescribing exact implementations
- Let Claude Code analyze and decide on technical specifics
- Include all features but exclude auth/user management
- Keep the prompt focused on functionality, not implementation details`;

export interface GeneratorOptions extends QueryOptions {
  model?: string;
}

/**
 * Generate reimplement prompt for a repository using RAG
 */
export async function* generateReimplementPrompt(
  owner: string,
  repo: string,
  options: GeneratorOptions = {}
): AsyncGenerator<string> {
  if (!(await isIndexed(owner, repo))) {
    yield 'No indexed content found for this repository. Please index the repository first.';
    return;
  }

  const searchQuery =
    'features functionality components user interface state management data flow API routes pages application structure';
  const chunks = await queryRag(owner, repo, searchQuery, options, 30);

  if (chunks.length === 0) {
    yield 'No relevant content found for reimplementation analysis.';
    return;
  }

  const context = buildRagContext(chunks);

  const messages = [
    {
      role: 'user' as const,
      content: `Here is the relevant codebase content of an application (retrieved via semantic search for features, components, and application structure):\n\n${context}\n\nPlease analyze this codebase and generate a comprehensive one-shot prompt for Claude Code to reimplement this application using React, Vite, TypeScript, and shadcn/ui.

Remember:
- Claude Code will have access to the original codebase alongside your prompt
- Focus on WHAT needs to be built, let Claude Code determine specific implementation details by analyzing the original code
- Exclude any login, authentication, user management, or admin features - this will be a single-user application
- Only include features that actually exist in the original application

Follow the structure outlined in your instructions.`,
    },
  ];

  for await (const chunk of streamChat(REIMPLEMENT_PROMPT_SYSTEM, messages, options.apiKeys, options.model)) {
    yield chunk;
  }
}

/**
 * Generate documentation for a repository using RAG
 */
export async function* generateDocumentation(
  owner: string,
  repo: string,
  options: GeneratorOptions = {}
): AsyncGenerator<string> {
  if (!(await isIndexed(owner, repo))) {
    yield 'No indexed content found for this repository. Please index the repository first.';
    return;
  }

  const searchQuery =
    'project overview architecture components API configuration setup documentation readme main entry point';
  const chunks = await queryRag(owner, repo, searchQuery, options, 30);

  if (chunks.length === 0) {
    yield 'No relevant content found for documentation generation.';
    return;
  }

  const context = buildRagContext(chunks);

  const messages = [
    {
      role: 'user' as const,
      content: `Here is the relevant codebase content (retrieved via semantic search for documentation topics):\n\n${context}\n\nPlease generate comprehensive technical documentation for this codebase following the structure outlined in your instructions.`,
    },
  ];

  for await (const chunk of streamChat(SYSTEM_PROMPT, messages, options.apiKeys, options.model)) {
    yield chunk;
  }
}

/**
 * Generate package/migration prompt for a repository using RAG
 */
export async function* generatePackagePrompt(
  owner: string,
  repo: string,
  options: GeneratorOptions = {}
): AsyncGenerator<string> {
  if (!(await isIndexed(owner, repo))) {
    yield 'No indexed content found for this repository. Please index the repository first.';
    return;
  }

  const searchQuery =
    'electron desktop application architecture configuration build client server API routes database storage environment';
  const chunks = await queryRag(owner, repo, searchQuery, options, 30);

  if (chunks.length === 0) {
    yield 'No relevant content found for migration analysis.';
    return;
  }

  const context = buildRagContext(chunks);

  const messages = [
    {
      role: 'user' as const,
      content: `Here is the relevant codebase content of a SaaS web application (retrieved via semantic search for architecture and configuration):\n\n${context}\n\nPlease analyze this codebase and generate a comprehensive one-shot prompt that I can give to Claude Code to migrate this application to an Electron desktop app. Follow the structure outlined in your instructions.`,
    },
  ];

  for await (const chunk of streamChat(PACKAGE_PROMPT_SYSTEM, messages, options.apiKeys, options.model)) {
    yield chunk;
  }
}
