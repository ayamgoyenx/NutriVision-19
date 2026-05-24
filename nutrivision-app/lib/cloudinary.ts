import { v2 as cloudinary } from "cloudinary";
import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";

const cloudinaryUrl = process.env.CLOUDINARY_URL;

let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
let apiKey = process.env.CLOUDINARY_API_KEY;
let apiSecret = process.env.CLOUDINARY_API_SECRET;

// Also support the standard Cloudinary URL format:
// CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
if ((!cloudName || !apiKey || !apiSecret) && cloudinaryUrl) {
    try {
        const parsed = new URL(cloudinaryUrl);
        if (parsed.protocol === "cloudinary:") {
            cloudName = cloudName || parsed.hostname;
            apiKey = apiKey || decodeURIComponent(parsed.username);
            apiSecret = apiSecret || decodeURIComponent(parsed.password);
        }
    } catch {
        // ignore invalid CLOUDINARY_URL
    }
}

const isConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isConfigured) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
}

export function isCloudinaryConfigured(): boolean {
    return isConfigured;
}

export async function uploadImageBuffer(params: {
    buffer: Buffer;
    mimeType?: string | null;
    folder?: string;
    publicId?: string;
}): Promise<{ url: string; publicId: string }> {
    if (!isConfigured) {
        throw new Error(
            "Cloudinary is not configured (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)",
        );
    }

    const folder = (
        params.folder ??
        process.env.CLOUDINARY_FOLDER ??
        ""
    ).trim();

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: "image",
                folder: folder || undefined,
                public_id: params.publicId,
                overwrite: false,
            },
            (error?: UploadApiErrorResponse, uploaded?: UploadApiResponse) => {
                if (error) return reject(error);
                if (!uploaded) {
                    return reject(
                        new Error("Cloudinary upload returned empty"),
                    );
                }
                resolve(uploaded);
            },
        );

        stream.end(params.buffer);
    });

    const url =
        typeof result.secure_url === "string" ? result.secure_url : null;
    const publicId =
        typeof result.public_id === "string" ? result.public_id : null;

    if (!url || !publicId) {
        throw new Error("Cloudinary upload failed: missing URL/public_id");
    }

    return { url, publicId };
}
