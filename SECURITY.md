# Security and Safety Policy

## Default operating mode

BossAI 电商AI员工军团 Skill runs in **draft-and-plan-only** mode by default.

It may:

- read user-supplied local files;
- analyze evidence and business context;
- create local Markdown and JSON outputs;
- run local tests;
- prepare drafts, SOPs, task cards, acceptance criteria, and approval checklists.

It does not include credentials, platform login automation, background services, telemetry, remote data collection, or automatic customer communication.

## Human approval boundary

A human must explicitly approve the specific action before any external tool is used to:

- publish content;
- send customer or prospect messages;
- log into or control ecommerce/social accounts;
- change listings, prices, ads, permissions, orders, or customer records;
- purchase, pay, refund, compensate, or issue credits;
- delete data;
- make public revenue, delivery-time, compliance, refund, or performance commitments.

Generated permission language does not itself grant permission. The executing Agent must use the actual tool result to prove completion.

## Evidence safety

- Unsupported ideas are labeled low-confidence and converted into verification tasks.
- User statements, market facts, Agent inferences, and proposed actions must remain distinguishable.
- Sources, links, dates, customer quotes, market size, revenue, conversion, and test results must never be fabricated.
- Demonstration data must remain marked as demonstration data.
- Sensitive customer or order data should be minimized, redacted, and kept local unless the user explicitly selects an approved destination.

## File safety

The CLI writes only to the output path selected by the user. The installer writes only to:

- its stable install directory;
- the selected Agent Skill directory;
- the optional project workspace Skill directory;
- `outputs/self-test` inside the install directory during verification.

The installer does not delete user business data. It only replaces files inside its own install and Skill directories and removes its own prior `outputs/self-test` directory.

## Reporting a vulnerability

Do not disclose credentials, customer records, order data, private repository content, or exploit details in a public Issue. Contact the project owner through an authorized private channel and provide reproducible details with sensitive data removed.
