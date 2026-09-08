import { StyleSheet } from 'react-native';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import { Text } from './Text';

type IconGlyphProps = {
  size?: number;
  value: string;
};

const MINIMALIST_ICON_COLOR = '#1F2937';

const lucideIcons: Readonly<Record<string, ComponentType<SvgProps>>> = {
  'lucide:apple': require('../../assets/lucide_icons/apple.svg').default,
  'lucide:archive': require('../../assets/lucide_icons/archive.svg').default,
  'lucide:arrow-down': require('../../assets/lucide_icons/arrow-down.svg').default,
  'lucide:arrow-left-right': require('../../assets/lucide_icons/arrow-left-right.svg').default,
  'lucide:arrow-up': require('../../assets/lucide_icons/arrow-up.svg').default,
  'lucide:badge-dollar-sign': require('../../assets/lucide_icons/badge-dollar-sign.svg').default,
  'lucide:badge-percent': require('../../assets/lucide_icons/badge-percent.svg').default,
  'lucide:banknote': require('../../assets/lucide_icons/banknote.svg').default,
  'lucide:bell': require('../../assets/lucide_icons/bell.svg').default,
  'lucide:bike': require('../../assets/lucide_icons/bike.svg').default,
  'lucide:book': require('../../assets/lucide_icons/book.svg').default,
  'lucide:bookmark-check': require('../../assets/lucide_icons/bookmark-check.svg').default,
  'lucide:bookmark': require('../../assets/lucide_icons/bookmark.svg').default,
  'lucide:box': require('../../assets/lucide_icons/box.svg').default,
  'lucide:briefcase': require('../../assets/lucide_icons/briefcase.svg').default,
  'lucide:building-2': require('../../assets/lucide_icons/building-2.svg').default,
  'lucide:building': require('../../assets/lucide_icons/building.svg').default,
  'lucide:bus': require('../../assets/lucide_icons/bus.svg').default,
  'lucide:calendar-days': require('../../assets/lucide_icons/calendar-days.svg').default,
  'lucide:calendar': require('../../assets/lucide_icons/calendar.svg').default,
  'lucide:camera': require('../../assets/lucide_icons/camera.svg').default,
  'lucide:car': require('../../assets/lucide_icons/car.svg').default,
  'lucide:chart-bar': require('../../assets/lucide_icons/chart-bar.svg').default,
  'lucide:chart-column': require('../../assets/lucide_icons/chart-column.svg').default,
  'lucide:chart-line': require('../../assets/lucide_icons/chart-line.svg').default,
  'lucide:chart-pie': require('../../assets/lucide_icons/chart-pie.svg').default,
  'lucide:check-check': require('../../assets/lucide_icons/check-check.svg').default,
  'lucide:check': require('../../assets/lucide_icons/check.svg').default,
  'lucide:circle-dollar-sign': require('../../assets/lucide_icons/circle-dollar-sign.svg').default,
  'lucide:clipboard-check': require('../../assets/lucide_icons/clipboard-check.svg').default,
  'lucide:clipboard-list': require('../../assets/lucide_icons/clipboard-list.svg').default,
  'lucide:clock': require('../../assets/lucide_icons/clock.svg').default,
  'lucide:cloud': require('../../assets/lucide_icons/cloud.svg').default,
  'lucide:coffee': require('../../assets/lucide_icons/coffee.svg').default,
  'lucide:coins': require('../../assets/lucide_icons/coins.svg').default,
  'lucide:credit-card': require('../../assets/lucide_icons/credit-card.svg').default,
  'lucide:download': require('../../assets/lucide_icons/download.svg').default,
  'lucide:ellipsis': require('../../assets/lucide_icons/ellipsis.svg').default,
  'lucide:factory': require('../../assets/lucide_icons/factory.svg').default,
  'lucide:file-text': require('../../assets/lucide_icons/file-text.svg').default,
  'lucide:file': require('../../assets/lucide_icons/file.svg').default,
  'lucide:flag': require('../../assets/lucide_icons/flag.svg').default,
  'lucide:folder': require('../../assets/lucide_icons/folder.svg').default,
  'lucide:fuel': require('../../assets/lucide_icons/fuel.svg').default,
  'lucide:gamepad-2': require('../../assets/lucide_icons/gamepad-2.svg').default,
  'lucide:gift': require('../../assets/lucide_icons/gift.svg').default,
  'lucide:globe': require('../../assets/lucide_icons/globe.svg').default,
  'lucide:graduation-cap': require('../../assets/lucide_icons/graduation-cap.svg').default,
  'lucide:hand-coins': require('../../assets/lucide_icons/hand-coins.svg').default,
  'lucide:heart': require('../../assets/lucide_icons/heart.svg').default,
  'lucide:hospital': require('../../assets/lucide_icons/hospital.svg').default,
  'lucide:house': require('../../assets/lucide_icons/house.svg').default,
  'lucide:image': require('../../assets/lucide_icons/image.svg').default,
  'lucide:info': require('../../assets/lucide_icons/info.svg').default,
  'lucide:key-round': require('../../assets/lucide_icons/key-round.svg').default,
  'lucide:landmark': require('../../assets/lucide_icons/landmark.svg').default,
  'lucide:laptop': require('../../assets/lucide_icons/laptop.svg').default,
  'lucide:lock': require('../../assets/lucide_icons/lock.svg').default,
  'lucide:mail': require('../../assets/lucide_icons/mail.svg').default,
  'lucide:map-pin': require('../../assets/lucide_icons/map-pin.svg').default,
  'lucide:menu': require('../../assets/lucide_icons/menu.svg').default,
  'lucide:message-circle': require('../../assets/lucide_icons/message-circle.svg').default,
  'lucide:minus': require('../../assets/lucide_icons/minus.svg').default,
  'lucide:monitor': require('../../assets/lucide_icons/monitor.svg').default,
  'lucide:moon': require('../../assets/lucide_icons/moon.svg').default,
  'lucide:move-left': require('../../assets/lucide_icons/move-left.svg').default,
  'lucide:move-right': require('../../assets/lucide_icons/move-right.svg').default,
  'lucide:package': require('../../assets/lucide_icons/package.svg').default,
  'lucide:phone': require('../../assets/lucide_icons/phone.svg').default,
  'lucide:piggy-bank': require('../../assets/lucide_icons/piggy-bank.svg').default,
  'lucide:pill': require('../../assets/lucide_icons/pill.svg').default,
  'lucide:pizza': require('../../assets/lucide_icons/pizza.svg').default,
  'lucide:plane': require('../../assets/lucide_icons/plane.svg').default,
  'lucide:plus': require('../../assets/lucide_icons/plus.svg').default,
  'lucide:receipt-cent': require('../../assets/lucide_icons/receipt-cent.svg').default,
  'lucide:receipt-text': require('../../assets/lucide_icons/receipt-text.svg').default,
  'lucide:receipt': require('../../assets/lucide_icons/receipt.svg').default,
  'lucide:refresh-cw': require('../../assets/lucide_icons/refresh-cw.svg').default,
  'lucide:search': require('../../assets/lucide_icons/search.svg').default,
  'lucide:send': require('../../assets/lucide_icons/send.svg').default,
  'lucide:settings': require('../../assets/lucide_icons/settings.svg').default,
  'lucide:shield-alert': require('../../assets/lucide_icons/shield-alert.svg').default,
  'lucide:shield-check': require('../../assets/lucide_icons/shield-check.svg').default,
  'lucide:shield': require('../../assets/lucide_icons/shield.svg').default,
  'lucide:shopping-bag': require('../../assets/lucide_icons/shopping-bag.svg').default,
  'lucide:shopping-basket': require('../../assets/lucide_icons/shopping-basket.svg').default,
  'lucide:shopping-cart': require('../../assets/lucide_icons/shopping-cart.svg').default,
  'lucide:sliders-horizontal': require('../../assets/lucide_icons/sliders-horizontal.svg').default,
  'lucide:smartphone': require('../../assets/lucide_icons/smartphone.svg').default,
  'lucide:sparkles': require('../../assets/lucide_icons/sparkles.svg').default,
  'lucide:star': require('../../assets/lucide_icons/star.svg').default,
  'lucide:stethoscope': require('../../assets/lucide_icons/stethoscope.svg').default,
  'lucide:sun': require('../../assets/lucide_icons/sun.svg').default,
  'lucide:tablet': require('../../assets/lucide_icons/tablet.svg').default,
  'lucide:target': require('../../assets/lucide_icons/target.svg').default,
  'lucide:timer': require('../../assets/lucide_icons/timer.svg').default,
  'lucide:trending-down': require('../../assets/lucide_icons/trending-down.svg').default,
  'lucide:trending-up': require('../../assets/lucide_icons/trending-up.svg').default,
  'lucide:truck': require('../../assets/lucide_icons/truck.svg').default,
  'lucide:upload': require('../../assets/lucide_icons/upload.svg').default,
  'lucide:user-check': require('../../assets/lucide_icons/user-check.svg').default,
  'lucide:user-round': require('../../assets/lucide_icons/user-round.svg').default,
  'lucide:user': require('../../assets/lucide_icons/user.svg').default,
  'lucide:users': require('../../assets/lucide_icons/users.svg').default,
  'lucide:utensils': require('../../assets/lucide_icons/utensils.svg').default,
  'lucide:wallet-cards': require('../../assets/lucide_icons/wallet-cards.svg').default,
  'lucide:wallet': require('../../assets/lucide_icons/wallet.svg').default,
  'lucide:wifi': require('../../assets/lucide_icons/wifi.svg').default,
};

export function IconGlyph({ size = 22, value }: IconGlyphProps) {
  const LucideIcon = lucideIcons[value];

  if (LucideIcon) {
    return <LucideIcon color={MINIMALIST_ICON_COLOR} height={size} width={size} />;
  }

  return <Text style={[styles.emoji, { fontSize: size, lineHeight: Math.round(size * 1.25) }]}>{value.replace('emoji:', '')}</Text>;
}

const styles = StyleSheet.create({
  emoji: { textAlign: 'center' },
});

