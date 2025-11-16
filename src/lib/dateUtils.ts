import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistance } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import i18n from '@/i18n/config';

export const getDateLocale = () => {
  return i18n.language === 'tr' ? tr : enUS;
};

export const format = (date: Date | string, formatStr: string) => {
  return dateFnsFormat(
    typeof date === 'string' ? new Date(date) : date,
    formatStr,
    { locale: getDateLocale() }
  );
};

export const formatDistanceToNow = (date: Date | string, options?: any) => {
  return dateFnsFormatDistance(
    typeof date === 'string' ? new Date(date) : date,
    { ...options, locale: getDateLocale() }
  );
};
