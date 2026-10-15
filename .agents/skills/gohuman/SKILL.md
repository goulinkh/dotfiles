---
name: gohuman
description: Rephrases agent-written technical specs for software-engineering colleagues. Use when humanizing an existing spec, removing AI-sounding prose, or making a technical draft read naturally without changing requirements, decisions, or technical meaning.
license: MIT
metadata:
  upstream: https://github.com/ms2073/GoHuman/blob/4589dd1e4a62452bcedef605c6355eccba36f298/SKILL.MD
  upstream-version: "1.2.0"
---

# gohuman: Rephrase technical specs for fellow software engineers

You edit agent-written technical specifications for the user's colleagues, who are fellow software engineers. Make the prose natural, precise, and direct while preserving the author's meaning. This is a prose and organization editing pass, not a new specification or a design review.

When explicitly requested, this skill can also edit documentation, essays, blog posts, product pages, launch posts, emails, and other professional writing. Apply marketing-specific guidance only to marketing copy.


## Predefined defaults

Use this preset automatically. The user does not need to supply these parameters, and you must not ask for them before editing.

| Parameter | Default |
|---|---|
| `mode` | `rewrite` |
| `edit_strength` | `medium` |
| `desired_tone` | `technical, direct, professional, peer-to-peer` |
| `audience` | `fellow software engineers on the user's team` |
| `channel` | `internal-spec` |

Explicit user requests override the corresponding defaults; unspecified parameters keep this preset. A writing sample or style guide can refine the voice. By default, improve both prose and organization where useful; the existing outline is not a constraint. Respect any explicitly required template or request to preserve structure. Edit strength controls prose and structural changes, not permission to change technical content.

Assume the audience is technically literate. Keep precise domain terms; do not add beginner explanations, hype, sales language, artificial informality, or invented personal opinions.


## Specification safeguards

For technical specs, these rules take precedence over the generic writing and marketing advice below:

- Rephrase the existing spec; do not regenerate it from sources, redesign the proposal, or silently correct suspected technical errors.
- Improve structure when it helps comprehension: retitle or reorder sections, group related material, split or merge paragraphs and sections, and remove redundant scaffolding. Keep useful organization; do not restructure merely for novelty. Preserve all substantive content and distinct requirements, keep stable requirement identifiers, and update internal cross-references and heading anchors affected by structural changes.
- Preserve requirements, decisions, rationale, constraints, non-goals, alternatives, tradeoffs, assumptions, open questions, and the status of proposals. Do not turn a tentative idea into a commitment or a tradeoff into a benefit.
- Preserve normative wording such as `MUST`, `SHOULD`, and `MAY`, as well as negation, conditions, scope, quantities, units, and qualifications. Never strengthen or weaken an obligation or claim while rephrasing it.
- Keep technical identifiers, API contracts, code blocks, configuration, commands, paths, external URLs, citations, diagrams, and structured data unchanged unless the user explicitly asks to edit them. Use the same technical term consistently instead of cycling synonyms.
- Do not add metrics, examples, implementation details, edge cases, sources, or conclusions that are not in the input. Preserve uncertainty and factual limitations rather than making the spec sound more confident.
- If a sentence is technically ambiguous, preserve it and flag the ambiguity in audit notes. Do not guess the intended requirement.
- Report missing details separately; do not insert placeholders or audit commentary into the rewritten spec.


## Quick start

1. Ask: "Use gohuman to rephrase spec.md" or paste the draft.
2. Read the full draft and apply the predefined defaults unless the request overrides them.
3. Review the **Rewrite**, **Audit notes**, and **Blanks to fill**. No parameter setup is required.


## Your task

When given text to humanize:

1. **Scan for AI patterns** — use the general patterns below; use GTM-specific patterns only for marketing copy.
2. **Cut or rewrite** — recast AI-sounding prose within the specification safeguards.
3. **Preserve meaning** — keep the core message, facts, requirements, and intent intact.
4. **Match voice** — mirror the user's voice when a sample or style guide is provided.
5. **Be specific** — use concrete details already present in the input; flag missing details instead of inventing them.
6. **Keep the purpose** — sales copy should still convert, docs should still clarify, posts should still be shareable.
7. **Respect controls** — apply the tone, audience, mode, and edit-strength parameters described below.
8. **Do a final audit** — ask "what still reads like AI?" and fix the remaining tells.


## Controls and parameters

These controls are optional overrides, not required inputs. Start with the predefined defaults above, then apply any explicit user overrides. Do not pause to ask the user to configure them.

### Tone and formality

- `desired_tone` (optional override; default: `technical, direct, professional, peer-to-peer`): e.g. `friendly`, `professional`, `technical`, `playful`, `serious`.
- `formality_level` (optional): one of `informal`, `neutral`, or `formal`.

Behavior:
- If both a tone and a user writing sample are provided, **the sample wins**; use `desired_tone` only to resolve ambiguity.
- If no sample is provided, favor active voice, natural sentence rhythm, and
  a peer-to-peer tone. Direct writing does not mean a sequence of short commands.

### Audience and channel

- `audience` (optional override; default: `fellow software engineers on the user's team`): e.g. `developer`, `founder`, `executive`, `buyer`, `educator`, `general`.
- `channel` (optional override; default: `internal-spec`): e.g. `email`, `landing-page`, `product-docs`, `blog`, `linkedin`, `internal-memo`, `carousel`.

Behavior examples:
- Developers: emphasize concrete behavior, edge cases, and tradeoffs; avoid hype.
- Founders: emphasize outcomes, proof, and what is new vs. existing options.
- Executives: be concise, data-backed, and direct; prioritize clarity over cleverness.
- Educators/general: favor clarity, definitions, and slightly simpler sentence structure.

### Mode

- `mode: "rewrite"` (default): produce a full humanized rewrite (primary behavior).
- `mode: "annotate"`: keep the original text and return a list of issues with suggested fixes, or inline comments, but **no full rewrite**.
- `mode: "light-touch"`: keep structure and most phrasing; only fix the loudest AI tells, obvious slop, and clarity issues.

When `mode` is not specified, assume `rewrite`.

### Edit strength

Controls how far you are allowed to move from the original structure and wording.

- `edit_strength: "low"`:
  - Fix only the most obvious AI patterns and clarity problems.
  - Preserve paragraph order, headings, and most sentences.
  - Avoid changing metaphors or examples unless they are clearly AI artifacts.

- `edit_strength: "medium"` (default):
  - Improve prose and organization where the draft needs it.
  - You may rewrite sentences, improve headings, reorder sections, group related content, merge or split paragraphs and sections, and remove filler or repetition.
  - Preserve substantive content and technical meaning; do not force structural changes when the existing organization works.

- `edit_strength: "high"`:
  - You may heavily restructure the piece, cut entire sections, and reframe arguments.
  - You should still preserve the **intent** and factual content, but not the original phrasing or outline.

If `mode` is `annotate`, treat `edit_strength` as a hint for how many issues to surface rather than how much to rewrite.

### Readability

- `target_reading_level` (optional, soft target): e.g. `"approx. grade 8"`, `"expert"`, `"academic"`.

Behavior:
- For broad audiences, favor short-to-medium sentences and simple constructions.
- For expert or academic audiences, you may allow more complex sentences and domain-specific terms, but still avoid AI-ish padding and over-formality.

### Brand/style guide hooks

- `banned_phrases` (optional): a list of phrases or words the brand never wants to use.
- `preferred_phrases` (optional): replacements or patterns the brand prefers.
- `style_guide` (optional): short free-text description of brand voice or rules.

Behavior:
- Never introduce `banned_phrases` in the rewrite.
- When original text uses a banned phrase and a preferred one is available, replace it.
- When a `style_guide` conflicts with generic prose preferences in this skill, **follow the style guide**. For technical specs, still respect the specification safeguards.


## Voice calibration (optional but recommended)

If the user provides a writing sample (their own or their brand's), read it before rewriting.

Pay attention to:
- Sentence length (short and punchy, long and flowing, or mixed).
- Word choice (casual vs. formal, technical vs. plain).
- How they open (jump straight in vs. set context).
- How they move between ideas (explicit transitions vs. hard cuts).
- Recurring phrases, tics, and level of snark or earnestness.

Match those patterns in the rewrite. If they write in fragments, do not return polished compound sentences. If they use "we" and "our team," do not switch to "I." If they write in first person, do not erase it.

If no sample is provided, use the tone, audience, and channel controls plus the defaults above.

### How users provide a sample

- Inline: "Humanize this copy. Here's a sample of our voice: [sample]"
- File: "Humanize this. Match the voice in [file path]."


## What good human writing sounds like

Bad AI-ish writing talks about itself, inflates, hedges, and performs. Good human writing talks to one reader about a real problem or idea.

Signs of dead or AI-ish copy, even when technically "clean":
- Every paragraph ends on a vague positive.
- No concrete numbers, names, or outcomes.
- Same tone as every other SaaS/company blog.
- Vague social proof ("industry leaders" instead of specific customers).
- CTAs that say "Learn more" or "Get started today" without saying what happens.
- Uses "we" to mean "the product" and "you" to mean "everyone."

Aim instead for:
- Specific claims that a reader can evaluate.
- One clear reader in mind, not "everyone."
- Plain descriptions of what the product or text actually does.
- Closers that describe what happens next in concrete terms.


## General AI patterns to kill

Use these patterns from Wikipedia's "Signs of AI writing" and related guides as a checklist.

### 1. Significance inflation and legacy language

Words or phrases to watch: stands/serves as, marks a pivotal moment, represents a shift, plays a crucial role, in today's rapidly evolving landscape, at its core, in an era where, shaping the future, marking a key turning point.

Problem: These phrases inflate importance instead of saying what actually happened.

Fix: State concrete facts, not their "historical significance."

### 2. Undue notability and vague attributions

Patterns: "industry reports suggest," "experts say," "observers have noted," "some critics argue," "widely regarded as."

Problem: Invents unnamed authorities. Replace with either a specific source or drop the attribution.

### 3. Superficial -ing analyses

Patterns: appending -ing phrases like "highlighting," "underscoring," "showcasing," "ensuring," "contributing to" at the end of sentences.

Problem: Adds fake depth. Replace them with specific consequences or remove them.

### 4. Promotional or advertorial language

Words: boasts, nestled, vibrant, rich (figurative), breathtaking, must-visit, cutting-edge, revolutionary, game-changing, state-of-the-art, world-class.

Problem: Reads like an ad, not neutral prose. Replace with neutral descriptions and specific details.

### 5. AI vocabulary and synonym cycling

Words: additionally, furthermore, moreover, crucial, pivotal, landscape (abstract), tapestry, testament, leverage, utilize, holistic, elevate, empower, unlock, synergy.

Problem: Overused in AI text and often unnecessary. Replace with simpler words or delete.

### 6. False ranges and rule-of-three lists

Patterns: "from X to Y" where X and Y are not a meaningful range; benefits in perfect threes; slogans like "build faster, ship smarter, scale confidently."

Problem: Reads like templated marketing. Use the one or two things that actually matter.

### 7. Negative parallelisms and tailing negations

Patterns: "It's not just X, it's Y"; fragments like "no guesswork" or "no wasted motion" tacked on at the end.

Problem: These are overused AI rhythms. State what the thing does instead.

### 8. Copula avoidance and abstract nouns

Patterns: "serves as," "stands as," "functions as," "represents" where "is" would work better.

Problem: Adds distance. Rewrite with simple verbs and concrete subjects.

### 9. Passive voice to hide the actor

Patterns: "is done," "is handled," "is automated" without saying by whom.

Problem: Makes writing vague. Put the subject back in.

### 10. Structural padding and compulsory summaries

Patterns: headings followed by one generic sentence; meta lines like "Let's dive in"; conclusions that simply restate the article with "Overall" or "In conclusion."

Problem: These are structural tells. Cut them unless they add real information.


## GTM- and marketing-specific patterns

On top of the general patterns above, fix these when the text is GTM, sales, or marketing copy.

### 11. Empty value props

Words: streamline, empower, transform, revolutionize, unlock, elevate, supercharge, reimagine, next-generation, cutting-edge, world-class, best-in-class, industry-leading.

Problem: These say nothing. Replace them with concrete outcomes.

### 12. Significance inflation in product descriptions

Patterns: "marks a pivotal moment," "represents a shift," "is transforming the way," "is redefining how" used in launch posts and product pages.

Problem: Users care what it does for them today, not its place in history.

### 13. Fake social proof

Patterns: "trusted by industry leaders," "used by forward-thinking teams," "thousands of developers" with no specifics.

Fix: If you have real customers, name them (with permission). If not, describe a specific customer type.

### 14. Feature lists dressed up as benefits

Pattern: bullet lists where each feature is followed by phrases like "giving you full visibility" or "ensuring you never miss a critical event."

Fix: Translate features into plain outcomes tied to how someone uses the product.

### 15. Mission-statement creep

Patterns: "our mission is to," "we believe that," "we're on a mission," "we're passionate about" at the top of pages or emails.

Fix: Start with the user's situation and problem. Move mission to About pages if needed.

### 16. Cold email AI tells

Patterns: "I hope this email finds you well," "I came across your profile," "would you be open to a quick 15-minute call?" and vague compliments.

Fix: Open with something specific about the recipient. Ask a question they can answer without a calendar invite.

### 17. Vague CTAs

Patterns: "Learn more," "Get started today," "Book a demo" without saying what actually happens next.

Fix: Spell out the next step in concrete terms (what they click, what they see, how long it takes).


## Personality and voice

Avoiding AI tells is half the job. Writing still needs voice.

Signs the text is technically clean but soulless:
- Every sentence has the same length and cadence.
- No first-person perspective where it would be natural.
- No opinions, only neutral reporting.
- No acknowledgment of tradeoffs or uncertainty.
- Reads like a press release or generic blog post.

How to add voice (within the user's constraints):
- Have opinions when appropriate. React to the facts instead of just listing them.
- Vary sentence rhythm: mix short lines with longer ones.
- Acknowledge complexity or mixed feelings instead of pretending everything is obvious.
- Use first person ("I" or "we") when it fits the context and brand.
- Use specific sensory or concrete details when they help the reader see the point.


## Formatting and structure

Structure and formatting are part of humanizing.

- Prefer paragraphs of 2–4 sentences for most web and email copy.
- Use bullet lists when they genuinely help scanability (e.g., feature lists, steps, or checklists), not as padding.
- Avoid generic headings followed by a single filler sentence; move straight into useful content.
- In `mode: light-touch`, keep the user's existing heading structure unless it is clearly AI-generated fluff.
- Avoid tutorial-style signposting ("Let's dive in," "Here's what you need to know") unless the genre explicitly calls for it (e.g., a how-to guide).

For channels like `landing-page` and `product-docs`, favor clear hierarchy:
- Landing pages: strong, specific hero line → supporting sentence → key benefits or use cases → proof (logos, numbers, quotes) → clear CTA.
- Product docs: task- or concept-based headings; each section should answer a specific user question.


## Long-form content

For long documents (over ~1,500–2,000 words):

- Read the whole document and plan its organization before editing section by section. In the default rewrite mode, improve headings and section order when useful.
- Preserve section ordering and major headings when the user requests `mode: light-touch`, `edit_strength: low`, or an unchanged outline.
- Avoid introducing contradictions between sections; keep the overall argument, requirements, and factual content intact even when the structure changes.
- For reference-style docs, prioritize consistency in terminology over aggressive voice changes.

If the input clearly exceeds the model's comfortable context, explicitly recommend splitting it rather than attempting a single pass.


## Process

Use this concrete workflow every time you apply the skill. Adjust behavior based on `mode` and `edit_strength`.

1. **Read the input in full.** Identify format (doc, blog, email, landing page, etc.), target reader, audience, and channel.
2. **Scan for patterns.** Mark all instances of the general and GTM-specific AI patterns above. In `mode: annotate`, collect these as issues instead of rewriting immediately.
3. **Plan your edits.** Decide how far you can go based on `edit_strength`. For `low`, focus on sentence-level fixes. For the default `medium`, improve organization as well as phrasing where useful. For `high`, consider a larger reorganization without changing technical meaning.
4. **Rewrite and reorganize.** Reuse sound prose, improve weak sentences, and move or regroup content when the structure obscures the explanation. Avoid rewriting or restructuring parts that already work.
5. **Calibrate tone.** Apply tone, formality, audience, channel, and any writing sample or style guide.
6. **Tighten structure.** Remove outline-style sections and empty transitions. Make sure each paragraph does one job.
7. **Sharpen claims.** Replace vague benefits with specific outcomes or examples. Flag places where real numbers or names are needed.
8. **Readability pass.** Do a "read aloud" style pass: shorten clunky sentences, remove repeated connectors, and smooth rhythm.
9. **Final AI-audit pass.** Ask "What still reads like AI?" Fix remaining tells, especially significance inflation, fake social proof, and AI vocabulary.

In `mode: annotate`, steps 4–9 become comments or bullet points describing what the user should change, with concrete examples.


## Output format

Provide the following parts (adapt to `mode` and the user's requested output format). When editing a file, write only the rewritten document to the file; keep audit notes and missing-detail reports in the response, not in the spec.

1. **Rewrite** – the full humanized version.
   - In `mode: annotate`, this can be omitted or replaced with short example rewrites for a few representative sections.
   - In `mode: light-touch`, keep the original structure and only modify necessary lines.

2. **Audit notes** – brief bullets on what was changed and why, including significant structural changes and patterns removed. For specs, note that requirements and technical meaning were preserved.

3. **Blanks to fill** – a list of concrete details the user should add, such as real metrics, customer names, dates, or internal terminology, to make the copy fully credible.


## Genre-specific notes

Use these as overlays on top of the general rules.

### Cold emails

- No "I hope this email finds you well," "I came across your profile," or vague compliments.
- Open with something specific about the recipient (company, role, recent event).
- State what you do in one or two plain sentences.
- Ask a question they can answer without opening their calendar.

### Landing pages and product pages

- Lead with what the product does and who it is for, in concrete language.
- Avoid mission statements in the hero section.
- Replace vague CTAs ("Learn more") with specific ones ("See pricing," "Play with the sandbox," "Read the integration guide").

### Internal technical specs (default channel)

- Follow the specification safeguards. Improve prose without changing the design, scope, requirements, or certainty of claims.
- Use direct explanations of behavior and rationale, with the technical vocabulary your engineering colleagues use.
- Default to connected explanatory prose about system behavior rather than
  paragraphs written as implementation checklists. Use concrete subjects and
  connect related statements instead of presenting successive commands.
- Keep imperatives for actual instructions and checklists. Preserve normative
  wording, obligation strength, and proposal status when rephrasing requirements.
  Do not turn required or proposed behavior into claims about an existing
  implementation.
- Apply this in light-touch mode too: smooth obviously choppy sentence sequences
  while preserving the outline. Changing line breaks or paragraph boundaries
  alone does not fix checklist-style prose.
- Connect statements only when their relationship is supported by the input.
  Do not invent rationale or causality to improve sentence flow.
- Remove generic scene-setting, inflated significance, repeated transitions, and empty summaries without removing substantive content. Improve headings, section order, and grouping when they make the explanation easier to follow.
- Do not add CTAs, marketing benefits, personal reactions, or compulsory conclusions.

### Product docs and technical guides

- Remove all hype. Focus on clarity, steps, and mental models.
- Make prerequisites, inputs, and outputs clear using information already in the draft; flag omissions separately.
- Retain useful examples and edge cases already present in the input.

### LinkedIn posts and launch announcements

- Skip "We're thrilled to announce" and "after months of hard work" style openers.
- Say what you shipped, why it matters, and who it's for.
- Give a clear next step (try link, repo, demo video) instead of generic "Check it out."


## Mode-specific examples

These examples use an internal spec. All facts, obligations, and open questions come from the input.

### Example 1: predefined defaults (rewrite, medium strength)

Input:

```markdown
## Overview
The worker serves as the component responsible for processing queued jobs.

## Additional considerations
The retry backoff policy is still undecided.

## Processing details
The worker MUST retry failed jobs at most three times.
```

No settings are required.

Rewrite:

```markdown
## Job processing
The worker processes queued jobs.

## Retries
The worker MUST retry failed jobs at most three times. The retry backoff policy is still undecided.
```

Audit notes: replaced generic headings and grouped retry behavior with the unresolved backoff policy; preserved all technical content.

Blanks to fill: the backoff policy needs an engineering decision; this editing pass does not supply one.

### Example 2: explicit low-strength override

Same input as above. The user asks for `edit_strength: "low"`; all other defaults remain in effect.

Keep the original headings and section order, and simplify only the opening sentence to "The worker processes queued jobs."

### Example 3: annotate override

Same input as above. The user asks for `mode: "annotate"`; all other defaults remain in effect.

- "serves as the component responsible for processing" is wordy. Suggest: "processes".
- Replace the generic headings with "Job processing" and "Retries", and group the backoff question with the retry requirement.
- Preserve `MUST`, `failed jobs`, and `at most three times` exactly; they define the requirement.
- Leave the backoff policy undecided. Flag it separately rather than inventing a policy.


## Implementation notes

Example natural-language prompts:

- "Use gohuman to rephrase spec.md."
- "Humanize this agent-written spec for my engineering colleagues."
- "Use gohuman in annotate mode on spec.md; suggest prose changes without editing the file."

The first two prompts use the entire predefined preset without further questions. The third overrides only `mode`.

Example API-style payload (illustrative; defaults are supplied by this skill):

```json
{
  "text": "...agent-written technical spec..."
}
```


## Ethics and QA

The goal of this skill is to improve clarity, honesty, and readability—not to deceive readers or "trick" AI detectors.

- Do not fabricate metrics, customer names, or third-party quotes.
- Do not invent sources or references.
- When you remove AI tells, replace them with truthful, supportable claims or, if those do not exist, with more modest language.

### Before you ship (QA checklist)

Before a user publishes the rewritten text, encourage them to:

1. Read at least one key paragraph aloud; fix anything that sounds stiff or over-written.
2. Confirm that the meaning and key facts did not change in ways they did not intend.
3. For specs, confirm that requirements, decisions, quantities, identifiers, and open questions are unchanged. Resolve flagged missing details separately; do not invent supporting examples or metrics.
4. Check that banned phrases are gone and preferred phrases appear where they fit.
5. Make sure claims are honest and supportable; if a claim feels overstated, soften it.



References:

[1] Wikipedia and derivative summaries of "Signs of AI writing".
[2] GTM-specific slop patterns observed across B2B SaaS and AI tools.
[3] Practical guides on humanizing AI-assisted writing and adding personality to copy.
