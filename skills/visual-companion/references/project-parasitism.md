# In-Project Preview

Use this reference only after the user selects in-project preview for a known requirement. The deliverable runs inside the actual project and demonstrates the proposed UI and UX with mock data and simulated logic.

## Project Integration And Mock Boundary

- Locate the actual project, affected routes, components, and development entry before editing. If the project is unknown or inaccessible, ask for its location; do not substitute a standalone HTML clone and call it real-project mode.
- Reuse the project's real layout, components, styling, and navigation. Make the requested changes in that context and preserve existing user work.
- Use an explicit local development/preview activation mechanism that is off by default. Keep mock providers, demo-only behavior, and debug UI scoped to that mode; normal operation and production builds must not activate them. Document how to enter and exit the preview.
- Supply deterministic fixtures and local state transitions for the changed flows, including relevant loading, empty, success, error, or disabled states. Simulate actions such as search, save, delete, payment, or approval locally; do not implement the corresponding real services, persistence, business rules, or backend integration.
- Cover both reads and writes in the changed preview flows, including requests made on mount, validation, background refresh, and navigation. Do not let an unhandled mock action fall through to a real API or real user data. Use the project's existing mocking facilities when suitable.
- If real behavior already exists, preserve it outside preview mode and substitute fixtures only within the preview. A later request to implement real data and logic is a separate scope change.

## One Complete Change List

Maintain one ordered collection for every distinct UI or UX change in the requirement. Use it to drive the toolbar, navigation, and markers so their totals and numbering agree. Treat related elements that form one change as one item; include changes revealed only in dialogs, menus, tabs, or alternate states.

Each item needs:

- A stable identity and a one-based display number.
- A short title and description of the change.
- The page or route and the scenario that reveals it.
- A way to activate that scenario and locate its rendered target.

Keep display numbers stable while reviewing the current design. A hidden item remains in the full list and total. An intentionally removed element should point to its visible replacement, former container, or resulting layout and explain the removal.

## Floating Debug Toolbar

Show a fixed floating toolbar across every affected preview route, above the project content and usable while scrolling. Keep it compact or repositionable so it does not permanently cover the reviewed controls.

The English toolbar and marker labels below are examples; localize them according to [Communication Language](../SKILL.md#communication-language).

It must provide:

- Previous and next buttons that select the preceding or following change. Disable previous on the first item and next on the last item; for one item both are disabled.
- A current position indicator such as `Change 2 of 7`, plus the current item's title and description.
- The complete list of changes with every number and title, a clear selected item, and direct selection of any item. A collapsible, scrollable list is acceptable; it must include items on other pages and in currently hidden states.
- A labeled switch such as `Show markers`, enabled initially, that hides or restores all red frames and numbered chips together. Turning it off keeps the toolbar, full list, current position, and navigation usable. Preserve the switch state during navigation.
- A visible indication that this is a preview using mock data and simulated behavior.

Selection must reveal the actual change: navigate when necessary, prepare the mock scenario, open the required dialog/menu/tab, wait for rendering, and scroll the target into view. Update the current item only when it is visible and located. If activation fails, keep the last successfully selected item and show which target could not be reached; do not just increment the counter. Choose the first item on entry. If there are no changes, show `0 / 0` with disabled navigation and no markers.

## Red Frames And Numbered Chips

- With markers enabled, outline every currently rendered change region with a visible red frame, including items other than the selected one. The complete list accounts for regions that are on other routes or in hidden states.
- Put a readable chip at the top-left corner of each red frame, displaying the corresponding one-based number, for example `Change 3`. Keep the frame and chip anchored together and use the same number as the toolbar list.
- Choose the smallest meaningful region that communicates the change. Multiple visible regions belonging to one item share its number; different changes must not accidentally share an identity.
- Use outlines or non-intercepting overlays so markers do not shift layout or block clicks, typing, scrolling, or keyboard focus. Keep chips visible at viewport edges and within scrolling or clipped layouts.
- Keep marker positions correct after scroll, resize, route changes, dialog transitions, and dynamic layout changes. Use the project's overlay/portal facilities when needed; the markers and toolbar must remain usable around dialogs and other overlay content.
- Switching markers off removes both the red frames and the numbered chips. Switching them back on restores them for the visible regions without resetting the selected item or scenario.

## Verify Before Delivery

Run the project in preview mode using the available local runtime and browser. Verify representative mock interactions and every change-list destination:

1. The preview displays the requested changes inside the real project and uses simulated reads and writes for those flows. Inspect network activity or mock assertions to verify no corresponding real service call escapes.
2. The full list covers the requirement; direct selection and previous/next navigation reveal the correct routes and states, with accurate numbers and boundary behavior.
3. Visible changed regions have red frames and top-left chips whose numbers match the list. Scrolling, resizing, and opening dialogs keep them aligned and interactive controls usable.
4. The marker switch hides and restores both frames and chips while the toolbar continues to work, including across navigation.
5. Leaving preview mode restores normal operation without the companion's mock overrides or debug UI. Run the project's relevant checks for the changed components and preview integration.

Deliver the project path, launch/activation instructions or preview link, and a concise list of the demonstrated changes. State which checks passed and which could not run; simulated success is not evidence that real backend functionality has been implemented.
