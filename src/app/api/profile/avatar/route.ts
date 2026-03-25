import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/backend/auth";

export const dynamic = "force-dynamic";

const BUCKET = "profile-pictures";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function getExtension(file: File) {
  const nameParts = file.name.split(".");
  const extFromName = nameParts.length > 1 ? nameParts.pop() : "";
  const ext = String(extFromName || "").toLowerCase();

  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return null;
}

export async function POST(req: Request) {
  const raw = (await cookies()).get("warwick_session")?.value;

  if (!raw) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const session = await getSession(raw);

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "invalid_session" },
      { status: 401 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "file_required" },
      { status: 400 }
    );
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: "invalid_file_type" },
      { status: 400 }
    );
  }

  if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 400 }
    );
  }

  const ext = getExtension(file);
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "unsupported_extension" },
      { status: 400 }
    );
  }

  const folder = session.role === "admin" ? "admin" : "resident";
  const path = `${folder}/${session.userId}/avatar.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[POST /api/profile/avatar] upload error:", uploadError);
    return NextResponse.json(
      { ok: false, error: "upload_failed" },
      { status: 500 }
    );
  }

  const table = session.role === "admin" ? "admins" : "residents";

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  const publicUrl = publicUrlData?.publicUrl ?? null;

  const { data: profile, error: updateError } = await supabase
    .from(table)
    .update({ profile_image_path: publicUrl })
    .eq("id", session.userId)
    .select("*")
    .maybeSingle();

  if (updateError || !profile) {
    console.error("[POST /api/profile/avatar] db update error:", updateError);
    return NextResponse.json(
      { ok: false, error: "profile_image_update_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    profileImageUrl: publicUrl,
    profile,
  });
}

