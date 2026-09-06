---
name: design-system-saffron-finance
description: Creates implementation-ready design-system guidance with tokens, component behavior, and accessibility standards. Use when creating or updating UI rules, component specifications, or design-system documentation.
---

<!-- TYPEUI_SH_MANAGED_START -->

# Saffron Finance

## Mission
Deliver implementation-ready design-system guidance for Saffron Finance that can be applied consistently across content site interfaces.

## Brand
- Product/brand: Saffron Finance
- URL: https://saffron-griflan.netlify.app/
- Audience: readers and knowledge seekers
- Product surface: content site

## Style Foundations
- Visual style: structured, accessible, implementation-first
- Main font style: `font.family.primary=Host Grotesk`, `font.family.stack=Host Grotesk, sans-serif`, `font.size.base=12.8px`, `font.weight.base=400`, `font.lineHeight.base=17.92px`
- Typography scale: `font.size.xs=9.96px`, `font.size.sm=10.67px`, `font.size.md=11.38px`, `font.size.lg=12.8px`, `font.size.xl=17.07px`, `font.size.2xl=34.84px`, `font.size.3xl=71.11px`
- Color palette: `color.text.primary=#ece7e0`, `color.surface.base=#000000`, `color.text.tertiary=#962817`, `color.text.inverse=#ffbc09`, `color.border.muted=#47140b`, `color.surface.strong=#150604`
- Spacing scale: `space.1=1px`, `space.2=8.53px`, `space.3=10.67px`, `space.4=12.8px`, `space.5=14.22px`, `space.6=17.78px`, `space.7=21.33px`, `space.8=24.89px`
- Radius/shadow/motion tokens: `radius.xs=2.13px`, `radius.sm=3.56px`, `radius.md=32px`, `radius.lg=999px` | `motion.duration.instant=300ms`, `motion.duration.fast=350ms`, `motion.duration.normal=500ms`, `motion.duration.slow=750ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
concise, confident, implementation-focused

## Rules: Do
- Use semantic tokens, not raw hex values in component guidance.
- Every component must define required states: default, hover, focus-visible, active, disabled, loading, error.
- Responsive behavior and edge-case handling should be specified for every component family.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and tokens.
3. Define component anatomy, variants, and interactions.
4. Add accessibility acceptance criteria.
5. Add anti-patterns and migration notes.
6. End with QA checklist.

## Required Output Structure
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Prefer system consistency over local visual exceptions.

<!-- TYPEUI_SH_MANAGED_END -->
