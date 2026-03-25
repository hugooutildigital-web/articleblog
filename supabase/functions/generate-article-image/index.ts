import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const parseDataUrl = (dataUrl: string) => {
  const base64Match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!base64Match) return null;

  const extension = base64Match[1] === "jpg" ? "jpeg" : base64Match[1];
  const binaryString = atob(base64Match[2]);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    bytes,
    extension,
    contentType: `image/${extension}`,
  };
};

const extensionFromContentType = (contentType: string | null) => {
  if (!contentType) return "png";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpeg";
  if (contentType.includes("webp")) return "webp";
  return "png";
};

const placeholderSvg = ({
  title,
  siteName,
  siteNiche,
  category,
}: {
  title: string;
  siteName?: string;
  siteNiche?: string;
  category?: string;
}) => {
  const safeTitle = escapeXml(title).slice(0, 120);
  const safeSite = escapeXml(siteName || "Article Blog");
  const safeMeta = escapeXml(category || siteNiche || "Image de couverture");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" fill="none">
      <rect width="1600" height="900" fill="#0F1117"/>
      <rect x="64" y="64" width="1472" height="772" rx="32" fill="url(#panel)" stroke="#2B3240"/>
      <circle cx="1380" cy="180" r="180" fill="#00E87A" fill-opacity="0.14"/>
      <circle cx="220" cy="760" r="220" fill="#00E87A" fill-opacity="0.10"/>
      <path d="M96 680C336 560 544 520 820 552C1058 580 1234 510 1504 316" stroke="#00E87A" stroke-opacity="0.24" stroke-width="10" stroke-linecap="round"/>
      <rect x="128" y="128" width="182" height="14" rx="7" fill="#00E87A"/>
      <text x="128" y="238" fill="#F6F7FB" font-family="Arial, sans-serif" font-size="76" font-weight="700">
        <tspan x="128" dy="0">${safeTitle}</tspan>
      </text>
      <text x="128" y="672" fill="#C3CAD5" font-family="Arial, sans-serif" font-size="34" font-weight="500">${safeSite}</text>
      <text x="128" y="728" fill="#8A94A6" font-family="Arial, sans-serif" font-size="28">${safeMeta}</text>
      <defs>
        <linearGradient id="panel" x1="160" y1="120" x2="1440" y2="780" gradientUnits="userSpaceOnUse">
          <stop stop-color="#121723"/>
          <stop offset="1" stop-color="#161D2B"/>
        </linearGradient>
      </defs>
    </svg>
  `.trim();
};

const resolveImageAsset = async (imageUrl: string) => {
  const parsedDataUrl = parseDataUrl(imageUrl);
  if (parsedDataUrl) return parsedDataUrl;

  if (!/^https?:\/\//.test(imageUrl)) {
    throw new Error("Unsupported image format returned by AI gateway");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Temporary image download failed with status ${imageResponse.status}`);
  }

  const contentType = imageResponse.headers.get("content-type");
  if (!contentType?.startsWith("image/")) {
    throw new Error(`Expected image content-type, received ${contentType ?? "unknown"}`);
  }

  return {
    bytes: new Uint8Array(await imageResponse.arrayBuffer()),
    extension: extensionFromContentType(contentType),
    contentType,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { articleId, title, siteName, siteNiche, category } = await req.json();
    if (!articleId || !title) {
      return new Response(JSON.stringify({ error: "articleId and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env vars missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const imagePrompt = `Professional, high-quality blog header image for an article titled "${title}". ${siteName ? `Business: ${siteName}.` : ""} ${siteNiche ? `Industry: ${siteNiche}.` : ""} ${category ? `Category: ${category}.` : ""} Modern, clean, photorealistic style. No text overlay. Landscape 16:9 ratio. On a clean background.`;

    // Retry logic with exponential backoff for rate limits
    const models = ["google/gemini-3.1-flash-image-preview", "google/gemini-3-pro-image-preview"];

    let imageUrlFromModel: string | null = null;
    let lastError = "";

    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 2000; // 4s, 8s
          console.log(`[Image] Retry ${attempt + 1} for model ${model} after ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }

        try {
          console.log(`[Image] Generating with ${model} (attempt ${attempt + 1})...`);
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: imagePrompt }],
              modalities: ["image", "text"],
            }),
          });

          if (aiResponse.status === 429) {
            lastError = "Rate limited (429)";
            console.warn(`[Image] Rate limited on ${model}, attempt ${attempt + 1}`);
            continue; // retry same model
          }

          if (!aiResponse.ok) {
            lastError = `HTTP ${aiResponse.status}`;
            const errText = await aiResponse.text();
            console.error(`[Image] Error ${aiResponse.status} on ${model}:`, errText);
            break; // try next model
          }

          const aiData = await aiResponse.json();
          imageUrlFromModel = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;

          if (imageUrlFromModel) {
            console.log(`[Image] ✅ Generated successfully with ${model}`);
            break; // success
          } else {
            lastError = "No image in response";
            console.warn(`[Image] No image in response from ${model}`);
            break; // try next model
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Unknown error";
          console.error(`[Image] Exception on ${model}:`, lastError);
          break; // try next model
        }
      }
      if (imageUrlFromModel) break; // found an image, stop trying models
    }

    let imageAsset: { bytes: Uint8Array; extension: string; contentType: string } | null = null;

    if (imageUrlFromModel) {
      try {
        imageAsset = await resolveImageAsset(imageUrlFromModel);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown asset resolution error";
        console.error(`[Image] Failed to persist generated image: ${lastError}`);
      }
    }

    if (!imageAsset) {
      console.warn(`[Image] Falling back to SVG placeholder. Reason: ${lastError || "AI image unavailable"}`);
      imageAsset = {
        bytes: new TextEncoder().encode(
          placeholderSvg({
            title,
            siteName,
            siteNiche,
            category,
          }),
        ),
        extension: "svg",
        contentType: "image/svg+xml",
      };
    }

    // Upload to Supabase Storage
    const fileName = `${articleId}.${imageAsset.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("article-images")
      .upload(fileName, imageAsset.bytes, {
        contentType: imageAsset.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Image] Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Upload failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("article-images").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // Update article with image URL
    const { error: updateError } = await supabase
      .from("articles")
      .update({ image_url: publicUrl })
      .eq("id", articleId);

    if (updateError) {
      console.error("[Image] Article update error:", updateError);
    }

    console.log(`[Image] ✅ Complete: ${publicUrl}`);

    return new Response(JSON.stringify({ image_url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Image] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
