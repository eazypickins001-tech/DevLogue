# MASTER BUILD PROMPT: BUILD-IN-PUBLIC CONTENT ENGINE

## 1. Your role

Act as a senior full-stack engineer, AI automation architect, product designer, and pragmatic technical co-founder.

Your task is to design, build, test, and prepare for deployment a production-minded application called **Build-in-Public Content Engine**.

This application will help a solo software builder document real development work and transform it into useful, engaging content for Instagram, YouTube, and other supported platforms, with GoHighLevel (GHL) serving as the primary social publishing and scheduling destination.

Do not merely produce a technical plan, mockup, prototype, or collection of disconnected scripts. Build a working application in the existing repository, following the repository's conventions and the available integrations.

Work autonomously where safe. Inspect the codebase, make reasonable decisions, implement functionality, run tests, fix errors, and document what remains.

Do not ask me to make decisions that can be resolved through repository inspection, official documentation, or sensible engineering judgment. Ask only when a decision genuinely blocks progress or requires my authorization.

## 2. My development environment and constraints

My current working environment includes:

- OpenCode, used through Windows CMD.
- CommandCode, another coding agent available in my workflow.
- GitHub for source control and repository management.
- Vercel for application deployment.
- GoHighLevel for marketing automation and social media scheduling.
- AI models and providers that may be available through existing configurations, including OpenRouter.
- Local files, terminal access, and project repositories available to the coding environment, subject to its actual permissions.

Important constraints:

1. I no longer use Google Apps Script for this project.
2. Do not build the application in Google Sheets or Apps Script.
3. Do not assume I have a paid Claude Code subscription.
4. Do not introduce mandatory paid SaaS subscriptions or unnecessary recurring expenses.
5. Prefer free, open-source, already-installed, and already-connected tools.
6. Prefer Vercel-compatible infrastructure, existing GitHub integrations, and local processing where practical.
7. Never hardcode API keys, access tokens, passwords, or other secrets.
8. Do not assume that an integration is connected merely because a CLI, connector, MCP server, or configuration file exists.
9. Do not expose secrets in terminal output, logs, generated content, commits, browser responses, or documentation.
10. Avoid unnecessary complexity, premature microservices, and elaborate infrastructure.

First inspect the current repository, installed tooling, environment configuration, and existing integrations. Reuse working components where appropriate.

Do not overwrite unrelated projects or files. If the current directory is not an appropriate application repository, explain the issue and identify the safest next step before creating files elsewhere.

## 3. Product vision

Build a reusable system that makes documenting and marketing my software-building process a natural part of development.

The application should transform authentic development activity into a continuous content pipeline:

**Build → Capture → Understand → Generate → Edit → Review → Approve → Publish → Learn.**

I should be able to work on a software product, capture useful moments, and have the system prepare social media assets from the actual work performed.

The application must support multiple projects rather than being hardcoded for one product.

Potential projects include:

- AI applications and procurement intelligence software.
- Google Sheets alternatives and business productivity tools.
- SaaS products and desktop applications.
- Developer tools and automation systems.
- Experimental applications, prototypes, and internal tools.

The system should help me build an audience before launching products, collect feedback from potential users, identify early testers, and eventually support product launches and waiting lists.

## 4. Product principles

Follow these principles throughout implementation:

### Authenticity

Never invent a feature, successful test, performance improvement, customer, testimonial, or business outcome.

Distinguish between completed work, work in progress, proposed work, and unverified claims.

Generate content from evidence wherever possible.

### Low operating cost

Prefer free or locally available tools. Avoid paid APIs for tasks that can be completed with existing models or local software.

Show estimated or known costs when the relevant provider exposes them. Never fabricate token prices or usage charges.

### Human control

Nothing may be published publicly without explicit user approval.

AI-generated text, edited videos, scheduled posts, and destructive file operations must remain under appropriate user control.

### Reusable architecture

The application should support multiple projects, multiple content formats, multiple model providers, and multiple publishing channels without requiring a rewrite.

### Progressive automation

Implement a reliable manual workflow first. Add automation where it demonstrably reduces repetitive work.

### Maintainability

Use modular code, typed interfaces, clear boundaries, tests, migrations, and actionable error messages.

## 5. Phase zero: inspect before building

Before implementing anything, inspect:

- Current working directory and Git status.
- Repository structure and existing documentation.
- Framework, package manager, runtime, and deployment configuration.
- Existing application routes, components, design system, and authentication.
- Available environment variables by name only, never print their values.
- Existing AI integrations and their supported models.
- Existing GoHighLevel integration and its actual capabilities.
- Available GitHub access and repository permissions.
- Available local video, audio, transcription, and image-processing tools.
- Available MCP servers, connector integrations, and command-line tools where discoverable.
- Existing deployment configuration and persistence mechanisms.

Use installed commands and available tools rather than assuming capabilities.

Create or update a concise implementation document describing the discovered architecture, constraints, and decisions.

If a working application already exists, extend it instead of replacing it.

If there is no application, select a suitable Vercel-compatible architecture based on current stable tooling and the actual environment.

Do not stop after writing the architecture document. Proceed with implementation.

## 6. Core application modules

### Module A: Project workspace

Create a dashboard for managing multiple software projects.

Each project should support:

- Project name and description.
- Problem being solved.
- Target users.
- Product stage.
- Repository URL, where available.
- Development environment or working directory reference.
- Project goals and milestones.
- Features completed.
- Features in progress.
- Known bugs and unresolved questions.
- Target audience and positioning.
- Preferred content platforms.
- Preferred tone and content formats.
- Public launch status.
- Optional landing page and waiting-list URL.
- Sensitive information and publication exclusions.

Allow me to create, edit, archive, and switch between projects.

Each project's content history must remain associated with the correct project.

Do not require access to a private repository to document a project manually.

### Module B: Build session capture

Create a dedicated interface for documenting development sessions.

Support at least three capture methods.

**1. Manual session log**

Allow me to record:

- What I worked on.
- The problem encountered.
- Why the problem mattered.
- What I changed.
- What I learned.
- What worked.
- What failed.
- What remains unfinished.
- The next task.
- Relevant screenshots, recordings, and files.
- Whether the material is safe to publish.

Provide a quick-entry form that takes as little time as practical.

**2. GitHub and Git activity**

Where authorized access exists, collect relevant development evidence such as:

- Commit messages.
- Changed file paths.
- Pull request descriptions.
- Pull request status.
- Release notes.
- Relevant issue updates.
- Changes between two commits or releases.

Prefer existing authenticated integrations over building a second authentication system.

Summarize changes in plain language, but distinguish commit descriptions from verified application behavior.

Do not claim a feature works merely because code was committed.

Never publish source code, secrets, proprietary business logic, or private repository details without explicit authorization.

**3. Recording and visual evidence**

Support linking or uploading:

- Screen recordings.
- Short video clips.
- Screenshots.
- Images of application features.
- Audio notes or transcriptions.
- Relevant demonstration assets.

Support associating a recording with a particular project and build session.

Allow manual timestamps and notes identifying important moments.

Where practical, provide a local capture workflow that works alongside the developer's terminal and editor.

Do not assume a Vercel-hosted web application can continuously record a user's desktop or read arbitrary local files. Those capabilities require explicit local tooling, permissions, or user-provided uploads.

If local desktop capture is implemented, isolate it as an optional component and document its installation and permissions.

### Module C: Development session intelligence

Create an AI-assisted analysis step that converts raw session information into a structured development summary.

Extract:

- The original problem.
- The attempted solution.
- The actual changes made.
- Evidence supporting the changes.
- Test results.
- Failures and lessons learned.
- The current project status.
- Unresolved questions.
- The most interesting demonstration.
- The potential audience benefit.
- Possible content angles.

Use structured output with schema validation.

If evidence is insufficient, identify missing information rather than generating an unsupported claim.

Support reviewing and correcting the summary before content generation.

### Module D: AI content studio

This is a core module.

Generate multiple content assets from a single approved build-session summary.

Support the following formats.

**Short-form video**

- Instagram Reels.
- YouTube Shorts.
- Other vertical-video platforms when configured.

**Written content**

- Instagram captions.
- LinkedIn posts.
- X posts and threads.
- YouTube titles and descriptions.
- Educational posts.
- Product development updates.
- Launch announcements.
- Waiting-list invitations.
- Developer tutorials.
- Lessons learned.
- Problem-and-solution stories.

**Long-form content**

- YouTube video outlines.
- Longer tutorial scripts.
- Technical case studies.
- Build-session summaries.
- Product changelog articles.

Do not generate every format automatically if doing so creates unnecessary costs. Let me choose the desired formats and batch-generate them.

For short-form videos, generate a structured storyboard containing:

- Opening hook.
- Scene number.
- Scene duration.
- Narration.
- On-screen text.
- Visual instructions.
- Relevant source clip or screenshot.
- Editing instructions.
- Transition suggestions.
- Call to action.
- Estimated final duration.

Support approximately 30 to 60-second videos, while allowing other lengths.

Ensure scene durations add up to the target runtime.

The output should be usable for actual editing, not just a block of marketing prose.

### Module E: Content quality and authenticity

Implement a review process that checks:

- Does the content accurately represent the session?
- Are all claimed outcomes supported by evidence?
- Is the hook relevant to the target audience?
- Is the content understandable to a nontechnical viewer?
- Does the content demonstrate something concrete?
- Does the call to action fit the project stage?
- Is the content unnecessarily repetitive?
- Does the content disclose confidential information?
- Are there unverified claims that require correction?

Generate content variants where useful.

Avoid generic AI phrases, fabricated excitement, exaggerated results, and unsupported claims.

Allow me to edit every generated asset.

Maintain a clear distinction between the original evidence, AI-generated draft, user edits, and approved version.

### Module F: Video production pipeline

Build a practical path from raw recordings to publishable video.

Do not assume that an AI model can automatically create a finished video from any recording without additional tools.

Start by supporting the following workflow:

1. Attach or upload a recording.
2. Generate or import a transcript where supported.
3. Identify useful timestamps and moments.
4. Create a storyboard based on the actual footage.
5. Associate each scene with its relevant clip or screenshot.
6. Generate narration and on-screen captions.
7. Produce editing instructions.
8. Assemble a draft video using available processing tools.
9. Preview the result.
10. Allow correction, replacement, trimming, and approval.
11. Export a final asset suitable for the intended platform.

Investigate whether FFmpeg and suitable local transcription tools are available.

Prefer local processing for routine editing, clipping, resizing, audio extraction, and subtitle rendering when practical.

Do not require a paid video-generation API for the basic workflow.

If automatic video assembly is feasible with the installed tools, implement it. Otherwise, provide a working storyboard, timestamped clip list, captions, and a clear editing workflow as the initial deliverable.

Keep video processing separate from ordinary web requests because processing can be resource-intensive.

Do not block normal dashboard usage while a video is processing.

Validate output dimensions, duration, audio presence, and file integrity where feasible.

Support vertical 9:16 output for short-form content, with safe margins for captions and platform interface elements.

Provide a configurable option for voice-over or recorded narration.

Do not synthesize or clone a person's voice without appropriate authorization.

### Module G: Content calendar and publishing queue

Create a visual content calendar and queue.

Support statuses such as:

- Captured.
- Analyzed.
- Draft generated.
- Editing required.
- Ready for review.
- Approved.
- Scheduled.
- Published.
- Failed.
- Archived.

Each content item should track:

- Project.
- Build session.
- Content format.
- Target platform.
- Caption or script.
- Media assets.
- Approval status.
- Scheduled time and timezone.
- Publishing provider.
- External post ID when available.
- Publication URL when available.
- Error details.
- Retry history.

Prevent accidental duplicate scheduling.

Support calendar views, filtering, and searching.

Allow content to be regenerated without losing the previously approved version.

### Module H: GoHighLevel integration

Use my existing GoHighLevel setup as the primary publishing and scheduling destination.

First inspect the actual connected integration and its available methods.

Determine whether it supports:

- Social account discovery.
- Social planner access.
- Media upload.
- Draft creation.
- Post scheduling.
- Post publication.
- Publication status.
- Post metrics or analytics.
- Webhooks or status callbacks.

Verify each capability against the actual connector schema or current official documentation.

Do not invent endpoint paths, request fields, scopes, or supported channels.

Implement only verified capabilities.

Where an API operation requires a location ID, social account ID, OAuth scope, token, or other identifier, discover or request it safely.

Never assume the required credentials are present.

If the existing connector can create and schedule posts, use it.

If direct scheduling is unavailable but a supported API allows draft creation, implement draft creation and explain the remaining manual step.

If neither capability is available, prepare exportable assets and a clear handoff workflow.

Use an adapter interface so the publishing provider can be replaced later.

Provide a test mode that does not publish publicly.

Before scheduling or publishing, require explicit approval of both the content and the intended account, date, and time.

Do not automatically publish an AI-generated post merely because its draft is complete.

### Module I: Instagram and YouTube publishing

Support platform-specific preparation and publishing where the necessary official APIs and permissions are available.

For Instagram, investigate the applicable professional-account requirements, media requirements, publishing permissions, and publishing limits.

For YouTube, investigate OAuth authorization, video upload requirements, privacy settings, and relevant API restrictions.

Do not assume personal accounts and professional accounts have identical capabilities.

Prefer GHL as the publishing layer if it already supports the desired account and media format.

Avoid implementing redundant direct platform integrations unless they solve a verified limitation.

If direct publishing is necessary, implement a separate provider adapter and keep credentials secure.

Provide a manual publishing fallback for unsupported actions.

Default newly uploaded videos to private or unlisted when the publishing workflow supports it and public publishing has not been explicitly authorized.

Never make a video public without explicit approval.

### Module J: AI provider abstraction

Create a provider-independent AI layer.

Inspect any existing model integrations and reuse them where appropriate.

Potential providers may include OpenRouter and other available compatible APIs.

Requirements:

- Provider configuration through environment variables or secure application settings.
- Model selection configurable per task.
- Structured output validation.
- Timeouts and retry policies.
- Clear handling of rate limits.
- Cost and token usage tracking when the provider exposes the data.
- Graceful error handling.
- A manual editing fallback if generation fails.
- No hardcoded model assumptions.
- No secret values in logs.

Use inexpensive models for straightforward tasks where appropriate, and reserve more capable models for tasks that demonstrably benefit from them.

Do not call a model unnecessarily when deterministic code can do the job.

Do not store API keys in client-side code or expose them to the browser.

### Module K: Waiting list and audience feedback

Support the business goal behind building in public.

For each project, allow:

- A launch or waiting-list URL.
- A call-to-action template.
- A target audience.
- A feedback collection link.
- A product testing invitation.
- A launch milestone.

Track useful audience feedback manually or through verified integrations.

Allow feedback to be tagged as:

- Feature request.
- Bug report.
- Product question.
- Potential customer.
- Early tester.
- General reaction.

Where supported by existing GHL integrations, connect relevant leads or contacts to the correct project and campaign.

Do not automatically send unsolicited messages or add people to marketing lists without the necessary permissions and consent.

### Module L: Performance and learning

Create an initial analytics dashboard showing:

- Build sessions documented.
- Content drafts generated.
- Videos completed.
- Posts approved.
- Posts scheduled.
- Posts published.
- Publication failures.
- Available audience metrics.
- Feedback received.
- Waiting-list signups where measurable.

Import engagement metrics only where the connected platform or provider actually exposes them.

Distinguish measured results from manually entered data.

Use analytics to help answer:

- Which hooks attract attention?
- Which projects generate the most interest?
- Which formats are worth repeating?
- Which posts generate useful feedback?
- Which content leads to waiting-list signups?

Avoid pretending that views or likes automatically indicate product-market fit.

## 7. Application architecture

Choose an architecture after inspecting the existing repository.

If starting from scratch, a reasonable default is:

- A TypeScript-based Next.js application compatible with Vercel.
- A clean, responsive dashboard.
- Server-side routes or server actions for appropriate operations.
- A persistent database suitable for the existing environment.
- Object storage for recordings, screenshots, and rendered videos.
- An abstraction for AI providers.
- An abstraction for publishing providers.
- Background processing for long-running tasks.
- GitHub integration where useful.
- Optional local processing tools for recording and video editing.

Do not treat this list as permission to install every service.

Select the minimum set of dependencies that can deliver the required functionality reliably.

Vercel functions have execution, memory, and payload constraints. Do not process large video files or perform long-running media rendering inside ordinary request handlers if that is unsuitable for the deployed runtime.

Investigate appropriate alternatives, including local workers, separate background workers, or an existing automation platform.

Choose the lowest-cost viable option and document any limitations.

Avoid introducing a new paid database, storage provider, or queue service unless necessary.

If an existing database or storage service is already connected, prefer it.

If a new service is required, explain the cost implications and implement a minimal configuration.

## 8. Data model and security

Design a clear, versioned data model.

At minimum, consider entities for:

- Users.
- Projects.
- Build sessions.
- Session evidence.
- GitHub references.
- Media assets.
- Transcripts.
- AI analyses.
- Content drafts.
- Storyboards.
- Rendered videos.
- Content approvals.
- Scheduled posts.
- Publishing accounts.
- Publishing jobs.
- Feedback.
- Waiting-list references.
- Usage records.
- Integration settings.

Use appropriate relationships, constraints, and indexes.

Persist content and workflow state in a real database rather than relying on browser memory or temporary application state.

Implement authentication and authorization appropriate to the existing environment.

Even if the first version is for one user, do not expose private projects or credentials through public routes.

If multi-user support is unnecessary for the initial version, design the schema so it can be added later without a full rewrite.

For uploaded media:

- Validate file type and size.
- Use safe filenames.
- Avoid trusting client-supplied MIME types alone.
- Restrict access to private assets.
- Use signed upload or download URLs when appropriate.
- Keep secrets and private media out of public storage by default.
- Avoid executing uploaded files.
- Provide clear retention and deletion behavior.

Implement authorization checks on server-side operations, not just hidden UI buttons.

## 9. Privacy and repository safety

Development sessions can contain sensitive information.

The system must recognize that recordings, terminals, source code, environment files, customer information, and browser sessions may expose secrets.

Implement a privacy-conscious capture and review workflow.

At minimum:

- Warn users before uploading recordings.
- Allow assets to be marked private.
- Provide a redaction or exclusion workflow.
- Never intentionally include environment-variable values, API keys, passwords, private tokens, or authentication cookies in generated content.
- Avoid uploading entire repositories when selected commits or summaries are sufficient.
- Do not automatically send raw recordings or private source code to an external model without an explicit, documented user-controlled workflow.
- Do not commit local secrets.
- Never publish directly from a repository scan without human review.
- Make deletion and data retention behavior clear.

If automated secret detection is available through installed tools, use it to inspect material before external processing or publication.

Do not claim perfect redaction. Provide warnings and manual review for uncertain cases.

## 10. User interface and experience

Build a clean, professional dashboard with a practical design rather than an oversized analytics interface.

The main navigation should include:

1. Dashboard.
2. Projects.
3. Build Sessions.
4. Content Studio.
5. Video Production.
6. Publishing Calendar.
7. Feedback.
8. Analytics.
9. Integrations.
10. Settings.

The dashboard should answer five questions quickly:

- What did I build recently?
- What content is ready?
- What still needs my review?
- What is scheduled for publication?
- What should I work on next?

Prioritize a useful daily workflow.

Include loading states, empty states, error messages, form validation, and success feedback.

Do not use placeholder buttons that do nothing.

Do not represent mock data as real connected-account information.

If integrations are disconnected, show their actual connection state and a clear setup path.

Ensure the interface works on desktop and mobile.

## 11. Testing and quality assurance

Implement testing alongside development.

At minimum, test:

- Project creation and editing.
- Build-session creation and editing.
- Evidence association.
- Structured AI output validation.
- Content regeneration and versioning.
- Approval transitions.
- Privacy and authorization rules.
- Media upload validation.
- Scheduling validation.
- Duplicate-scheduling prevention.
- Provider errors and retry behavior.
- Timezone handling.
- GHL integration using a safe test mode.
- Video-processing behavior where implemented.
- Deployment build and production configuration.

Use mocks for external services in automated tests.

Never use a real public post as an integration test.

If credentials are missing, test the integration adapter using mocks and provide an explicit checklist for live verification.

Run the available formatter, linter, type checker, and test suite.

Fix errors introduced by your implementation.

Do not claim a test passed unless you actually ran it and observed the result.

## 12. Build execution strategy

Work in small, coherent implementation phases.

### Phase 1: Foundation

- Inspect the repository.
- Establish the architecture.
- Implement authentication or appropriate access protection.
- Implement the database schema and migrations.
- Build the main dashboard and project management.
- Implement build-session capture.

### Phase 2: AI content generation

- Implement the AI provider abstraction.
- Implement evidence-based session analysis.
- Generate captions, hooks, scripts, and storyboards.
- Add content editing, versioning, and review.
- Add privacy checks.

### Phase 3: Video workflow

- Implement asset management.
- Add transcript and timestamp support where practical.
- Add storyboard-to-clip mapping.
- Integrate available local media-processing tools.
- Implement video rendering where feasible.
- Provide a usable fallback if fully automated rendering is not possible.

### Phase 4: Publishing integration

- Inspect and implement the verified GHL capabilities.
- Build account and channel configuration.
- Implement approved draft handoff or scheduling.
- Add status tracking and failure handling.
- Verify platform requirements before implementing direct integrations.

### Phase 5: Hardening

- Run tests.
- Fix bugs.
- Improve accessibility and responsiveness.
- Audit authorization and secrets handling.
- Verify deployment configuration.
- Write setup and operational documentation.

Do not postpone all testing until the end.

At the end of each phase, report the completed functionality, the tests performed, and the remaining blockers. Then proceed to the next phase unless a genuine external dependency prevents progress.

## 13. Definition of done

The first usable version is complete when all of the following are true:

1. I can create and manage multiple projects.
2. I can document a development session manually.
3. I can attach screenshots and other relevant evidence.
4. I can optionally associate GitHub commits or pull requests.
5. I can generate a structured summary of a session.
6. I can generate multiple content formats from that summary.
7. I can edit and approve content.
8. I can create a storyboard for a short video.
9. I can associate scenes with actual recordings or screenshots.
10. I can save and retrieve content across sessions.
11. I can manage content statuses and a publishing calendar.
12. The application can hand off content to GHL or create drafts or scheduled posts through verified supported capabilities.
13. Public publishing requires explicit approval.
14. Integration failures are visible and recoverable.
15. Credentials and private assets are protected.
16. The application builds and its available automated tests pass.
17. Setup, configuration, and deployment instructions are documented.
18. Missing external credentials are clearly identified without preventing unrelated functionality from working.

Fully automated video rendering and direct publishing through every social platform are advanced capabilities. Implement them where feasible, but do not falsely mark them complete if a required local tool, credential, subscription, permission, or API capability is unavailable.

## 14. Working rules for the coding agent

Follow these rules throughout the project.

- Inspect before modifying.
- Reuse existing working code.
- Prefer complete, coherent implementations over disconnected patches.
- Preserve unrelated changes in the working tree.
- Never discard uncommitted work.
- Do not use destructive Git commands without explicit authorization.
- Do not commit or push changes without permission unless the repository's established workflow explicitly authorizes it.
- Never invent credentials, IDs, API endpoints, test results, or integration capabilities.
- Use official documentation or verified connector schemas for external integrations.
- Keep API keys in environment variables or secure secret storage.
- Include safe example environment variables in `.env.example`, without actual secret values.
- Keep generated content separate from source evidence.
- Require human approval before external publication.
- Use accessible UI patterns and clear error messages.
- Do not install unnecessary dependencies.
- Do not add features that do not contribute to the core workflow.
- If something cannot be completed, implement the safest useful fallback and explain precisely what is blocked.
- Never silently replace a working integration with fake data.

When documentation is required, keep it concise, current, and useful for future maintenance.

Do not generate dozens of planning documents. Prioritize working software.

## 15. Final handover

When the implementation reaches a meaningful usable state, provide a concise report containing:

**A. What was built**

Describe the actual working features.

**B. Architecture**

Identify the framework, database, storage, AI provider, video-processing approach, and publishing integration actually implemented.

**C. Files changed**

Summarize the main modules and configuration files created or modified.

**D. Tests**

List the commands run, the results observed, and any outstanding failures.

**E. Required configuration**

List required environment-variable names, external account permissions, and integrations that still need user authorization. Never reveal secret values.

**F. Running locally**

Give the exact commands to install dependencies, configure the environment, run migrations, and start the application.

**G. Deployment**

Explain how to deploy through the existing Vercel and GitHub workflow, including any required database, storage, or background-worker setup.

**H. Remaining limitations**

Identify anything incomplete, mocked, unverified, or dependent on credentials or unavailable tools.

**I. First-use workflow**

Explain exactly how I should document my next development session and turn it into a piece of content.

**J. Cost**

Distinguish free, already available, and potentially paid services. Do not claim that the entire solution is free if any required service has usage charges or account restrictions.

## Final instruction

Begin by inspecting the current repository and environment.

Then implement the application in the phases above, using the existing stack and integrations wherever possible.

Your objective is to deliver a genuinely useful first version that I can use during my next real development session, not just a proposal for what might eventually be built.

Start now.