import { ProjectField, normalizeProjectField } from "./Project.ts";
import { getJSON } from "../storage/browserStorage.ts";

interface TemplateJSON {
    version: number;
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    fields: ProjectField[];
}

const TEMPLATE_SCHEMA_VERSION = 1;

const isTemplateJSON = (payload: unknown): payload is TemplateJSON => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const record = payload as TemplateJSON;
    return typeof record.version === 'number'
        && typeof record.id === 'string'
        && typeof record.name === 'string'
        && typeof record.description === 'string'
        && typeof record.thumbnail === 'string'
        && Array.isArray(record.fields);
};

class Template {
    private _id: string;
    private fields: ProjectField[] = [];

    description: string = '';
    thumbnail: string = '';

    constructor(public name: string, id?: string) {
        this._id = id || self.crypto.randomUUID();
        this.fields = [];
    }

    get id() {
        return this._id;
    }

    setFields(fields: ProjectField[]) {
        this.fields = fields.map(field => normalizeProjectField(field));
    }

    getFields() {
        return [...this.fields];
    }
    
    addField(field: ProjectField) {
        this.fields.push(normalizeProjectField(field));
    }

    removeField(fieldId: string) {
        this.fields = this.fields.filter(field => field.id !== fieldId);
    }

    static async fromFile(file: File): Promise<Template> {
        const text = await file.text();
        const payload = JSON.parse(text) as unknown;
        return Template.fromJSON(payload);
    }

    static fromMemory(id: string): Template {
        const payload = getJSON<TemplateJSON[]>('publisher.templates');
        if (!payload) {
            throw new Error(`Template ${id} not found in memory`);
        }

        const found = payload.find(item => item.id === id);
        if (!found) {
            throw new Error(`Template ${id} not found in memory`);
        }

        return Template.fromJSON(found);
    }

    toJSON(): TemplateJSON {
        return {
            version: TEMPLATE_SCHEMA_VERSION,
            id: this._id,
            name: this.name,
            description: this.description,
            thumbnail: this.thumbnail,
            fields: [...this.fields],
        };
    }

    static fromJSON(payload: unknown): Template {
        if (!isTemplateJSON(payload)) {
            throw new Error('Invalid template payload');
        }

        const template = new Template(payload.name, payload.id);
        template.description = payload.description;
        template.thumbnail = payload.thumbnail;
        template.setFields(payload.fields);
        return template;
    }
}

export type { TemplateJSON };
export { Template, TEMPLATE_SCHEMA_VERSION };