type ModalDataType = 'text' | 'number' | 'color' | 'boolean' | 'mm' | 'select' | 'chip' | 'imageselect';

interface ImageSelectOption {
    id: string;
    name: string;
    src: string;
    mimeType: string;
    selected?: boolean;
}

interface ModalField {
    label: string;
    key: string;
    type: ModalDataType;
    required: boolean;
    defaultValue?: any;
    options?: string[]; // For select fields
    imageOptions?: ImageSelectOption[];
    condition?: ConditionalField[]; // For conditional fields
}


/**
 * Requires that a different field has a specific value to be shown. This is used for conditional fields, e.g. show "Country" select field only if "Subscribe to Newsletter" is true.
 */
interface ConditionalField {
    conditionLabel: string;
    conditionValue: any;
    operator?: 'equals' | 'not-equals';
}


function clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.max(min, Math.min(max, value));
}

function syncColorInput(input: HTMLInputElement | undefined, cssValue: string, fallback: string) {
    if (!input) {
        return;
    }

    const value = cssValue.trim();
    if (/^#[0-9a-f]{6}$/i.test(value) || /^#[0-9a-f]{3}$/i.test(value)) {
        input.value = normalizeHexColor(value);
        return;
    }

    const rgbMatch = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgbMatch) {
        const r = clampNumber(Number(rgbMatch[1] || 0), 0, 255);
        const g = clampNumber(Number(rgbMatch[2] || 0), 0, 255);
        const b = clampNumber(Number(rgbMatch[3] || 0), 0, 255);
        input.value = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        return;
    }

    input.value = normalizeHexColor(fallback);
}

function normalizeHexColor(value: string): string {
    const trimmed = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
        return trimmed;
    }
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
    }
    return "#000000";
}

function toHex(value: number): string {
    return Math.round(value).toString(16).padStart(2, "0");
}

class Modal {
    private fields: ModalField[];
    private title: string;
    private description?: string;
    private modalElement: HTMLDialogElement;

    constructor(title: string, description?: string, buttonText: string = 'Apply') {
        this.title = title;
        this.description = description;
        this.fields = [];
        this.modalElement = document.createElement('dialog');
        this.modalElement.classList.add('modal');

        this.modalElement.innerHTML = `
            <div class="modal-header">
            <h2 class="modal-title"></h2>
            <p class="modal-description"></p>
            </div>
            <div class="modal-body"></div>
            <button class="modal-submit btn btn-xl primary">${buttonText}</button>
        `;

        document.body.appendChild(this.modalElement);
    }


    addTextField(label: string, defaultValue?: string, required: boolean = false): Modal {
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'text', required, defaultValue });
        return this;
    }

    addNumberField(label: string, defaultValue?: number, required: boolean = false): Modal {
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'number', required, defaultValue });
        return this;
    }

    addColorField(label: string, defaultValue?: string, required: boolean = false): Modal {
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'color', required, defaultValue });
        return this;
    }

    addBooleanField(label: string, defaultValue?: boolean, required: boolean = false): Modal {
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'boolean', required, defaultValue });
        return this;
    }

    addMillimeterField(label: string, defaultValue?: number, required: boolean = false): Modal {
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'mm', required, defaultValue });
        return this;
    }

    addSelectField(label: string, options: string[], defaultValue?: string, required: boolean = false): Modal {
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'select', required, defaultValue, options });
        return this;
    }

    addChipField(label: string, defaultValue?: string[], required: boolean = false): Modal {
        // Text field with comma-separated values, which will be split into an array
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'chip', required, defaultValue });
        return this;
    }

    addImageSelectField(label: string, options: ImageSelectOption[], defaultValue?: string, required: boolean = false): Modal {
        this.fields.push({ label, key: label.toLowerCase().replace(' ', '_'), type: 'imageselect', required, defaultValue, imageOptions: options });
        return this;
    }

    setConditionalField(label: string, conditionLabel: string, conditionValue: any, operator: 'equals' | 'not-equals' = 'equals'): Modal {
        const field = this.fields.find(f => f.label === label);
        if (field) {
            if (!field.condition) {
                field.condition = [];
            }
            field.condition.push({ conditionLabel, conditionValue, operator });
        }
        return this;
    }

    getFields(): ModalField[] {
        return this.fields;
    }

    private constructModalFromFields(fields: ModalField[], modalBody: HTMLElement): HTMLElement {

        modalBody.innerHTML = ''; // Clear previous content

        fields.forEach(field => {
            const label = document.createElement('label');
            label.classList.add('field')
            if (field.type === 'chip') {
                label.classList.add('has-chips');
            }
            if (field.type === 'imageselect') {
                label.classList.add('has-image-select');
            }
            const spanElement = document.createElement('span');
            spanElement.textContent = field.label + (field.required ? ' *' : '') + (field.type === 'chip' ? ' (comma-separated)' : '') + (field.type === 'imageselect' ? ' (choose an asset)' : '');
            label.appendChild(spanElement);

            let input: HTMLInputElement | HTMLSelectElement;

            switch (field.type) {
                case 'text':
                    input = document.createElement('input');
                    input.type = 'text';
                    break;
                case 'number':
                    input = document.createElement('input');
                    input.type = 'number';
                    break;
                case 'color':
                    input = document.createElement('input');
                    input.type = 'color';
                    break;
                case 'boolean':
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    break;
                case 'mm':
                    input = document.createElement('input') as HTMLInputElement;
                    input.type = 'number';
                    input.step = '0.01';
                    input.min = '0';
                    input.placeholder = '0mm';
                    break;
                case 'select':
                    input = document.createElement('select');
                    field.options?.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        input.appendChild(optionElement);
                    });
                    break;
                case 'chip':
                        input = document.createElement('input');
                        input.type = 'text';
                        input.placeholder = 'Enter values separated by commas';
                        if (Array.isArray(field.defaultValue)) {
                            input.value = (field.defaultValue as string[]).join(', ');
                        }
                        // create a single chips container and update it on input
                        const chipsContainerInit = document.createElement('div');
                        chipsContainerInit.className = 'chip-container';
                        // initialize from default value
                        if (Array.isArray(field.defaultValue)) {
                            (field.defaultValue as string[]).forEach(val => {
                                const chip = document.createElement('span');
                                chip.className = 'chip';
                                chip.textContent = val;
                                chipsContainerInit.appendChild(chip);
                            });
                        }
                        input.addEventListener('input', () => {
                            const chips = (input as HTMLInputElement).value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                            chipsContainerInit.replaceChildren();
                            chips.forEach(val => {
                                const chip = document.createElement('span');
                                chip.className = 'chip';
                                chip.textContent = val;
                                chipsContainerInit.appendChild(chip);
                            });
                        });
                        // append the initialized chips container into the label so it's visible
                        label.appendChild(chipsContainerInit);
                    break;
                case 'imageselect':
                    input = document.createElement('input');
                    input.type = 'hidden';
                    break;
                default:
                    throw new Error(`Unsupported field type: ${field.type}`);
            }
            if (field.type === 'boolean') {
                (input as HTMLInputElement).checked = Boolean(field.defaultValue);
            } else if (field.defaultValue !== undefined) {
                input.value = String(field.defaultValue);
            } else {
                input.value = '';
            }

            label.appendChild(input);
            if (field.type === 'color') {
                let colorTextInput = document.createElement('input');
                colorTextInput.type = 'text';
                colorTextInput.placeholder = '#RRGGBB';
                colorTextInput.value = field.defaultValue || '';
                label.appendChild(colorTextInput);

                syncColorInput(colorTextInput, field.defaultValue || '#000000', '#000000');
                input.addEventListener('input', () => {
                    syncColorInput(colorTextInput, input.value, '#000000');
                });
                colorTextInput.addEventListener('input', () => {
                    syncColorInput(input as HTMLInputElement, colorTextInput.value, '#000000');
                });
            } else if (field.type === 'imageselect') {
                const preview = document.createElement('div');
                preview.className = 'image-select-grid';

                const options = field.imageOptions || [];
                options.forEach(option => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'image-select-card';
                    if ((field.defaultValue && field.defaultValue === option.id) || option.selected) {
                        button.classList.add('is-selected');
                        (input as HTMLInputElement).value = option.id;
                    }
                    button.innerHTML = `
                        <img src="${option.src}" alt="${option.name}" />
                        <span class="name">${this.shortenLabel(option.name)}</span>
                        <span class="meta">${option.mimeType}</span>
                    `;
                    button.addEventListener('click', () => {
                        (input as HTMLInputElement).value = option.id;
                        preview.querySelectorAll('.image-select-card').forEach(card => card.classList.remove('is-selected'));
                        button.classList.add('is-selected');
                    });
                    preview.appendChild(button);
                });

                if (options.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'image-select-empty';
                    empty.textContent = 'No assets available yet.';
                    preview.appendChild(empty);
                }

                label.appendChild(preview);
            }

            // Set data attribute for conditional logic
            if (field.condition) {
                label.setAttribute('data-conditional', 'true');
            }
            label.setAttribute('data-field-label', field.label);
            label.setAttribute('data-field-type', field.type);


            // Handle conditional fields
            if (field.condition) {
                const updateVisibility = () => {
                    let shouldShow = true;
                    for (const condition of field.condition!) {
                        // Use the data-field-label attribute we set earlier to find the related field
                        const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
                        const relatedField = modalBody.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null;

                        if (relatedField) {
                            let relatedValue: any;
                            if (relatedField.type === 'checkbox') {
                                relatedValue = (relatedField as HTMLInputElement).checked;
                            } else {
                                relatedValue = relatedField.value;
                            }

                            const operator = condition.operator ?? 'equals';
                            const matches = operator === 'not-equals'
                                ? relatedValue != condition.conditionValue
                                : relatedValue == condition.conditionValue;
                            if (!matches) {
                                shouldShow = false;
                                break;
                            }
                        }
                    }
                    label.style.display = shouldShow ? '' : 'none';
                };

                field.condition.forEach(condition => {
                    // Corrected selector to avoid the :contains SyntaxError
                    const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
                    const relatedField = modalBody.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null;

                    if (relatedField) {
                        relatedField.addEventListener('input', updateVisibility);
                        if (relatedField.type === 'checkbox') {
                            relatedField.addEventListener('change', updateVisibility);
                        }
                    }
                });

                // Initial visibility check
                updateVisibility();
            }

            modalBody.appendChild(label);
            // append chips container if field is chip (we initialized it above)
            if (field.type === 'chip') {
                const existingInput = label.querySelector('input') as HTMLInputElement | null;
                if (existingInput) {
                    // Find the chips container we created earlier in the switch scope via DOM traversal; if not found, create one
                    let existing = label.querySelector('.chip-container') as HTMLElement | null;
                    if (!existing) {
                        // create empty container
                        const fallback = document.createElement('div');
                        fallback.className = 'chip-container';
                        label.appendChild(fallback);
                    }
                }
            }
        });

        // Re-wire conditional visibility after all fields exist in the DOM.
        fields.forEach((field) => {
            if (!field.condition || field.condition.length === 0) {
                return;
            }

            const currentLabel = modalBody.querySelector(`label[data-field-label="${field.label}"]`) as HTMLElement | null;
            if (!currentLabel) {
                return;
            }

            const updateVisibility = () => {
                let shouldShow = true;
                for (const condition of field.condition!) {
                    const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
                    const relatedField = modalBody.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null;
                    if (!relatedField) {
                        continue;
                    }

                    const relatedValue = relatedField.type === 'checkbox'
                        ? (relatedField as HTMLInputElement).checked
                        : relatedField.value;

                    const operator = condition.operator ?? 'equals';
                    const matches = operator === 'not-equals'
                        ? relatedValue != condition.conditionValue
                        : relatedValue == condition.conditionValue;

                    if (!matches) {
                        shouldShow = false;
                        break;
                    }
                }

                currentLabel.style.display = shouldShow ? '' : 'none';
            };

            field.condition.forEach((condition) => {
                const selector = `label[data-field-label="${condition.conditionLabel}"] input, label[data-field-label="${condition.conditionLabel}"] select`;
                const relatedField = modalBody.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null;
                if (!relatedField) {
                    return;
                }
                relatedField.addEventListener('input', updateVisibility);
                relatedField.addEventListener('change', updateVisibility);
            });

            updateVisibility();
        });

        return modalBody;
    }

    private shortenLabel(label: string): string {
        const maxLength = 20;
        if (label.length <= maxLength) {
            return label;
        }
        return label.slice(0, maxLength - 3) + '...';
    }

    async show(): Promise<{ [key: string]: any } | null> {
        const modalContent = this.constructModalFromFields(this.fields, this.modalElement.querySelector('.modal-body')!);
        this.modalElement.querySelector('.modal-title')!.textContent = this.title;
        this.modalElement.querySelector('.modal-description')!.textContent = this.description || '';

        //this.modalElement.querySelector('.modal-body')!.innerHTML = '';
        this.modalElement.querySelector('.modal-body')!.replaceWith(modalContent);

        this.modalElement.showModal();


        return new Promise((resolve) => {
            const submitButton = this.modalElement.querySelector('.modal-submit') as HTMLButtonElement;
            submitButton.onclick = () => {
                const formData: { [key: string]: any } = {};
                this.fields.forEach((field) => {
                    const label = this.modalElement.querySelector(`label[data-field-label="${field.label}"]`);
                    if (!label) {
                        formData[field.label] = null;
                        return;
                    }
                    const inputEl = label.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
                    if (!inputEl) {
                        formData[field.label] = null;
                        return;
                    }

                    if (field.type === 'boolean') {
                        formData[field.label] = (inputEl as HTMLInputElement).checked;
                    } else if (field.type === 'mm' || field.type === 'number') {
                        formData[field.label] = parseFloat((inputEl as HTMLInputElement).value);
                    } else if (field.type === 'chip') {
                        const raw = (inputEl as HTMLInputElement).value;
                        formData[field.label] = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
                    } else if (field.type === 'imageselect') {
                        const hiddenInput = inputEl as HTMLInputElement;
                        formData[field.label] = hiddenInput.value || null;
                    } else {
                        formData[field.label] = (inputEl as HTMLInputElement).value;
                    }
                });
                submitButton.onclick = null; // Remove event listener
                this.modalElement.onclose = null; // Remove close event listener
                resolve(formData);
                this.modalElement.close();
            };

            this.modalElement.onclose = () => {
                submitButton.onclick = null; // Remove event listener
                this.modalElement.onclose = null; // Remove close event listener
                resolve(null);
            };
        });
    }
}

export default Modal;