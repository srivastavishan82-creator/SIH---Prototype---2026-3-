# Illinois Innocence Project

## Mission
Create implementation-ready, token-driven UI guidance for Illinois Innocence Project that is optimized for consistency, accessibility, and fast delivery across content site.

## Brand
- Product/brand: Illinois Innocence Project
- URL: https://www.illinoisinnocenceproject.org/
- Audience: readers and knowledge seekers
- Product surface: content site

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=TASA Orbiter`, `font.family.stack=TASA Orbiter, sans-serif`, `font.size.base=16px`, `font.weight.base=400`, `font.lineHeight.base=22.4px`
- Typography scale: `font.size.xs=14px`, `font.size.sm=16px`, `font.size.md=18.4px`, `font.size.lg=19.2px`, `font.size.xl=20px`, `font.size.2xl=43.2px`, `font.size.3xl=86.4px`
- Color palette: `color.text.primary=#ffffff`, `color.text.secondary=#080c51`, `color.text.tertiary=#111111`, `color.text.inverse=#5a84f5`, `color.surface.base=#000000`, `color.surface.muted=#405bf7`, `color.surface.strong=#d9f203`
- Spacing scale: `space.1=2px`, `space.2=4px`, `space.3=12.8px`, `space.4=13.6px`, `space.5=16px`, `space.6=24px`, `space.7=32px`, `space.8=72px`
- Radius/shadow/motion tokens: No reliable extraction yet; motion and shape tokens should be defined manually.

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: links (52), buttons (31), navigation (1).

- Extraction diagnostics: Audience and product surface inference confidence is low; verify generated brand context.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
