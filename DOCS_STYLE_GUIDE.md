# Expanso Documentation Style Guide

**For writing and reviewing Expanso documentation.**

This guide ensures our documentation is accessible, accurate, and aligned with our product vision. Use this when creating or reviewing any documentation.

---

## Our Documentation Philosophy

**Expanso serves a spectrum of users** — from teams building their first data pipeline through our visual UI to DevOps engineers deploying automated edge infrastructure. We meet users where they are through progressive disclosure: visual quick starts get beginners to success in minutes, while comprehensive YAML references serve teams who need GitOps and automation.

**We lead with the simplest path to value.** Quick starts use the UI. Guides show the problem and solution visually, with YAML available for those who need it. Component references are lean specs. Advanced docs cover automation and API integration. This isn't about choosing "UI-first" or "code-first" — it's about matching the documentation to the user's journey.

**Our examples are readable and maintainable, not clever hacks.** Every pipeline we document should be something you could understand, modify, and hand off to a teammate without needing AI assistance. We prefer built-in processors over custom transformations, simple solutions over clever ones, and clarity over technical prowess. Like industry standard documentation (Stripe, AWS, Twilio), we appropriately omit production concerns like comprehensive error handling, retry logic, and monitoring — those belong in separate production guides.

**We trust our users' technical ability.** They don't need verbose explanations or marketing justifications. They need accurate information, working examples, and respect for their time. We write like knowledgeable colleagues, not salespeople.

---

## ✍️ Documentation & Editorial Guidelines

**Role:** You are a Senior Technical Editor and Staff Engineer. Your goal is not just to write documentation, but to minimize "Time to Joy" (TTJ)—the time it takes for a user to get a successful result.

### 1. The Framework (Diátaxis)
Before writing or editing any documentation, you must strictly classify the content into one of these four quadrants. Do not mix them.

* **Tutorial (Learning-oriented):** A lesson. Focus on the *student*.
    * *Style:* "Do this, then do that." Linear, opinionated, guaranteed success.
    * *Goal:* The user completes a specific task and feels capable.
    * *Anti-pattern:* explaining abstract concepts or providing alternatives.
* **How-To Guide (Problem-oriented):** A recipe. Focus on the *task*.
    * *Style:* "If you want X, do Y." Steps can be non-linear.
    * *Goal:* Solve a specific real-world problem (e.g., "How to rotate API keys").
    * *Anti-pattern:* teaching basic concepts (assume some competence).
* **Reference (Information-oriented):** A dictionary. Focus on the *product*.
    * *Style:* Dry, accurate, exhaustive. Lists, tables, specs.
    * *Goal:* Description and specification.
    * *Anti-pattern:* Instructional steps or "hello world" examples.
* **Explanation (Understanding-oriented):** A textbook. Focus on the *concept*.
    * *Style:* Discursive, explanatory, connecting context.
    * *Goal:* Clarify "Why" and "How it works."
    * *Anti-pattern:* Code snippets or instruction sets.

### 2. The Editorial Voice
* **Active Voice Only:** (Bad: "The file should be saved." Good: "Save the file.")
* **Second Person:** Address the user as "you."
* **No Wall of Text:** If a paragraph has >3 sentences, break it. Use bullets.
* **Front-Load Value:** Put the answer first, then the explanation.
* **Code First:** If explaining code, show the snippet *before* describing what it does.

### 3. The "Time to Joy" Checklist
Run this mental check on every output:
1.  **Prerequisites check:** Did I list exactly what they need installed *before* they start?
2.  **Copy-Pasteability:** Are code blocks complete? Do they include imports? Can the user blindly copy-paste and run this?
3.  **Verification:** Did I tell the user *how* to know if it worked? (e.g., "You should see a JSON response like this...")

### 4. Formatting Rules
* **Files:** Use `AGENTS.md` or `CLAUDE.md` conventions.
* **Headings:** Use sentence case (e.g., "Configure the database" not "Configure The Database").
* **Bold:** Use bold **only** for UI elements ("Click **Save**") or critical warnings. Do not bold key concepts; let the structure highlight them.
* **Links:** Do not use "click here." Link the noun (e.g., "See the [API Reference](...)").

### 5. Tone, Voice & Personality: "The Wry Staff Engineer"

**The Vibe:** You are a Senior Staff Engineer writing to a Peer. You are smart, slightly opinionated, efficient, and allergic to fluff. You respect the reader's intelligence.

**1. Ruthless Conciseness (The "No Fluff" Rule)**
* **Kill the Preamble:** Never start with "In the modern landscape of data..." or "Expanso is a powerful tool that..." Start with the verb.
    * *Bad:* "To begin the process of installation, you will need..."
    * *Good:* "Install the binary:"
* **Banned Words (Strict):** Do not use: *delve, leverage, tapestry, robust, seamless, cutting-edge, thrilling, paramount, landscape, realm.*
* **No "Happy Talk":** Do not congratulate the user for basic tasks ("Congratulations! You installed the CLI!"). Just move to the next step.

**2. Engineered Humor & Personality**
* **Be Conversational, Not Corporate:** Write like a human on Slack, not a press release. Contractions are mandatory (use "don't," not "do not").
* **The "Wry Wit" Protocol:** You are allowed 1-2 moments of dry humor per document, specifically to acknowledge pain points.
    * *Example:* "DNS is always the problem, except when it's BGP. Here's how to fix the DNS record..."
    * *Example:* "We're going to use XML here. We're sorry, but the legacy system demands it."
* **The "Danger Zone":** NEVER use humor in:
    * Warning blocks (`WARN`, `DANGER`).
    * Code samples (keep variable names professional, no `foo/bar`, use `production_db`).
    * Error messages.

**3. Peer-to-Peer Respect**
* Assume the user is smart but tired.
* Don't over-explain basic concepts (e.g., don't define "what is JSON").
* If a step is hacky, admit it. ("This is a temporary workaround until V2 releases. It's ugly, but it works.")

**4. The "TL;DR" Enforcement**
* Every document longer than one screen must start with a **TL;DR** block containing the summary or the "Copy-Paste" command that solves 80% of use cases.

---

## Documentation Types

Choose the right documentation type for your content.

### Quick Decision Guide

**Ask yourself: What does the user want to accomplish?**

| User Says | Write This |
|-----------|------------|
| "Show me it works fast" | **Quick Start** |
| "I need to process logs from edge" | **Example** (task solution) |
| "How to send data to multiple outputs" | **Example** (task solution) |
| "How does Expanso help with log processing?" | **Use Case** (business overview) |
| "Explain how Bloblang works" | **Guide** (feature deep-dive) |
| "What are Grok patterns?" | **Guide** (concept explanation) |
| "What does the `json` processor do?" | **Component Reference** |
| "Teach me pipelines from scratch" | **Tutorial** (future, if needed) |

### Detailed Descriptions

### Use Case
**Purpose:** High-level overview of business scenario and how Expanso solves it
**Audience:** Decision makers, architects evaluating Expanso
**Format:** Problem description → Expanso's approach → Benefits → Patterns → Links to examples
**User mindset:** "How does Expanso solve [business problem]?"
**Characteristics:**
- Business/industry-focused (not technical how-to)
- Conceptual overview with links to technical examples
- Emphasizes benefits and outcomes
- May include conceptual patterns but NOT complete pipelines
- Links to relevant examples, guides, and components

**Example:** "Log Processing at Edge" - business value, approach, benefits, links to technical examples

### Quick Start
**Purpose:** Get user to first success in under 5 minutes
**Audience:** First-time users, evaluators
**Format:** Pure UI walkthrough with screenshots
**User mindset:** "Show me it works NOW"
**Example:** "Create your first pipeline" with visual builder steps

### Example
**Purpose:** Complete pipeline solution for a specific task or use case
**Audience:** Users implementing a particular scenario
**Format:** Problem statement → complete working configuration → explanation
**User mindset:** "Show me a working solution for my specific problem"
**Characteristics:**
- Task-oriented and standalone (can read in any order)
- Complete, copy-paste ready YAML
- Real-world scenarios (log processing, metrics collection, data routing)
- Brief explanation of what it does and how to customize

**Example:** "Process Logs from Edge Devices" - complete pipeline with explanation

### Guide
**Purpose:** Deep-dive explanation of a feature, concept, or capability
**Audience:** Users wanting to master a specific feature
**Format:** Conceptual explanation → detailed examples → best practices
**User mindset:** "Help me understand how this feature works"
**Characteristics:**
- Feature-focused, not task-focused
- Comprehensive coverage of a capability
- Multiple examples showing different aspects
- Reference material users return to

**Example:** "Bloblang Transformations" - comprehensive guide to the transformation language

### Tutorial (Future)
**Purpose:** Sequential learning path that builds understanding from fundamentals
**Audience:** Users wanting structured onboarding or comprehensive learning
**Format:** Chapter 1 → Chapter 2 → Chapter 3 (must be followed in order)
**User mindset:** "Teach me how this works from the ground up"
**Characteristics:**
- Sequential chapters that build on each other
- Cannot skip around (each builds on previous)
- Single continuous narrative
- Teaches mental model and core concepts

**Example:** "Pipeline Fundamentals: From Basic to Advanced" with progressive chapters

**Note:** Only create tutorials if Quick Starts + Examples + Guides aren't sufficient. Wait for user feedback before investing in tutorial content.

### Component Reference
**Purpose:** Document what a component does and its configuration options
**Audience:** Users looking up specific component details
**Format:** Lean, factual YAML spec documentation
**User mindset:** "What does this processor do and what are its options?"
**Example:** Individual processor, input, or output documentation page

---

## Documentation Structure

Our documentation is organized into 6 top-level sections:

```
docs/
├── getting-started/     # Quick Start, Building Pipelines, Core Concepts
├── components/          # 206 component reference pages
├── use-cases/           # Business scenarios and value propositions
├── guides/              # Feature deep-dives (Bloblang, Grok, etc.)
├── examples/            # Task-oriented pipeline solutions
├── operations/          # Deployment, config, monitoring, troubleshooting
└── references/          # API, CLI, configuration schema
```

### Type to Location Mapping

| Documentation Type | Goes In | Example Files |
|-------------------|---------|---------------|
| Quick Start | `getting-started/` | quick-start.mdx, building-pipelines.mdx |
| Use Case | `use-cases/` | log-processing.mdx, iot-aggregation.mdx |
| Example | `examples/` | log-processing/production-pipeline.mdx, data-routing/fan-out-pattern.mdx |
| Guide | `guides/` | bloblang.mdx, grok-patterns.mdx |
| Component Reference | `components/` | inputs/file.md, processors/json.md |
| Operations | `operations/` | deployment/edge-deployment.mdx, monitoring/fleet-monitoring.mdx |
| API/CLI Reference | `references/` | cli/commands.mdx |

### Current Status

**Exists:**
- ✅ getting-started/ (quick-start, core-concepts, installation)
- ✅ components/ (206 components across inputs, processors, outputs)
- ✅ use-cases/ (6 business scenario overviews)
- ✅ guides/ (bloblang, grok-patterns)
- ✅ examples/ (with categories: data-routing, data-security, data-transformation, log-processing)
- ✅ operations/ (configuration, deployment, monitoring)
- ✅ references/ (CLI documentation)

### Naming Conventions

**Directory Names:**

**Top-level directories = PLURAL** (collections of items)
- ✅ `examples/` - collection of examples
- ✅ `guides/` - collection of guides
- ✅ `components/` - collection of components
- ✅ `use-cases/` - collection of use cases
- ✅ `operations/` - collection of operational topics
- ✅ `references/` - collection of reference materials

**Exception:** `getting-started/` - singular because it describes a single journey/experience

**Subcategories = SINGULAR** (topic names)
- ✅ `operations/deployment/` - deployment topic
- ✅ `operations/monitoring/` - monitoring topic
- ✅ `examples/data-routing/` - routing patterns
- ✅ `examples/log-processing/` - log processing patterns

**Rule Summary:** All top-level folders are plural (collections) except `getting-started/` which represents a singular user journey. Subcategories use singular because they represent specific topics, not collections.

---

## Core Principles

### 1. Start Simple, Enable Complexity

Always show the simplest working solution first, then progressively add complexity.

**Good:** Basic pipeline → add error handling → add advanced transformations
**Bad:** Starting with a 50-line Bloblang transformation

**Review question:** Does this show the simplest version before the complex version?

### 2. Prefer Built-In Over Custom

Use existing processors and built-in functionality before writing custom Bloblang transformations.

**Good:** Use `json`, `csv`, `grok_parser`, `branch` processors when applicable
**Bad:** Writing 30 lines of Bloblang to parse JSON when the `json` processor exists

**Review question:** Could we use a built-in processor instead of custom code?

### 3. Problem Before Solution

Start with what challenge this solves, then show how to solve it.

**Structure:**
1. Brief problem statement (1-2 sentences)
2. Solution overview (what we'll build)
3. Implementation (working example)
4. What's next (links to related docs)

**Review question:** Is it clear what problem this solves?

### 4. Readable and Maintainable Examples

Every example should be understandable and modifiable without AI assistance. Avoid clever hacks that "just work" but scare users away.

**Good:** Clear structure, uses built-in processors, each step has obvious purpose
**Bad:** 50+ lines of complex Bloblang, nested conditionals, requires deep expertise to modify

**What we appropriately omit:** Like industry standard docs (Stripe, AWS, Twilio), we skip comprehensive error handling, retry logic, and monitoring in examples. These belong in separate production guides.

**Review question:** Can an intermediate user understand and modify this without AI assistance?

### 5. Match Format to User Journey

Choose the right format for each documentation type:
- **Quick Starts** → Pure UI (fastest path to success)
- **Examples** → YAML with brief explanations (copy-paste ready)
- **Guides** → Mix of explanation and code examples (teaching depth)
- **Component Reference** → YAML specs (lean, factual)
- **Tutorials (future)** → Progressive: UI → YAML → advanced

**Review question:** Does the format match the documentation type and user's goal?

### 6. One Source of Truth

Document common procedures once in a canonical location. Link to that location from other pages rather than repeating content.

**Good:** Installation steps in one place, linked from guides
**Bad:** Repeating deployment instructions in every example

**Review question:** Are we repeating something that's documented elsewhere?

### 7. Trust, Don't Over-Explain

Assume technical competence. Skip verbose justifications and marketing language. Get to the point.

**Good:** "This pipeline processes logs and sends alerts for errors."
**Bad:** "This revolutionary pipeline leverages cutting-edge edge computing to dramatically reduce costs by processing logs at the source, enabling real-time alerting that can save..."

**Review question:** Are we respecting the reader's time and intelligence?

---

## Content Quality Checklists

Use these checklists before publishing any documentation. All content must pass the Universal checklist plus the type-specific checklist.

### Universal Quality (All Content Types)

These apply to examples, guides, tutorials, and all documentation:

- [ ] Can an intermediate user understand this without AI assistance?
- [ ] Could someone modify this without breaking everything?
- [ ] Can you explain what it does in one sentence?
- [ ] No marketing language or superlatives
- [ ] Conversational but technical tone
- [ ] All links work and point to relevant content
- [ ] Removed all template instruction comments
- [ ] Does it show the simplest solution first?

### Example-Specific Checklist

For task-oriented pipeline solutions (`docs/examples/`):

**Complexity:**
- [ ] Pipeline is copy-paste ready and functional
- [ ] Uses built-in processors when possible (avoid complex Bloblang)
- [ ] If using Bloblang, is it under 10 lines per processor?
- [ ] Complex transformations are broken into clear steps

**Structure:**
- [ ] Starts with clear problem statement (what task this solves)
- [ ] Complete working example shown early
- [ ] Brief explanations focus on "why" not just "what"
- [ ] Includes practical customization variations
- [ ] Common setup steps linked, not repeated

**Content:**
- [ ] Links to related examples
- [ ] Links to component references used
- [ ] Links to relevant guides for deeper understanding
- [ ] Inline comments explain non-obvious parts

### Guide-Specific Checklist

For feature/concept deep-dives (`docs/guides/`):

**Structure:**
- [ ] Clear explanation of what this feature is and when to use it
- [ ] Overview builds the mental model before diving into details
- [ ] Simple examples before advanced patterns
- [ ] Each example focuses on one concept
- [ ] Progressive complexity (basic → advanced)

**Content:**
- [ ] All code examples are tested and functional
- [ ] Best practices are actionable and based on real usage
- [ ] Common pitfalls addressed with solutions
- [ ] Links to examples that use this feature
- [ ] Links to related guides and component docs

**Quality:**
- [ ] No examples requiring AI assistance to understand
- [ ] Inline comments explain complex logic
- [ ] Scannable structure with clear headings

### Tutorial-Specific Checklist

For sequential learning paths (`docs/tutorials/`):

**Sequential Structure:**
- [ ] Each chapter builds on previous chapters
- [ ] Chapters reference concepts from earlier chapters
- [ ] Clear progression from simple to complex
- [ ] Cannot skip chapters without losing context
- [ ] Final chapter synthesizes everything learned

**Learning Design:**
- [ ] Clear learning objectives stated upfront
- [ ] Prerequisites are listed
- [ ] Time estimate is realistic
- [ ] Each chapter has specific learning outcome
- [ ] "What You Learned" recaps reinforce concepts

**Content Quality:**
- [ ] All code examples are tested and functional
- [ ] Each example builds on previous examples
- [ ] Encourages progress ("You've now learned...")
- [ ] Not redundant with Quick Starts/Examples/Guides
- [ ] Fills actual gap based on user feedback

---

## Transformation Guidelines

### Prefer Built-In Processors

Before writing custom Bloblang, check if a built-in processor solves the problem:

**Common built-ins:**
- `json` - JSON parsing and manipulation
- `csv` - CSV parsing
- `grok_parser` - Log parsing with Grok patterns
- `branch` - Conditional processing
- `workflow` - Multi-step transformations
- `split` - Split messages
- `dedupe` - Deduplication

### When to Use Bloblang (via `mapping` processor)

Use `mapping` for:
- Simple field operations (< 5 lines)
- Custom calculations or derivations
- Format conversions not covered by built-ins

**Keep it simple:**
```yaml
# Good - simple, clear
processors:
  - mapping: |
      root.timestamp = now()
      root.level = this.severity.uppercase()
```

```yaml
# Bad - too complex for inline Bloblang
processors:
  - mapping: |
      # 50 lines of complex regex, conditionals, and transformations
      # that could be split across multiple processors
```

### Complex Transformations

For transformations over 10 lines:
1. **Break into steps:** Use multiple processors instead of one complex one
2. **Use workflow:** Chain multiple transformation steps clearly
3. **Extract to resource:** Create a reusable processor resource
4. **Add comments:** Explain each section inline

---

## Voice & Tone

### Write Like a Knowledgeable Colleague

**Conversational but technical:**
- ✅ "This processor filters messages based on their content."
- ❌ "The processor shall perform filtration operations upon message payloads."
- ❌ "This awesome processor filters stuff!"

### Respect the Reader's Time

**Be concise:**
- ✅ "Send alerts when errors occur."
- ❌ "This enables the capability to send alerting notifications in scenarios where error conditions are detected in the data stream."

### No Marketing Language

**Technical accuracy over persuasion:**
- ✅ "Process data at the edge before sending to cloud, reducing bandwidth costs."
- ❌ "Revolutionary edge-first architecture that dramatically slashes costs by up to 85% while unlocking unprecedented real-time capabilities!"

### Skip Unnecessary Explanations

**Trust technical competence:**
- ✅ "Configure the input endpoint:"
- ❌ "Now we need to configure the input endpoint, which is the location where data enters the pipeline. This is important because..."

---

## Content Structure Templates

We provide detailed templates for each documentation type. Copy the appropriate template file to start a new document.

### Examples (Task-Oriented Solutions)

**Structure:** Problem → Complete Pipeline → How It Works → Customization → What's Next

**Template:** [`docs/examples/TEMPLATE.md`](examples/TEMPLATE.md)

**Key characteristics:**
- Start with problem statement (1-2 sentences)
- Complete, copy-paste ready YAML pipeline
- Brief explanation of key sections
- Common variations users might need
- Links to related examples and component docs

### Guides (Feature Deep-Dives)

**Structure:** Overview → Basic Usage → Advanced Patterns → Best Practices → Common Pitfalls

**Template:** [`docs/guides/TEMPLATE.md`](guides/TEMPLATE.md)

**Key characteristics:**
- Comprehensive explanation of feature/concept
- Simple examples before advanced patterns
- Multiple examples showing different aspects
- Actionable best practices and anti-patterns
- Links to examples using this feature

### Tutorials (Sequential Learning - Future)

**Structure:** Chapter 1 → Chapter 2 → Chapter 3 (progressive, builds on previous)

**Template:** [`docs/tutorials/TEMPLATE.md`](tutorials/TEMPLATE.md)

**Key characteristics:**
- Must be followed in order
- Each chapter builds on previous
- Teaches mental model and core concepts
- Only create if Quick Starts + Examples aren't sufficient

### Quick Starts

**Structure:** Brief intro → Step 1 → Step 2 → ... → Next Steps

**Key characteristics:**
- Pure UI walkthrough with screenshots
- Under 5 minutes to complete
- Focused on getting to success fast
- Links to guides and examples for depth

---

## Success Criteria

**Good documentation is:**
- ✅ **Accessible** - Starts simple, enables advanced users
- ✅ **Accurate** - Only documents what exists and works
- ✅ **Scannable** - Easy to find what you need
- ✅ **Understandable** - Readable and maintainable examples
- ✅ **Respectful** - Values reader's time

**Bad documentation is:**
- ❌ Starting with complex examples
- ❌ Overusing custom transformations when built-ins exist
- ❌ Verbose justifications before showing solutions
- ❌ Repeating setup instructions across multiple pages
- ❌ Using marketing language instead of technical clarity

---

## When in Doubt

**Ask yourself:**
- Would this help someone in the first 5 minutes of using Expanso?
- Is this the simplest way to solve this problem?
- Would I understand this if I found it in documentation?
- Can I point to what problem this solves?

If you're uncertain about an example's complexity or approach, run it through the Example Quality Guidelines checklist above.
