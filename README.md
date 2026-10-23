# ATS Resume

Free ATS-friendly resume builder and ATS checker. Plain HTML, CSS and JavaScript: no build step, no server.

## Put it on GitHub Pages (no folders needed)
All files sit together in one folder, so the normal "Upload files" button works.

1. Unzip the download and open the folder.
2. In your GitHub repository click **Add file > Upload files**.
3. Press **Ctrl+A** in the folder to select ALL files (about 25 files: .html, .css, .js, favicon.svg and the text files), then drag them into the page or use **choose your files** and select them all.
4. Commit changes. The repository page must now list `index.html`, `base.css`, `site.css`, `site.js` and the other `.js` files at the top level.
5. **Settings > Pages**: Deploy from a branch, branch **main**, folder **/ (root)**, Save.
6. Wait 1 to 2 minutes, then open https://YOUR-USERNAME.github.io/YOUR-REPO/ and press Ctrl+F5.

Uploading a file with the same name replaces the old one, so you can re-upload over an earlier attempt.

## Before you publish
1. Edit `config.js` and set `contactEmail` to your real address.
2. Review `privacy.html`; update it if you add analytics, ads, accounts or a backend.

## Pages
`index.html` home, `builder.html` resume builder, `ats-checker.html` ATS checker, `contact.html`, `privacy.html`

## ATS scoring
A transparent 100-point checklist (Keywords 40, Formatting 20, Content 40) in `ats.js`. Real ATS vendors do not publish their
scoring, so this is an estimate against best practices, not an exact employer score.

## Copyright
Copyright (c) 2026 ATS Resume. All rights reserved. See COPYRIGHT.txt.
