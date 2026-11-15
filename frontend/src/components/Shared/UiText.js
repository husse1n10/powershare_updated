import { useLang } from '../../contexts/LangContext';
import arabic from '../../uiArabic.json';

export function translateUi(language, value) {
  if (language !== 'ar' || typeof value !== 'string') return value;
  const key = value.replace(/\s+/g, ' ').trim();
  if (!Object.prototype.hasOwnProperty.call(arabic, key)) return value;
  return `${/^\s/.test(value) ? ' ' : ''}${arabic[key]}${/\s$/.test(value) ? ' ' : ''}`;
}

export default function UiText({ children }) {
  const { lang } = useLang();
  return translateUi(lang, children);
}
