interface ContentValue {
    fieldId: string;
    value: string;
}

interface ContentJSON {
    version: number;
    id: string;
    name: string;
    templateId: string;
    values: ContentValue[];
    createdAt: string;
    updatedAt: string;
}

const CONTENT_SCHEMA_VERSION = 1;

const isContentJSON = (payload: unknown): payload is ContentJSON => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const record = payload as ContentJSON;
    return typeof record.version === 'number'
        && typeof record.id === 'string'
        && typeof record.name === 'string'
        && typeof record.templateId === 'string'
        && Array.isArray(record.values)
        && typeof record.createdAt === 'string'
        && typeof record.updatedAt === 'string';
};

class Content {
    private _id: string;
    private _createdAt: Date;
    private _updatedAt: Date;
    private _values: ContentValue[];

    name: string;
    templateId: string;

    constructor(name: string, templateId: string, options?: { id?: string; createdAt?: Date; updatedAt?: Date; values?: ContentValue[]; }) {
        this._id = options?.id || self.crypto.randomUUID();
        this._createdAt = options?.createdAt || new Date();
        this._updatedAt = options?.updatedAt || new Date();
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

    getValue(fieldId: string) {
        return this._values.find(value => value.fieldId === fieldId)?.value || '';
    }

    setValue(fieldId: string, value: string) {
        const existing = this._values.find(entry => entry.fieldId === fieldId);
        if (existing) {
            existing.value = value;
        } else {
            this._values.push({ fieldId, value });
        }
        this._updatedAt = new Date();
    }

    removeValue(fieldId: string) {
        this._values = this._values.filter(entry => entry.fieldId !== fieldId);
        this._updatedAt = new Date();
    }

    toJSON(): ContentJSON {
        return {
            version: CONTENT_SCHEMA_VERSION,
            id: this._id,
            name: this.name,
            templateId: this.templateId,
            values: [...this._values],
            createdAt: this._createdAt.toISOString(),
            updatedAt: this._updatedAt.toISOString(),
        };
    }

    static fromJSON(payload: unknown): Content {
        if (!isContentJSON(payload)) {
            throw new Error('Invalid content payload');
        }

        return new Content(payload.name, payload.templateId, {
            id: payload.id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            values: payload.values,
        });
    }
}

export type { ContentValue, ContentJSON };
export { Content, CONTENT_SCHEMA_VERSION };
