# auto-line-reveal

Auto line-splitting reveal animation for text blocks. Lightweight, multi-instance, and configurable via data attributes.

## Install

```bash
npm install auto-line-reveal
```

## Usage (ESM)

```js
import { AutoLineReveal } from 'auto-line-reveal';
import 'auto-line-reveal/style.css';

const reveal = new AutoLineReveal({
  root: document,
  selector: '[data-split-lines]',
});

reveal.init({ bindResize: true });
```

## Usage (CJS)

```js
const { AutoLineReveal } = require('auto-line-reveal');
require('auto-line-reveal/style.css');

const reveal = new AutoLineReveal({
  root: document,
  selector: '[data-split-lines]',
});

reveal.init({ bindResize: true });
```

## HTML

```html
<p data-split-lines>
  Your text here
</p>
```

## Data Attributes

- `data-reveal-mode`: `immediate` (default) or `linear`
- `data-reveal-group`: group name for linear sequencing (default `default`)
- `data-linear-policy`: `skip-unseen` (default) or `strict`
- `data-line-anim`: `slide-clip` (default), `fade`, `blur-in`, `diag-slice`
- `data-line-anim-ms`: number override for animation duration
- `data-line-anim-intensity`: number in range `0.25`–`2.0` (default `1`)
- `data-debug`: `true` to show the reveal progress overlay

## Public API

- `new AutoLineReveal({ root, selector, debounceMs })`
- `init({ bindResize })`
- `rebuild()`
- `destroy()`

## Notes

- CSS is required. Import `auto-line-reveal/style.css`.
- If you dynamically remove elements or page sections, call `destroy()` on the instance.
