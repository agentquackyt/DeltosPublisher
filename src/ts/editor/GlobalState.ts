import { Project, type ProjectJSON } from "../types/Project.ts";
import { Template, type TemplateJSON } from "../types/Template.ts";
import { Content, type ContentJSON } from "../types/Content.ts";
import { Asset, type AssetJSON } from "../types/Asset.ts";

type SelectionState = {
	fieldId: string | null;
};

type HistoryState = {
	past: AppStateJSON[];
	future: AppStateJSON[];
	grouping: boolean;
	groupBase: AppStateJSON | null;
};

type AppState = {
	project: Project;
	templates: Template[];
	contents: Content[];
	assets: Asset[];
	selection: SelectionState;
	mode: 'design' | 'content';
};

type AppStateJSON = {
	project: ProjectJSON;
	templates: TemplateJSON[];
	contents: ContentJSON[];
	assets: AssetJSON[];
	selection: SelectionState;
	mode: 'design' | 'content';
};

type HistorySnapshot = {
	past: AppStateJSON[];
	future: AppStateJSON[];
};

type Subscriber<T> = (state: T) => void;

type UpdateOptions = {
	recordHistory?: boolean;
};

const cloneState = <T>(state: T): T => {
	try {
		return structuredClone(state);
	} catch {
		return JSON.parse(JSON.stringify(state)) as T;
	}
};

const serializeState = (state: AppState): AppStateJSON => ({
	project: state.project.toJSON(),
	templates: state.templates.map(template => template.toJSON()),
	contents: state.contents.map(content => content.toJSON()),
	assets: state.assets.map(asset => asset.toJSON()),
	selection: { fieldId: state.selection.fieldId ?? null },
	mode: state.mode,
});

const deserializeState = (payload: AppStateJSON): AppState => ({
	project: Project.fromJSON(payload.project),
	templates: payload.templates.map(template => Template.fromJSON(template)),
	contents: payload.contents.map(content => Content.fromJSON(content)),
	assets: payload.assets.map(asset => Asset.fromJSON(asset)),
	selection: { fieldId: payload.selection?.fieldId ?? null },
	mode: payload.mode === 'content' ? 'content' : 'design',
});

class GlobalState {
	private _state: AppState;
	private _subscribers: Subscriber<AppState>[];
	private _history: HistoryState;

	constructor(initialState: AppState) {
		this._state = initialState;
		this._subscribers = [];
		this._history = {
			past: [],
			future: [],
			grouping: false,
			groupBase: null,
		};
	}

	getState() {
		return this._state;
	}

	subscribe(subscriber: Subscriber<AppState>) {
		this._subscribers.push(subscriber);
		subscriber(this._state);

		return () => {
			this._subscribers = this._subscribers.filter(entry => entry !== subscriber);
		};
	}

	setState(nextState: AppState, options?: UpdateOptions) {
		const recordHistory = options?.recordHistory !== false;
		if (recordHistory && !this._history.grouping) {
			this._history.past.push(serializeState(this._state));
			this._history.future = [];
		}

		this._state = nextState;
		this._subscribers.forEach(subscriber => subscriber(this._state));
	}

	update(updater: (current: AppState) => AppState, options?: UpdateOptions) {
		const nextState = updater(this._state);
		this.setState(nextState, options);
	}

	select<T>(selector: (state: AppState) => T) {
		return selector(this._state);
	}

	beginHistoryGroup() {
		if (this._history.grouping) {
			return;
		}

		this._history.grouping = true;
		this._history.groupBase = serializeState(this._state);
	}

	commitHistoryGroup() {
		if (!this._history.grouping) {
			return;
		}

		if (this._history.groupBase) {
			this._history.past.push(this._history.groupBase);
			this._history.future = [];
		}

		this._history.grouping = false;
		this._history.groupBase = null;
	}

	undo() {
		if (this._history.past.length === 0 || this._history.grouping) {
			return;
		}

		const previous = this._history.past.pop();
		if (!previous) {
			return;
		}

		this._history.future.push(serializeState(this._state));
		this._state = deserializeState(previous);
		this._subscribers.forEach(subscriber => subscriber(this._state));
	}

	redo() {
		if (this._history.future.length === 0 || this._history.grouping) {
			return;
		}

		const next = this._history.future.pop();
		if (!next) {
			return;
		}

		this._history.past.push(serializeState(this._state));
		this._state = deserializeState(next);
		this._subscribers.forEach(subscriber => subscriber(this._state));
	}

	resetHistory() {
		this._history = {
			past: [],
			future: [],
			grouping: false,
			groupBase: null,
		};
	}

	getHistorySnapshot(): HistorySnapshot {
		return {
			past: [...this._history.past],
			future: [...this._history.future],
		};
	}

	restoreHistorySnapshot(snapshot: HistorySnapshot) {
		this._history = {
			past: snapshot.past.map(entry => ({ ...entry })),
			future: snapshot.future.map(entry => ({ ...entry })),
			grouping: false,
			groupBase: null,
		};
	}
}

export type { AppState, SelectionState, AppStateJSON, HistorySnapshot };
export { GlobalState };
