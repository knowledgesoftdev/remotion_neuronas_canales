import { Icon as IconifyIcon, type IconifyIcon as IconifyIconType } from '@iconify/react';
import dataConfigIcon   from '@iconify-icons/flat-color-icons/data-configuration';
import conferenceIcon   from '@iconify-icons/flat-color-icons/conference-call';
import commandLineIcon  from '@iconify-icons/flat-color-icons/command-line';
import electronicsIcon  from '@iconify-icons/flat-color-icons/electronics';
import globeIcon        from '@iconify-icons/flat-color-icons/globe';
import databaseIcon     from '@iconify-icons/flat-color-icons/database';
import bearishIcon      from '@iconify-icons/flat-color-icons/bearish';
import bullishIcon      from '@iconify-icons/flat-color-icons/bullish';
import okIcon           from '@iconify-icons/flat-color-icons/ok';
import ideaIcon         from '@iconify-icons/flat-color-icons/idea';
import lineChartIcon    from '@iconify-icons/flat-color-icons/line-chart';
import clockIcon        from '@iconify-icons/flat-color-icons/clock';
import settingsIcon     from '@iconify-icons/flat-color-icons/settings';
import moneyIcon        from '@iconify-icons/flat-color-icons/paid';
import calendarIcon     from '@iconify-icons/flat-color-icons/calendar';
import statisticsIcon   from '@iconify-icons/flat-color-icons/statistics';
import managerIcon      from '@iconify-icons/flat-color-icons/manager';
import approvalIcon     from '@iconify-icons/flat-color-icons/approval';
import documentIcon     from '@iconify-icons/flat-color-icons/document';
import expiredIcon      from '@iconify-icons/flat-color-icons/expired';
import highPriorityIcon from '@iconify-icons/flat-color-icons/high-priority';
import brokenLinkIcon   from '@iconify-icons/flat-color-icons/broken-link';
import workflowIcon     from '@iconify-icons/flat-color-icons/workflow';
import React from 'react';

export const ICON_DATA: Record<string, IconifyIconType> = {
  // originales
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
  // antes sin mapeo → ahora con icono propio
  clock:           clockIcon,
  gear:            settingsIcon,
  alert:           highPriorityIcon,
  network:         dataConfigIcon,
  rails:           workflowIcon,
  jvm:             documentIcon,
  fanout:          workflowIcon,
  team:            conferenceIcon,
  // nuevos
  money:           moneyIcon,
  bullish:         bullishIcon,
  calendar:        calendarIcon,
  statistics:      statisticsIcon,
  manager:         managerIcon,
  approval:        approvalIcon,
  document:        documentIcon,
  expired:         expiredIcon,
  broken:          brokenLinkIcon,
  workflow:        workflowIcon,
  settings:        settingsIcon,
};

export const FlatIcon: React.FC<{ name: string; size: number }> = ({ name, size }) => {
  const icon = ICON_DATA[name] ?? ICON_DATA['activity'];
  return React.createElement(IconifyIcon, { icon, width: size, height: size });
};
