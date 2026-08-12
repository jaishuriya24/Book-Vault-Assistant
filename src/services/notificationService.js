// Global Professional Notification and Modal Confirmation Service for Book Vault
class NotificationService {
  constructor() {
    this.listeners = new Set();
    this.confirmListeners = new Set();
    this.audioCtx = null;
  }

  // Play subtle luxury earcons
  playChime(type = "info") {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = type === "error" ? 280 : type === "success" ? 780 : type === "confirm" ? 520 : 440;
      const duration = type === "confirm" ? 0.2 : 0.15;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  // Add listener for toasts
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Add listener for confirm modals
  subscribeConfirm(listener) {
    this.confirmListeners.add(listener);
    return () => this.confirmListeners.delete(listener);
  }

  emit(toast) {
    this.playChime(toast.type);
    this.listeners.forEach((listener) => listener(toast));
  }

  success(message, duration = 3500) {
    this.emit({ id: Date.now() + Math.random(), type: "success", message, duration });
  }

  error(message, duration = 4000) {
    this.emit({ id: Date.now() + Math.random(), type: "error", message, duration });
  }

  info(message, duration = 3000) {
    this.emit({ id: Date.now() + Math.random(), type: "info", message, duration });
  }

  warning(message, duration = 3500) {
    this.emit({ id: Date.now() + Math.random(), type: "warning", message, duration });
  }

  // Professional Promise-based modal confirmation
  confirm({
    title = "Confirmation Required",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "danger", // 'danger' | 'warning' | 'info'
    icon = "🚪",
  }) {
    this.playChime("confirm");
    return new Promise((resolve) => {
      const confirmData = {
        id: Date.now(),
        title,
        message,
        confirmText,
        cancelText,
        type,
        icon,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      };
      this.confirmListeners.forEach((listener) => listener(confirmData));
    });
  }
}

export const notify = new NotificationService();
export default notify;
