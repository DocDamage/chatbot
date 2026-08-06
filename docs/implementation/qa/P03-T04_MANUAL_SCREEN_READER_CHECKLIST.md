# P03-T04 Manual Screen-Reader and Keyboard Checklist

This checklist defines the human accessibility verification that complements the automated Axe and Playwright gate. P03-T04 creates the repeatable checklist; final assistive-technology certification remains required by P08-T06.

## Test record

- Release commit:
- Build or deployment URL:
- Tester:
- Date:
- Operating system:
- Browser and version:
- Screen reader and version:
- Evidence path:

## Required environments

- [ ] NVDA with current Chrome on Windows.
- [ ] NVDA with current Firefox on Windows.
- [ ] Keyboard-only run with the screen reader disabled.
- [ ] Windows forced-colors or high-contrast mode.
- [ ] Browser zoom at 200% and a 320 CSS-pixel reflow check where the workflow supports it.
- [ ] Reduced-motion preference enabled.

## Core workflow

- [ ] Page title, main heading, landmarks, and the AI chat region are announced in a useful order.
- [ ] The mode selector announces its expanded state, listbox, selected option, and keyboard movement.
- [ ] A mode can be chosen with Enter or Space without a pointer.
- [ ] The composer has a useful accessible name and the send/stop controls are announced.
- [ ] Sending a message announces progress and completion without moving focus unexpectedly.
- [ ] Connection and message-count changes are announced once through the polite live region.
- [ ] Error alerts are announced and include a useful recovery action.

## Settings dialog

- [ ] Opening Settings moves focus into the dialog.
- [ ] The dialog name and modal state are announced.
- [ ] Tab and Shift+Tab remain inside the dialog.
- [ ] Escape closes the dialog.
- [ ] Closing Settings restores focus to the exact trigger.
- [ ] Labels, descriptions, provider choices, secret fields, and disabled states are announced accurately.
- [ ] Save, failure, and loading status changes are announced without duplicate speech.

## Visual and interaction checks

- [ ] Visible focus is never obscured or clipped.
- [ ] Text, controls, focus indicators, and meaningful icons meet contrast expectations.
- [ ] Content remains usable at 200% zoom without two-dimensional scrolling for ordinary reading.
- [ ] Narrow reflow does not hide controls or require pointer-only interaction.
- [ ] Forced-colors mode preserves boundaries, focus, and selected states.
- [ ] Reduced-motion mode avoids unnecessary animation.
- [ ] No keyboard trap exists outside the intentional modal focus trap.

## Defect recording

For every failure, record:

1. exact workflow step;
2. expected announcement or behavior;
3. actual announcement or behavior;
4. browser, screen reader, OS, viewport, and zoom;
5. severity and affected WCAG success criterion;
6. screenshot, recording, or transcript path;
7. linked defect and retest result.

## Sign-off

- [ ] All critical and serious defects are closed.
- [ ] Remaining moderate or minor defects have an owner, rationale, and release decision.
- [ ] Evidence references the exact commit tested.
- [ ] Tester sign-off:
