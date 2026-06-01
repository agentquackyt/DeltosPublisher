import { type AppState } from "../editor/GlobalState.ts";
import { normalizeFieldRect, type FieldRect } from "../editor/appGeometry.ts";
import type { ProjectField } from "../types/Project.ts";
import type { Asset } from "../types/Asset.ts";

class CanvasRenderer {
    width: number;
    height: number;
    scale: number;

    constructor(width: number, height: number, scale: number = 1) {
        this.width = Math.max(1, Math.round(width));
        this.height = Math.max(1, Math.round(height));
        this.scale = Math.max(1, scale);
    }

    private async loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.crossOrigin = 'anonymous';
            img.src = src;
        });
    }

    private normalizeSvgDataUrl(dataUrl: string, targetWidth: number, targetHeight: number): string {
        try {
            const comma = dataUrl.indexOf(',');
            const header = dataUrl.substring(0, comma);
            const data = dataUrl.substring(comma + 1);

            let svgText = '';
            if (/;base64/.test(header)) {
                try {
                    svgText = decodeURIComponent(escape(atob(data)));
                } catch {
                    svgText = atob(data);
                }
            } else {
                svgText = decodeURIComponent(data);
            }

            // Ensure xmlns
            if (!svgText.includes('xmlns=')) {
                svgText = svgText.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
            }

            svgText = svgText.replace(/<svg([^>]*)>/i, (match, attrs) => {
                let cleaned = attrs;
                const widthMatch = attrs.match(/\swidth\s*=\s*"([^"]*)"/i);
                const heightMatch = attrs.match(/\sheight\s*=\s*"([^"]*)"/i);
                const viewBoxMatch = attrs.match(/\sviewBox\s*=\s*"[^"]*"/i);

                let w = widthMatch ? parseFloat(widthMatch[1]) : NaN;
                let h = heightMatch ? parseFloat(heightMatch[1]) : NaN;

                cleaned = cleaned.replace(/\s(width|height)\s*=\s*"[^"]*"/ig, '');

                if (!viewBoxMatch && !isNaN(w) && !isNaN(h)) {
                    cleaned += ` viewBox="0 0 ${w} ${h}"`;
                }

                return `<svg ${cleaned} width="${Math.round(targetWidth)}" height="${Math.round(targetHeight)}">`;
            });

            const encoded = btoa(unescape(encodeURIComponent(svgText)));
            return `data:image/svg+xml;base64,${encoded}`;
        } catch (e) {
            console.warn("Failed to normalize SVG data URL", e);
            return dataUrl;
        }
    }

    private drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (iw === 0 || ih === 0) {
            // fallback to simple draw
            ctx.drawImage(img, dx, dy, dw, dh);
            return;
        }

        const scale = Math.max(dw / iw, dh / ih);
        const sw = dw / scale;
        const sh = dh / scale;
        const sx = Math.max(0, (iw - sw) / 2);
        const sy = Math.max(0, (ih - sh) / 2);

        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    private drawImageContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (iw === 0 || ih === 0) {
            ctx.drawImage(img, dx, dy, dw, dh);
            return;
        }

        const scale = Math.min(dw / iw, dh / ih);
        const destW = iw * scale;
        const destH = ih * scale;
        const destX = dx + Math.round((dw - destW) / 2);
        const destY = dy + Math.round((dh - destH) / 2);

        ctx.drawImage(img, 0, 0, iw, ih, destX, destY, destW, destH);
    }

    private anchorOffset(anchor: ProjectField['location']['anchor'], rect: FieldRect) {
        switch (anchor) {
            case 'center':
                return { ox: rect.width / 2, oy: rect.height / 2 };
            case 'top-right':
                return { ox: rect.width, oy: 0 };
            case 'bottom-left':
                return { ox: 0, oy: rect.height };
            case 'bottom-right':
                return { ox: rect.width, oy: rect.height };
            default:
                return { ox: 0, oy: 0 };
        }
    }

    async render(state: AppState): Promise<HTMLCanvasElement> {
        const project = state.project;
        const template = state.templates.find(t => t.id === project.activeTemplateId) || state.templates[0];
        const content = state.contents.find(c => c.id === project.activeContentId) || state.contents[0];

        const canvas = document.createElement('canvas');
        canvas.width = this.width * this.scale;
        canvas.height = this.height * this.scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');

        // Work in CSS pixels, scale afterwards
        ctx.scale(this.scale, this.scale);

        // Background
        if (project.backgroundColor) {
            ctx.fillStyle = project.backgroundColor;
            ctx.fillRect(0, 0, this.width, this.height);
        } else {
            ctx.clearRect(0, 0, this.width, this.height);
        }

        if (!template) return canvas;

        const stageRect = new DOMRect(0, 0, this.width, this.height);

        // Draw fields in order
        for (const field of template.getFields()) {
            const rect = normalizeFieldRect(field, stageRect, { width: this.width, height: this.height });

            // Save and apply rotation/anchor
            const { ox, oy } = this.anchorOffset(field.location.anchor, rect);
            ctx.save();
            const cx = rect.x + ox;
            const cy = rect.y + oy;
            ctx.translate(cx, cy);
            ctx.rotate((field.rotation * Math.PI) / 180);
            const drawX = -ox;
            const drawY = -oy;

            const style = field.style || ({} as any);
            // Background
            if (style.backgroundColor && style.backgroundColor !== 'transparent') {
                ctx.fillStyle = style.backgroundColor;
                ctx.fillRect(drawX, drawY, rect.width, rect.height);
            }

            // Padding in pixels
            const padding = Math.max(0, Number(style.padding) || 0);
            const innerX = drawX + padding;
            const innerY = drawY + padding;
            const innerW = Math.max(1, rect.width - padding * 2);
            const innerH = Math.max(1, rect.height - padding * 2);

            if (field.type === 'image') {
                const value = content ? content.getValue(field.id) : '';
                const asset = state.assets.find(a => a.id === value) as Asset | undefined;
                if (asset) {
                    try {
                        let srcUrl = asset.dataUrl;
                        if (asset.mimeType === 'image/svg+xml') {
                            srcUrl = this.normalizeSvgDataUrl(srcUrl, innerW, innerH);
                        }
                        const img = await this.loadImage(srcUrl);

                        if (asset.crop) {
                            const sx = Math.max(0, asset.crop.x);
                            const sy = Math.max(0, asset.crop.y);
                            const sw = Math.max(1, asset.crop.width);
                            const sh = Math.max(1, asset.crop.height);
                            ctx.drawImage(img, sx, sy, sw, sh, innerX, innerY, innerW, innerH);
                        } else if (asset.mimeType === 'image/svg+xml') {
                            this.drawImageContain(ctx, img, innerX, innerY, innerW, innerH);
                        } else {
                            // Use cover behavior (preserve aspect ratio, center-crop to fill)
                            this.drawImageCover(ctx, img, innerX, innerY, innerW, innerH);
                        }
                    } catch (e) {
                        console.warn('Failed to load asset image for render', e);
                        // placeholder
                        ctx.fillStyle = '#eee';
                        ctx.fillRect(innerX, innerY, innerW, innerH);
                    }
                } else {
                    // No asset placeholder
                    ctx.fillStyle = '#f3f3f3';
                    ctx.fillRect(innerX, innerY, innerW, innerH);
                }
            } else if (field.type === 'decoration') {
                const assetId = field.imageAssetId;
                if (assetId) {
                    const asset = state.assets.find(a => a.id === assetId) as Asset | undefined;
                    if (asset) {
                        try {
                            let srcUrl = asset.dataUrl;
                            if (asset.mimeType === 'image/svg+xml') {
                                srcUrl = this.normalizeSvgDataUrl(srcUrl, innerW, innerH);
                            }
                            const img = await this.loadImage(srcUrl);

                            if (asset.crop) {
                                ctx.drawImage(img, asset.crop.x, asset.crop.y, asset.crop.width, asset.crop.height, innerX, innerY, innerW, innerH);
                            } else if (asset.mimeType === 'image/svg+xml') {
                                this.drawImageContain(ctx, img, innerX, innerY, innerW, innerH);
                            } else {
                                this.drawImageCover(ctx, img, innerX, innerY, innerW, innerH);
                            }
                        } catch (e) {
                            console.warn('Failed to load decoration asset', e);
                        }
                    }
                } else {
                    // simple placeholder
                    ctx.fillStyle = '#ddd';
                    ctx.fillRect(innerX, innerY, innerW, innerH);
                }
            } else {
                // Text
                const contentValue = String(content ? content.getValue(field.id) : field.value || '');
                const fontSize = Math.max(1, Number(style.fontSize) || 16);
                const fontWeight = style.fontWeight || '400';
                const fontFamily = style.fontFamily || 'sans-serif';
                ctx.fillStyle = style.color || '#000';
                ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                const textAlign = (style.textAlign === 'left') ? 'left' : (style.textAlign === 'right') ? 'right' : 'center';
                ctx.textAlign = textAlign as CanvasTextAlign;
                ctx.textBaseline = 'middle';

                // Multiline wrap: break on explicit newlines, then wrap words to fit innerW
                const paragraphs = contentValue.split('\n');
                const lines: string[] = [];
                for (const para of paragraphs) {
                    const words = para.split(/\s+/).filter(Boolean);
                    if (words.length === 0) {
                        lines.push('');
                        continue;
                    }
                    let line = words[0];
                    for (let i = 1; i < words.length; i++) {
                        const test = line + ' ' + words[i];
                        const w = ctx.measureText(test).width;
                        if (w <= innerW) {
                            line = test;
                        } else {
                            lines.push(line);
                            line = words[i];
                        }
                    }
                    lines.push(line);
                }

                const lineHeight = Math.max(1, fontSize * 1.2);
                const totalHeight = lines.length * lineHeight;

                // Vertical alignment: support optional style.verticalAlign ('top'|'middle'|'bottom'), default middle
                const vAlign = (style as any).verticalAlign || 'middle';
                let startY = innerY + innerH / 2 - totalHeight / 2 + lineHeight / 2;
                if (vAlign === 'top') startY = innerY + lineHeight / 2;
                if (vAlign === 'bottom') startY = innerY + innerH - totalHeight + lineHeight / 2;

                let xPos = innerX + innerW / 2;
                if (textAlign === 'left') xPos = innerX;
                if (textAlign === 'right') xPos = innerX + innerW;

                let y = startY;
                for (const line of lines) {
                    ctx.fillText(line, xPos, y, innerW);
                    y += lineHeight;
                }
            }

            ctx.restore();
        }

        return canvas;
    }
}

export default CanvasRenderer;
