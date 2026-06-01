export class KeybindManager {
    private static instance: KeybindManager;
    private bindings: Map<string, (event: KeyboardEvent) => void>;

    private constructor() {
        this.bindings = new Map();
        this.setupListener();
    }

    public static getInstance(): KeybindManager {
        if (!KeybindManager.instance) {
            KeybindManager.instance = new KeybindManager();
        }
        return KeybindManager.instance;
    }

    private setupListener() {
        document.addEventListener('keydown', (event) => {
            // Ignore key events if the user is typing in an input field (except if specifically listening)
            const target = event.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }

            const key = this.getEventKey(event);
            if (this.bindings.has(key)) {
                event.preventDefault();
                this.bindings.get(key)!(event);
            }
        });
    }

    private getEventKey(event: KeyboardEvent): string {
        const parts = [];
        if (event.ctrlKey || event.metaKey) parts.push('Mod');
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        parts.push(event.key.toLowerCase());
        return parts.join('+');
    }

    public bind(keyStr: string, callback: (event: KeyboardEvent) => void) {
        this.bindings.set(keyStr.toLowerCase(), callback);
    }

    public unbind(keyStr: string) {
        this.bindings.delete(keyStr.toLowerCase());
    }
}