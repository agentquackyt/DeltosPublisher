import { type ProjectField } from "../types/Project.ts";

type FieldRect = {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
};

const normalizeFieldRect = (field: ProjectField, stageRect: DOMRect, designSize?: { width: number; height: number }): FieldRect => {
    // If the project stores absolute coordinates in design pixels (designSize),
    // convert those values to the stage CSS pixel space using a scale factor.
    const scaleX = designSize ? (stageRect.width / Math.max(1, designSize.width)) : 1;
    const scaleY = designSize ? (stageRect.height / Math.max(1, designSize.height)) : 1;

    const x = field.location.unit === 'percent'
        ? stageRect.width * (field.location.x / 100)
        : (designSize ? field.location.x * scaleX : field.location.x);

    const y = field.location.unit === 'percent'
        ? stageRect.height * (field.location.y / 100)
        : (designSize ? field.location.y * scaleY : field.location.y);

    const width = field.size.unit === 'percent'
        ? stageRect.width * (field.size.width / 100)
        : (designSize ? field.size.width * scaleX : field.size.width);

    const height = field.size.unit === 'percent'
        ? stageRect.height * (field.size.height / 100)
        : (designSize ? field.size.height * scaleY : field.size.height);

    return { x, y, width, height, rotation: field.rotation };
};

const applyRectToField = (field: ProjectField, rect: FieldRect, stageRect: DOMRect, designSize?: { width: number; height: number }) => {
    const nextLocationUnit = field.location.unit;
    const nextSizeUnit = field.size.unit;

    // If designSize is provided and units are absolute (px), convert back from stage CSS pixels
    const invScaleX = designSize ? (designSize.width / Math.max(1, stageRect.width)) : 1;
    const invScaleY = designSize ? (designSize.height / Math.max(1, stageRect.height)) : 1;

    field.location.x = nextLocationUnit === 'percent'
        ? (rect.x / stageRect.width) * 100
        : (designSize ? rect.x * invScaleX : rect.x);

    field.location.y = nextLocationUnit === 'percent'
        ? (rect.y / stageRect.height) * 100
        : (designSize ? rect.y * invScaleY : rect.y);

    field.size.width = nextSizeUnit === 'percent'
        ? (rect.width / stageRect.width) * 100
        : (designSize ? rect.width * invScaleX : rect.width);

    field.size.height = nextSizeUnit === 'percent'
        ? (rect.height / stageRect.height) * 100
        : (designSize ? rect.height * invScaleY : rect.height);

    field.rotation = rect.rotation;
};

const anchorToTranslate = (anchor: ProjectField['location']['anchor']) => {
    switch (anchor) {
        case 'center':
            return ['-50%', '-50%'];
        case 'top-right':
            return ['-100%', '0%'];
        case 'bottom-left':
            return ['0%', '-100%'];
        case 'bottom-right':
            return ['-100%', '-100%'];
        default:
            return ['0%', '0%'];
    }
};

const snapRotation = (degrees: number, step: number) => {
    const normalized = ((degrees % 360) + 360) % 360;
    return Math.round(normalized / step) * step;
};

export type { FieldRect };
export { normalizeFieldRect, applyRectToField, anchorToTranslate, snapRotation };