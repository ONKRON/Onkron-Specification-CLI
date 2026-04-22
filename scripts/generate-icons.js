#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const png2icons = require("png2icons");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const ICONS_DIR = path.join(ROOT, "build", "icons");

const CANDIDATE_INPUTS = [
  path.join(ICONS_DIR, "source.svg"),
  path.join(ICONS_DIR, "source.png"),
  path.join(ICONS_DIR, "source.jpg"),
  path.join(ICONS_DIR, "source.jpeg"),
  path.join(ICONS_DIR, "source.icns"),
  path.join(ICONS_DIR, "source.ico"),
  path.join(ICONS_DIR, "icon.svg"),
  path.join(ICONS_DIR, "icon.png"),
  path.join(ICONS_DIR, "icon.jpg"),
  path.join(ICONS_DIR, "icon.jpeg"),
  path.join(ICONS_DIR, "icon.icns"),
  path.join(ICONS_DIR, "icon.ico"),
];

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" });
}

function resolveInputPath() {
  const explicit = process.argv[2];
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Input file not found: ${resolved}`);
    }
    return {
      explicit: true,
      candidates: [resolved],
    };
  }

  const found = CANDIDATE_INPUTS.filter((filePath) => fs.existsSync(filePath));
  if (found.length === 0) {
    throw new Error(
      `No source icon found. Put source.png/source.icns in ${ICONS_DIR} or pass a file path: npm run icons:build -- /abs/path/icon.png`
    );
  }

  return {
    explicit: false,
    candidates: found,
  };
}

function getImageSize(filePath) {
  const output = run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath]);
  const widthMatch = output.match(/pixelWidth:\s*(\d+)/);
  const heightMatch = output.match(/pixelHeight:\s*(\d+)/);

  if (!widthMatch || !heightMatch) {
    throw new Error(`Cannot read image size via sips: ${filePath}`);
  }

  return {
    width: Number(widthMatch[1]),
    height: Number(heightMatch[1]),
  };
}

async function convertSvgToPng(svgPath, outPngPath) {
  const rawSvg = fs.readFileSync(svgPath, "utf8");

  await sharp(Buffer.from(rawSvg), { density: 2048 })
    .png()
    .toFile(outPngPath);
}

async function buildMasterIconPng(inputPngPath, outPngPath, { preferLeftSquare = false }) {
  let image = sharp(inputPngPath);
  const metadata = await image.metadata();

  if (
    preferLeftSquare &&
    metadata.width &&
    metadata.height &&
    metadata.width > metadata.height * 1.2
  ) {
    image = image.extract({
      left: 0,
      top: 0,
      width: metadata.height,
      height: metadata.height,
    });
  }

  const trimmed = image.trim({ threshold: 8 });
  const symbol = await trimmed
    .resize(860, 860, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: symbol, gravity: "center" }])
    .png()
    .toFile(outPngPath);
}

function ensureTool(name) {
  try {
    run("which", [name]);
  } catch {
    throw new Error(`${name} is not available on this machine`);
  }
}

async function main() {
  ensureTool("sips");

  fs.mkdirSync(ICONS_DIR, { recursive: true });

  const inputSelection = resolveInputPath();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vamshop-icons-"));

  try {
    let inputPath = null;
    let normalizedPng = null;
    let sourceSize = null;
    let sourceExtension = null;

    for (const candidate of inputSelection.candidates) {
      const candidatePng = path.join(
        tempDir,
        `${path.basename(candidate, path.extname(candidate))}.png`
      );

      const extension = path.extname(candidate).toLowerCase();
      if (extension === ".svg") {
        await convertSvgToPng(candidate, candidatePng);
      } else {
        run("sips", ["-s", "format", "png", candidate, "--out", candidatePng]);
      }

      const candidateSize = getImageSize(candidatePng);

      if (Math.min(candidateSize.width, candidateSize.height) >= 512) {
        inputPath = candidate;
        normalizedPng = candidatePng;
        sourceSize = candidateSize;
        sourceExtension = extension;
        break;
      }
    }

    if (!inputPath || !normalizedPng || !sourceSize) {
      if (inputSelection.explicit) {
        throw new Error(
          "Source icon is too small. Use at least 512x512, recommended 1024x1024."
        );
      }
      throw new Error(
        "No suitable source icon found (min size 512x512). Put source.png/source.jpg/source.icns with at least 512x512."
      );
    }

    console.log(
      `[icons] Source: ${inputPath} (${sourceSize.width}x${sourceSize.height})`
    );

    const iconPng = path.join(ICONS_DIR, "icon.png");
    await buildMasterIconPng(normalizedPng, iconPng, {
      preferLeftSquare: sourceExtension === ".svg",
    });
    const generatedMainPngSize = getImageSize(iconPng);
    if (generatedMainPngSize.width < 512 || generatedMainPngSize.height < 512) {
      throw new Error(
        `Failed to produce large icon.png (got ${generatedMainPngSize.width}x${generatedMainPngSize.height}). Use a larger source image.`
      );
    }
    console.log(`[icons] Generated: ${iconPng}`);

    const iconIcns = path.join(ICONS_DIR, "icon.icns");
    const iconIco = path.join(ICONS_DIR, "icon.ico");
    const iconPngBuffer = fs.readFileSync(iconPng);

    const icnsBuffer = png2icons.createICNS(iconPngBuffer, png2icons.BICUBIC, 0);
    if (!icnsBuffer) {
      throw new Error("Failed to generate icon.icns from source image");
    }
    fs.writeFileSync(iconIcns, icnsBuffer);
    console.log(`[icons] Generated: ${iconIcns}`);

    const icoBuffer = png2icons.createICO(
      iconPngBuffer,
      png2icons.BICUBIC,
      0,
      false,
      true
    );
    if (!icoBuffer) {
      throw new Error("Failed to generate icon.ico from source image");
    }
    fs.writeFileSync(iconIco, icoBuffer);
    console.log(`[icons] Generated: ${iconIco}`);

    console.log("[icons] Done");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[icons] Error: ${error.message}`);
  process.exitCode = 1;
});
