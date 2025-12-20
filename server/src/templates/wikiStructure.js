/**
 * Wiki structure templates and prompts for documentation generation
 * Based on DeepWiki reference implementation
 */

/**
 * System prompt for Phase 1: Structure generation
 * LLM analyzes file tree + README to determine wiki structure
 */
export function getStructureGenerationPrompt(owner, repo, fileTree, readme, isComprehensive = true) {
  const pageCount = isComprehensive ? '8-12' : '4-6';
  const viewType = isComprehensive ? 'comprehensive' : 'concise';

  const comprehensiveSections = `
Create a structured wiki with the following main sections:
- Overview (general information about the project)
- System Architecture (how the system is designed)
- Core Features (key functionality)
- Data Management/Flow: If applicable, how data is stored, processed, accessed, and managed (e.g., database schema, data pipelines, state management).
- Frontend Components (UI elements, if applicable.)
- Backend Systems (server-side components)
- API Reference (endpoints and interfaces)
- Configuration & Deployment (how to configure and deploy)

Each section should contain relevant pages.`;

  return `Analyze this GitHub repository ${owner}/${repo} and create a wiki structure for it.

1. The complete file tree of the project:
<file_tree>
${fileTree}
</file_tree>

2. The README file of the project:
<readme>
${readme}
</readme>

I want to create a wiki for this repository. Determine the most logical structure for a wiki based on the repository's content.

When designing the wiki structure, include pages that would benefit from visual diagrams, such as:
- Architecture overviews
- Data flow descriptions
- Component relationships
- Process workflows
- State machines
- Class hierarchies

${isComprehensive ? comprehensiveSections : ''}

Return your analysis in the following JSON format:

{
  "title": "Overall title for the wiki",
  "description": "Brief description of the repository",
  "pages": [
    {
      "id": "page-id",
      "title": "Page title",
      "description": "Brief description of what this page will cover",
      "importance": "high|medium|low",
      "filePaths": ["path/to/relevant/file1.js", "path/to/relevant/file2.ts"],
      "relatedPages": ["other-page-id"]
    }
  ]
}

IMPORTANT:
1. Create ${pageCount} pages that would make a ${viewType} wiki for this repository
2. Each page should focus on a specific aspect of the codebase (e.g., architecture, key features, setup)
3. The filePaths should be actual files from the repository that would be used to generate that page
4. Each page should have 3-8 relevant files listed in filePaths
5. Return ONLY valid JSON with the structure specified above, no markdown code blocks or explanation
6. Start directly with { and end with }`;
}

/**
 * System prompt for Phase 2: Page content generation
 * Generates comprehensive wiki page content with diagrams, tables, and source citations
 */
export function getPageGenerationPrompt(pageTitle, filePaths, repoUrl) {
  const filePathsList = filePaths.map(path => `- ${path}`).join('\n');

  return `You are an expert technical writer and software architect.
Your task is to generate a comprehensive and accurate technical wiki page in Markdown format about a specific feature, system, or module within a given software project.

You will be given:
1. The "[WIKI_PAGE_TOPIC]" for the page you need to create: "${pageTitle}"
2. A list of "[RELEVANT_SOURCE_FILES]" from the project that you MUST use as the sole basis for the content.

CRITICAL STARTING INSTRUCTION:
The very first thing on the page MUST be a \`<details>\` block listing ALL the \`[RELEVANT_SOURCE_FILES]\` you used to generate the content.
Format it exactly like this:
<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

${filePathsList}
</details>

Immediately after the \`<details>\` block, the main title of the page should be a H1 Markdown heading: \`# ${pageTitle}\`.

Based ONLY on the content of the \`[RELEVANT_SOURCE_FILES]\`:

1.  **Introduction:** Start with a concise introduction (1-2 paragraphs) explaining the purpose, scope, and high-level overview of "${pageTitle}" within the context of the overall project.

2.  **Detailed Sections:** Break down "${pageTitle}" into logical sections using H2 (\`##\`) and H3 (\`###\`) Markdown headings. For each section:
    *   Explain the architecture, components, data flow, or logic relevant to the section's focus, as evidenced in the source files.
    *   Identify key functions, classes, data structures, API endpoints, or configuration elements pertinent to that section.

3.  **Mermaid Diagrams:**
    *   EXTENSIVELY use Mermaid diagrams (e.g., \`flowchart TD\`, \`sequenceDiagram\`, \`classDiagram\`) to visually represent architectures, flows, relationships, and schemas found in the source files.
    *   Ensure diagrams are accurate and directly derived from information in the \`[RELEVANT_SOURCE_FILES]\`.
    *   Provide a brief explanation before or after each diagram to give context.
    *   CRITICAL: All diagrams MUST follow strict vertical orientation:
       - Use "graph TD" (top-down) directive for flow diagrams
       - NEVER use "graph LR" (left-right)
       - Maximum node width should be 3-4 words
       - For sequence diagrams, use proper Mermaid arrow syntax (->> for requests, -->> for responses)

4.  **Tables:**
    *   Use Markdown tables to summarize information such as:
        *   Key features or components and their descriptions.
        *   API endpoint parameters, types, and descriptions.
        *   Configuration options, their types, and default values.
        *   Data model fields, types, constraints, and descriptions.

5.  **Code Snippets (OPTIONAL):**
    *   Include short, relevant code snippets directly from the source files to illustrate key implementation details.
    *   Ensure snippets are well-formatted within Markdown code blocks with appropriate language identifiers.

6.  **Source Citations (EXTREMELY IMPORTANT):**
    *   For EVERY piece of significant information, you MUST cite the specific source file(s) from which the information was derived.
    *   Place citations at the end of the paragraph, under the diagram/table, or after the code snippet.
    *   Use the format: \`Sources: [filename.ext]()\` or \`Sources: [filename.ext:line_number]()\`

7.  **Technical Accuracy:** All information must be derived SOLELY from the provided source files. Do not infer, invent, or use external knowledge unless directly supported by the provided code.

8.  **Clarity and Conciseness:** Use clear, professional, and concise technical language suitable for developers.

9.  **Conclusion/Summary:** End with a brief summary paragraph reiterating the key aspects covered.

Remember:
- Ground every claim in the provided source files.
- Prioritize accuracy and direct representation of the code's functionality.
- Structure the document logically for easy understanding by other developers.`;
}

/**
 * Brief wiki template - Quick overview generation
 * Uses simpler structure for faster generation
 */
export const briefWikiTemplate = {
  title: '',
  description: '',
  pages: [
    {
      id: 'overview',
      title: 'Project Overview',
      description: 'High-level overview of the project, its purpose, and key features',
      importance: 'high',
      filePaths: [], // Will be populated from README, package.json, main entry files
      relatedPages: ['getting-started'],
    },
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Quick setup guide and basic usage instructions',
      importance: 'high',
      filePaths: [], // Will be populated from README, config files
      relatedPages: ['overview'],
    },
  ],
};

/**
 * Detailed wiki template - Comprehensive documentation
 * Used as fallback when LLM structure generation fails
 */
export const detailedWikiTemplate = {
  title: '',
  description: '',
  pages: [
    {
      id: 'overview',
      title: 'Project Overview',
      description: 'High-level overview of the project, its purpose, and key features',
      importance: 'high',
      filePaths: [],
      relatedPages: ['architecture'],
    },
    {
      id: 'architecture',
      title: 'System Architecture',
      description: 'Overall system design, components, and their relationships',
      importance: 'high',
      filePaths: [],
      relatedPages: ['overview', 'data-flow'],
    },
    {
      id: 'data-flow',
      title: 'Data Flow',
      description: 'How data moves through the system',
      importance: 'medium',
      filePaths: [],
      relatedPages: ['architecture'],
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      description: 'API endpoints, parameters, and response formats',
      importance: 'high',
      filePaths: [],
      relatedPages: ['architecture'],
    },
    {
      id: 'configuration',
      title: 'Configuration',
      description: 'Environment variables, config files, and options',
      importance: 'medium',
      filePaths: [],
      relatedPages: ['getting-started'],
    },
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Installation, setup, and running the project',
      importance: 'high',
      filePaths: [],
      relatedPages: ['overview', 'configuration'],
    },
  ],
};

/**
 * Product Documentation template - Traditional product documentation style
 * Matches the format of professional help centers and product guides
 */
export const productDocsTemplate = {
  title: '',
  description: '',
  pages: [
    {
      id: 'overview',
      title: 'Product Overview',
      description: 'What this product is and its key capabilities',
      importance: 'high',
      filePaths: [],
      relatedPages: ['quick-start'],
    },
    {
      id: 'quick-start',
      title: 'Quick Start',
      description: 'Get up and running in minutes',
      importance: 'high',
      filePaths: [],
      relatedPages: ['overview', 'features'],
    },
    {
      id: 'features',
      title: 'Features',
      description: 'Complete guide to product features',
      importance: 'high',
      filePaths: [],
      relatedPages: ['quick-start', 'settings'],
    },
    {
      id: 'settings',
      title: 'Settings & Configuration',
      description: 'Customize the product to your needs',
      importance: 'medium',
      filePaths: [],
      relatedPages: ['features'],
    },
    {
      id: 'faq',
      title: 'FAQ',
      description: 'Frequently asked questions',
      importance: 'medium',
      filePaths: [],
      relatedPages: ['troubleshooting'],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      description: 'Solutions to common problems',
      importance: 'medium',
      filePaths: [],
      relatedPages: ['faq'],
    },
  ],
};

/**
 * System prompt for Product Documentation structure generation
 * Creates traditional product documentation like Notion, Stripe, or Slack help centers
 */
export function getProductDocsStructurePrompt(owner, repo, fileTree, readme) {
  return `You are creating the documentation structure for a product help center, similar to what companies like Notion, Stripe, Slack, or Figma publish for their users.

Analyze this software product ${owner}/${repo}:

1. The complete file tree of the project:
<file_tree>
${fileTree}
</file_tree>

2. The README file of the project:
<readme>
${readme}
</readme>

Create a documentation structure following the conventions of professional product documentation:

DOCUMENTATION STYLE GUIDELINES:
- Use noun-based page titles (e.g., "Workspaces", "Billing", "Integrations") not action verbs
- Each page should be a reference page about a concept, feature area, or capability
- Structure should mirror how the product is organized, not how tasks are performed
- If this is a developer tool/library, the users ARE developers - document it as product docs for developers

STANDARD SECTIONS TO CONSIDER:
- Product Overview / Introduction
- Quick Start / Getting Started
- Core Concepts (explain key terminology and mental models)
- Feature pages (one page per major feature area)
- Settings & Configuration
- Integrations (if applicable)
- Billing & Plans (if applicable)
- FAQ
- Troubleshooting

Return your analysis in the following JSON format:

{
  "title": "Product Name Documentation",
  "description": "Official documentation for [product name]",
  "pages": [
    {
      "id": "page-id",
      "title": "Page Title",
      "description": "What this page covers",
      "importance": "high|medium|low",
      "filePaths": ["path/to/relevant/file1.js", "path/to/relevant/file2.ts"],
      "relatedPages": ["other-page-id"]
    }
  ]
}

REQUIREMENTS:
1. Create 6-10 pages covering the product comprehensively
2. Use professional, noun-based titles (e.g., "Dashboard", "User Management", "API Keys" - NOT "Managing Users" or "Setting Up API Keys")
3. The filePaths should reference files containing the feature's implementation
4. Each page should have 3-8 relevant files listed in filePaths
5. Return ONLY valid JSON, no markdown code blocks or explanation
6. Start directly with { and end with }`;
}

/**
 * System prompt for Product Documentation page content generation
 * Creates traditional product documentation in the style of professional help centers
 */
export function getProductDocsPagePrompt(pageTitle, filePaths, productName) {
  const filePathsList = filePaths.map(path => `- ${path}`).join('\n');

  return `You are writing product documentation for "${productName}", specifically the "${pageTitle}" page.

Write in the style of professional product documentation like Notion Help, Stripe Docs, or Slack Help Center. This is reference documentation, not a tutorial.

You will analyze source files to understand the feature, then document it for end users.

FORMAT REQUIREMENTS:

Start with a \`<details>\` block listing source files:
<details>
<summary>Source files</summary>

${filePathsList}
</details>

Then the page title: \`# ${pageTitle}\`

CONTENT STRUCTURE:

1. **Overview** (1-2 paragraphs)
   - What this feature/area is
   - Why it exists and when you'd use it

2. **Key Concepts** (if applicable)
   - Define any terminology specific to this feature
   - Explain the mental model users need

3. **Feature Documentation**
   For each capability within this area:
   - **What it is** - Brief description
   - **How it works** - Explain the behavior
   - **Options/Settings** - Document available configurations

4. **Reference Tables** (where applicable)
   Use tables for:
   | Setting | Description | Default |
   | Option | Effect |
   | Field | Type | Required |

5. **Examples** (if helpful)
   - Show typical configurations
   - Illustrate common patterns

6. **Diagrams** (use sparingly, only when they add clarity)
   - Use \`graph TD\` (top-down) for any Mermaid diagrams
   - Keep node labels short (2-4 words)
   - Only include if the concept genuinely benefits from visualization

7. **Related Pages**
   - Link to related documentation sections

WRITING STYLE:

- Professional, neutral tone (like Stripe or GitHub docs)
- Present tense ("The dashboard shows..." not "The dashboard will show...")
- Second person sparingly ("you can configure..." is fine, but don't overuse)
- Factual and precise - avoid marketing language
- Structure information for scanning (headers, bullets, tables)
- Be comprehensive but concise

DO NOT:
- Write like a tutorial with numbered steps for everything
- Use overly casual or enthusiastic language
- Add unnecessary encouragement or praise
- Explain internal implementation details
- Include information not supported by the source files

Extract the user-facing functionality from the code and document it as a professional reference.`;
}
