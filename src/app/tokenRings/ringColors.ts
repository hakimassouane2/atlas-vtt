import { t } from '../i18n';

/** The colours a ring is given, in the token menu and in the collection's Tokens tab. */
export const ringColors = (): ReadonlyArray<{ value: string; label: string }> => [
  { label: t('color.blue'), value: '#086ddd' },
  { label: t('color.orange'), value: '#ec7500' },
  { label: t('color.red'), value: '#e93147' },
  { label: t('color.yellow'), value: '#e0ac00' },
  { label: t('color.brown'), value: '#a97142' },
  { label: t('color.purple'), value: '#7852ee' },
  { label: t('color.green'), value: '#08b94e' },
  { label: t('color.pink'), value: '#d53984' },
  { label: t('color.cyan'), value: '#00bfbc' },
  { label: t('color.gray'), value: '#ababab' },
  { label: t('color.white'), value: '#ffffff' },
];
