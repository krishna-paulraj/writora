-- Add Recraft AI image-generation settings to Site.
ALTER TABLE "Site" ADD COLUMN "imageStyle" TEXT NOT NULL DEFAULT 'digital_illustration';
ALTER TABLE "Site" ADD COLUMN "autoGenerateImages" BOOLEAN NOT NULL DEFAULT true;
