import { AutoLineReveal } from './auto-line-reveal';

const DEFAULT_TAG = 'auto-line-reveal';
const DEFAULT_ROOT = document;
const DEFAULT_BIND_RESIZE = true;

type DefineOptions = {
  root?: Document | Element;
  bindResize?: boolean;
  tagName?: string;
};

let sharedReveal: AutoLineReveal | null = null;
let sharedRoot: Document | Element = DEFAULT_ROOT;
let sharedBindResize = DEFAULT_BIND_RESIZE;
let sharedTagName = DEFAULT_TAG;
let rebuildQueued = false;

const attributeMap: Record<string, keyof HTMLElement['dataset']> = {
  'reveal-mode': 'revealMode',
  'reveal-group': 'revealGroup',
  'linear-policy': 'linearPolicy',
  'line-anim': 'lineAnim',
  'line-anim-ms': 'lineAnimMs',
  'line-anim-intensity': 'lineAnimIntensity',
  debug: 'debug',
};

const ensureSharedReveal = () => {
  if (!sharedReveal) {
    sharedReveal = new AutoLineReveal({
      root: sharedRoot,
      selector: sharedTagName,
    });
    sharedReveal.init({ bindResize: sharedBindResize });
  }
  return sharedReveal;
};

const queueRebuild = () => {
  const reveal = ensureSharedReveal();
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => {
    rebuildQueued = false;
    reveal.rebuild();
  });
};

export class AutoLineRevealElement extends HTMLElement {
  private _mutationObserver: MutationObserver | null = null;
  private _lastTextContent: string = '';

  static get observedAttributes() {
    return Object.keys(attributeMap);
  }

  connectedCallback() {
    this._syncAttributesToDataset();
    this._lastTextContent = this.textContent ?? '';
    this._ensureMutationObserver();
    queueRebuild();
  }

  disconnectedCallback() {
    this._disconnectMutationObserver();
    queueRebuild();
  }

  attributeChangedCallback() {
    this._syncAttributesToDataset();
    queueRebuild();
  }

  private _syncAttributesToDataset() {
    for (const [attr, datasetKey] of Object.entries(attributeMap)) {
      if (this.hasAttribute(attr)) {
        this.dataset[datasetKey] = this.getAttribute(attr) ?? '';
      } else {
        delete this.dataset[datasetKey];
      }
    }
  }

  private _ensureMutationObserver() {
    if (this._mutationObserver) return;
    this._mutationObserver = new MutationObserver(() => {
      const currentText = this.textContent ?? '';
      if (currentText === this._lastTextContent) return;
      this._lastTextContent = currentText;
      delete this.dataset.originalText;
      queueRebuild();
    });
    this._mutationObserver.observe(this, {
      characterData: true,
      subtree: true,
      childList: true,
    });
  }

  private _disconnectMutationObserver() {
    if (!this._mutationObserver) return;
    this._mutationObserver.disconnect();
    this._mutationObserver = null;
  }
}

export const defineAutoLineRevealElement = (
  options: DefineOptions = {}
) => {
  const tagName = options.tagName ?? DEFAULT_TAG;
  sharedRoot = options.root ?? DEFAULT_ROOT;
  sharedBindResize = options.bindResize ?? DEFAULT_BIND_RESIZE;
  sharedTagName = tagName;

  if (!customElements.get(tagName)) {
    customElements.define(tagName, AutoLineRevealElement);
  }
};
