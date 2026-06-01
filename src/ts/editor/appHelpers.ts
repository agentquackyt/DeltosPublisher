import { type AppState } from "./GlobalState.ts";
import { type ProjectField } from "../types/Project.ts";
import { Asset } from "../types/Asset.ts";

const getActiveTemplate = (state: AppState) => {
    return state.templates.find(template => template.id === state.project.activeTemplateId) || null;
};

const getActiveContent = (state: AppState) => {
    return state.contents.find(content => content.id === state.project.activeContentId) || null;
};

const getFieldValue = (state: AppState, fieldId: string) => {
    const content = getActiveContent(state);
    return content?.getValue(fieldId) || '';
};

const getActiveAsset = (state: AppState, assetId: string) => {
    return state.assets.find(asset => asset.id === assetId) || null;
};

const updateTemplateField = (state: AppState, fieldId: string, updater: (field: ProjectField) => void): AppState => {
    const template = getActiveTemplate(state);
    if (!template) {
        return state;
    }

    const nextFields = template.getFields().map(field => {
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
        templates: state.templates.map(item => (item.id === template.id ? template : item)),
    };
};

const moveTemplateField = (state: AppState, fieldId: string, direction: 'front' | 'back'): AppState => {
    const template = getActiveTemplate(state);
    if (!template) {
        return state;
    }

    const fields = template.getFields();
    const index = fields.findIndex(field => field.id === fieldId);
    if (index < 0) {
        return state;
    }

    const [field] = fields.splice(index, 1);
    if (!field) {
        return state;
    }

    if (direction === 'front') {
        fields.push(field);
    } else {
        fields.unshift(field);
    }

    template.setFields(fields);
    return {
        ...state,
        templates: state.templates.map(item => (item.id === template.id ? template : item)),
    };
};

const updateContentValue = (state: AppState, fieldId: string, value: string): AppState => {
    const content = getActiveContent(state);
    if (!content) {
        return state;
    }

    content.setValue(fieldId, value);

    return {
        ...state,
        contents: state.contents.map(item => (item.id === content.id ? content : item)),
    };
};

const updateAsset = (state: AppState, assetId: string, updater: (asset: Asset) => void): AppState => {
    const nextAssets = state.assets.map(asset => {
        if (asset.id !== assetId) {
            return asset;
        }

        const nextAsset = new Asset(asset.name, asset.mimeType, asset.dataUrl, {
            id: asset.id,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
            scope: asset.scope,
            crop: asset.crop,
        });
        updater(nextAsset);
        return nextAsset;
    });

    return {
        ...state,
        assets: nextAssets,
    };
};

const escapeAttribute = (value: string) => {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const addTemplateToState = (state: AppState, template: any): AppState => {
    return {
        ...state,
        templates: [...state.templates, template],
    };
};

const removeTemplateFromState = (state: AppState, templateId: string): AppState => {
    const remaining = state.templates.filter(t => t.id !== templateId);

    // If active template was removed, pick a fallback
    let activeTemplateId: string = state.project.activeTemplateId ?? '';
    if (activeTemplateId === templateId) {
        activeTemplateId = remaining.length > 0 ? remaining[0].id : '';
    }

    const nextContents = state.contents.map(c => {
        if (c.templateId === templateId) {
            c.templateId = activeTemplateId;
        }
        return c;
    });

    const nextProject = state.project;
    nextProject.activeTemplateId = activeTemplateId || null;

    return {
        ...state,
        templates: remaining,
        contents: nextContents,
        project: nextProject,
    };
};

export { getActiveTemplate, getActiveContent, getActiveAsset, getFieldValue, updateTemplateField, moveTemplateField, updateContentValue, updateAsset, escapeAttribute, addTemplateToState, removeTemplateFromState };