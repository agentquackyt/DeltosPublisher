var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// src/ts/types/Project.ts
class Project {
  _id;
  _createdAt;
  _updatedAt;
  name;
  activeTemplateId;
  activeContentId;
  contentFormat;
  backgroundColor;
  constructor(name, options) {
    this._id = options?.id || self.crypto.randomUUID();
    this._createdAt = options?.createdAt || new Date;
    this._updatedAt = options?.updatedAt || new Date;
    this.name = name;
    this.activeTemplateId = options?.activeTemplateId ?? null;
    this.activeContentId = options?.activeContentId ?? null;
    this.contentFormat = options?.contentFormat ? { ...options.contentFormat } : null;
    this.backgroundColor = options?.backgroundColor ?? null;
  }
  get id() {
    return this._id;
  }
  get createdAt() {
    return this._createdAt;
  }
  get updatedAt() {
    return this._updatedAt;
  }
  touch() {
    this._updatedAt = new Date;
  }
  toJSON() {
    return {
      version: PROJECT_SCHEMA_VERSION,
      id: this._id,
      name: this.name,
      activeTemplateId: this.activeTemplateId,
      activeContentId: this.activeContentId,
      contentFormat: this.contentFormat ? { ...this.contentFormat } : null,
      backgroundColor: this.backgroundColor ?? null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }
  static fromJSON(payload) {
    if (!isProjectJSON(payload)) {
      throw new Error("Invalid project payload");
    }
    return new Project(payload.name, {
      id: payload.id,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      activeTemplateId: payload.activeTemplateId,
      activeContentId: payload.activeContentId,
      contentFormat: payload.contentFormat ? { ...payload.contentFormat } : null,
      backgroundColor: payload.backgroundColor ?? null
    });
  }
}
var PROJECT_SCHEMA_VERSION = 1, createDefaultLocation = () => ({
  x: 0,
  y: 0,
  anchor: "top-left",
  unit: "px"
}), createDefaultSize = () => ({
  width: 200,
  height: 120,
  unit: "px"
}), createDefaultFieldStyle = () => ({
  padding: 8,
  color: "#202124",
  backgroundColor: "transparent",
  fontFamily: "Google Sans, sans-serif",
  fontSize: 16,
  fontWeight: "600",
  textAlign: "center"
}), normalizeFieldStyle = (value) => {
  return {
    ...createDefaultFieldStyle(),
    ...value || {}
  };
}, normalizeProjectField = (field) => {
  return {
    ...field,
    imageAssetId: field.imageAssetId ?? null,
    style: normalizeFieldStyle(field.style)
  };
}, createProjectField = (type, value, overrides) => {
  const nextField = {
    id: self.crypto.randomUUID(),
    type,
    value,
    imageAssetId: null,
    location: createDefaultLocation(),
    size: createDefaultSize(),
    rotation: 0,
    style: createDefaultFieldStyle(),
    ...overrides
  };
  nextField.style = normalizeFieldStyle(overrides?.style || nextField.style);
  return nextField;
}, isProjectJSON = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload;
  return typeof record.version === "number" && typeof record.id === "string" && typeof record.name === "string" && (record.activeTemplateId === null || typeof record.activeTemplateId === "string") && (record.activeContentId === null || typeof record.activeContentId === "string") && (record.contentFormat === null || record.contentFormat === undefined || typeof record.contentFormat === "object" && record.contentFormat !== null && typeof record.contentFormat.label === "string" && typeof record.contentFormat.width === "number" && typeof record.contentFormat.height === "number") && (record.backgroundColor === undefined || record.backgroundColor === null || typeof record.backgroundColor === "string") && typeof record.createdAt === "string" && typeof record.updatedAt === "string";
};
var init_Project = () => {};

// src/ts/storage/browserStorage.ts
var createMemoryStorage = () => {
  const store = new Map;
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    }
  };
}, resolveStorage = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {}
  return createMemoryStorage();
}, storage, getJSON = (key) => {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}, lastQuotaAlert = 0, setJSON = (key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e?.name === "QuotaExceededError") {
      console.error("Storage quota exceeded when setting key:", key);
      const now = Date.now();
      if (now - lastQuotaAlert > 5000) {
        lastQuotaAlert = now;
        alert("Storage limit reached! Your recent changes could not be saved. Please remove some large images or create a new project.");
      }
    } else {
      throw e;
    }
  }
}, initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DeltosPublisherDB", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("keyval")) {
        db.createObjectStore("keyval");
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}, idbSet = async (key, value) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("keyval", "readwrite");
    const store = transaction.objectStore("keyval");
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}, idbGet = async (key) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("keyval", "readonly");
    const store = transaction.objectStore("keyval");
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
    request.onerror = () => reject(request.error);
  });
};
var init_browserStorage = __esm(() => {
  storage = resolveStorage();
});

// src/ts/types/Template.ts
var exports_Template = {};
__export(exports_Template, {
  Template: () => Template,
  TEMPLATE_SCHEMA_VERSION: () => TEMPLATE_SCHEMA_VERSION
});

class Template {
  name;
  _id;
  fields = [];
  description = "";
  thumbnail = "";
  constructor(name, id) {
    this.name = name;
    this._id = id || self.crypto.randomUUID();
    this.fields = [];
  }
  get id() {
    return this._id;
  }
  setFields(fields) {
    this.fields = fields.map((field) => normalizeProjectField(field));
  }
  getFields() {
    return [...this.fields];
  }
  addField(field) {
    this.fields.push(normalizeProjectField(field));
  }
  removeField(fieldId) {
    this.fields = this.fields.filter((field) => field.id !== fieldId);
  }
  static async fromFile(file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    return Template.fromJSON(payload);
  }
  static fromMemory(id) {
    const payload = getJSON("publisher.templates");
    if (!payload) {
      throw new Error(`Template ${id} not found in memory`);
    }
    const found = payload.find((item) => item.id === id);
    if (!found) {
      throw new Error(`Template ${id} not found in memory`);
    }
    return Template.fromJSON(found);
  }
  toJSON() {
    return {
      version: TEMPLATE_SCHEMA_VERSION,
      id: this._id,
      name: this.name,
      description: this.description,
      thumbnail: this.thumbnail,
      fields: [...this.fields]
    };
  }
  static fromJSON(payload) {
    if (!isTemplateJSON(payload)) {
      throw new Error("Invalid template payload");
    }
    const template = new Template(payload.name, payload.id);
    template.description = payload.description;
    template.thumbnail = payload.thumbnail;
    template.setFields(payload.fields);
    return template;
  }
}
var TEMPLATE_SCHEMA_VERSION = 1, isTemplateJSON = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload;
  return typeof record.version === "number" && typeof record.id === "string" && typeof record.name === "string" && typeof record.description === "string" && typeof record.thumbnail === "string" && Array.isArray(record.fields);
};
var init_Template = __esm(() => {
  init_Project();
  init_browserStorage();
});

// src/ts/editor/GlobalState.ts
init_Project();
init_Template();

// src/ts/types/Content.ts
var CONTENT_SCHEMA_VERSION = 1;
var isContentJSON = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload;
  return typeof record.version === "number" && typeof record.id === "string" && typeof record.name === "string" && typeof record.templateId === "string" && Array.isArray(record.values) && typeof record.createdAt === "string" && typeof record.updatedAt === "string";
};

class Content {
  _id;
  _createdAt;
  _updatedAt;
  _values;
  name;
  templateId;
  constructor(name, templateId, options) {
    this._id = options?.id || self.crypto.randomUUID();
    this._createdAt = options?.createdAt || new Date;
    this._updatedAt = options?.updatedAt || new Date;
    this._values = options?.values || [];
    this.name = name;
    this.templateId = templateId;
  }
  get id() {
    return this._id;
  }
  get createdAt() {
    return this._createdAt;
  }
  get updatedAt() {
    return this._updatedAt;
  }
  get values() {
    return [...this._values];
  }
  getValue(fieldId) {
    return this._values.find((value) => value.fieldId === fieldId)?.value || "";
  }
  setValue(fieldId, value) {
    const existing = this._values.find((entry) => entry.fieldId === fieldId);
    if (existing) {
      existing.value = value;
    } else {
      this._values.push({ fieldId, value });
    }
    this._updatedAt = new Date;
  }
  removeValue(fieldId) {
    this._values = this._values.filter((entry) => entry.fieldId !== fieldId);
    this._updatedAt = new Date;
  }
  toJSON() {
    return {
      version: CONTENT_SCHEMA_VERSION,
      id: this._id,
      name: this.name,
      templateId: this.templateId,
      values: [...this._values],
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }
  static fromJSON(payload) {
    if (!isContentJSON(payload)) {
      throw new Error("Invalid content payload");
    }
    return new Content(payload.name, payload.templateId, {
      id: payload.id,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      values: payload.values
    });
  }
}

// src/ts/types/Asset.ts
var ASSET_SCHEMA_VERSION = 1;
var isAssetJSON = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload;
  return typeof record.version === "number" && typeof record.id === "string" && typeof record.name === "string" && typeof record.mimeType === "string" && typeof record.dataUrl === "string" && (record.scope === "project" || record.scope === "global") && (record.crop === null || typeof record.crop === "object" && record.crop !== null && typeof record.crop.x === "number" && typeof record.crop.y === "number" && typeof record.crop.width === "number" && typeof record.crop.height === "number") && typeof record.createdAt === "string" && typeof record.updatedAt === "string";
};
var normalizeAssetCrop = (crop) => {
  if (!crop) {
    return null;
  }
  return {
    x: Number.isFinite(crop.x) ? Number(crop.x) : 0,
    y: Number.isFinite(crop.y) ? Number(crop.y) : 0,
    width: Number.isFinite(crop.width) ? Number(crop.width) : 0,
    height: Number.isFinite(crop.height) ? Number(crop.height) : 0
  };
};

class Asset {
  _id;
  _createdAt;
  _updatedAt;
  name;
  mimeType;
  dataUrl;
  scope;
  crop;
  constructor(name, mimeType, dataUrl, options) {
    this._id = options?.id || self.crypto.randomUUID();
    this._createdAt = options?.createdAt || new Date;
    this._updatedAt = options?.updatedAt || new Date;
    this.name = name;
    this.mimeType = mimeType;
    this.dataUrl = dataUrl;
    this.scope = options?.scope ?? "project";
    this.crop = normalizeAssetCrop(options?.crop ?? null);
  }
  get id() {
    return this._id;
  }
  get createdAt() {
    return this._createdAt;
  }
  get updatedAt() {
    return this._updatedAt;
  }
  setName(name) {
    this.name = name;
    this._updatedAt = new Date;
  }
  setScope(scope) {
    this.scope = scope;
    this._updatedAt = new Date;
  }
  setCrop(crop) {
    this.crop = normalizeAssetCrop(crop);
    this._updatedAt = new Date;
  }
  isVector() {
    return this.mimeType === "image/svg+xml";
  }
  toJSON() {
    return {
      version: ASSET_SCHEMA_VERSION,
      id: this._id,
      name: this.name,
      mimeType: this.mimeType,
      dataUrl: this.dataUrl,
      scope: this.scope,
      crop: this.crop ? { ...this.crop } : null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
    };
  }
  static fromJSON(payload) {
    if (!isAssetJSON(payload)) {
      throw new Error("Invalid asset payload");
    }
    return new Asset(payload.name, payload.mimeType, payload.dataUrl, {
      id: payload.id,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
      scope: payload.scope,
      crop: payload.crop
    });
  }
  static async fromFile(file, scope = "project") {
    const dataUrl = await fileToDataUrl(file);
    return new Asset(file.name, file.type || "application/octet-stream", dataUrl, { scope });
  }
}
var fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

// src/ts/editor/GlobalState.ts
var serializeState = (state) => ({
  project: state.project.toJSON(),
  templates: state.templates.map((template) => template.toJSON()),
  contents: state.contents.map((content) => content.toJSON()),
  assets: state.assets.map((asset) => asset.toJSON()),
  selection: { fieldId: state.selection.fieldId ?? null },
  mode: state.mode
});
var deserializeState = (payload) => ({
  project: Project.fromJSON(payload.project),
  templates: payload.templates.map((template) => Template.fromJSON(template)),
  contents: payload.contents.map((content) => Content.fromJSON(content)),
  assets: payload.assets.map((asset) => Asset.fromJSON(asset)),
  selection: { fieldId: payload.selection?.fieldId ?? null },
  mode: payload.mode === "content" ? "content" : "design"
});

class GlobalState {
  _state;
  _subscribers;
  _history;
  constructor(initialState) {
    this._state = initialState;
    this._subscribers = [];
    this._history = {
      past: [],
      future: [],
      grouping: false,
      groupBase: null
    };
  }
  getState() {
    return this._state;
  }
  subscribe(subscriber) {
    this._subscribers.push(subscriber);
    subscriber(this._state);
    return () => {
      this._subscribers = this._subscribers.filter((entry) => entry !== subscriber);
    };
  }
  setState(nextState, options) {
    const recordHistory = options?.recordHistory !== false;
    if (recordHistory && !this._history.grouping) {
      this._history.past.push(serializeState(this._state));
      this._history.future = [];
    }
    this._state = nextState;
    this._subscribers.forEach((subscriber) => subscriber(this._state));
  }
  update(updater, options) {
    const nextState = updater(this._state);
    this.setState(nextState, options);
  }
  select(selector) {
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
    this._subscribers.forEach((subscriber) => subscriber(this._state));
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
    this._subscribers.forEach((subscriber) => subscriber(this._state));
  }
  resetHistory() {
    this._history = {
      past: [],
      future: [],
      grouping: false,
      groupBase: null
    };
  }
  getHistorySnapshot() {
    return {
      past: [...this._history.past],
      future: [...this._history.future]
    };
  }
  restoreHistorySnapshot(snapshot) {
    this._history = {
      past: snapshot.past.map((entry) => ({ ...entry })),
      future: snapshot.future.map((entry) => ({ ...entry })),
      grouping: false,
      groupBase: null
    };
  }
}

// src/ts/editor/KeybindManager.ts
class KeybindManager {
  static instance;
  bindings;
  constructor() {
    this.bindings = new Map;
    this.setupListener();
  }
  static getInstance() {
    if (!KeybindManager.instance) {
      KeybindManager.instance = new KeybindManager;
    }
    return KeybindManager.instance;
  }
  setupListener() {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const key = this.getEventKey(event);
      if (this.bindings.has(key)) {
        event.preventDefault();
        this.bindings.get(key)(event);
      }
    });
  }
  getEventKey(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey)
      parts.push("Mod");
    if (event.shiftKey)
      parts.push("Shift");
    if (event.altKey)
      parts.push("Alt");
    parts.push(event.key.toLowerCase());
    return parts.join("+");
  }
  bind(keyStr, callback) {
    this.bindings.set(keyStr.toLowerCase(), callback);
  }
  unbind(keyStr) {
    this.bindings.delete(keyStr.toLowerCase());
  }
}

// src/ts/editor/DeltosPublisherApp.ts
init_Project();

// src/ts/editor/appGeometry.ts
var normalizeFieldRect = (field, stageRect, designSize) => {
  const scaleX = designSize ? stageRect.width / Math.max(1, designSize.width) : 1;
  const scaleY = designSize ? stageRect.height / Math.max(1, designSize.height) : 1;
  const x = field.location.unit === "percent" ? stageRect.width * (field.location.x / 100) : designSize ? field.location.x * scaleX : field.location.x;
  const y = field.location.unit === "percent" ? stageRect.height * (field.location.y / 100) : designSize ? field.location.y * scaleY : field.location.y;
  const width = field.size.unit === "percent" ? stageRect.width * (field.size.width / 100) : designSize ? field.size.width * scaleX : field.size.width;
  const height = field.size.unit === "percent" ? stageRect.height * (field.size.height / 100) : designSize ? field.size.height * scaleY : field.size.height;
  return { x, y, width, height, rotation: field.rotation };
};
var applyRectToField = (field, rect, stageRect, designSize) => {
  const nextLocationUnit = field.location.unit;
  const nextSizeUnit = field.size.unit;
  const invScaleX = designSize ? designSize.width / Math.max(1, stageRect.width) : 1;
  const invScaleY = designSize ? designSize.height / Math.max(1, stageRect.height) : 1;
  field.location.x = nextLocationUnit === "percent" ? rect.x / stageRect.width * 100 : designSize ? rect.x * invScaleX : rect.x;
  field.location.y = nextLocationUnit === "percent" ? rect.y / stageRect.height * 100 : designSize ? rect.y * invScaleY : rect.y;
  field.size.width = nextSizeUnit === "percent" ? rect.width / stageRect.width * 100 : designSize ? rect.width * invScaleX : rect.width;
  field.size.height = nextSizeUnit === "percent" ? rect.height / stageRect.height * 100 : designSize ? rect.height * invScaleY : rect.height;
  field.rotation = rect.rotation;
};
var anchorToTranslate = (anchor) => {
  switch (anchor) {
    case "center":
      return ["-50%", "-50%"];
    case "top-right":
      return ["-100%", "0%"];
    case "bottom-left":
      return ["0%", "-100%"];
    case "bottom-right":
      return ["-100%", "-100%"];
    default:
      return ["0%", "0%"];
  }
};
var snapRotation = (degrees, step) => {
  const normalized = (degrees % 360 + 360) % 360;
  return Math.round(normalized / step) * step;
};

// src/ts/editor/appPersistence.ts
init_browserStorage();
init_Project();
init_Template();

// src/ts/config/ContentFormat.ts
var ContentFormats = [
  { label: "Instagram Post", width: 1080, height: 1080 },
  { label: "Instagram Story", width: 1080, height: 1920 },
  { label: "Facebook Post", width: 1200, height: 630 },
  { label: "Twitter Post", width: 1024, height: 512 },
  { label: "LinkedIn Post", width: 1200, height: 627 }
];
var DEFAULT_CONTENT_FORMAT_LABEL = "Instagram Post";
var getDefaultContentFormat = () => {
  const format = ContentFormats.find((item) => item.label === DEFAULT_CONTENT_FORMAT_LABEL) || ContentFormats[0];
  return { ...format };
};
var findContentFormatByLabel = (label) => {
  const format = ContentFormats.find((item) => item.label === label);
  return format ? { ...format } : null;
};

// src/ts/editor/appPersistence.ts
var GLOBAL_KEYS = {
  projectsIndex: "publisher.projects_index",
  lastActiveId: "publisher.lastActiveProjectId",
  globalAssets: "publisher.global_assets"
};
var getProjectKeys = (projectId) => ({
  project: `publisher.projects.${projectId}.project`,
  templates: `publisher.projects.${projectId}.templates`,
  contents: `publisher.projects.${projectId}.contents`,
  assets: `publisher.projects.${projectId}.assets`
});
var listProjects = () => {
  return getJSON(GLOBAL_KEYS.projectsIndex) ?? [];
};
var saveProjectToIndex = (project) => {
  const list = listProjects();
  const existing = list.findIndex((p) => p.id === project.id);
  const record = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt.toISOString()
  };
  if (existing >= 0) {
    list[existing] = record;
  } else {
    list.push(record);
  }
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  setJSON(GLOBAL_KEYS.projectsIndex, list);
};
var migrateLegacyStorage = () => {
  const legacyProject = getJSON("publisher.project");
  if (!legacyProject)
    return null;
  const projectId = legacyProject.id || self.crypto.randomUUID();
  const keys = getProjectKeys(projectId);
  setJSON(keys.project, legacyProject);
  setJSON(keys.templates, getJSON("publisher.templates"));
  setJSON(keys.contents, getJSON("publisher.contents"));
  setJSON(GLOBAL_KEYS.globalAssets, getJSON("publisher.assets"));
  storage.removeItem("publisher.project");
  storage.removeItem("publisher.templates");
  storage.removeItem("publisher.contents");
  storage.removeItem("publisher.assets");
  const list = listProjects();
  list.push({
    id: projectId,
    name: legacyProject.name || "Migrated Project",
    updatedAt: new Date().toISOString()
  });
  setJSON(GLOBAL_KEYS.projectsIndex, list);
  return projectId;
};
var getActiveProjectId = () => {
  let activeId = getJSON(GLOBAL_KEYS.lastActiveId);
  if (!activeId) {
    activeId = migrateLegacyStorage();
  }
  if (!activeId) {
    const list = listProjects();
    if (list.length > 0) {
      activeId = list[0].id;
    } else {
      const newProject = new Project("Untitled Project");
      saveProjectToIndex(newProject);
      activeId = newProject.id;
    }
  }
  setJSON(GLOBAL_KEYS.lastActiveId, activeId);
  return activeId;
};
var setActiveProject = (projectId) => {
  setJSON(GLOBAL_KEYS.lastActiveId, projectId);
};
var createNewProject = (name) => {
  const project = new Project(name);
  saveProjectToIndex(project);
  return project.id;
};
var loadTemplates = (projectId) => {
  const keys = getProjectKeys(projectId);
  const payload = getJSON(keys.templates);
  if (!payload)
    return [];
  try {
    return payload.map((template) => Template.fromJSON(template));
  } catch {
    return [];
  }
};
var loadContents = (projectId) => {
  const keys = getProjectKeys(projectId);
  const payload = getJSON(keys.contents);
  if (!payload)
    return [];
  try {
    return payload.map((content) => Content.fromJSON(content));
  } catch {
    return [];
  }
};
var loadAssets = async (projectId) => {
  const keys = getProjectKeys(projectId);
  let projectPayload = await idbGet(keys.assets);
  if (!projectPayload) {
    projectPayload = getJSON(keys.assets) ?? [];
  }
  let globalPayload = await idbGet(GLOBAL_KEYS.globalAssets);
  if (!globalPayload) {
    globalPayload = getJSON(GLOBAL_KEYS.globalAssets) ?? [];
  }
  const result = [];
  try {
    for (const p of projectPayload) {
      result.push(Asset.fromJSON(p));
    }
  } catch {}
  try {
    for (const g of globalPayload) {
      if (!result.find((a) => a.id === g.id)) {
        result.push(Asset.fromJSON(g));
      }
    }
  } catch {}
  return result;
};
var loadProject = (projectId) => {
  const keys = getProjectKeys(projectId);
  const payload = getJSON(keys.project);
  if (!payload) {
    const proj = new Project("Untitled Project");
    return new Project("Untitled Project", { id: projectId });
  }
  try {
    return Project.fromJSON(payload);
  } catch {
    return new Project("Untitled Project", { id: projectId });
  }
};
var ensureSeedTemplate = (templates, contents, project) => {
  if (!project.contentFormat) {
    project.contentFormat = getDefaultContentFormat();
    project.touch();
  }
  if (templates.length > 0 && contents.length > 0) {
    return { templates, contents, project };
  }
  const seededTemplate = new Template(project.name + " Template");
  project.backgroundColor = "#fff";
  seededTemplate.description = "Default template for first-time editing.";
  seededTemplate.addField(createProjectField("text", "Headline", {
    location: { x: 200, y: 200, anchor: "top-left", unit: "px" },
    size: { width: 260, height: 150, unit: "px" },
    style: {
      padding: 10,
      color: "#000",
      backgroundColor: "transparent",
      fontFamily: "Arial, sans-serif",
      fontSize: 25,
      fontWeight: "bold",
      textAlign: "left"
    }
  }));
  const seededContent = new Content(project.name + " Content", seededTemplate.id);
  const nextTemplates = templates.length > 0 ? templates : [seededTemplate];
  const nextContents = contents.length > 0 ? contents : [seededContent];
  project.activeTemplateId = nextTemplates[0].id;
  project.activeContentId = nextContents[0].id;
  project.touch();
  return { templates: nextTemplates, contents: nextContents, project };
};
var listTemplates = (projectId) => {
  const keys = getProjectKeys(projectId);
  return getJSON(keys.templates) ?? [];
};
var saveTemplate = (projectId, template) => {
  const keys = getProjectKeys(projectId);
  const items = listTemplates(projectId);
  const next = items.filter((t) => t.id !== template.id);
  next.push(template.toJSON());
  setJSON(keys.templates, next);
};
var deleteTemplate = (projectId, id) => {
  const keys = getProjectKeys(projectId);
  const items = listTemplates(projectId);
  const next = items.filter((t) => t.id !== id);
  setJSON(keys.templates, next);
  return items.length !== next.length;
};
var persistState = async (state) => {
  const keys = getProjectKeys(state.project.id);
  setJSON(keys.project, state.project.toJSON());
  setJSON(keys.templates, state.templates.map((template) => template.toJSON()));
  setJSON(keys.contents, state.contents.map((content) => content.toJSON()));
  const projectAssets = state.assets.filter((a) => a.scope === "project").map((a) => a.toJSON());
  const globalAssets = state.assets.filter((a) => a.scope === "global").map((a) => a.toJSON());
  await idbSet(keys.assets, projectAssets);
  await idbSet(GLOBAL_KEYS.globalAssets, globalAssets);
  storage.removeItem(keys.assets);
  storage.removeItem(GLOBAL_KEYS.globalAssets);
  saveProjectToIndex(state.project);
};

// src/ts/editor/appHelpers.ts
var getActiveTemplate = (state) => {
  return state.templates.find((template) => template.id === state.project.activeTemplateId) || null;
};
var getActiveContent = (state) => {
  return state.contents.find((content) => content.id === state.project.activeContentId) || null;
};
var getFieldValue = (state, fieldId) => {
  const content = getActiveContent(state);
  return content?.getValue(fieldId) || "";
};
var getActiveAsset = (state, assetId) => {
  return state.assets.find((asset) => asset.id === assetId) || null;
};
var updateTemplateField = (state, fieldId, updater) => {
  const template = getActiveTemplate(state);
  if (!template) {
    return state;
  }
  const nextFields = template.getFields().map((field) => {
    if (field.id !== fieldId) {
      return field;
    }
    const nextField = structuredClone(field);
    updater(nextField);
    return nextField;
  });
  template.setFields(nextFields);
  return {
    ...state,
    templates: state.templates.map((item) => item.id === template.id ? template : item)
  };
};
var moveTemplateField = (state, fieldId, direction) => {
  const template = getActiveTemplate(state);
  if (!template) {
    return state;
  }
  const fields = template.getFields();
  const index = fields.findIndex((field2) => field2.id === fieldId);
  if (index < 0) {
    return state;
  }
  const [field] = fields.splice(index, 1);
  if (!field) {
    return state;
  }
  if (direction === "front") {
    fields.push(field);
  } else {
    fields.unshift(field);
  }
  template.setFields(fields);
  return {
    ...state,
    templates: state.templates.map((item) => item.id === template.id ? template : item)
  };
};
var updateContentValue = (state, fieldId, value) => {
  const content = getActiveContent(state);
  if (!content) {
    return state;
  }
  content.setValue(fieldId, value);
  return {
    ...state,
    contents: state.contents.map((item) => item.id === content.id ? content : item)
  };
};
var updateAsset = (state, assetId, updater) => {
  const nextAssets = state.assets.map((asset) => {
    if (asset.id !== assetId) {
      return asset;
    }
    const nextAsset = new Asset(asset.name, asset.mimeType, asset.dataUrl, {
      id: asset.id,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      scope: asset.scope,
      crop: asset.crop
    });
    updater(nextAsset);
    return nextAsset;
  });
  return {
    ...state,
    assets: nextAssets
  };
};
var escapeAttribute = (value) => {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};
var addTemplateToState = (state, template) => {
  return {
    ...state,
    templates: [...state.templates, template]
  };
};

// src/ts/editor/ModalManager.ts
function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
function syncColorInput(input, cssValue, fallback) {
  if (!input) {
    return;
  }
  const value = cssValue.trim();
  if (/^#[0-9a-f]{6}$/i.test(value) || /^#[0-9a-f]{3}$/i.test(value)) {
    input.value = normalizeHexColor(value);
    return;
  }
  const rgbMatch = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    const r = clampNumber(Number(rgbMatch[1] || 0), 0, 255);
    const g = clampNumber(Number(rgbMatch[2] || 0), 0, 255);
    const b = clampNumber(Number(rgbMatch[3] || 0), 0, 255);
    input.value = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return;
  }
  input.value = normalizeHexColor(fallback);
}
function normalizeHexColor(value) {
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return "#000000";
}
function toHex(value) {
  return Math.round(value).toString(16).padStart(2, "0");
}

class Modal {
  fields;
  title;
  description;
  modalElement;
  constructor(title, description, buttonText = "Apply") {
    this.title = title;
    this.description = description;
    this.fields = [];
    this.modalElement = document.createElement("dialog");
    this.modalElement.classList.add("modal");
    this.modalElement.innerHTML = `
            <div class="modal-header">
            <h2 class="modal-title"></h2>
            <p class="modal-description"></p>
            </div>
            <div class="modal-body"></div>
            <button class="modal-submit btn btn-xl primary">${buttonText}</button>
        `;
    document.body.appendChild(this.modalElement);
  }
  addTextField(label, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "text", required, defaultValue });
    return this;
  }
  addNumberField(label, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "number", required, defaultValue });
    return this;
  }
  addColorField(label, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "color", required, defaultValue });
    return this;
  }
  addBooleanField(label, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "boolean", required, defaultValue });
    return this;
  }
  addMillimeterField(label, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "mm", required, defaultValue });
    return this;
  }
  addSelectField(label, options, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "select", required, defaultValue, options });
    return this;
  }
  addChipField(label, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "chip", required, defaultValue });
    return this;
  }
  addImageSelectField(label, options, defaultValue, required = false) {
    this.fields.push({ label, key: label.toLowerCase().replace(" ", "_"), type: "imageselect", required, defaultValue, imageOptions: options });
    return this;
  }
  setConditionalField(label, conditionLabel, conditionValue, operator = "equals") {
    const field = this.fields.find((f) => f.label === label);
    if (field) {
      if (!field.condition) {
        field.condition = [];
      }
      field.condition.push({ conditionLabel, conditionValue, operator });
    }
    return this;
  }
  getFields() {
    return this.fields;
  }
  constructModalFromFields(fields, modalBody) {
    modalBody.innerHTML = "";
    fields.forEach((field) => {
      const label = document.createElement("label");
      label.classList.add("field");
      if (field.type === "chip") {
        label.classList.add("has-chips");
      }
      if (field.type === "imageselect") {
        label.classList.add("has-image-select");
      }
      const spanElement = document.createElement("span");
      spanElement.textContent = field.label + (field.required ? " *" : "") + (field.type === "chip" ? " (comma-separated)" : "") + (field.type === "imageselect" ? " (choose an asset)" : "");
      label.appendChild(spanElement);
      let input;
      switch (field.type) {
        case "text":
          input = document.createElement("input");
          input.type = "text";
          break;
        case "number":
          input = document.createElement("input");
          input.type = "number";
          break;
        case "color":
          input = document.createElement("input");
          input.type = "color";
          break;
        case "boolean":
          input = document.createElement("input");
          input.type = "checkbox";
          break;
        case "mm":
          input = document.createElement("input");
          input.type = "number";
          input.step = "0.01";
          input.min = "0";
          input.placeholder = "0mm";
          break;
        case "select":
          input = document.createElement("select");
          field.options?.forEach((option) => {
            const optionElement = document.createElement("option");
            optionElement.value = option;
            optionElement.textContent = option;
            input.appendChild(optionElement);
          });
          break;
        case "chip":
          input = document.createElement("input");
          input.type = "text";
          input.placeholder = "Enter values separated by commas";
          if (Array.isArray(field.defaultValue)) {
            input.value = field.defaultValue.join(", ");
          }
          const chipsContainerInit = document.createElement("div");
          chipsContainerInit.className = "chip-container";
          if (Array.isArray(field.defaultValue)) {
            field.defaultValue.forEach((val) => {
              const chip = document.createElement("span");
              chip.className = "chip";
              chip.textContent = val;
              chipsContainerInit.appendChild(chip);
            });
          }
          input.addEventListener("input", () => {
            const chips = input.value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
            chipsContainerInit.replaceChildren();
            chips.forEach((val) => {
              const chip = document.createElement("span");
              chip.className = "chip";
              chip.textContent = val;
              chipsContainerInit.appendChild(chip);
            });
          });
          label.appendChild(chipsContainerInit);
          break;
        case "imageselect":
          input = document.createElement("input");
          input.type = "hidden";
          break;
        default:
          throw new Error(`Unsupported field type: ${field.type}`);
      }
      if (field.type === "boolean") {
        input.checked = Boolean(field.defaultValue);
      } else if (field.defaultValue !== undefined) {
        input.value = String(field.defaultValue);
      } else {
        input.value = "";
      }
      label.appendChild(input);
      if (field.type === "color") {
        let colorTextInput = document.createElement("input");
        colorTextInput.type = "text";
        colorTextInput.placeholder = "#RRGGBB";
        colorTextInput.value = field.defaultValue || "";
        label.appendChild(colorTextInput);
        syncColorInput(colorTextInput, field.defaultValue || "#000000", "#000000");
        input.addEventListener("input", () => {
          syncColorInput(colorTextInput, input.value, "#000000");
        });
        colorTextInput.addEventListener("input", () => {
          syncColorInput(input, colorTextInput.value, "#000000");
        });
      } else if (field.type === "imageselect") {
        const preview = document.createElement("div");
        preview.className = "image-select-grid";
        const options = field.imageOptions || [];
        options.forEach((option) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "image-select-card";
          if (field.defaultValue && field.defaultValue === option.id || option.selected) {
            button.classList.add("is-selected");
            input.value = option.id;
          }
          button.innerHTML = `
                        <img src="${option.src}" alt="${option.name}" />
                        <span class="name">${this.shortenLabel(option.name)}</span>
                        <span class="meta">${option.mimeType}</span>
                    `;
          button.addEventListener("click", () => {
            input.value = option.id;
            preview.querySelectorAll(".image-select-card").forEach((card) => card.classList.remove("is-selected"));
            button.classList.add("is-selected");
          });
          preview.appendChild(button);
        });
        if (options.length === 0) {
          const empty = document.createElement("div");
          empty.className = "image-select-empty";
          empty.textContent = "No assets available yet.";
          preview.appendChild(empty);
        }
        label.appendChild(preview);
      }
      if (field.condition) {
        label.setAttribute("data-conditional", "true");
      }
      label.setAttribute("data-field-label", field.label);
      label.setAttribute("data-field-type", field.type);
      if (field.condition) {
        const updateVisibility = () => {
          let shouldShow = true;
          for (const condition of field.condition) {
            const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
            const relatedField = modalBody.querySelector(selector);
            if (relatedField) {
              let relatedValue;
              if (relatedField.type === "checkbox") {
                relatedValue = relatedField.checked;
              } else {
                relatedValue = relatedField.value;
              }
              const operator = condition.operator ?? "equals";
              const matches = operator === "not-equals" ? relatedValue != condition.conditionValue : relatedValue == condition.conditionValue;
              if (!matches) {
                shouldShow = false;
                break;
              }
            }
          }
          label.style.display = shouldShow ? "" : "none";
        };
        field.condition.forEach((condition) => {
          const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
          const relatedField = modalBody.querySelector(selector);
          if (relatedField) {
            relatedField.addEventListener("input", updateVisibility);
            if (relatedField.type === "checkbox") {
              relatedField.addEventListener("change", updateVisibility);
            }
          }
        });
        updateVisibility();
      }
      modalBody.appendChild(label);
      if (field.type === "chip") {
        const existingInput = label.querySelector("input");
        if (existingInput) {
          let existing = label.querySelector(".chip-container");
          if (!existing) {
            const fallback = document.createElement("div");
            fallback.className = "chip-container";
            label.appendChild(fallback);
          }
        }
      }
    });
    fields.forEach((field) => {
      if (!field.condition || field.condition.length === 0) {
        return;
      }
      const currentLabel = modalBody.querySelector(`label[data-field-label="${field.label}"]`);
      if (!currentLabel) {
        return;
      }
      const updateVisibility = () => {
        let shouldShow = true;
        for (const condition of field.condition) {
          const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
          const relatedField = modalBody.querySelector(selector);
          if (!relatedField) {
            continue;
          }
          const relatedValue = relatedField.type === "checkbox" ? relatedField.checked : relatedField.value;
          const operator = condition.operator ?? "equals";
          const matches = operator === "not-equals" ? relatedValue != condition.conditionValue : relatedValue == condition.conditionValue;
          if (!matches) {
            shouldShow = false;
            break;
          }
        }
        currentLabel.style.display = shouldShow ? "" : "none";
      };
      field.condition.forEach((condition) => {
        const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
        const relatedField = modalBody.querySelector(selector);
        if (!relatedField) {
          return;
        }
        relatedField.addEventListener("input", updateVisibility);
        relatedField.addEventListener("change", updateVisibility);
      });
      updateVisibility();
    });
    return modalBody;
  }
  shortenLabel(label) {
    const maxLength = 20;
    if (label.length <= maxLength) {
      return label;
    }
    return label.slice(0, maxLength - 3) + "...";
  }
  async show() {
    const modalContent = this.constructModalFromFields(this.fields, this.modalElement.querySelector(".modal-body"));
    this.modalElement.querySelector(".modal-title").textContent = this.title;
    this.modalElement.querySelector(".modal-description").textContent = this.description || "";
    this.modalElement.querySelector(".modal-body").replaceWith(modalContent);
    this.modalElement.showModal();
    return new Promise((resolve) => {
      const submitButton = this.modalElement.querySelector(".modal-submit");
      submitButton.onclick = () => {
        const formData = {};
        this.fields.forEach((field) => {
          const label = this.modalElement.querySelector(`label[data-field-label="${field.label}"]`);
          if (!label) {
            formData[field.label] = null;
            return;
          }
          const inputEl = label.querySelector("input, select");
          if (!inputEl) {
            formData[field.label] = null;
            return;
          }
          if (field.type === "boolean") {
            formData[field.label] = inputEl.checked;
          } else if (field.type === "mm" || field.type === "number") {
            formData[field.label] = parseFloat(inputEl.value);
          } else if (field.type === "chip") {
            const raw = inputEl.value;
            formData[field.label] = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
          } else if (field.type === "imageselect") {
            const hiddenInput = inputEl;
            formData[field.label] = hiddenInput.value || null;
          } else {
            formData[field.label] = inputEl.value;
          }
        });
        submitButton.onclick = null;
        this.modalElement.onclose = null;
        resolve(formData);
        this.modalElement.close();
      };
      this.modalElement.onclose = () => {
        submitButton.onclick = null;
        this.modalElement.onclose = null;
        resolve(null);
      };
    });
  }
}
var ModalManager_default = Modal;

// src/ts/editor/DeltosPublisherApp.ts
init_Project();
init_Template();

// src/ts/export/CanvasRenderer.ts
class CanvasRenderer {
  width;
  height;
  scale;
  constructor(width, height, scale = 1) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.scale = Math.max(1, scale);
  }
  async loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image;
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.crossOrigin = "anonymous";
      img.src = src;
    });
  }
  normalizeSvgDataUrl(dataUrl, targetWidth, targetHeight) {
    try {
      const comma = dataUrl.indexOf(",");
      const header = dataUrl.substring(0, comma);
      const data = dataUrl.substring(comma + 1);
      let svgText = "";
      if (/;base64/.test(header)) {
        try {
          svgText = decodeURIComponent(escape(atob(data)));
        } catch {
          svgText = atob(data);
        }
      } else {
        svgText = decodeURIComponent(data);
      }
      if (!svgText.includes("xmlns=")) {
        svgText = svgText.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      svgText = svgText.replace(/<svg([^>]*)>/i, (match, attrs) => {
        let cleaned = attrs;
        const widthMatch = attrs.match(/\swidth\s*=\s*"([^"]*)"/i);
        const heightMatch = attrs.match(/\sheight\s*=\s*"([^"]*)"/i);
        const viewBoxMatch = attrs.match(/\sviewBox\s*=\s*"[^"]*"/i);
        let w = widthMatch ? parseFloat(widthMatch[1]) : NaN;
        let h = heightMatch ? parseFloat(heightMatch[1]) : NaN;
        cleaned = cleaned.replace(/\s(width|height)\s*=\s*"[^"]*"/ig, "");
        if (!viewBoxMatch && !isNaN(w) && !isNaN(h)) {
          cleaned += ` viewBox="0 0 ${w} ${h}"`;
        }
        return `<svg ${cleaned} width="${Math.round(targetWidth)}" height="${Math.round(targetHeight)}">`;
      });
      const encoded = btoa(unescape(encodeURIComponent(svgText)));
      return `data:image/svg+xml;base64,${encoded}`;
    } catch (e) {
      console.warn("Failed to normalize SVG data URL", e);
      return dataUrl;
    }
  }
  drawImageCover(ctx, img, dx, dy, dw, dh) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw === 0 || ih === 0) {
      ctx.drawImage(img, dx, dy, dw, dh);
      return;
    }
    const scale = Math.max(dw / iw, dh / ih);
    const sw = dw / scale;
    const sh = dh / scale;
    const sx = Math.max(0, (iw - sw) / 2);
    const sy = Math.max(0, (ih - sh) / 2);
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  drawImageContain(ctx, img, dx, dy, dw, dh) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw === 0 || ih === 0) {
      ctx.drawImage(img, dx, dy, dw, dh);
      return;
    }
    const scale = Math.min(dw / iw, dh / ih);
    const destW = iw * scale;
    const destH = ih * scale;
    const destX = dx + Math.round((dw - destW) / 2);
    const destY = dy + Math.round((dh - destH) / 2);
    ctx.drawImage(img, 0, 0, iw, ih, destX, destY, destW, destH);
  }
  anchorOffset(anchor, rect) {
    switch (anchor) {
      case "center":
        return { ox: rect.width / 2, oy: rect.height / 2 };
      case "top-right":
        return { ox: rect.width, oy: 0 };
      case "bottom-left":
        return { ox: 0, oy: rect.height };
      case "bottom-right":
        return { ox: rect.width, oy: rect.height };
      default:
        return { ox: 0, oy: 0 };
    }
  }
  async render(state) {
    const project = state.project;
    const template = state.templates.find((t) => t.id === project.activeTemplateId) || state.templates[0];
    const content = state.contents.find((c) => c.id === project.activeContentId) || state.contents[0];
    const canvas = document.createElement("canvas");
    canvas.width = this.width * this.scale;
    canvas.height = this.height * this.scale;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Canvas context not available");
    ctx.scale(this.scale, this.scale);
    if (project.backgroundColor) {
      ctx.fillStyle = project.backgroundColor;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      ctx.clearRect(0, 0, this.width, this.height);
    }
    if (!template)
      return canvas;
    const stageRect = new DOMRect(0, 0, this.width, this.height);
    for (const field of template.getFields()) {
      const rect = normalizeFieldRect(field, stageRect, { width: this.width, height: this.height });
      const { ox, oy } = this.anchorOffset(field.location.anchor, rect);
      ctx.save();
      const cx = rect.x + ox;
      const cy = rect.y + oy;
      ctx.translate(cx, cy);
      ctx.rotate(field.rotation * Math.PI / 180);
      const drawX = -ox;
      const drawY = -oy;
      const style = field.style || {};
      if (style.backgroundColor && style.backgroundColor !== "transparent") {
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(drawX, drawY, rect.width, rect.height);
      }
      const padding = Math.max(0, Number(style.padding) || 0);
      const innerX = drawX + padding;
      const innerY = drawY + padding;
      const innerW = Math.max(1, rect.width - padding * 2);
      const innerH = Math.max(1, rect.height - padding * 2);
      if (field.type === "image") {
        const value = content ? content.getValue(field.id) : "";
        const asset = state.assets.find((a) => a.id === value);
        if (asset) {
          try {
            let srcUrl = asset.dataUrl;
            if (asset.mimeType === "image/svg+xml") {
              srcUrl = this.normalizeSvgDataUrl(srcUrl, innerW, innerH);
            }
            const img = await this.loadImage(srcUrl);
            if (asset.crop) {
              const sx = Math.max(0, asset.crop.x);
              const sy = Math.max(0, asset.crop.y);
              const sw = Math.max(1, asset.crop.width);
              const sh = Math.max(1, asset.crop.height);
              ctx.drawImage(img, sx, sy, sw, sh, innerX, innerY, innerW, innerH);
            } else if (asset.mimeType === "image/svg+xml") {
              this.drawImageContain(ctx, img, innerX, innerY, innerW, innerH);
            } else {
              this.drawImageCover(ctx, img, innerX, innerY, innerW, innerH);
            }
          } catch (e) {
            console.warn("Failed to load asset image for render", e);
            ctx.fillStyle = "#eee";
            ctx.fillRect(innerX, innerY, innerW, innerH);
          }
        } else {
          ctx.fillStyle = "#f3f3f3";
          ctx.fillRect(innerX, innerY, innerW, innerH);
        }
      } else if (field.type === "decoration") {
        const assetId = field.imageAssetId;
        if (assetId) {
          const asset = state.assets.find((a) => a.id === assetId);
          if (asset) {
            try {
              let srcUrl = asset.dataUrl;
              if (asset.mimeType === "image/svg+xml") {
                srcUrl = this.normalizeSvgDataUrl(srcUrl, innerW, innerH);
              }
              const img = await this.loadImage(srcUrl);
              if (asset.crop) {
                ctx.drawImage(img, asset.crop.x, asset.crop.y, asset.crop.width, asset.crop.height, innerX, innerY, innerW, innerH);
              } else if (asset.mimeType === "image/svg+xml") {
                this.drawImageContain(ctx, img, innerX, innerY, innerW, innerH);
              } else {
                this.drawImageCover(ctx, img, innerX, innerY, innerW, innerH);
              }
            } catch (e) {
              console.warn("Failed to load decoration asset", e);
            }
          }
        } else {
          ctx.fillStyle = "#ddd";
          ctx.fillRect(innerX, innerY, innerW, innerH);
        }
      } else {
        const contentValue = String(content ? content.getValue(field.id) : field.value || "");
        const fontSize = Math.max(1, Number(style.fontSize) || 16);
        const fontWeight = style.fontWeight || "400";
        const fontFamily = style.fontFamily || "sans-serif";
        ctx.fillStyle = style.color || "#000";
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const textAlign = style.textAlign === "left" ? "left" : style.textAlign === "right" ? "right" : "center";
        ctx.textAlign = textAlign;
        ctx.textBaseline = "middle";
        const paragraphs = contentValue.split(`
`);
        const lines = [];
        for (const para of paragraphs) {
          const words = para.split(/\s+/).filter(Boolean);
          if (words.length === 0) {
            lines.push("");
            continue;
          }
          let line = words[0];
          for (let i = 1;i < words.length; i++) {
            const test = line + " " + words[i];
            const w = ctx.measureText(test).width;
            if (w <= innerW) {
              line = test;
            } else {
              lines.push(line);
              line = words[i];
            }
          }
          lines.push(line);
        }
        const lineHeight = Math.max(1, fontSize * 1.2);
        const totalHeight = lines.length * lineHeight;
        const vAlign = style.verticalAlign || "middle";
        let startY = innerY + innerH / 2 - totalHeight / 2 + lineHeight / 2;
        if (vAlign === "top")
          startY = innerY + lineHeight / 2;
        if (vAlign === "bottom")
          startY = innerY + innerH - totalHeight + lineHeight / 2;
        let xPos = innerX + innerW / 2;
        if (textAlign === "left")
          xPos = innerX;
        if (textAlign === "right")
          xPos = innerX + innerW;
        let y = startY;
        for (const line of lines) {
          ctx.fillText(line, xPos, y, innerW);
          y += lineHeight;
        }
      }
      ctx.restore();
    }
    return canvas;
  }
}
var CanvasRenderer_default = CanvasRenderer;

// src/ts/editor/DeltosPublisherApp.ts
var MOVE_SNAP_GRID_SIZE = 10;
var RESIZE_SNAP_GRID_SIZE = 10;

class DeltosPublisherApp {
  static instance = null;
  static HISTORY_STORAGE_PREFIX = "publisher.history.snapshot";
  store = null;
  stage = null;
  selectionPanel = null;
  selectionDetails = null;
  asideDesign = null;
  asideContent = null;
  asideHead = null;
  asideElement = null;
  isAsideOpen = true;
  contentFieldsList = null;
  addTextFieldButton = null;
  addDecorationFieldButton = null;
  addImageFieldButton = null;
  templatePanel = null;
  appWrapper = null;
  additionalPanel = null;
  additionalPanelMode = null;
  activeInteraction = null;
  stageResizeFrame = null;
  constructor() {}
  static getInstance() {
    if (!DeltosPublisherApp.instance) {
      DeltosPublisherApp.instance = new DeltosPublisherApp;
    }
    return DeltosPublisherApp.instance;
  }
  async start() {
    if (this.store) {
      return this.store;
    }
    this.resolveDom();
    const store = await this.bootstrap();
    this.store = store;
    this.restoreHistorySnapshot(store);
    window.addEventListener("beforeunload", () => {
      if (this.store) {
        this.persistHistorySnapshot(this.store);
      }
    });
    this.wireNavigation(store);
    this.wireFieldActions(store);
    this.wireContentInputs(store);
    this.wireSelectionInputs(store);
    this.wireAssetSelection(store);
    this.setupPointerHandlers(store);
    this.setupKeybinds(store);
    this.setupWindowResizeHandling();
    return store;
  }
  resolveDom() {
    this.stage = document.querySelector("#editor-stage");
    this.selectionPanel = document.querySelector("#selection-panel");
    this.selectionDetails = document.querySelector(".selection-details");
    this.asideDesign = document.querySelector("#aside-design");
    this.asideContent = document.querySelector("#aside-content");
    this.asideHead = document.querySelector(".aside-head");
    this.asideElement = document.querySelector("aside");
    this.contentFieldsList = document.querySelector("#content-fields-list");
    this.addTextFieldButton = document.querySelector("[data-field-action=add-text]");
    this.addDecorationFieldButton = document.querySelector("[data-field-action=add-decoration]");
    this.addImageFieldButton = document.querySelector("[data-field-action=add-image]");
    this.templatePanel = document.querySelector("#additional-wrapper");
    this.appWrapper = document.querySelector("#app-wrapper");
    this.additionalPanel = document.querySelector("#additional-panel");
    if (!this.stage) {
      throw new Error("Editor stage not found");
    }
  }
  async bootstrap() {
    const projectId = getActiveProjectId();
    const templates = loadTemplates(projectId);
    const contents = loadContents(projectId);
    const project = loadProject(projectId);
    const seeded = ensureSeedTemplate(templates, contents, project);
    const initialState = {
      project: seeded.project,
      templates: seeded.templates,
      contents: seeded.contents,
      assets: await loadAssets(projectId),
      selection: { fieldId: null },
      mode: "design"
    };
    const store = new GlobalState(initialState);
    store.subscribe((state) => {
      this.applyStageFormat(state.project.contentFormat || getDefaultContentFormat());
      this.applyProjectBackground(state.project);
      persistState(state);
      this.render(state);
      this.updateSelectionPanel(state);
      this.updateAsidePanels(state);
      this.renderAdditionalPanel(state);
      this.updateNavState(state);
    });
    return store;
  }
  async loadProjectIntoState(projectId) {
    if (!this.store)
      return;
    setActiveProject(projectId);
    const templates = loadTemplates(projectId);
    const contents = loadContents(projectId);
    const project = loadProject(projectId);
    const seeded = ensureSeedTemplate(templates, contents, project);
    this.store.setState({
      project: seeded.project,
      templates: seeded.templates,
      contents: seeded.contents,
      assets: await loadAssets(projectId),
      selection: { fieldId: null },
      mode: "design"
    });
  }
  getProjectSelectionOptions() {
    const projects = listProjects();
    const optionMap = new Map;
    const options = projects.map((project) => {
      const optionLabel = `${project.name || "Untitled Project"} (${project.id.slice(0, 8)})`;
      optionMap.set(optionLabel, project.id);
      return optionLabel;
    });
    return { options, optionMap };
  }
  promptProjectManager() {
    const { options, optionMap } = this.getProjectSelectionOptions();
    const createOption = "Create new project...";
    const loadOption = "Load project...";
    const currentProject = this.store?.getState().project;
    const currentLabel = currentProject ? `${currentProject.name || "Untitled Project"} (${currentProject.id.slice(0, 8)})` : undefined;
    const modal = new ModalManager_default("Project Manager", "Pick a project to open or create a new one.", "Open");
    modal.addSelectField("Project", [...options, createOption, loadOption], currentLabel ?? createOption, true);
    modal.show().then((result) => {
      if (!result) {
        return;
      }
      const selectedLabel = String(result["Project"] || "").trim();
      if (!selectedLabel) {
        return;
      }
      if (selectedLabel === createOption) {
        this.promptCreateProject();
        return;
      }
      if (selectedLabel === loadOption) {
        this.promptLoadProject();
        return;
      }
      const projectId = optionMap.get(selectedLabel);
      if (projectId) {
        this.loadProjectIntoState(projectId);
      }
    });
  }
  promptLoadProject() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        return;
      }
      try {
        const bundle = JSON.parse(await file.text());
        this.importProjectBundleWithConflict(bundle);
      } catch (err) {
        console.error("Failed to import project", err);
      }
    });
    input.click();
  }
  promptCreateProject() {
    const modal = new ModalManager_default("New Project", "Choose a name for the new project.", "Create");
    modal.addTextField("Project Name", "Untitled Project", true);
    modal.show().then((result) => {
      const projectName = String(result?.["Project Name"] || "").trim();
      if (!projectName) {
        return;
      }
      const newId = createNewProject(projectName);
      this.loadProjectIntoState(newId);
    });
  }
  get stageElement() {
    if (!this.stage) {
      throw new Error("Editor stage not initialized");
    }
    return this.stage;
  }
  getActiveTemplate(state) {
    return getActiveTemplate(state);
  }
  getActiveContent(state) {
    return getActiveContent(state);
  }
  getFieldValue(state, fieldId) {
    return getFieldValue(state, fieldId);
  }
  getAssetById(state, assetId) {
    return getActiveAsset(state, assetId);
  }
  updateAsset(state, assetId, updater) {
    return updateAsset(state, assetId, updater);
  }
  renderFieldInput(label, inputMarkup) {
    return `
            <label class="field">
                <span>${label}</span>
                ${inputMarkup}
            </label>
        `;
  }
  renderFieldSelect(label, selectMarkup) {
    return `
            <label class="field">
                <span>${label}</span>
                ${selectMarkup}
            </label>
        `;
  }
  renderAssetPreview(asset) {
    const crop = asset.crop;
    if (!crop) {
      return `<img src="${escapeAttribute(asset.dataUrl)}" alt="${escapeAttribute(asset.name)}" />`;
    }
    return `
            <div class="asset-crop-frame" style="width:${Math.max(1, Math.round(crop.width))}px;height:${Math.max(1, Math.round(crop.height))}px;overflow:hidden;position:relative;">
                <img src="${escapeAttribute(asset.dataUrl)}" alt="${escapeAttribute(asset.name)}" style="position:absolute;left:-${Math.max(0, Math.round(crop.x))}px;top:-${Math.max(0, Math.round(crop.y))}px;max-width:none;max-height:none;" />
            </div>
        `;
  }
  renderDecorationAssetPreview(asset) {
    if (!asset) {
      return '<span class="field-image-placeholder">No image selected</span>';
    }
    return `<div class="decoration-asset-preview">${this.renderAssetPreview(asset)}</div>`;
  }
  renderColorField(label, fieldProp, value, fallback) {
    const pickerValue = this.resolveColorPickerValue(value, fallback);
    return `
            <label class="field color-field">
                <span>${label}</span>
                <input type="color" data-field-prop="${fieldProp}" data-color-role="picker" value="${escapeAttribute(pickerValue)}" />
                <input type="text" data-field-prop="${fieldProp}" data-color-role="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(fallback)}" />
            </label>
        `;
  }
  resolveColorPickerValue(value, fallback) {
    const trimmed = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed) || /^#[0-9a-f]{3}$/i.test(trimmed)) {
      return trimmed;
    }
    const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgbMatch) {
      const toHex2 = (component) => Number(component || 0).toString(16).padStart(2, "0");
      return `#${toHex2(rgbMatch[1] || "0")}${toHex2(rgbMatch[2] || "0")}${toHex2(rgbMatch[3] || "0")}`;
    }
    if (/^#[0-9a-f]{6}$/i.test(fallback) || /^#[0-9a-f]{3}$/i.test(fallback)) {
      return fallback;
    }
    return "#111111";
  }
  render(state) {
    const root = this.stageElement;
    root.innerHTML = "";
    const template = this.getActiveTemplate(state);
    const content = this.getActiveContent(state);
    if (!template) {
      return;
    }
    const stageRect = root.getBoundingClientRect();
    const format = state.project.contentFormat || getDefaultContentFormat();
    const fields = template.getFields();
    fields.forEach((field) => {
      const rect = normalizeFieldRect(field, stageRect, { width: format.width, height: format.height });
      const fieldElement = document.createElement("div");
      fieldElement.className = "editor-field";
      fieldElement.dataset.fieldId = field.id;
      fieldElement.style.left = `${rect.x}px`;
      fieldElement.style.top = `${rect.y}px`;
      fieldElement.style.width = `${rect.width}px`;
      fieldElement.style.height = `${rect.height}px`;
      const visualStyle = normalizeFieldStyle(field.style);
      fieldElement.style.padding = `${Math.max(0, visualStyle.padding)}px`;
      fieldElement.style.backgroundColor = visualStyle.backgroundColor;
      const [translateX, translateY] = anchorToTranslate(field.location.anchor);
      fieldElement.style.transform = `translate(${translateX}, ${translateY}) rotate(${rect.rotation}deg)`;
      if (state.mode === "content") {
        fieldElement.style.pointerEvents = "none";
      } else if (state.selection.fieldId === field.id) {
        fieldElement.classList.add("is-selected");
        this.appendHandles(fieldElement);
      }
      const fieldContent = document.createElement("div");
      fieldContent.className = "field-content";
      fieldContent.style.color = visualStyle.color;
      fieldContent.style.fontFamily = visualStyle.fontFamily;
      const stageRectForScale = root.getBoundingClientRect();
      const scaleForFont = Math.max(0.0001, stageRectForScale.width / Math.max(1, format.width));
      fieldContent.style.fontSize = `${Math.max(1, Math.round(visualStyle.fontSize * scaleForFont))}px`;
      fieldContent.style.fontWeight = visualStyle.fontWeight;
      fieldContent.style.textAlign = visualStyle.textAlign;
      const contentValue = content?.getValue(field.id) || "";
      if (field.type === "image") {
        const asset = contentValue ? this.getAssetById(state, contentValue) : null;
        if (!asset) {
          fieldContent.innerHTML = '<span class="field-image-placeholder">Choose image content</span>';
        } else {
          const image = document.createElement("img");
          image.alt = asset.name;
          image.src = asset.dataUrl;
          image.className = "field-image";
          if (asset.crop) {
            const crop = asset.crop;
            const frame = document.createElement("div");
            frame.className = "asset-crop-frame";
            frame.style.width = `${Math.max(1, Math.round(crop.width))}px`;
            frame.style.height = `${Math.max(1, Math.round(crop.height))}px`;
            frame.style.overflow = "hidden";
            frame.style.position = "relative";
            image.style.position = "absolute";
            image.style.left = `-${Math.max(0, Math.round(crop.x))}px`;
            image.style.top = `-${Math.max(0, Math.round(crop.y))}px`;
            image.style.maxWidth = "none";
            image.style.maxHeight = "none";
            frame.append(image);
            fieldContent.append(frame);
          } else {
            fieldContent.append(image);
          }
        }
      } else if (field.type === "decoration") {
        const asset = field.imageAssetId ? this.getAssetById(state, field.imageAssetId) : null;
        if (asset) {
          fieldContent.innerHTML = this.renderDecorationAssetPreview(asset);
        } else {
          fieldContent.textContent = contentValue || "Decoration";
        }
      } else {
        fieldContent.textContent = contentValue || "Text";
      }
      fieldElement.append(fieldContent);
      root.append(fieldElement);
    });
  }
  appendHandles(fieldElement) {
    ["nw", "ne", "sw", "se"].forEach((handle) => {
      const node = document.createElement("span");
      node.className = "editor-handle";
      node.dataset.handle = handle;
      fieldElement.append(node);
    });
    const rotateHandle = document.createElement("span");
    rotateHandle.className = "editor-handle rotate";
    rotateHandle.dataset.handle = "rotate";
    fieldElement.append(rotateHandle);
  }
  updateSelectionPanel(state) {
    if (!this.selectionPanel || !this.selectionDetails) {
      return;
    }
    const template = this.getActiveTemplate(state);
    const selected = template?.getFields().find((field) => field.id === state.selection.fieldId) || null;
    if (!selected) {
      this.selectionPanel.hidden = true;
      this.selectionDetails.textContent = "";
      delete this.selectionDetails.dataset.renderedId;
      return;
    }
    this.selectionPanel.hidden = false;
    const value = selected.value;
    const visualStyle = normalizeFieldStyle(selected.style);
    if (this.selectionDetails.dataset.renderedId === selected.id) {
      const inputs = this.selectionDetails.querySelectorAll("input, select");
      inputs.forEach((input) => {
        const el = input;
        if (document.activeElement === el) {
          return;
        }
        const prop = el.dataset.fieldProp;
        if (prop === "value")
          el.value = value;
        else if (prop === "x")
          el.value = String(Math.round(selected.location.x));
        else if (prop === "y")
          el.value = String(Math.round(selected.location.y));
        else if (prop === "width")
          el.value = String(Math.round(selected.size.width));
        else if (prop === "height")
          el.value = String(Math.round(selected.size.height));
        else if (prop === "rotation")
          el.value = String(Math.round(selected.rotation));
        else if (prop === "anchor")
          el.value = selected.location.anchor;
        else if (prop === "padding")
          el.value = String(Math.round(visualStyle.padding));
        else if (prop === "color" || prop === "backgroundColor") {
          const colorInput = el;
          const fieldRow = colorInput.closest(".color-field");
          if (!fieldRow) {
            colorInput.value = prop === "color" ? visualStyle.color : visualStyle.backgroundColor;
            return;
          }
          const picker = fieldRow.querySelector('input[type="color"][data-color-role="picker"]');
          const text = fieldRow.querySelector('input[type="text"][data-color-role="text"]');
          const currentValue = prop === "color" ? visualStyle.color : visualStyle.backgroundColor;
          if (picker) {
            picker.value = this.resolveColorPickerValue(currentValue, "#111111");
          }
          if (text) {
            text.value = currentValue;
          }
        } else if (prop === "fontFamily")
          el.value = visualStyle.fontFamily;
        else if (prop === "fontSize")
          el.value = String(Math.round(visualStyle.fontSize));
        else if (prop === "fontWeight")
          el.value = visualStyle.fontWeight;
        else if (prop === "textAlign")
          el.value = visualStyle.textAlign;
      });
      return;
    }
    this.selectionDetails.dataset.renderedId = selected.id;
    this.selectionDetails.innerHTML = `
            <div class="property-grid">
                <div class="property-row">
                    <div class="property-item">
                        <div class="property-readonly">${selected.type.toUpperCase()}</div>
                    </div>
                    <div class="property-item">
                        <div class="property-actions">
                            <button type="button" data-field-action="send-to-back">Send Back</button>
                            <button type="button" data-field-action="bring-to-front">Bring Front</button>
                        </div>
                    </div>
                </div>

                <div class="property-row">
                    <div class="property-item" style="grid-column: 1 / -1;">
                        ${this.renderFieldInput("Name", `<input type="text" data-field-prop="value" value="${escapeAttribute(value)}" />`)}
                    </div>
                </div>

                <div class="property-row">
                    ${this.renderFieldInput("X", `<input type="number" data-field-prop="x" value="${Math.round(selected.location.x)}" />`)}
                    ${this.renderFieldInput("Y", `<input type="number" data-field-prop="y" value="${Math.round(selected.location.y)}" />`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput("Width", `<input type="number" data-field-prop="width" value="${Math.round(selected.size.width)}" />`)}
                    ${this.renderFieldInput("Height", `<input type="number" data-field-prop="height" value="${Math.round(selected.size.height)}" />`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput("Rotation", `<input type="number" data-field-prop="rotation" value="${Math.round(selected.rotation)}" />`)}
                    ${this.renderFieldSelect("Anchor", `<select data-field-prop="anchor">
                        ${["top-left", "top-right", "bottom-left", "bottom-right", "center"].map((anchor) => `<option value="${anchor}" ${anchor === selected.location.anchor ? "selected" : ""}>${anchor}</option>`).join("")}
                    </select>`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput("Padding", `<input type="number" min="0" data-field-prop="padding" value="${Math.round(visualStyle.padding)}" />`)}
                    ${this.renderFieldSelect("Text Align", `<select data-field-prop="textAlign">
                        ${["left", "center", "right"].map((item) => `<option value="${item}" ${item === visualStyle.textAlign ? "selected" : ""}>${item}</option>`).join("")}
                    </select>`)}
                </div>

                <div class="property-row">
                    ${this.renderColorField("Color", "color", visualStyle.color, "#111111")}
                    ${this.renderColorField("Background", "backgroundColor", visualStyle.backgroundColor, "#111111")}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput("Font", `<input type="text" data-field-prop="fontFamily" value="${escapeAttribute(visualStyle.fontFamily)}" />`)}
                    ${this.renderFieldInput("Font Size", `<input type="number" min="1" data-field-prop="fontSize" value="${Math.round(visualStyle.fontSize)}" />`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldSelect("Font Weight", `<select data-field-prop="fontWeight">
                        ${["300", "400", "500", "600", "700", "800"].map((item) => `<option value="${item}" ${item === visualStyle.fontWeight ? "selected" : ""}>${item}</option>`).join("")}
                    </select>`)}
                    <div class="property-item"></div>
                </div>

                ${selected.type === "decoration" ? `
                <div class="property-row">
                    <div class="property-item decoration-image-property" style="grid-column: 1 / -1;">
                        <div class="property-label-row">
                            <span>Image</span>
                            <div class="property-actions">
                                <button type="button" data-field-action="choose-decoration-image">Choose</button>
                                <button type="button" data-field-action="clear-decoration-image">Clear</button>
                            </div>
                        </div>
                        <div class="decoration-image-preview">${this.renderDecorationAssetPreview(selected.imageAssetId ? this.getAssetById(state, selected.imageAssetId) : null)}</div>
                    </div>
                </div>
                ` : ""}
            </div>
        `;
  }
  updateAsidePanels(state) {
    if (this.asideElement) {
      this.asideElement.hidden = !this.isAsideOpen;
    }
    if (!this.isAsideOpen) {
      return;
    }
    if (this.asideDesign) {
      this.asideDesign.hidden = state.mode !== "design";
    }
    if (this.asideContent) {
      this.asideContent.hidden = state.mode !== "content";
    }
    if (this.asideHead) {
      this.asideHead.hidden = state.mode === "content";
    }
    if (state.mode === "content") {
      const template = this.getActiveTemplate(state);
      if (template && this.contentFieldsList) {
        if (this.contentFieldsList.dataset.renderedTemplateId === template.id) {
          const inputs = this.contentFieldsList.querySelectorAll("input");
          inputs.forEach((input) => {
            const el = input;
            if (document.activeElement === el) {
              return;
            }
            const fieldId = el.dataset.contentFieldId;
            if (!fieldId) {
              return;
            }
            const field = template.getFields().find((f) => f.id === fieldId);
            if (field) {
              const val = this.getFieldValue(state, field.id) || field.value;
              el.value = val;
            }
          });
          template.getFields().forEach((field) => {
            if (field.type !== "image") {
              return;
            }
            const row = this.contentFieldsList?.querySelector(`[data-content-field-id="${field.id}"]`);
            if (!row) {
              return;
            }
            const val = this.getFieldValue(state, field.id) || field.value;
            const asset = this.getAssetById(state, val);
            const preview = row.querySelector(".content-asset-preview");
            const source = row.querySelector(".content-asset-source");
            if (preview) {
              preview.innerHTML = asset ? this.renderAssetPreview(asset) : '<span class="content-asset-empty">No image selected</span>';
            }
            if (source) {
              source.textContent = asset ? asset.name : "Choose from assets";
            }
          });
          return;
        }
        this.contentFieldsList.dataset.renderedTemplateId = template.id;
        this.contentFieldsList.innerHTML = template.getFields().filter((f) => f.type === "text" || f.type === "image").map((field) => {
          const val = this.getFieldValue(state, field.id) || "";
          if (field.type === "image") {
            const asset = this.getAssetById(state, val);
            return `
                                <div class="content-asset-row" data-content-field-id="${field.id}">
                                    <div class="content-asset-preview">${asset ? this.renderAssetPreview(asset) : '<span class="content-asset-empty">No image selected</span>'}</div>
                                    <div class="content-asset-meta">
                                        <div class="content-asset-name">${escapeAttribute(field.value || field.type.toUpperCase())}</div>
                                        <div class="content-asset-source">${asset ? escapeAttribute(asset.name) : "Choose from assets"}</div>
                                        <div class="content-asset-actions">
                                            <button type="button" data-content-action="choose-image" data-content-field-id="${field.id}">Choose</button>
                                            <button type="button" data-content-action="clear-image" data-content-field-id="${field.id}">Clear</button>
                                        </div>
                                    </div>
                                </div>
                            `;
          }
          return this.renderFieldInput(field.value || field.type.toUpperCase(), `<input type="text" data-content-field-id="${field.id}" value="${escapeAttribute(val)}" placeholder="5mm or 16px" />`);
        }).join("");
      }
    }
  }
  updateNavState(state) {
    document.querySelectorAll("[data-nav-action]").forEach((el) => {
      el.classList.remove("is-active");
    });
    if (this.isAsideOpen) {
      if (state.mode === "design") {
        document.querySelector('[data-nav-action="open.design"]')?.classList.add("is-active");
      } else if (state.mode === "content") {
        document.querySelector('[data-nav-action="open.content"]')?.classList.add("is-active");
      }
    }
    if (this.additionalPanelMode === "templates") {
      document.querySelector('[data-nav-action="manage.templates"]')?.classList.add("is-active");
    }
    if (this.additionalPanelMode === "assets") {
      document.querySelector('[data-nav-action="manage.assets"]')?.classList.add("is-active");
    }
  }
  wireContentInputs(store) {
    this.contentFieldsList?.addEventListener("input", (event) => {
      const target = event.target;
      const fieldId = target.dataset.contentFieldId;
      if (!fieldId) {
        return;
      }
      store.update((state) => this.updateContentValue(state, fieldId, target.value), { recordHistory: false });
    });
  }
  wireAssetSelection(store) {
    this.contentFieldsList?.addEventListener("click", (event) => {
      const target = event.target;
      const action = target.dataset.contentAction;
      const fieldId = target.dataset.contentFieldId;
      if (!action || !fieldId) {
        return;
      }
      if (action === "choose-image") {
        this.openImageSelectModal(store, fieldId);
      }
      if (action === "clear-image") {
        store.update((state) => this.updateContentValue(state, fieldId, ""), { recordHistory: false });
      }
    });
  }
  wireNavigation(store) {
    document.querySelectorAll("[data-nav-action]").forEach((entry) => {
      entry.addEventListener("click", () => {
        const action = entry.dataset.navAction || "";
        if (action === "editor.history.undo") {
          store.undo();
        }
        if (action === "editor.history.redo") {
          store.redo();
        }
        if (action === "save.project") {
          persistState(store.getState());
        }
        if (action === "dashboard") {
          this.promptProjectManager();
        }
        if (action === "export.project") {
          this.exportProject(store.getState());
        }
        if (action === "export.image") {
          this.exportImage(store.getState(), "png", 2);
        }
        if (action === "open.design") {
          this.setAsideOpen(true);
          store.update((state) => ({ ...state, mode: "design" }), { recordHistory: false });
        }
        if (action === "open.content") {
          this.setAsideOpen(true);
          store.update((state) => ({ ...state, mode: "content" }), { recordHistory: false });
        }
        if (action === "manage.templates") {
          this.toggleAdditionalPanel("templates");
        }
        if (action === "manage.assets") {
          this.toggleAdditionalPanel("assets");
        }
        if (action === "manage.project") {
          this.openSettingsModal();
        }
        if (action === "editor.sidebar.toggle") {
          this.setAsideOpen(!this.isAsideOpen);
        }
      });
    });
  }
  renderAdditionalPanel(state) {
    if (!this.templatePanel || !this.additionalPanel) {
      return;
    }
    if (this.templatePanel.hidden || !this.additionalPanelMode) {
      return;
    }
    if (this.additionalPanelMode === "templates") {
      this.additionalPanel.innerHTML = `
                <div class="panel-shell templates-panel">
                    <div class="panel-header">
                        <h4>Templates</h4>
                        <button type="button" class="icon-button" data-panel-action="close-panel" aria-label="Close templates panel">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <input id="template-import-input" type="file" accept="application/json" style="display:none;" />
                    <input id="project-import-input" type="file" accept="application/json" style="display:none;" />
                    <div class="panel-actions templates-toolbar">
                        <div class="templates-toolbar-group">
                            <button id="template-save-button" class="btn primary">
                                <span class="material-symbols-rounded">save</span>
                                <span>Save Template</span>
                            </button>
                            <button id="template-import-button" class="btn secondary">
                                <span class="material-symbols-rounded">upload</span>
                                <span>Import Template</span>
                            </button>
                        </div>
                        <button id="project-import-button" class="btn is-secondary" hidden>
                            <span class="material-symbols-rounded">upload</span>
                            <span>Import Project</span>
                        </button>
                    </div>
                    <div id="template-list" class="template-grid"></div>
                </div>
            `;
      const templateImportInput = this.additionalPanel.querySelector("#template-import-input");
      const projectImportInput = this.additionalPanel.querySelector("#project-import-input");
      const templateImportButton = this.additionalPanel.querySelector("#template-import-button");
      const templateSaveButton = this.additionalPanel.querySelector("#template-save-button");
      const projectImportButton = this.additionalPanel.querySelector("#project-import-button");
      const templateList = this.additionalPanel.querySelector("#template-list");
      if (templateImportButton && templateImportInput) {
        templateImportButton.addEventListener("click", () => templateImportInput.click());
        templateImportInput.addEventListener("change", async (event) => {
          const target = event.target;
          if (!target.files || target.files.length === 0)
            return;
          const file = target.files[0];
          try {
            const TemplateModule = await Promise.resolve().then(() => (init_Template(), exports_Template));
            const template = await TemplateModule.Template.fromFile(file);
            const exists = state.templates.some((t) => t.id === template.id);
            let toSave = template;
            if (exists) {
              const payload = template.toJSON();
              payload.id = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : String(Math.random()).slice(2);
              payload.name = `${payload.name} (import)`;
              toSave = TemplateModule.Template.fromJSON(payload);
            }
            saveTemplate(state.project.id, toSave);
            this.store?.update((next) => addTemplateToState(next, toSave));
            target.value = "";
          } catch (err) {
            console.error("Failed to import template", err);
          }
        });
      }
      if (templateSaveButton) {
        templateSaveButton.addEventListener("click", () => {
          this.saveCurrentTemplateAsJson(state);
        });
      }
      if (projectImportButton && projectImportInput) {
        projectImportButton.addEventListener("click", () => projectImportInput.click());
        projectImportInput.addEventListener("change", async (event) => {
          const target = event.target;
          if (!target.files || target.files.length === 0) {
            return;
          }
          const file = target.files[0];
          try {
            const bundle = JSON.parse(await file.text());
            this.importProjectBundleWithConflict(bundle);
            target.value = "";
          } catch (err) {
            console.error("Failed to import project", err);
          }
        });
      }
      if (templateList) {
        templateList.innerHTML = state.templates.map((t) => {
          const isActive = state.project.activeTemplateId === t.id ? "is-active" : "";
          const badge = isActive ? '<span class="template-badge">Active</span>' : "";
          const initial = escapeAttribute(t.name.trim().slice(0, 1).toUpperCase() || "T");
          return `
                        <div class="template-card ${isActive}" data-template-id="${t.id}">
                            <div class="template-card-preview">
                                <span class="template-card-letter">${initial}</span>
                            </div>
                            <div class="template-card-body">
                                <div class="template-title-row">
                                    <div class="template-name">${escapeAttribute(t.name)}</div>
                                    ${badge}
                                </div>
                                <div class="template-actions">
                                    <button class="icon-button ${isActive ? "is-active" : ""}" data-action="set-active" data-template-id="${t.id}" aria-label="Set active template" ${isActive ? "disabled" : ""}>
                                        <span class="material-symbols-rounded">check_circle</span>
                                    </button>
                                    <button class="icon-button" data-action="rename" data-template-id="${t.id}" aria-label="Rename template">
                                        <span class="material-symbols-rounded">edit</span>
                                    </button>
                                    <button class="icon-button" data-action="export" data-template-id="${t.id}" aria-label="Export template">
                                        <span class="material-symbols-rounded">download</span>
                                    </button>
                                    <button class="icon-button is-danger" data-action="delete" data-template-id="${t.id}" aria-label="Delete template">
                                        <span class="material-symbols-rounded">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
        }).join("");
        templateList.querySelectorAll('[data-action="export"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.templateId;
            if (!id)
              return;
            this.exportTemplateById(state, id);
          });
        });
        templateList.querySelectorAll('[data-action="set-active"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.templateId;
            if (!id || !this.store)
              return;
            this.store.update((current) => this.setActiveTemplate(current, id), { recordHistory: false });
          });
        });
        templateList.querySelectorAll('[data-action="rename"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.templateId;
            if (!id)
              return;
            this.renameTemplate(id);
          });
        });
        templateList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.templateId;
            if (!id)
              return;
            deleteTemplate(state.project.id, id);
            this.store?.update((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
          });
        });
      }
      this.additionalPanel.querySelector('[data-panel-action="close-panel"]')?.addEventListener("click", () => this.toggleAdditionalPanel(null));
      return;
    }
    const projectAssets = state.assets.filter((asset) => asset.scope === "project" || asset.scope === "global");
    this.additionalPanel.innerHTML = `
            <div class="panel-shell assets-panel">
                <div class="panel-header">
                    <h4>Asset Library</h4>
                    <button type="button" class="icon-button" data-panel-action="close-panel" aria-label="Close asset library">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                
                <div class="panel-actions templates-toolbar">
                    <div class="templates-toolbar-group">
                        <input id="asset-import-input" type="file" accept="image/*,.svg" multiple style="display:none;" />
                        <button type="button" id="asset-import-button" class="btn primary">
                            <span class="material-symbols-rounded">upload</span>
                            <span>Upload Assets</span>
                        </button>
                        <input type="checkbox" id="asset-upload-global" class="toggle-checkbox" />
                        <label for="asset-upload-global" class="btn secondary toggle-label" style="margin-bottom: 0;">
                            <span class="material-symbols-rounded icon-unchecked">public_off</span>
                            <span class="material-symbols-rounded icon-checked">public</span>
                            <span>Global scope</span>
                        </label>
                    </div>
                </div>

                <div class="asset-dropzone" data-asset-dropzone>
                    <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 0.5rem; color: var(--text-secondary)">perm_media</span>
                    <strong>Drop images or SVG files here</strong>
                    <span>or use the upload button above</span>
                </div>
                
                <div class="asset-grid" id="asset-grid">
                    ${projectAssets.map((asset) => this.renderAssetCard(asset)).join("") || '<div class="asset-empty">No assets uploaded yet.</div>'}
                </div>
            </div>
        `;
    const importInput = this.additionalPanel.querySelector("#asset-import-input");
    const importButton = this.additionalPanel.querySelector("#asset-import-button");
    const globalToggle = this.additionalPanel.querySelector("#asset-upload-global");
    const dropzone = this.additionalPanel.querySelector("[data-asset-dropzone]");
    const grid = this.additionalPanel.querySelector("#asset-grid");
    const uploadFiles = async (files) => {
      const scope = globalToggle?.checked ? "global" : "project";
      const items = Array.from(files);
      if (items.length === 0) {
        return;
      }
      const assets = await Promise.all(items.map((file) => Asset.fromFile(file, scope)));
      this.store?.update((current) => ({
        ...current,
        assets: [...current.assets, ...assets]
      }));
    };
    importButton?.addEventListener("click", () => importInput?.click());
    importInput?.addEventListener("change", async (event) => {
      const target = event.target;
      if (!target.files || target.files.length === 0) {
        return;
      }
      await uploadFiles(target.files);
      target.value = "";
    });
    if (dropzone) {
      dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"));
      dropzone.addEventListener("drop", async (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
        if (event.dataTransfer?.files) {
          await uploadFiles(event.dataTransfer.files);
        }
      });
    }
    grid?.querySelectorAll("[data-asset-id]").forEach((card) => {
      const assetId = card.dataset.assetId;
      if (!assetId) {
        return;
      }
      card.querySelector('[data-asset-action="rename"]')?.addEventListener("click", () => this.renameAsset(assetId));
      card.querySelector('[data-asset-action="download"]')?.addEventListener("click", () => this.downloadAsset(assetId));
      card.querySelector('[data-asset-action="delete"]')?.addEventListener("click", () => this.deleteAsset(assetId));
      card.querySelector('[data-asset-action="crop"]')?.addEventListener("click", () => this.openCropAssetModal(assetId));
      card.querySelector('[data-asset-action="scope"]')?.addEventListener("change", (event) => {
        const nextScope = event.target.value;
        this.store?.update((current) => this.updateAsset(current, assetId, (nextAsset) => nextAsset.setScope(nextScope)));
      });
    });
    this.additionalPanel.querySelector('[data-panel-action="close-panel"]')?.addEventListener("click", () => this.toggleAdditionalPanel(null));
  }
  renderAssetCard(asset) {
    const scopeLabel = asset.scope === "global" ? "Global" : "Project";
    return `
            <div class="asset-card" data-asset-id="${asset.id}">
                <div class="asset-card-preview">
                    ${this.renderAssetPreview(asset)}
                </div>
                <div class="asset-card-body">
                    <label class="field no-label">
                        <span>Name</span>
                        <input type="text" value="${escapeAttribute(asset.name)}" data-asset-action="rename-input" readonly title="${escapeAttribute(asset.name)}" />
                    </label>
                    <div class="asset-card-meta">${scopeLabel}${asset.isVector() ? " · SVG" : ""}</div>
                    
                    <div class="asset-card-actions-row">
                        <label class="field no-label" style="flex: 1; min-width: 0;">
                            <span>Scope</span>
                            <select data-asset-action="scope" title="Asset Scope">
                                <option value="project" ${asset.scope === "project" ? "selected" : ""}>Project</option>
                                <option value="global" ${asset.scope === "global" ? "selected" : ""}>Global</option>
                            </select>
                        </label>
                        
                        <div class="asset-card-icon-actions">
                            <button type="button" class="icon-button" data-asset-action="rename" aria-label="Rename" title="Rename">
                                <span class="material-symbols-rounded">edit</span>
                            </button>
                            <button type="button" class="icon-button" data-asset-action="crop" aria-label="Crop" title="Crop">
                                <span class="material-symbols-rounded">crop</span>
                            </button>
                            <button type="button" class="icon-button" data-asset-action="download" aria-label="Download" title="Download">
                                <span class="material-symbols-rounded">download</span>
                            </button>
                            <button type="button" class="icon-button is-danger" data-asset-action="delete" aria-label="Delete" title="Delete">
                                <span class="material-symbols-rounded">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }
  toggleAdditionalPanel(mode) {
    if (!this.templatePanel || !this.appWrapper) {
      return;
    }
    const nextMode = this.additionalPanelMode === mode ? null : mode;
    this.additionalPanelMode = nextMode;
    this.templatePanel.hidden = !nextMode;
    this.appWrapper.hidden = Boolean(nextMode);
    if (!nextMode && this.additionalPanel) {
      this.additionalPanel.innerHTML = "";
    }
    this.updateNavState(this.store?.getState() || {});
    if (nextMode && this.store) {
      this.renderAdditionalPanel(this.store.getState());
    }
    this.requestStageResize();
  }
  renameAsset(assetId) {
    const state = this.store?.getState();
    const asset = state?.assets.find((item) => item.id === assetId);
    if (!asset || !this.store) {
      return;
    }
    const nextName = window.prompt("Rename asset", asset.name)?.trim();
    if (!nextName) {
      return;
    }
    this.store.update((current) => this.updateAsset(current, assetId, (nextAsset) => nextAsset.setName(nextName)));
  }
  downloadAsset(assetId) {
    const state = this.store?.getState();
    const asset = state?.assets.find((item) => item.id === assetId);
    if (!asset) {
      return;
    }
    const link = document.createElement("a");
    link.href = asset.dataUrl;
    link.download = asset.name;
    link.click();
  }
  deleteAsset(assetId) {
    if (!this.store) {
      return;
    }
    this.store.update((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== assetId),
      contents: current.contents.map((content) => {
        current.templates.forEach((template) => {
          template.getFields().forEach((field) => {
            if (field.type === "image") {
              const value = content.getValue(field.id);
              if (value === assetId) {
                content.removeValue(field.id);
              }
            }
          });
        });
        return content;
      })
    }));
  }
  openCropAssetModal(assetId) {
    const state = this.store?.getState();
    const asset = state?.assets.find((item) => item.id === assetId);
    if (!asset) {
      return;
    }
    const crop = asset.crop || { x: 0, y: 0, width: 300, height: 300 };
    const modal = new ModalManager_default("Crop Asset", "Set the visible crop region for this image.", "Save").addNumberField("X", crop.x, true).addNumberField("Y", crop.y, true).addNumberField("Width", crop.width, true).addNumberField("Height", crop.height, true);
    modal.show().then((result) => {
      if (!result || !this.store) {
        return;
      }
      this.store.update((current) => this.updateAsset(current, assetId, (nextAsset) => {
        nextAsset.setCrop({
          x: Number(result["X"]) || 0,
          y: Number(result["Y"]) || 0,
          width: Number(result["Width"]) || 1,
          height: Number(result["Height"]) || 1
        });
      }));
    });
  }
  openImageSelectModal(store, fieldId) {
    const state = store.getState();
    const assets = state.assets.filter((asset) => asset.scope === "project" || asset.scope === "global");
    const currentValue = this.getFieldValue(state, fieldId);
    const modal = new ModalManager_default("Choose Image", "Select an asset for this content field.", "Use").addImageSelectField("Asset", assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      src: asset.dataUrl,
      mimeType: asset.mimeType,
      selected: asset.id === currentValue
    })), currentValue || "", true);
    modal.show().then((result) => {
      if (!result) {
        return;
      }
      const selectedAssetId = String(result["Asset"] || "").trim();
      if (!selectedAssetId) {
        return;
      }
      store.update((next) => this.updateContentValue(next, fieldId, selectedAssetId), { recordHistory: false });
    });
  }
  openDecorationImageSelectModal(store, fieldId) {
    const state = store.getState();
    const template = this.getActiveTemplate(state);
    const field = template?.getFields().find((item) => item.id === fieldId);
    if (!field) {
      return;
    }
    const assets = state.assets.filter((asset) => asset.scope === "project" || asset.scope === "global");
    const currentValue = field.imageAssetId || "";
    const modal = new ModalManager_default("Choose Decoration Image", "Select an asset for this decoration.", "Use").addImageSelectField("Asset", assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      src: asset.dataUrl,
      mimeType: asset.mimeType,
      selected: asset.id === currentValue
    })), currentValue || "", true);
    modal.show().then((result) => {
      if (!result) {
        return;
      }
      const selectedAssetId = String(result["Asset"] || "").trim();
      if (!selectedAssetId) {
        return;
      }
      store.update((next) => this.updateTemplateField(next, fieldId, (nextField) => {
        nextField.imageAssetId = selectedAssetId;
      }), { recordHistory: false });
    });
  }
  exportProject(state) {
    const payload = {
      project: state.project.toJSON(),
      templates: state.templates.map((template) => template.toJSON()),
      contents: state.contents.map((content) => content.toJSON()),
      assets: state.assets.map((asset) => asset.toJSON())
    };
    this.downloadJSON(`${state.project.name}.json`, payload);
  }
  importProjectBundle(payload) {
    if (!payload || typeof payload !== "object" || !this.store) {
      return;
    }
    const record = payload;
    try {
      const project = record.project ? Project.fromJSON(record.project) : null;
      const templates = Array.isArray(record.templates) ? record.templates.map((item) => Template.fromJSON(item)) : [];
      const contents = Array.isArray(record.contents) ? record.contents.map((item) => Content.fromJSON(item)) : [];
      const assets = Array.isArray(record.assets) ? record.assets.map((item) => Asset.fromJSON(item)) : [];
      if (!project) {
        return;
      }
      this.applyProjectBundle(project, templates, contents, assets);
    } catch (err) {
      console.error("Invalid project bundle", err);
    }
  }
  importProjectBundleWithConflict(payload) {
    if (!payload || typeof payload !== "object" || !this.store) {
      return;
    }
    const record = payload;
    try {
      const project = record.project ? Project.fromJSON(record.project) : null;
      const templates = Array.isArray(record.templates) ? record.templates.map((item) => Template.fromJSON(item)) : [];
      const contents = Array.isArray(record.contents) ? record.contents.map((item) => Content.fromJSON(item)) : [];
      const assets = Array.isArray(record.assets) ? record.assets.map((item) => Asset.fromJSON(item)) : [];
      if (!project) {
        return;
      }
      const hasConflict = listProjects().some((item) => item.id === project.id);
      if (!hasConflict) {
        this.applyProjectBundle(project, templates, contents, assets);
        return;
      }
      const modal = new ModalManager_default("Project Import", "A project with the same ID exists. Replace it or save as new?", "Continue");
      modal.addSelectField("Import action", ["Replace existing", "Save as new"], "Replace existing", true);
      modal.addTextField("New project name", `${project.name || "Imported Project"} (import)`, true);
      modal.setConditionalField("New project name", "Import action", "Save as new");
      modal.show().then((result) => {
        if (!result) {
          return;
        }
        const action = String(result["Import action"] || "").trim();
        if (action === "Save as new") {
          const newName = String(result["New project name"] || "").trim() || `${project.name || "Imported Project"} (import)`;
          const newId = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : String(Math.random()).slice(2);
          const newProject = new Project(newName, {
            id: newId,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            activeTemplateId: project.activeTemplateId,
            activeContentId: project.activeContentId,
            contentFormat: project.contentFormat,
            backgroundColor: project.backgroundColor ?? null
          });
          this.applyProjectBundle(newProject, templates, contents, assets);
          return;
        }
        this.applyProjectBundle(project, templates, contents, assets);
      });
    } catch (err) {
      console.error("Invalid project bundle", err);
    }
  }
  applyProjectBundle(project, templates, contents, assets) {
    if (!this.store) {
      return;
    }
    setActiveProject(project.id);
    this.store.setState({
      project,
      templates,
      contents,
      assets,
      selection: { fieldId: null },
      mode: "design"
    });
  }
  exportTemplateById(state, templateId) {
    const template = state.templates.find((t) => t.id === templateId);
    if (!template)
      return;
    const { exportName, payload } = this.getTemplateExportDetails(state, template);
    this.downloadJSON(`${exportName}.template.json`, payload);
  }
  saveCurrentTemplateAsJson(state) {
    const template = state.templates.find((item) => item.id === state.project.activeTemplateId) ?? state.templates[0] ?? null;
    if (!template) {
      return;
    }
    saveTemplate(state.project.id, template);
    const { exportName, payload } = this.getTemplateExportDetails(state, template);
    this.downloadJSON(`${exportName}.template.json`, payload);
  }
  getTemplateExportDetails(state, template) {
    const templateName = (template.name || "").trim();
    const projectName = (state.project.name || "").trim();
    const isDefaultName = templateName.length === 0 || templateName === "Starter Post" || templateName === "Template" || templateName === "Untitled Template";
    const exportName = isDefaultName && projectName ? projectName : templateName || projectName || "Template";
    const payload = template.toJSON();
    if (isDefaultName && projectName) {
      payload.name = projectName;
    }
    return { exportName, payload };
  }
  setActiveTemplate(state, templateId) {
    if (state.project.activeTemplateId === templateId) {
      return state;
    }
    const nextProject = state.project;
    nextProject.activeTemplateId = templateId;
    const nextContent = state.contents.find((content) => content.templateId === templateId);
    if (nextContent) {
      nextProject.activeContentId = nextContent.id;
    }
    return {
      ...state,
      project: nextProject
    };
  }
  renameTemplate(templateId) {
    const state = this.store?.getState();
    if (!state || !this.store) {
      return;
    }
    const template = state.templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    const nextName = window.prompt("Rename template", template.name)?.trim();
    if (!nextName) {
      return;
    }
    this.store.update((current) => ({
      ...current,
      templates: current.templates.map((item) => {
        if (item.id !== templateId) {
          return item;
        }
        const nextTemplate = Template.fromJSON(item.toJSON());
        nextTemplate.name = nextName;
        return nextTemplate;
      })
    }));
  }
  downloadJSON(name, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  async exportImage(state, format = "png", scale = 2) {
    const project = state.project;
    const targetWidth = Math.max(1, Math.round(project.contentFormat?.width || 1));
    const targetHeight = Math.max(1, Math.round(project.contentFormat?.height || 1));
    try {
      await document.fonts.ready;
    } catch (e) {}
    await this.loadHtml2Canvas();
    const html2canvas = window.html2canvas;
    if (typeof html2canvas !== "function") {
      console.error("html2canvas not available");
      return;
    }
    const stage = this.stageElement;
    const stageRect = stage.getBoundingClientRect();
    const offscreen = document.createElement("div");
    offscreen.style.position = "fixed";
    offscreen.style.left = "-100000px";
    offscreen.style.top = "0";
    offscreen.style.width = `${Math.max(1, Math.round(stageRect.width))}px`;
    offscreen.style.height = `${Math.max(1, Math.round(stageRect.height))}px`;
    offscreen.style.overflow = "visible";
    offscreen.style.background = project.backgroundColor ?? "transparent";
    offscreen.style.padding = "0";
    offscreen.style.margin = "0";
    offscreen.style.boxSizing = "border-box";
    const clone = stage.cloneNode(true);
    clone.style.width = `${Math.max(1, Math.round(stageRect.width))}px`;
    clone.style.height = `${Math.max(1, Math.round(stageRect.height))}px`;
    clone.style.minWidth = `${Math.max(1, Math.round(stageRect.width))}px`;
    clone.style.minHeight = `${Math.max(1, Math.round(stageRect.height))}px`;
    clone.style.maxWidth = `${Math.max(1, Math.round(stageRect.width))}px`;
    clone.style.maxHeight = `${Math.max(1, Math.round(stageRect.height))}px`;
    clone.style.aspectRatio = "auto";
    clone.style.transform = "none";
    clone.style.padding = "0";
    clone.style.margin = "0";
    clone.style.boxSizing = "border-box";
    clone.style.setProperty("--stage-format-width", String(targetWidth));
    clone.style.setProperty("--stage-format-height", String(targetHeight));
    offscreen.appendChild(clone);
    document.body.appendChild(offscreen);
    const originalImgs = Array.from(stage.querySelectorAll("img"));
    const cloneImgs = Array.from(clone.querySelectorAll("img"));
    for (let i = 0;i < cloneImgs.length; i++) {
      const cImg = cloneImgs[i];
      const oImg = originalImgs[i];
      if (!oImg || !cImg)
        continue;
      const rect = oImg.getBoundingClientRect();
      cImg.style.width = `${Math.round(rect.width)}px`;
      cImg.style.height = `${Math.round(rect.height)}px`;
      cImg.style.objectFit = getComputedStyle(oImg).objectFit || "cover";
    }
    await Promise.all(Array.from(clone.querySelectorAll("img")).map((imgEl) => {
      const img = imgEl;
      if (img.complete)
        return Promise.resolve();
      return new Promise((res) => {
        img.addEventListener("load", () => res());
        img.addEventListener("error", () => res());
      });
    }));
    await new Promise((r) => setTimeout(r, 50));
    try {
      const renderer = new CanvasRenderer_default(targetWidth, targetHeight, scale);
      const outCanvas = await renderer.render(this.store.getState());
      outCanvas.toBlob((blob) => {
        if (blob)
          this.downloadBlob(blob, `${project.name || "export"}.${format === "png" ? "png" : "jpg"}`);
      }, format === "png" ? "image/png" : "image/jpeg", 0.92);
    } catch (err) {
      console.error("CanvasRenderer failed, falling back to html2canvas", err);
      try {
        const renderCssWidth = Math.max(1, Math.round(stageRect.width));
        const desiredCanvasWidth = Math.round(targetWidth * scale);
        const canvasScale = desiredCanvasWidth / renderCssWidth;
        const canvas = await html2canvas(clone, { scale: canvasScale, backgroundColor: project.backgroundColor ?? null, useCORS: true });
        canvas.toBlob((blob) => {
          if (blob) {
            const ext = format === "png" ? "png" : "jpg";
            this.downloadBlob(blob, `${project.name || "export"}.${ext}`);
          }
        }, format === "png" ? "image/png" : "image/jpeg", 0.92);
      } catch (err2) {
        console.error("html2canvas export failed", err2);
      }
    } finally {
      if (offscreen.parentElement)
        offscreen.parentElement.removeChild(offscreen);
    }
  }
  collectCSSText() {
    let css = "";
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules;
        for (const r of Array.from(rules)) {
          css += r.cssText + `
`;
        }
      } catch (e) {
        const href = sheet.href;
        if (href) {
          css += `@import url("${href}");
`;
        }
      }
    }
    return css;
  }
  downloadBlob(blob, name) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }
  startInteraction(store, fieldId, mode, handle, event) {
    const state = store.getState();
    const template = this.getActiveTemplate(state);
    if (!template) {
      return;
    }
    const field = template.getFields().find((item) => item.id === fieldId);
    if (!field) {
      return;
    }
    const stageRect = this.stageElement.getBoundingClientRect();
    const format = state.project.contentFormat || getDefaultContentFormat();
    const rect = normalizeFieldRect(field, stageRect, { width: format.width, height: format.height });
    const centerX = stageRect.left + rect.x + rect.width / 2;
    const centerY = stageRect.top + rect.y + rect.height / 2;
    const angleFromPointer = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const interaction = {
      fieldId,
      mode,
      handle,
      originPointer: { x: event.clientX, y: event.clientY },
      originRect: rect,
      originAngle: angleFromPointer,
      originRotation: rect.rotation
    };
    store.beginHistoryGroup();
    this.stageElement.setPointerCapture(event.pointerId);
    this.setInteraction(store, interaction);
  }
  setInteraction(store, interaction) {
    this.activeInteraction = interaction;
    store.update((state) => ({
      ...state,
      selection: { fieldId: interaction?.fieldId || null }
    }), { recordHistory: false });
  }
  handlePointerMove(store, event) {
    if (!this.activeInteraction) {
      return;
    }
    const { fieldId, mode, handle, originPointer, originRect, originAngle, originRotation } = this.activeInteraction;
    const deltaX = event.clientX - originPointer.x;
    const deltaY = event.clientY - originPointer.y;
    const stageRect = this.stageElement.getBoundingClientRect();
    const format = store.getState().project.contentFormat || getDefaultContentFormat();
    store.update((state) => this.updateTemplateField(state, fieldId, (field) => {
      const nextRect = { ...originRect };
      if (mode === "move") {
        nextRect.x += deltaX;
        nextRect.y += deltaY;
        if (event.shiftKey) {
          nextRect.x = Math.round(nextRect.x / MOVE_SNAP_GRID_SIZE) * MOVE_SNAP_GRID_SIZE;
          nextRect.y = Math.round(nextRect.y / MOVE_SNAP_GRID_SIZE) * MOVE_SNAP_GRID_SIZE;
        }
      }
      if (mode === "resize" && handle) {
        const rotationRad = originRect.rotation * Math.PI / 180;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
        const localDeltaX = deltaX * cos + deltaY * sin;
        const localDeltaY = -deltaX * sin + deltaY * cos;
        let widthChange = 0;
        let heightChange = 0;
        let localShiftX = 0;
        let localShiftY = 0;
        if (handle.includes("e")) {
          widthChange = localDeltaX;
        }
        if (handle.includes("s")) {
          heightChange = localDeltaY;
        }
        if (handle.includes("w")) {
          widthChange = -localDeltaX;
          localShiftX = localDeltaX;
        }
        if (handle.includes("n")) {
          heightChange = -localDeltaY;
          localShiftY = localDeltaY;
        }
        let nextWidth = Math.max(40, originRect.width + widthChange);
        let nextHeight = Math.max(40, originRect.height + heightChange);
        if (event.shiftKey) {
          nextWidth = Math.max(40, Math.round(nextWidth / RESIZE_SNAP_GRID_SIZE) * RESIZE_SNAP_GRID_SIZE);
          nextHeight = Math.max(40, Math.round(nextHeight / RESIZE_SNAP_GRID_SIZE) * RESIZE_SNAP_GRID_SIZE);
        }
        if (handle.includes("w")) {
          localShiftX = originRect.width - nextWidth;
        }
        if (handle.includes("n")) {
          localShiftY = originRect.height - nextHeight;
        }
        const shiftX = localShiftX * cos - localShiftY * sin;
        const shiftY = localShiftX * sin + localShiftY * cos;
        nextRect.width = nextWidth;
        nextRect.height = nextHeight;
        nextRect.x = originRect.x + shiftX;
        nextRect.y = originRect.y + shiftY;
      }
      if (mode === "rotate") {
        const centerX = stageRect.left + originRect.x + originRect.width / 2;
        const centerY = stageRect.top + originRect.y + originRect.height / 2;
        const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
        const delta = angle - originAngle;
        const degrees = originRotation + delta * (180 / Math.PI);
        nextRect.rotation = snapRotation(degrees, 5);
      }
      applyRectToField(field, nextRect, stageRect, { width: format.width, height: format.height });
    }), { recordHistory: false });
  }
  handlePointerUp(store, event) {
    if (!this.activeInteraction) {
      return;
    }
    this.stageElement.releasePointerCapture(event.pointerId);
    this.activeInteraction = null;
    store.commitHistoryGroup();
  }
  setupPointerHandlers(store) {
    this.stageElement.addEventListener("pointerdown", (event) => {
      const state = store.getState();
      if (state.mode === "content") {
        return;
      }
      event.preventDefault();
      const target = event.target;
      const fieldElement = target.closest(".editor-field");
      const handleElement = target.closest(".editor-handle");
      if (!fieldElement) {
        store.update((state2) => ({ ...state2, selection: { fieldId: null } }), { recordHistory: false });
        return;
      }
      this.setAsideOpen(true);
      const fieldId = fieldElement.dataset.fieldId;
      if (!fieldId) {
        return;
      }
      if (handleElement?.dataset.handle === "rotate") {
        this.startInteraction(store, fieldId, "rotate", "rotate", event);
        return;
      }
      if (handleElement?.dataset.handle) {
        this.startInteraction(store, fieldId, "resize", handleElement.dataset.handle, event);
        return;
      }
      this.startInteraction(store, fieldId, "move", null, event);
    });
    this.stageElement.addEventListener("pointermove", (event) => this.handlePointerMove(store, event));
    this.stageElement.addEventListener("pointerup", (event) => this.handlePointerUp(store, event));
    this.stageElement.addEventListener("pointercancel", (event) => this.handlePointerUp(store, event));
  }
  setupKeybinds(store) {
    const keyManager = KeybindManager.getInstance();
    keyManager.bind("mod+z", () => {
      store.undo();
    });
    keyManager.bind("mod+r", () => {
      store.redo();
    });
    keyManager.bind("1", () => {
      this.openSettingsModal();
    });
    keyManager.bind("backspace", () => {
      store.update((state) => {
        const selectedId = state.selection.fieldId;
        if (!selectedId) {
          return state;
        }
        const template = this.getActiveTemplate(state);
        if (!template) {
          return state;
        }
        const nextFields = template.getFields().filter((field) => field.id !== selectedId);
        template.setFields(nextFields);
        return {
          ...state,
          templates: state.templates.map((t) => t.id === template.id ? template : t),
          selection: { fieldId: null }
        };
      });
    });
    keyManager.bind("delete", () => {
      store.update((state) => {
        const selectedId = state.selection.fieldId;
        if (!selectedId) {
          return state;
        }
        const template = this.getActiveTemplate(state);
        if (!template) {
          return state;
        }
        const nextFields = template.getFields().filter((field) => field.id !== selectedId);
        template.setFields(nextFields);
        return {
          ...state,
          templates: state.templates.map((t) => t.id === template.id ? template : t),
          selection: { fieldId: null }
        };
      });
    });
  }
  wireFieldActions(store) {
    const addField = (type) => {
      store.update((state) => {
        const template = this.getActiveTemplate(state);
        if (!template) {
          return state;
        }
        const label = type === "image" ? "Image" : type === "decoration" ? "Decoration" : "Text";
        const newField = createProjectField(type, label, {
          location: { x: 80, y: 80, anchor: "top-left", unit: "px" },
          size: { width: 240, height: 140, unit: "px" }
        });
        const nextFields = [...template.getFields(), newField];
        template.setFields(nextFields);
        return {
          ...state,
          templates: state.templates.map((item) => item.id === template.id ? template : item),
          selection: { fieldId: newField.id }
        };
      });
    };
    this.addTextFieldButton?.addEventListener("click", () => addField("text"));
    this.addDecorationFieldButton?.addEventListener("click", () => addField("decoration"));
    this.addImageFieldButton?.addEventListener("click", () => addField("image"));
  }
  wireSelectionInputs(store) {
    this.selectionDetails?.addEventListener("input", (event) => {
      const target = event.target;
      const prop = target.dataset.fieldProp;
      if (!prop) {
        return;
      }
      store.update((state) => {
        const selectedId = state.selection.fieldId;
        if (!selectedId) {
          return state;
        }
        if (prop === "value") {
          return this.updateTemplateField(state, selectedId, (field) => {
            field.value = target.value;
          });
        }
        return this.updateTemplateField(state, selectedId, (field) => {
          const currentStyle = normalizeFieldStyle(field.style || createDefaultFieldStyle());
          const numericValue = Number(target.value);
          if (prop === "x") {
            field.location.x = numericValue;
          } else if (prop === "y") {
            field.location.y = numericValue;
          } else if (prop === "width") {
            field.size.width = Math.max(20, numericValue);
          } else if (prop === "height") {
            field.size.height = Math.max(20, numericValue);
          } else if (prop === "rotation") {
            field.rotation = snapRotation(numericValue, 5);
          } else if (prop === "anchor" && "value" in target) {
            field.location.anchor = target.value;
          } else if (prop === "padding") {
            currentStyle.padding = Math.max(0, Number.isFinite(numericValue) ? numericValue : currentStyle.padding);
            field.style = currentStyle;
          } else if (prop === "color") {
            const colorValue = this.syncColorFieldInputs(prop, target);
            currentStyle.color = colorValue;
            field.style = currentStyle;
          } else if (prop === "backgroundColor") {
            const backgroundValue = this.syncColorFieldInputs(prop, target);
            currentStyle.backgroundColor = backgroundValue;
            field.style = currentStyle;
          } else if (prop === "fontFamily") {
            currentStyle.fontFamily = target.value || createDefaultFieldStyle().fontFamily;
            field.style = currentStyle;
          } else if (prop === "fontSize") {
            currentStyle.fontSize = Math.max(1, Number.isFinite(numericValue) ? numericValue : currentStyle.fontSize);
            field.style = currentStyle;
          } else if (prop === "fontWeight") {
            currentStyle.fontWeight = target.value;
            field.style = currentStyle;
          } else if (prop === "textAlign") {
            const nextTextAlign = target.value;
            currentStyle.textAlign = nextTextAlign;
            field.style = currentStyle;
          }
        });
      }, { recordHistory: false });
    });
    this.selectionDetails?.addEventListener("click", (event) => {
      const target = event.target;
      const action = target.dataset.fieldAction;
      if (!action || !this.store) {
        return;
      }
      const fieldId = this.store.getState().selection.fieldId;
      if (!fieldId) {
        return;
      }
      if (action === "choose-decoration-image") {
        this.openDecorationImageSelectModal(this.store, fieldId);
      }
      if (action === "clear-decoration-image") {
        this.store.update((state) => this.updateTemplateField(state, fieldId, (field) => {
          field.imageAssetId = null;
        }), { recordHistory: false });
      }
      if (action === "send-to-back") {
        this.store.update((state) => moveTemplateField(state, fieldId, "back"));
      }
      if (action === "bring-to-front") {
        this.store.update((state) => moveTemplateField(state, fieldId, "front"));
      }
    });
  }
  syncColorFieldInputs(fieldProp, target) {
    const fieldRow = target.closest(".color-field");
    if (!fieldRow) {
      return target.value;
    }
    const picker = fieldRow.querySelector('input[type="color"][data-color-role="picker"]');
    const text = fieldRow.querySelector('input[type="text"][data-color-role="text"]');
    if (target.dataset.colorRole === "picker") {
      if (text) {
        text.value = target.value;
      }
      return target.value;
    }
    const nextValue = target.value.trim();
    if (picker) {
      picker.value = this.resolveColorPickerValue(nextValue, "#111111");
    }
    if (fieldProp === "backgroundColor" && nextValue.toLowerCase() === "transparent" && text) {
      text.value = "transparent";
    }
    return nextValue;
  }
  updateContentValue(state, fieldId, value) {
    return updateContentValue(state, fieldId, value);
  }
  updateTemplateField(state, fieldId, updater) {
    return updateTemplateField(state, fieldId, updater);
  }
  setupWindowResizeHandling() {
    window.addEventListener("resize", () => {
      this.requestStageResize();
    });
  }
  setAsideOpen(isOpen) {
    if (this.isAsideOpen === isOpen) {
      return;
    }
    this.isAsideOpen = isOpen;
    const state = this.store?.getState();
    if (state) {
      this.updateAsidePanels(state);
      this.updateNavState(state);
    }
    this.requestStageResize();
  }
  getHistoryStorageKey(projectId) {
    return `${DeltosPublisherApp.HISTORY_STORAGE_PREFIX}.${projectId}`;
  }
  persistHistorySnapshot(store) {
    const state = store.getState();
    const snapshot = store.getHistorySnapshot();
    const key = this.getHistoryStorageKey(state.project.id);
    try {
      sessionStorage.setItem(key, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("Failed to persist history snapshot", err);
    }
  }
  restoreHistorySnapshot(store) {
    const state = store.getState();
    const key = this.getHistoryStorageKey(state.project.id);
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) {
        return;
      }
      const snapshot = JSON.parse(raw);
      if (!snapshot || !Array.isArray(snapshot.past) || !Array.isArray(snapshot.future)) {
        return;
      }
      store.restoreHistorySnapshot(snapshot);
    } catch (err) {
      console.warn("Failed to restore history snapshot", err);
    }
  }
  requestStageResize() {
    if (this.stageResizeFrame !== null) {
      cancelAnimationFrame(this.stageResizeFrame);
    }
    this.stageResizeFrame = requestAnimationFrame(() => {
      this.stageResizeFrame = null;
      const state = this.store?.getState();
      if (!state) {
        return;
      }
      this.applyStageFormat(state.project.contentFormat || getDefaultContentFormat());
      this.render(state);
    });
  }
  applyStageFormat(format) {
    const stage = this.stageElement;
    const safeWidth = Math.max(1, Math.round(format.width));
    const safeHeight = Math.max(1, Math.round(format.height));
    stage.style.setProperty("--stage-format-width", String(safeWidth));
    stage.style.setProperty("--stage-format-height", String(safeHeight));
    const container = stage.parentElement;
    if (!container) {
      return;
    }
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }
    const ratio = safeWidth / safeHeight;
    let nextWidth = bounds.width;
    let nextHeight = nextWidth / ratio;
    if (nextHeight > bounds.height) {
      nextHeight = bounds.height;
      nextWidth = nextHeight * ratio;
    }
    stage.style.width = `${Math.max(1, Math.floor(nextWidth))}px`;
    stage.style.height = `${Math.max(1, Math.floor(nextHeight))}px`;
  }
  applyProjectBackground(project) {
    const stage = this.stageElement;
    const bg = project.backgroundColor ?? "transparent";
    stage.style.backgroundColor = bg;
  }
  resolveContentFormat(targetLabel, width, height) {
    if (targetLabel === "Custom") {
      return {
        label: "Custom",
        width: Math.max(1, Math.round(Number.isFinite(width) ? width : 1)),
        height: Math.max(1, Math.round(Number.isFinite(height) ? height : 1))
      };
    }
    return findContentFormatByLabel(targetLabel) || getDefaultContentFormat();
  }
  openSettingsModal() {
    const state = this.store?.getState();
    const project = state?.project;
    const currentFormat = project?.contentFormat || getDefaultContentFormat();
    const modal = new ModalManager_default("Settings", "Configure your project settings below.", "Save").addTextField("Project Name", project?.name || "", true).addColorField("Background", project?.backgroundColor ?? "transparent", true).addSelectField("Target", ContentFormats.map((format) => format.label).concat(["Custom"]), currentFormat.label, true).addNumberField("Width (px)", currentFormat.width, true).addNumberField("Height (px)", currentFormat.height, true).setConditionalField("Width (px)", "Target", "Custom").setConditionalField("Height (px)", "Target", "Custom");
    modal.show().then((result) => {
      if (!result || !this.store) {
        return;
      }
      const nextName = String(result["Project Name"] || project?.name || "").trim();
      const target = String(result["Target"] || currentFormat.label);
      const width = Number(result["Width (px)"]);
      const height = Number(result["Height (px)"]);
      const nextFormat = this.resolveContentFormat(target, width, height);
      this.store.update((state2) => {
        state2.project.name = nextName || state2.project.name;
        state2.project.contentFormat = nextFormat;
        state2.project.backgroundColor = String(result["Background"] || "").trim() || null;
        state2.project.touch();
        return {
          ...state2,
          project: state2.project
        };
      });
    });
  }
}

// src/ts/app.ts
DeltosPublisherApp.getInstance().start().catch(console.error);
