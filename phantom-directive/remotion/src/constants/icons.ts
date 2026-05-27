import { Icon as IconifyIcon, type IconifyIcon as IconifyIconType } from '@iconify/react';
import dataConfigIcon   from '@iconify-icons/flat-color-icons/data-configuration';
import conferenceIcon   from '@iconify-icons/flat-color-icons/conference-call';
import commandLineIcon  from '@iconify-icons/flat-color-icons/command-line';
import electronicsIcon  from '@iconify-icons/flat-color-icons/electronics';
import globeIcon        from '@iconify-icons/flat-color-icons/globe';
import databaseIcon     from '@iconify-icons/flat-color-icons/database';
import bearishIcon      from '@iconify-icons/flat-color-icons/bearish';
import okIcon           from '@iconify-icons/flat-color-icons/ok';
import ideaIcon         from '@iconify-icons/flat-color-icons/idea';
import lineChartIcon    from '@iconify-icons/flat-color-icons/line-chart';
import React from 'react';

export const ICON_DATA: Record<string, IconifyIconType> = {
  server:          dataConfigIcon,
  users:           conferenceIcon,
  code:            commandLineIcon,
  cpu:             electronicsIcon,
  globe:           globeIcon,
  database:        databaseIcon,
  'trending-down': bearishIcon,
  'check-circle':  okIcon,
  lightbulb:       ideaIcon,
  activity:        lineChartIcon,
};

export const FlatIcon: React.FC<{ name: string; size: number }> = ({ name, size }) => {
  const icon = ICON_DATA[name] ?? ICON_DATA['activity'];
  return React.createElement(IconifyIcon, { icon, width: size, height: size });
};
