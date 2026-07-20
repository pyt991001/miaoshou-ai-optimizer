import type { ProductImageType } from "@prisma/client";

export interface ImageOptimizationRules {
  quality: "low" | "medium" | "high";
  size: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  output_format: "png" | "jpeg";
  compression?: number;
  background?: "auto" | "transparent" | "opaque";
  number_of_variants: number;
  image_prompt?: string;
  template?: "standard" | "model_try_on";
  model_reference_image_url?: string;
  image_type: ProductImageType;
}

export const defaultImagePrompt =
  "Edit this product image into a professional e-commerce listing image. Preserve the exact product design, shape, proportions, material, colors, patterns, prints, labels and included items. Do not redesign, replace, deform or add accessories to the product. Remove the original cluttered background and use a clean, natural commercial photography setting. Improve lighting, sharpness, composition and realistic shadows. The final result must look like a real product photograph rather than an AI-generated illustration.";

export const modelTryOnPrompt =
  "Virtual try-on template. There are two image sources when a model reference is provided. IMAGE 1 is the GARMENT SOURCE and has absolute priority for the clothing. Copy the garment from IMAGE 1 exactly: design, color, fabric texture, print, graphics, logo/text if present, cut, length, collar, sleeves, buttons, seams and all visible details. IMAGE 2 is only the MODEL REFERENCE: use only the model's face, body shape, skin tone, pose, camera angle and lighting mood. Completely ignore and remove the clothing design, print, text and logos from IMAGE 2. Dress the model from IMAGE 2 in the garment from IMAGE 1. The final clothing must match IMAGE 1, not IMAGE 2. Make the garment look naturally worn with realistic fit, drape, folds, shadows and lighting. Do not invent new words, graphics, logos or patterns. Do not alter the model's face. Output a clean, realistic e-commerce fashion image.";

export function defaultRules(imageType: ProductImageType): ImageOptimizationRules {
  return {
    quality: "high",
    size: "1024x1024",
    output_format: "png",
    background: "auto",
    number_of_variants: 1,
    template: "standard",
    image_type: imageType
  };
}

export function buildImagePrompt(input: { title: string; category?: string; imageType: ProductImageType; rules: ImageOptimizationRules }): string {
  const typeRules: Record<ProductImageType, string> = {
    MAIN_IMAGE: "Main image rules: center the product, make the subject occupy about 75% to 85% of the frame, keep the background simple, do not add promotional text, borders or platform logos, output square 1:1.",
    GALLERY_IMAGE: "Gallery image rules: keep product details truthful, improve composition, do not invent usage effects or functions.",
    SKU_IMAGE: "SKU image rules: do not change color or specification, keep composition consistent across SKUs, output square 1:1.",
    DETAIL_IMAGE: "Detail image rules: usage scenes may be kept, do not invent functions, effects or unverified claims."
  };
  const basePrompt = input.rules.image_prompt || (input.rules.template === "model_try_on" ? modelTryOnPrompt : defaultImagePrompt);
  return [
    basePrompt,
    input.rules.template === "model_try_on"
      ? input.rules.model_reference_image_url
        ? "Critical role assignment: first input image = clothing/garment source; second input image = model/person reference only. If there is any conflict, preserve the garment from the first image and discard clothing details from the second image."
        : "No separate model reference image was provided. Create a realistic fashion model try-on result based on the product image, but preserve the garment exactly."
      : null,
    typeRules[input.imageType],
    `Product title: ${input.title}`,
    `Product category: ${input.category ?? "unknown"}`,
    "Use high-fidelity editing for the product subject. Avoid wrong text, extra fingers, duplicate products, deformed product geometry or incorrect labels."
  ]
    .filter(Boolean)
    .join("\n");
}
