type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private static handlers = new Map<string, Set<EventHandler>>();

  static on<T>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)?.add(handler as EventHandler);
  }

  static off<T>(eventName: string, handler: EventHandler<T>): void {
    this.handlers.get(eventName)?.delete(handler as EventHandler);
  }

  static emit<T>(eventName: string, payload: T): void {
    this.handlers.get(eventName)?.forEach((handler) => handler(payload));
  }
}
