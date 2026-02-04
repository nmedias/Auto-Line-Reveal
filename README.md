# Auto Line Reveal

Sequential text animation with viewport-aware grouping.

This script splits text into real layout lines and reveals them sequentially.  
Animations are triggered by viewport visibility and can be coordinated across multiple text blocks using groups and policies.

No framework required.

---

## Core Concepts

### 1. Line-based animation

Text is split into **actual rendered lines**, not guessed by character count.  
Each line animates **only when it becomes visible** and **only after the previous line has finished**.

### 2. Block-based orchestration

Each text block can define:

- **when** it starts
- **how** it relates to other blocks
- **whether** order is enforced strictly or adaptively

### 3. Grouping

Blocks can be assigned to a **group**.  
Sequencing rules apply **only within the same group**.

Different groups run independently.

---

## Web Component Usage

```html

  <auto-line-reveal
    reveal-mode="linear"
    reveal-group="story"
    linear-policy="skip-unseen"
  >
    Your text here…
  </auto-line-reveal>

```

## Attributes

`reveal-mode`

`immediate` (default) or `linear`.

`reveal-group`

Group name for linear sequencing. Defaults to `default`.

`linear-policy`

`strict` or `skip-unseen` (default).

`line-anim`

`slide-clip` (default), `fade`, `blur-in`, or `diag-slice`.

`line-anim-ms`

Override line animation duration in ms.

`line-anim-intensity`

Controls animation strength (e.g., `0.25` to `2.0`).

`debug`

`true` or `false` to show reveal progress on each line.

---

## Web Component Setup 

```ts
import { defineAutoLineRevealElement } from 'auto-line-reveal';

defineAutoLineRevealElement({
  root: document,
  bindResize: true,
  tagName: 'auto-line-reveal',
});
```

You can use the Web Component and a manually instantiated `AutoLineReveal` in the same project (they operate independently as long as they target different selectors).

## Manual Instantiation (ESM)

```ts
import { AutoLineReveal } from 'auto-line-reveal';
import 'auto-line-reveal/style.css';

const reveal = new AutoLineReveal({
  root: document,
  selector: '[data-split-lines]',
});

reveal.init({ bindResize: true });
```
