import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const models = [
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview",
      "google/gemini-2.5-flash-image",
    ];

    let imageDataUrl: string | null = null;
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
          imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (imageDataUrl) {
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
      if (imageDataUrl) break; // found an image, stop trying models
    }

    if (!imageDataUrl) {
      console.error(`[Image] All models failed. Last error: ${lastError}`);
      return new Response(JSON.stringify({ error: `Image generation failed: ${lastError}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract base64 data
    const base64Match = imageDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!base64Match) {
      console.error("[Image] Invalid image data format");
      return new Response(JSON.stringify({ error: "Invalid image format" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageExt = base64Match[1];
    const base64Data = base64Match[2];

    // Decode base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const fileName = `${articleId}.${imageExt}`;
    const { error: uploadError } = await supabase.storage
      .from("article-images")
      .upload(fileName, bytes, {
        contentType: `image/${imageExt}`,
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
