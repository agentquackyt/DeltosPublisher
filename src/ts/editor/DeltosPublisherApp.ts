import { GlobalState, type AppState } from "./GlobalState.ts";
import { KeybindManager } from "./KeybindManager.ts";
import { createProjectField, createDefaultFieldStyle, normalizeFieldStyle, type ProjectField } from "../types/Project.ts";
import { applyRectToField, anchorToTranslate, normalizeFieldRect, snapRotation, type FieldRect } from "./appGeometry.ts";
import { ensureSeedTemplate, loadAssets, loadContents, loadProject, loadTemplates, persistState, saveTemplate, loadTemplate, deleteTemplate, getActiveProjectId, listProjects, createNewProject, setActiveProject } from "./appPersistence.ts";
import { escapeAttribute, getActiveContent, getActiveTemplate, getFieldValue, moveTemplateField, updateAsset, updateContentValue, updateTemplateField } from "./appHelpers.ts";
import { addTemplateToState, getActiveAsset } from "./appHelpers.ts";
import Modal from "./ModalManager.ts";
import { ContentFormats, findContentFormatByLabel, getDefaultContentFormat, type ContentFormat } from "../config/ContentFormat.ts";
import { Asset, type AssetScope } from "../types/Asset.ts";
import { Content } from "../types/Content.ts";
import { Project } from "../types/Project.ts";
import { Template } from "../types/Template.ts";
import CanvasRenderer from "../export/CanvasRenderer.ts";

type InteractionMode = 'move' | 'resize' | 'rotate' | null;

type InteractionState = {
    fieldId: string;
    mode: InteractionMode;
    handle: string | null;
    originPointer: { x: number; y: number };
    originRect: FieldRect;
    originAngle: number;
    originRotation: number;
};

const MOVE_SNAP_GRID_SIZE = 10;
const RESIZE_SNAP_GRID_SIZE = 10;

class DeltosPublisherApp {
    private static instance: DeltosPublisherApp | null = null;

    private static readonly HISTORY_STORAGE_PREFIX = 'publisher.history.snapshot';

    private store: GlobalState | null = null;
    private stage: HTMLDivElement | null = null;
    private selectionPanel: HTMLDivElement | null = null;
    private selectionDetails: HTMLDivElement | null = null;
    private asideDesign: HTMLDivElement | null = null;
    private asideContent: HTMLDivElement | null = null;
    private asideHead: HTMLDivElement | null = null;
    private asideElement: HTMLElement | null = null;
    private isAsideOpen = true;
    private contentFieldsList: HTMLDivElement | null = null;
    private addTextFieldButton: HTMLButtonElement | null = null;
    private addDecorationFieldButton: HTMLButtonElement | null = null;
    private addImageFieldButton: HTMLButtonElement | null = null;
    private templatePanel: HTMLDivElement | null = null;
    private appWrapper: HTMLDivElement | null = null;
    private additionalPanel: HTMLDivElement | null = null;
    private additionalPanelMode: 'templates' | 'assets' | null = null;
    private activeInteraction: InteractionState | null = null;
    private stageResizeFrame: number | null = null;

    private constructor() { }

    static getInstance() {
        if (!DeltosPublisherApp.instance) {
            DeltosPublisherApp.instance = new DeltosPublisherApp();
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
        window.addEventListener('beforeunload', () => {
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

    private resolveDom() {
        this.stage = document.querySelector<HTMLDivElement>("#editor-stage");
        this.selectionPanel = document.querySelector<HTMLDivElement>("#selection-panel");
        this.selectionDetails = document.querySelector<HTMLDivElement>(".selection-details");
        this.asideDesign = document.querySelector<HTMLDivElement>("#aside-design");
        this.asideContent = document.querySelector<HTMLDivElement>("#aside-content");
        this.asideHead = document.querySelector<HTMLDivElement>(".aside-head");
        this.asideElement = document.querySelector<HTMLElement>("aside");
        this.contentFieldsList = document.querySelector<HTMLDivElement>("#content-fields-list");
        this.addTextFieldButton = document.querySelector<HTMLButtonElement>("[data-field-action=add-text]");
        this.addDecorationFieldButton = document.querySelector<HTMLButtonElement>("[data-field-action=add-decoration]");
        this.addImageFieldButton = document.querySelector<HTMLButtonElement>("[data-field-action=add-image]");
        this.templatePanel = document.querySelector<HTMLDivElement>('#additional-wrapper');
        this.appWrapper = document.querySelector<HTMLDivElement>('#app-wrapper');
        this.additionalPanel = document.querySelector<HTMLDivElement>('#additional-panel');

        if (!this.stage) {
            throw new Error('Editor stage not found');
        }
    }

    private async bootstrap() {
        const projectId = getActiveProjectId();
        const templates = loadTemplates(projectId);
        const contents = loadContents(projectId);
        const project = loadProject(projectId);
        const seeded = ensureSeedTemplate(templates, contents, project);

        const initialState: AppState = {
            project: seeded.project,
            templates: seeded.templates,
            contents: seeded.contents,
            assets: await loadAssets(projectId),
            selection: { fieldId: null },
            mode: 'design',
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

    private async loadProjectIntoState(projectId: string) {
        if (!this.store) return;
        
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
            mode: 'design',
        });
    }

    private getProjectSelectionOptions() {
        const projects = listProjects();
        const optionMap = new Map<string, string>();
        const options = projects.map(project => {
            const optionLabel = `${project.name || 'Untitled Project'} (${project.id.slice(0, 8)})`;
            optionMap.set(optionLabel, project.id);
            return optionLabel;
        });

        return { options, optionMap };
    }

    private promptProjectManager() {
        const { options, optionMap } = this.getProjectSelectionOptions();
        const createOption = 'Create new project...';
        const loadOption = 'Load project...';
        const currentProject = this.store?.getState().project;
        const currentLabel = currentProject
            ? `${currentProject.name || 'Untitled Project'} (${currentProject.id.slice(0, 8)})`
            : undefined;

        const modal = new Modal('Project Manager', 'Pick a project to open or create a new one.', 'Open');
        modal.addSelectField('Project', [...options, createOption, loadOption], currentLabel ?? createOption, true);

        modal.show().then(result => {
            if (!result) {
                return;
            }

            const selectedLabel = String(result['Project'] || '').trim();
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

    private promptLoadProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.remove();
            if (!file) {
                return;
            }

            try {
                const bundle = JSON.parse(await file.text()) as unknown;
                this.importProjectBundleWithConflict(bundle);
            } catch (err) {
                console.error('Failed to import project', err);
            }
        });

        input.click();
    }

    private promptCreateProject() {
        const modal = new Modal('New Project', 'Choose a name for the new project.', 'Create');
        modal.addTextField('Project Name', 'Untitled Project', true);

        modal.show().then(result => {
            const projectName = String(result?.['Project Name'] || '').trim();
            if (!projectName) {
                return;
            }

            const newId = createNewProject(projectName);
            this.loadProjectIntoState(newId);
        });
    }

    private get stageElement() {
        if (!this.stage) {
            throw new Error('Editor stage not initialized');
        }

        return this.stage;
    }

    private getActiveTemplate(state: AppState) {
        return getActiveTemplate(state);
    }

    private getActiveContent(state: AppState) {
        return getActiveContent(state);
    }

    private getFieldValue(state: AppState, fieldId: string) {
        return getFieldValue(state, fieldId);
    }

    private getAssetById(state: AppState, assetId: string) {
        return getActiveAsset(state, assetId);
    }

    private updateAsset(state: AppState, assetId: string, updater: Parameters<typeof updateAsset>[2]) {
        return updateAsset(state, assetId, updater);
    }

    private renderFieldInput(label: string, inputMarkup: string) {
        return `
            <label class="field">
                <span>${label}</span>
                ${inputMarkup}
            </label>
        `;
    }

    private renderFieldSelect(label: string, selectMarkup: string) {
        return `
            <label class="field">
                <span>${label}</span>
                ${selectMarkup}
            </label>
        `;
    }

    private renderAssetPreview(asset: Asset) {
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

    private renderDecorationAssetPreview(asset: Asset | null) {
        if (!asset) {
            return '<span class="field-image-placeholder">No image selected</span>';
        }

        return `<div class="decoration-asset-preview">${this.renderAssetPreview(asset)}</div>`;
    }

    private renderColorField(label: string, fieldProp: 'color' | 'backgroundColor', value: string, fallback: string) {
        const pickerValue = this.resolveColorPickerValue(value, fallback);
        return `
            <label class="field color-field">
                <span>${label}</span>
                <input type="color" data-field-prop="${fieldProp}" data-color-role="picker" value="${escapeAttribute(pickerValue)}" />
                <input type="text" data-field-prop="${fieldProp}" data-color-role="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(fallback)}" />
            </label>
        `;
    }

    private resolveColorPickerValue(value: string, fallback: string) {
        const trimmed = value.trim();

        if (/^#[0-9a-f]{6}$/i.test(trimmed) || /^#[0-9a-f]{3}$/i.test(trimmed)) {
            return trimmed;
        }

        const rgbMatch = trimmed.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
        if (rgbMatch) {
            const toHex = (component: string) => Number(component || 0).toString(16).padStart(2, '0');
            return `#${toHex(rgbMatch[1] || '0')}${toHex(rgbMatch[2] || '0')}${toHex(rgbMatch[3] || '0')}`;
        }

        if (/^#[0-9a-f]{6}$/i.test(fallback) || /^#[0-9a-f]{3}$/i.test(fallback)) {
            return fallback;
        }

        return '#111111';
    }

    private render(state: AppState) {
        const root = this.stageElement;
        root.innerHTML = '';

        const template = this.getActiveTemplate(state);
        const content = this.getActiveContent(state);

        if (!template) {
            return;
        }

        const stageRect = root.getBoundingClientRect();
        const format = state.project.contentFormat || getDefaultContentFormat();
        const fields = template.getFields();

        fields.forEach(field => {
            const rect = normalizeFieldRect(field, stageRect, { width: format.width, height: format.height });
            const fieldElement = document.createElement('div');
            fieldElement.className = 'editor-field';
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

            if (state.mode === 'content') {
                fieldElement.style.pointerEvents = 'none';
            } else if (state.selection.fieldId === field.id) {
                fieldElement.classList.add('is-selected');
                this.appendHandles(fieldElement);
            }

            const fieldContent = document.createElement('div');
            fieldContent.className = 'field-content';
            fieldContent.style.color = visualStyle.color;
            fieldContent.style.fontFamily = visualStyle.fontFamily;
            // Scale font size from design pixels to stage CSS pixels so preview matches export
            const stageRectForScale = root.getBoundingClientRect();
            const scaleForFont = Math.max(0.0001, stageRectForScale.width / Math.max(1, format.width));
            fieldContent.style.fontSize = `${Math.max(1, Math.round(visualStyle.fontSize * scaleForFont))}px`;
            fieldContent.style.fontWeight = visualStyle.fontWeight;
            fieldContent.style.textAlign = visualStyle.textAlign;
            const contentValue = content?.getValue(field.id) || '';

            if (field.type === 'image') {
                const asset = contentValue ? this.getAssetById(state, contentValue) : null;
                if (!asset) {
                    fieldContent.innerHTML = '<span class="field-image-placeholder">Choose image content</span>';
                } else {
                    const image = document.createElement('img');
                    image.alt = asset.name;
                    image.src = asset.dataUrl;
                    image.className = 'field-image';

                    if (asset.crop) {
                        const crop = asset.crop;
                        const frame = document.createElement('div');
                        frame.className = 'asset-crop-frame';
                        frame.style.width = `${Math.max(1, Math.round(crop.width))}px`;
                        frame.style.height = `${Math.max(1, Math.round(crop.height))}px`;
                        frame.style.overflow = 'hidden';
                        frame.style.position = 'relative';
                        image.style.position = 'absolute';
                        image.style.left = `-${Math.max(0, Math.round(crop.x))}px`;
                        image.style.top = `-${Math.max(0, Math.round(crop.y))}px`;
                        image.style.maxWidth = 'none';
                        image.style.maxHeight = 'none';
                        frame.append(image);
                        fieldContent.append(frame);
                    } else {
                        fieldContent.append(image);
                    }
                }
            } else if (field.type === 'decoration') {
                const asset = field.imageAssetId ? this.getAssetById(state, field.imageAssetId) : null;
                if (asset) {
                    fieldContent.innerHTML = this.renderDecorationAssetPreview(asset);
                } else {
                    fieldContent.textContent = contentValue || 'Decoration';
                }
            } else {
                fieldContent.textContent = contentValue || 'Text';
            }

            fieldElement.append(fieldContent);
            root.append(fieldElement);
        });
    }

    private appendHandles(fieldElement: HTMLElement) {
        ['nw', 'ne', 'sw', 'se'].forEach(handle => {
            const node = document.createElement('span');
            node.className = 'editor-handle';
            node.dataset.handle = handle;
            fieldElement.append(node);
        });

        const rotateHandle = document.createElement('span');
        rotateHandle.className = 'editor-handle rotate';
        rotateHandle.dataset.handle = 'rotate';
        fieldElement.append(rotateHandle);
    }

    private updateSelectionPanel(state: AppState) {
        if (!this.selectionPanel || !this.selectionDetails) {
            return;
        }

        const template = this.getActiveTemplate(state);
        const selected = template?.getFields().find(field => field.id === state.selection.fieldId) || null;

        if (!selected) {
            this.selectionPanel.hidden = true;
            this.selectionDetails.textContent = '';
            delete this.selectionDetails.dataset.renderedId;
            return;
        }

        this.selectionPanel.hidden = false;
        const value = selected.value;
        const visualStyle = normalizeFieldStyle(selected.style);

        if (this.selectionDetails.dataset.renderedId === selected.id) {
            const inputs = this.selectionDetails.querySelectorAll('input, select');
            inputs.forEach(input => {
                const el = input as HTMLInputElement | HTMLSelectElement;
                if (document.activeElement === el) {
                    return;
                }

                const prop = el.dataset.fieldProp;
                if (prop === 'value') el.value = value;
                else if (prop === 'x') el.value = String(Math.round(selected.location.x));
                else if (prop === 'y') el.value = String(Math.round(selected.location.y));
                else if (prop === 'width') el.value = String(Math.round(selected.size.width));
                else if (prop === 'height') el.value = String(Math.round(selected.size.height));
                else if (prop === 'rotation') el.value = String(Math.round(selected.rotation));
                else if (prop === 'anchor') el.value = selected.location.anchor;
                else if (prop === 'padding') el.value = String(Math.round(visualStyle.padding));
                else if (prop === 'color' || prop === 'backgroundColor') {
                    const colorInput = el as HTMLInputElement;
                    const fieldRow = colorInput.closest('.color-field');
                    if (!fieldRow) {
                        colorInput.value = prop === 'color' ? visualStyle.color : visualStyle.backgroundColor;
                        return;
                    }

                    const picker = fieldRow.querySelector<HTMLInputElement>('input[type="color"][data-color-role="picker"]');
                    const text = fieldRow.querySelector<HTMLInputElement>('input[type="text"][data-color-role="text"]');
                    const currentValue = prop === 'color' ? visualStyle.color : visualStyle.backgroundColor;

                    if (picker) {
                        picker.value = this.resolveColorPickerValue(currentValue, '#111111');
                    }

                    if (text) {
                        text.value = currentValue;
                    }
                }
                else if (prop === 'fontFamily') el.value = visualStyle.fontFamily;
                else if (prop === 'fontSize') el.value = String(Math.round(visualStyle.fontSize));
                else if (prop === 'fontWeight') el.value = visualStyle.fontWeight;
                else if (prop === 'textAlign') el.value = visualStyle.textAlign;
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
                        ${this.renderFieldInput('Name', `<input type="text" data-field-prop="value" value="${escapeAttribute(value)}" />`)}
                    </div>
                </div>

                <div class="property-row">
                    ${this.renderFieldInput('X', `<input type="number" data-field-prop="x" value="${Math.round(selected.location.x)}" />`)}
                    ${this.renderFieldInput('Y', `<input type="number" data-field-prop="y" value="${Math.round(selected.location.y)}" />`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput('Width', `<input type="number" data-field-prop="width" value="${Math.round(selected.size.width)}" />`)}
                    ${this.renderFieldInput('Height', `<input type="number" data-field-prop="height" value="${Math.round(selected.size.height)}" />`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput('Rotation', `<input type="number" data-field-prop="rotation" value="${Math.round(selected.rotation)}" />`)}
                    ${this.renderFieldSelect('Anchor', `<select data-field-prop="anchor">
                        ${['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
                .map(anchor => `<option value="${anchor}" ${anchor === selected.location.anchor ? 'selected' : ''}>${anchor}</option>`)
                .join('')}
                    </select>`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput('Padding', `<input type="number" min="0" data-field-prop="padding" value="${Math.round(visualStyle.padding)}" />`)}
                    ${this.renderFieldSelect('Text Align', `<select data-field-prop="textAlign">
                        ${['left', 'center', 'right']
                .map(item => `<option value="${item}" ${item === visualStyle.textAlign ? 'selected' : ''}>${item}</option>`)
                .join('')}
                    </select>`)}
                </div>

                <div class="property-row">
                    ${this.renderColorField('Color', 'color', visualStyle.color, '#111111')}
                    ${this.renderColorField('Background', 'backgroundColor', visualStyle.backgroundColor, '#111111')}
                </div>

                <div class="property-row">
                    ${this.renderFieldInput('Font', `<input type="text" data-field-prop="fontFamily" value="${escapeAttribute(visualStyle.fontFamily)}" />`)}
                    ${this.renderFieldInput('Font Size', `<input type="number" min="1" data-field-prop="fontSize" value="${Math.round(visualStyle.fontSize)}" />`)}
                </div>

                <div class="property-row">
                    ${this.renderFieldSelect('Font Weight', `<select data-field-prop="fontWeight">
                        ${['300', '400', '500', '600', '700', '800']
                .map(item => `<option value="${item}" ${item === visualStyle.fontWeight ? 'selected' : ''}>${item}</option>`)
                .join('')}
                    </select>`)}
                    <div class="property-item"></div>
                </div>

                ${selected.type === 'decoration' ? `
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
                ` : ''}
            </div>
        `;
    }

    private updateAsidePanels(state: AppState) {
        if (this.asideElement) {
            this.asideElement.hidden = !this.isAsideOpen;
        }

        if (!this.isAsideOpen) {
            return;
        }

        if (this.asideDesign) {
            this.asideDesign.hidden = state.mode !== 'design';
        }

        if (this.asideContent) {
            this.asideContent.hidden = state.mode !== 'content';
        }

        if (this.asideHead) {
            this.asideHead.hidden = state.mode === 'content';
        }

        if (state.mode === 'content') {
            const template = this.getActiveTemplate(state);
            if (template && this.contentFieldsList) {
                if (this.contentFieldsList.dataset.renderedTemplateId === template.id) {
                    const inputs = this.contentFieldsList.querySelectorAll('input');
                    inputs.forEach(input => {
                        const el = input as HTMLInputElement;
                        if (document.activeElement === el) {
                            return;
                        }

                        const fieldId = el.dataset.contentFieldId;
                        if (!fieldId) {
                            return;
                        }

                        const field = template.getFields().find(f => f.id === fieldId);
                        if (field) {
                            const val = this.getFieldValue(state, field.id) || field.value;
                            el.value = val;
                        }
                    });

                    template.getFields().forEach(field => {
                        if (field.type !== 'image') {
                            return;
                        }

                        const row = this.contentFieldsList?.querySelector<HTMLElement>(`[data-content-field-id="${field.id}"]`);
                        if (!row) {
                            return;
                        }

                        const val = this.getFieldValue(state, field.id) || field.value;
                        const asset = this.getAssetById(state, val);
                        const preview = row.querySelector<HTMLElement>('.content-asset-preview');
                        const source = row.querySelector<HTMLElement>('.content-asset-source');

                        if (preview) {
                            preview.innerHTML = asset ? this.renderAssetPreview(asset) : '<span class="content-asset-empty">No image selected</span>';
                        }

                        if (source) {
                            source.textContent = asset ? asset.name : 'Choose from assets';
                        }
                    });
                    return;
                }

                this.contentFieldsList.dataset.renderedTemplateId = template.id;
                this.contentFieldsList.innerHTML = template.getFields()
                    .filter(f => f.type === 'text' || f.type === 'image')
                    .map(field => {
                        const val = this.getFieldValue(state, field.id) || '';
                        if (field.type === 'image') {
                            const asset = this.getAssetById(state, val);
                            return `
                                <div class="content-asset-row" data-content-field-id="${field.id}">
                                    <div class="content-asset-preview">${asset ? this.renderAssetPreview(asset) : '<span class="content-asset-empty">No image selected</span>'}</div>
                                    <div class="content-asset-meta">
                                        <div class="content-asset-name">${escapeAttribute(field.value || field.type.toUpperCase())}</div>
                                        <div class="content-asset-source">${asset ? escapeAttribute(asset.name) : 'Choose from assets'}</div>
                                        <div class="content-asset-actions">
                                            <button type="button" data-content-action="choose-image" data-content-field-id="${field.id}">Choose</button>
                                            <button type="button" data-content-action="clear-image" data-content-field-id="${field.id}">Clear</button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }

                        return this.renderFieldInput(field.value || field.type.toUpperCase(), `<input type="text" data-content-field-id="${field.id}" value="${escapeAttribute(val)}" placeholder="5mm or 16px" />`);
                    }).join('');
            }
        }
    }

    private updateNavState(state: AppState) {
        document.querySelectorAll('[data-nav-action]').forEach(el => {
            el.classList.remove('is-active');
        });

        if (this.isAsideOpen) {
            if (state.mode === 'design') {
                document.querySelector('[data-nav-action="open.design"]')?.classList.add('is-active');
            } else if (state.mode === 'content') {
                document.querySelector('[data-nav-action="open.content"]')?.classList.add('is-active');
            }
        }
        
        if (this.additionalPanelMode === 'templates') {
            document.querySelector('[data-nav-action="manage.templates"]')?.classList.add('is-active');
        }

        if (this.additionalPanelMode === 'assets') {
            document.querySelector('[data-nav-action="manage.assets"]')?.classList.add('is-active');
        }
    }

    private wireContentInputs(store: GlobalState) {
        this.contentFieldsList?.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            const fieldId = target.dataset.contentFieldId;
            if (!fieldId) {
                return;
            }

            store.update(state => this.updateContentValue(state, fieldId, target.value), { recordHistory: false });
        });
    }

    private wireAssetSelection(store: GlobalState) {
        this.contentFieldsList?.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const action = target.dataset.contentAction;
            const fieldId = target.dataset.contentFieldId;

            if (!action || !fieldId) {
                return;
            }

            if (action === 'choose-image') {
                this.openImageSelectModal(store, fieldId);
            }

            if (action === 'clear-image') {
                store.update(state => this.updateContentValue(state, fieldId, ''), { recordHistory: false });
            }
        });
    }

    private wireNavigation(store: GlobalState) {
        document.querySelectorAll<HTMLElement>('[data-nav-action]').forEach(entry => {
            entry.addEventListener('click', () => {
                const action = entry.dataset.navAction || '';

                if (action === 'editor.history.undo') {
                    store.undo();
                }

                if (action === 'editor.history.redo') {
                    store.redo();
                }

                if (action === 'save.project') {
                    persistState(store.getState());
                }

                if (action === 'dashboard') {
                    this.promptProjectManager();
                }

                if (action === 'export.project') {
                    this.exportProject(store.getState());
                }

                if (action === 'export.image') {
                    // Default to PNG and 2x scale for high-DPI export
                    this.exportImage(store.getState(), 'png', 2);
                }

                if (action === 'open.design') {
                    this.setAsideOpen(true);
                    store.update(state => ({ ...state, mode: 'design' }), { recordHistory: false });
                }

                if (action === 'open.content') {
                    this.setAsideOpen(true);
                    store.update(state => ({ ...state, mode: 'content' }), { recordHistory: false });
                }

                if (action === 'manage.templates') {
                    this.toggleAdditionalPanel('templates');
                }

                if (action === 'manage.assets') {
                    this.toggleAdditionalPanel('assets');
                }

                if (action === 'manage.project') {
                    this.openSettingsModal();
                }

                if (action === 'editor.sidebar.toggle') {
                    this.setAsideOpen(!this.isAsideOpen);
                }
            });
        });
    }

    private renderAdditionalPanel(state: AppState) {
        if (!this.templatePanel || !this.additionalPanel) {
            return;
        }

        if (this.templatePanel.hidden || !this.additionalPanelMode) {
            return;
        }

        if (this.additionalPanelMode === 'templates') {
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

            const templateImportInput = this.additionalPanel.querySelector<HTMLInputElement>('#template-import-input');
            const projectImportInput = this.additionalPanel.querySelector<HTMLInputElement>('#project-import-input');
            const templateImportButton = this.additionalPanel.querySelector<HTMLButtonElement>('#template-import-button');
            const templateSaveButton = this.additionalPanel.querySelector<HTMLButtonElement>('#template-save-button');
            const projectImportButton = this.additionalPanel.querySelector<HTMLButtonElement>('#project-import-button');
            const templateList = this.additionalPanel.querySelector<HTMLDivElement>('#template-list');

            if (templateImportButton && templateImportInput) {
                templateImportButton.addEventListener('click', () => templateImportInput.click());
                templateImportInput.addEventListener('change', async (event) => {
                    const target = event.target as HTMLInputElement;
                    if (!target.files || target.files.length === 0) return;
                    const file = target.files[0];
                    try {
                        const TemplateModule = await import('../types/Template.ts');
                        const template = await TemplateModule.Template.fromFile(file);

                        const exists = state.templates.some(t => t.id === template.id);
                        let toSave = template;
                        if (exists) {
                            const payload = template.toJSON();
                            payload.id = (self.crypto && (self.crypto as any).randomUUID) ? (self.crypto as any).randomUUID() : String(Math.random()).slice(2);
                            payload.name = `${payload.name} (import)`;
                            toSave = TemplateModule.Template.fromJSON(payload);
                        }

                        saveTemplate(state.project.id, toSave);
                        this.store?.update(next => addTemplateToState(next, toSave));
                        target.value = '';
                    } catch (err) {
                        console.error('Failed to import template', err);
                    }
                });
            }

            if (templateSaveButton) {
                templateSaveButton.addEventListener('click', () => {
                    this.saveCurrentTemplateAsJson(state);
                });
            }

            if (projectImportButton && projectImportInput) {
                projectImportButton.addEventListener('click', () => projectImportInput.click());
                projectImportInput.addEventListener('change', async (event: Event) => {
                    const target = event.target as HTMLInputElement;
                    if (!target.files || target.files.length === 0) {
                        return;
                    }

                    const file = target.files[0];
                    try {
                        const bundle = JSON.parse(await file.text()) as unknown;
                        this.importProjectBundleWithConflict(bundle);
                        target.value = '';
                    } catch (err) {
                        console.error('Failed to import project', err);
                    }
                });
            }

            if (templateList) {
                templateList.innerHTML = state.templates.map(t => {
                    const isActive = state.project.activeTemplateId === t.id ? 'is-active' : '';
                    const badge = isActive ? '<span class="template-badge">Active</span>' : '';
                    const initial = escapeAttribute(t.name.trim().slice(0, 1).toUpperCase() || 'T');
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
                                    <button class="icon-button ${isActive ? 'is-active' : ''}" data-action="set-active" data-template-id="${t.id}" aria-label="Set active template" ${isActive ? 'disabled' : ''}>
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
                }).join('');

                templateList.querySelectorAll<HTMLButtonElement>('[data-action="export"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.templateId;
                        if (!id) return;
                        this.exportTemplateById(state, id);
                    });
                });

                templateList.querySelectorAll<HTMLButtonElement>('[data-action="set-active"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.templateId;
                        if (!id || !this.store) return;
                        this.store.update(current => this.setActiveTemplate(current, id), { recordHistory: false });
                    });
                });

                templateList.querySelectorAll<HTMLButtonElement>('[data-action="rename"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.templateId;
                        if (!id) return;
                        this.renameTemplate(id);
                    });
                });

                templateList.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.templateId;
                        if (!id) return;
                        deleteTemplate(state.project.id, id);
                        this.store?.update(s => ({ ...s, templates: s.templates.filter(t => t.id !== id) }));
                    });
                });
            }

            this.additionalPanel.querySelector<HTMLButtonElement>('[data-panel-action="close-panel"]')?.addEventListener('click', () => this.toggleAdditionalPanel(null));
            return;
        }

        const projectAssets = state.assets.filter(asset => asset.scope === 'project' || asset.scope === 'global');
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
                        <label class="field inline" style="margin-bottom: 0;">
                            <span>Global scope</span>
                            <input type="checkbox" id="asset-upload-global" />
                        </label>
                    </div>
                </div>

                <div class="asset-dropzone" data-asset-dropzone>
                    <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 0.5rem; color: var(--text-secondary)">perm_media</span>
                    <strong>Drop images or SVG files here</strong>
                    <span>or use the upload button above</span>
                </div>
                
                <div class="asset-grid" id="asset-grid">
                    ${projectAssets.map(asset => this.renderAssetCard(asset)).join('') || '<div class="asset-empty">No assets uploaded yet.</div>'}
                </div>
            </div>
        `;

        const importInput = this.additionalPanel.querySelector<HTMLInputElement>('#asset-import-input');
        const importButton = this.additionalPanel.querySelector<HTMLButtonElement>('#asset-import-button');
        const globalToggle = this.additionalPanel.querySelector<HTMLInputElement>('#asset-upload-global');
        const dropzone = this.additionalPanel.querySelector<HTMLElement>('[data-asset-dropzone]');
        const grid = this.additionalPanel.querySelector<HTMLDivElement>('#asset-grid');

        const uploadFiles = async (files: FileList | File[]) => {
            const scope: AssetScope = globalToggle?.checked ? 'global' : 'project';
            const items = Array.from(files);
            if (items.length === 0) {
                return;
            }

            const assets = await Promise.all(items.map(file => Asset.fromFile(file, scope)));
            this.store?.update(current => ({
                ...current,
                assets: [...current.assets, ...assets],
            }));
        };

        importButton?.addEventListener('click', () => importInput?.click());
        importInput?.addEventListener('change', async (event) => {
            const target = event.target as HTMLInputElement;
            if (!target.files || target.files.length === 0) {
                return;
            }

            await uploadFiles(target.files);
            target.value = '';
        });

        if (dropzone) {
            dropzone.addEventListener('dragover', event => {
                event.preventDefault();
                dropzone.classList.add('is-dragging');
            });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
            dropzone.addEventListener('drop', async event => {
                event.preventDefault();
                dropzone.classList.remove('is-dragging');
                if (event.dataTransfer?.files) {
                    await uploadFiles(event.dataTransfer.files);
                }
            });
        }

        grid?.querySelectorAll<HTMLElement>('[data-asset-id]').forEach(card => {
            const assetId = card.dataset.assetId;
            if (!assetId) {
                return;
            }

            card.querySelector<HTMLButtonElement>('[data-asset-action="rename"]')?.addEventListener('click', () => this.renameAsset(assetId));
            card.querySelector<HTMLButtonElement>('[data-asset-action="download"]')?.addEventListener('click', () => this.downloadAsset(assetId));
            card.querySelector<HTMLButtonElement>('[data-asset-action="delete"]')?.addEventListener('click', () => this.deleteAsset(assetId));
            card.querySelector<HTMLButtonElement>('[data-asset-action="crop"]')?.addEventListener('click', () => this.openCropAssetModal(assetId));
            card.querySelector<HTMLSelectElement>('[data-asset-action="scope"]')?.addEventListener('change', (event) => {
                const nextScope = (event.target as HTMLSelectElement).value as AssetScope;
                this.store?.update(current => this.updateAsset(current, assetId, nextAsset => nextAsset.setScope(nextScope)));
            });
        });

        this.additionalPanel.querySelector<HTMLButtonElement>('[data-panel-action="close-panel"]')?.addEventListener('click', () => this.toggleAdditionalPanel(null));
    }

    private renderAssetCard(asset: Asset) {
        const scopeLabel = asset.scope === 'global' ? 'Global' : 'Project';
        return `
            <div class="asset-card" data-asset-id="${asset.id}">
                <div class="asset-card-preview">
                    ${this.renderAssetPreview(asset)}
                </div>
                <div class="asset-card-body">
                    <input type="text" value="${escapeAttribute(asset.name)}" data-asset-action="rename-input" readonly title="${escapeAttribute(asset.name)}" />
                    <div class="asset-card-meta">${scopeLabel}${asset.isVector() ? ' · SVG' : ''}</div>
                    
                    <div class="asset-card-actions-row">
                        <select data-asset-action="scope" title="Asset Scope">
                            <option value="project" ${asset.scope === 'project' ? 'selected' : ''}>Project</option>
                            <option value="global" ${asset.scope === 'global' ? 'selected' : ''}>Global</option>
                        </select>
                        
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

    private toggleAdditionalPanel(mode: 'templates' | 'assets' | null) {
        if (!this.templatePanel || !this.appWrapper) {
            return;
        }

        const nextMode = this.additionalPanelMode === mode ? null : mode;
        this.additionalPanelMode = nextMode;
        this.templatePanel.hidden = !nextMode;
        this.appWrapper.hidden = Boolean(nextMode);

        if (!nextMode && this.additionalPanel) {
            this.additionalPanel.innerHTML = '';
        }

        this.updateNavState(this.store?.getState() || ({} as AppState));
        if (nextMode && this.store) {
            this.renderAdditionalPanel(this.store.getState());
        }

        this.requestStageResize();
    }

    private renameAsset(assetId: string) {
        const state = this.store?.getState();
        const asset = state?.assets.find(item => item.id === assetId);
        if (!asset || !this.store) {
            return;
        }

        const nextName = window.prompt('Rename asset', asset.name)?.trim();
        if (!nextName) {
            return;
        }

        this.store.update(current => this.updateAsset(current, assetId, nextAsset => nextAsset.setName(nextName)));
    }

    private downloadAsset(assetId: string) {
        const state = this.store?.getState();
        const asset = state?.assets.find(item => item.id === assetId);
        if (!asset) {
            return;
        }

        const link = document.createElement('a');
        link.href = asset.dataUrl;
        link.download = asset.name;
        link.click();
    }

    private deleteAsset(assetId: string) {
        if (!this.store) {
            return;
        }

        this.store.update(current => ({
            ...current,
            assets: current.assets.filter(asset => asset.id !== assetId),
            contents: current.contents.map(content => {
                current.templates.forEach(template => {
                    template.getFields().forEach(field => {
                        if (field.type === 'image') {
                            const value = content.getValue(field.id);
                            if (value === assetId) {
                                content.removeValue(field.id);
                            }
                        }
                    });
                });
                return content;
            }),
        }));
    }

    private openCropAssetModal(assetId: string) {
        const state = this.store?.getState();
        const asset = state?.assets.find(item => item.id === assetId);
        if (!asset) {
            return;
        }

        const crop = asset.crop || { x: 0, y: 0, width: 300, height: 300 };
        const modal = new Modal('Crop Asset', 'Set the visible crop region for this image.', 'Save')
            .addNumberField('X', crop.x, true)
            .addNumberField('Y', crop.y, true)
            .addNumberField('Width', crop.width, true)
            .addNumberField('Height', crop.height, true);

        modal.show().then(result => {
            if (!result || !this.store) {
                return;
            }

            this.store.update(current => this.updateAsset(current, assetId, nextAsset => {
                nextAsset.setCrop({
                    x: Number(result['X']) || 0,
                    y: Number(result['Y']) || 0,
                    width: Number(result['Width']) || 1,
                    height: Number(result['Height']) || 1,
                });
            }));
        });
    }

    private openImageSelectModal(store: GlobalState, fieldId: string) {
        const state = store.getState();
        const assets = state.assets.filter(asset => asset.scope === 'project' || asset.scope === 'global');
        const currentValue = this.getFieldValue(state, fieldId);

        const modal = new Modal('Choose Image', 'Select an asset for this content field.', 'Use')
            .addImageSelectField('Asset', assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                src: asset.dataUrl,
                mimeType: asset.mimeType,
                selected: asset.id === currentValue,
            })), currentValue || '', true);

        modal.show().then(result => {
            if (!result) {
                return;
            }

            const selectedAssetId = String(result['Asset'] || '').trim();
            if (!selectedAssetId) {
                return;
            }

            store.update(next => this.updateContentValue(next, fieldId, selectedAssetId), { recordHistory: false });
        });
    }

    private openDecorationImageSelectModal(store: GlobalState, fieldId: string) {
        const state = store.getState();
        const template = this.getActiveTemplate(state);
        const field = template?.getFields().find(item => item.id === fieldId);
        if (!field) {
            return;
        }

        const assets = state.assets.filter(asset => asset.scope === 'project' || asset.scope === 'global');
        const currentValue = field.imageAssetId || '';

        const modal = new Modal('Choose Decoration Image', 'Select an asset for this decoration.', 'Use')
            .addImageSelectField('Asset', assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                src: asset.dataUrl,
                mimeType: asset.mimeType,
                selected: asset.id === currentValue,
            })), currentValue || '', true);

        modal.show().then(result => {
            if (!result) {
                return;
            }

            const selectedAssetId = String(result['Asset'] || '').trim();
            if (!selectedAssetId) {
                return;
            }

            store.update(next => this.updateTemplateField(next, fieldId, nextField => {
                nextField.imageAssetId = selectedAssetId;
            }), { recordHistory: false });
        });
    }

    private exportProject(state: AppState) {
        const payload = {
            project: state.project.toJSON(),
            templates: state.templates.map(template => template.toJSON()),
            contents: state.contents.map(content => content.toJSON()),
            assets: state.assets.map(asset => asset.toJSON()),
        };

        this.downloadJSON(`${state.project.name}.json`, payload);
    }

    private importProjectBundle(payload: unknown) {
        if (!payload || typeof payload !== 'object' || !this.store) {
            return;
        }

        const record = payload as {
            project?: unknown;
            templates?: unknown[];
            contents?: unknown[];
            assets?: unknown[];
        };

        try {
            const project = record.project ? Project.fromJSON(record.project) : null;

            const templates = Array.isArray(record.templates)
                ? record.templates.map(item => Template.fromJSON(item))
                : [];
            const contents = Array.isArray(record.contents)
                ? record.contents.map(item => Content.fromJSON(item))
                : [];
            const assets = Array.isArray(record.assets)
                ? record.assets.map(item => Asset.fromJSON(item))
                : [];

            if (!project) {
                return;
            }
            this.applyProjectBundle(project, templates, contents, assets);
        } catch (err) {
            console.error('Invalid project bundle', err);
        }
    }

    private importProjectBundleWithConflict(payload: unknown) {
        if (!payload || typeof payload !== 'object' || !this.store) {
            return;
        }

        const record = payload as {
            project?: unknown;
            templates?: unknown[];
            contents?: unknown[];
            assets?: unknown[];
        };

        try {
            const project = record.project ? Project.fromJSON(record.project) : null;

            const templates = Array.isArray(record.templates)
                ? record.templates.map(item => Template.fromJSON(item))
                : [];
            const contents = Array.isArray(record.contents)
                ? record.contents.map(item => Content.fromJSON(item))
                : [];
            const assets = Array.isArray(record.assets)
                ? record.assets.map(item => Asset.fromJSON(item))
                : [];

            if (!project) {
                return;
            }

            const hasConflict = listProjects().some(item => item.id === project.id);
            if (!hasConflict) {
                this.applyProjectBundle(project, templates, contents, assets);
                return;
            }

            const modal = new Modal('Project Import', 'A project with the same ID exists. Replace it or save as new?', 'Continue');
            modal.addSelectField('Import action', ['Replace existing', 'Save as new'], 'Replace existing', true);
            modal.addTextField('New project name', `${project.name || 'Imported Project'} (import)`, true);
            modal.setConditionalField('New project name', 'Import action', 'Save as new');

            modal.show().then(result => {
                if (!result) {
                    return;
                }

                const action = String(result['Import action'] || '').trim();
                if (action === 'Save as new') {
                    const newName = String(result['New project name'] || '').trim() || `${project.name || 'Imported Project'} (import)`;
                    const newId = (self.crypto && (self.crypto as any).randomUUID)
                        ? (self.crypto as any).randomUUID()
                        : String(Math.random()).slice(2);
                    const newProject = new Project(newName, {
                        id: newId,
                        createdAt: project.createdAt,
                        updatedAt: project.updatedAt,
                        activeTemplateId: project.activeTemplateId,
                        activeContentId: project.activeContentId,
                        contentFormat: project.contentFormat,
                        backgroundColor: project.backgroundColor ?? null,
                    });
                    this.applyProjectBundle(newProject, templates, contents, assets);
                    return;
                }

                this.applyProjectBundle(project, templates, contents, assets);
            });
        } catch (err) {
            console.error('Invalid project bundle', err);
        }
    }

    private applyProjectBundle(project: Project, templates: Template[], contents: Content[], assets: Asset[]) {
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
            mode: 'design',
        });
    }

    private exportTemplateById(state: AppState, templateId: string) {
        const template = state.templates.find(t => t.id === templateId);
        if (!template) return;
        const { exportName, payload } = this.getTemplateExportDetails(state, template);
        this.downloadJSON(`${exportName}.template.json`, payload);
    }

    private saveCurrentTemplateAsJson(state: AppState) {
        const template = state.templates.find(item => item.id === state.project.activeTemplateId) ?? state.templates[0] ?? null;
        if (!template) {
            return;
        }

        saveTemplate(state.project.id, template);
        const { exportName, payload } = this.getTemplateExportDetails(state, template);
        this.downloadJSON(`${exportName}.template.json`, payload);
    }

    private getTemplateExportDetails(state: AppState, template: Template) {
        const templateName = (template.name || '').trim();
        const projectName = (state.project.name || '').trim();
        const isDefaultName = templateName.length === 0
            || templateName === 'Starter Post'
            || templateName === 'Template'
            || templateName === 'Untitled Template';
        const exportName = (isDefaultName && projectName) ? projectName : (templateName || projectName || 'Template');
        const payload = template.toJSON();
        if (isDefaultName && projectName) {
            payload.name = projectName;
        }
        return { exportName, payload };
    }

    private setActiveTemplate(state: AppState, templateId: string): AppState {
        if (state.project.activeTemplateId === templateId) {
            return state;
        }

        const nextProject = state.project;
        nextProject.activeTemplateId = templateId;

        const nextContent = state.contents.find(content => content.templateId === templateId);
        if (nextContent) {
            nextProject.activeContentId = nextContent.id;
        }

        return {
            ...state,
            project: nextProject,
        };
    }

    private renameTemplate(templateId: string) {
        const state = this.store?.getState();
        if (!state || !this.store) {
            return;
        }

        const template = state.templates.find(item => item.id === templateId);
        if (!template) {
            return;
        }

        const nextName = window.prompt('Rename template', template.name)?.trim();
        if (!nextName) {
            return;
        }

        this.store.update(current => ({
            ...current,
            templates: current.templates.map(item => {
                if (item.id !== templateId) {
                    return item;
                }
                const nextTemplate = Template.fromJSON(item.toJSON());
                nextTemplate.name = nextName;
                return nextTemplate;
            }),
        }));
    }

    private downloadJSON(name: string, payload: unknown) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = name;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    private async exportImage(state: AppState, format: 'png' | 'jpeg' = 'png', scale: number = 2) {
        const project = state.project;
        const targetWidth = Math.max(1, Math.round(project.contentFormat?.width || 1));
        const targetHeight = Math.max(1, Math.round(project.contentFormat?.height || 1));

        try {
            await (document as any).fonts.ready;
        } catch (e) {
            // ignore; fonts API may not be available in some environments
        }

        // Use html2canvas as the primary export mechanism for fidelity
        await this.loadHtml2Canvas();
        const html2canvas = (window as any).html2canvas;
        if (typeof html2canvas !== 'function') {
            console.error('html2canvas not available');
            return;
        }

        const stage = this.stageElement;
        const stageRect = stage.getBoundingClientRect();
        const offscreen = document.createElement('div');
        offscreen.style.position = 'fixed';
        offscreen.style.left = '-100000px';
        offscreen.style.top = '0';
        // Render the clone at the same visual (CSS) size as the on-screen stage
        offscreen.style.width = `${Math.max(1, Math.round(stageRect.width))}px`;
        offscreen.style.height = `${Math.max(1, Math.round(stageRect.height))}px`;
        offscreen.style.overflow = 'visible';
        offscreen.style.background = project.backgroundColor ?? 'transparent';
        offscreen.style.padding = '0';
        offscreen.style.margin = '0';
        offscreen.style.boxSizing = 'border-box';

        const clone = stage.cloneNode(true) as HTMLElement;
        // Force the clone to match the on-screen visual size so layout is identical
        clone.style.width = `${Math.max(1, Math.round(stageRect.width))}px`;
        clone.style.height = `${Math.max(1, Math.round(stageRect.height))}px`;
        clone.style.minWidth = `${Math.max(1, Math.round(stageRect.width))}px`;
        clone.style.minHeight = `${Math.max(1, Math.round(stageRect.height))}px`;
        clone.style.maxWidth = `${Math.max(1, Math.round(stageRect.width))}px`;
        clone.style.maxHeight = `${Math.max(1, Math.round(stageRect.height))}px`;
        clone.style.aspectRatio = 'auto';
        clone.style.transform = 'none';
        clone.style.padding = '0';
        clone.style.margin = '0';
        clone.style.boxSizing = 'border-box';
        // Ensure CSS variables for format are set on the clone
        clone.style.setProperty('--stage-format-width', String(targetWidth));
        clone.style.setProperty('--stage-format-height', String(targetHeight));

        offscreen.appendChild(clone);
        document.body.appendChild(offscreen);

        // Ensure images in the clone have explicit pixel sizes to prevent object-fit stretching
        const originalImgs = Array.from(stage.querySelectorAll('img')) as HTMLImageElement[];
        const cloneImgs = Array.from(clone.querySelectorAll('img')) as HTMLImageElement[];
        for (let i = 0; i < cloneImgs.length; i++) {
            const cImg = cloneImgs[i];
            const oImg = originalImgs[i];
            if (!oImg || !cImg) continue;
            const rect = oImg.getBoundingClientRect();
            cImg.style.width = `${Math.round(rect.width)}px`;
            cImg.style.height = `${Math.round(rect.height)}px`;
            cImg.style.objectFit = (getComputedStyle(oImg).objectFit) || 'cover';
        }

        // Wait for images to load in the clone
        await Promise.all(Array.from(clone.querySelectorAll('img')).map(imgEl => {
            const img = imgEl as HTMLImageElement;
            if (img.complete) return Promise.resolve();
            return new Promise<void>((res) => { img.addEventListener('load', () => res()); img.addEventListener('error', () => res()); });
        }));

        // Wait a tick for fonts and layout
        await new Promise(r => setTimeout(r, 50));

        // Try using our CanvasRenderer for pixel-perfect exports
        try {
            const renderer = new CanvasRenderer(targetWidth, targetHeight, scale);
            const outCanvas = await renderer.render(this.store!.getState());
            outCanvas.toBlob((blob: Blob | null) => {
                if (blob) this.downloadBlob(blob, `${project.name || 'export'}.${format === 'png' ? 'png' : 'jpg'}`);
            }, format === 'png' ? 'image/png' : 'image/jpeg', 0.92);
        } catch (err) {
            console.error('CanvasRenderer failed, falling back to html2canvas', err);
            try {
                const renderCssWidth = Math.max(1, Math.round(stageRect.width));
                const desiredCanvasWidth = Math.round(targetWidth * scale);
                const canvasScale = desiredCanvasWidth / renderCssWidth;
                const canvas: HTMLCanvasElement = await html2canvas(clone as HTMLElement, { scale: canvasScale, backgroundColor: project.backgroundColor ?? null, useCORS: true });
                canvas.toBlob((blob: Blob | null) => {
                    if (blob) {
                        const ext = format === 'png' ? 'png' : 'jpg';
                        this.downloadBlob(blob, `${project.name || 'export'}.${ext}`);
                    }
                }, format === 'png' ? 'image/png' : 'image/jpeg', 0.92);
            } catch (err2) {
                console.error('html2canvas export failed', err2);
            }
        } finally {
            // Cleanup
            if (offscreen.parentElement) offscreen.parentElement.removeChild(offscreen);
        }
    }

    private collectCSSText(): string {
        let css = '';
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                const rules = (sheet as CSSStyleSheet).cssRules;
                for (const r of Array.from(rules)) {
                    css += (r as CSSRule).cssText + '\n';
                }
            } catch (e) {
                // Can't read cross-origin stylesheet; fallback to @import so fonts/external sheets still apply
                const href = (sheet as CSSStyleSheet).href;
                if (href) {
                    css += `@import url("${href}");\n`;
                }
            }
        }

        return css;
    }

    private downloadBlob(blob: Blob, name: string) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = name;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    private loadHtml2Canvas(): Promise<void> {
        return new Promise((resolve, reject) => {
            if ((window as any).html2canvas) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => resolve();
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
        });
    }

    private startInteraction(store: GlobalState, fieldId: string, mode: InteractionMode, handle: string | null, event: PointerEvent) {
        const state = store.getState();
        const template = this.getActiveTemplate(state);
        if (!template) {
            return;
        }

        const field = template.getFields().find(item => item.id === fieldId);
        if (!field) {
            return;
        }

        const stageRect = this.stageElement.getBoundingClientRect();
        const format = state.project.contentFormat || getDefaultContentFormat();
        const rect = normalizeFieldRect(field, stageRect, { width: format.width, height: format.height });
        const centerX = stageRect.left + rect.x + rect.width / 2;
        const centerY = stageRect.top + rect.y + rect.height / 2;
        const angleFromPointer = Math.atan2(event.clientY - centerY, event.clientX - centerX);

        const interaction: InteractionState = {
            fieldId,
            mode,
            handle,
            originPointer: { x: event.clientX, y: event.clientY },
            originRect: rect,
            originAngle: angleFromPointer,
            originRotation: rect.rotation,
        };

        store.beginHistoryGroup();
        this.stageElement.setPointerCapture(event.pointerId);
        this.setInteraction(store, interaction);
    }

    private setInteraction(store: GlobalState, interaction: InteractionState | null) {
        this.activeInteraction = interaction;

        store.update(state => ({
            ...state,
            selection: { fieldId: interaction?.fieldId || null },
        }), { recordHistory: false });
    }

    private handlePointerMove(store: GlobalState, event: PointerEvent) {
        if (!this.activeInteraction) {
            return;
        }

        const { fieldId, mode, handle, originPointer, originRect, originAngle, originRotation } = this.activeInteraction;
        const deltaX = event.clientX - originPointer.x;
        const deltaY = event.clientY - originPointer.y;

        const stageRect = this.stageElement.getBoundingClientRect();
        const format = store.getState().project.contentFormat || getDefaultContentFormat();

        store.update(state => this.updateTemplateField(state, fieldId, (field) => {
            const nextRect = { ...originRect };

            if (mode === 'move') {
                nextRect.x += deltaX;
                nextRect.y += deltaY;

                if (event.shiftKey) {
                    nextRect.x = Math.round(nextRect.x / MOVE_SNAP_GRID_SIZE) * MOVE_SNAP_GRID_SIZE;
                    nextRect.y = Math.round(nextRect.y / MOVE_SNAP_GRID_SIZE) * MOVE_SNAP_GRID_SIZE;
                }
            }

            if (mode === 'resize' && handle) {
                const rotationRad = (originRect.rotation * Math.PI) / 180;
                const cos = Math.cos(rotationRad);
                const sin = Math.sin(rotationRad);
                const localDeltaX = deltaX * cos + deltaY * sin;
                const localDeltaY = -deltaX * sin + deltaY * cos;

                let widthChange = 0;
                let heightChange = 0;
                let localShiftX = 0;
                let localShiftY = 0;

                if (handle.includes('e')) {
                    widthChange = localDeltaX;
                }
                if (handle.includes('s')) {
                    heightChange = localDeltaY;
                }
                if (handle.includes('w')) {
                    widthChange = -localDeltaX;
                    localShiftX = localDeltaX;
                }
                if (handle.includes('n')) {
                    heightChange = -localDeltaY;
                    localShiftY = localDeltaY;
                }

                let nextWidth = Math.max(40, originRect.width + widthChange);
                let nextHeight = Math.max(40, originRect.height + heightChange);

                if (event.shiftKey) {
                    nextWidth = Math.max(40, Math.round(nextWidth / RESIZE_SNAP_GRID_SIZE) * RESIZE_SNAP_GRID_SIZE);
                    nextHeight = Math.max(40, Math.round(nextHeight / RESIZE_SNAP_GRID_SIZE) * RESIZE_SNAP_GRID_SIZE);
                }

                if (handle.includes('w')) {
                    localShiftX = originRect.width - nextWidth;
                }
                if (handle.includes('n')) {
                    localShiftY = originRect.height - nextHeight;
                }

                const shiftX = localShiftX * cos - localShiftY * sin;
                const shiftY = localShiftX * sin + localShiftY * cos;

                nextRect.width = nextWidth;
                nextRect.height = nextHeight;
                nextRect.x = originRect.x + shiftX;
                nextRect.y = originRect.y + shiftY;
            }

            if (mode === 'rotate') {
                const centerX = stageRect.left + originRect.x + originRect.width / 2;
                const centerY = stageRect.top + originRect.y + originRect.height / 2;
                const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
                const delta = angle - originAngle;
                const degrees = originRotation + (delta * (180 / Math.PI));
                nextRect.rotation = snapRotation(degrees, 5);
            }

                applyRectToField(field, nextRect, stageRect, { width: format.width, height: format.height });
        }), { recordHistory: false });
    }

    private handlePointerUp(store: GlobalState, event: PointerEvent) {
        if (!this.activeInteraction) {
            return;
        }

        this.stageElement.releasePointerCapture(event.pointerId);
        this.activeInteraction = null;
        store.commitHistoryGroup();
    }

    private setupPointerHandlers(store: GlobalState) {
        this.stageElement.addEventListener('pointerdown', (event) => {
            const state = store.getState();
            if (state.mode === 'content') {
                return;
            }

            event.preventDefault();
            const target = event.target as HTMLElement;
            const fieldElement = target.closest<HTMLElement>('.editor-field');
            const handleElement = target.closest<HTMLElement>('.editor-handle');

            if (!fieldElement) {
                store.update(state => ({ ...state, selection: { fieldId: null } }), { recordHistory: false });
                return;
            }

            this.setAsideOpen(true);

            const fieldId = fieldElement.dataset.fieldId;
            if (!fieldId) {
                return;
            }

            if (handleElement?.dataset.handle === 'rotate') {
                this.startInteraction(store, fieldId, 'rotate', 'rotate', event);
                return;
            }

            if (handleElement?.dataset.handle) {
                this.startInteraction(store, fieldId, 'resize', handleElement.dataset.handle, event);
                return;
            }

            this.startInteraction(store, fieldId, 'move', null, event);
        });

        this.stageElement.addEventListener('pointermove', (event) => this.handlePointerMove(store, event));
        this.stageElement.addEventListener('pointerup', (event) => this.handlePointerUp(store, event));
        this.stageElement.addEventListener('pointercancel', (event) => this.handlePointerUp(store, event));
    }

    private setupKeybinds(store: GlobalState) {
        const keyManager = KeybindManager.getInstance();

        keyManager.bind('mod+z', () => {
            store.undo();
        });

        keyManager.bind('mod+r', () => {
            store.redo();
        });

        keyManager.bind('1', () => {
            this.openSettingsModal();
        });

        keyManager.bind('backspace', () => {
            store.update(state => {
                const selectedId = state.selection.fieldId;
                if (!selectedId) {
                    return state;
                }

                const template = this.getActiveTemplate(state);
                if (!template) {
                    return state;
                }

                const nextFields = template.getFields().filter(field => field.id !== selectedId);
                template.setFields(nextFields);

                return {
                    ...state,
                    templates: state.templates.map(t => (t.id === template.id ? template : t)),
                    selection: { fieldId: null },
                };
            });
        });

        keyManager.bind('delete', () => {
            store.update(state => {
                const selectedId = state.selection.fieldId;
                if (!selectedId) {
                    return state;
                }

                const template = this.getActiveTemplate(state);
                if (!template) {
                    return state;
                }

                const nextFields = template.getFields().filter(field => field.id !== selectedId);
                template.setFields(nextFields);

                return {
                    ...state,
                    templates: state.templates.map(t => (t.id === template.id ? template : t)),
                    selection: { fieldId: null },
                };
            });
        });
    }

    private wireFieldActions(store: GlobalState) {
        const addField = (type: ProjectField['type']) => {
            store.update(state => {
                const template = this.getActiveTemplate(state);
                if (!template) {
                    return state;
                }

                const label = type === 'image' ? 'Image' : type === 'decoration' ? 'Decoration' : 'Text';
                const newField = createProjectField(type, label, {
                    location: { x: 80, y: 80, anchor: 'top-left', unit: 'px' },
                    size: { width: 240, height: 140, unit: 'px' },
                });

                const nextFields = [...template.getFields(), newField];
                template.setFields(nextFields);

                return {
                    ...state,
                    templates: state.templates.map(item => (item.id === template.id ? template : item)),
                    selection: { fieldId: newField.id },
                };
            });
        };

        this.addTextFieldButton?.addEventListener('click', () => addField('text'));
        this.addDecorationFieldButton?.addEventListener('click', () => addField('decoration'));
        this.addImageFieldButton?.addEventListener('click', () => addField('image'));
    }

    private wireSelectionInputs(store: GlobalState) {
        this.selectionDetails?.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement | HTMLSelectElement;
            const prop = target.dataset.fieldProp;
            if (!prop) {
                return;
            }

            store.update(state => {
                const selectedId = state.selection.fieldId;
                if (!selectedId) {
                    return state;
                }

                if (prop === 'value') {
                    return this.updateTemplateField(state, selectedId, (field) => {
                        field.value = target.value;
                    });
                }

                return this.updateTemplateField(state, selectedId, (field) => {
                    const currentStyle = normalizeFieldStyle(field.style || createDefaultFieldStyle());
                    const numericValue = Number(target.value);
                    if (prop === 'x') {
                        field.location.x = numericValue;
                    } else if (prop === 'y') {
                        field.location.y = numericValue;
                    } else if (prop === 'width') {
                        field.size.width = Math.max(20, numericValue);
                    } else if (prop === 'height') {
                        field.size.height = Math.max(20, numericValue);
                    } else if (prop === 'rotation') {
                        field.rotation = snapRotation(numericValue, 5);
                    } else if (prop === 'anchor' && 'value' in target) {
                        field.location.anchor = target.value as ProjectField['location']['anchor'];
                    } else if (prop === 'padding') {
                        currentStyle.padding = Math.max(0, Number.isFinite(numericValue) ? numericValue : currentStyle.padding);
                        field.style = currentStyle;
                    } else if (prop === 'color') {
                        const colorValue = this.syncColorFieldInputs(prop, target as HTMLInputElement);
                        currentStyle.color = colorValue;
                        field.style = currentStyle;
                    } else if (prop === 'backgroundColor') {
                        const backgroundValue = this.syncColorFieldInputs(prop, target as HTMLInputElement);
                        currentStyle.backgroundColor = backgroundValue;
                        field.style = currentStyle;
                    } else if (prop === 'fontFamily') {
                        currentStyle.fontFamily = target.value || createDefaultFieldStyle().fontFamily;
                        field.style = currentStyle;
                    } else if (prop === 'fontSize') {
                        currentStyle.fontSize = Math.max(1, Number.isFinite(numericValue) ? numericValue : currentStyle.fontSize);
                        field.style = currentStyle;
                    } else if (prop === 'fontWeight') {
                        currentStyle.fontWeight = target.value;
                        field.style = currentStyle;
                    } else if (prop === 'textAlign') {
                        const nextTextAlign = target.value as ProjectField['style']['textAlign'];
                        currentStyle.textAlign = nextTextAlign;
                        field.style = currentStyle;
                    }
                });
            }, { recordHistory: false });
        });

        this.selectionDetails?.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const action = target.dataset.fieldAction;
            if (!action || !this.store) {
                return;
            }

            const fieldId = this.store.getState().selection.fieldId;
            if (!fieldId) {
                return;
            }

            if (action === 'choose-decoration-image') {
                this.openDecorationImageSelectModal(this.store, fieldId);
            }

            if (action === 'clear-decoration-image') {
                this.store.update(state => this.updateTemplateField(state, fieldId, field => {
                    field.imageAssetId = null;
                }), { recordHistory: false });
            }

            if (action === 'send-to-back') {
                this.store.update(state => moveTemplateField(state, fieldId, 'back'));
            }

            if (action === 'bring-to-front') {
                this.store.update(state => moveTemplateField(state, fieldId, 'front'));
            }
        });
    }

    private syncColorFieldInputs(fieldProp: 'color' | 'backgroundColor', target: HTMLInputElement) {
        const fieldRow = target.closest('.color-field');
        if (!fieldRow) {
            return target.value;
        }

        const picker = fieldRow.querySelector<HTMLInputElement>('input[type="color"][data-color-role="picker"]');
        const text = fieldRow.querySelector<HTMLInputElement>('input[type="text"][data-color-role="text"]');

        if (target.dataset.colorRole === 'picker') {
            if (text) {
                text.value = target.value;
            }
            return target.value;
        }

        const nextValue = target.value.trim();
        if (picker) {
            picker.value = this.resolveColorPickerValue(nextValue, '#111111');
        }

        if (fieldProp === 'backgroundColor' && nextValue.toLowerCase() === 'transparent' && text) {
            text.value = 'transparent';
        }

        return nextValue;
    }

    private updateContentValue(state: AppState, fieldId: string, value: string): AppState {
        return updateContentValue(state, fieldId, value);
    }

    private updateTemplateField(state: AppState, fieldId: string, updater: (field: ProjectField) => void): AppState {
        return updateTemplateField(state, fieldId, updater);
    }

    private setupWindowResizeHandling() {
        window.addEventListener('resize', () => {
            this.requestStageResize();
        });
    }

    private setAsideOpen(isOpen: boolean) {
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

    private getHistoryStorageKey(projectId: string) {
        return `${DeltosPublisherApp.HISTORY_STORAGE_PREFIX}.${projectId}`;
    }

    private persistHistorySnapshot(store: GlobalState) {
        const state = store.getState();
        const snapshot = store.getHistorySnapshot();
        const key = this.getHistoryStorageKey(state.project.id);
        try {
            sessionStorage.setItem(key, JSON.stringify(snapshot));
        } catch (err) {
            console.warn('Failed to persist history snapshot', err);
        }
    }

    private restoreHistorySnapshot(store: GlobalState) {
        const state = store.getState();
        const key = this.getHistoryStorageKey(state.project.id);
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) {
                return;
            }
            const snapshot = JSON.parse(raw) as any;
            if (!snapshot || !Array.isArray(snapshot.past) || !Array.isArray(snapshot.future)) {
                return;
            }
            store.restoreHistorySnapshot(snapshot);
        } catch (err) {
            console.warn('Failed to restore history snapshot', err);
        }
    }

    private requestStageResize() {
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

    private applyStageFormat(format: ContentFormat) {
        const stage = this.stageElement;
        const safeWidth = Math.max(1, Math.round(format.width));
        const safeHeight = Math.max(1, Math.round(format.height));

        stage.style.setProperty('--stage-format-width', String(safeWidth));
        stage.style.setProperty('--stage-format-height', String(safeHeight));

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

    private applyProjectBackground(project: { backgroundColor?: string | null }) {
        const stage = this.stageElement;
        const bg = project.backgroundColor ?? 'transparent';
        stage.style.backgroundColor = bg;
    }

    private resolveContentFormat(targetLabel: string, width: number, height: number): ContentFormat {
        if (targetLabel === 'Custom') {
            return {
                label: 'Custom',
                width: Math.max(1, Math.round(Number.isFinite(width) ? width : 1)),
                height: Math.max(1, Math.round(Number.isFinite(height) ? height : 1)),
            };
        }

        return findContentFormatByLabel(targetLabel) || getDefaultContentFormat();
    }


    // Settings modal
    private openSettingsModal() {
        const state = this.store?.getState();
        const project = state?.project;
        const currentFormat = project?.contentFormat || getDefaultContentFormat();

        const modal = new Modal("Settings", "Configure your project settings below.", "Save")
            .addTextField("Project Name", project?.name || '', true)
            .addColorField('Background', project?.backgroundColor ?? 'transparent', true)
            .addSelectField("Target", ContentFormats.map(format => format.label).concat(["Custom"]), currentFormat.label, true)
            .addNumberField("Width (px)", currentFormat.width, true)
            .addNumberField("Height (px)", currentFormat.height, true)

            .setConditionalField("Width (px)", "Target", "Custom")
            .setConditionalField("Height (px)", "Target", "Custom");

        modal.show().then(result => {
            if (!result || !this.store) {
                return;
            }

            const nextName = String(result["Project Name"] || project?.name || '').trim();
            const target = String(result["Target"] || currentFormat.label);
            const width = Number(result["Width (px)"]);
            const height = Number(result["Height (px)"]);
            const nextFormat = this.resolveContentFormat(target, width, height);

            this.store.update((state) => {
                state.project.name = nextName || state.project.name;
                state.project.contentFormat = nextFormat;
                state.project.backgroundColor = (String(result['Background'] || '').trim() || null) as any;
                state.project.touch();
                return {
                    ...state,
                    project: state.project,
                };
            });
        });


    }
}

export { DeltosPublisherApp };