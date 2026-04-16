import { Pipe, PipeTransform } from '@angular/core';

import { AppLanguageService } from '../../services/app-language.service';
import { LocalizedText } from './ui-translations';

@Pipe({
  name: 'appTranslate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  constructor(private readonly language: AppLanguageService) {}

  transform(value: string | LocalizedText | null | undefined): string {
    return this.language.translate(value);
  }
}
