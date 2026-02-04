# Auto Line Reveal

Sequential text animation with viewport-aware grouping

This script splits text into real layout lines and reveals them sequentially.  
Animations are triggered by viewport visibility and can be coordinated across multiple text blocks using groups and policies.

No framework required.

---

## Core Concepts

### 1. Line-based animation

Text is split into **actual rendered lines**, not guessed by character count.  
Each line animates **only when it becomes visible** and **only after the previous line has finished**.

### 2. Block-based orchestration

Each text block (`[data-split-lines]`) can define:

- **when** it starts
- **how** it relates to other blocks
- **whether** order is enforced strictly or adaptively

### 3. Grouping

Blocks can be assigned to a **group**.  
Sequencing rules apply **only within the same group**.

Different groups run independently.

---

## HTML Usage

```html
<p
  class="bigtext"
  data-split-lines
  data-reveal-mode="linear"
  data-reveal-group="story"
  data-linear-policy="skip-unseen"
>
  Your text here…
</p>
```

## Attributes

`data-split-lines` (required)

Marks an element whose text should be split into lines and animated.
