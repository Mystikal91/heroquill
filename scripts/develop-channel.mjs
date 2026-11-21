// Run after `npm run build` for the preview of a branch (VITE_CHANNEL=develop): the pages of the
// preview are not for search engines, so robots.txt closes the whole site and every answer says
// noindex. The normal build does not use this.
import { appendFileSync, existsSync, rmSync, writeFileSync } from "node:fs";

writeFileSync("dist/robots.txt", "User-agent: *\nDisallow: /\n");
if (existsSync("dist/sitemap.xml")) rmSync("dist/sitemap.xml");
appendFileSync("dist/_headers", "\n/*\n  X-Robots-Tag: noindex, nofollow\n");
console.log("The site is closed to search engines.");
