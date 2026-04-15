import { DOCUMENT } from '@angular/common';
import { effect, Inject, Injectable } from '@angular/core';

import { AppLanguageService } from '../../services/app-language.service';
import { AppLanguage, translateUiText } from './ui-translations';

@Injectable({ providedIn: 'root' })
export class LegacyUiTranslationService {
  private readonly textSources = new WeakMap<Text, string>();
  private readonly attributeSources = new WeakMap<Element, Map<string, string>>();
  private observer: MutationObserver | null = null;
  private applying = false;
  private currentLanguage: AppLanguage;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly language: AppLanguageService
  ) {
    this.currentLanguage = this.language.language();

    effect(() => {
      this.currentLanguage = this.language.language();
      queueMicrotask(() => this.translateDocument());
    });

    queueMicrotask(() => this.start());
  }

  private start(): void {
    if (!this.document?.body || typeof MutationObserver === 'undefined') {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      if (this.applying) return;

      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target) {
          this.translateNode(mutation.target);
          continue;
        }

        if (mutation.type === 'attributes' && mutation.target) {
          this.translateNode(mutation.target);
        }

        mutation.addedNodes.forEach((node) => this.translateNode(node));
      }
    });

    this.observer.observe(this.document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'value'],
    });

    this.translateDocument();
  }

  private translateDocument(): void {
    if (!this.document?.body) return;
    this.translateNode(this.document.body);
  }

  private translateNode(node: Node, skip = false): void {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!skip) {
        this.translateTextNode(node as Text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    const tagName = element.tagName;
    const nextSkip =
      skip ||
      element.hasAttribute('data-no-auto-translate') ||
      tagName === 'SCRIPT' ||
      tagName === 'STYLE';

    if (!nextSkip) {
      this.translateAttributes(element);
    }

    for (const child of Array.from(node.childNodes)) {
      this.translateNode(child, nextSkip);
    }
  }

  private translateTextNode(node: Text): void {
    const current = node.textContent ?? '';
    if (!current.trim()) return;

    const source = this.resolveNodeSource(this.textSources, node, current);
    const translated = translateUiText(source, this.currentLanguage);
    if (translated === current) return;

    this.applying = true;
    try {
      node.textContent = translated;
    } finally {
      this.applying = false;
    }
  }

  private translateAttributes(element: Element): void {
    for (const attributeName of this.getTranslatableAttributeNames(element)) {
      const current = element.getAttribute(attributeName) ?? '';
      if (!current.trim()) continue;

      const source = this.resolveAttributeSource(element, attributeName, current);
      const translated = translateUiText(source, this.currentLanguage);
      if (translated === current) continue;

      this.applying = true;
      try {
        element.setAttribute(attributeName, translated);
      } finally {
        this.applying = false;
      }
    }
  }

  private resolveNodeSource<T extends object>(
    storage: WeakMap<T, string>,
    target: T,
    current: string
  ): string {
    const stored = storage.get(target);
    if (!stored) {
      storage.set(target, current);
      return current;
    }

    if (this.matchesStoredSource(stored, current)) {
      return stored;
    }

    storage.set(target, current);
    return current;
  }

  private resolveAttributeSource(element: Element, name: string, current: string): string {
    const storedMap = this.attributeSources.get(element) ?? new Map<string, string>();
    const stored = storedMap.get(name);
    if (!stored) {
      storedMap.set(name, current);
      this.attributeSources.set(element, storedMap);
      return current;
    }

    if (this.matchesStoredSource(stored, current)) {
      return stored;
    }

    storedMap.set(name, current);
    this.attributeSources.set(element, storedMap);
    return current;
  }

  private matchesStoredSource(source: string, current: string): boolean {
    return (
      current === source ||
      current === translateUiText(source, 'zh') ||
      current === translateUiText(source, 'en')
    );
  }

  private getTranslatableAttributeNames(element: Element): string[] {
    const attributes: string[] = [];

    if (element.hasAttribute('placeholder')) {
      attributes.push('placeholder');
    }
    if (element.hasAttribute('title')) {
      attributes.push('title');
    }
    if (element.hasAttribute('aria-label')) {
      attributes.push('aria-label');
    }

    if (element.tagName === 'INPUT') {
      const type = String(element.getAttribute('type') || '').trim().toLowerCase();
      if (type === 'button' || type === 'submit' || type === 'reset') {
        attributes.push('value');
      }
    }

    return attributes;
  }
}
