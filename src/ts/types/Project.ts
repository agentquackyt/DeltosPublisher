type FieldType = 'text' | 'decoration' | 'image';

interface Location {
    x: number;
    y: number;
    anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

interface FieldSize {
    width: number;
    height: number;
}

interface ProjectField {
    id: string;
    type: FieldType;
    value: string;
    location: Location;
    size: FieldSize;
}



class Project {
    private _id: string;
    private _fields: ProjectField[];

    constructor(id?: string) {
        this._id = id || self.crypto.randomUUID();
        this._fields = [];
    }
}


export type { ProjectField, FieldType, Location, FieldSize };
export { Project };