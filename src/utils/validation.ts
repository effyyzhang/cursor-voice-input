import { z } from "zod";

export const FileTreeSchema = z.array(
  z.string().refine((path) => path.length > 0, {
    message: "File path cannot be empty",
  })
);

export type FileTree = z.infer<typeof FileTreeSchema>;
