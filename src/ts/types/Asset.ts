type AssetScope = 'project' | 'global';

interface AssetCrop {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface AssetJSON {
    version: number;
    id: string;
    name: string;
    mimeType: string;
    dataUrl: string;
    scope: AssetScope;
    crop: AssetCrop | null;
    createdAt: string;
    updatedAt: string;
}

const ASSET_SCHEMA_VERSION = 1;

const isAssetJSON = (payload: unknown): payload is AssetJSON => {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const record = payload as AssetJSON;
    return typeof record.version === 'number'
        && typeof record.id === 'string'
        && typeof record.name === 'string'
        && typeof record.mimeType === 'string'
        && typeof record.dataUrl === 'string'
        && (record.scope === 'project' || record.scope === 'global')
        && (record.crop === null || (
            typeof record.crop === 'object'
            && record.crop !== null
            && typeof record.crop.x === 'number'
            && typeof record.crop.y === 'number'
            && typeof record.crop.width === 'number'
            && typeof record.crop.height === 'number'
        ))
        && typeof record.createdAt === 'string'
        && typeof record.updatedAt === 'string';
};

const normalizeAssetCrop = (crop?: Partial<AssetCrop> | null): AssetCrop | null => {
    if (!crop) {
        return null;
    }

    return {
        x: Number.isFinite(crop.x) ? Number(crop.x) : 0,
        y: Number.isFinite(crop.y) ? Number(crop.y) : 0,
        width: Number.isFinite(crop.width) ? Number(crop.width) : 0,
        height: Number.isFinite(crop.height) ? Number(crop.height) : 0,
    };
};

class Asset {
    private _id: string;
    private _createdAt: Date;
    private _updatedAt: Date;

    name: string;
    mimeType: string;
    dataUrl: string;
    scope: AssetScope;
    crop: AssetCrop | null;

    constructor(name: string, mimeType: string, dataUrl: string, options?: { id?: string; createdAt?: Date; updatedAt?: Date; scope?: AssetScope; crop?: AssetCrop | null }) {
        this._id = options?.id || self.crypto.randomUUID();
        this._createdAt = options?.createdAt || new Date();
        this._updatedAt = options?.updatedAt || new Date();
        this.name = name;
        this.mimeType = mimeType;
        this.dataUrl = dataUrl;
        this.scope = options?.scope ?? 'project';
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

    setName(name: string) {
        this.name = name;
        this._updatedAt = new Date();
    }

    setScope(scope: AssetScope) {
        this.scope = scope;
        this._updatedAt = new Date();
    }

    setCrop(crop: AssetCrop | null) {
        this.crop = normalizeAssetCrop(crop);
        this._updatedAt = new Date();
    }

    isVector() {
        return this.mimeType === 'image/svg+xml';
    }

    toJSON(): AssetJSON {
        return {
            version: ASSET_SCHEMA_VERSION,
            id: this._id,
            name: this.name,
            mimeType: this.mimeType,
            dataUrl: this.dataUrl,
            scope: this.scope,
            crop: this.crop ? { ...this.crop } : null,
            createdAt: this._createdAt.toISOString(),
            updatedAt: this._updatedAt.toISOString(),
        };
    }

    static fromJSON(payload: unknown): Asset {
        if (!isAssetJSON(payload)) {
            throw new Error('Invalid asset payload');
        }

        return new Asset(payload.name, payload.mimeType, payload.dataUrl, {
            id: payload.id,
            createdAt: new Date(payload.createdAt),
            updatedAt: new Date(payload.updatedAt),
            scope: payload.scope,
            crop: payload.crop,
        });
    }

    static async fromFile(file: File, scope: AssetScope = 'project'): Promise<Asset> {
        const dataUrl = await fileToDataUrl(file);
        return new Asset(file.name, file.type || 'application/octet-stream', dataUrl, { scope });
    }
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

export type { AssetScope, AssetCrop, AssetJSON };
export { Asset, ASSET_SCHEMA_VERSION };