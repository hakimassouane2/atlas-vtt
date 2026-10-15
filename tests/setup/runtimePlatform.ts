import { Platform } from 'obsidian';
import { runtimePlatform } from '../../src/app/keyboard/runtimePlatform';

// Fork: the plugin copies Obsidian's platform into `runtimePlatform` when it loads (the online page
// sets its own). Tests set the mocked `Platform`, so the canvas reads it from there.
Object.defineProperty(runtimePlatform, 'isMacOS', {
  configurable: true,
  get: () => Platform.isMacOS,
  set: (value: boolean) => { Platform.isMacOS = value; },
});
