---
name: visual-companion
description: Visual Companion automatically assesses UI and UX changes in user requirements after the normal response and offers optional visual design assistance in the user's preferred language. Use for interface, layout, navigation, interaction, accessibility, or user-flow changes, and when the user selects low-fidelity, high-fidelity, or in-project preview, including localized equivalents, for the current requirement. Produce low- or high-fidelity HTML, or a mock-only preview inside the real project. Pure backend, documentation, skill-authoring, and conceptual UI discussions without a requested interface or experience change need no offer.
---

# Visual Companion

Support the user's current requirement with optional visual design. Keep the original task moving; choosing a companion mode is a separate, optional step.

## Communication Language

- Keep the skill instructions, metadata, and references in English. Their language does not determine the language used to communicate with the user.
- Follow the user's current explicit language preference first, then their saved or established conversation preference. If no preference is known, use the language of their latest substantive message. An English request or quoted English text does not override an established preference unless the user asks to change it.
- Use that language for progress updates, questions, invitations, mode labels, delivery reports, and companion-owned debug controls and messages. English wording in this skill is a semantic template to localize, not mandatory verbatim output. Preserve established localized mode names within the conversation.
- Keep technical identifiers, invocation syntax such as `$visual-companion`, paths, and commands unchanged. Product UI copy in the design follows the project's intended locale unless the user requests a different language; the communication preference alone does not authorize translating the product.

## Response And Offer

1. Handle the user's request normally, including the work or answer it calls for. Do not delay it to ask about visual design, and do not substitute a mockup for requested production implementation.
2. Before sending the final response, assess whether the actual requirement changes UI or UX: visible content, layout, controls, navigation, interaction, feedback, accessibility, or a user journey. A mixed backend/frontend requirement qualifies when it has a concrete UI or UX change. Merely mentioning UI, explaining a concept, or writing a skill about design does not.
3. If it qualifies and the user has not selected or declined a mode for this requirement, append a standalone invitation near the end of the normal response, after its substantive content. Localize the following English template into the user's preferred language, preserving the three modes and the invitation to reply with a choice:

   Visual Companion design assistance is available for this requirement; choose low-fidelity, high-fidelity, or in-project preview and reply with your choice to begin.

4. Otherwise, finish the normal response without the offer. An offer alone authorizes no companion files, preview server, or project edits. A decline ends offers for that requirement unless the user reopens the choice.

Use the capabilities and permissions of the current host runtime. Allow implicit activation from the description and host-supported explicit invocation, including selecting the display name Visual Companion. Do not require one product-specific invocation prefix. Automatic selection depends on the host; do not claim installation guarantees activation on every prompt.

## Mode Selection

Interpret a reply containing `low-fidelity`, `high-fidelity`, or `in-project preview`, or a localized equivalent, as the chosen mode when it refers to the current requirement or pending offer. Map the user's wording to the corresponding mode without requiring an English reply. A user who specifies the requirement and mode together has already selected it; start that mode without another offer or confirmation. If a bare choice has no recoverable requirement, ask which requirement it refers to.

Keep the chosen mode for follow-up revisions of the same design until the user changes or ends it. Do not repeat the offer on mode selection, design delivery, or its revisions. Assess a new independent requirement afresh. Where several requirements or choices are genuinely ambiguous, clarify only the missing association.

The selection authorizes the corresponding design work within the current task and the host's existing permissions. It does not turn simulated behavior into a request for production business logic.

## Low-Fidelity HTML

- Create a locally viewable HTML artifact with lightweight CSS and only the JavaScript needed to demonstrate the flow.
- Express the feature entry points, rough page regions, information hierarchy, primary actions, and the main navigation or interaction sequence.
- Use simple blocks, neutral colors, concise labels, and representative mock content. Fine spacing, exact typography, realistic imagery, and detailed visual reproduction are unnecessary.
- Make key controls demonstrable with local simulated states where the UX depends on them. Keep secondary details at wireframe level.
- Deliver the HTML path or preview link and briefly identify the flow it illustrates.

## High-Fidelity HTML

- First inspect the actual project's design language: nearby screens and components, design tokens, typography, spacing, colors, icons, imagery, borders, shadows, and interaction patterns. Use available rendered screens or supplied design references to resolve visual details.
- Produce a locally viewable HTML design artifact that closely matches that evidence, reusing available project assets and styles where practical. Follow the project's responsive layout and relevant interactive states; use mock content and local state for demonstration.
- Preserve the real project's visual hierarchy and component conventions while representing the requested change. A generic attractive template is insufficient evidence of fidelity.
- If the project or its design references cannot be located, request the missing project location or reference. Continue only work that does not depend on that evidence; do not silently downgrade to low fidelity or claim an invented style matches the project.
- Deliver the HTML path or preview link, identify the design references used, and disclose any unverified visual assumptions.

## In-Project Preview

Read [references/project-parasitism.md](references/project-parasitism.md) when this mode is selected. Implement the UI and UX changes in the actual project's pages and components, using mock data and simulated logic. Include the floating debug toolbar, complete change list, previous/next navigation, red frames, numbered chips, and marker visibility switch specified there.

## Delivery Checks

Open the selected design through the available preview or browser tools when supported, exercise its primary flow, and inspect the rendered result. For real-project mode, also perform the mode-specific checks in its reference. Check only the selected mode; this skill does not require generating all three.

Report the artifact or project entry, what can be demonstrated, and what was actually verified. Label simulated behavior clearly. If a runtime or browser is unavailable, state the unverified checks rather than calling the design visually verified. Do not append another invitation to a companion delivery.
