import { getJSON, setJSON, storage, idbGet, idbSet } from "../storage/browserStorage.ts";
import { createProjectField, Project } from "../types/Project.ts";
import { Content, type ContentJSON } from "../types/Content.ts";
import { Asset, type AssetJSON } from "../types/Asset.ts";
import { Template, type TemplateJSON } from "../types/Template.ts";
import { type AppState } from "./GlobalState.ts";
import { getDefaultContentFormat } from "../config/ContentFormat.ts";

export interface ProjectIndexRecord {
    id: string;
    name: string;
    updatedAt: string;
}

const GLOBAL_KEYS = {
    projectsIndex: 'publisher.projects_index',
    lastActiveId: 'publisher.lastActiveProjectId',
    globalAssets: 'publisher.global_assets',
};

const getProjectKeys = (projectId: string) => ({
    project: `publisher.projects.${projectId}.project`,
    templates: `publisher.projects.${projectId}.templates`,
    contents: `publisher.projects.${projectId}.contents`,
    assets: `publisher.projects.${projectId}.assets`,
});

const listProjects = (): ProjectIndexRecord[] => {
    return getJSON<ProjectIndexRecord[]>(GLOBAL_KEYS.projectsIndex) ?? [];
};

const saveProjectToIndex = (project: Project) => {
    const list = listProjects();
    const existing = list.findIndex(p => p.id === project.id);
    const record: ProjectIndexRecord = {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt.toISOString(),
    };
    if (existing >= 0) {
        list[existing] = record;
    } else {
        list.push(record);
    }
    // Sort descending by update
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setJSON(GLOBAL_KEYS.projectsIndex, list);
};

const migrateLegacyStorage = (): string | null => {
    const legacyProject = getJSON<{ id: string, name: string }>('publisher.project');
    if (!legacyProject) return null;

    const projectId = legacyProject.id || self.crypto.randomUUID();
    const keys = getProjectKeys(projectId);

    setJSON(keys.project, legacyProject);
    setJSON(keys.templates, getJSON('publisher.templates'));
    setJSON(keys.contents, getJSON('publisher.contents'));
    // Legacy assets were global in older versions — migrate into global assets key
    setJSON(GLOBAL_KEYS.globalAssets, getJSON('publisher.assets'));

    // Clear legacy
    storage.removeItem('publisher.project');
    storage.removeItem('publisher.templates');
    storage.removeItem('publisher.contents');
    storage.removeItem('publisher.assets');

    // Register to index
    const list = listProjects();
    list.push({
        id: projectId,
        name: legacyProject.name || 'Migrated Project',
        updatedAt: new Date().toISOString()
    });
    setJSON(GLOBAL_KEYS.projectsIndex, list);

    return projectId;
};

const getActiveProjectId = (): string => {
    let activeId = getJSON<string>(GLOBAL_KEYS.lastActiveId);
    
    // Check if migration is needed
    if (!activeId) {
        activeId = migrateLegacyStorage();
    }

    // Still no active ID? Maybe no projects exist or just index loaded
    if (!activeId) {
        const list = listProjects();
        if (list.length > 0) {
            activeId = list[0].id; // Give last inserted project
        } else {
            // Nothing left, need a new project
            const newProject = new Project('Untitled Project');
            saveProjectToIndex(newProject);
            activeId = newProject.id;
        }
    }

    setJSON(GLOBAL_KEYS.lastActiveId, activeId);
    return activeId!;
};

const setActiveProject = (projectId: string) => {
    setJSON(GLOBAL_KEYS.lastActiveId, projectId);
};

const createNewProject = (name: string): string => {
    const project = new Project(name);
    saveProjectToIndex(project);
    return project.id;
};

const loadTemplates = (projectId: string) => {
    const keys = getProjectKeys(projectId);
    const payload = getJSON<TemplateJSON[]>(keys.templates);
    if (!payload) return [];
    try {
        return payload.map(template => Template.fromJSON(template));
    } catch {
        return [];
    }
};

const loadContents = (projectId: string) => {
    const keys = getProjectKeys(projectId);
    const payload = getJSON<ContentJSON[]>(keys.contents);
    if (!payload) return [];
    try {
        return payload.map(content => Content.fromJSON(content));
    } catch {
        return [];
    }
};

const loadAssets = async (projectId: string) => {
    const keys = getProjectKeys(projectId);
    
    // First try IDB, fallback to local storage for backward compatibility
    let projectPayload = await idbGet<AssetJSON[]>(keys.assets);
    if (!projectPayload) {
        projectPayload = getJSON<AssetJSON[]>(keys.assets) ?? [];
    }

    let globalPayload = await idbGet<AssetJSON[]>(GLOBAL_KEYS.globalAssets);
    if (!globalPayload) {
        globalPayload = getJSON<AssetJSON[]>(GLOBAL_KEYS.globalAssets) ?? [];
    }

    const result: Asset[] = [];

    try {
        for (const p of projectPayload) {
            result.push(Asset.fromJSON(p));
        }
    } catch {
        // ignore project asset parse errors
    }

    try {
        for (const g of globalPayload) {
            // Avoid duplicates by id (project assets take precedence)
            if (!result.find(a => a.id === g.id)) {
                result.push(Asset.fromJSON(g));
            }
        }
    } catch {
        // ignore global asset parse errors
    }

    return result;
};

const loadProject = (projectId: string) => {
    const keys = getProjectKeys(projectId);
    const payload = getJSON(keys.project);
    if (!payload) {
        const proj = new Project('Untitled Project');
        // Override the ID so we don't mint a new one randomly, keep it synced with projectId
        return new Project('Untitled Project', { id: projectId }); 
    }
    try {
        return Project.fromJSON(payload);
    } catch {
        return new Project('Untitled Project', { id: projectId });
    }
};

const ensureSeedTemplate = (templates: Template[], contents: Content[], project: Project) => {
    if (!project.contentFormat) {
        project.contentFormat = getDefaultContentFormat();
        project.touch();
    }

    if (templates.length > 0 && contents.length > 0) {
        return { templates, contents, project };
    }

    const seededTemplate = new Template(project.name + ' Template');
    project.backgroundColor = '#fff';
    seededTemplate.description = 'Default template for first-time editing.';
    seededTemplate.addField(createProjectField('text', 'Headline', {
        location: { x: 200, y: 200, anchor: 'top-left', unit: 'px' },
        size: { width: 260, height: 150, unit: 'px' },
        style: {
            padding: 10,
            color: '#000',
            backgroundColor: 'transparent',
            fontFamily: 'Arial, sans-serif',
            fontSize: 25,
            fontWeight: 'bold',
            textAlign: 'left',
        }
    }));

    const seededContent = new Content(project.name + ' Content', seededTemplate.id);

    const nextTemplates = templates.length > 0 ? templates : [seededTemplate];
    const nextContents = contents.length > 0 ? contents : [seededContent];

    project.activeTemplateId = nextTemplates[0].id;
    project.activeContentId = nextContents[0].id;
    project.touch();

    return { templates: nextTemplates, contents: nextContents, project };
};

const listTemplates = (projectId: string): TemplateJSON[] => {
    const keys = getProjectKeys(projectId);
    return getJSON<TemplateJSON[]>(keys.templates) ?? [];
};

const saveTemplate = (projectId: string, template: Template) => {
    const keys = getProjectKeys(projectId);
    const items = listTemplates(projectId);
    const next = items.filter(t => t.id !== template.id);
    next.push(template.toJSON());
    setJSON(keys.templates, next);
};

const loadTemplate = (projectId: string, id: string): Template | null => {
    const items = listTemplates(projectId);
    const found = items.find(t => t.id === id);
    if (!found) return null;
    try {
        return Template.fromJSON(found);
    } catch {
        return null;
    }
};

const deleteTemplate = (projectId: string, id: string) => {
    const keys = getProjectKeys(projectId);
    const items = listTemplates(projectId);
    const next = items.filter(t => t.id !== id);
    setJSON(keys.templates, next);
    return items.length !== next.length;
};

const persistState = async (state: AppState) => {
    const keys = getProjectKeys(state.project.id);
    setJSON(keys.project, state.project.toJSON());
    setJSON(keys.templates, state.templates.map(template => template.toJSON()));
    setJSON(keys.contents, state.contents.map(content => content.toJSON()));

    // Split assets by scope: project-scoped assets live with the project, global assets are stored globally
    const projectAssets = state.assets.filter(a => a.scope === 'project').map(a => a.toJSON());
    const globalAssets = state.assets.filter(a => a.scope === 'global').map(a => a.toJSON());

    // Save to IDB
    await idbSet(keys.assets, projectAssets);
    await idbSet(GLOBAL_KEYS.globalAssets, globalAssets);
    
    // Clear from localStorage to free up quota
    storage.removeItem(keys.assets);
    storage.removeItem(GLOBAL_KEYS.globalAssets);

    saveProjectToIndex(state.project);
};

export { 
    listProjects, getActiveProjectId, setActiveProject, createNewProject,
    loadTemplates, loadContents, loadAssets, loadProject, ensureSeedTemplate, 
    persistState, listTemplates, saveTemplate, loadTemplate, deleteTemplate 
};
