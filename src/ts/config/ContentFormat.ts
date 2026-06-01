interface ContentFormat {
    label: string;
    width: number; // in pixel
    height: number; // in pixel
}

export const ContentFormats: ContentFormat[] = [
    { label: 'Instagram Post', width: 1080, height: 1080 },
    { label: 'Instagram Story', width: 1080, height: 1920 },
    { label: 'Facebook Post', width: 1200, height: 630 },
    { label: 'Twitter Post', width: 1024, height: 512 },
    { label: 'LinkedIn Post', width: 1200, height: 627 },
]

const DEFAULT_CONTENT_FORMAT_LABEL = 'Instagram Post';

const getDefaultContentFormat = (): ContentFormat => {
    const format = ContentFormats.find(item => item.label === DEFAULT_CONTENT_FORMAT_LABEL) || ContentFormats[0];
    return { ...format };
};

const findContentFormatByLabel = (label: string): ContentFormat | null => {
    const format = ContentFormats.find(item => item.label === label);
    return format ? { ...format } : null;
};

export type { ContentFormat };
export { DEFAULT_CONTENT_FORMAT_LABEL, getDefaultContentFormat, findContentFormatByLabel };