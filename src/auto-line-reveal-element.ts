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

/**
 * Lazily create and initialize a shared AutoLineReveal instance.
 * @returns {AutoLineReveal} Shared reveal instance.
 */
const ensureSharedReveal = (): AutoLineReveal => {
  if (!sharedReveal) {
    sharedReveal = new AutoLineReveal({
      root: sharedRoot,
      selector: sharedTagName,
    });
    sharedReveal.init({ bindResize: sharedBindResize });
  }
  return sharedReveal;
};

/**
 * Schedule a single rebuild on the next animation frame.
 * @returns {void}
 */
const queueRebuild = (): void => {
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

  /**
   * Attributes to watch so `attributeChangedCallback` fires on updates.
   * @returns {string[]} Observed attribute names.
   */
  static get observedAttributes():string[] {
    return Object.keys(attributeMap);
  }

  /**
   * Element lifecycle: connect, sync attributes, and rebuild.
   * @returns {void}
   */
  connectedCallback():void {
    this._syncAttributesToDataset();
    this._lastTextContent = this.textContent ?? '';
    this._ensureMutationObserver();
    queueRebuild();
  }

  /**
   * Element lifecycle: disconnect and rebuild.
   * @returns {void}
   */
  disconnectedCallback():void {
    this._disconnectMutationObserver();
    queueRebuild();
  }

  /**
   * Handle observed attribute changes by syncing and rebuilding.
   * @returns {void}
   */
  attributeChangedCallback():void {
    this._syncAttributesToDataset();
    queueRebuild();
  }

  /**
   * Mirror element attributes into dataset keys used by AutoLineReveal.
   * @returns {void}
   */
  private _syncAttributesToDataset(): void {
    for (const [attr, datasetKey] of Object.entries(attributeMap)) {
      if (this.hasAttribute(attr)) {
        this.dataset[datasetKey] = this.getAttribute(attr) ?? '';
      } else {
        delete this.dataset[datasetKey];
      }
    }
  }

  /**
   * Attach a MutationObserver to detect external text changes.
   * @returns {void}
   */
  private _ensureMutationObserver(): void {
    if (this._mutationObserver) return;
    this._mutationObserver = new MutationObserver(() => {
      const externalText = this._getExternalText();
      if (!externalText) return;
      if (externalText === this._lastTextContent) return;
      this._lastTextContent = externalText;
      delete this.dataset.originalText;
      queueRebuild();
    });
    this._mutationObserver.observe(this, {
      characterData: true,
      subtree: true,
      childList: true,
    });
  }

  /**
   * Disconnect and clear the MutationObserver.
   * @returns {void}
   */
  private _disconnectMutationObserver(): void {
    if (!this._mutationObserver) return;
    this._mutationObserver.disconnect();
    this._mutationObserver = null;
  }

  /**
   * Collect text nodes excluding reveal markup.
   * @returns {string} Normalized external text content.
   */
  private _getExternalText(): string {
    const walker = document.createTreeWalker(
      this,
      NodeFilter.SHOW_TEXT,
      null
    );

    let result = '';
    let node: Node | null = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent && parent.closest('.reveal__lines')) {
        node = walker.nextNode();
        continue;
      }
      result += node.textContent ?? '';
      node = walker.nextNode();
    }

    return result.replace(/\s+/g, ' ').trim();
  }
}

/**
 * Define the custom element and configure shared instance options.
 * @param {DefineOptions} options Definition options.
 * @param {Document | Element} options.root Root element or document to scope queries.
 * @param {boolean} options.bindResize Whether to bind a resize listener.
 * @param {string} options.tagName Tag name for the custom element.
 * @returns {void}
 */
export const defineAutoLineRevealElement = (
  options: DefineOptions = {}
): void => {
  const tagName = options.tagName ?? DEFAULT_TAG;
  sharedRoot = options.root ?? DEFAULT_ROOT;
  sharedBindResize = options.bindResize ?? DEFAULT_BIND_RESIZE;
  sharedTagName = tagName;

  if (!customElements.get(tagName)) {
    customElements.define(tagName, AutoLineRevealElement);
  }
};
