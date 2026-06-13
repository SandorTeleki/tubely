import path from "path";
import { randomBytes } from "crypto";
import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

function getExtensionFromMimeType(mimeType: string): string {
  const parts = mimeType.split("/");
  if (parts.length !== 2) {
    return "bin";
  }
  return parts[1];
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const MAX_UPLOAD_SIZE = 10 << 20;

  const formData = await req.formData();
  const file = formData.get("thumbnail");

  if (!(file instanceof File)) {
    throw new BadRequestError("Invalid file upload");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File too large");
  }

  const mediaType = file.type;
  if (mediaType !== "image/jpeg" && mediaType !== "image/png") {
    throw new BadRequestError("Invalid file type. Only JPEG and PNG are allowed");
  }

  const data = await file.arrayBuffer();

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError("You don't own this video");
  }

  const ext = getExtensionFromMimeType(mediaType);
  const randomName = randomBytes(32).toString("base64url");
  const filename = `${randomName}.${ext}`;
  const filePath = path.join(cfg.assetsRoot, filename);

  await Bun.write(filePath, data);

  const thumbnailURL = `http://localhost:${cfg.port}/assets/${filename}`;
  video.thumbnailURL = thumbnailURL;
  updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}
