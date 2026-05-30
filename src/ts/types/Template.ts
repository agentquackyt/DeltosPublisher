import { ProjectField } from "./Project";

class Template {
    private _id: string;
    private fields: ProjectField[] = [];

    description: string = '';
    thumbnail: string = '';

    constructor(public name: string, id?: string) {
        this._id = id || self.crypto.randomUUID();
        this.fields = [];
    }

    setFields(fields: ProjectField[]) {
        this.fields = fields;
    }
    
    addField(field: ProjectField) {
        this.fields.push(field);
    }

    removeField(fieldId: string) {
        this.fields = this.fields.filter(field => field.id !== fieldId);
    }


    static async fromFile(file: File): Promise<Template> {
        //!TODO: Implement this method
        return new Template(''); //! Placeholder return statement
    }

    static fromMemory(id: string): Template {
        //!TODO: Implement this method
        return new Template(''); //! Placeholder return statement
    }
}