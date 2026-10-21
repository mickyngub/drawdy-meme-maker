const UPLOAD_MAX_SIDE = 1600;
const UPLOAD_QUALITY = 0.9;

export type Upload = { dataUrl: string; width: number; height: number };

// crossOrigin keeps imgflip pictures from tainting the canvas the meme is exported from.
export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("The picture didn't load."));
        image.src = src;
    });
}

function readAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export async function readUpload(file: Blob): Promise<Upload> {
    const image = await loadImage(await readAsDataUrl(file));
    const scale = Math.min(
        1,
        UPLOAD_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight, 1)
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas.");
    ctx.drawImage(image, 0, 0, width, height);
    return {
        dataUrl: canvas.toDataURL("image/webp", UPLOAD_QUALITY),
        width,
        height,
    };
}
