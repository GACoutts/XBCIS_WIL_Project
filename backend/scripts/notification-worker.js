import { retryFailedNotifications } from '../utils/notify.js';

(async ()=>{
  try {
    const res = await retryFailedNotifications(100);
    console.log('[notify-worker]', new Date().toISOString(), res);
    process.exit(0);
  } catch (e) {
    console.error('[notify-worker] error', e);
    process.exit(1);
  }
})();
