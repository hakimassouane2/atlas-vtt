import { networkInterfaces } from 'os';

/**
 * This computer's address on its local network (Wi-Fi or Ethernet), which other devices there
 * reach it at; null without one. Private IPv4 addresses come first: a VPN's or a container's
 * interface is no network the players are on.
 */
export function lanAddress(): string | null {
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
  return addresses.find(isPrivate) ?? addresses[0] ?? null;
}

/** Whether `address` is a private IPv4 address, as home routers give them. */
function isPrivate(address: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
}
