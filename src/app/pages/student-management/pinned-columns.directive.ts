import { AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';

@Directive({ selector: 'table[appPinnedColumns]', standalone: true })
export class PinnedColumnsDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() appPinnedColumns: ReadonlySet<string> = new Set();
  private resize?: ResizeObserver;
  private mutations?: MutationObserver;
  private destroyed = false;

  constructor(private element: ElementRef<HTMLTableElement>) {}

  ngAfterViewInit(): void {
    this.resize = new ResizeObserver(() => this.updateOffsets());
    this.mutations = new MutationObserver(() => this.observeHeaders());
    this.mutations.observe(this.element.nativeElement, { childList: true, subtree: true });
    this.observeHeaders();
  }

  ngOnChanges(): void { queueMicrotask(() => { if (!this.destroyed) this.updateOffsets(); }); }

  private observeHeaders(): void {
    this.resize?.disconnect();
    this.element.nativeElement.querySelectorAll('th[data-column-key]').forEach(header => this.resize?.observe(header));
    this.updateOffsets();
  }

  private updateOffsets(): void {
    const offsets = new Map<string, number>();
    let left = 0;
    this.element.nativeElement.querySelectorAll<HTMLElement>('th[data-column-key]').forEach(header => {
      const key = header.dataset['columnKey']!;
      if (this.appPinnedColumns.has(key)) {
        offsets.set(key, left);
        left += header.getBoundingClientRect().width;
      }
    });
    this.element.nativeElement.querySelectorAll<HTMLElement>('[data-column-key]').forEach(cell => {
      const offset = offsets.get(cell.dataset['columnKey']!);
      cell.style.left = offset === undefined ? '' : `${offset}px`;
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resize?.disconnect();
    this.mutations?.disconnect();
  }
}
