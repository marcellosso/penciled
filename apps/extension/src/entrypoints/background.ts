import { type Browser, browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { getSettings, onSettings } from '../lib/settings.ts';
import { onButtonClicked, PORT, setButton, toggleSidebar } from '../lib/sidebar.ts';
import { createSync } from '../lib/sync/engine.ts';
import { storageSyncTransport } from '../lib/sync/transport.ts';

export default defineBackground(() => {
  // Each open sidebar, by window, so the shortcut can close it. Sidebars connect again if this
  // worker is stopped and loses them.
  const sidebars = new Map<number, Browser.runtime.Port>();
  browser.runtime.onConnect.addListener((port) => {
    const [name, window] = port.name.split(':');
    if (name !== PORT) return;
    const windowId = Number(window);
    sidebars.set(windowId, port);
    port.onDisconnect.addListener(() => {
      if (sidebars.get(windowId) === port) sidebars.delete(windowId);
    });
  });

  browser.commands.onCommand.addListener((command, tab) => {
    // Pages where penciled can't run (the browser's own) have no one to receive it.
    if (command === 'toggle' && tab?.id)
      browser.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
    if (command === 'sidebar' && tab) {
      const open = sidebars.get(tab.windowId);
      toggleSidebar(tab.windowId, open && (() => open.postMessage('close')));
    }
  });

  // The button's popup isn't kept when the browser restarts, so it's set each time.
  getSettings().then((s) => setButton(s.buttonOpens));
  onSettings((next, previous) => {
    if (next.buttonOpens !== previous.buttonOpens) setButton(next.buttonOpens);
  });
  onButtonClicked();

  // Highlights sync only once the reader turns it on. Merges on start, and on every change here
  // or from another device.
  createSync(storageSyncTransport()).start();
});
