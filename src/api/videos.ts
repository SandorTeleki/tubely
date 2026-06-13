import { respondWithJSON } from "./json";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { unlink } from "fs/promises";
import path from "path";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError("You don't own this video");
  }

  const MAX_UPLOAD_SIZE = 1 << 30;

  const formData = await req.formData();
  const file = formData.get("video");

  if (!(file instanceof File)) {
    throw new BadRequestError("Invalid file upload");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File too large");
  }

  if (file.type !== "video/mp4") {
    throw new BadRequestError("Invalid file type. Only MP4 is allowed");
  }

  const tempPath = path.join(cfg.assetsRoot, `${videoId}.tmp.mp4`);
  const data = await file.arrayBuffer();
  await Bun.write(tempPath, data);

  try {
    const key = `${videoId}.mp4`;
    const s3File = cfg.s3Client.file(key, {
      bucket: cfg.s3Bucket,
      type: "video/mp4",
    });
    await s3File.write(Bun.file(tempPath));

    const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
    video.videoURL = videoURL;
    updateVideo(cfg.db, video);

    return respondWithJSON(200, video);
  } finally {
    await unlink(tempPath);
  }
}
