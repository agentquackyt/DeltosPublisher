import { type ContentFormat } from "../config/ContentFormat.ts";

type FieldType = 'text' | 'decoration' | 'image';
type Anchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
type CoordinateUnit = 'px' | 'percent';

interface Location {
    x: number;
    y: number;
    anchor: Anchor;
    unit: CoordinateUnit;
}

interface FieldSize {
    width: number;
    height: number;
    unit: CoordinateUnit;
}

interface FieldVisualStyle {
    padding: number;
    color: string;
    backgroundColor: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    textAlign: 'left' | 'center' | 'right';
}

interface ProjectField {
    id: string;
    type: FieldType;
    value: string;
    imageAssetId?: string | null;
    location: Location;
    size: FieldSize;
    rotation: number;
    style: FieldVisualStyle;
}

interface ProjectJSON {
    version: number;
    id: string;
    name: string;
    activeTemplateId: string | null;
    activeContentId: string | null;
    contentFormat: ContentFormat | null;
    backgroundColor?: string | null;
    createdAt: string;
    updatedAt: string;
}

const PROJECT_SCHEMA_VERSION = 1;

const createDefaultLocation = (): Location => ({
    x: 0,
    y: 0,
    anchor: 'top-left',
    unit: 'px',
});

const createDefaultSize = (): FieldSize => ({
    width: 200,
    height: 120,
    unit: 'px',
});

const createDefaultFieldStyle = (): FieldVisualStyle => ({
    padding: 8,
    color: '#202124',
    backgroundColor: 'transparent',
    fontFamily: 'Google Sans, sans-serif',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
});

const normalizeFieldStyle = (value?: Partial<FieldVisualStyle> | null): FieldVisualStyle => {
    return {
        ...createDefaultFieldStyle(),
        ...(value || {}),
    };
};

const normalizeProjectField = (field: ProjectField): ProjectField => {
    return {
        ...field,
        imageAssetId: (field as Partial<ProjectField>).imageAssetId ?? null,
        style: normalizeFieldStyle((field as Partial<ProjectField>).style),
    };
};

const createProjectField = (type: FieldType, value: string, overrides?: Partial<ProjectField>): ProjectField => {
    const nextField: ProjectField = {
        id: self.crypto.randomUUID(),
        type,
        value,
        imageAssetId: null,
        location: createDefaultLocation(),
        size: createDefaultSize(),
        rotation: 0,
        style: createDefaultFieldStyle(),
        ...overrides,
    };

    nextField.style = normalizeFieldStyle(overrides?.style || nextField.style);
    return nextField;
};

const isProjectJSON = (payload: unknown): payload is ProjectJSON => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const record = payload as ProjectJSON;
    return typeof record.version === 'number'
        && typeof record.id === 'string'
        && typeof record.name === 'string'
        && (record.activeTemplateId === null || typeof record.activeTemplateId === 'string')
        && (record.activeContentId === null || typeof record.activeContentId === 'string')
        && (
            record.contentFormat === null
            || record.contentFormat === undefined
            || (
                typeof record.contentFormat === 'object'
                && record.contentFormat !== null
                && typeof record.contentFormat.label === 'string'
                && typeof record.contentFormat.width === 'number'
                && typeof record.contentFormat.height === 'number'
            )
        )
        && (record.backgroundColor === undefined || record.backgroundColor === null || typeof record.backgroundColor === 'string')
        && typeof record.createdAt === 'string'
        && typeof record.updatedAt === 'string';
};

class Project {
    private _id: string;
    private _createdAt: Date;
    private _updatedAt: Date;

    name: string;
    activeTemplateId: string | null;
    activeContentId: string | null;
    contentFormat: ContentFormat | null;
    backgroundColor?: string | null;

    constructor(name: string, options?: { id?: string; createdAt?: Date; updatedAt?: Date; activeTemplateId?: string | null; activeContentId?: string | null; contentFormat?: ContentFormat | null; backgroundColor?: string | null }) {
        this._id = options?.id || self.crypto.randomUUID();
        this._createdAt = options?.createdAt || new Date();
        this._updatedAt = options?.updatedAt || new Date();
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
        this._updatedAt = new Date();
    }

    toJSON(): ProjectJSON {
        return {
            version: PROJECT_SCHEMA_VERSION,
            id: this._id,
            name: this.name,
            activeTemplateId: this.activeTemplateId,
            activeContentId: this.activeContentId,
            contentFormat: this.contentFormat ? { ...this.contentFormat } : null,
            backgroundColor: this.backgroundColor ?? null,
            createdAt: this._createdAt.toISOString(),
            updatedAt: this._updatedAt.toISOString(),
        };
    }

    static fromJSON(payload: unknown): Project {
        if (!isProjectJSON(payload)) {
            throw new Error('Invalid project payload');
        }

        return new Project(payload.name, {
            id: payload.id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            activeTemplateId: payload.activeTemplateId,
            activeContentId: payload.activeContentId,
            contentFormat: payload.contentFormat ? { ...payload.contentFormat } : null,
            backgroundColor: (payload as any).backgroundColor ?? null,
        });
    }
}

export type { ProjectField, FieldType, Location, FieldSize, FieldVisualStyle, Anchor, CoordinateUnit, ProjectJSON };
export { Project, createProjectField, createDefaultLocation, createDefaultSize, createDefaultFieldStyle, normalizeFieldStyle, normalizeProjectField, PROJECT_SCHEMA_VERSION };